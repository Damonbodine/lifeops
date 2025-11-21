const { pomodoroConfigs, sessionStates } = require('../config/pomodoroConfigs');

/**
 * PomodoroSession - Manages individual Pomodoro session lifecycle and state
 */
class PomodoroSession {
  constructor() {
    this.activeSessions = new Map();
    this.sessionHistory = [];
    this.currentSession = null;
  }

  /**
   * Create a new Pomodoro session
   */
  createSession(config, task, options = {}) {
    const pomodoroConfig = typeof config === 'string' ? pomodoroConfigs[config] : config;

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
      state: sessionStates.WORK,
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

    return session;
  }

  /**
   * Get a session by ID
   */
  getSession(sessionId) {
    return this.activeSessions.get(sessionId);
  }

  /**
   * Get current active session
   */
  getCurrentSession() {
    return this.currentSession;
  }

  /**
   * Update session state
   */
  updateSessionState(sessionId, newState) {
    const session = this.activeSessions.get(sessionId);
    if (session) {
      session.state = newState;
      return true;
    }
    return false;
  }

  /**
   * Update session cycle
   */
  incrementCycle(sessionId) {
    const session = this.activeSessions.get(sessionId);
    if (session) {
      session.currentCycle++;
      session.completedCycles++;
      return true;
    }
    return false;
  }

  /**
   * Mark session as completed
   */
  completeSession(sessionId) {
    const session = this.activeSessions.get(sessionId);
    if (!session) return null;

    session.state = sessionStates.COMPLETED;
    session.endTime = new Date();
    session.totalDuration = session.endTime.getTime() - session.startTime.getTime();

    return session;
  }

  /**
   * Archive completed session
   */
  archiveSession(session, stats) {
    this.sessionHistory.push({
      ...stats,
      archivedAt: new Date()
    });

    // Remove from active sessions
    this.activeSessions.delete(session.id);

    // Clear current session if it matches
    if (this.currentSession && this.currentSession.id === session.id) {
      this.currentSession = null;
    }

    console.log(`📊 Archived session: ${session.task} (${stats.focusEfficiency}% efficiency)`);
  }

  /**
   * Remove session from active sessions
   */
  removeSession(sessionId) {
    const session = this.activeSessions.get(sessionId);
    this.activeSessions.delete(sessionId);

    if (this.currentSession && this.currentSession.id === sessionId) {
      this.currentSession = null;
    }

    return session;
  }

  /**
   * Update session tracking
   */
  updateSessionTracking(session, event, data = {}) {
    console.log(`🍅 Session ${session.id}: ${event}`, data);
  }

  /**
   * Generate unique session ID
   */
  generateSessionId() {
    return `pomodoro_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }

  /**
   * Get session history
   */
  getSessionHistory(days = 7) {
    const cutoff = new Date(Date.now() - days * 24 * 60 * 60 * 1000);
    return this.sessionHistory.filter(session =>
      session.startTime >= cutoff
    );
  }

  /**
   * Get all active sessions
   */
  getActiveSessions() {
    return Array.from(this.activeSessions.values());
  }

  /**
   * Check if there's an active session
   */
  hasActiveSession() {
    return this.currentSession !== null && this.currentSession.state !== sessionStates.IDLE;
  }

  /**
   * Get session count
   */
  getActiveSessionCount() {
    return this.activeSessions.size;
  }

  /**
   * Get history count
   */
  getHistoryCount() {
    return this.sessionHistory.length;
  }
}

module.exports = PomodoroSession;
