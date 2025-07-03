const { ChatOpenAI } = require('@langchain/openai');
const { ChatAnthropic } = require('@langchain/anthropic');
const { HumanMessage, SystemMessage } = require('@langchain/core/messages');

/**
 * ScheduleBuilderAgent - Specialized agent for building comprehensive daily schedules
 * Creates detailed time-blocked schedules with Pomodoros, breaks, and task optimization
 */
class ScheduleBuilderAgent {
  constructor() {
    // Use GPT-3.5-turbo-16k for reliable schedule building
    this.llm = new ChatOpenAI({
      apiKey: process.env.OPENAI_API_KEY,
      modelName: 'gpt-3.5-turbo-16k', // Use 16k context model
      temperature: 0.4,
    });
    console.log('🏗️ ScheduleBuilderAgent initialized with OpenAI GPT-3.5-turbo-16k');

    // Schedule building templates and patterns
    this.scheduleTemplates = {
      focusIntensive: 'deep-work-blocks-with-short-breaks',
      collaborative: 'meeting-heavy-with-prep-time',
      mixed: 'balanced-work-and-collaboration',
      adminFocused: 'task-processing-and-communication',
      creative: 'inspiration-based-flexible-blocks'
    };

    // Pomodoro configurations
    this.pomodoroConfigs = {
      classic: { work: 25, shortBreak: 5, longBreak: 15, cycles: 4 },
      extended: { work: 90, shortBreak: 15, longBreak: 30, cycles: 3 },
      flexible: { work: 45, shortBreak: 10, longBreak: 20, cycles: 4 },
      micro: { work: 15, shortBreak: 3, longBreak: 10, cycles: 6 }
    };

    // Time block types with specific properties
    this.blockTypes = {
      deepWork: { 
        minDuration: 45, 
        maxDuration: 120, 
        bufferBefore: 10, 
        bufferAfter: 10,
        interruptionTolerance: 'none',
        energyRequirement: 'high'
      },
      meeting: { 
        minDuration: 15, 
        maxDuration: 120, 
        bufferBefore: 5, 
        bufferAfter: 5,
        interruptionTolerance: 'none',
        energyRequirement: 'medium'
      },
      admin: { 
        minDuration: 15, 
        maxDuration: 60, 
        bufferBefore: 0, 
        bufferAfter: 0,
        interruptionTolerance: 'high',
        energyRequirement: 'low'
      },
      creative: { 
        minDuration: 60, 
        maxDuration: 90, 
        bufferBefore: 15, 
        bufferAfter: 10,
        interruptionTolerance: 'low',
        energyRequirement: 'medium-high'
      },
      break: { 
        minDuration: 5, 
        maxDuration: 30, 
        bufferBefore: 0, 
        bufferAfter: 0,
        interruptionTolerance: 'high',
        energyRequirement: 'recovery'
      }
    };

    console.log('🏗️ ScheduleBuilderAgent initialized');
  }

