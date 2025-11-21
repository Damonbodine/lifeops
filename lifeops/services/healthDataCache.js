/**
 * Health Data Cache Module
 *
 * Manages health data caching to prevent loading 695K+ records on every request.
 * Implements cache expiration and prevents concurrent loading to avoid memory crashes.
 */

class HealthDataCache {
  constructor(healthAnalytics, healthExportPath, cacheDuration = 10 * 60 * 1000) {
    this.healthAnalytics = healthAnalytics;
    this.healthExportPath = healthExportPath;
    this.cacheDuration = cacheDuration;
    this.cache = null;
    this.lastLoad = null;
    this.isLoading = false;
  }

  /**
   * Get health data from cache or load fresh data if cache expired
   */
  async getHealthData() {
    const now = Date.now();

    // Return cached data if it's still fresh
    if (this.cache && this.lastLoad && (now - this.lastLoad) < this.cacheDuration) {
      console.log('✅ Using cached health data');
      this.healthAnalytics.healthData = this.cache;
      return this.cache;
    }

    // Prevent concurrent loading that causes memory crashes
    if (this.isLoading) {
      console.log('⏳ Health data already loading, waiting...');
      // Wait for current load to complete
      while (this.isLoading) {
        await new Promise(resolve => setTimeout(resolve, 1000));
      }
      if (this.cache) {
        this.healthAnalytics.healthData = this.cache;
        return this.cache;
      }
    }

    // Load fresh data only when cache expires
    this.isLoading = true;
    try {
      console.log('🔄 Loading fresh health data (this may take a moment)...');
      await this.healthAnalytics.loadHealthData(this.healthExportPath);
      this.cache = this.healthAnalytics.healthData;
      this.lastLoad = now;
      console.log('✅ Health data cached successfully');

      return this.cache;
    } finally {
      this.isLoading = false;
    }
  }

  /**
   * Clear the cache to force reload on next request
   */
  clearCache() {
    this.cache = null;
    this.lastLoad = null;
    console.log('🗑️ Health data cache cleared');
  }

  /**
   * Check if cache is valid
   */
  isCacheValid() {
    const now = Date.now();
    return this.cache && this.lastLoad && (now - this.lastLoad) < this.cacheDuration;
  }
}

module.exports = HealthDataCache;
