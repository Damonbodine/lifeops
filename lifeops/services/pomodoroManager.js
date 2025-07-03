const NotificationManager = require('./notificationManager');
const cron = require('node-cron');

/**
 * PomodoroManager - Handles automated Pomodoro timer execution and management
 * Integrates with schedule and notifications for seamless productivity flow
 */
class PomodoroManager {
  constructor() {
    this.notificationManager = new NotificationManager();
    this.activeSessions = new Map();
    this.sessionHistory = [];
    this.currentSession = null;
    
    // Pomodoro configurations
    this.pomodoroConfigs = {
      classic: { 
        name: 'Classic Pomodoro',
        work: 25, 
        shortBreak: 5, 
        longBreak: 15, 
        cycles: 4,
        description: 'Traditional 25/5 minute cycles'
      },
      extended: { 
        name: 'Extended Deep Work',
        work: 90, 
        shortBreak: 15, 
        longBreak: 30, 
        cycles: 3,
        description: '90-minute deep work sessions'
      },
      flexible: { 
        name: 'Flexible Focus',
        work: 45, 
        shortBreak: 10, 
        longBreak: 20, 
        cycles: 4,
        description: '45-minute balanced sessions'
      },
      sprint: { 
        name: 'Quick Sprint',
        work: 15, 
        shortBreak: 3, 
        longBreak: 10, 
        cycles: 6,
        description: 'Short, intense focus bursts'
      },
      custom: {
        name: 'Custom',
        work: 25,
        shortBreak: 5,
        longBreak: 15,
        cycles: 4,
        description: 'User-customizable timing'
      }
    };

    // Session states
    this.sessionStates = {
      IDLE: 'idle',
      WORK: 'work',
      SHORT_BREAK: 'short_break',
      LONG_BREAK: 'long_break',
      PAUSED: 'paused',
      COMPLETED: 'completed'
    };

    console.log('🍅 PomodoroManager initialized');
  }

  /**
   * Start a new Pomodoro session
   */
  async startSession(config = 'classic', task = 'Focus work', options = {}) {
    try {
      if (this.currentSession && this.currentSession.state !== this.sessionStates.IDLE) {
        throw new Error('A Pomodoro session is already active');
      }

      const pomodoroConfig = typeof config === 'string' ? 
        this.pomodoroConfigs[config] : config;

      if (!pomodoroConfig) {
        throw new Error(`Invalid Pomodoro configuration: ${config}`);
      }

      const sessionId = this.generateSessionId();
      const session = {
        id: sessionId,
        task: task,
        config: pomodoroConfig,
        startTime: new Date(),
        currentCycle: 1,
        totalCycles: pomodoroConfig.cycles,
        state: this.sessionStates.WORK,
        workPeriods: 0,
        breaks: 0,
        interruptions: 0,
        completedCycles: 0,
        timeTracking: {
          totalWorkTime: 0,
          totalBreakTime: 0,
          actualWorkTime: 0,
          pausedTime: 0
        },
        options: {
          autoStart: true,
          soundEnabled: true,
          notificationsEnabled: true,
          ...options
        }
      };

      this.currentSession = session;
      this.activeSessions.set(sessionId, session);

      // Start the first work period
      await this.startWorkPeriod(session);

      console.log(`🍅 Started ${pomodoroConfig.name} session: ${task}`);
      
      return {
        success: true,
        sessionId: sessionId,
        session: session,
        message: `Started ${pomodoroConfig.name} session for "${task}"`
      };
    } catch (error) {
      console.error('❌ Start session error:', error);
      return {
        success: false,
        error: error.message
      };
    }
  }

  /**
   * Start work period with timer and notifications
   */
  async startWorkPeriod(session) {
    try {
      session.state = this.sessionStates.WORK;
      session.currentPeriodStart = new Date();
      session.workPeriods++;

      // Send start notification
      await this.notificationManager.sendNotification(
        'pomodoro_start',
        `Pomodoro ${session.currentCycle}/${session.totalCycles}`,
        `Focus time! Working on: ${session.task}\nDuration: ${session.config.work} minutes`,
        {
          actions: ['Focus Mode', 'Pause', 'Skip'],
          callback: (response) => this.handleWorkPeriodResponse(session.id, response),
          metadata: { sessionId: session.id, period: 'work' }
        }
      );

      // Schedule end-of-work notification
      const workEndTime = new Date(Date.now() + session.config.work * 60 * 1000);
      session.workEndTimer = setTimeout(() => {
        this.endWorkPeriod(session.id);
      }, session.config.work * 60 * 1000);

      // Schedule periodic focus reminders (optional)
      if (session.config.work >= 45) {
        const reminderTime = session.config.work / 2; // Halfway through
        session.focusReminderTimer = setTimeout(() => {
          this.sendFocusReminder(session);
        }, reminderTime * 60 * 1000);
      }

      // Update session tracking
      this.updateSessionTracking(session, 'work_started');

    } catch (error) {
      console.error('❌ Start work period error:', error);
    }
  }