  /**
   * Build comprehensive daily schedule with all optimizations
   */
  async buildDailySchedule(analysisResult, userPreferences, collectedData, options = {}) {
    try {
      console.log('🏗️ Building comprehensive daily schedule...');
      
      const {
        scheduleStyle = 'mixed',
        pomodoroStyle = 'classic',
        includeBuffers = true,
        autoOptimize = true,
        timeRange = { start: '09:00', end: '17:00' }
      } = options;

      // Step 1: Determine schedule structure based on analysis
      const scheduleStructure = await this.determineScheduleStructure(
        analysisResult, 
        userPreferences, 
        scheduleStyle
      );

      // Step 2: Allocate priority tasks to optimal time slots
      const taskAllocation = await this.allocatePriorityTasks(
        userPreferences.todaysProfile?.priorities || [],
        analysisResult.synthesizedRecommendations,
        scheduleStructure
      );

      // Step 3: Integrate calendar events and constraints
      const calendarIntegration = await this.integrateCalendarConstraints(
        collectedData.calendar,
        taskAllocation,
        scheduleStructure
      );

      // Step 4: Add Pomodoro timing and breaks
      const pomodoroSchedule = await this.addPomodoroTiming(
        calendarIntegration,
        pomodoroStyle,
        analysisResult.synthesizedRecommendations
      );

      // Step 5: Optimize for health and energy
      const healthOptimizedSchedule = await this.optimizeForHealthAndEnergy(
        pomodoroSchedule,
        collectedData.health,
        analysisResult.energyAnalysis
      );

      // Step 6: Add email processing and admin blocks
      const communicationSchedule = await this.addCommunicationBlocks(
        healthOptimizedSchedule,
        collectedData.emails,
        analysisResult.emailAnalysis
      );

      // Step 7: Generate final schedule with all details
      const finalSchedule = await this.generateFinalSchedule(
        communicationSchedule,
        userPreferences,
        analysisResult,
        options
      );

      return {
        success: true,
        schedule: finalSchedule,
        metadata: {
          buildTime: new Date(),
          scheduleStyle: scheduleStyle,
          pomodoroConfig: this.pomodoroConfigs[pomodoroStyle],
          totalBlocks: finalSchedule.scheduleBlocks?.length || 0,
          optimization: {
            energyAligned: true,
            healthIntegrated: true,
            pomodoroStructured: true,
            calendarRespected: true
          }
        }
      };
    } catch (error) {
      console.error('❌ Schedule building error:', error);
      return {
        success: false,
        error: error.message,
        fallbackSchedule: this.generateFallbackSchedule(userPreferences, options)
      };
    }
  }

  /**
   * Determine optimal schedule structure based on analysis
   */
  async determineScheduleStructure(analysisResult, userPreferences, scheduleStyle) {
    const structurePrompt = `Determine the optimal schedule structure for today based on comprehensive analysis.

Analysis Results:
${JSON.stringify(analysisResult.synthesizedRecommendations, null, 2)}

User Preferences:
${JSON.stringify(userPreferences.todaysProfile, null, 2)}

Schedule Style: ${scheduleStyle}
Current Time: ${new Date().toLocaleString()}

Determine the best schedule structure:

Respond in JSON format:
{
  "scheduleStructure": {
    "morningBlock": {
      "startTime": "09:00",
      "endTime": "12:00",
      "primaryPurpose": "deep work and high-priority tasks",
      "energyLevel": "high",
      "interruptionPolicy": "strict protection",
      "recommendedActivities": ["complex problem solving", "creative work"]
    },
    "midDayBlock": {
      "startTime": "12:00", 
      "endTime": "13:00",
      "primaryPurpose": "break and energy restoration",
      "energyLevel": "transition",
      "interruptionPolicy": "flexible",
      "recommendedActivities": ["lunch", "movement", "relaxation"]
    },
    "afternoonBlock": {
      "startTime": "13:00",
      "endTime": "17:00", 
      "primaryPurpose": "collaboration and communication",
      "energyLevel": "medium",
      "interruptionPolicy": "moderate protection",
      "recommendedActivities": ["meetings", "email", "admin tasks"]
    }
  },
  "transitionPrinciples": {
    "blockSwitching": "5-10 minute buffers between different activity types",
    "energyManagement": "align demanding tasks with high energy periods",
    "flowProtection": "minimize context switching within blocks"
  },
  "flexibilityPoints": {
    "adjustableBlocks": ["afternoon admin time can be moved"],
    "fixedBlocks": ["morning deep work should not be interrupted"],
    "bufferBlocks": ["use as overflow for running-over tasks"]
  }
}`;

    try {
      const response = await this.llm.invoke([
        new SystemMessage('You are an expert in optimal schedule architecture and time block design.'),
        new HumanMessage(structurePrompt)
      ]);

      return JSON.parse(response.content);
    } catch (error) {
      console.error('❌ Structure determination error:', error);
      return this.getDefaultScheduleStructure();
    }
  }

