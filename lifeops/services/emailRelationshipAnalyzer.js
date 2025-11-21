const emailService = require('./emailService');
const EmailRelationshipDB = require('./emailRelationshipDB');
const EmailContentAnalyzer = require('./emailContentAnalyzer');
const EmailTieredStorage = require('./emailTieredStorage');

/**
 * EmailRelationshipAnalyzer - Analyzes SENT emails to build relationship intelligence
 * Focuses on people you actively communicate with for better reconnection insights
 * Uses tiered storage: full text (6mo), summaries (18mo), metadata only (5yr)
 */
class EmailRelationshipAnalyzer {
  constructor() {
    this.db = new EmailRelationshipDB();
    this.contentAnalyzer = new EmailContentAnalyzer();
    this.tieredStorage = new EmailTieredStorage();
    this.isProcessing = false;
  }

  /**
   * Initialize database with optimized schema for relationship tracking
   */
  async initializeDatabase() {
    return this.db.initializeDatabase();
  }

  /**
   * Process sent emails only for relationship intelligence
   * Much faster since sent emails are ~10-20% of total volume
   */
  async processEmailHistory(yearsBack = 5) {
    if (this.isProcessing) {
      console.log('⚠️ Email processing already in progress');
      return { status: 'already_processing' };
    }

    try {
      this.isProcessing = true;
      console.log(`🚀 Starting 5-year email analysis (${yearsBack} years back)`);

      if (!this.db.getDB()) {
        await this.initializeDatabase();
      }

      // Check if EmailService is authenticated
      if (!emailService.isAuth()) {
        throw new Error('EmailService not authenticated');
      }

      // Record processing start
      await this.db.recordProcessingStart('full_history_analysis');

      const startDate = new Date();
      startDate.setFullYear(startDate.getFullYear() - yearsBack);
      
      let totalProcessed = 0;
      let currentDate = new Date(); // Start from today and go backwards
      const batchSize = 50; // Process 50 emails at a time
      let pageToken = null;

      console.log(`📧 Processing emails from ${startDate.toISOString()} to ${currentDate.toISOString()}`);

      while (currentDate > startDate) {
        try {
          // Calculate batch date range (1 month chunks)
          const batchEndDate = new Date(currentDate);
          const batchStartDate = new Date(currentDate);
          batchStartDate.setMonth(batchStartDate.getMonth() - 1);

          if (batchStartDate < startDate) {
            batchStartDate.setTime(startDate.getTime());
          }

          console.log(`📅 Processing sent emails: ${batchStartDate.toDateString()} to ${batchEndDate.toDateString()}`);

          // Fetch ONLY sent emails for this date range
          const query = `in:sent after:${this.formatDateForGmail(batchStartDate)} before:${this.formatDateForGmail(batchEndDate)}`;
          
          const emailResult = await emailService.getEmails({
            maxResults: batchSize,
            query: query,
            pageToken: pageToken
          });

          if (!emailResult.messages || emailResult.messages.length === 0) {
            console.log(`📧 No more emails found for ${batchStartDate.toDateString()}`);
            currentDate = batchStartDate;
            continue;
          }

          // Process this batch of emails
          const batchCount = await this.processBatch(emailResult.messages, batchStartDate);
          totalProcessed += batchCount;

          console.log(`✅ Processed batch: ${batchCount} emails (Total: ${totalProcessed})`);

          // Update processing status
          await this.db.updateProcessingStatus(totalProcessed, batchEndDate.toISOString());

          // Rate limiting - wait between batches
          await this.sleep(1000); // 1 second between batches

          // Move to next batch
          pageToken = emailResult.nextPageToken;
          if (!pageToken) {
            currentDate = batchStartDate;
            pageToken = null;
          }

        } catch (batchError) {
          console.error(`❌ Error processing batch for ${currentDate.toDateString()}:`, batchError);
          // Continue with next batch
          currentDate.setMonth(currentDate.getMonth() - 1);
        }
      }

      // Calculate relationship health scores
      await this.db.calculateRelationshipScores();

      // Record processing completion
      await this.db.recordProcessingEnd(totalProcessed);

      console.log(`🎉 Email analysis complete! Processed ${totalProcessed} emails`);

      return {
        status: 'completed',
        totalEmailsProcessed: totalProcessed,
        relationshipsFound: await this.db.getRelationshipCount(),
        storageUsed: await this.db.getDatabaseSize()
      };

    } catch (error) {
      console.error('❌ Email history processing error:', error);
      await this.db.recordProcessingError(error.message);
      throw error;
    } finally {
      this.isProcessing = false;
    }
  }

