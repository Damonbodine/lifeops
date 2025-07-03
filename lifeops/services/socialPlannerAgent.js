const OpenAI = require('openai');
const SocialPlannerAggregator = require('./socialPlannerAggregator');
const UserGoalsInterview = require('./userGoalsInterview');

class SocialPlannerAgent {
  constructor(openaiApiKey) {
    this.openai = new OpenAI({ apiKey: openaiApiKey });
    this.aggregator = new SocialPlannerAggregator();
    this.interview = new UserGoalsInterview();
  }

  /**
   * Main entry point for social planning
   * Memory-efficient multi-step agentic flow
   */
  async generateWeeklyPlan(userResponses) {
    const startTime = Date.now();
    this.aggregator.logMemoryUsage('Social planning start');

    try {
      console.log('🌟 Starting social planning for user...');

      // Step 1: Process user interview responses
      const userProfile = await this.interview.processResponses(userResponses);
      console.log('✅ User profile processed');

      // Step 2: Gather context efficiently (memory-optimized)
      const context = await this.aggregator.gatherPlanningContext(userProfile);
      console.log('✅ Planning context gathered');
      this.aggregator.logMemoryUsage('After context gathering');

      // Step 3: Multi-agent planning flow
      const planningResults = await this.executePlanningFlow(context, userProfile);
      console.log('✅ Planning flow completed');

      // Step 4: Generate final integrated plan
      const finalPlan = await this.integratePlans(planningResults, context, userProfile);
      console.log('✅ Final plan generated');

      const endTime = Date.now();
      console.log(`🎯 Social planning completed in ${endTime - startTime}ms`);
      this.aggregator.logMemoryUsage('Social planning end');

      return finalPlan;
    } catch (error) {
      console.error('❌ Error in social planning:', error);
      this.aggregator.logMemoryUsage('Social planning error');
      throw error;
    }
  }

  /**
   * Execute the multi-agent planning flow
   * Each agent handles a specific domain with optimized context
   */
  async executePlanningFlow(context, userProfile) {
    try {
      // Run planning agents in parallel for efficiency
      const [socialPlan, healthPlan, lifeTasks] = await Promise.all([
        this.planSocialActivities(context, userProfile),
        this.planHealthActivities(context, userProfile),
        this.planLifeTasks(context, userProfile)
      ]);

      return {
        social: socialPlan,
        health: healthPlan,
        lifeTasks: lifeTasks
      };
    } catch (error) {
      console.error('Error in planning flow:', error);
      throw error;
    }
  }

  /**
   * Social Activities Planning Agent
   * Focuses on friend check-ins, birthdays, and social opportunities
   */
  async planSocialActivities(context, userProfile) {
    const prompt = `
You are a social planning assistant. Create specific, actionable social activities for this week.

USER PROFILE:
- Social personality: ${userProfile.insights?.socialPersonality || 'balanced'}
- Social energy: ${userProfile.preferences?.socialFrequency || 'moderate'}
- Relationship priorities: ${JSON.stringify(userProfile.preferences?.relationshipFocus || [])}
- Social style: ${JSON.stringify(userProfile.preferences?.socialStyle || [])}

SOCIAL CONTEXT:
- Pending friend check-ins: ${JSON.stringify(context.social?.pendingFriendCheckins || [])}
- Email follow-ups needed: ${JSON.stringify(context.social?.emailFollowups || [])}
- Upcoming birthdays: ${JSON.stringify(context.social?.upcomingBirthdays || [])}
- Social opportunities: ${JSON.stringify(context.social?.socialOpportunities || [])}
- Social battery status: ${context.social?.socialBattery || 'moderate'}

SCHEDULE CONTEXT:
- Free time blocks: ${JSON.stringify(context.schedule?.freeBlocks || [])}
- Energy peaks: ${JSON.stringify(context.energy?.energyPeaks || [])}

TASK: Create 3-5 specific social activities for this week including:
1. Friend check-ins that are overdue
2. Birthday celebrations or acknowledgments
3. Email responses that matter personally
4. New social opportunities to pursue
5. Relationship maintenance activities

For each activity, provide:
- Specific action (what to do)
- Suggested timing (when to do it)
- Priority level (high/medium/low)
- Estimated time needed

Format as a JSON array of activity objects.
    `;

    try {
      const response = await this.openai.chat.completions.create({
        model: "gpt-4",
        messages: [
          {
            role: "system",
            content: "You are a social planning assistant. Create realistic, personalized social activities based on user data. Return valid JSON only."
          },
          {
            role: "user",
            content: prompt
          }
        ],
        max_tokens: 800,
        temperature: 0.7
      });

      const socialActivities = this.parsePlanningResponse(response.choices[0].message.content, 'social');
      console.log('✅ Social activities planned:', socialActivities.length);
      return socialActivities;
    } catch (error) {
      console.error('Error planning social activities:', error);
      return this.getDefaultSocialPlan(context, userProfile);
    }
  }

