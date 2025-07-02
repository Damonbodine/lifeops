const sqlite3 = require('sqlite3').verbose();
const path = require('path');
const os = require('os');
const fs = require('fs').promises;
const emailService = require('./emailService');
const OpenAI = require('openai');

/**
 * EmailRelationshipAnalyzer - Analyzes 5 years of email history to build relationship intelligence
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
        -- Core relationship table
        CREATE TABLE IF NOT EXISTS relationships (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          email_address TEXT UNIQUE NOT NULL,
          display_name TEXT,
          first_contact_date TEXT,
          last_contact_date TEXT,
          total_interactions INTEGER DEFAULT 0,
          sent_by_user INTEGER DEFAULT 0,
          received_by_user INTEGER DEFAULT 0,
          relationship_type TEXT DEFAULT 'unknown',
          communication_frequency REAL DEFAULT 0.0,
          health_score REAL DEFAULT 0.0,
          avg_response_time_hours REAL,
          created_at TEXT DEFAULT CURRENT_TIMESTAMP,
          updated_at TEXT DEFAULT CURRENT_TIMESTAMP
        );

        -- Email interactions with tiered storage
        CREATE TABLE IF NOT EXISTS email_interactions (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          relationship_id INTEGER,
          gmail_message_id TEXT UNIQUE,
          thread_id TEXT,
          subject TEXT,
          date_sent TEXT,
          is_from_user BOOLEAN,
          storage_tier TEXT CHECK(storage_tier IN ('full_text', 'summary_only', 'metadata_only')),
          full_content TEXT,
          content_summary TEXT,
          word_count INTEGER,
          response_time_hours REAL,
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
        CREATE INDEX IF NOT EXISTS idx_relationships_last_contact ON relationships(last_contact_date);
        CREATE INDEX IF NOT EXISTS idx_interactions_relationship ON email_interactions(relationship_id);
        CREATE INDEX IF NOT EXISTS idx_interactions_date ON email_interactions(date_sent);
        CREATE INDEX IF NOT EXISTS idx_interactions_thread ON email_interactions(thread_id);
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
   * Process 5 years of email history with batch processing and rate limiting
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

          console.log(`📅 Processing batch: ${batchStartDate.toDateString()} to ${batchEndDate.toDateString()}`);

          // Fetch emails for this date range
          const query = `after:${this.formatDateForGmail(batchStartDate)} before:${this.formatDateForGmail(batchEndDate)}`;
          
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
   * Process individual email and update relationship data
   */
  async processEmail(email, batchDate) {
    try {
      // Extract email addresses from from/to fields
      const fromEmail = this.extractEmailAddress(email.from);
      const toEmails = email.to ? email.to.split(',').map(e => this.extractEmailAddress(e.trim())) : [];
      
      // Determine if this email was sent by the user
      const userEmail = await this.getUserEmail();
      const isFromUser = fromEmail === userEmail;
      
      // Get the relationship email (the other party)
      const relationshipEmail = isFromUser ? toEmails[0] : fromEmail;
      
      if (!relationshipEmail || relationshipEmail === userEmail) {
        return; // Skip self-emails or invalid emails
      }

      // Get or create relationship record
      const relationship = await this.getOrCreateRelationship(relationshipEmail, email);

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
        contentSummary = await this.summarizeEmail(email);
        wordCount = contentSummary ? contentSummary.split(' ').length : 0;
      }
      // For metadata_only, we store neither full content nor summary

      // Store email interaction
      await this.storeEmailInteraction({
        relationshipId: relationship.id,
        gmailMessageId: email.id,
        threadId: email.threadId,
        subject: email.subject,
        dateSent: email.date.toISOString(),
        isFromUser: isFromUser,
        storageTier: storageTier,
        fullContent: fullContent,
        contentSummary: contentSummary,
        wordCount: wordCount
      });

      // Update relationship statistics
      await this.updateRelationshipStats(relationship.id, email.date, isFromUser);

    } catch (error) {
      console.error('❌ Error processing individual email:', error);
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
   * Calculate relationship health scores based on communication patterns
   */
  async calculateRelationshipScores() {
    return new Promise((resolve, reject) => {
      const query = `
        UPDATE relationships 
        SET 
          communication_frequency = (
            SELECT COUNT(*) * 1.0 / 
            (CASE 
              WHEN julianday('now') - julianday(first_contact_date) <= 0 THEN 1 
              ELSE julianday('now') - julianday(first_contact_date) 
            END)
            FROM email_interactions 
            WHERE relationship_id = relationships.id
          ),
          health_score = (
            SELECT 
              -- Recency score (0-40 points): More recent = higher score
              CASE 
                WHEN julianday('now') - julianday(last_contact_date) <= 7 THEN 40
                WHEN julianday('now') - julianday(last_contact_date) <= 30 THEN 30
                WHEN julianday('now') - julianday(last_contact_date) <= 90 THEN 20
                WHEN julianday('now') - julianday(last_contact_date) <= 365 THEN 10
                ELSE 0
              END +
              -- Frequency score (0-30 points): More frequent = higher score
              CASE 
                WHEN total_interactions >= 100 THEN 30
                WHEN total_interactions >= 50 THEN 25
                WHEN total_interactions >= 20 THEN 20
                WHEN total_interactions >= 10 THEN 15
                WHEN total_interactions >= 5 THEN 10
                ELSE 5
              END +
              -- Bidirectional score (0-30 points): Balanced conversation = higher score
              CASE 
                WHEN sent_by_user > 0 AND received_by_user > 0 THEN
                  30 - ABS(sent_by_user - received_by_user) * 1.0 / (sent_by_user + received_by_user) * 15
                ELSE 10
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
   * Get dormant relationships that need attention
   */
  async getDormantRelationships(daysThreshold = 30, minInteractions = 5) {
    return new Promise((resolve, reject) => {
      const query = `
        SELECT 
          r.*,
          julianday('now') - julianday(r.last_contact_date) as days_since_last_contact,
          ei.subject as last_subject,
          cp.common_topics
        FROM relationships r
        LEFT JOIN email_interactions ei ON r.id = ei.relationship_id 
          AND ei.date_sent = r.last_contact_date
        LEFT JOIN communication_patterns cp ON r.id = cp.relationship_id
        WHERE r.total_interactions >= ?
          AND julianday('now') - julianday(r.last_contact_date) >= ?
          AND r.health_score > 20
        ORDER BY r.health_score DESC, days_since_last_contact DESC
        LIMIT 20
      `;

      this.db.all(query, [minInteractions, daysThreshold], (err, rows) => {
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
            // Create new relationship
            const displayName = this.extractDisplayName(emailData.from);
            this.db.run(
              `INSERT INTO relationships 
               (email_address, display_name, first_contact_date, last_contact_date) 
               VALUES (?, ?, ?, ?)`,
              [email, displayName, emailData.date.toISOString(), emailData.date.toISOString()],
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

  async storeEmailInteraction(data) {
    return new Promise((resolve, reject) => {
      this.db.run(
        `INSERT OR IGNORE INTO email_interactions 
         (relationship_id, gmail_message_id, thread_id, subject, date_sent, 
          is_from_user, storage_tier, full_content, content_summary, word_count) 
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        [
          data.relationshipId, data.gmailMessageId, data.threadId, data.subject,
          data.dateSent, data.isFromUser, data.storageTier, data.fullContent,
          data.contentSummary, data.wordCount
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

  async updateRelationshipStats(relationshipId, emailDate, isFromUser) {
    return new Promise((resolve, reject) => {
      const updateQuery = `
        UPDATE relationships 
        SET 
          last_contact_date = CASE 
            WHEN ? > last_contact_date THEN ? 
            ELSE last_contact_date 
          END,
          total_interactions = total_interactions + 1,
          sent_by_user = sent_by_user + CASE WHEN ? THEN 1 ELSE 0 END,
          received_by_user = received_by_user + CASE WHEN ? THEN 0 ELSE 1 END,
          updated_at = CURRENT_TIMESTAMP
        WHERE id = ?
      `;

      this.db.run(
        updateQuery,
        [emailDate.toISOString(), emailDate.toISOString(), isFromUser, isFromUser, relationshipId],
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