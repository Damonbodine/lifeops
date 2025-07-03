const sqlite3 = require('sqlite3').verbose();
const path = require('path');
const os = require('os');
const fs = require('fs').promises;
const emailService = require('./emailService');
const OpenAI = require('openai');

/**
 * EmailRelationshipAnalyzer - Analyzes SENT emails to build relationship intelligence
 * Focuses on people you actively communicate with for better reconnection insights
 * Uses tiered storage: full text (6mo), summaries (18mo), metadata only (5yr)
 */
class EmailRelationshipAnalyzer {
  constructor() {
    this.openai = new OpenAI({
      apiKey: process.env.OPENAI_API_KEY,
    });

    // Tiered storage configuration
    this.storageConfig = {
      recent: { months: 6, storage: 'full_text' },
      medium: { months: 18, storage: 'summary_only' },
      archive: { years: 5, storage: 'metadata_only' }
    };

    this.dbPath = path.join(os.homedir(), '.lifeops', 'email-relationships.db');
    this.db = null;
    this.isProcessing = false;
  }

  /**
   * Initialize database with optimized schema for relationship tracking
   */
  async initializeDatabase() {
    try {
      // Ensure directory exists
      await fs.mkdir(path.dirname(this.dbPath), { recursive: true });

      this.db = new sqlite3.Database(this.dbPath);

      const schema = `
        -- Core relationship table (sent email recipients)
        CREATE TABLE IF NOT EXISTS relationships (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          email_address TEXT UNIQUE NOT NULL,
          display_name TEXT,
          first_sent_date TEXT,
          last_sent_date TEXT,
          total_emails_sent INTEGER DEFAULT 0,
          relationship_type TEXT DEFAULT 'unknown',
          communication_frequency REAL DEFAULT 0.0,
          health_score REAL DEFAULT 0.0,
          days_since_last_contact INTEGER DEFAULT 0,
          avg_emails_per_month REAL DEFAULT 0.0,
          created_at TEXT DEFAULT CURRENT_TIMESTAMP,
          updated_at TEXT DEFAULT CURRENT_TIMESTAMP
        );

        -- Sent email interactions with tiered storage
        CREATE TABLE IF NOT EXISTS sent_emails (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          relationship_id INTEGER,
          gmail_message_id TEXT UNIQUE,
          thread_id TEXT,
          subject TEXT,
          date_sent TEXT,
          storage_tier TEXT CHECK(storage_tier IN ('full_text', 'summary_only', 'metadata_only')),
          full_content TEXT,
          content_summary TEXT,
          word_count INTEGER,
          to_recipients TEXT, -- JSON array of all recipients
          created_at TEXT DEFAULT CURRENT_TIMESTAMP,
          FOREIGN KEY (relationship_id) REFERENCES relationships(id)
        );

        -- Communication patterns and voice analysis
        CREATE TABLE IF NOT EXISTS communication_patterns (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          relationship_id INTEGER,
          typical_greeting TEXT,
          typical_closing TEXT,
          average_email_length INTEGER,
          formality_score REAL,
          common_topics TEXT, -- JSON array of topics
          response_pattern TEXT,
          last_analyzed TEXT DEFAULT CURRENT_TIMESTAMP,
          FOREIGN KEY (relationship_id) REFERENCES relationships(id)
        );

        -- Processing status tracking
        CREATE TABLE IF NOT EXISTS processing_status (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          process_type TEXT,
          start_date TEXT,
          end_date TEXT,
          emails_processed INTEGER DEFAULT 0,
          status TEXT,
          last_processed_date TEXT,
          created_at TEXT DEFAULT CURRENT_TIMESTAMP
        );

        -- Indexes for performance
        CREATE INDEX IF NOT EXISTS idx_relationships_email ON relationships(email_address);
        CREATE INDEX IF NOT EXISTS idx_relationships_last_sent ON relationships(last_sent_date);
        CREATE INDEX IF NOT EXISTS idx_sent_emails_relationship ON sent_emails(relationship_id);
        CREATE INDEX IF NOT EXISTS idx_sent_emails_date ON sent_emails(date_sent);
        CREATE INDEX IF NOT EXISTS idx_sent_emails_thread ON sent_emails(thread_id);
      `;

      return new Promise((resolve, reject) => {
        this.db.exec(schema, (err) => {
          if (err) {
            console.error('❌ Database schema creation error:', err);
            reject(err);
          } else {
            console.log('✅ Email relationships database initialized');
            resolve();
          }
        });
      });
    } catch (error) {
      console.error('❌ Database initialization error:', error);
      throw error;
    }
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

      if (!this.db) {
        await this.initializeDatabase();
      }

      // Check if EmailService is authenticated
      if (!emailService.isAuth()) {
        throw new Error('EmailService not authenticated');
      }

      // Record processing start
      await this.recordProcessingStart('full_history_analysis');

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
          await this.updateProcessingStatus(totalProcessed, batchEndDate.toISOString());

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
      await this.calculateRelationshipScores();

      // Record processing completion
      await this.recordProcessingEnd(totalProcessed);

      console.log(`🎉 Email analysis complete! Processed ${totalProcessed} emails`);
      
      return {
        status: 'completed',
        totalEmailsProcessed: totalProcessed,
        relationshipsFound: await this.getRelationshipCount(),
        storageUsed: await this.getDatabaseSize()
      };

    } catch (error) {
      console.error('❌ Email history processing error:', error);
      await this.recordProcessingError(error.message);
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
      const toEmails = email.to ? email.to.split(',').map(e => this.extractEmailAddress(e.trim())) : [];
      
      if (!toEmails || toEmails.length === 0) {
        return; // Skip emails with no recipients
      }

      // Process each recipient as a separate relationship
      for (const recipientEmail of toEmails) {
        if (!recipientEmail || recipientEmail === await this.getUserEmail()) {
          continue; // Skip invalid emails or self-emails
        }

        // Get or create relationship record for this recipient
        const relationship = await this.getOrCreateRelationship(recipientEmail, email);

        // Determine storage tier based on email date
        const storageTier = this.determineStorageTier(email.date);

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
            contentSummary = await this.summarizeEmail(email);
          } else {
            contentSummary = email.subject || 'Short email';
          }
          wordCount = contentSummary ? contentSummary.split(' ').length : 0;
        }
        // For metadata_only, we store neither full content nor summary

