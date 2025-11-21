const emailService = require('./emailService');

/**
 * EmailDataCollector - Handles all email data collection and analysis
 */
class EmailDataCollector {
  constructor() {
    this.dataCache = new Map();
    this.cacheTimeout = 10 * 60 * 1000; // 10 minutes cache
  }

  /**
   * Collect email data with priority analysis
   */
  async collectEmailData(timeframe = 'today') {
    try {
      const cacheKey = `emails_${timeframe}`;
      const cached = this.getCachedData(cacheKey);
      if (cached) return cached;

      console.log('📧 Collecting email data...');

      let emails = [];

      try {
        if (timeframe === 'today') {
          emails = await emailService.getRecentEmails(20);
        } else if (timeframe === 'unread') {
          emails = await emailService.getUnreadEmails(15);
        } else {
          emails = await emailService.getEmails({ maxResults: 25 });
        }
      } catch (emailError) {
        console.log('⚠️ Email service error, using fallback:', emailError.message);
        emails = [];
      }

      // Analyze email priorities and urgency
      const analyzedEmails = (emails || []).map(email => {
        const urgency = this.analyzeEmailUrgency(email);
        const category = this.categorizeEmail(email);

        return {
          ...email,
          urgency: urgency,
          category: category,
          timeToRespond: this.estimateResponseTime(email, urgency),
          actionRequired: this.requiresAction(email)
        };
      });

      // Sort by urgency and filter actionable emails
      const prioritizedEmails = analyzedEmails
        .filter(email => email.actionRequired)
        .sort((a, b) => {
          const urgencyOrder = { high: 3, medium: 2, low: 1 };
          return urgencyOrder[b.urgency] - urgencyOrder[a.urgency];
        });

      const emailData = {
        total: (emails || []).length,
        actionRequired: prioritizedEmails.length,
        byUrgency: {
          high: prioritizedEmails.filter(e => e.urgency === 'high').length,
          medium: prioritizedEmails.filter(e => e.urgency === 'medium').length,
          low: prioritizedEmails.filter(e => e.urgency === 'low').length
        },
        byCategory: this.groupByCategory(prioritizedEmails),
        topPriority: prioritizedEmails.slice(0, 5),
        estimatedResponseTime: this.calculateTotalResponseTime(prioritizedEmails)
      };

      this.setCachedData(cacheKey, emailData);
      return emailData;
    } catch (error) {
      console.error('❌ Email data collection error:', error);
      return { total: 0, actionRequired: 0, error: error.message };
    }
  }

  /**
   * Analyze email urgency level
   */
  analyzeEmailUrgency(email) {
    const urgentKeywords = ['urgent', 'asap', 'deadline', 'emergency', 'immediate'];
    const mediumKeywords = ['today', 'soon', 'follow up', 'reminder'];

    const subject = email.subject.toLowerCase();
    const body = (email.body || '').toLowerCase();
    const content = subject + ' ' + body;

    if (urgentKeywords.some(keyword => content.includes(keyword))) {
      return 'high';
    }
    if (mediumKeywords.some(keyword => content.includes(keyword))) {
      return 'medium';
    }
    return 'low';
  }

  /**
   * Categorize email by type
   */
  categorizeEmail(email) {
    const subject = email.subject.toLowerCase();

    if (subject.includes('meeting') || subject.includes('calendar')) return 'meeting';
    if (subject.includes('invoice') || subject.includes('payment')) return 'financial';
    if (subject.includes('project') || subject.includes('task')) return 'work';
    if (subject.includes('personal') || email.from.includes('friend')) return 'personal';

    return 'general';
  }

  /**
   * Determine if email requires action
   */
  requiresAction(email) {
    const actionKeywords = ['please', 'request', 'need', 'confirm', 'approve', 'review'];
    const content = (email.subject + ' ' + (email.body || '')).toLowerCase();

    return actionKeywords.some(keyword => content.includes(keyword)) || !email.isRead;
  }

  /**
   * Estimate response time based on urgency
   */
  estimateResponseTime(email, urgency) {
    const timeMap = {
      high: '15 minutes',
      medium: '30 minutes',
      low: '10 minutes'
    };
    return timeMap[urgency] || '15 minutes';
  }

  /**
   * Calculate total estimated response time for emails
   */
  calculateTotalResponseTime(emails) {
    // Convert time estimates to minutes and sum
    return emails.length * 20; // Rough estimate: 20 min per email
  }

  /**
   * Group emails by category
   */
  groupByCategory(emails) {
    const categories = {};
    emails.forEach(email => {
      const category = email.category;
      if (!categories[category]) categories[category] = [];
      categories[category].push(email);
    });
    return categories;
  }

  /**
   * Check if email service is authenticated
   */
  isAvailable() {
    return emailService.isAuth();
  }

  /**
   * Cache management
   */
  getCachedData(key) {
    const cached = this.dataCache.get(key);
    if (cached && (Date.now() - cached.timestamp) < this.cacheTimeout) {
      return cached.data;
    }
    return null;
  }

  setCachedData(key, data) {
    this.dataCache.set(key, {
      data: data,
      timestamp: Date.now()
    });
  }
}

module.exports = EmailDataCollector;
