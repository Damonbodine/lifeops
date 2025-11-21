const { google } = require('googleapis');
const fs = require('fs').promises;

/**
 * CalendarDataCollector - Handles all calendar data collection and analysis
 */
class CalendarDataCollector {
  constructor() {
    this.calendar = null;
    this.dataCache = new Map();
    this.cacheTimeout = 10 * 60 * 1000; // 10 minutes cache
    this.initializeCalendar();
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
        console.log('✅ CalendarDataCollector: Calendar ready');
      } catch (err) {
        console.log('⚠️ CalendarDataCollector: Calendar token not found');
      }
    } catch (error) {
      console.error('❌ CalendarDataCollector: Calendar initialization error:', error);
    }
  }

  /**
   * Collect calendar data with conflict analysis
   */
  async collectCalendarData(timeframe = 'today') {
    try {
      if (!this.calendar) {
        return { events: [], totalEvents: 0, error: 'Calendar not initialized' };
      }

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
   * Calculate event duration in minutes
   */
  calculateEventDuration(event) {
    if (!event.start || !event.end) return 0;

    const start = new Date(event.start.dateTime || event.start.date);
    const end = new Date(event.end.dateTime || event.end.date);

    return (end.getTime() - start.getTime()) / (1000 * 60); // minutes
  }

  /**
   * Categorize event by type
   */
  categorizeEvent(event) {
    const summary = (event.summary || '').toLowerCase();

    if (summary.includes('meeting') || summary.includes('call')) return 'meeting';
    if (summary.includes('lunch') || summary.includes('break')) return 'break';
    if (summary.includes('focus') || summary.includes('work')) return 'work';
    if (summary.includes('personal') || summary.includes('appointment')) return 'personal';

    return 'other';
  }

  /**
   * Estimate preparation time for event
   */
  estimatePreparationTime(event) {
    const type = this.categorizeEvent(event);
    const duration = this.calculateEventDuration(event);

    if (type === 'meeting' && duration > 30) return 15; // 15 min prep for long meetings
    if (type === 'meeting') return 5; // 5 min prep for short meetings

    return 0;
  }

  /**
   * Estimate buffer time between events
   */
  estimateBufferTime(event) {
    const duration = this.calculateEventDuration(event);
    return Math.min(15, duration * 0.1); // 10% buffer time, max 15 min
  }

  /**
   * Determine event priority level
   */
  determineEventPriority(event) {
    const summary = (event.summary || '').toLowerCase();

    if (summary.includes('urgent') || summary.includes('critical')) return 'high';
    if (summary.includes('important') || summary.includes('meeting')) return 'medium';

    return 'low';
  }

  /**
   * Calculate free time slots in schedule
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

  /**
   * Get next upcoming event
   */
  getNextEvent(events) {
    const now = new Date();
    return events.find(event => {
      const eventStart = new Date(event.start?.dateTime || event.start?.date);
      return eventStart > now;
    });
  }

  /**
   * Detect scheduling conflicts
   */
  detectConflicts(events) {
    const conflicts = [];
    // Simplified conflict detection
    return conflicts;
  }

  /**
   * Calculate total busy time
   */
  calculateBusyTime(events) {
    return events.reduce((total, event) => total + (event.duration || 0), 0);
  }

  /**
   * Calculate total free time
   */
  calculateFreeTime(freeSlots) {
    return freeSlots.reduce((total, slot) => total + (slot.duration || 0), 0);
  }

  /**
   * Calculate total preparation time needed
   */
  calculateTotalPreparationTime(events) {
    return events.reduce((total, event) => total + (event.preparationTime || 0), 0);
  }

  /**
   * Check if calendar is available
   */
  isAvailable() {
    return !!this.calendar;
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

module.exports = CalendarDataCollector;