  /**
   * Health Activities Planning Agent
   * Focuses on exercise, wellness, and physical activities
   */
  async planHealthActivities(context, userProfile) {
    const prompt = `
You are a fitness and wellness planning assistant. Create a personalized health plan for this week.

USER PROFILE:
- Exercise preference: ${userProfile.preferences?.exerciseType || 'flexible'}
- Energy timing: ${userProfile.preferences?.energyTiming || 'flexible'}
- Weekly goals: ${JSON.stringify(userProfile.preferences?.lifeFocus || [])}

HEALTH CONTEXT:
- Current energy level: ${context.energy?.currentEnergyLevel || 'moderate'}
- Optimal workout times: ${JSON.stringify(context.energy?.optimalWorkoutTimes || [])}
- Rest needs: ${context.energy?.restNeeds || 'moderate'}
- Weekly fitness goal: ${context.energy?.weeklyFitnessGoal || '3-4 workouts'}

SCHEDULE CONTEXT:
- Free time blocks: ${JSON.stringify(context.schedule?.freeBlocks || [])}
- Energy peaks: ${JSON.stringify(context.energy?.energyPeaks || [])}

TASK: Create 3-5 health and fitness activities for this week including:
1. Workout sessions based on preferences
2. Recovery and rest activities
3. Wellness activities (meditation, stretching)
4. Outdoor activities if preferred
5. Social fitness activities if preferred

For each activity, provide:
- Specific activity type and details
- Suggested timing and duration
- Intensity level (high/medium/low)
- Solo or social activity

Format as a JSON array of activity objects.
    `;

    try {
      const response = await this.openai.chat.completions.create({
        model: "gpt-4",
        messages: [
          {
            role: "system",
            content: "You are a fitness planning assistant. Create realistic, personalized workout schedules. Return valid JSON only."
          },
          {
            role: "user",
            content: prompt
          }
        ],
        max_tokens: 600,
        temperature: 0.7
      });

      const healthActivities = this.parsePlanningResponse(response.choices[0].message.content, 'health');
      console.log('✅ Health activities planned:', healthActivities.length);
      return healthActivities;
    } catch (error) {
      console.error('Error planning health activities:', error);
      return this.getDefaultHealthPlan(context, userProfile);
    }
  }

  /**
   * Life Tasks Planning Agent
   * Focuses on essential life maintenance tasks
   */
  async planLifeTasks(context, userProfile) {
    const prompt = `
You are a life management assistant. Create a realistic weekly plan for essential life tasks.

USER PROFILE:
- Life focus areas: ${JSON.stringify(userProfile.preferences?.lifeFocus || [])}
- Weekly goals: ${JSON.stringify(userProfile.raw?.weekly_goals || [])}
- Energy timing: ${userProfile.preferences?.energyTiming || 'flexible'}

TASK CONTEXT:
- Essential tasks: ${JSON.stringify(context.tasks?.essentialTasks || [])}
- Preferred task days: ${JSON.stringify(context.tasks?.preferredTaskDays || [])}
- Time preference: ${context.tasks?.timePreference || 'flexible'}

SCHEDULE CONTEXT:
- Free time blocks: ${JSON.stringify(context.schedule?.freeBlocks || [])}
- Energy level: ${context.energy?.currentEnergyLevel || 'moderate'}

TASK: Create 4-6 life management tasks for this week including:
1. Essential household tasks (cleaning, laundry)
2. Personal admin (bills, appointments)
3. Meal planning and preparation
4. Personal projects or organization
5. Self-care activities

For each task, provide:
- Specific task description
- Suggested timing and duration
- Priority level (high/medium/low)
- Can be batched with other tasks

Format as a JSON array of task objects.
    `;

    try {
      const response = await this.openai.chat.completions.create({
        model: "gpt-4",
        messages: [
          {
            role: "system",
            content: "You are a life management assistant. Create practical, achievable task schedules. Return valid JSON only."
          },
          {
            role: "user",
            content: prompt
          }
        ],
        max_tokens: 600,
        temperature: 0.7
      });

      const lifeTasks = this.parsePlanningResponse(response.choices[0].message.content, 'lifeTasks');
      console.log('✅ Life tasks planned:', lifeTasks.length);
      return lifeTasks;
    } catch (error) {
      console.error('Error planning life tasks:', error);
      return this.getDefaultLifeTasksPlan(context, userProfile);
    }
  }

