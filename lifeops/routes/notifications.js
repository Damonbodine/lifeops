const express = require('express');
const router = express.Router();

// Import notification manager
const NotificationManager = require('../services/notificationManager');

// Initialize notification manager
const notificationManager = new NotificationManager();

// ==========================================
// IMMEDIATE NOTIFICATIONS
// ==========================================

// Send immediate notification
router.post('/send', async (req, res) => {
  try {
    const { type, title, message, options = {} } = req.body;
    
    if (!type || !title || !message) {
      return res.status(400).json({ 
        error: 'Type, title, and message are required' 
      });
    }
    
    await notificationManager.sendNotification(type, title, message, options);
    
    res.json({
      success: true,
      message: 'Notification sent successfully',
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    console.error('❌ Send notification error:', error);
    res.status(500).json({
      error: 'Failed to send notification',
      message: error.message
    });
  }
});

// Send daily summary notification
router.post('/daily-summary', async (req, res) => {
  try {
    const { summary } = req.body;
    
    if (!summary) {
      return res.status(400).json({ error: 'Summary data is required' });
    }
    
    notificationManager.sendDailySummary(summary);
    
    res.json({
      success: true,
      message: 'Daily summary notification sent',
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    console.error('❌ Daily summary notification error:', error);
    res.status(500).json({
      error: 'Failed to send daily summary notification',
      message: error.message
    });
  }
});

// Send focus reminder
router.post('/focus-reminder', async (req, res) => {
  try {
    const { currentTask, timeRemaining } = req.body;
    
    if (!currentTask || timeRemaining === undefined) {
      return res.status(400).json({ 
        error: 'Current task and time remaining are required' 
      });
    }
    
    notificationManager.sendFocusReminder(currentTask, timeRemaining);
    
    res.json({
      success: true,
      message: 'Focus reminder sent',
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    console.error('❌ Focus reminder error:', error);
    res.status(500).json({
      error: 'Failed to send focus reminder',
      message: error.message
    });
  }
});

// ==========================================
// SCHEDULED NOTIFICATIONS
// ==========================================

// Schedule notification for future delivery
router.post('/schedule', async (req, res) => {
  try {
    const { scheduledTime, type, title, message, options = {} } = req.body;
    
    if (!scheduledTime || !type || !title || !message) {
      return res.status(400).json({ 
        error: 'Scheduled time, type, title, and message are required' 
      });
    }
    
    const notificationId = notificationManager.scheduleNotification(
      scheduledTime, type, title, message, options
    );
    
    if (notificationId) {
      res.json({
        success: true,
        notificationId: notificationId,
        message: 'Notification scheduled successfully',
        scheduledFor: new Date(scheduledTime).toISOString(),
        timestamp: new Date().toISOString()
      });
    } else {
      res.status(400).json({
        error: 'Failed to schedule notification',
        message: 'Invalid scheduling parameters',
        timestamp: new Date().toISOString()
      });
    }
  } catch (error) {
    console.error('❌ Schedule notification error:', error);
    res.status(500).json({
      error: 'Failed to schedule notification',
      message: error.message
    });
  }
});

// Cancel scheduled notification
router.delete('/schedule/:notificationId', (req, res) => {
  try {
    const { notificationId } = req.params;
    
    const cancelled = notificationManager.cancelNotification(notificationId);
    
    if (cancelled) {
      res.json({
        success: true,
        message: 'Notification cancelled successfully',
        notificationId: notificationId,
        timestamp: new Date().toISOString()
      });
    } else {
      res.status(404).json({
        error: 'Notification not found',
        notificationId: notificationId,
        timestamp: new Date().toISOString()
      });
    }
  } catch (error) {
    console.error('❌ Cancel notification error:', error);
    res.status(500).json({
      error: 'Failed to cancel notification',
      message: error.message
    });
  }
});

// Cancel all scheduled notifications
router.delete('/schedule', (req, res) => {
  try {
    notificationManager.cancelAllNotifications();
    
    res.json({
      success: true,
      message: 'All scheduled notifications cancelled',
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    console.error('❌ Cancel all notifications error:', error);
    res.status(500).json({
      error: 'Failed to cancel all notifications',
      message: error.message
    });
  }
});

// ==========================================
// POMODORO NOTIFICATIONS
// ==========================================

// Setup Pomodoro session notifications
router.post('/pomodoro/setup', async (req, res) => {
  try {
    const { pomodoroConfig, sessionStart, sessionEnd } = req.body;
    
    if (!pomodoroConfig || !sessionStart || !sessionEnd) {
      return res.status(400).json({ 
        error: 'Pomodoro config, session start, and session end are required' 
      });
    }
    
    const notifications = notificationManager.setupPomodoroNotifications(
      pomodoroConfig, sessionStart, sessionEnd
    );
    
    res.json({
      success: true,
      scheduledNotifications: notifications.length,
      message: `Setup ${notifications.length} Pomodoro notifications`,
      sessionStart: sessionStart,
      sessionEnd: sessionEnd,
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    console.error('❌ Pomodoro notification setup error:', error);
    res.status(500).json({
      error: 'Failed to setup Pomodoro notifications',
      message: error.message
    });
  }
});

// ==========================================
// SCHEDULE NOTIFICATIONS
// ==========================================

// Setup schedule reminders
router.post('/schedule-reminders', async (req, res) => {
  try {
    const { scheduleBlocks } = req.body;
    
    if (!scheduleBlocks || !Array.isArray(scheduleBlocks)) {
      return res.status(400).json({ 
        error: 'Schedule blocks array is required' 
      });
    }
    
    const reminders = notificationManager.setupScheduleReminders(scheduleBlocks);
    
    res.json({
      success: true,
      scheduledReminders: reminders.length,
      message: `Setup ${reminders.length} schedule reminders`,
      scheduleBlocks: scheduleBlocks.length,
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    console.error('❌ Schedule reminders setup error:', error);
    res.status(500).json({
      error: 'Failed to setup schedule reminders',
      message: error.message
    });
  }
});

// ==========================================
// NOTIFICATION STATUS AND MANAGEMENT
// ==========================================

// Get notification system status
router.get('/status', (req, res) => {
  try {
    const status = notificationManager.getStatus();
    
    res.json({
      success: true,
      status: status,
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    console.error('❌ Notification status error:', error);
    res.status(500).json({
      error: 'Failed to get notification status',
      message: error.message
    });
  }
});

// Get scheduled notifications
router.get('/scheduled', (req, res) => {
  try {
    const scheduled = notificationManager.getScheduledNotifications();
    
    res.json({
      success: true,
      scheduledNotifications: scheduled,
      count: scheduled.length,
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    console.error('❌ Get scheduled notifications error:', error);
    res.status(500).json({
      error: 'Failed to get scheduled notifications',
      message: error.message
    });
  }
});

// ==========================================
// NOTIFICATION SETTINGS
// ==========================================

// Get current notification settings
router.get('/settings', (req, res) => {
  try {
    const status = notificationManager.getStatus();
    
    res.json({
      success: true,
      settings: status.settings,
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    console.error('❌ Get notification settings error:', error);
    res.status(500).json({
      error: 'Failed to get notification settings',
      message: error.message
    });
  }
});

// Update notification settings
router.post('/settings', (req, res) => {
  try {
    const { settings } = req.body;
    
    if (!settings) {
      return res.status(400).json({ error: 'Settings are required' });
    }
    
    notificationManager.updateSettings(settings);
    
    res.json({
      success: true,
      message: 'Notification settings updated successfully',
      updatedSettings: settings,
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    console.error('❌ Update notification settings error:', error);
    res.status(500).json({
      error: 'Failed to update notification settings',
      message: error.message
    });
  }
});

// Reset notification settings to defaults
router.post('/settings/reset', (req, res) => {
  try {
    const defaultSettings = {
      enabled: true,
      sound: true,
      urgentSound: true,
      quietHours: { start: '22:00', end: '08:00' },
      pomodoroSounds: true,
      scheduleReminders: true,
      healthReminders: true
    };
    
    notificationManager.updateSettings(defaultSettings);
    
    res.json({
      success: true,
      message: 'Notification settings reset to defaults',
      settings: defaultSettings,
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    console.error('❌ Reset notification settings error:', error);
    res.status(500).json({
      error: 'Failed to reset notification settings',
      message: error.message
    });
  }
});

// ==========================================
// NOTIFICATION TYPES AND TESTING
// ==========================================

// Get available notification types
router.get('/types', (req, res) => {
  try {
    const status = notificationManager.getStatus();
    
    res.json({
      success: true,
      availableTypes: status.availableTypes,
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    console.error('❌ Get notification types error:', error);
    res.status(500).json({
      error: 'Failed to get notification types',
      message: error.message
    });
  }
});

// Test notification system
router.post('/test', async (req, res) => {
  try {
    const { type = 'schedule_reminder' } = req.body;
    
    await notificationManager.sendNotification(
      type,
      'Test Notification',
      'This is a test notification from LifeOps productivity system.',
      { timeout: 5 }
    );
    
    res.json({
      success: true,
      message: 'Test notification sent successfully',
      type: type,
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    console.error('❌ Test notification error:', error);
    res.status(500).json({
      error: 'Failed to send test notification',
      message: error.message
    });
  }
});

// ==========================================
// QUIET HOURS MANAGEMENT
// ==========================================

// Enable/disable quiet hours temporarily
router.post('/quiet-hours/toggle', (req, res) => {
  try {
    const { enabled } = req.body;
    
    if (enabled === undefined) {
      return res.status(400).json({ error: 'Enabled status is required' });
    }
    
    const currentSettings = notificationManager.getStatus().settings;
    const newSettings = { ...currentSettings };
    
    if (enabled) {
      // Enable quiet hours for next 8 hours
      const now = new Date();
      const end = new Date(now.getTime() + 8 * 60 * 60 * 1000);
      newSettings.quietHours = {
        start: now.toTimeString().substr(0, 5),
        end: end.toTimeString().substr(0, 5)
      };
    } else {
      // Disable quiet hours
      newSettings.quietHours = { start: '24:00', end: '24:00' };
    }
    
    notificationManager.updateSettings(newSettings);
    
    res.json({
      success: true,
      message: enabled ? 'Quiet hours enabled for 8 hours' : 'Quiet hours disabled',
      quietHours: newSettings.quietHours,
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    console.error('❌ Toggle quiet hours error:', error);
    res.status(500).json({
      error: 'Failed to toggle quiet hours',
      message: error.message
    });
  }
});

// Flush queued notifications (send notifications that were queued during quiet hours)
router.post('/flush-queue', (req, res) => {
  try {
    notificationManager.flushQueuedNotifications();
    
    res.json({
      success: true,
      message: 'Queued notifications sent',
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    console.error('❌ Flush notifications error:', error);
    res.status(500).json({
      error: 'Failed to flush queued notifications',
      message: error.message
    });
  }
});

module.exports = router;