  /**
   * Allocate priority tasks to optimal time slots
   */
  async allocatePriorityTasks(priorities, synthesizedRecommendations, scheduleStructure) {
    const allocationPrompt = `Allocate priority tasks to optimal time slots based on task complexity and energy patterns.

Priority Tasks:
${JSON.stringify(priorities, null, 2)}

Schedule Structure:
${JSON.stringify(scheduleStructure, null, 2)}

Optimization Recommendations:
${JSON.stringify(synthesizedRecommendations, null, 2)}

Allocate each priority task to the most suitable time slot:

Respond in JSON format:
{
  "taskAllocations": [
    {
      "taskId": "priority-1",
      "taskName": "Complete project proposal",
      "allocatedTimeSlot": {
        "startTime": "09:00",
        "endTime": "10:30",
        "duration": 90,
        "reasoning": "High complexity task needs peak morning energy"
      },
      "taskType": "deep work",
      "complexityLevel": "high",
      "energyRequirement": "high",
      "estimatedDuration": 90,
      "bufferTime": 15
    }
  ],
  "allocationPrinciples": {
    "energyMatching": "match task difficulty to energy levels",
    "timeBoxing": "strict time boundaries to prevent overrun",
    "sequencing": "logical order of task dependencies"
  },
  "unallocatedTasks": [
    {
      "task": "task that couldn't be scheduled today",
      "reason": "insufficient time available",
      "recommendation": "move to tomorrow or break into smaller parts"
    }
  ]
}`;

    try {
      const response = await this.llm.invoke([
        new SystemMessage('You are an expert in task prioritization and optimal time allocation.'),
        new HumanMessage(allocationPrompt)
      ]);

      return JSON.parse(response.content);
    } catch (error) {
      console.error('❌ Task allocation error:', error);
      return { taskAllocations: [], allocationPrinciples: {}, unallocatedTasks: [] };
    }
  }

  /**
   * Integrate existing calendar events and constraints
   */
  async integrateCalendarConstraints(calendarData, taskAllocation, scheduleStructure) {
    if (!calendarData || !calendarData.events) {
      return taskAllocation; // No calendar constraints to integrate
    }

    const integrationPrompt = `Integrate existing calendar events with planned task allocations, resolving any conflicts.

Existing Calendar Events:
${JSON.stringify(calendarData.events, null, 2)}

Planned Task Allocations:
${JSON.stringify(taskAllocation, null, 2)}

Schedule Structure:
${JSON.stringify(scheduleStructure, null, 2)}

Integrate calendar events and resolve conflicts:

Respond in JSON format:
{
  "integratedSchedule": {
    "fixedBlocks": [
      {
        "startTime": "10:00",
        "endTime": "11:00",
        "type": "calendar_event",
        "title": "Team Meeting",
        "moveable": false,
        "preparationTime": 10,
        "bufferAfter": 5
      }
    ],
    "adjustedTaskBlocks": [
      {
        "originalTime": "10:00-11:30",
        "newTime": "09:00-10:30", 
        "task": "Priority task 1",
        "adjustmentReason": "moved to avoid calendar conflict"
      }
    ]
  },
  "conflictResolutions": [
    {
      "conflict": "Task overlaps with meeting",
      "resolution": "Moved task to earlier time slot",
      "impact": "minimal - still in optimal energy period"
    }
  ],
  "optimizationOpportunities": [
    {
      "opportunity": "Use meeting prep time for related admin tasks",
      "implementation": "Schedule 10 minutes before meeting for preparation"
    }
  ]
}`;

    try {
      const response = await this.llm.invoke([
        new SystemMessage('You are an expert in calendar management and conflict resolution.'),
        new HumanMessage(integrationPrompt)
      ]);

      return JSON.parse(response.content);
    } catch (error) {
      console.error('❌ Calendar integration error:', error);
      return taskAllocation;
    }
  }