  /**
   * Integration Agent
   * Combines all plans into a cohesive weekly schedule
   */
  async integratePlans(planningResults, context, userProfile) {
    const prompt = `
You are a master life planner. Integrate these separate plans into one cohesive, balanced weekly schedule.

SOCIAL ACTIVITIES:
${JSON.stringify(planningResults.social, null, 2)}

HEALTH ACTIVITIES:
${JSON.stringify(planningResults.health, null, 2)}

LIFE TASKS:
${JSON.stringify(planningResults.lifeTasks, null, 2)}

USER PREFERENCES:
- Energy timing: ${userProfile.preferences?.energyTiming || 'flexible'}
- Social frequency: ${userProfile.preferences?.socialFrequency || 'moderate'}
- Weekly goals: ${JSON.stringify(userProfile.raw?.weekly_goals || [])}

CONSTRAINTS:
- Free time blocks: ${JSON.stringify(context.schedule?.freeBlocks || [])}
- Energy peaks: ${JSON.stringify(context.energy?.energyPeaks || [])}
- Current energy level: ${context.energy?.currentEnergyLevel || 'moderate'}

TASK: Create a balanced weekly plan that:
1. Respects user's energy patterns and preferences
2. Balances social, health, and life management activities
3. Groups related activities when efficient
4. Provides specific day and time recommendations
5. Considers rest and recovery time

Return a comprehensive weekly plan with:
- Day-by-day schedule breakdown
- Morning, afternoon, evening time blocks
- Priority activities marked
- Buffer time for spontaneity
- Alternative options for flexibility

Format as a structured JSON object with days of the week.
    `;

    try {
      const response = await this.openai.chat.completions.create({
        model: "gpt-4",
        messages: [
          {
            role: "system",
            content: "You are a master life planner. Create balanced, realistic weekly schedules that integrate all life areas. Return valid JSON only."
          },
          {
            role: "user",
            content: prompt
          }
        ],
        max_tokens: 1200,
        temperature: 0.6
      });

      const integratedPlan = this.parseIntegratedPlan(response.choices[0].message.content);
      
      return {
        social: planningResults.social,
        health: planningResults.health,
        lifeTasks: planningResults.lifeTasks,
        schedule: integratedPlan,
        summary: this.generatePlanSummary(planningResults, userProfile),
        metadata: {
          createdAt: new Date().toISOString(),
          userProfile: userProfile.insights,
          planningDuration: 'weekly'
        }
      };
    } catch (error) {
      console.error('Error integrating plans:', error);
      return this.getDefaultIntegratedPlan(planningResults, userProfile);
    }
  }

  // Helper methods for parsing AI responses
  parsePlanningResponse(content, type) {
    try {
      // Try to parse as JSON first
      const jsonMatch = content.match(/\[[\s\S]*\]/);
      if (jsonMatch) {
        return JSON.parse(jsonMatch[0]);
      }
      
      // Fallback parsing for non-JSON responses
      return this.parseTextResponse(content, type);
    } catch (error) {
      console.error(`Error parsing ${type} response:`, error);
      return this.getDefaultPlan(type);
    }
  }

  parseTextResponse(content, type) {
    // Basic text parsing fallback
    const lines = content.split('\n').filter(line => line.trim());
    const activities = [];
    
    lines.forEach(line => {
      if (line.includes(':') && !line.startsWith('USER') && !line.startsWith('TASK')) {
        const parts = line.split(':');
        if (parts.length >= 2) {
          activities.push({
            title: parts[0].trim(),
            description: parts[1].trim(),
            time: 'flexible',
            priority: 'medium'
          });
        }
      }
    });

    return activities.slice(0, 5); // Limit to 5 activities
  }

