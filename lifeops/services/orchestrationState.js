/**
 * Orchestration State - Centralized state management for productivity orchestrator
 * Extracted from ProductivityOrchestrator for better organization
 */

class OrchestrationState {
  constructor() {
    this.userPreferences = {};
    this.todaysPlan = null;
    this.currentSession = null;
    this.executionMode = false;
    this.conversationHistory = [];
    this.scheduledTasks = [];
    this.pomodoroActive = false;
    this.lastUpdate = null;
  }

  /**
   * Update user preferences
   */
  updateUserPreferences(preferences) {
    this.userPreferences = {
      ...this.userPreferences,
      ...preferences,
      lastUpdated: new Date()
    };
  }

  /**
   * Set today's plan
   */
  setTodaysPlan(plan) {
    this.todaysPlan = plan;
    this.lastUpdate = new Date();
  }

  /**
   * Update current session
   */
  updateCurrentSession(sessionData) {
    this.currentSession = {
      ...this.currentSession,
      ...sessionData
    };
  }

  /**
   * Activate execution mode
   */
  activateExecutionMode() {
    this.executionMode = true;
    this.lastUpdate = new Date();
  }

  /**
   * Deactivate execution mode
   */
  deactivateExecutionMode() {
    this.executionMode = false;
    this.lastUpdate = new Date();
  }

  /**
   * Add to conversation history
   */
  addToConversationHistory(message) {
    this.conversationHistory.push({
      timestamp: new Date(),
      ...message
    });
  }

  /**
   * Update scheduled tasks
   */
  updateScheduledTasks(tasks) {
    this.scheduledTasks = tasks;
    this.lastUpdate = new Date();
  }

  /**
   * Set Pomodoro status
   */
  setPomodoroActive(active) {
    this.pomodoroActive = active;
    this.lastUpdate = new Date();
  }

  /**
   * Get full state
   */
  getState() {
    return {
      userPreferences: this.userPreferences,
      todaysPlan: this.todaysPlan,
      currentSession: this.currentSession,
      executionMode: this.executionMode,
      conversationHistory: this.conversationHistory,
      scheduledTasks: this.scheduledTasks,
      pomodoroActive: this.pomodoroActive,
      lastUpdate: this.lastUpdate
    };
  }

  /**
   * Reset state
   */
  reset() {
    this.userPreferences = {};
    this.todaysPlan = null;
    this.currentSession = null;
    this.executionMode = false;
    this.conversationHistory = [];
    this.scheduledTasks = [];
    this.pomodoroActive = false;
    this.lastUpdate = new Date();
  }
}

module.exports = OrchestrationState;
