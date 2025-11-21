/**
 * TaskDataCollector - Handles task data collection from various sources
 */
class TaskDataCollector {
  constructor() {
    this.dataCache = new Map();
    this.cacheTimeout = 10 * 60 * 1000; // 10 minutes cache
  }

  /**
   * Collect task data from various sources
   */
  async collectTaskData() {
    try {
      const cacheKey = 'tasks';
      const cached = this.getCachedData(cacheKey);
      if (cached) return cached;

      console.log('✅ Collecting task data...');

      // This would integrate with existing task systems
      // For now, return placeholder structure for future integration
      const taskData = {
        pending: [],
        inProgress: [],
        completed: [],
        overdue: [],
        estimatedTime: 0,
        priorities: {
          high: [],
          medium: [],
          low: []
        }
      };

      this.setCachedData(cacheKey, taskData);
      return taskData;
    } catch (error) {
      console.error('❌ Task data collection error:', error);
      return {
        pending: [],
        inProgress: [],
        completed: [],
        overdue: [],
        error: error.message
      };
    }
  }

  /**
   * Get overdue tasks
   */
  async getOverdueTasks() {
    try {
      const allTasks = await this.collectTaskData();
      return allTasks.overdue || [];
    } catch (error) {
      console.error('❌ Error getting overdue tasks:', error);
      return [];
    }
  }

  /**
   * Get high priority tasks
   */
  async getHighPriorityTasks() {
    try {
      const allTasks = await this.collectTaskData();
      return allTasks.priorities?.high || [];
    } catch (error) {
      console.error('❌ Error getting high priority tasks:', error);
      return [];
    }
  }

  /**
   * Calculate total estimated time for tasks
   */
  calculateEstimatedTime(tasks) {
    if (!Array.isArray(tasks)) return 0;
    return tasks.reduce((total, task) => total + (task.estimatedTime || 0), 0);
  }

  /**
   * Check if task data is available
   */
  isAvailable() {
    // Task data is always potentially available
    return true;
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

module.exports = TaskDataCollector;
