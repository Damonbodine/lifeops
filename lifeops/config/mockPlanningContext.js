/**
 * Mock Planning Context Data
 * Contains mock data and constants for planning context when real data is unavailable
 */

class MockPlanningContext {
  /**
   * Generate mock energy profile
   */
  static generateEnergyProfile() {
    // Mock health data based on typical patterns
    const mockEnergyProfile = {
      currentEnergyLevel: 'moderate',
      optimalWorkoutTimes: ['morning', 'afternoon'],
      restNeeds: 'moderate - balance activity and rest',
      weeklyFitnessGoal: '3-4 moderate workouts per week',
      energyPeaks: ['9am-11am', '2pm-4pm'],
      mockData: true
    };

    // Add some randomization to make it feel more personalized
    const energyLevels = ['low', 'moderate', 'high'];
    const randomEnergy = energyLevels[Math.floor(Math.random() * energyLevels.length)];
    mockEnergyProfile.currentEnergyLevel = randomEnergy;

    // Adjust other fields based on energy level
    if (randomEnergy === 'high') {
      mockEnergyProfile.weeklyFitnessGoal = '4-5 workouts per week';
      mockEnergyProfile.restNeeds = 'low - maintain current pace';
    } else if (randomEnergy === 'low') {
      mockEnergyProfile.weeklyFitnessGoal = '2-3 light workouts per week';
      mockEnergyProfile.restNeeds = 'high - prioritize recovery';
    }

    return mockEnergyProfile;
  }

  /**
   * Fallback energy profile if even mock data fails
   */
  static getFallbackEnergyProfile() {
    return {
      currentEnergyLevel: 'moderate',
      optimalWorkoutTimes: ['morning', 'afternoon'],
      restNeeds: 'moderate',
      weeklyFitnessGoal: '3-4 workouts',
      energyPeaks: ['9am-11am', '2pm-4pm'],
      mockData: true,
      fallback: true
    };
  }

  /**
   * Default social context
   */
  static getDefaultSocialContext() {
    return {
      pendingFriendCheckins: [],
      emailFollowups: [],
      upcomingBirthdays: [],
      socialOpportunities: [],
      relationshipMaintenance: [],
      socialBattery: 'moderate'
    };
  }

  /**
   * Default schedule context
   */
  static getDefaultScheduleContext() {
    return {
      busyDays: ['Monday morning', 'Wednesday evening'],
      freeBlocks: ['Tuesday 2-5pm', 'Thursday 10am-12pm', 'Saturday morning'],
      workingHours: '9am-5pm',
      preferredPlanningTime: 'evening',
      weekendAvailability: 'flexible'
    };
  }

  /**
   * Fallback schedule context
   */
  static getFallbackScheduleContext() {
    return {
      busyDays: [],
      freeBlocks: ['flexible'],
      workingHours: '9am-5pm',
      preferredPlanningTime: 'evening',
      weekendAvailability: 'flexible'
    };
  }

  /**
   * Essential life tasks
   */
  static getEssentialTasks() {
    return [
      { task: 'Grocery shopping', frequency: 'weekly', duration: '1 hour' },
      { task: 'Meal prep', frequency: 'weekly', duration: '2 hours' },
      { task: 'Laundry', frequency: 'weekly', duration: '30 minutes' },
      { task: 'Cleaning', frequency: 'weekly', duration: '1 hour' },
      { task: 'Bills/admin', frequency: 'weekly', duration: '30 minutes' }
    ];
  }

  /**
   * Default tasks context
   */
  static getDefaultTasksContext() {
    return {
      essentialTasks: this.getEssentialTasks(),
      preferredTaskDays: ['Sunday', 'Saturday'],
      timePreference: 'morning',
      batchingPreference: 'group similar tasks'
    };
  }

  /**
   * Fallback tasks context
   */
  static getFallbackTasksContext() {
    return {
      essentialTasks: [],
      preferredTaskDays: ['weekend'],
      timePreference: 'flexible',
      batchingPreference: 'spread throughout week'
    };
  }

  /**
   * Common last names for name expansion
   */
  static getCommonLastNames() {
    return [
      'Smith', 'Johnson', 'Williams', 'Brown', 'Jones', 'Garcia', 'Miller', 'Davis',
      'Rodriguez', 'Martinez', 'Hernandez', 'Lopez', 'Gonzalez', 'Wilson', 'Anderson',
      'Thomas', 'Taylor', 'Moore', 'Jackson', 'Martin', 'Lee', 'Thompson', 'White',
      'Harris', 'Clark', 'Lewis', 'Robinson', 'Walker', 'Young', 'Allen', 'King',
      'Wright', 'Scott', 'Torres', 'Nguyen', 'Hill', 'Flores', 'Green', 'Adams',
      'Nelson', 'Baker', 'Hall', 'Rivera', 'Campbell', 'Mitchell', 'Carter', 'Roberts'
    ];
  }

  /**
   * Common first names for name expansion
   */
  static getCommonFirstNames() {
    return [
      'John', 'Jane', 'Mike', 'Sarah', 'Alex', 'Lisa', 'David', 'Emily', 'Chris', 'Amy',
      'Tom', 'Anna', 'Mark', 'Jessica', 'Steve', 'Michelle', 'Paul', 'Linda', 'Kevin', 'Susan',
      'Ryan', 'Karen', 'Matt', 'Nancy', 'Brian', 'Betty', 'Daniel', 'Helen', 'Andrew', 'Sandra'
    ];
  }
}

module.exports = MockPlanningContext;