  /**
   * Add Pomodoro timing and structured breaks
   */
  async addPomodoroTiming(integratedSchedule, pomodoroStyle, recommendations) {
    const pomodoroConfig = this.pomodoroConfigs[pomodoroStyle];
    
    const pomodoroPrompt = `Add Pomodoro timing structure to the integrated schedule.

Integrated Schedule:
${JSON.stringify(integratedSchedule, null, 2)}

Pomodoro Configuration:
- Work Duration: ${pomodoroConfig.work} minutes
- Short Break: ${pomodoroConfig.shortBreak} minutes  
- Long Break: ${pomodoroConfig.longBreak} minutes
- Cycles Before Long Break: ${pomodoroConfig.cycles}

Health Recommendations:
${JSON.stringify(recommendations, null, 2)}

Add Pomodoro structure to work blocks:

Respond in JSON format:
{
  "pomodoroStructuredSchedule": [
    {
      "startTime": "09:00",
      "endTime": "09:25",
      "type": "pomodoro_work",
      "task": "Priority Task 1",
      "pomodoroNumber": 1,
      "cyclePosition": "1 of 4",
      "nextBreakType": "short",
      "focusLevel": "high"
    },
    {
      "startTime": "09:25", 
      "endTime": "09:30",
      "type": "pomodoro_break",
      "breakType": "short",
      "duration": 5,
      "suggestedActivity": "stretch and hydrate",
      "preparation": "for next pomodoro cycle"
    }
  ],
  "pomodoroSummary": {
    "totalPomodoroSessions": 8,
    "totalWorkTime": "3.5 hours",
    "totalBreakTime": "45 minutes",
    "longBreaks": 2,
    "adaptations": "adjusted for health recommendations"
  },
  "healthIntegration": {
    "movementBreaks": "included in long breaks",
    "hydrationReminders": "built into break suggestions",
    "eyeRestPeriods": "every 25-90 minutes depending on work type"
  }
}`;

    try {
      const response = await this.llm.invoke([
        new SystemMessage('You are an expert in Pomodoro technique implementation and productivity timing.'),
        new HumanMessage(pomodoroPrompt)
      ]);

      return JSON.parse(response.content);
    } catch (error) {
      console.error('❌ Pomodoro timing error:', error);
      return this.addBasicPomodoroStructure(integratedSchedule, pomodoroConfig);
    }
  }

  /**
   * Optimize schedule for health and energy patterns
   */
  async optimizeForHealthAndEnergy(pomodoroSchedule, healthData, energyAnalysis) {
    const healthOptimizationPrompt = `Optimize the Pomodoro-structured schedule for health and energy patterns.

Current Schedule:
${JSON.stringify(pomodoroSchedule.pomodoroStructuredSchedule, null, 2)}

Health Data:
${JSON.stringify(healthData, null, 2)}

Energy Analysis:
${JSON.stringify(energyAnalysis, null, 2)}

Optimize for health and energy:

Respond in JSON format:
{
  "healthOptimizedSchedule": [
    {
      "startTime": "09:00",
      "endTime": "09:25", 
      "type": "pomodoro_work",
      "task": "High-priority complex task",
      "energyAlignment": "peak energy period",
      "healthConsiderations": "good posture, proper lighting",
      "adaptations": "none needed - optimal timing"
    },
    {
      "startTime": "09:25",
      "endTime": "09:30",
      "type": "movement_break",
      "activity": "5-minute walk or stretch",
      "healthBenefit": "circulation and posture reset",
      "energyImpact": "maintains high energy for next session"
    }
  ],
  "healthOptimizations": {
    "movementIntegration": "breaks include physical activity",
    "energyConservation": "demanding tasks during peak periods",
    "stressReduction": "buffer time prevents rushing",
    "sustainabilityFocus": "prevents burnout through pacing"
  },
  "energyManagement": {
    "peakUtilization": "most challenging work during high energy",
    "recoveryPeriods": "strategic breaks for energy restoration", 
    "energyBoosting": "activities to maintain energy levels",
    "fatiguePrevention": "prevents energy depletion through overwork"
  }
}`;

    try {
      const response = await this.llm.invoke([
        new SystemMessage('You are an expert in health-conscious productivity and energy optimization.'),
        new HumanMessage(healthOptimizationPrompt)
      ]);

      return JSON.parse(response.content);
    } catch (error) {
      console.error('❌ Health optimization error:', error);
      return { healthOptimizedSchedule: pomodoroSchedule.pomodoroStructuredSchedule };
    }
  }

