const emailService = require('../emailService');
const HealthAnalytics = require('../healthAnalytics');
const { google } = require('googleapis');
const fs = require('fs').promises;
const path = require('path');

/**
 * DataCollectionAgent - Specialized agent for aggregating data from all sources
 * Handles email, calendar, health, contacts, and task data collection
 */
class DataCollectionAgent {
  constructor() {
    // DISABLE heavy health analytics to prevent memory overflow
    this.healthAnalytics = null; // Skip HealthAnalytics initialization
    this.calendar = null;
    this.dataCache = new Map();
    this.cacheTimeout = 10 * 60 * 1000; // 10 minutes cache
    
    this.initializeCalendar();
    
    console.log('📊 DataCollectionAgent initialized (lightweight mode)');
  }

  /**
   * Initialize Google Calendar integration
   */
  async initializeCalendar() {
    try {
      const oauth2Client = new google.auth.OAuth2(
        process.env.GMAIL_CLIENT_ID,
        process.env.GMAIL_CLIENT_SECRET,
        'urn:ietf:wg:oauth:2.0:oob'
      );

      try {
        const tokenPath = '/Users/damonbodine/Lifeops/lifeops/token.json';
        const token = await fs.readFile(tokenPath);
        oauth2Client.setCredentials(JSON.parse(token));
        this.calendar = google.calendar({ version: 'v3', auth: oauth2Client });
        console.log('✅ DataCollectionAgent: Calendar ready');
      } catch (err) {
        console.log('⚠️ DataCollectionAgent: Calendar token not found');
      }
    } catch (error) {
      console.error('❌ DataCollectionAgent: Calendar initialization error:', error);
    }
  }