  /**
   * End work period and start break
   */
  async endWorkPeriod(sessionId) {
    try {
      const session = this.activeSessions.get(sessionId);
      if (!session || session.state !== this.sessionStates.WORK) {
        return;
      }

      // Calculate actual work time
      const workDuration = Date.now() - session.currentPeriodStart.getTime();
      session.timeTracking.actualWorkTime += workDuration;
      session.timeTracking.totalWorkTime += session.config.work * 60 * 1000;

      // Clear timers
      if (session.workEndTimer) clearTimeout(session.workEndTimer);
      if (session.focusReminderTimer) clearTimeout(session.focusReminderTimer);

      // Determine break type
      const isLongBreak = session.currentCycle % session.config.cycles === 0;
      const breakDuration = isLongBreak ? session.config.longBreak : session.config.shortBreak;
      const breakType = isLongBreak ? 'long_break' : 'short_break';

      // Send work completion notification
      await this.notificationManager.sendNotification(
        'task_complete',
        'Work Period Complete!',
        `Great focus! You completed ${session.config.work} minutes of work.\nTime for a ${breakDuration}-minute ${isLongBreak ? 'long' : 'short'} break.`,
        {
          actions: ['Start Break', 'Continue Working', 'End Session'],
          callback: (response) => this.handleWorkCompleteResponse(sessionId, response, breakType),
          timeout: 15
        }
      );

      // Auto-start break if configured
      if (session.options.autoStart) {
        setTimeout(() => {
          this.startBreakPeriod(sessionId, breakType);
        }, 5000); // 5-second buffer
      }

      this.updateSessionTracking(session, 'work_completed');

    } catch (error) {
      console.error('❌ End work period error:', error);
    }
  }

  /**
   * Start break period
   */
  async startBreakPeriod(sessionId, breakType = 'short_break') {
    try {
      const session = this.activeSessions.get(sessionId);
      if (!session) return;

      const isLongBreak = breakType === 'long_break';
      const breakDuration = isLongBreak ? session.config.longBreak : session.config.shortBreak;

      session.state = isLongBreak ? this.sessionStates.LONG_BREAK : this.sessionStates.SHORT_BREAK;
      session.currentPeriodStart = new Date();
      session.breaks++;

      // Send break start notification with suggestions
      const breakSuggestions = this.getBreakSuggestions(isLongBreak);
      await this.notificationManager.sendNotification(
        'pomodoro_break',
        `${isLongBreak ? 'Long' : 'Short'} Break Time!`,
        `Take a ${breakDuration}-minute break.\n\nSuggestion: ${breakSuggestions.random}`,
        {
          actions: ['Take Break', 'Back to Work', 'End Session'],
          callback: (response) => this.handleBreakResponse(sessionId, response),
          timeout: 10
        }
      );

      // Schedule end of break
      session.breakEndTimer = setTimeout(() => {
        this.endBreakPeriod(sessionId);
      }, breakDuration * 60 * 1000);

      // Send break suggestion reminders for long breaks
      if (isLongBreak && breakDuration >= 15) {
        session.breakReminderTimer = setTimeout(() => {
          this.sendBreakActivityReminder(session, breakSuggestions);
        }, (breakDuration / 2) * 60 * 1000);
      }

      this.updateSessionTracking(session, 'break_started', { breakType, breakDuration });

    } catch (error) {
      console.error('❌ Start break period error:', error);
    }
  }

