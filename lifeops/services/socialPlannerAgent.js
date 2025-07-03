const OpenAI = require('openai');
const { GoogleGenerativeAI } = require('@google/generative-ai');
const { ChatAnthropic } = require('@langchain/anthropic');
const { HumanMessage, SystemMessage } = require('@langchain/core/messages');
const SocialPlannerAggregator = require('./socialPlannerAggregator');
const UserGoalsInterview = require('./userGoalsInterview');

class SocialPlannerAgent {
  constructor(apiKeys = {}) {
    // Initialize multiple LLM providers for different agents
    this.openai = apiKeys.openai ? new OpenAI({ apiKey: apiKeys.openai }) : null;
    this.google = apiKeys.google ? new GoogleGenerativeAI(apiKeys.google) : null;
    this.anthropic = apiKeys.anthropic ? new ChatAnthropic({ 
      apiKey: apiKeys.anthropic,
      modelName: 'claude-3-haiku-20240307', // Fast model
      temperature: 0.7
    }) : null;
    
    this.aggregator = new SocialPlannerAggregator();
    this.interview = new UserGoalsInterview();
    
    console.log('🤖 Multi-LLM Social Planner initialized:', {
      openai: !!this.openai,
      google: !!this.google, 
      anthropic: !!this.anthropic
    });
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
   * Social Activities Planning Agent - Using Google Gemini for fast response
   * Focuses on friend check-ins, birthdays, and social opportunities
   */
  async planSocialActivities(context, userProfile) {
    const prompt = `You are a social planning assistant. Create 3-5 specific social activities for this week using REAL contact names and relationships.

CRITICAL RULES:
- ONLY suggest activities for contacts with REAL NAMES (full names like "John Smith", not phone numbers)
- NEVER suggest vague activities like "Text Contact 8155" or activities with phone numbers
- Focus ONLY on people with clearly identifiable full names
- Be specific about the type of interaction (text, call, in-person meetup, etc.)
- If no real contacts are available, suggest general social activities instead

USER PROFILE:
- Social energy: ${userProfile.preferences?.socialFrequency || 'moderate'}
- Relationship priorities: ${JSON.stringify(userProfile.preferences?.relationshipFocus || [])}

SOCIAL CONTEXT (RESOLVED CONTACTS ONLY):
- Friend check-ins needed: ${JSON.stringify(context.social?.pendingFriendCheckins || [])}
- Upcoming birthdays: ${JSON.stringify(context.social?.upcomingBirthdays || [])}
- Social opportunities: ${JSON.stringify(context.social?.socialOpportunities || [])}

GOOD EXAMPLES:
1. "Text John Smith to catch up" (Priority: medium, Time: Tuesday evening, Description: Ask about his new job and weekend plans)
2. "Plan birthday celebration for Sarah Johnson" (Priority: high, Time: This Thursday, Description: Organize dinner with 3-4 mutual friends)
3. "Call Mike Wilson about coffee meetup" (Priority: medium, Time: Wednesday afternoon, Description: Follow up on weekend plans discussion)

BAD EXAMPLES (DO NOT CREATE):
❌ "Text Contact 8155" 
❌ "Call +1234567890"
❌ "Message (555) 123-4567"

If you don't have enough real contact names, suggest general social activities like:
- "Join a local meetup group"
- "Reach out to an old college friend"
- "Schedule a video call with family"

Return as JSON array with title, description, time, priority fields.`;

    try {
      if (!this.google) {
        throw new Error('Google API not available');
      }

      // Use Google Gemini for fast social planning
      const model = this.google.getGenerativeModel({ model: 'gemini-1.5-flash' });
      
      const startTime = Date.now();
      const result = await Promise.race([
        model.generateContent(prompt),
        new Promise((_, reject) => setTimeout(() => reject(new Error('Timeout')), 10000)) // 10s timeout
      ]);
      
      const response = await result.response;
      const text = response.text();
      const duration = Date.now() - startTime;
      
      console.log(`✅ Google Gemini social planning completed in ${duration}ms`);
      
      const socialActivities = this.parsePlanningResponse(text, 'social');
      return socialActivities;
      
    } catch (error) {
      console.error('Error with Google Gemini, using fallback:', error.message);
      return this.getDefaultSocialPlan(context, userProfile);
    }
  }

  /**
   * Health Activities Planning Agent - Using Anthropic Claude for health expertise
   * Focuses on exercise, wellness, and physical activities
   */
  async planHealthActivities(context, userProfile) {
    const prompt = `Create 3-4 health and fitness activities for this week based on:

USER PROFILE:
- Exercise preference: ${userProfile.preferences?.exerciseType || 'Solo workouts'}
- Energy level: ${context.energy?.currentEnergyLevel || 'moderate'}
- Fitness goal: ${context.energy?.weeklyFitnessGoal || '3-4 workouts'}

Create activities like:
1. "Morning run" (Duration: 30 min, Intensity: medium, Time: Tuesday 7am)
2. "Yoga session" (Duration: 45 min, Intensity: low, Time: Sunday evening)

Return as JSON array with title, duration, intensity, time fields.`;

    try {
      if (!this.anthropic) {
        throw new Error('Anthropic API not available');
      }

      const startTime = Date.now();
      const messages = [
        new SystemMessage("You are a fitness planning assistant. Create realistic workout schedules. Return only valid JSON."),
        new HumanMessage(prompt)
      ];
      
      const result = await Promise.race([
        this.anthropic.invoke(messages),
        new Promise((_, reject) => setTimeout(() => reject(new Error('Timeout')), 8000)) // 8s timeout
      ]);
      
      const duration = Date.now() - startTime;
      console.log(`✅ Anthropic Claude health planning completed in ${duration}ms`);
      
      const healthActivities = this.parsePlanningResponse(result.content, 'health');
      return healthActivities;
      
    } catch (error) {
      console.error('Error with Anthropic Claude, using fallback:', error.message);
      return this.getDefaultHealthPlan(context, userProfile);
    }
  }

  /**
   * Life Tasks Planning Agent - Using OpenAI for detailed task planning
   * Focuses on essential life maintenance tasks
   */
  async planLifeTasks(context, userProfile) {
    const prompt = `Create 4-5 essential life tasks for this week:

USER PROFILE:
- Life focus: ${JSON.stringify(userProfile.preferences?.lifeFocus || [])}
- Energy level: ${context.energy?.currentEnergyLevel || 'moderate'}

Create tasks like:
1. "Grocery shopping" (Duration: 1 hour, Priority: high, Time: Saturday morning)
2. "Laundry" (Duration: 30 min, Priority: medium, Time: Sunday)

Return as JSON array with title, duration, priority, time fields.`;

    try {
      if (!this.openai) {
        throw new Error('OpenAI API not available');
      }

      const startTime = Date.now();
      const response = await Promise.race([
        this.openai.chat.completions.create({
          model: "gpt-3.5-turbo", // Faster model
          messages: [
            {
              role: "system",
              content: "You are a life management assistant. Return only valid JSON."
            },
            {
              role: "user",
              content: prompt
            }
          ],
          max_tokens: 400,
          temperature: 0.5
        }),
        new Promise((_, reject) => setTimeout(() => reject(new Error('Timeout')), 8000)) // 8s timeout
      ]);

      const duration = Date.now() - startTime;
      console.log(`✅ OpenAI life tasks planning completed in ${duration}ms`);
      
      const lifeTasks = this.parsePlanningResponse(response.choices[0].message.content, 'lifeTasks');
      return lifeTasks;
      
    } catch (error) {
      console.error('Error with OpenAI, using fallback:', error.message);
      return this.getDefaultLifeTasksPlan(context, userProfile);
    }
  }

  /**
   * Integration Agent - Simple combination without additional AI call
   * Combines all plans into a cohesive weekly schedule
   */
  async integratePlans(planningResults, context, userProfile) {
    try {
      console.log('🔗 Integrating plans without additional AI call...');
      
      // Simple schedule organization by day
      const weeklySchedule = {
        monday: { morning: [], afternoon: [], evening: [] },
        tuesday: { morning: [], afternoon: [], evening: [] },
        wednesday: { morning: [], afternoon: [], evening: [] },
        thursday: { morning: [], afternoon: [], evening: [] },
        friday: { morning: [], afternoon: [], evening: [] },
        saturday: { morning: [], afternoon: [], evening: [] },
        sunday: { morning: [], afternoon: [], evening: [] }
      };

      // Distribute activities across the week
      const allActivities = [
        ...(planningResults.social || []).map(a => ({...a, type: 'social'})),
        ...(planningResults.health || []).map(a => ({...a, type: 'health'})),
        ...(planningResults.lifeTasks || []).map(a => ({...a, type: 'life'}))
      ];

      // Simple distribution logic
      const days = Object.keys(weeklySchedule);
      allActivities.forEach((activity, index) => {
        const dayIndex = index % days.length;
        const day = days[dayIndex];
        const timeOfDay = activity.time?.includes('morning') ? 'morning' : 
                         activity.time?.includes('evening') ? 'evening' : 'afternoon';
        
        weeklySchedule[day][timeOfDay].push(activity);
      });

      return {
        social: planningResults.social,
        health: planningResults.health,
        lifeTasks: planningResults.lifeTasks,
        schedule: weeklySchedule,
        summary: this.generatePlanSummary(planningResults, userProfile),
        metadata: {
          createdAt: new Date().toISOString(),
          userProfile: userProfile.insights,
          planningDuration: 'weekly',
          providers: ['google-gemini', 'anthropic-claude', 'openai'],
          processingTime: 'fast'
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