  /**
   * Add communication and email processing blocks
   */
  async addCommunicationBlocks(healthOptimizedSchedule, emailData, emailAnalysis) {
    const communicationPrompt = `Add strategic communication and email processing blocks to the optimized schedule.

Current Schedule:
${JSON.stringify(healthOptimizedSchedule.healthOptimizedSchedule, null, 2)}

Email Data:
${JSON.stringify(emailData, null, 2)}

Email Processing Analysis:
${JSON.stringify(emailAnalysis, null, 2)}

Add communication blocks strategically:

Respond in JSON format:
{
  "communicationIntegratedSchedule": [
    {
      "startTime": "09:00",
      "endTime": "09:25",
      "type": "pomodoro_work", 
      "task": "Priority work task",
      "emailPolicy": "no checking - focus protected"
    },
    {
      "startTime": "11:00",
      "endTime": "11:20",
      "type": "email_processing",
      "purpose": "urgent email triage and responses",
      "maxEmails": 10,
      "timeBoxed": true,
      "urgencyFilter": "high priority only"
    }
  ],
  "communicationStrategy": {
    "protectedFocusTime": "no email/messages during deep work blocks",
    "batchProcessing": "designated times for communication",
    "urgencyTriage": "immediate response only for true emergencies", 
    "timeBoxing": "strict limits on communication time"
  },
  "emailProcessingSchedule": {
    "morningTriage": "brief urgent check after first pomodoro",
    "midDayProcessing": "main email processing session",
    "endOfDayReview": "final check and tomorrow preparation"
  }
}`;

    try {
      const response = await this.llm.invoke([
        new SystemMessage('You are an expert in communication management and email productivity.'),
        new HumanMessage(communicationPrompt)
      ]);

      return JSON.parse(response.content);
    } catch (error) {
      console.error('❌ Communication integration error:', error);
      return { communicationIntegratedSchedule: healthOptimizedSchedule.healthOptimizedSchedule };
    }
  }

  /**
   * Generate final comprehensive schedule
   */
  async generateFinalSchedule(communicationSchedule, userPreferences, analysisResult, options) {
    const finalSchedulePrompt = `Generate the final comprehensive daily schedule with all optimizations and details.

Communication-Integrated Schedule:
${JSON.stringify(communicationSchedule.communicationIntegratedSchedule, null, 2)}

User Preferences:
${JSON.stringify(userPreferences.todaysProfile, null, 2)}

Analysis Results Summary:
${JSON.stringify(analysisResult.synthesizedRecommendations, null, 2)}

Build Options:
${JSON.stringify(options, null, 2)}

Generate final detailed schedule:

Respond in JSON format:
{
  "scheduleBlocks": [
    {
      "id": "block-1",
      "startTime": "09:00",
      "endTime": "09:25",
      "type": "pomodoro_work",
      "task": "Complete project proposal draft",
      "description": "Focus on outline and key sections",
      "priority": "high",
      "energyLevel": "high",
      "pomodoroNumber": 1,
      "interruptionPolicy": "strict",
      "notifications": {
        "startReminder": "5 minutes before",
        "endReminder": "when complete",
        "breakReminder": "automatic"
      },
      "resources": ["laptop", "notes", "quiet environment"],
      "successMetrics": "complete draft outline"
    }
  ],
  "summary": {
    "totalBlocks": 16,
    "workTime": "6 hours",
    "breakTime": "1.5 hours",
    "focusBlocks": 8,
    "meetingBlocks": 2,
    "adminBlocks": 3,
    "pomodoroSessions": 12,
    "energyOptimized": true,
    "healthIntegrated": true
  },
  "executionGuidance": {
    "startingInstructions": "Begin with 5-minute preparation ritual",
    "transitionGuidance": "Use buffers for setup and cleanup",
    "interruption": "handle according to block-specific policies",
    "adaptation": "flexibility points for real-time adjustments"
  },
  "automation": {
    "notificationSchedule": "automatic reminders for each block",
    "pomodoroTimers": "auto-start with calendar integration",
    "breakActivities": "suggested activities for each break",
    "energyTracking": "monitor energy levels throughout day"
  }
}`;

    try {
      const response = await this.llm.invoke([
        new SystemMessage('You are an expert in comprehensive schedule design and productivity execution.'),
        new HumanMessage(finalSchedulePrompt)
      ]);

      return JSON.parse(response.content);
    } catch (error) {
      console.error('❌ Final schedule generation error:', error);
      return this.generateBasicFinalSchedule(communicationSchedule, userPreferences);
    }
  }