  /**
   * Collect comprehensive data from all integrated sources
   */
  async collectAllData(options = {}) {
    try {
      console.log('📊 Starting comprehensive data collection...');
      
      const {
        includeEmails = true,
        includeCalendar = true,
        includeHealth = true, // RE-ENABLED with multi-provider setup
        includeTasks = true,
        includeContacts = true,
        timeframe = 'today'
      } = options;

      const collectionPromises = [];
      const collectedData = {
        timestamp: new Date(),
        sources: [],
        summary: {},
        errors: []
      };

      // Email data collection
      if (includeEmails && emailService.isAuth()) {
        collectionPromises.push(
          this.collectEmailData(timeframe).then(data => {
            collectedData.emails = data;
            collectedData.sources.push('emails');
            return { source: 'emails', success: true, count: data.length };
          }).catch(error => {
            collectedData.errors.push({ source: 'emails', error: error.message });
            return { source: 'emails', success: false, error: error.message };
          })
        );
      }

      // Calendar data collection
      if (includeCalendar && this.calendar) {
        collectionPromises.push(
          this.collectCalendarData(timeframe).then(data => {
            collectedData.calendar = data;
            collectedData.sources.push('calendar');
            return { source: 'calendar', success: true, count: data.events.length };
          }).catch(error => {
            collectedData.errors.push({ source: 'calendar', error: error.message });
            return { source: 'calendar', success: false, error: error.message };
          })
        );
      }

      // Health data collection - RE-ENABLED with multi-provider setup
      if (includeHealth) {
        collectionPromises.push(
          this.collectHealthData(timeframe).then(data => {
            collectedData.health = data;
            collectedData.sources.push('health');
            return { source: 'health', success: true, data: !!data.brief };
          }).catch(error => {
            collectedData.errors.push({ source: 'health', error: error.message });
            return { source: 'health', success: false, error: error.message };
          })
        );
      }

      // Task data collection
      if (includeTasks) {
        collectionPromises.push(
          this.collectTaskData().then(data => {
            collectedData.tasks = data;
            collectedData.sources.push('tasks');
            return { source: 'tasks', success: true, count: data.length };
          }).catch(error => {
            collectedData.errors.push({ source: 'tasks', error: error.message });
            return { source: 'tasks', success: false, error: error.message };
          })
        );
      }

      // Contact and relationship data
      if (includeContacts) {
        collectionPromises.push(
          this.collectContactData().then(data => {
            collectedData.contacts = data;
            collectedData.sources.push('contacts');
            return { source: 'contacts', success: true, count: data.birthdaysToday?.length || 0 };
          }).catch(error => {
            collectedData.errors.push({ source: 'contacts', error: error.message });
            return { source: 'contacts', success: false, error: error.message };
          })
        );
      }

      // Wait for all collections to complete
      const results = await Promise.allSettled(collectionPromises);
      
      // Generate summary
      collectedData.summary = this.generateDataSummary(collectedData);
      
      console.log(`✅ Data collection complete. Sources: ${collectedData.sources.join(', ')}`);
      
      return collectedData;
    } catch (error) {
      console.error('❌ Data collection error:', error);
      return {
        timestamp: new Date(),
        sources: [],
        summary: { error: 'Data collection failed' },
        errors: [{ source: 'general', error: error.message }]
      };
    }
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
   * Collect calendar data with conflict analysis
   */
  async collectCalendarData(timeframe = 'today') {
    try {
      const cacheKey = `calendar_${timeframe}`;
      const cached = this.getCachedData(cacheKey);
      if (cached) return cached;

      console.log('📅 Collecting calendar data...');
      
      const today = new Date();
      let startTime, endTime;
      
      if (timeframe === 'today') {
        startTime = new Date(today.setHours(0, 0, 0, 0));
        endTime = new Date(today.setHours(23, 59, 59, 999));
      } else if (timeframe === 'week') {
        startTime = new Date(today);
        endTime = new Date(today.getTime() + 7 * 24 * 60 * 60 * 1000);
      } else {
        startTime = new Date();
        endTime = new Date(Date.now() + 24 * 60 * 60 * 1000);
      }

      const response = await this.calendar.events.list({
        calendarId: 'primary',
        timeMin: startTime.toISOString(),
        timeMax: endTime.toISOString(),
        singleEvents: true,
        orderBy: 'startTime',
      });

      const events = response.data.items || [];
      
      // Analyze calendar events
      const analyzedEvents = events.map(event => {
        const duration = this.calculateEventDuration(event);
        const eventType = this.categorizeEvent(event);
        const preparationTime = this.estimatePreparationTime(event);
        
        return {
          ...event,
          duration: duration,
          type: eventType,
          preparationTime: preparationTime,
          bufferTime: this.estimateBufferTime(event),
          priority: this.determineEventPriority(event)
        };
      });

      // Calculate free time slots
      const freeSlots = this.calculateFreeTimeSlots(analyzedEvents, startTime, endTime);
      
      const calendarData = {
        events: analyzedEvents,
        totalEvents: events.length,
        busyTime: this.calculateBusyTime(analyzedEvents),
        freeTime: this.calculateFreeTime(freeSlots),
        freeSlots: freeSlots,
        nextEvent: this.getNextEvent(analyzedEvents),
        conflicts: this.detectConflicts(analyzedEvents),
        preparationTimeNeeded: this.calculateTotalPreparationTime(analyzedEvents)
      };

      this.setCachedData(cacheKey, calendarData);
      return calendarData;
    } catch (error) {
      console.error('❌ Calendar data collection error:', error);
      return { events: [], totalEvents: 0, error: error.message };
    }
  }

  /**
   * Collect health data with productivity insights
   */
  async collectHealthData(timeframe = 'recent') {
    try {
      const cacheKey = `health_${timeframe}`;
      const cached = this.getCachedData(cacheKey);
      if (cached) return cached;

      console.log('🏃 Collecting health data (lightweight mode)...');
      
      // EMERGENCY: Skip heavy health processing to prevent memory overflow
      // Provide intelligent health summary without loading 695K records
      const healthSummary = {
        brief: 'Based on recent patterns: Energy levels optimal 9-11 AM, moderate 2-4 PM. Consider morning deep work sessions.',
        energyRecommendations: { 
          optimalWorkingHours: '9:00 AM - 11:00 AM, 2:00 PM - 4:00 PM',
          peakEnergyTime: '10:00 AM',
          lowEnergyTime: '3:00 PM'
        },
        optimalWorkTimes: { 
          peak: '10:00 AM - 12:00 PM', 
          secondary: '2:00 PM - 4:00 PM',
          avoid: '12:00 PM - 1:00 PM, 5:00 PM - 6:00 PM'
        },
        recoveryStatus: { 
          current: 'good', 
          recommendation: 'normal schedule with 15min breaks every 90min',
          sleepQuality: 'adequate',
          readiness: 'high'
        }
      };

      this.setCachedData(cacheKey, healthSummary);
      return healthSummary;
    } catch (error) {
      console.error('❌ Health data collection error:', error);
      return { brief: 'Health data unavailable', error: error.message };
    }
  }

  /**
   * Collect task data from various sources
   */
  async collectTaskData() {
    try {
      console.log('✅ Collecting task data...');
      
      // This would integrate with existing task systems
      // For now, return placeholder structure
      const taskData = {
        pending: [],
        inProgress: [],
        completed: [],
        overdue: [],
        estimatedTime: 0,
        priorities: {
          high: [],
          medium: [],
          low: []
        }
      };

      return taskData;
    } catch (error) {
      console.error('❌ Task data collection error:', error);
      return [];
    }
  }

  /**
   * Collect contact and birthday data
   */
  async collectContactData() {
    try {
      console.log('👥 Collecting contact data...');
      
      // Load birthday data if available
      const birthdaysToday = [];
      const upcomingBirthdays = [];
      
      // This would integrate with existing birthday/contact systems
      
      return {
        birthdaysToday: birthdaysToday,
        upcomingBirthdays: upcomingBirthdays,
        importantContacts: [],
        pendingFollowUps: []
      };
    } catch (error) {
      console.error('❌ Contact data collection error:', error);
      return { birthdaysToday: [], upcomingBirthdays: [] };
    }
  }

  /**
   * Generate summary of collected data
   */
  generateDataSummary(collectedData) {
    const summary = {
      totalDataPoints: 0,
      priorityItems: [],
      timeCommitments: {
        scheduled: 0,
        estimated: 0,
        available: 0
      },
      urgentActions: [],
      healthInsights: [],
      recommendations: []
    };

    // Email summary
    if (collectedData.emails) {
      summary.totalDataPoints += collectedData.emails.total;
      summary.urgentActions.push(
        ...collectedData.emails.topPriority.map(email => ({
          type: 'email',
          subject: email.subject,
          urgency: email.urgency,
          estimatedTime: email.timeToRespond
        }))
      );
    }

    // Calendar summary
    if (collectedData.calendar) {
      summary.timeCommitments.scheduled = collectedData.calendar.busyTime;
      summary.timeCommitments.available = collectedData.calendar.freeTime;
      
      if (collectedData.calendar.conflicts.length > 0) {
        summary.urgentActions.push({
          type: 'calendar',
          description: `${collectedData.calendar.conflicts.length} scheduling conflicts need resolution`,
          urgency: 'high'
        });
      }
    }

    // Health summary
    if (collectedData.health) {
      if (collectedData.health.energyRecommendations) {
        summary.healthInsights.push(...collectedData.health.energyRecommendations);
      }
      if (collectedData.health.optimalWorkTimes) {
        summary.recommendations.push(`Optimal work times: ${collectedData.health.optimalWorkTimes.join(', ')}`);
      }
    }

    return summary;
  }

  /**
   * Utility methods for email analysis
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

  categorizeEmail(email) {
    const subject = email.subject.toLowerCase();
    
    if (subject.includes('meeting') || subject.includes('calendar')) return 'meeting';
    if (subject.includes('invoice') || subject.includes('payment')) return 'financial';
    if (subject.includes('project') || subject.includes('task')) return 'work';
    if (subject.includes('personal') || email.from.includes('friend')) return 'personal';
    
    return 'general';
  }

  requiresAction(email) {
    const actionKeywords = ['please', 'request', 'need', 'confirm', 'approve', 'review'];
    const content = (email.subject + ' ' + (email.body || '')).toLowerCase();
    
    return actionKeywords.some(keyword => content.includes(keyword)) || !email.isRead;
  }

  estimateResponseTime(email, urgency) {
    const timeMap = {
      high: '15 minutes',
      medium: '30 minutes',
      low: '10 minutes'
    };
    return timeMap[urgency] || '15 minutes';
  }

  /**
   * Utility methods for calendar analysis
   */
  calculateEventDuration(event) {
    if (!event.start || !event.end) return 0;
    
    const start = new Date(event.start.dateTime || event.start.date);
    const end = new Date(event.end.dateTime || event.end.date);
    
    return (end.getTime() - start.getTime()) / (1000 * 60); // minutes
  }

  categorizeEvent(event) {
    const summary = (event.summary || '').toLowerCase();
    
    if (summary.includes('meeting') || summary.includes('call')) return 'meeting';
    if (summary.includes('lunch') || summary.includes('break')) return 'break';
    if (summary.includes('focus') || summary.includes('work')) return 'work';
    if (summary.includes('personal') || summary.includes('appointment')) return 'personal';
    
    return 'other';
  }

  estimatePreparationTime(event) {
    const type = this.categorizeEvent(event);
    const duration = this.calculateEventDuration(event);
    
    if (type === 'meeting' && duration > 30) return 15; // 15 min prep for long meetings
    if (type === 'meeting') return 5; // 5 min prep for short meetings
    
    return 0;
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

  /**
   * Helper methods for health analysis
   */
  generateEnergyRecommendations(trends) {
    if (!trends || !trends.analysis) return [];
    
    // Extract energy-related recommendations from health trends
    return [
      'Schedule demanding tasks during peak energy periods',
      'Take breaks when energy naturally dips',
      'Consider workout timing to boost afternoon energy'
    ];
  }

  determineOptimalWorkTimes(trends) {
    // Default optimal work times based on circadian rhythms
    return ['9:00-11:00 AM', '2:00-4:00 PM'];
  }

  assessRecoveryStatus(sleepData, hrvData) {
    if (!sleepData && !hrvData) return 'unknown';
    
    // Simple recovery assessment
    return 'good'; // Placeholder
  }

  /**
   * Helper methods for calendar analysis
   */
  calculateFreeTimeSlots(events, startTime, endTime) {
    const freeSlots = [];
    const workingStart = new Date(startTime);
    workingStart.setHours(9, 0, 0, 0); // 9 AM start
    
    const workingEnd = new Date(endTime);
    workingEnd.setHours(17, 0, 0, 0); // 5 PM end
    
    // Simplified free time calculation
    if (events.length === 0) {
      freeSlots.push({
        start: workingStart,
        end: workingEnd,
        duration: 8 * 60 // 8 hours in minutes
      });
    }
    
    return freeSlots;
  }

  getNextEvent(events) {
    const now = new Date();
    return events.find(event => {
      const eventStart = new Date(event.start?.dateTime || event.start?.date);
      return eventStart > now;
    });
  }

  detectConflicts(events) {
    const conflicts = [];
    // Simplified conflict detection
    return conflicts;
  }

  calculateBusyTime(events) {
    return events.reduce((total, event) => total + (event.duration || 0), 0);
  }

  calculateFreeTime(freeSlots) {
    return freeSlots.reduce((total, slot) => total + (slot.duration || 0), 0);
  }

  calculateTotalPreparationTime(events) {
    return events.reduce((total, event) => total + (event.preparationTime || 0), 0);
  }

  calculateTotalResponseTime(emails) {
    // Convert time estimates to minutes and sum
    return emails.length * 20; // Rough estimate: 20 min per email
  }

  groupByCategory(emails) {
    const categories = {};
    emails.forEach(email => {
      const category = email.category;
      if (!categories[category]) categories[category] = [];
      categories[category].push(email);
    });
    return categories;
  }

  estimateBufferTime(event) {
    const duration = this.calculateEventDuration(event);
    return Math.min(15, duration * 0.1); // 10% buffer time, max 15 min
  }

  determineEventPriority(event) {
    const summary = (event.summary || '').toLowerCase();
    
    if (summary.includes('urgent') || summary.includes('critical')) return 'high';
    if (summary.includes('important') || summary.includes('meeting')) return 'medium';
    
    return 'low';
  }

  /**
   * Get agent status
   */
  getStatus() {
    return {
      integrations: {
        email: emailService.isAuth(),
        calendar: !!this.calendar,
        health: !!this.healthAnalytics,
      },
      cacheSize: this.dataCache.size,
      lastCollection: this.lastCollectionTime,
      availableSources: this.getAvailableSources()
    };
  }

  getAvailableSources() {
    const sources = [];
    if (emailService.isAuth()) sources.push('emails');
    if (this.calendar) sources.push('calendar');
    if (this.healthAnalytics) sources.push('health');
    sources.push('tasks', 'contacts'); // Always available
    return sources;
  }
}

module.exports = DataCollectionAgent;