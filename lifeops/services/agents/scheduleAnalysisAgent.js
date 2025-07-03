const { ChatOpenAI } = require('@langchain/openai');
const { ChatGoogleGenerativeAI } = require('@langchain/google-genai');
const { HumanMessage, SystemMessage } = require('@langchain/core/messages');

/**
 * ScheduleAnalysisAgent - Specialized agent for analyzing productivity patterns and optimal timing
 * Determines best times for different types of work based on data and user preferences
 */
class ScheduleAnalysisAgent {
  constructor() {
    // Temporarily use GPT-3.5 for reliable operation, with data summarization
    this.llm = new ChatOpenAI({
      apiKey: process.env.OPENAI_API_KEY,
      modelName: 'gpt-3.5-turbo-16k', // Use 16k context model for more data
      temperature: 0.3,
    });
    console.log('🧠 ScheduleAnalysisAgent initialized with OpenAI GPT-3.5-turbo-16k');

    // Analysis patterns and algorithms
    this.analysisFrameworks = {
      energy: 'circadian-rhythm-optimization',
      productivity: 'peak-performance-scheduling',
      health: 'wellness-integrated-planning',
      behavioral: 'pattern-recognition-analysis'
    };

    // Time slot categories for optimization
    this.timeSlotTypes = {
      deepWork: { duration: [90, 120], energyRequired: 'high', interruptions: 'none' },
      collaboration: { duration: [30, 60], energyRequired: 'medium', interruptions: 'acceptable' },
      admin: { duration: [15, 45], energyRequired: 'low', interruptions: 'tolerable' },
      creative: { duration: [60, 90], energyRequired: 'medium-high', interruptions: 'minimal' },
      communication: { duration: [15, 30], energyRequired: 'low-medium', interruptions: 'acceptable' }
    };

    console.log('🧠 ScheduleAnalysisAgent initialized');
  }

  /**
   * Perform comprehensive scheduling analysis
   */
  async analyzeSchedulingPatterns(collectedData, userPreferences, options = {}) {
    try {
      console.log('🧠 Analyzing scheduling patterns and optimal timing...');
      
      const {
        analysisDepth = 'comprehensive',
        focusAreas = ['energy', 'productivity', 'health'],
        timeHorizon = 'today'
      } = options;

      // Run multiple analysis frameworks in parallel
      const analysisPromises = [
        this.analyzeEnergyPatterns(collectedData, userPreferences),
        this.analyzeProductivityPatterns(collectedData, userPreferences),
        this.analyzeHealthBasedTiming(collectedData, userPreferences),
        this.analyzeCalendarOptimization(collectedData),
        this.analyzeEmailProcessingTiming(collectedData),
        this.analyzeFocusBlockOpportunities(collectedData, userPreferences)
      ];

      const results = await Promise.allSettled(analysisPromises);
      
      // Synthesize all analyses into comprehensive recommendations
      const synthesizedAnalysis = await this.synthesizeAnalyses(results, userPreferences);
      
      return {
        success: true,
        timestamp: new Date(),
        analysisResults: {
          energyAnalysis: results[0].status === 'fulfilled' ? results[0].value : null,
          productivityAnalysis: results[1].status === 'fulfilled' ? results[1].value : null,
          healthAnalysis: results[2].status === 'fulfilled' ? results[2].value : null,
          calendarAnalysis: results[3].status === 'fulfilled' ? results[3].value : null,
          emailAnalysis: results[4].status === 'fulfilled' ? results[4].value : null,
          focusAnalysis: results[5].status === 'fulfilled' ? results[5].value : null
        },
        synthesizedRecommendations: synthesizedAnalysis,
        optimalSchedulingWindow: this.determineOptimalWindow(synthesizedAnalysis),
        conflictResolution: this.identifyConflicts(synthesizedAnalysis),
        adaptationSuggestions: this.generateAdaptationSuggestions(synthesizedAnalysis)
      };
    } catch (error) {
      console.error('❌ Schedule analysis error:', error);
      return {
        success: false,
        error: error.message,
        fallbackRecommendations: this.generateFallbackRecommendations()
      };
    }
  }

