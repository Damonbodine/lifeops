const notifier = require('node-notifier');
const cron = require('node-cron');

/**
 * NotificationManager - Handles all desktop notifications and alerts
 * Manages Pomodoro notifications, schedule reminders, and productivity alerts
 */
class NotificationManager {
  constructor() {
    this.scheduledNotifications = new Map();
    this.activeTimers = new Map();
    this.notificationQueue = [];
    this.settings = {
      enabled: true,
      sound: true,
      urgentSound: true,
      quietHours: { start: '22:00', end: '08:00' },
      pomodoroSounds: true,
      scheduleReminders: true,
      healthReminders: true
    };

    // Notification types and their configurations
    this.notificationTypes = {
      pomodoro_start: {
        icon: '🎯',
        sound: 'Blow',
        timeout: 10,
        urgency: 'normal'
      },
      pomodoro_break: {
        icon: '☕',
        sound: 'Glass',
        timeout: 15,
        urgency: 'normal'
      },
      schedule_reminder: {
        icon: '⏰',
        sound: 'Basso',
        timeout: 10,
        urgency: 'normal'
      },
      health_reminder: {
        icon: '🏃',
        sound: 'Ping',
        timeout: 8,
        urgency: 'low'
      },
      urgent_alert: {
        icon: '🚨',
        sound: 'Sosumi',
        timeout: 20,
        urgency: 'critical'
      },
      task_complete: {
        icon: '✅',
        sound: 'Hero',
        timeout: 5,
        urgency: 'normal'
      },
      focus_reminder: {
        icon: '🧠',
        sound: 'Tink',
        timeout: 8,
        urgency: 'normal'
      }
    };

    console.log('🔔 NotificationManager initialized');
  }

  /**
   * Send immediate notification
   */
  async sendNotification(type, title, message, options = {}) {
    try {
      if (!this.settings.enabled) {
        console.log(`🔕 Notifications disabled: ${title}`);
        return;
      }

      // Check quiet hours
      if (this.isQuietHours() && options.respectQuietHours !== false) {
        console.log(`🌙 Quiet hours - notification queued: ${title}`);
        this.queueNotification(type, title, message, options);
        return;
      }

      const config = this.notificationTypes[type] || this.notificationTypes.schedule_reminder;
      
      const notificationOptions = {
        title: `${config.icon} ${title}`,
        message: message,
        sound: this.settings.sound ? config.sound : false,
        timeout: options.timeout || config.timeout,
        wait: false,
        ...options
      };

      // Add action buttons for interactive notifications
      if (options.actions) {
        notificationOptions.actions = options.actions;
        notificationOptions.wait = true; // Wait for user interaction
      }

      notifier.notify(notificationOptions, (err, response) => {
        if (err) {
          console.error('❌ Notification error:', err);
        } else {
          console.log(`🔔 Notification sent: ${title}`);
          if (options.callback) {
            options.callback(response);
          }
        }
      });

      // Track notification
      this.trackNotification(type, title, message);
      
    } catch (error) {
      console.error('❌ Send notification error:', error);
    }
  }

