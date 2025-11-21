/**
 * Contact Cache Module
 *
 * Intelligent contact cache with TTL expiration and LRU eviction.
 * Prevents repeated contact lookups and improves performance.
 */

class ContactCache {
  constructor(ttlMinutes = 30) {
    this.cache = new Map();
    this.ttl = ttlMinutes * 60 * 1000; // Convert to milliseconds

    // Clean expired entries every 5 minutes
    setInterval(() => this.cleanup(), 5 * 60 * 1000);
  }

  has(key) {
    const entry = this.cache.get(key);
    if (!entry) return false;

    // Check if expired
    if (Date.now() > entry.expires) {
      this.cache.delete(key);
      return false;
    }

    return true;
  }

  get(key) {
    if (!this.has(key)) return undefined;
    const entry = this.cache.get(key);

    // Update access time for LRU behavior
    entry.lastAccessed = Date.now();
    return entry.value;
  }

  set(key, value) {
    const now = Date.now();
    this.cache.set(key, {
      value: value,
      expires: now + this.ttl,
      created: now,
      lastAccessed: now
    });

    // Limit cache size to prevent memory issues
    if (this.cache.size > 1000) {
      this.evictOldest();
    }
  }

  cleanup() {
    const now = Date.now();
    for (const [key, entry] of this.cache.entries()) {
      if (now > entry.expires) {
        this.cache.delete(key);
      }
    }
    console.log(`🧹 Contact cache cleanup: ${this.cache.size} entries remaining`);
  }

  evictOldest() {
    let oldest = null;
    let oldestTime = Date.now();

    for (const [key, entry] of this.cache.entries()) {
      if (entry.lastAccessed < oldestTime) {
        oldestTime = entry.lastAccessed;
        oldest = key;
      }
    }

    if (oldest) {
      this.cache.delete(oldest);
    }
  }

  getStats() {
    const now = Date.now();
    const stats = {
      totalEntries: this.cache.size,
      resolved: 0,
      unresolved: 0,
      fresh: 0,
      aging: 0
    };

    for (const [key, entry] of this.cache.entries()) {
      if (entry.value.isResolved) stats.resolved++;
      else stats.unresolved++;

      const age = now - entry.created;
      if (age < this.ttl / 2) stats.fresh++;
      else stats.aging++;
    }

    return stats;
  }

  clear() {
    this.cache.clear();
    console.log('🗑️ Contact cache cleared');
  }
}

module.exports = ContactCache;