  /**
   * Analyze energy patterns for optimal work timing
   */
  async analyzeEnergyPatterns(collectedData, userPreferences) {
    const energyPrompt = `Analyze energy patterns and determine optimal timing for different types of work.

User Energy Profile:
${JSON.stringify(userPreferences.todaysProfile?.energyProfile, null, 2)}

Health Data:
${JSON.stringify(collectedData.health?.brief, null, 2)}

User Preferences:
- Energy Level: ${userPreferences.todaysProfile?.energyProfile?.level || 'unknown'}/10
- Peak Times: ${userPreferences.todaysProfile?.energyProfile?.peakTimes?.join(', ') || 'not specified'}
- Health Considerations: ${userPreferences.todaysProfile?.energyProfile?.healthConsiderations || 'none specified'}

Current Time: ${new Date().toLocaleString()}

Analyze and provide energy-based scheduling recommendations:

Respond in JSON format:
{
  "energyProfile": {
    "currentLevel": 1-10,
    "peakPeriods": [
      {"start": "09:00", "end": "11:00", "energyLevel": "high", "suitableFor": ["deep work", "complex problem solving"]},
      {"start": "14:00", "end": "16:00", "energyLevel": "medium-high", "suitableFor": ["meetings", "collaborative work"]}
    ],
    "lowEnergyPeriods": [
      {"start": "13:00", "end": "14:00", "energyLevel": "low", "suitableFor": ["admin tasks", "email processing"]}
    ]
  },
  "recommendations": {
    "deepWorkOptimal": ["09:00-11:00", "15:00-17:00"],
    "meetingsOptimal": ["10:00-12:00", "14:00-16:00"],
    "adminOptimal": ["13:00-14:00", "16:00-17:00"],
    "breaksRecommended": ["11:00-11:15", "15:00-15:15"]
  },
  "healthConsiderations": {
    "energyBoostingActivities": ["short walk", "hydration", "stretching"],
    "stressManagement": "recommendations based on current stress level",
    "optimalBreakTiming": "based on energy dips"
  }
}`;

    try {
      const response = await this.llm.invoke([
        new SystemMessage('You are an expert in circadian rhythm optimization and energy-based productivity scheduling.'),
        new HumanMessage(energyPrompt)
      ]);

      return JSON.parse(response.content);
    } catch (error) {
      console.error('❌ Energy analysis error:', error);
      return this.getFallbackEnergyAnalysis();
    }
  }

  /**
   * Analyze productivity patterns and optimal work blocks
   */
  async analyzeProductivityPatterns(collectedData, userPreferences) {
    const productivityPrompt = `Analyze productivity patterns and determine optimal work block scheduling.

User Work Style:
${JSON.stringify(userPreferences.todaysProfile?.workStyle, null, 2)}

User Priorities:
${JSON.stringify(userPreferences.todaysProfile?.priorities, null, 2)}

Calendar Data:
- Scheduled Events: ${collectedData.calendar?.totalEvents || 0}
- Free Time Available: ${collectedData.calendar?.freeTime || 'unknown'} minutes
- Next Event: ${collectedData.calendar?.nextEvent?.summary || 'none'}

Email Data:
- Urgent Emails: ${collectedData.emails?.byUrgency?.high || 0}
- Response Time Needed: ${collectedData.emails?.estimatedResponseTime || 0} minutes

Analyze and provide productivity-optimized recommendations:

Respond in JSON format:
{
  "workBlockRecommendations": {
    "deepFocusBlocks": [
      {
        "duration": 90,
        "optimalTiming": ["09:00-10:30", "15:00-16:30"],
        "taskTypes": ["complex problem solving", "creative work"],
        "interruptionProtection": "strict"
      }
    ],
    "collaborativeBlocks": [
      {
        "duration": 60,
        "optimalTiming": ["10:30-11:30", "14:00-15:00"],
        "taskTypes": ["meetings", "team discussions"],
        "flexibilityLevel": "medium"
      }
    ],
    "adminBlocks": [
      {
        "duration": 30,
        "optimalTiming": ["11:30-12:00", "16:30-17:00"],
        "taskTypes": ["email processing", "documentation"],
        "multitaskingAllowed": true
      }
    ]
  },
  "taskPrioritization": {
    "highPrioritySlots": ["09:00-11:00", "14:00-16:00"],
    "mediumPrioritySlots": ["11:00-12:00", "16:00-17:00"],
    "lowPrioritySlots": ["13:00-14:00", "17:00-18:00"]
  },
  "contextSwitchingOptimization": {
    "batchingSuggestions": ["Group similar tasks together", "Process emails in dedicated blocks"],
    "transitionTime": "5-10 minutes between different task types",
    "protectedFocusTime": "90-minute blocks without interruptions"
  }
}`;

    try {
      const response = await this.llm.invoke([
        new SystemMessage('You are an expert in productivity optimization and deep work scheduling methodologies.'),
        new HumanMessage(productivityPrompt)
      ]);

      return JSON.parse(response.content);
    } catch (error) {
      console.error('❌ Productivity analysis error:', error);
      return this.getFallbackProductivityAnalysis();
    }
  }