  /**
   * End break period and continue or complete session
   */
  async endBreakPeriod(sessionId) {
    try {
      const session = this.activeSessions.get(sessionId);
      if (!session || !session.state.includes('break')) {
        return;
      }

      // Calculate break time
      const breakDuration = Date.now() - session.currentPeriodStart.getTime();
      session.timeTracking.totalBreakTime += breakDuration;

      // Clear timers
      if (session.breakEndTimer) clearTimeout(session.breakEndTimer);
      if (session.breakReminderTimer) clearTimeout(session.breakReminderTimer);

      // Check if session is complete
      if (session.currentCycle >= session.totalCycles) {
        await this.completeSession(sessionId);
        return;
      }

      // Continue to next cycle
      session.currentCycle++;
      session.completedCycles++;

      // Send break end notification
      await this.notificationManager.sendNotification(
        'pomodoro_start',
        'Break Complete!',
        `Ready for cycle ${session.currentCycle}/${session.totalCycles}?\nTask: ${session.task}`,
        {
          actions: ['Start Next Cycle', 'Extend Break', 'End Session'],
          callback: (response) => this.handleBreakEndResponse(sessionId, response),
          timeout: 10
        }
      );

      // Auto-start next work period if configured
      if (session.options.autoStart) {
        setTimeout(() => {
          this.startWorkPeriod(session);
        }, 3000); // 3-second buffer
      }

      this.updateSessionTracking(session, 'break_completed');

    } catch (error) {
      console.error('❌ End break period error:', error);
    }
  }

  /**
   * Complete entire Pomodoro session
   */
  async completeSession(sessionId) {
    try {
      const session = this.activeSessions.get(sessionId);
      if (!session) return;

      session.state = this.sessionStates.COMPLETED;
      session.endTime = new Date();
      session.totalDuration = session.endTime.getTime() - session.startTime.getTime();

      // Calculate session statistics
      const stats = this.calculateSessionStats(session);

      // Send completion notification
      await this.notificationManager.sendNotification(
        'task_complete',
        'Pomodoro Session Complete! 🎉',
        `Excellent work! You completed ${session.completedCycles + 1} cycles.\n\nTotal Focus Time: ${Math.round(stats.actualWorkTime / 60)} minutes\nTask: ${session.task}`,
        {
          actions: ['View Stats', 'Start New Session', 'Take Long Break'],
          callback: (response) => this.handleSessionCompleteResponse(sessionId, response, stats),
          timeout: 20
        }
      );

      // Archive completed session
      this.archiveSession(session, stats);

      // Clear current session
      if (this.currentSession && this.currentSession.id === sessionId) {
        this.currentSession = null;
      }

      console.log(`✅ Completed Pomodoro session: ${session.task}`);
      
      return {
        success: true,
        session: session,
        stats: stats,
        message: 'Pomodoro session completed successfully!'
      };

    } catch (error) {
      console.error('❌ Complete session error:', error);
      return { success: false, error: error.message };
    }
  }

  /**
   * Pause current session
   */
  pauseSession(sessionId) {
    try {
      const session = this.activeSessions.get(sessionId);
      if (!session || session.state === this.sessionStates.PAUSED) {
        return { success: false, error: 'No active session to pause' };
      }

      session.previousState = session.state;
      session.state = this.sessionStates.PAUSED;
      session.pauseStart = new Date();

      // Clear active timers
      if (session.workEndTimer) clearTimeout(session.workEndTimer);
      if (session.breakEndTimer) clearTimeout(session.breakEndTimer);
      if (session.focusReminderTimer) clearTimeout(session.focusReminderTimer);
      if (session.breakReminderTimer) clearTimeout(session.breakReminderTimer);

      this.notificationManager.sendNotification(
        'schedule_reminder',
        'Session Paused',
        `Pomodoro session paused. Resume when you're ready.`,
        {
          actions: ['Resume', 'End Session'],
          callback: (response) => this.handlePauseResponse(sessionId, response)
        }
      );

      this.updateSessionTracking(session, 'paused');
      
      return { success: true, message: 'Session paused' };
    } catch (error) {
      console.error('❌ Pause session error:', error);
      return { success: false, error: error.message };
    }
  }

