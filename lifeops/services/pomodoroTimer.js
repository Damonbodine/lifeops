const { sessionStates, breakSuggestions } = require('../config/pomodoroConfigs');

/**
 * PomodoroTimer - Handles timer logic, state transitions, and period management
 */
class PomodoroTimer {
  constructor(notificationManager, sessionManager) {
    this.notificationManager = notificationManager;
    this.sessionManager = sessionManager;
  }

  /**
   * Start work period with timer and notifications
   */
  async startWorkPeriod(session) {
    try {
      session.state = sessionStates.WORK;
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
      this.sessionManager.updateSessionTracking(session, 'work_started');

    } catch (error) {
      console.error('❌ Start work period error:', error);
    }
  }

  /**
   * End work period and start break
   */
  async endWorkPeriod(sessionId) {
    try {
      const session = this.sessionManager.getSession(sessionId);
      if (!session || session.state !== sessionStates.WORK) {
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

      this.sessionManager.updateSessionTracking(session, 'work_completed');

    } catch (error) {
      console.error('❌ End work period error:', error);
    }
  }

  /**
   * Start break period
   */
  async startBreakPeriod(sessionId, breakType = 'short_break') {
    try {
      const session = this.sessionManager.getSession(sessionId);
      if (!session) return;

      const isLongBreak = breakType === 'long_break';
      const breakDuration = isLongBreak ? session.config.longBreak : session.config.shortBreak;

      session.state = isLongBreak ? sessionStates.LONG_BREAK : sessionStates.SHORT_BREAK;
      session.currentPeriodStart = new Date();
      session.breaks++;

      // Send break start notification with suggestions
      const suggestions = this.getBreakSuggestions(isLongBreak);
      await this.notificationManager.sendNotification(
        'pomodoro_break',
        `${isLongBreak ? 'Long' : 'Short'} Break Time!`,
        `Take a ${breakDuration}-minute break.\n\nSuggestion: ${suggestions.random}`,
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
          this.sendBreakActivityReminder(session, suggestions);
        }, (breakDuration / 2) * 60 * 1000);
      }

      this.sessionManager.updateSessionTracking(session, 'break_started', { breakType, breakDuration });

    } catch (error) {
      console.error('❌ Start break period error:', error);
    }
  }

  /**
   * End break period and continue or complete session
   */
  async endBreakPeriod(sessionId) {
    try {
      const session = this.sessionManager.getSession(sessionId);
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
        return { shouldComplete: true };
      }

      // Continue to next cycle
      this.sessionManager.incrementCycle(sessionId);

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

      this.sessionManager.updateSessionTracking(session, 'break_completed');

      return { shouldComplete: false };

    } catch (error) {
      console.error('❌ End break period error:', error);
      return { shouldComplete: false };
    }
  }

  /**
   * Pause current session
   */
  pauseSession(sessionId) {
    try {
      const session = this.sessionManager.getSession(sessionId);
      if (!session || session.state === sessionStates.PAUSED) {
        return { success: false, error: 'No active session to pause' };
      }

      session.previousState = session.state;
      session.state = sessionStates.PAUSED;
      session.pauseStart = new Date();

      // Clear active timers
      this.clearSessionTimers(session);

      this.notificationManager.sendNotification(
        'schedule_reminder',
        'Session Paused',
        `Pomodoro session paused. Resume when you're ready.`,
        {
          actions: ['Resume', 'End Session'],
          callback: (response) => this.handlePauseResponse(sessionId, response)
        }
      );

      this.sessionManager.updateSessionTracking(session, 'paused');

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
      const session = this.sessionManager.getSession(sessionId);
      if (!session || session.state !== sessionStates.PAUSED) {
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
      if (session.state === sessionStates.WORK) {
        this.startWorkPeriod(session);
      } else if (session.state.includes('break')) {
        const breakType = session.state === sessionStates.LONG_BREAK ? 'long_break' : 'short_break';
        this.startBreakPeriod(sessionId, breakType);
      }

      this.notificationManager.sendNotification(
        'pomodoro_start',
        'Session Resumed',
        `Back to ${session.state === sessionStates.WORK ? 'work' : 'break'} mode!`
      );

      this.sessionManager.updateSessionTracking(session, 'resumed');

      return { success: true, message: 'Session resumed' };
    } catch (error) {
      console.error('❌ Resume session error:', error);
      return { success: false, error: error.message };
    }
  }

  /**
   * Extend work period
   */
  extendWorkPeriod(sessionId, minutes = 25) {
    const session = this.sessionManager.getSession(sessionId);
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

  /**
   * Extend break period
   */
  extendBreak(sessionId, minutes) {
    const session = this.sessionManager.getSession(sessionId);
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

  /**
   * Enable focus mode
   */
  enableFocusMode(session) {
    session.focusMode = true;
    this.notificationManager.sendNotification(
      'focus_reminder',
      'Focus Mode Enabled',
      'All distractions minimized. Deep work time!'
    );
  }

  /**
   * Send focus reminder during work
   */
  sendFocusReminder(session) {
    const remainingTime = Math.round((session.config.work * 60 * 1000 - (Date.now() - session.currentPeriodStart.getTime())) / 60000);

    this.notificationManager.sendNotification(
      'focus_reminder',
      'Staying Focused?',
      `${remainingTime} minutes left in this work session.\nTask: ${session.task}`,
      { timeout: 5 }
    );
  }

  /**
   * Send break activity reminder
   */
  sendBreakActivityReminder(session, suggestions) {
    this.notificationManager.sendNotification(
      'health_reminder',
      'Break Activity',
      `Halfway through your break!\n\nTry: ${suggestions.energizing}`,
      { timeout: 8 }
    );
  }

  /**
   * Get break suggestions
   */
  getBreakSuggestions(isLongBreak) {
    const activities = isLongBreak ? breakSuggestions.long : breakSuggestions.short;

    return {
      random: activities[Math.floor(Math.random() * activities.length)],
      energizing: isLongBreak ? 'Take a walk outside' : 'Do some stretches',
      relaxing: isLongBreak ? 'Listen to calming music' : 'Take deep breaths',
      all: activities
    };
  }

  /**
   * Clear all session timers
   */
  clearSessionTimers(session) {
    const timers = ['workEndTimer', 'breakEndTimer', 'focusReminderTimer', 'breakReminderTimer'];
    timers.forEach(timer => {
      if (session[timer]) {
        clearTimeout(session[timer]);
        delete session[timer];
      }
    });
  }

  /**
   * Notification response handlers
   */
  handleWorkPeriodResponse(sessionId, response) {
    const session = this.sessionManager.getSession(sessionId);
    if (!session) return;

    switch (response) {
      case 'Focus Mode':
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
        this.extendWorkPeriod(sessionId);
        break;
      case 'End Session':
        // Signal to end session (handled by manager)
        return { endSession: true };
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
        return { endSession: true };
    }
  }

  handleBreakEndResponse(sessionId, response) {
    switch (response) {
      case 'Start Next Cycle':
        const session = this.sessionManager.getSession(sessionId);
        if (session) this.startWorkPeriod(session);
        break;
      case 'Extend Break':
        this.extendBreak(sessionId, 10); // 10 more minutes
        break;
      case 'End Session':
        return { endSession: true };
    }
  }

  handlePauseResponse(sessionId, response) {
    switch (response) {
      case 'Resume':
        this.resumeSession(sessionId);
        break;
      case 'End Session':
        return { endSession: true };
    }
  }
}

module.exports = PomodoroTimer;