  /**
   * Analyze health-based timing recommendations
   */
  async analyzeHealthBasedTiming(collectedData, userPreferences) {
    // Extract only summary data to avoid token limits
    const healthSummary = {
      brief: collectedData.health?.brief || 'No health brief available',
      energyRecommendations: collectedData.health?.energyRecommendations || {},
      optimalWorkTimes: collectedData.health?.optimalWorkTimes || {},
      recoveryStatus: collectedData.health?.recoveryStatus || {}
    };

    const healthPrompt = `Analyze health data to provide wellness-integrated scheduling recommendations.

Health Summary:
${JSON.stringify(healthSummary, null, 2)}

User Mood and Stress:
${JSON.stringify(userPreferences.todaysProfile?.moodFactors, null, 2)}

Provide health-optimized scheduling recommendations:

Respond in JSON format:
{
  "wellnessIntegration": {
    "movementBreaks": [
      {"time": "10:00", "activity": "5-minute stretch", "purpose": "prevent stiffness"},
      {"time": "14:00", "activity": "short walk", "purpose": "boost afternoon energy"}
    ],
    "hydrationReminders": ["09:30", "11:30", "15:30"],
    "eyeRestBreaks": "every 90 minutes during screen work"
  },
  "stressManagement": {
    "highStressPeriods": "identify times to avoid challenging tasks",
    "recoveryActivities": ["breathing exercises", "brief meditation"],
    "stressBuffers": "built-in time cushions around demanding tasks"
  },
  "energyOptimization": {
    "naturalEnergyPeaks": "align demanding work with circadian highs",
    "energyRestoration": "schedule restorative activities during dips",
    "sustainabilityFocus": "prevent burnout through balanced scheduling"
  }
}`;

    try {
      const response = await this.llm.invoke([
        new SystemMessage('You are an expert in wellness-integrated productivity and health-conscious scheduling.'),
        new HumanMessage(healthPrompt)
      ]);

      return JSON.parse(response.content);
    } catch (error) {
      console.error('❌ Health analysis error:', error);
      return this.getFallbackHealthAnalysis();
    }
  }

  /**
   * Analyze calendar optimization opportunities
   */
  async analyzeCalendarOptimization(collectedData) {
    if (!collectedData.calendar) {
      return { message: 'No calendar data available for optimization' };
    }

    const calendarPrompt = `Analyze calendar data to identify optimization opportunities.

Calendar Events:
${JSON.stringify(collectedData.calendar.events, null, 2)}

Free Time Slots:
${JSON.stringify(collectedData.calendar.freeSlots, null, 2)}

Conflicts:
${JSON.stringify(collectedData.calendar.conflicts, null, 2)}

Provide calendar optimization recommendations:

Respond in JSON format:
{
  "optimizationOpportunities": {
    "meetingConsolidation": "suggestions to batch meetings",
    "bufferTimeNeeded": "recommended prep and transition times",
    "freeSlotUtilization": "how to best use available time slots"
  },
  "conflictResolution": {
    "identifiedConflicts": ["list of scheduling conflicts"],
    "resolutionSuggestions": ["specific recommendations for each conflict"],
    "priorityGuidance": "which events to prioritize in case of conflicts"
  },
  "improvementSuggestions": {
    "meetingEfficiency": "recommendations for more effective meetings",
    "travelTimeConsiderations": "buffer time for travel between locations",
    "preparationScheduling": "when to schedule meeting preparation time"
  }
}`;

    try {
      const response = await this.llm.invoke([
        new SystemMessage('You are an expert in calendar management and meeting optimization.'),
        new HumanMessage(calendarPrompt)
      ]);

      return JSON.parse(response.content);
    } catch (error) {
      console.error('❌ Calendar analysis error:', error);
      return { optimizationOpportunities: {}, conflictResolution: {}, improvementSuggestions: {} };
    }
  }