  /**
   * Resume paused session
   */
  resumeSession(sessionId) {
    try {
      const session = this.activeSessions.get(sessionId);
      if (!session || session.state !== this.sessionStates.PAUSED) {
        return { success: false, error: 'No paused session to resume' };
      }

      // Calculate pause duration
      const pauseDuration = Date.now() - session.pauseStart.getTime();
      session.timeTracking.pausedTime += pauseDuration;

      // Restore previous state
      session.state = session.previousState;
      delete session.previousState;
      delete session.pauseStart;

      // Restart appropriate timers based on state
      if (session.state === this.sessionStates.WORK) {
        this.startWorkPeriod(session);
      } else if (session.state.includes('break')) {
        const breakType = session.state === this.sessionStates.LONG_BREAK ? 'long_break' : 'short_break';
        this.startBreakPeriod(sessionId, breakType);
      }

      this.notificationManager.sendNotification(
        'pomodoro_start',
        'Session Resumed',
        `Back to ${session.state === this.sessionStates.WORK ? 'work' : 'break'} mode!`
      );

      this.updateSessionTracking(session, 'resumed');
      
      return { success: true, message: 'Session resumed' };
    } catch (error) {
      console.error('❌ Resume session error:', error);
      return { success: false, error: error.message };
    }
  }

  /**
   * End session early
   */
  endSession(sessionId) {
    try {
      const session = this.activeSessions.get(sessionId);
      if (!session) {
        return { success: false, error: 'No active session to end' };
      }

      // Clear all timers
      this.clearSessionTimers(session);

      // Mark as ended
      session.state = this.sessionStates.COMPLETED;
      session.endTime = new Date();
      session.endedEarly = true;

      // Calculate partial statistics
      const stats = this.calculateSessionStats(session);

      this.notificationManager.sendNotification(
        'task_complete',
        'Session Ended',
        `Session ended early.\nCompleted: ${session.completedCycles} cycles\nWork time: ${Math.round(stats.actualWorkTime / 60)} minutes`
      );

      // Archive session
      this.archiveSession(session, stats);

      // Clear current session
      if (this.currentSession && this.currentSession.id === sessionId) {
        this.currentSession = null;
      }

      this.activeSessions.delete(sessionId);
      
      return { success: true, stats: stats, message: 'Session ended' };
    } catch (error) {
      console.error('❌ End session error:', error);
      return { success: false, error: error.message };
    }
  }

  /**
   * Notification response handlers
   */
  handleWorkPeriodResponse(sessionId, response) {
    const session = this.activeSessions.get(sessionId);
    if (!session) return;

    switch (response) {
      case 'Focus Mode':
        // Enable strict focus mode
        this.enableFocusMode(session);
        break;
      case 'Pause':
        this.pauseSession(sessionId);
        break;
      case 'Skip':
        this.endWorkPeriod(sessionId);
        break;
    }
  }

  handleWorkCompleteResponse(sessionId, response, breakType) {
    switch (response) {
      case 'Start Break':
        this.startBreakPeriod(sessionId, breakType);
        break;
      case 'Continue Working':
        // Extend work period
        this.extendWorkPeriod(sessionId);
        break;
      case 'End Session':
        this.endSession(sessionId);
        break;
    }
  }

  handleBreakResponse(sessionId, response) {
    switch (response) {
      case 'Take Break':
        // Break continues normally
        break;
      case 'Back to Work':
        this.endBreakPeriod(sessionId);
        break;
      case 'End Session':
        this.endSession(sessionId);
        break;
    }
  }

  handleBreakEndResponse(sessionId, response) {
    switch (response) {
      case 'Start Next Cycle':
        const session = this.activeSessions.get(sessionId);
        if (session) this.startWorkPeriod(session);
        break;
      case 'Extend Break':
        this.extendBreak(sessionId, 10); // 10 more minutes
        break;
      case 'End Session':
        this.endSession(sessionId);
        break;
    }
  }

  handleSessionCompleteResponse(sessionId, response, stats) {
    switch (response) {
      case 'View Stats':
        this.showDetailedStats(stats);
        break;
      case 'Start New Session':
        // Could trigger new session creation
        break;
      case 'Take Long Break':
        this.notificationManager.sendNotification(
          'health_reminder',
          'Long Break',
          'Take a well-deserved long break. You\'ve earned it!'
        );
        break;
    }
  }

  handlePauseResponse(sessionId, response) {
    switch (response) {
      case 'Resume':
        this.resumeSession(sessionId);
        break;
      case 'End Session':
        this.endSession(sessionId);
        break;
    }
  }

  /**
   * Helper methods
   */
  enableFocusMode(session) {
    session.focusMode = true;
    this.notificationManager.sendNotification(
      'focus_reminder',
      'Focus Mode Enabled',
      'All distractions minimized. Deep work time!'
    );
  }

