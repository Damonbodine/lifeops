const sqlite3 = require('sqlite3').verbose();
const path = require('path');
const os = require('os');
const fs = require('fs').promises;
const { getSchema } = require('../config/emailRelationshipSchema');

/**
 * Database operations for email relationship tracking
 * Handles all CRUD operations and database interactions
 */
class EmailRelationshipDB {
  constructor() {
    this.dbPath = path.join(os.homedir(), '.lifeops', 'email-relationships.db');
    this.db = null;
  }

  /**
   * Initialize database with optimized schema for relationship tracking
   */
  async initializeDatabase() {
    try {
      // Ensure directory exists
      await fs.mkdir(path.dirname(this.dbPath), { recursive: true });

      this.db = new sqlite3.Database(this.dbPath);

      const schema = getSchema();

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
   * Get or create relationship record for an email address
   */
  async getOrCreateRelationship(email, emailData, extractDisplayName) {
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
            const displayName = extractDisplayName(emailData.to || email);
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

  /**
   * Store sent email in database
   */
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

  /**
   * Update relationship statistics after processing an email
   */
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

  /**
   * Record processing start
   */
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

  /**
   * Update processing status
   */
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

  /**
   * Record processing completion
   */
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

  /**
   * Record processing error
   */
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
   * Get total count of relationships
   */
  async getRelationshipCount() {
    return new Promise((resolve, reject) => {
      this.db.get('SELECT COUNT(*) as count FROM relationships', (err, row) => {
        if (err) reject(err);
        else resolve(row.count);
      });
    });
  }

  /**
   * Get database file size
   */
  async getDatabaseSize() {
    try {
      const stats = await fs.stat(this.dbPath);
      return `${(stats.size / 1024 / 1024).toFixed(2)} MB`;
    } catch (error) {
      return 'Unknown';
    }
  }

  /**
   * Get database instance
   */
  getDB() {
    return this.db;
  }
}

module.exports = EmailRelationshipDB;
