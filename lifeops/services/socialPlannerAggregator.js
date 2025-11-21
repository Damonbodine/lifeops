/**
 * Social Planner Aggregator
 * Orchestrates collection of planning context from various providers
 */

const HealthAnalytics = require('./healthAnalytics');
const EnergyContextProvider = require('./energyContextProvider');
const SocialContextProvider = require('./socialContextProvider');
const ScheduleContextProvider = require('./scheduleContextProvider');
const path = require('path');

class SocialPlannerAggregator {
  constructor() {
    this.healthAnalytics = new HealthAnalytics(process.env.OPENAI_API_KEY);
    this.HEALTH_EXPORT_PATH = path.join(__dirname, '../apple_health_export');

    // Initialize context providers
    this.energyProvider = new EnergyContextProvider(this.healthAnalytics);
    this.socialProvider = new SocialContextProvider();
    this.scheduleProvider = new ScheduleContextProvider();
  }

  /**
   * Gather all planning context - memory optimized
   * Returns processed insights instead of raw data
   */
  async gatherPlanningContext(userGoals = {}) {
    console.log('🔄 Gathering planning context...');

    try {
      // Gather all context in parallel for efficiency
      const [energyContext, socialContext, scheduleContext, tasksContext] = await Promise.all([
        this.energyProvider.getEnergyContext(),
        this.socialProvider.getSocialContext(),
        this.scheduleProvider.getScheduleContext(),
        this.scheduleProvider.getLifeTasksContext()
      ]);

      const context = {
        energy: energyContext,
        social: socialContext,
        schedule: scheduleContext,
        tasks: tasksContext,
        goals: userGoals,
        timestamp: new Date().toISOString()
      };

      console.log('✅ Planning context gathered successfully');
      return context;
    } catch (error) {
      console.error('❌ Error gathering planning context:', error);
      throw error;
    }
  }

  /**
   * Memory usage monitoring
   */
  getMemoryUsage() {
    const used = process.memoryUsage();
    return {
      rss: Math.round(used.rss / 1024 / 1024 * 100) / 100,
      heapTotal: Math.round(used.heapTotal / 1024 / 1024 * 100) / 100,
      heapUsed: Math.round(used.heapUsed / 1024 / 1024 * 100) / 100,
      external: Math.round(used.external / 1024 / 1024 * 100) / 100
    };
  }

  /**
   * Log memory usage for debugging
   */
  logMemoryUsage(stage) {
    const memory = this.getMemoryUsage();
    console.log(`🧠 Memory usage at ${stage}:`, memory);
  }
}

module.exports = SocialPlannerAggregator;