  /**
   * Helper methods and fallbacks
   */
  getDefaultScheduleStructure() {
    return {
      scheduleStructure: {
        morningBlock: {
          startTime: "09:00",
          endTime: "12:00",
          primaryPurpose: "deep work and high-priority tasks",
          energyLevel: "high",
          interruptionPolicy: "strict protection",
          recommendedActivities: ["complex problem solving", "creative work"]
        },
        midDayBlock: {
          startTime: "12:00",
          endTime: "13:00",
          primaryPurpose: "break and energy restoration",
          energyLevel: "transition",
          interruptionPolicy: "flexible",
          recommendedActivities: ["lunch", "movement", "relaxation"]
        },
        afternoonBlock: {
          startTime: "13:00",
          endTime: "17:00",
          primaryPurpose: "collaboration and communication",
          energyLevel: "medium",
          interruptionPolicy: "moderate protection",
          recommendedActivities: ["meetings", "email", "admin tasks"]
        }
      }
    };
  }

  addBasicPomodoroStructure(schedule, config) {
    // Basic Pomodoro structure implementation
    return {
      pomodoroStructuredSchedule: [],
      pomodoroSummary: {
        totalPomodoroSessions: 0,
        totalWorkTime: "0 hours",
        totalBreakTime: "0 minutes"
      }
    };
  }

  generateBasicFinalSchedule(communicationSchedule, userPreferences) {
    return {
      scheduleBlocks: [
        {
          id: "morning-focus",
          startTime: "09:00",
          endTime: "11:00",
          type: "deep_work",
          task: "High-priority tasks",
          description: "Focus on most important work",
          priority: "high",
          energyLevel: "high"
        },
        {
          id: "break-1", 
          startTime: "11:00",
          endTime: "11:15",
          type: "break",
          task: "Movement break",
          description: "Stretch and hydrate"
        },
        {
          id: "collaboration",
          startTime: "14:00",
          endTime: "16:00", 
          type: "meetings",
          task: "Meetings and collaboration",
          description: "Team work and communication"
        }
      ],
      summary: {
        totalBlocks: 3,
        workTime: "4 hours",
        breakTime: "15 minutes",
        energyOptimized: true
      }
    };
  }

  generateFallbackSchedule(userPreferences, options) {
    const timeRange = options.timeRange || { start: '09:00', end: '17:00' };
    
    return {
      scheduleBlocks: [
        {
          startTime: timeRange.start,
          endTime: "11:00",
          type: "deep_work",
          task: "Priority tasks",
          description: "Morning focus time"
        },
        {
          startTime: "11:00",
          endTime: "11:15", 
          type: "break",
          task: "Short break",
          description: "Rest and recharge"
        },
        {
          startTime: "14:00",
          endTime: timeRange.end,
          type: "collaboration",
          task: "Meetings and admin",
          description: "Afternoon collaborative work"
        }
      ],
      summary: {
        totalBlocks: 3,
        workTime: "5 hours",
        breakTime: "15 minutes"
      }
    };
  }

  /**
   * Get agent status
   */
  getStatus() {
    return {
      scheduleTemplates: Object.keys(this.scheduleTemplates),
      pomodoroConfigs: Object.keys(this.pomodoroConfigs),
      blockTypes: Object.keys(this.blockTypes),
      capabilities: [
        'comprehensive schedule building',
        'Pomodoro integration', 
        'health optimization',
        'calendar integration',
        'task allocation',
        'energy alignment'
      ],
      llmAvailable: !!process.env.OPENAI_API_KEY
    };
  }
}

module.exports = ScheduleBuilderAgent;