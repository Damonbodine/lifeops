/**
 * PomodoroStatistics - Handles session analytics, performance tracking, and statistics
 */
class PomodoroStatistics {
  constructor(notificationManager) {
    this.notificationManager = notificationManager;
  }

  /**
   * Calculate comprehensive session statistics
   */
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

  /**
   * Show detailed statistics notification
   */
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

  /**
   * Calculate aggregate statistics from session history
   */
  calculateAggregateStats(sessionHistory, days = 7) {
    const cutoffDate = new Date(Date.now() - days * 24 * 60 * 60 * 1000);
    const recentSessions = sessionHistory.filter(s => s.startTime >= cutoffDate);

    if (recentSessions.length === 0) {
      return {
        totalSessions: 0,
        totalWorkTime: 0,
        totalBreakTime: 0,
        totalCycles: 0,
        averageEfficiency: 0,
        mostUsedConfig: null,
        days: days
      };
    }

    const totalWorkTime = recentSessions.reduce((sum, s) => sum + (s.actualWorkTime || 0), 0);
    const totalBreakTime = recentSessions.reduce((sum, s) => sum + (s.breakTime || 0), 0);
    const totalCycles = recentSessions.reduce((sum, s) => sum + (s.completedCycles || 0), 0);
    const averageEfficiency = Math.round(
      recentSessions.reduce((sum, s) => sum + (s.focusEfficiency || 0), 0) / recentSessions.length
    );

    // Find most used config
    const configCounts = {};
    recentSessions.forEach(s => {
      configCounts[s.config] = (configCounts[s.config] || 0) + 1;
    });
    const mostUsedConfig = Object.keys(configCounts).reduce((a, b) =>
      configCounts[a] > configCounts[b] ? a : b
    );

    return {
      totalSessions: recentSessions.length,
      totalWorkTime: totalWorkTime,
      totalBreakTime: totalBreakTime,
      totalCycles: totalCycles,
      averageEfficiency: averageEfficiency,
      mostUsedConfig: mostUsedConfig,
      averageSessionDuration: Math.round(
        recentSessions.reduce((sum, s) => sum + (s.totalDuration || 0), 0) / recentSessions.length
      ),
      days: days
    };
  }

  /**
   * Generate productivity insights
   */
  generateInsights(sessionHistory, days = 7) {
    const stats = this.calculateAggregateStats(sessionHistory, days);
    const insights = [];

    if (stats.totalSessions === 0) {
      return ['No sessions recorded in the selected period.'];
    }

    // Work time insights
    const avgWorkTimePerSession = stats.totalWorkTime / stats.totalSessions;
    if (avgWorkTimePerSession < 20 * 60 * 1000) {
      insights.push('💡 Consider longer work sessions for deeper focus.');
    }

    // Efficiency insights
    if (stats.averageEfficiency < 70) {
      insights.push('💡 Focus efficiency could be improved. Try reducing interruptions.');
    } else if (stats.averageEfficiency > 90) {
      insights.push('🌟 Excellent focus efficiency! Keep up the great work!');
    }

    // Session frequency
    const avgSessionsPerDay = stats.totalSessions / days;
    if (avgSessionsPerDay < 1) {
      insights.push('💡 Try to complete at least one Pomodoro session daily.');
    } else if (avgSessionsPerDay > 3) {
      insights.push('🔥 Great consistency! You\'re building a strong Pomodoro habit.');
    }

    // Config recommendations
    insights.push(`📋 Most productive with: ${stats.mostUsedConfig}`);

    return insights;
  }

  /**
   * Format time duration for display
   */
  formatDuration(milliseconds) {
    const hours = Math.floor(milliseconds / (1000 * 60 * 60));
    const minutes = Math.floor((milliseconds % (1000 * 60 * 60)) / (1000 * 60));

    if (hours > 0) {
      return `${hours}h ${minutes}m`;
    }
    return `${minutes}m`;
  }

  /**
   * Generate summary report
   */
  generateSummaryReport(sessionHistory, days = 7) {
    const stats = this.calculateAggregateStats(sessionHistory, days);
    const insights = this.generateInsights(sessionHistory, days);

    return {
      period: `Last ${days} days`,
      summary: {
        totalSessions: stats.totalSessions,
        totalWorkTime: this.formatDuration(stats.totalWorkTime),
        totalBreakTime: this.formatDuration(stats.totalBreakTime),
        totalCycles: stats.totalCycles,
        averageEfficiency: `${stats.averageEfficiency}%`,
        mostUsedConfig: stats.mostUsedConfig
      },
      insights: insights,
      rawStats: stats
    };
  }

  /**
   * Export statistics for external use
   */
  exportStats(sessionHistory, format = 'json') {
    if (format === 'json') {
      return JSON.stringify(sessionHistory, null, 2);
    }

    // CSV format
    if (format === 'csv') {
      const headers = ['Session ID', 'Task', 'Config', 'Work Time (min)', 'Cycles', 'Efficiency %', 'Date'];
      const rows = sessionHistory.map(s => [
        s.sessionId,
        s.task,
        s.config,
        Math.round(s.actualWorkTime / 60000),
        s.completedCycles,
        s.focusEfficiency,
        s.startTime.toISOString()
      ]);

      return [headers, ...rows].map(row => row.join(',')).join('\n');
    }

    return sessionHistory;
  }
}

module.exports = PomodoroStatistics;