  /**
   * Analyze optimal email processing timing
   */
  async analyzeEmailProcessingTiming(collectedData) {
    if (!collectedData.emails) {
      return { message: 'No email data available for timing analysis' };
    }

    const emailPrompt = `Analyze email data to determine optimal processing times and strategies.

Email Overview:
- Total Emails: ${collectedData.emails.total}
- Urgent Emails: ${collectedData.emails.byUrgency?.high || 0}
- Estimated Response Time: ${collectedData.emails.estimatedResponseTime} minutes

Email Categories:
${JSON.stringify(collectedData.emails.byCategory, null, 2)}

Provide email processing optimization:

Respond in JSON format:
{
  "processingSchedule": {
    "urgentEmailSlot": {
      "timing": "within first 2 hours of day",
      "duration": "15-20 minutes",
      "frequency": "check every 2 hours"
    },
    "routineEmailSlots": [
      {"time": "11:00", "duration": "20 minutes", "purpose": "morning catch-up"},
      {"time": "15:00", "duration": "15 minutes", "purpose": "afternoon check"},
      {"time": "17:00", "duration": "25 minutes", "purpose": "end-of-day processing"}
    ]
  },
  "batchingStrategy": {
    "groupByPriority": "process urgent emails first",
    "groupByType": "batch similar types of responses",
    "timeBoxing": "strict time limits for email processing"
  },
  "protectedFocusTime": {
    "emailFreeBlocks": ["09:00-11:00", "14:00-15:00"],
    "notificationManagement": "disable during deep work",
    "emergencyExceptions": "criteria for urgent interruptions"
  }
}`;

    try {
      const response = await this.llm.invoke([
        new SystemMessage('You are an expert in email management and communication optimization.'),
        new HumanMessage(emailPrompt)
      ]);

      return JSON.parse(response.content);
    } catch (error) {
      console.error('❌ Email analysis error:', error);
      return { processingSchedule: {}, batchingStrategy: {}, protectedFocusTime: {} };
    }
  }

  /**
   * Analyze focus block opportunities
   */
  async analyzeFocusBlockOpportunities(collectedData, userPreferences) {
    const focusPrompt = `Analyze available time and user preferences to identify optimal focus block opportunities.

Available Free Time:
${JSON.stringify(collectedData.calendar?.freeSlots, null, 2)}

User Work Style:
${JSON.stringify(userPreferences.todaysProfile?.workStyle, null, 2)}

User Priorities:
${JSON.stringify(userPreferences.todaysProfile?.priorities, null, 2)}

Identify and recommend focus block scheduling:

Respond in JSON format:
{
  "focusBlockOpportunities": [
    {
      "startTime": "09:00",
      "endTime": "10:30",
      "duration": 90,
      "energyAlignment": "high energy period",
      "suitableFor": ["complex problem solving", "creative work"],
      "interruptionRisk": "low",
      "recommendations": "ideal for most demanding priority task"
    }
  ],
  "focusBlockTypes": {
    "deepWork": {
      "optimalDuration": "90-120 minutes",
      "prerequisites": "eliminate all distractions",
      "bestTiming": "during peak energy periods"
    },
    "creativeWork": {
      "optimalDuration": "60-90 minutes", 
      "prerequisites": "inspiring environment",
      "bestTiming": "when mentally fresh"
    },
    "problemSolving": {
      "optimalDuration": "45-90 minutes",
      "prerequisites": "quiet environment",
      "bestTiming": "high energy and focus periods"
    }
  },
  "protectionStrategies": {
    "distractionElimination": ["turn off notifications", "use focus apps"],
    "environmentSetup": ["quiet space", "necessary materials ready"],
    "timeBoxing": "strict start and end times with buffers"
  }
}`;

    try {
      const response = await this.llm.invoke([
        new SystemMessage('You are an expert in deep work methodology and focus optimization.'),
        new HumanMessage(focusPrompt)
      ]);

      return JSON.parse(response.content);
    } catch (error) {
      console.error('❌ Focus analysis error:', error);
      return { focusBlockOpportunities: [], focusBlockTypes: {}, protectionStrategies: {} };
    }
  }

