/**
 * Energy Context Provider
 * Collects and analyzes energy-related context from health data
 */

const MockPlanningContext = require('../config/mockPlanningContext');

class EnergyContextProvider {
  constructor(healthAnalytics) {
    this.healthAnalytics = healthAnalytics;
  }

  /**
   * Get energy profile from health data
   * USING MOCK DATA for performance - replace with real data later
   */
  async getEnergyContext() {
    try {
      console.log('🎭 Using mock health data for fast performance');

      const mockEnergyProfile = MockPlanningContext.generateEnergyProfile();

      console.log('✅ Mock energy profile generated:', mockEnergyProfile);
      return mockEnergyProfile;

    } catch (error) {
      console.error('Error getting energy context:', error);
      return MockPlanningContext.getFallbackEnergyProfile();
    }
  }

  /**
   * Calculate energy level from health trends
   */
  calculateEnergyLevel(trends) {
    try {
      if (!trends || !trends.healthSummary) return 'moderate';

      const { steps, heartRate, activeEnergy } = trends.healthSummary;

      // Simple energy calculation based on activity levels
      const stepsScore = steps ? (steps.dailyAverage > 8000 ? 'high' : steps.dailyAverage > 5000 ? 'moderate' : 'low') : 'moderate';
      const energyScore = activeEnergy ? (activeEnergy.dailyAverage > 400 ? 'high' : activeEnergy.dailyAverage > 200 ? 'moderate' : 'low') : 'moderate';

      // Return most common energy level
      if (stepsScore === 'high' || energyScore === 'high') return 'high';
      if (stepsScore === 'low' && energyScore === 'low') return 'low';
      return 'moderate';
    } catch (error) {
      return 'moderate';
    }
  }

  /**
   * Get optimal workout times based on energy trends
   */
  getOptimalWorkoutTimes(trends) {
    const currentEnergy = this.calculateEnergyLevel(trends);

    switch (currentEnergy) {
      case 'high':
        return ['early morning', 'afternoon'];
      case 'low':
        return ['late morning', 'early evening'];
      default:
        return ['morning', 'afternoon'];
    }
  }

  /**
   * Calculate rest needs based on energy levels
   */
  calculateRestNeeds(trends) {
    const currentEnergy = this.calculateEnergyLevel(trends);

    switch (currentEnergy) {
      case 'high':
        return 'low - maintain current pace';
      case 'low':
        return 'high - prioritize recovery';
      default:
        return 'moderate - balance activity and rest';
    }
  }

  /**
   * Suggest weekly fitness goals based on energy levels
   */
  suggestWeeklyFitness(trends) {
    const currentEnergy = this.calculateEnergyLevel(trends);

    switch (currentEnergy) {
      case 'high':
        return '4-5 workouts per week';
      case 'low':
        return '2-3 light workouts per week';
      default:
        return '3-4 moderate workouts per week';
    }
  }

  /**
   * Identify energy peaks throughout the day
   */
  identifyEnergyPeaks(trends) {
    // Standard energy peaks for most people
    return ['9am-11am', '2pm-4pm'];
  }
}

module.exports = EnergyContextProvider;
