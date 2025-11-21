/**
 * Calendar Integration - Google Calendar setup and operations
 * Extracted from ProductivityOrchestrator for better organization
 */

const { google } = require('googleapis');

/**
 * Initialize Google Calendar integration
 */
async function initializeCalendar() {
  try {
    const oauth2Client = new google.auth.OAuth2(
      process.env.GMAIL_CLIENT_ID,
      process.env.GMAIL_CLIENT_SECRET,
      'urn:ietf:wg:oauth:2.0:oob'
    );

    // Load stored tokens
    const fs = require('fs').promises;
    try {
      const token = await fs.readFile('/Users/damonbodine/Lifeops/lifeops/token.json');
      oauth2Client.setCredentials(JSON.parse(token));
      const calendar = google.calendar({ version: 'v3', auth: oauth2Client });
      console.log('✅ Calendar integration ready');
      return calendar;
    } catch (err) {
      console.log('⚠️ Calendar token not found');
      return null;
    }
  } catch (error) {
    console.error('❌ Calendar initialization error:', error);
    return null;
  }
}

/**
 * Get today's calendar events
 */
async function getTodaysCalendarEvents(calendar) {
  if (!calendar) return [];

  try {
    const today = new Date();
    const tomorrow = new Date(today);
    tomorrow.setDate(tomorrow.getDate() + 1);

    const response = await calendar.events.list({
      calendarId: 'primary',
      timeMin: today.toISOString(),
      timeMax: tomorrow.toISOString(),
      singleEvents: true,
      orderBy: 'startTime',
    });

    return response.data.items || [];
  } catch (error) {
    console.error('❌ Calendar fetch error:', error);
    return [];
  }
}

/**
 * Create calendar events for the schedule
 */
async function createCalendarEvents(calendar, schedule, targetDate = null, calculateTargetDateFn) {
  if (!calendar) {
    console.log('⚠️ Calendar not available - events not created');
    return;
  }

  try {
    // Determine the target date for the schedule
    let scheduleDate;
    if (targetDate) {
      scheduleDate = new Date(targetDate);
    } else if (calculateTargetDateFn) {
      scheduleDate = calculateTargetDateFn();
    } else {
      scheduleDate = new Date();
    }

    console.log(`📅 Creating calendar events for: ${scheduleDate.toDateString()}`);
    console.log(`📅 ISO date: ${scheduleDate.toISOString().split('T')[0]}`);
    console.log(`📅 Input targetDate: ${targetDate}`);

    const events = [];

    for (const block of schedule.scheduleBlocks) {
      if (block.type === 'pomodoro_work' || block.type === 'meeting' || block.type === 'admin') {
        const [startHour, startMin] = block.startTime.split(':');
        const [endHour, endMin] = block.endTime.split(':');

        const startTime = new Date(scheduleDate);
        startTime.setHours(parseInt(startHour), parseInt(startMin), 0, 0);

        const endTime = new Date(scheduleDate);
        endTime.setHours(parseInt(endHour), parseInt(endMin), 0, 0);

        const event = {
          summary: `🎯 ${block.task}`,
          description: `${block.description}\n\nScheduled by LifeOps AI Orchestrator`,
          start: { dateTime: startTime.toISOString() },
          end: { dateTime: endTime.toISOString() },
          colorId: block.type === 'pomodoro_work' ? '9' : '2' // Blue for work, green for other
        };

        events.push(event);
      }
    }

    // Create events in parallel
    const createPromises = events.map(event =>
      calendar.events.insert({
        calendarId: 'primary',
        resource: event
      })
    );

    await Promise.allSettled(createPromises);
    console.log(`✅ Created ${events.length} calendar events`);
  } catch (error) {
    console.error('❌ Calendar event creation error:', error);
  }
}

module.exports = {
  initializeCalendar,
  getTodaysCalendarEvents,
  createCalendarEvents
};
