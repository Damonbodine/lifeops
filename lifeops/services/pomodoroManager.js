const NotificationManager = require('./notificationManager');
const PomodoroSession = require('./pomodoroSession');
const PomodoroTimer = require('./pomodoroTimer');
const PomodoroStatistics = require('./pomodoroStatistics');
const { pomodoroConfigs, sessionStates } = require('../config/pomodoroConfigs');

/**
 * PomodoroManager - Orchestrates Pomodoro timer execution and management
 * Integrates with schedule and notifications for seamless productivity flow
 */
class PomodoroManager {
  constructor() {
    this.notificationManager = new NotificationManager();
    this.sessionManager = new PomodoroSession();
    this.timer = new PomodoroTimer(this.notificationManager, this.sessionManager);
    this.statistics = new PomodoroStatistics(this.notificationManager);

    // Store configs for easy access
    this.pomodoroConfigs = pomodoroConfigs;
    this.sessionStates = sessionStates;

    console.log('🍅 PomodoroManager initialized');
  }

  /**
   * Start a new Pomodoro session
   */
  async startSession(config = 'classic', task = 'Focus work', options = {}) {
    try {
      if (this.sessionManager.hasActiveSession()) {
        throw new Error('A Pomodoro session is already active');
      }

      const session = this.sessionManager.createSession(config, task, options);

      // Start the first work period
      await this.timer.startWorkPeriod(session);

      console.log(`🍅 Started ${session.config.name} session: ${task}`);

      return {
        success: true,
        sessionId: session.id,
        session: session,
        message: `Started ${session.config.name} session for "${task}"`
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
   * Complete entire Pomodoro session
   */
  async completeSession(sessionId) {
    try {
      const session = this.sessionManager.completeSession(sessionId);
      if (!session) {
        return { success: false, error: 'Session not found' };
      }

      // Calculate session statistics
      const stats = this.statistics.calculateSessionStats(session);

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
      this.sessionManager.archiveSession(session, stats);

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
   * End session early
   */
  endSession(sessionId) {
    try {
      const session = this.sessionManager.getSession(sessionId);
      if (!session) {
        return { success: false, error: 'No active session to end' };
      }

      // Clear all timers
      this.timer.clearSessionTimers(session);

      // Mark as ended
      session.state = this.sessionStates.COMPLETED;
      session.endTime = new Date();
      session.endedEarly = true;

      // Calculate partial statistics
      const stats = this.statistics.calculateSessionStats(session);

      this.notificationManager.sendNotification(
        'task_complete',
        'Session Ended',
        `Session ended early.\nCompleted: ${session.completedCycles} cycles\nWork time: ${Math.round(stats.actualWorkTime / 60)} minutes`
      );

      // Archive session
      this.sessionManager.archiveSession(session, stats);

      return { success: true, stats: stats, message: 'Session ended' };
    } catch (error) {
      console.error('❌ End session error:', error);
      return { success: false, error: error.message };
    }
  }

  /**
   * Pause current session
   */
  pauseSession(sessionId) {
    return this.timer.pauseSession(sessionId);
  }

  /**
   * Resume paused session
   */
  resumeSession(sessionId) {
    return this.timer.resumeSession(sessionId);
  }

  /**
   * Handle session complete notification responses
   */
  handleSessionCompleteResponse(sessionId, response, stats) {
    switch (response) {
      case 'View Stats':
        this.statistics.showDetailedStats(stats);
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

  /**
   * Schedule a session to start at a specific time
   */
  scheduleSessionStart(startTime, task, options) {
    const delay = startTime.getTime() - Date.now();

    setTimeout(() => {
      this.startSession(options.config, task, options);
    }, delay);

    console.log(`⏰ Scheduled Pomodoro session: ${task} at ${startTime.toLocaleString()}`);
  }

  /**
   * Calculate duration of a schedule block
   */
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
    const currentSession = this.sessionManager.getCurrentSession();

    return {
      currentSession: currentSession ? {
        id: currentSession.id,
        task: currentSession.task,
        state: currentSession.state,
        currentCycle: currentSession.currentCycle,
        totalCycles: currentSession.totalCycles,
        config: currentSession.config.name
      } : null,
      activeSessions: this.sessionManager.getActiveSessionCount(),
      sessionHistory: this.sessionManager.getHistoryCount(),
      availableConfigs: Object.keys(this.pomodoroConfigs),
      notificationManager: this.notificationManager.getStatus()
    };
  }

  /**
   * Get session history for analytics
   */
  getSessionHistory(days = 7) {
    return this.sessionManager.getSessionHistory(days);
  }

  /**
   * Get current session details
   */
  getCurrentSession() {
    return this.sessionManager.getCurrentSession();
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

  /**
   * Get aggregate statistics
   */
  getAggregateStats(days = 7) {
    const history = this.sessionManager.getSessionHistory(days);
    return this.statistics.calculateAggregateStats(history, days);
  }

  /**
   * Get productivity insights
   */
  getInsights(days = 7) {
    const history = this.sessionManager.getSessionHistory(days);
    return this.statistics.generateInsights(history, days);
  }

  /**
   * Generate summary report
   */
  getSummaryReport(days = 7) {
    const history = this.sessionManager.getSessionHistory(days);
    return this.statistics.generateSummaryReport(history, days);
  }

  /**
   * Export session data
   */
  exportSessionData(format = 'json') {
    const history = this.sessionManager.sessionHistory;
    return this.statistics.exportStats(history, format);
  }
}

module.exports = PomodoroManager;