  /**
   * Process a batch of emails and extract relationship data
   */
  async processBatch(emails, batchDate) {
    let processedCount = 0;

    for (const email of emails) {
      try {
        await this.processEmail(email, batchDate);
        processedCount++;
      } catch (emailError) {
        console.error(`❌ Error processing email ${email.id}:`, emailError);
        // Continue with next email
      }
    }

    return processedCount;
  }

  /**
   * Process individual SENT email and update relationship data
   */
  async processEmail(email, batchDate) {
    try {
      // Since we're only processing sent emails, we know the user is the sender
      const toEmails = email.to ? email.to.split(',').map(e => this.contentAnalyzer.extractEmailAddress(e.trim())) : [];

      if (!toEmails || toEmails.length === 0) {
        return; // Skip emails with no recipients
      }

      // Process each recipient as a separate relationship
      for (const recipientEmail of toEmails) {
        if (!recipientEmail || recipientEmail === await this.getUserEmail()) {
          continue; // Skip invalid emails or self-emails
        }

        // Get or create relationship record for this recipient
        const relationship = await this.db.getOrCreateRelationship(
          recipientEmail,
          email,
          this.contentAnalyzer.extractDisplayName.bind(this.contentAnalyzer)
        );

        // Determine storage tier based on email date
        const storageTier = this.tieredStorage.determineStorageTier(email.date);

        // Process email content based on storage tier
        let fullContent = null;
        let contentSummary = null;
        let wordCount = 0;

        if (storageTier === 'full_text') {
          fullContent = email.body;
          wordCount = email.body ? email.body.split(' ').length : 0;
        } else if (storageTier === 'summary_only') {
          // Only summarize if email is substantial
          if (email.body && email.body.length > 200) {
            contentSummary = await this.contentAnalyzer.summarizeEmail(email);
          } else {
            contentSummary = email.subject || 'Short email';
          }
          wordCount = contentSummary ? contentSummary.split(' ').length : 0;
        }
        // For metadata_only, we store neither full content nor summary

        // Store sent email
        await this.db.storeSentEmail({
          relationshipId: relationship.id,
          gmailMessageId: email.id,
          threadId: email.threadId,
          subject: email.subject,
          dateSent: email.date.toISOString(),
          storageTier: storageTier,
          fullContent: fullContent,
          contentSummary: contentSummary,
          wordCount: wordCount,
          toRecipients: JSON.stringify(toEmails)
        });

        // Update relationship statistics for sent email
        await this.db.updateRelationshipStats(relationship.id, email.date);
      }

    } catch (error) {
      console.error('❌ Error processing individual sent email:', error);
      throw error;
    }
  }

  /**
   * Get dormant relationships - people you used to email but haven't lately
   */
  async getDormantRelationships(daysThreshold = 30, minEmailsSent = 3) {
    return this.db.getDormantRelationships(daysThreshold, minEmailsSent);
  }

  // Utility methods
  async getUserEmail() {
    try {
      const profile = await emailService.getProfile();
      return profile.emailAddress;
    } catch (error) {
      console.error('❌ Error getting user email:', error);
      return null;
    }
  }

  formatDateForGmail(date) {
    return date.toISOString().split('T')[0].replace(/-/g, '/');
  }

  async sleep(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  /**
   * Get processing status
   */
  async getProcessingStatus() {
    return this.db.getProcessingStatus();
  }

  /**
   * Generate AI-powered reconnection email suggestion
   */
  async generateReconnectionEmail(emailAddress) {
    const relationship = await this.db.getRelationshipByEmail(emailAddress);
    const userEmail = await this.getUserEmail();
    return this.contentAnalyzer.generateReconnectionEmail(emailAddress, relationship, userEmail);
  }

  getStatus() {
    return {
      isProcessing: this.isProcessing,
      databaseInitialized: !!this.db.getDB(),
      emailServiceReady: emailService.isAuth(),
      openaiAvailable: !!process.env.OPENAI_API_KEY
    };
  }
}

// Export singleton instance
module.exports = new EmailRelationshipAnalyzer();