        // Store sent email
        await this.storeSentEmail({
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
        await this.updateRelationshipStats(relationship.id, email.date);
      }

    } catch (error) {
      console.error('❌ Error processing individual sent email:', error);
      throw error;
    }
  }

  /**
   * Determine storage tier based on email date
   */
  determineStorageTier(emailDate) {
    const now = new Date();
    const emailTime = new Date(emailDate);
    const monthsOld = (now - emailTime) / (1000 * 60 * 60 * 24 * 30);

    if (monthsOld <= this.storageConfig.recent.months) {
      return 'full_text';
    } else if (monthsOld <= this.storageConfig.medium.months) {
      return 'summary_only';
    } else {
      return 'metadata_only';
    }
  }

  /**
   * Summarize email content for medium-tier storage
   */
  async summarizeEmail(email) {
    try {
      if (!email.body || email.body.length < 100) {
        return email.body || email.subject;
      }

      const prompt = `Summarize this email in 1-2 sentences, focusing on key topics and purpose:

Subject: ${email.subject}
Content: ${email.body.substring(0, 1000)}

Summary:`;

      const response = await this.openai.chat.completions.create({
        model: 'gpt-3.5-turbo',
        messages: [{ role: 'user', content: prompt }],
        max_tokens: 100,
        temperature: 0.3,
      });

      return response.choices[0].message.content.trim();
    } catch (error) {
      console.error('❌ Error summarizing email:', error);
      return email.subject || 'Email content summary unavailable';
    }
  }

  /**
   * Calculate relationship health scores based on sent email patterns
   */
  async calculateRelationshipScores() {
    return new Promise((resolve, reject) => {
      const query = `
        UPDATE relationships 
        SET 
          days_since_last_contact = julianday('now') - julianday(last_sent_date),
          avg_emails_per_month = (
            SELECT COUNT(*) * 30.0 / 
            (CASE 
              WHEN julianday('now') - julianday(first_sent_date) <= 30 THEN 30 
              ELSE julianday('now') - julianday(first_sent_date) 
            END)
            FROM sent_emails 
            WHERE relationship_id = relationships.id
          ),
          communication_frequency = (
            SELECT COUNT(*) * 1.0 / 
            (CASE 
              WHEN julianday('now') - julianday(first_sent_date) <= 0 THEN 1 
              ELSE julianday('now') - julianday(first_sent_date) 
            END)
            FROM sent_emails 
            WHERE relationship_id = relationships.id
          ),
          health_score = (
            SELECT 
              -- Recency score (0-50 points): More recent = higher score
              CASE 
                WHEN julianday('now') - julianday(last_sent_date) <= 7 THEN 50
                WHEN julianday('now') - julianday(last_sent_date) <= 30 THEN 35
                WHEN julianday('now') - julianday(last_sent_date) <= 90 THEN 20
                WHEN julianday('now') - julianday(last_sent_date) <= 180 THEN 10
                ELSE 0
              END +
              -- Frequency score (0-30 points): More emails sent = stronger relationship
              CASE 
                WHEN total_emails_sent >= 50 THEN 30
                WHEN total_emails_sent >= 20 THEN 25
                WHEN total_emails_sent >= 10 THEN 20
                WHEN total_emails_sent >= 5 THEN 15
                WHEN total_emails_sent >= 2 THEN 10
                ELSE 5
              END +
              -- Consistency score (0-20 points): Regular communication = higher score
              CASE 
                WHEN avg_emails_per_month >= 4 THEN 20
                WHEN avg_emails_per_month >= 2 THEN 15
                WHEN avg_emails_per_month >= 1 THEN 10
                WHEN avg_emails_per_month >= 0.5 THEN 5
                ELSE 0
              END
          ),
          updated_at = CURRENT_TIMESTAMP
      `;

      this.db.run(query, (err) => {
        if (err) {
          console.error('❌ Error calculating relationship scores:', err);
          reject(err);
        } else {
          console.log('✅ Relationship health scores calculated');
          resolve();
        }
      });
    });
  }

  /**
   * Get dormant relationships - people you used to email but haven't lately
   */
  async getDormantRelationships(daysThreshold = 30, minEmailsSent = 3) {
    return new Promise((resolve, reject) => {
      const query = `
        SELECT 
          r.*,
          r.days_since_last_contact,
          se.subject as last_subject,
          cp.common_topics,
          CASE 
            WHEN r.avg_emails_per_month >= 2 THEN 'frequent'
            WHEN r.avg_emails_per_month >= 0.5 THEN 'regular'
            ELSE 'occasional'
          END as relationship_strength
        FROM relationships r
        LEFT JOIN sent_emails se ON r.id = se.relationship_id 
          AND se.date_sent = r.last_sent_date
        LEFT JOIN communication_patterns cp ON r.id = cp.relationship_id
        WHERE r.total_emails_sent >= ?
          AND r.days_since_last_contact >= ?
          AND r.health_score > 15
        ORDER BY 
          CASE 
            WHEN r.avg_emails_per_month >= 2 THEN 1
            WHEN r.avg_emails_per_month >= 1 THEN 2
            ELSE 3
          END,
          r.days_since_last_contact DESC
        LIMIT 20
      `;

      this.db.all(query, [minEmailsSent, daysThreshold], (err, rows) => {
        if (err) {
          console.error('❌ Error getting dormant relationships:', err);
          reject(err);
        } else {
          resolve(rows || []);
        }
      });
    });
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

  extractEmailAddress(emailString) {
    if (!emailString) return null;
    const match = emailString.match(/<([^>]+)>/) || emailString.match(/([^\s<>]+@[^\s<>]+)/);
    return match ? match[1] : emailString.trim();
  }

  formatDateForGmail(date) {
    return date.toISOString().split('T')[0].replace(/-/g, '/');
  }

  async sleep(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  // Database helper methods
  async getOrCreateRelationship(email, emailData) {
    return new Promise((resolve, reject) => {
      // First try to get existing relationship
      this.db.get(
        'SELECT * FROM relationships WHERE email_address = ?',
        [email],
        (err, row) => {
          if (err) {
            reject(err);
            return;
          }

          if (row) {
            resolve(row);
          } else {
            // Create new relationship for sent email recipient
            const displayName = this.extractDisplayName(emailData.to || email);
            this.db.run(
              `INSERT INTO relationships 
               (email_address, display_name, first_sent_date, last_sent_date, total_emails_sent) 
               VALUES (?, ?, ?, ?, ?)`,
              [email, displayName, emailData.date.toISOString(), emailData.date.toISOString(), 1],
              function(err) {
                if (err) {
                  reject(err);
                } else {
                  resolve({ id: this.lastID, email_address: email, display_name: displayName });
                }
              }
            );
          }
        }
      );
    });
  }

  extractDisplayName(fromField) {
    if (!fromField) return null;
    const match = fromField.match(/^([^<]+)</);
    return match ? match[1].trim().replace(/"/g, '') : null;
  }

  async storeSentEmail(data) {
    return new Promise((resolve, reject) => {
      this.db.run(
        `INSERT OR IGNORE INTO sent_emails 
         (relationship_id, gmail_message_id, thread_id, subject, date_sent, 
          storage_tier, full_content, content_summary, word_count, to_recipients) 
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        [
          data.relationshipId, data.gmailMessageId, data.threadId, data.subject,
          data.dateSent, data.storageTier, data.fullContent,
          data.contentSummary, data.wordCount, data.toRecipients
        ],
        function(err) {
          if (err) {
            reject(err);
          } else {
            resolve(this.lastID);
          }
        }
      );
    });
  }

  async updateRelationshipStats(relationshipId, emailDate) {
    return new Promise((resolve, reject) => {
      const updateQuery = `
        UPDATE relationships 
        SET 
          last_sent_date = CASE 
            WHEN ? > last_sent_date THEN ? 
            ELSE last_sent_date 
          END,
          total_emails_sent = total_emails_sent + 1,
          updated_at = CURRENT_TIMESTAMP
        WHERE id = ?
      `;

      this.db.run(
        updateQuery,
        [emailDate.toISOString(), emailDate.toISOString(), relationshipId],
        (err) => {
          if (err) {
            reject(err);
          } else {
            resolve();
          }
        }
      );
    });
  }

  // Processing status methods
  async recordProcessingStart(processType) {
    return new Promise((resolve, reject) => {
      this.db.run(
        'INSERT INTO processing_status (process_type, start_date, status) VALUES (?, ?, ?)',
        [processType, new Date().toISOString(), 'running'],
        function(err) {
          if (err) reject(err);
          else resolve(this.lastID);
        }
      );
    });
  }

  async updateProcessingStatus(emailsProcessed, lastProcessedDate) {
    return new Promise((resolve, reject) => {
      this.db.run(
        `UPDATE processing_status 
         SET emails_processed = ?, last_processed_date = ? 
         WHERE status = 'running' AND process_type = 'full_history_analysis'`,
        [emailsProcessed, lastProcessedDate],
        (err) => {
          if (err) reject(err);
          else resolve();
        }
      );
    });
  }

  async recordProcessingEnd(totalProcessed) {
    return new Promise((resolve, reject) => {
      this.db.run(
        `UPDATE processing_status 
         SET end_date = ?, emails_processed = ?, status = 'completed' 
         WHERE status = 'running' AND process_type = 'full_history_analysis'`,
        [new Date().toISOString(), totalProcessed],
        (err) => {
          if (err) reject(err);
          else resolve();
        }
      );
    });
  }

  async recordProcessingError(errorMessage) {
    return new Promise((resolve, reject) => {
      this.db.run(
        `UPDATE processing_status 
         SET end_date = ?, status = 'error' 
         WHERE status = 'running' AND process_type = 'full_history_analysis'`,
        [new Date().toISOString()],
        (err) => {
          if (err) reject(err);
          else resolve();
        }
      );
    });
  }

  async getRelationshipCount() {
    return new Promise((resolve, reject) => {
      this.db.get('SELECT COUNT(*) as count FROM relationships', (err, row) => {
        if (err) reject(err);
        else resolve(row.count);
      });
    });
  }

  async getDatabaseSize() {
    try {
      const stats = await fs.stat(this.dbPath);
      return `${(stats.size / 1024 / 1024).toFixed(2)} MB`;
    } catch (error) {
      return 'Unknown';
    }
  }

  /**
   * Get processing status
   */
  async getProcessingStatus() {
    return new Promise((resolve, reject) => {
      this.db.get(
        'SELECT * FROM processing_status ORDER BY created_at DESC LIMIT 1',
        (err, row) => {
          if (err) {
            reject(err);
          } else {
            resolve(row || { status: 'not_started' });
          }
        }
      );
    });
  }

  /**
   * Get service status
   */
  /**
   * Get conversation history with a specific contact for AI analysis
   * Optimized for speed - only fetches recent emails
   */
  async getConversationHistory(emailAddress, limit = 5) {
    try {
      // Search for emails TO or FROM this contact (recent only for speed)
      const query = `from:${emailAddress} OR to:${emailAddress}`;
      
      const emails = await emailService.getEmails({
        maxResults: limit, // Reduced from 10 to 5 for speed
        query: query
      });

      // Sort by date (newest first)
      return emails.sort((a, b) => new Date(b.date) - new Date(a.date));
    } catch (error) {
      console.error('❌ Error fetching conversation history:', error);
      return [];
    }
  }

  /**
   * Generate AI-powered reconnection email suggestion
   */
  async generateReconnectionEmail(emailAddress) {
    try {
      // Get fuller conversation history for better context
      const conversationHistory = await this.getConversationHistory(emailAddress, 8);
      
      // Get relationship context from database
      const relationship = await this.getRelationshipByEmail(emailAddress);
      
      if (!relationship) {
        throw new Error('Relationship not found in database');
      }
      
      const userEmail = await this.getUserEmail();
      const daysSinceLastContact = Math.round(relationship.days_since_last_contact || 0);
      
      // Build detailed conversation analysis
      const conversationAnalysis = conversationHistory.map((email, i) => {
        const isFromUser = email.from === userEmail;
        const direction = isFromUser ? 'You wrote' : 'They wrote';
        const snippet = email.body ? email.body.substring(0, 150).replace(/\n/g, ' ') : 'No content';
        return `${direction}: "${email.subject}" (${new Date(email.date).toLocaleDateString()}) - ${snippet}...`;
      }).join('\n');

      const lastEmail = conversationHistory[0];
      const relationshipContext = conversationHistory.length > 0 
        ? `You had ${conversationHistory.length} email exchanges. Here's the conversation flow:\n${conversationAnalysis}`
        : 'No recent email history found.';

      const prompt = `You're helping me reconnect with ${relationship.display_name || emailAddress} after ${daysSinceLastContact} days of no contact.

RELATIONSHIP CONTEXT:
- Contact: ${relationship.display_name || emailAddress} (${emailAddress})
- Historical emails sent: ${relationship.total_emails_sent || 0}
- Days since last contact: ${daysSinceLastContact}

CONVERSATION HISTORY:
${relationshipContext}

TASK: Write a personalized reconnection email that:
1. References specific details from our past conversations (be specific!)
2. Feels natural and authentic, not generic
3. Acknowledges the time gap without being awkward
4. Has a genuine reason for reaching out (based on past context)
5. Suggests a concrete next step

Make it feel like I actually know this person and am referencing our real relationship. Use details from the conversation history to make it personal.

FORMAT:
Subject: [write a specific, engaging subject line]

[Write the email body - 2-3 short paragraphs, conversational tone]`;

      const response = await this.openai.chat.completions.create({
        model: 'gpt-4o-mini', // Much better quality than 3.5-turbo, still fast
        messages: [{ role: 'user', content: prompt }],
        max_tokens: 400, // Increased for better quality
        temperature: 0.8, // Slightly more creative
      });

      const aiResponse = response.choices[0].message.content.trim();
      
      // Parse subject and body from AI response
      const lines = aiResponse.split('\n');
      const subjectIndex = lines.findIndex(line => line.toLowerCase().includes('subject'));
      const bodyIndex = lines.findIndex(line => line.toLowerCase().includes('email body') || line.toLowerCase().includes('body'));
      
      let subject = 'Catching up';
      let body = aiResponse;
      
      if (subjectIndex >= 0 && bodyIndex > subjectIndex) {
        subject = lines[subjectIndex + 1]?.trim() || subject;
        body = lines.slice(bodyIndex + 1).join('\n').trim() || body;
      }

      return {
        emailAddress,
        contactName: relationship.display_name || emailAddress,
        subject: subject,
        body: body,
        context: {
          daysSinceLastContact,
          totalEmailsSent: relationship.total_emails_sent || 0,
          lastSubject: lastEmail?.subject || 'No recent emails',
          conversationSample: conversationHistory.slice(0, 2).map(e => ({
            from: e.from === userEmail ? 'You' : e.from,
            subject: e.subject,
            date: new Date(e.date).toLocaleDateString()
          }))
        }
      };

    } catch (error) {
      console.error('❌ Error generating reconnection email:', error);
      throw error;
    }
  }

  /**
   * Get relationship record by email address
   */
  async getRelationshipByEmail(emailAddress) {
    return new Promise((resolve, reject) => {
      this.db.get(
        'SELECT * FROM relationships WHERE email_address = ?',
        [emailAddress],
        (err, row) => {
          if (err) {
            reject(err);
          } else {
            resolve(row);
          }
        }
      );
    });
  }

  getStatus() {
    return {
      isProcessing: this.isProcessing,
      databaseInitialized: !!this.db,
      emailServiceReady: emailService.isAuth(),
      openaiAvailable: !!process.env.OPENAI_API_KEY
    };
  }
}

// Export singleton instance
module.exports = new EmailRelationshipAnalyzer();