  /**
   * Schedule notification for specific time
   */
  scheduleNotification(scheduledTime, type, title, message, options = {}) {
    try {
      const scheduleDate = new Date(scheduledTime);
      const now = new Date();
      
      if (scheduleDate <= now) {
        // Send immediately if scheduled time has passed
        this.sendNotification(type, title, message, options);
        return;
      }

      const delay = scheduleDate.getTime() - now.getTime();
      const notificationId = `${type}_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
      
      const timer = setTimeout(() => {
        this.sendNotification(type, title, message, options);
        this.activeTimers.delete(notificationId);
      }, delay);

      this.activeTimers.set(notificationId, {
        timer: timer,
        type: type,
        title: title,
        message: message,
        scheduledTime: scheduleDate,
        options: options
      });

      console.log(`⏰ Notification scheduled: ${title} at ${scheduleDate.toLocaleString()}`);
      return notificationId;
    } catch (error) {
      console.error('❌ Schedule notification error:', error);
      return null;
    }
  }

  /**
   * Set up Pomodoro session notifications
   */
  setupPomodoroNotifications(pomodoroConfig, sessionStart, sessionEnd) {
    try {
      console.log('🍅 Setting up Pomodoro notifications...');
      
      const notifications = [];
      const { work, shortBreak, longBreak, cycles } = pomodoroConfig;
      
      let currentTime = new Date(sessionStart);
      let pomodoroCount = 0;
      
      while (currentTime < new Date(sessionEnd)) {
        // Work period start
        const workStart = new Date(currentTime);
        notifications.push(this.scheduleNotification(
          workStart,
          'pomodoro_start',
          `Pomodoro ${pomodoroCount + 1}`,
          `Time to focus! ${work} minutes of deep work ahead.`,
          {
            actions: ['Start', 'Skip', 'Postpone'],
            callback: (response) => this.handlePomodoroResponse(response, pomodoroCount + 1)
          }
        ));

        // Work period end / break start
        currentTime.setMinutes(currentTime.getMinutes() + work);
        const isLongBreak = (pomodoroCount + 1) % cycles === 0;
        const breakDuration = isLongBreak ? longBreak : shortBreak;
        const breakType = isLongBreak ? 'Long Break' : 'Short Break';
        
        notifications.push(this.scheduleNotification(
          currentTime,
          'pomodoro_break',
          `${breakType} Time!`,
          `Great work! Take a ${breakDuration}-minute ${breakType.toLowerCase()}.`,
          {
            actions: ['Start Break', 'Continue Working', 'End Session'],
            callback: (response) => this.handleBreakResponse(response, breakType)
          }
        ));

        // Move to next cycle
        currentTime.setMinutes(currentTime.getMinutes() + breakDuration);
        pomodoroCount++;
      }

      console.log(`✅ Scheduled ${notifications.length} Pomodoro notifications`);
      return notifications;
    } catch (error) {
      console.error('❌ Pomodoro notification setup error:', error);
      return [];
    }
  }

  /**
   * Set up schedule block reminders
   */
  setupScheduleReminders(scheduleBlocks) {
    try {
      console.log('📅 Setting up schedule reminders...');
      
      const reminders = [];
      
      scheduleBlocks.forEach((block, index) => {
        // Start reminder (5 minutes before)
        const startTime = new Date();
        const [hours, minutes] = block.startTime.split(':');
        startTime.setHours(parseInt(hours), parseInt(minutes) - 5, 0, 0);
        
        if (startTime > new Date()) {
          reminders.push(this.scheduleNotification(
            startTime,
            'schedule_reminder',
            `Upcoming: ${block.task}`,
            `Starting in 5 minutes. Time to prepare!`,
            {
              actions: ['Ready', 'Need 5 More Minutes', 'Skip'],
              callback: (response) => this.handleScheduleReminderResponse(response, block)
            }
          ));
        }

        // Block start notification
        const blockStartTime = new Date();
        blockStartTime.setHours(parseInt(hours), parseInt(minutes), 0, 0);
        
        if (blockStartTime > new Date()) {
          reminders.push(this.scheduleNotification(
            blockStartTime,
            block.type === 'pomodoro_work' ? 'pomodoro_start' : 'schedule_reminder',
            block.task,
            block.description || 'Time to begin this task!',
            {
              actions: ['Start', 'Postpone 15 min', 'Skip'],
              metadata: { blockId: block.id, blockType: block.type }
            }
          ));
        }

        // Health reminders for long work blocks
        if (block.type === 'deep_work' || block.type === 'pomodoro_work') {
          const blockDuration = this.calculateDuration(block.startTime, block.endTime);
          if (blockDuration > 60) { // More than 1 hour
            const healthReminderTime = new Date(blockStartTime);
            healthReminderTime.setMinutes(healthReminderTime.getMinutes() + 60);
            
            if (healthReminderTime < new Date(blockStartTime.getTime() + blockDuration * 60000)) {
              reminders.push(this.scheduleNotification(
                healthReminderTime,
                'health_reminder',
                'Health Check',
                'Time for a quick movement break! Stand, stretch, or take a short walk.',
                { respectQuietHours: true }
              ));
            }
          }
        }
      });

      console.log(`✅ Scheduled ${reminders.length} schedule reminders`);
      return reminders;
    } catch (error) {
      console.error('❌ Schedule reminder setup error:', error);
      return [];
    }
  }

  /**
   * Send daily summary notification
   */
  sendDailySummary(summary) {
    const summaryMessage = `
    ✅ Tasks Completed: ${summary.tasksCompleted || 0}
    🍅 Pomodoros: ${summary.pomodorosCompleted || 0}
    ⏱️ Focus Time: ${summary.focusTime || '0 hours'}
    🎯 Productivity Score: ${summary.productivityScore || 'N/A'}
    `;

    this.sendNotification(
      'task_complete',
      'Daily Summary',
      summaryMessage,
      {
        timeout: 15,
        actions: ['View Details', 'Plan Tomorrow', 'Dismiss'],
        callback: (response) => this.handleDailySummaryResponse(response, summary)
      }
    );
  }

  /**
   * Send focus reminder during work blocks
   */
  sendFocusReminder(currentTask, timeRemaining) {
    this.sendNotification(
      'focus_reminder',
      'Stay Focused',
      `Working on: ${currentTask}\nTime remaining: ${timeRemaining} minutes`,
      {
        timeout: 5,
        actions: ['Continue', 'Take Break', 'Switch Task']
      }
    );
  }

  /**
   * Handle notification responses
   */
  handlePomodoroResponse(response, pomodoroNumber) {
    console.log(`🍅 Pomodoro ${pomodoroNumber} response:`, response);
    
    switch (response) {
      case 'Start':
        this.sendNotification('task_complete', 'Pomodoro Started', `Focus time begins now! ${25} minutes of deep work.`);
        break;
      case 'Skip':
        this.sendNotification('schedule_reminder', 'Pomodoro Skipped', 'No problem! Moving to next scheduled activity.');
        break;
      case 'Postpone':
        // Reschedule for 15 minutes later
        this.sendNotification('schedule_reminder', 'Pomodoro Postponed', 'Pomodoro postponed for 15 minutes.');
        break;
    }
  }

  handleBreakResponse(response, breakType) {
    console.log(`☕ ${breakType} response:`, response);
    
    switch (response) {
      case 'Start Break':
        this.sendBreakSuggestions(breakType);
        break;
      case 'Continue Working':
        this.sendNotification('focus_reminder', 'Extended Focus', 'Continuing work. Remember to take a break soon!');
        break;
      case 'End Session':
        this.sendNotification('task_complete', 'Session Complete', 'Pomodoro session ended. Great work today!');
        break;
    }
  }

  handleScheduleReminderResponse(response, block) {
    console.log(`📅 Schedule reminder response for ${block.task}:`, response);
    
    switch (response) {
      case 'Ready':
        this.sendNotification('task_complete', 'Great!', 'Perfect timing! Starting your task now.');
        break;
      case 'Need 5 More Minutes':
        // Reschedule for 5 minutes later
        const newTime = new Date(Date.now() + 5 * 60 * 1000);
        this.scheduleNotification(newTime, 'schedule_reminder', block.task, 'Time to start!');
        break;
      case 'Skip':
        this.sendNotification('schedule_reminder', 'Task Skipped', 'No problem! Moving to next scheduled activity.');
        break;
    }
  }

  handleDailySummaryResponse(response, summary) {
    console.log('📊 Daily summary response:', response);
    // Could trigger different actions based on response
  }

  /**
   * Send break activity suggestions
   */
  sendBreakSuggestions(breakType) {
    const activities = breakType === 'Long Break' ? [
      '🚶 Take a 10-minute walk outside',
      '🧘 Do some deep breathing or meditation',
      '💧 Hydrate and have a healthy snack',
      '📞 Call a friend or family member',
      '🎵 Listen to a favorite song'
    ] : [
      '🤸 Stand and stretch your arms and legs',
      '👁️ Look away from screen and focus on distant object',
      '💧 Drink some water',
      '🌱 Take 5 deep breaths',
      '🚶 Walk around your workspace'
    ];

    const suggestion = activities[Math.floor(Math.random() * activities.length)];
    
    this.sendNotification(
      'health_reminder',
      `${breakType} Suggestion`,
      suggestion,
      { timeout: 10 }
    );
  }

  /**
   * Cancel scheduled notification
   */
  cancelNotification(notificationId) {
    const notification = this.activeTimers.get(notificationId);
    if (notification) {
      clearTimeout(notification.timer);
      this.activeTimers.delete(notificationId);
      console.log(`🚫 Cancelled notification: ${notification.title}`);
      return true;
    }
    return false;
  }

  /**
   * Cancel all scheduled notifications
   */
  cancelAllNotifications() {
    this.activeTimers.forEach((notification, id) => {
      clearTimeout(notification.timer);
    });
    this.activeTimers.clear();
    console.log('🚫 Cancelled all scheduled notifications');
  }

  /**
   * Update notification settings
   */
  updateSettings(newSettings) {
    this.settings = { ...this.settings, ...newSettings };
    console.log('⚙️ Notification settings updated:', newSettings);
  }

  /**
   * Utility methods
   */
  isQuietHours() {
    const now = new Date();
    const currentTime = `${now.getHours().toString().padStart(2, '0')}:${now.getMinutes().toString().padStart(2, '0')}`;
    
    const { start, end } = this.settings.quietHours;
    
    // Handle quiet hours that span midnight
    if (start > end) {
      return currentTime >= start || currentTime <= end;
    } else {
      return currentTime >= start && currentTime <= end;
    }
  }

  queueNotification(type, title, message, options) {
    this.notificationQueue.push({
      type, title, message, options,
      queuedAt: new Date()
    });
  }

  flushQueuedNotifications() {
    if (this.notificationQueue.length > 0) {
      console.log(`🔔 Sending ${this.notificationQueue.length} queued notifications`);
      
      this.notificationQueue.forEach(notification => {
        this.sendNotification(
          notification.type,
          notification.title,
          notification.message,
          notification.options
        );
      });
      
      this.notificationQueue = [];
    }
  }

  calculateDuration(startTime, endTime) {
    const [startHours, startMinutes] = startTime.split(':').map(Number);
    const [endHours, endMinutes] = endTime.split(':').map(Number);
    
    const startTotalMinutes = startHours * 60 + startMinutes;
    const endTotalMinutes = endHours * 60 + endMinutes;
    
    return endTotalMinutes - startTotalMinutes;
  }

  trackNotification(type, title, message) {
    // Track notification metrics for analytics
    console.log(`📊 Notification tracked: ${type} - ${title}`);
  }

  /**
   * Get notification manager status
   */
  getStatus() {
    return {
      enabled: this.settings.enabled,
      activeNotifications: this.activeTimers.size,
      queuedNotifications: this.notificationQueue.length,
      settings: this.settings,
      availableTypes: Object.keys(this.notificationTypes),
      isQuietHours: this.isQuietHours()
    };
  }

  /**
   * Get scheduled notifications
   */
  getScheduledNotifications() {
    const scheduled = [];
    this.activeTimers.forEach((notification, id) => {
      scheduled.push({
        id: id,
        type: notification.type,
        title: notification.title,
        scheduledTime: notification.scheduledTime,
        timeUntil: notification.scheduledTime.getTime() - Date.now()
      });
    });
    return scheduled.sort((a, b) => a.scheduledTime - b.scheduledTime);
  }
}

module.exports = NotificationManager;