/**
 * Database schema for email relationship tracking
 * Defines tables for relationships, sent emails, communication patterns, and processing status
 */

/**
 * Get the complete database schema for email relationships
 * Includes optimized indexes for performance
 */
function getSchema() {
  return `
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
}

module.exports = {
  getSchema
};
