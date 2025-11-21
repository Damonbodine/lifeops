/**
 * Tiered storage management for email content
 * Manages storage tiers based on email age to optimize storage space
 *
 * Tiers:
 * - Recent (6 months): Full text storage
 * - Medium (18 months): Summary only
 * - Archive (5 years): Metadata only
 */
class EmailTieredStorage {
  constructor() {
    // Tiered storage configuration
    this.storageConfig = {
      recent: { months: 6, storage: 'full_text' },
      medium: { months: 18, storage: 'summary_only' },
      archive: { years: 5, storage: 'metadata_only' }
    };
  }

  /**
   * Get storage configuration
   */
  getConfig() {
    return this.storageConfig;
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
   * Check if email should have full content stored
   */
  shouldStoreFullContent(emailDate) {
    return this.determineStorageTier(emailDate) === 'full_text';
  }

  /**
   * Check if email should have summary stored
   */
  shouldStoreSummary(emailDate) {
    return this.determineStorageTier(emailDate) === 'summary_only';
  }

  /**
   * Check if email should only have metadata
   */
  shouldStoreMetadataOnly(emailDate) {
    return this.determineStorageTier(emailDate) === 'metadata_only';
  }

  /**
   * Get retention period for each tier in days
   */
  getRetentionPeriods() {
    return {
      full_text: this.storageConfig.recent.months * 30,
      summary_only: this.storageConfig.medium.months * 30,
      metadata_only: this.storageConfig.archive.years * 365
    };
  }

  /**
   * Calculate cutoff dates for each storage tier
   */
  getCutoffDates() {
    const now = new Date();
    const recentCutoff = new Date(now);
    recentCutoff.setMonth(recentCutoff.getMonth() - this.storageConfig.recent.months);

    const mediumCutoff = new Date(now);
    mediumCutoff.setMonth(mediumCutoff.getMonth() - this.storageConfig.medium.months);

    const archiveCutoff = new Date(now);
    archiveCutoff.setFullYear(archiveCutoff.getFullYear() - this.storageConfig.archive.years);

    return {
      recentCutoff,
      mediumCutoff,
      archiveCutoff
    };
  }

  /**
   * Get tier migration queries for archiving old emails
   * These queries can be run periodically to optimize storage
   */
  getTierMigrationQueries() {
    const cutoffs = this.getCutoffDates();

    return {
      // Migrate full_text to summary_only (remove full content after 6 months)
      migrateToSummary: `
        UPDATE sent_emails
        SET storage_tier = 'summary_only',
            full_content = NULL
        WHERE storage_tier = 'full_text'
          AND date_sent < ?
          AND content_summary IS NOT NULL
      `,
      migrateToSummaryParams: [cutoffs.recentCutoff.toISOString()],

      // Migrate summary_only to metadata_only (remove summaries after 18 months)
      migrateToMetadata: `
        UPDATE sent_emails
        SET storage_tier = 'metadata_only',
            content_summary = NULL
        WHERE storage_tier = 'summary_only'
          AND date_sent < ?
      `,
      migrateToMetadataParams: [cutoffs.mediumCutoff.toISOString()],

      // Delete metadata_only entries older than 5 years
      deleteOldMetadata: `
        DELETE FROM sent_emails
        WHERE storage_tier = 'metadata_only'
          AND date_sent < ?
      `,
      deleteOldMetadataParams: [cutoffs.archiveCutoff.toISOString()]
    };
  }

  /**
   * Execute tier migration on database (cleanup old data)
   */
  async executeTierMigration(db) {
    const migrations = this.getTierMigrationQueries();
    const results = {
      migratedToSummary: 0,
      migratedToMetadata: 0,
      deletedOld: 0,
      errors: []
    };

    try {
      // Migrate full_text to summary_only
      await new Promise((resolve, reject) => {
        db.run(migrations.migrateToSummary, migrations.migrateToSummaryParams, function(err) {
          if (err) {
            results.errors.push({ migration: 'migrateToSummary', error: err });
            reject(err);
          } else {
            results.migratedToSummary = this.changes;
            resolve();
          }
        });
      });

      // Migrate summary_only to metadata_only
      await new Promise((resolve, reject) => {
        db.run(migrations.migrateToMetadata, migrations.migrateToMetadataParams, function(err) {
          if (err) {
            results.errors.push({ migration: 'migrateToMetadata', error: err });
            reject(err);
          } else {
            results.migratedToMetadata = this.changes;
            resolve();
          }
        });
      });

      // Delete old metadata
      await new Promise((resolve, reject) => {
        db.run(migrations.deleteOldMetadata, migrations.deleteOldMetadataParams, function(err) {
          if (err) {
            results.errors.push({ migration: 'deleteOldMetadata', error: err });
            reject(err);
          } else {
            results.deletedOld = this.changes;
            resolve();
          }
        });
      });

      console.log('✅ Tier migration completed:', results);
      return results;
    } catch (error) {
      console.error('❌ Error during tier migration:', error);
      return results;
    }
  }

  /**
   * Get storage statistics by tier
   */
  async getStorageStats(db) {
    return new Promise((resolve, reject) => {
      const query = `
        SELECT
          storage_tier,
          COUNT(*) as count,
          SUM(LENGTH(full_content)) as full_content_bytes,
          SUM(LENGTH(content_summary)) as summary_bytes,
          MIN(date_sent) as oldest_email,
          MAX(date_sent) as newest_email
        FROM sent_emails
        GROUP BY storage_tier
      `;

      db.all(query, (err, rows) => {
        if (err) {
          reject(err);
        } else {
          resolve(rows);
        }
      });
    });
  }
}

module.exports = EmailTieredStorage;