  extendWorkPeriod(sessionId, minutes = 25) {
    const session = this.activeSessions.get(sessionId);
    if (!session) return;

    if (session.workEndTimer) clearTimeout(session.workEndTimer);
    
    session.workEndTimer = setTimeout(() => {
      this.endWorkPeriod(sessionId);
    }, minutes * 60 * 1000);

    this.notificationManager.sendNotification(
      'pomodoro_start',
      'Work Extended',
      `Extended work period by ${minutes} minutes. Keep the momentum!`
    );
  }

  extendBreak(sessionId, minutes) {
    const session = this.activeSessions.get(sessionId);
    if (!session) return;

    if (session.breakEndTimer) clearTimeout(session.breakEndTimer);
    
    session.breakEndTimer = setTimeout(() => {
      this.endBreakPeriod(sessionId);
    }, minutes * 60 * 1000);

    this.notificationManager.sendNotification(
      'pomodoro_break',
      'Break Extended',
      `Enjoy ${minutes} more minutes of break time.`
    );
  }

  sendFocusReminder(session) {
    const remainingTime = Math.round((session.config.work * 60 * 1000 - (Date.now() - session.currentPeriodStart.getTime())) / 60000);
    
    this.notificationManager.sendNotification(
      'focus_reminder',
      'Staying Focused?',
      `${remainingTime} minutes left in this work session.\nTask: ${session.task}`,
      { timeout: 5 }
    );
  }

  sendBreakActivityReminder(session, suggestions) {
    this.notificationManager.sendNotification(
      'health_reminder',
      'Break Activity',
      `Halfway through your break!\n\nTry: ${suggestions.energizing}`,
      { timeout: 8 }
    );
  }

  getBreakSuggestions(isLongBreak) {
    const shortBreakActivities = [
      'Stand and stretch your neck and shoulders',
      'Take 5 deep breaths and relax',
      'Look out the window at something distant',
      'Drink some water and hydrate',
      'Do some light stretching'
    ];

    const longBreakActivities = [
      'Take a 10-15 minute walk outside',
      'Do some yoga or meditation',
      'Have a healthy snack and hydrate',
      'Listen to music and relax',
      'Call a friend or family member',
      'Tidy up your workspace',
      'Read a few pages of a book'
    ];

    const activities = isLongBreak ? longBreakActivities : shortBreakActivities;
    
    return {
      random: activities[Math.floor(Math.random() * activities.length)],
      energizing: isLongBreak ? 'Take a walk outside' : 'Do some stretches',
      relaxing: isLongBreak ? 'Listen to calming music' : 'Take deep breaths',
      all: activities
    };
  }

  clearSessionTimers(session) {
    const timers = ['workEndTimer', 'breakEndTimer', 'focusReminderTimer', 'breakReminderTimer'];
    timers.forEach(timer => {
      if (session[timer]) {
        clearTimeout(session[timer]);
        delete session[timer];
      }
    });
  }

  calculateSessionStats(session) {
    const totalDuration = (session.endTime || new Date()).getTime() - session.startTime.getTime();
    const actualWorkMinutes = Math.round(session.timeTracking.actualWorkTime / 60000);
    const totalBreakMinutes = Math.round(session.timeTracking.totalBreakTime / 60000);
    const pausedMinutes = Math.round(session.timeTracking.pausedTime / 60000);

    return {
      sessionId: session.id,
      task: session.task,
      config: session.config.name,
      totalDuration: totalDuration,
      actualWorkTime: session.timeTracking.actualWorkTime,
      plannedWorkTime: session.config.work * session.workPeriods * 60000,
      breakTime: session.timeTracking.totalBreakTime,
      pausedTime: session.timeTracking.pausedTime,
      workPeriods: session.workPeriods,
      breaks: session.breaks,
      completedCycles: session.completedCycles,
      interruptions: session.interruptions,
      focusEfficiency: actualWorkMinutes > 0 ? Math.round((actualWorkMinutes / (session.config.work * session.workPeriods)) * 100) : 0,
      endedEarly: session.endedEarly || false,
      startTime: session.startTime,
      endTime: session.endTime
    };
  }

