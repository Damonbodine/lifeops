const HealthAnalytics = require('./healthAnalytics');
const path = require('path');
const fs = require('fs').promises;

class SocialPlannerAggregator {
  constructor() {
    this.healthAnalytics = new HealthAnalytics(process.env.OPENAI_API_KEY);
    this.HEALTH_EXPORT_PATH = path.join(__dirname, '../apple_health_export');
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
        this.getEnergyContext(),
        this.getSocialContext(),
        this.getScheduleContext(),
        this.getLifeTasksContext()
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
   * Get energy profile from health data
   * Returns ~50 tokens instead of 50k health records
   */
  async getEnergyContext() {
    try {
      // Load health data efficiently
      await this.healthAnalytics.loadHealthData(this.HEALTH_EXPORT_PATH);
      
      // Get recent health summary instead of raw data
      const healthSummary = await this.healthAnalytics.generateHealthBrief();
      const recentTrends = await this.healthAnalytics.analyzeTrends('all', 7);
      
      const energyProfile = {
        currentEnergyLevel: this.calculateEnergyLevel(recentTrends),
        optimalWorkoutTimes: this.getOptimalWorkoutTimes(recentTrends),
        restNeeds: this.calculateRestNeeds(recentTrends),
        weeklyFitnessGoal: this.suggestWeeklyFitness(recentTrends),
        energyPeaks: this.identifyEnergyPeaks(recentTrends)
      };

      return energyProfile;
    } catch (error) {
      console.error('Error getting energy context:', error);
      // Return default energy profile if health data fails
      return {
        currentEnergyLevel: 'moderate',
        optimalWorkoutTimes: ['morning', 'afternoon'],
        restNeeds: 'moderate',
        weeklyFitnessGoal: '3-4 workouts',
        energyPeaks: ['9am-11am', '2pm-4pm']
      };
    }
  }

  /**
   * Get social context - aggregated insights
   * Returns ~100 tokens instead of 1000+ messages/emails
   */
  async getSocialContext() {
    try {
      const [messageInsights, emailInsights, birthdayInsights] = await Promise.all([
        this.getMessageInsights(),
        this.getEmailInsights(),
        this.getBirthdayInsights()
      ]);

      const socialContext = {
        pendingFriendCheckins: this.identifyFriendCheckins(messageInsights),
        emailFollowups: this.identifyEmailFollowups(emailInsights),
        upcomingBirthdays: birthdayInsights,
        socialOpportunities: this.findSocialOpportunities(messageInsights, emailInsights),
        relationshipMaintenance: this.identifyRelationshipNeeds(messageInsights, emailInsights),
        socialBattery: this.calculateSocialBattery(messageInsights, emailInsights)
      };

      return socialContext;
    } catch (error) {
      console.error('Error getting social context:', error);
      // Return default social context if social data fails
      return {
        pendingFriendCheckins: [],
        emailFollowups: [],
        upcomingBirthdays: [],
        socialOpportunities: [],
        relationshipMaintenance: [],
        socialBattery: 'moderate'
      };
    }
  }

  /**
   * Get schedule context from calendar
   */
  async getScheduleContext() {
    try {
      // This would integrate with your calendar service
      // For now, return a basic schedule context
      return {
        busyDays: ['Monday morning', 'Wednesday evening'],
        freeBlocks: ['Tuesday 2-5pm', 'Thursday 10am-12pm', 'Saturday morning'],
        workingHours: '9am-5pm',
        preferredPlanningTime: 'evening',
        weekendAvailability: 'flexible'
      };
    } catch (error) {
      console.error('Error getting schedule context:', error);
      return {
        busyDays: [],
        freeBlocks: ['flexible'],
        workingHours: '9am-5pm',
        preferredPlanningTime: 'evening',
        weekendAvailability: 'flexible'
      };
    }
  }

  /**
   * Get life tasks context
   */
  async getLifeTasksContext() {
    try {
      // Basic life tasks that everyone needs
      const essentialTasks = [
        { task: 'Grocery shopping', frequency: 'weekly', duration: '1 hour' },
        { task: 'Meal prep', frequency: 'weekly', duration: '2 hours' },
        { task: 'Laundry', frequency: 'weekly', duration: '30 minutes' },
        { task: 'Cleaning', frequency: 'weekly', duration: '1 hour' },
        { task: 'Bills/admin', frequency: 'weekly', duration: '30 minutes' }
      ];

      return {
        essentialTasks,
        preferredTaskDays: ['Sunday', 'Saturday'],
        timePreference: 'morning',
        batchingPreference: 'group similar tasks'
      };
    } catch (error) {
      console.error('Error getting life tasks context:', error);
      return {
        essentialTasks: [],
        preferredTaskDays: ['weekend'],
        timePreference: 'flexible',
        batchingPreference: 'spread throughout week'
      };
    }
  }

  // Helper methods for energy analysis
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

  getOptimalWorkoutTimes(trends) {
    // Based on typical energy patterns
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

  identifyEnergyPeaks(trends) {
    // Standard energy peaks for most people
    return ['9am-11am', '2pm-4pm'];
  }

  // Helper methods for social analysis
  async getMessageInsights() {
    try {
      // This would integrate with your message service
      // For now, return mock insights
      return {
        unresponded: 2,
        recentContacts: ['John', 'Sarah', 'Mike'],
        lastContactDays: { 'John': 3, 'Sarah': 7, 'Mike': 14 },
        socialPlans: ['Dinner with Lisa Friday']
      };
    } catch (error) {
      return {
        unresponded: 0,
        recentContacts: [],
        lastContactDays: {},
        socialPlans: []
      };
    }
  }

  async getEmailInsights() {
    try {
      // This would integrate with your email service
      // For now, return mock insights
      return {
        personalEmails: 5,
        pendingResponses: 3,
        socialInvitations: ['Coffee meetup next week'],
        networkingOpportunities: ['Tech meetup invitation']
      };
    } catch (error) {
      return {
        personalEmails: 0,
        pendingResponses: 0,
        socialInvitations: [],
        networkingOpportunities: []
      };
    }
  }

  async getBirthdayInsights() {
    try {
      // This would integrate with your birthday service
      // For now, return mock insights
      return [
        { name: 'Alex', date: 'This Thursday', daysAway: 2 },
        { name: 'Maria', date: 'Next Monday', daysAway: 7 }
      ];
    } catch (error) {
      return [];
    }
  }

  // Social analysis helper methods
  identifyFriendCheckins(messageInsights) {
    const needsCheckin = [];
    
    Object.entries(messageInsights.lastContactDays || {}).forEach(([contact, days]) => {
      if (days > 7) {
        needsCheckin.push({
          contact,
          daysSinceContact: days,
          priority: days > 14 ? 'high' : 'medium',
          suggestion: `Text ${contact} to catch up`
        });
      }
    });

    return needsCheckin.slice(0, 5); // Limit to top 5
  }

  identifyEmailFollowups(emailInsights) {
    return emailInsights.pendingResponses > 0 ? [
      {
        count: emailInsights.pendingResponses,
        suggestion: `Respond to ${emailInsights.pendingResponses} pending personal emails`,
        priority: 'medium'
      }
    ] : [];
  }

  findSocialOpportunities(messageInsights, emailInsights) {
    const opportunities = [];
    
    // Add social plans from messages
    if (messageInsights.socialPlans) {
      opportunities.push(...messageInsights.socialPlans.map(plan => ({
        type: 'existing_plan',
        description: plan,
        priority: 'high'
      })));
    }

    // Add invitations from emails
    if (emailInsights.socialInvitations) {
      opportunities.push(...emailInsights.socialInvitations.map(invite => ({
        type: 'invitation',
        description: invite,
        priority: 'medium'
      })));
    }

    return opportunities.slice(0, 5); // Limit to top 5
  }

  identifyRelationshipNeeds(messageInsights, emailInsights) {
    const needs = [];
    
    // People who need check-ins
    const needsCheckin = this.identifyFriendCheckins(messageInsights);
    needs.push(...needsCheckin);

    return needs.slice(0, 3); // Limit to top 3
  }

  calculateSocialBattery(messageInsights, emailInsights) {
    const totalSocialLoad = (messageInsights.unresponded || 0) + (emailInsights.pendingResponses || 0);
    
    if (totalSocialLoad > 5) return 'drained';
    if (totalSocialLoad > 2) return 'moderate';
    return 'charged';
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