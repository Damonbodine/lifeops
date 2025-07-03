class UserGoalsInterview {
  constructor() {
    this.interviewQuestions = [
      {
        id: 'social_energy',
        question: 'How social are you feeling this week?',
        type: 'scale',
        options: [
          'Low energy - prefer quiet activities and alone time',
          'Moderate - mix of social and alone time feels right', 
          'High energy - ready for lots of social interaction'
        ],
        weight: 'high'
      },
      {
        id: 'exercise_preference',
        question: 'What type of exercise motivates you most right now?',
        type: 'multiple_choice',
        options: [
          'Solo workouts (gym, running, yoga)',
          'Group fitness classes',
          'Outdoor activities (hiking, cycling)',
          'Sports with friends (tennis, basketball)',
          'Light movement (walking, stretching)'
        ],
        weight: 'high'
      },
      {
        id: 'relationship_priorities',
        question: 'Which relationships need attention this week?',
        type: 'checklist',
        options: [
          'Close friends',
          'Family members',
          'Professional network',
          'Romantic partner',
          'New connections',
          'Old friends I\'ve lost touch with'
        ],
        weight: 'medium'
      },
      {
        id: 'life_balance',
        question: 'What life areas need the most focus right now?',
        type: 'checklist',
        options: [
          'Health and fitness',
          'Home organization and cleaning',
          'Personal projects and hobbies',
          'Social connections',
          'Work-life balance',
          'Self-care and relaxation'
        ],
        weight: 'medium'
      },
      {
        id: 'weekly_goals',
        question: 'What would make this week feel successful to you?',
        type: 'checklist',
        options: [
          'Connecting with friends and family',
          'Staying consistent with health habits',
          'Getting caught up on life tasks',
          'Trying something new or fun',
          'Having quality alone time',
          'Being productive and organized'
        ],
        weight: 'high'
      },
      {
        id: 'energy_schedule',
        question: 'When do you typically have the most energy?',
        type: 'multiple_choice',
        options: [
          'Early morning (6-9am)',
          'Mid-morning (9am-12pm)',
          'Afternoon (12-5pm)',
          'Evening (5-8pm)',
          'Night (8pm+)',
          'It varies day to day'
        ],
        weight: 'medium'
      },
      {
        id: 'social_style',
        question: 'How do you prefer to socialize?',
        type: 'checklist',
        options: [
          'One-on-one conversations',
          'Small group gatherings (3-5 people)',
          'Larger parties or events',
          'Activity-based socializing (sports, games)',
          'Casual hangouts at home',
          'Going out (restaurants, bars, events)'
        ],
        weight: 'medium'
      }
    ];
  }

  /**
   * Get interview questions for the frontend
   */
  async getQuestions() {
    return {
      questions: this.interviewQuestions,
      totalSteps: this.interviewQuestions.length,
      estimatedTime: '3-5 minutes'
    };
  }

  /**
   * Process user responses and derive insights
   */
  async processResponses(responses) {
    try {
      const processedResponses = {
        raw: responses,
        insights: this.deriveInsights(responses),
        preferences: this.derivePreferences(responses),
        timestamp: new Date().toISOString()
      };

      return processedResponses;
    } catch (error) {
      console.error('Error processing interview responses:', error);
      throw error;
    }
  }

  /**
   * Derive insights from user responses
   */
  deriveInsights(responses) {
    const insights = {
      socialPersonality: this.analyzeSocialPersonality(responses),
      energyProfile: this.analyzeEnergyProfile(responses),
      priorityAreas: this.analyzePriorityAreas(responses),
      planningStyle: this.analyzePlanningStyle(responses)
    };

    return insights;
  }

  /**
   * Derive user preferences for planning
   */
  derivePreferences(responses) {
    const preferences = {
      socialFrequency: this.deriveSocialFrequency(responses),
      exerciseType: responses.exercise_preference || 'Solo workouts',
      relationshipFocus: responses.relationship_priorities || [],
      lifeFocus: responses.life_balance || [],
      energyTiming: responses.energy_schedule || 'Mid-morning (9am-12pm)',
      socialStyle: responses.social_style || []
    };

    return preferences;
  }

  // Analysis methods
  analyzeSocialPersonality(responses) {
    const socialEnergy = responses.social_energy || 'Moderate';
    const socialStyle = responses.social_style || [];
    
    if (socialEnergy.includes('High energy') || socialStyle.includes('Larger parties')) {
      return 'extroverted';
    } else if (socialEnergy.includes('Low energy') || socialStyle.includes('One-on-one')) {
      return 'introverted';
    }
    return 'ambivert';
  }

  analyzeEnergyProfile(responses) {
    const energyTiming = responses.energy_schedule || '';
    const exercisePreference = responses.exercise_preference || '';
    
    let profile = {
      peakTime: this.extractPeakTime(energyTiming),
      exerciseStyle: this.extractExerciseStyle(exercisePreference),
      socialEnergy: responses.social_energy || 'moderate'
    };

    return profile;
  }

  analyzePriorityAreas(responses) {
    const lifeFocus = responses.life_balance || [];
    const relationshipFocus = responses.relationship_priorities || [];
    const weeklyGoals = responses.weekly_goals || [];

    return {
      topLifeAreas: lifeFocus.slice(0, 3),
      topRelationships: relationshipFocus.slice(0, 3),
      primaryGoals: weeklyGoals.slice(0, 3)
    };
  }

  analyzePlanningStyle(responses) {
    const socialStyle = responses.social_style || [];
    const energyTiming = responses.energy_schedule || '';
    
    let style = {
      socialPreference: this.determineSocialPreference(socialStyle),
      planningTime: this.extractPeakTime(energyTiming),
      balanceType: this.determineBalanceType(responses)
    };

    return style;
  }

  // Helper methods
  extractPeakTime(energyTiming) {
    if (energyTiming.includes('Early morning')) return 'early_morning';
    if (energyTiming.includes('Mid-morning')) return 'morning';
    if (energyTiming.includes('Afternoon')) return 'afternoon';
    if (energyTiming.includes('Evening')) return 'evening';
    if (energyTiming.includes('Night')) return 'night';
    return 'flexible';
  }

  extractExerciseStyle(exercisePreference) {
    if (exercisePreference.includes('Solo')) return 'solo';
    if (exercisePreference.includes('Group')) return 'group';
    if (exercisePreference.includes('Outdoor')) return 'outdoor';
    if (exercisePreference.includes('Sports')) return 'social_sports';
    if (exercisePreference.includes('Light')) return 'low_intensity';
    return 'flexible';
  }

  determineSocialPreference(socialStyle) {
    if (socialStyle.includes('One-on-one')) return 'intimate';
    if (socialStyle.includes('Small group')) return 'small_group';
    if (socialStyle.includes('Larger parties')) return 'large_group';
    if (socialStyle.includes('Activity-based')) return 'activity_based';
    return 'flexible';
  }

  determineBalanceType(responses) {
    const lifeFocus = responses.life_balance || [];
    const weeklyGoals = responses.weekly_goals || [];
    
    if (lifeFocus.includes('Health and fitness') || weeklyGoals.includes('health habits')) {
      return 'health_focused';
    }
    if (lifeFocus.includes('Social connections') || weeklyGoals.includes('friends and family')) {
      return 'socially_focused';
    }
    if (lifeFocus.includes('Personal projects') || weeklyGoals.includes('productive')) {
      return 'productivity_focused';
    }
    return 'balanced';
  }

  deriveSocialFrequency(responses) {
    const socialEnergy = responses.social_energy || '';
    const relationshipPriorities = responses.relationship_priorities || [];
    
    if (socialEnergy.includes('High energy') || relationshipPriorities.length > 3) {
      return 'high';
    } else if (socialEnergy.includes('Low energy') || relationshipPriorities.length < 2) {
      return 'low';
    }
    return 'moderate';
  }

  /**
   * Validate interview responses
   */
  validateResponses(responses) {
    const errors = [];
    
    // Check that all required questions are answered
    const requiredQuestions = this.interviewQuestions.filter(q => q.weight === 'high');
    
    for (const question of requiredQuestions) {
      if (!responses[question.id]) {
        errors.push(`Please answer: ${question.question}`);
      }
    }

    return {
      isValid: errors.length === 0,
      errors
    };
  }

  /**
   * Generate summary of user preferences for AI planning
   */
  generateUserProfileSummary(responses) {
    const insights = this.deriveInsights(responses);
    const preferences = this.derivePreferences(responses);
    
    const summary = {
      socialPersonality: insights.socialPersonality,
      energyProfile: `Peak energy: ${insights.energyProfile.peakTime}, Exercise style: ${insights.energyProfile.exerciseStyle}`,
      priorities: {
        life: preferences.lifeFocus.slice(0, 2),
        relationships: preferences.relationshipFocus.slice(0, 2),
        goals: responses.weekly_goals ? responses.weekly_goals.slice(0, 2) : []
      },
      planningStyle: insights.planningStyle,
      socialFrequency: preferences.socialFrequency
    };

    return summary;
  }
}

module.exports = UserGoalsInterview;