  /**
   * Synthesize all analyses into comprehensive recommendations
   */
  async synthesizeAnalyses(analysisResults, userPreferences) {
    // Extract only key findings to avoid token limits
    const keyFindings = analysisResults.map(result => {
      if (result.status === 'fulfilled' && result.value) {
        // Extract only essential fields from each analysis
        const value = result.value;
        return {
          type: value.analysisType || 'unknown',
          keyRecommendations: value.keyRecommendations || value.unifiedRecommendations || {},
          optimalTiming: value.optimalTiming || value.optimalScheduleStructure || {},
          summary: value.summary || value.brief || 'No summary available'
        };
      }
      return null;
    }).filter(Boolean);

    const synthesisPrompt = `Synthesize multiple scheduling analyses into unified, actionable recommendations.

Key Analysis Findings:
${JSON.stringify(keyFindings, null, 2)}

User Preferences:
${JSON.stringify(userPreferences.todaysProfile, null, 2)}

Current Time: ${new Date().toLocaleString()}

Provide synthesized scheduling recommendations:

Respond in JSON format:
{
  "unifiedRecommendations": {
    "optimalScheduleStructure": {
      "morningBlock": {
        "time": "09:00-12:00",
        "activities": ["deep work", "priority tasks"],
        "energyAlignment": "peak productivity period",
        "protections": ["no meetings", "no email checking"]
      },
      "afternoonBlock": {
        "time": "13:00-17:00", 
        "activities": ["meetings", "collaboration", "admin"],
        "energyAlignment": "social and administrative work",
        "flexibility": "more interruptions acceptable"
      }
    },
    "criticalSuccessFactors": [
      "protect morning deep work time",
      "batch similar activities together",
      "schedule breaks based on energy patterns"
    ]
  },
  "implementationPriority": {
    "highPriority": ["establish morning focus block", "batch email processing"],
    "mediumPriority": ["optimize meeting timing", "schedule health breaks"],
    "lowPriority": ["fine-tune transition times", "optimize environment"]
  },
  "adaptationGuidance": {
    "flexibilityPoints": "where schedule can be adjusted if needed",
    "nonNegotiables": "elements that must be protected",
    "realTimeAdjustments": "how to handle unexpected changes"
  }
}`;

    try {
      const response = await this.llm.invoke([
        new SystemMessage('You are an expert at synthesizing multiple productivity analyses into unified, actionable recommendations.'),
        new HumanMessage(synthesisPrompt)
      ]);

      return JSON.parse(response.content);
    } catch (error) {
      console.error('❌ Synthesis error:', error);
      return this.getFallbackSynthesis();
    }
  }

  /**
   * Determine optimal scheduling window
   */
  determineOptimalWindow(synthesizedAnalysis) {
    // Extract optimal windows from synthesized analysis
    const optimal = synthesizedAnalysis.unifiedRecommendations?.optimalScheduleStructure;
    
    if (!optimal) {
      return {
        morningOptimal: '09:00-11:00',
        afternoonOptimal: '14:00-16:00',
        explanation: 'Default productive time windows based on circadian rhythms'
      };
    }

    return {
      morningOptimal: optimal.morningBlock?.time || '09:00-12:00',
      afternoonOptimal: optimal.afternoonBlock?.time || '13:00-17:00',
      explanation: 'Optimized based on user preferences and data analysis'
    };
  }

  /**
   * Identify potential conflicts in recommendations
   */
  identifyConflicts(synthesizedAnalysis) {
    // Analyze for conflicts between different recommendations
    return {
      timeConflicts: [],
      energyConflicts: [],
      priorityConflicts: [],
      resolutionSuggestions: []
    };
  }

  /**
   * Generate adaptation suggestions for real-time adjustments
   */
  generateAdaptationSuggestions(synthesizedAnalysis) {
    return {
      energyDips: 'How to adjust when energy is lower than expected',
      unexpectedMeetings: 'How to reschedule when urgent meetings arise',
      taskOverruns: 'How to handle when tasks take longer than planned',
      healthEvents: 'How to adapt schedule based on health changes'
    };
  }