  archiveSession(session, stats) {
    this.sessionHistory.push({
      ...stats,
      archivedAt: new Date()
    });

    // Remove from active sessions
    this.activeSessions.delete(session.id);
    
    console.log(`📊 Archived session: ${session.task} (${stats.focusEfficiency}% efficiency)`);
  }

  updateSessionTracking(session, event, data = {}) {
    console.log(`🍅 Session ${session.id}: ${event}`, data);
  }

  showDetailedStats(stats) {
    const statsMessage = `
📊 Session Statistics:
⏱️ Total Time: ${Math.round(stats.totalDuration / 60000)} minutes
🎯 Work Time: ${Math.round(stats.actualWorkTime / 60000)} minutes
☕ Break Time: ${Math.round(stats.breakTime / 60000)} minutes
🔁 Cycles: ${stats.completedCycles}
📈 Focus Efficiency: ${stats.focusEfficiency}%
    `;

    this.notificationManager.sendNotification(
      'task_complete',
      'Session Statistics',
      statsMessage,
      { timeout: 20 }
    );
  }

  generateSessionId() {
    return `pomodoro_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }

  /**
   * Schedule automated Pomodoro sessions from daily schedule
   */
  scheduleFromDailySchedule(scheduleBlocks) {
    try {
      console.log('📅 Scheduling Pomodoro sessions from daily schedule...');
      
      const pomodoroBlocks = scheduleBlocks.filter(block => 
        block.type === 'pomodoro_work' || block.type === 'deep_work'
      );

      pomodoroBlocks.forEach(block => {
        const startTime = new Date();
        const [hours, minutes] = block.startTime.split(':');
        startTime.setHours(parseInt(hours), parseInt(minutes), 0, 0);

        if (startTime > new Date()) {
          // Schedule the Pomodoro session to start automatically
          this.scheduleSessionStart(startTime, block.task, {
            config: block.pomodoroConfig || 'classic',
            autoStart: true,
            duration: this.calculateBlockDuration(block)
          });
        }
      });

      return {
        success: true,
        scheduledSessions: pomodoroBlocks.length,
        message: `Scheduled ${pomodoroBlocks.length} Pomodoro sessions`
      };
    } catch (error) {
      console.error('❌ Schedule from daily schedule error:', error);
      return { success: false, error: error.message };
    }
  }

  scheduleSessionStart(startTime, task, options) {
    const delay = startTime.getTime() - Date.now();
    
    setTimeout(() => {
      this.startSession(options.config, task, options);
    }, delay);

    console.log(`⏰ Scheduled Pomodoro session: ${task} at ${startTime.toLocaleString()}`);
  }

  calculateBlockDuration(block) {
    const [startHours, startMinutes] = block.startTime.split(':').map(Number);
    const [endHours, endMinutes] = block.endTime.split(':').map(Number);
    
    const startTotalMinutes = startHours * 60 + startMinutes;
    const endTotalMinutes = endHours * 60 + endMinutes;
    
    return endTotalMinutes - startTotalMinutes;
  }

  /**
   * Get Pomodoro manager status
   */
  getStatus() {
    return {
      currentSession: this.currentSession ? {
        id: this.currentSession.id,
        task: this.currentSession.task,
        state: this.currentSession.state,
        currentCycle: this.currentSession.currentCycle,
        totalCycles: this.currentSession.totalCycles,
        config: this.currentSession.config.name
      } : null,
      activeSessions: this.activeSessions.size,
      sessionHistory: this.sessionHistory.length,
      availableConfigs: Object.keys(this.pomodoroConfigs),
      notificationManager: this.notificationManager.getStatus()
    };
  }

  /**
   * Get session history for analytics
   */
  getSessionHistory(days = 7) {
    const cutoff = new Date(Date.now() - days * 24 * 60 * 60 * 1000);
    return this.sessionHistory.filter(session => 
      session.startTime >= cutoff
    );
  }

  /**
   * Get current session details
   */
  getCurrentSession() {
    return this.currentSession;
  }

  /**
   * Update Pomodoro configuration
   */
  updateConfig(configName, newConfig) {
    if (this.pomodoroConfigs[configName]) {
      this.pomodoroConfigs[configName] = { ...this.pomodoroConfigs[configName], ...newConfig };
      console.log(`⚙️ Updated Pomodoro config: ${configName}`);
      return true;
    }
    return false;
  }
}

module.exports = PomodoroManager;