  parseIntegratedPlan(content) {
    try {
      const jsonMatch = content.match(/\{[\s\S]*\}/);
      if (jsonMatch) {
        return JSON.parse(jsonMatch[0]);
      }
      
      return this.getDefaultWeeklySchedule();
    } catch (error) {
      console.error('Error parsing integrated plan:', error);
      return this.getDefaultWeeklySchedule();
    }
  }

  generatePlanSummary(planningResults, userProfile) {
    const totalActivities = 
      (planningResults.social?.length || 0) + 
      (planningResults.health?.length || 0) + 
      (planningResults.lifeTasks?.length || 0);

    return {
      totalActivities,
      socialActivities: planningResults.social?.length || 0,
      healthActivities: planningResults.health?.length || 0,
      lifeTasks: planningResults.lifeTasks?.length || 0,
      personalityType: userProfile.insights?.socialPersonality || 'balanced',
      focusAreas: userProfile.preferences?.lifeFocus?.slice(0, 3) || [],
      estimatedWeeklyCommitment: this.estimateTimeCommitment(planningResults)
    };
  }

  estimateTimeCommitment(planningResults) {
    // Rough estimate of time commitment
    const socialTime = (planningResults.social?.length || 0) * 1.5; // 1.5 hours per social activity
    const healthTime = (planningResults.health?.length || 0) * 1; // 1 hour per health activity
    const lifeTime = (planningResults.lifeTasks?.length || 0) * 0.75; // 45 minutes per life task
    
    const totalHours = socialTime + healthTime + lifeTime;
    return `${Math.round(totalHours)} hours per week`;
  }

  // Default fallback plans
  getDefaultSocialPlan(context, userProfile) {
    return [
      {
        title: "Check in with a close friend",
        description: "Send a text or call someone you haven't talked to recently",
        time: "Evening this week",
        priority: "medium"
      },
      {
        title: "Plan weekend social activity",
        description: "Reach out to friends for weekend plans",
        time: "Thursday evening",
        priority: "low"
      }
    ];
  }

  getDefaultHealthPlan(context, userProfile) {
    return [
      {
        title: "Morning workout",
        description: "30-minute exercise session",
        time: "Morning",
        intensity: "medium"
      },
      {
        title: "Evening walk",
        description: "20-minute relaxing walk",
        time: "Evening",
        intensity: "low"
      }
    ];
  }

  getDefaultLifeTasksPlan(context, userProfile) {
    return [
      {
        title: "Grocery shopping",
        description: "Weekly grocery run",
        time: "Weekend",
        priority: "high"
      },
      {
        title: "Tidy living space",
        description: "15-minute daily tidying",
        time: "Evening",
        priority: "medium"
      }
    ];
  }

  getDefaultIntegratedPlan(planningResults, userProfile) {
    return {
      social: planningResults.social || [],
      health: planningResults.health || [],
      lifeTasks: planningResults.lifeTasks || [],
      schedule: this.getDefaultWeeklySchedule(),
      summary: {
        totalActivities: 5,
        personalityType: 'balanced',
        focusAreas: ['balance'],
        estimatedWeeklyCommitment: '6 hours per week'
      }
    };
  }

  getDefaultWeeklySchedule() {
    return {
      monday: { morning: [], afternoon: [], evening: ["Plan the week"] },
      tuesday: { morning: ["Morning workout"], afternoon: [], evening: [] },
      wednesday: { morning: [], afternoon: [], evening: ["Check in with friend"] },
      thursday: { morning: [], afternoon: [], evening: ["Life tasks"] },
      friday: { morning: [], afternoon: [], evening: ["Social activity"] },
      saturday: { morning: ["Grocery shopping"], afternoon: [], evening: [] },
      sunday: { morning: [], afternoon: [], evening: ["Prep for next week"] }
    };
  }

  getDefaultPlan(type) {
    switch (type) {
      case 'social':
        return this.getDefaultSocialPlan();
      case 'health':
        return this.getDefaultHealthPlan();
      case 'lifeTasks':
        return this.getDefaultLifeTasksPlan();
      default:
        return [];
    }
  }
}

module.exports = SocialPlannerAgent;