  /**
   * Fallback methods for error handling
   */
  getFallbackEnergyAnalysis() {
    return {
      energyProfile: {
        currentLevel: 7,
        peakPeriods: [
          { start: "09:00", end: "11:00", energyLevel: "high", suitableFor: ["deep work"] },
          { start: "14:00", end: "16:00", energyLevel: "medium-high", suitableFor: ["meetings"] }
        ],
        lowEnergyPeriods: [
          { start: "13:00", end: "14:00", energyLevel: "low", suitableFor: ["admin tasks"] }
        ]
      },
      recommendations: {
        deepWorkOptimal: ["09:00-11:00"],
        meetingsOptimal: ["14:00-16:00"],
        adminOptimal: ["13:00-14:00"],
        breaksRecommended: ["11:00-11:15", "15:00-15:15"]
      },
      healthConsiderations: {
        energyBoostingActivities: ["short walk", "hydration"],
        stressManagement: "take regular breaks",
        optimalBreakTiming: "every 90 minutes"
      }
    };
  }

  getFallbackProductivityAnalysis() {
    return {
      workBlockRecommendations: {
        deepFocusBlocks: [{
          duration: 90,
          optimalTiming: ["09:00-10:30"],
          taskTypes: ["complex problem solving"],
          interruptionProtection: "strict"
        }],
        collaborativeBlocks: [{
          duration: 60,
          optimalTiming: ["14:00-15:00"],
          taskTypes: ["meetings"],
          flexibilityLevel: "medium"
        }],
        adminBlocks: [{
          duration: 30,
          optimalTiming: ["16:30-17:00"],
          taskTypes: ["email processing"],
          multitaskingAllowed: true
        }]
      },
      taskPrioritization: {
        highPrioritySlots: ["09:00-11:00"],
        mediumPrioritySlots: ["11:00-12:00"],
        lowPrioritySlots: ["16:00-17:00"]
      }
    };
  }

  getFallbackHealthAnalysis() {
    return {
      wellnessIntegration: {
        movementBreaks: [
          { time: "10:00", activity: "5-minute stretch", purpose: "prevent stiffness" },
          { time: "15:00", activity: "short walk", purpose: "boost energy" }
        ],
        hydrationReminders: ["09:30", "13:30", "16:30"],
        eyeRestBreaks: "every 90 minutes"
      },
      stressManagement: {
        recoveryActivities: ["deep breathing"],
        stressBuffers: "5 minutes between tasks"
      }
    };
  }

  getFallbackSynthesis() {
    return {
      unifiedRecommendations: {
        optimalScheduleStructure: {
          morningBlock: {
            time: "09:00-12:00",
            activities: ["deep work", "priority tasks"],
            energyAlignment: "peak productivity",
            protections: ["no interruptions"]
          },
          afternoonBlock: {
            time: "13:00-17:00",
            activities: ["meetings", "admin"],
            energyAlignment: "collaborative work",
            flexibility: "moderate interruptions OK"
          }
        },
        criticalSuccessFactors: [
          "protect morning focus time",
          "batch similar activities",
          "take regular breaks"
        ]
      }
    };
  }

  generateFallbackRecommendations() {
    return {
      basicSchedule: {
        morningFocus: "09:00-11:00 for deep work",
        afternoonMeetings: "14:00-16:00 for collaboration",
        adminTime: "16:00-17:00 for administrative tasks"
      },
      breaks: ["10:30", "15:00"],
      principles: ["Focus first", "Batch similar tasks", "Regular breaks"]
    };
  }

  /**
   * Get agent status
   */
  getStatus() {
    return {
      analysisFrameworks: Object.keys(this.analysisFrameworks),
      timeSlotTypes: Object.keys(this.timeSlotTypes),
      llmAvailable: !!process.env.OPENAI_API_KEY,
      lastAnalysis: this.lastAnalysisTime || null,
      capabilities: [
        'energy pattern analysis',
        'productivity optimization',
        'health-based timing',
        'calendar optimization',
        'focus block identification'
      ]
    };
  }
}

module.exports = ScheduleAnalysisAgent;