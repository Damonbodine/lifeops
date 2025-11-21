const { ChatOpenAI } = require('@langchain/openai');
const { ChatAnthropic } = require('@langchain/anthropic');
const { HumanMessage, SystemMessage } = require('@langchain/core/messages');
const { scheduleTemplates, pomodoroConfigs, blockTypes } = require('../../config/scheduleBuilderConfigs');
const { createPomodoroPrompt, createCommunicationPrompt, createFinalSchedulePrompt } = require('../../config/scheduleBuilderPrompts');
const ScheduleConstraints = require('../scheduleConstraints');
const ScheduleOptimizer = require('../scheduleOptimizer');

/**
 * ScheduleBuilderAgent - Specialized agent for building comprehensive daily schedules
 * Creates detailed time-blocked schedules with Pomodoros, breaks, and task optimization
 */
class ScheduleBuilderAgent {
  constructor() {
    // Use GPT-3.5-turbo-16k for reliable schedule building
    this.llm = new ChatOpenAI({
      apiKey: process.env.OPENAI_API_KEY,
      modelName: 'gpt-3.5-turbo-16k',
      temperature: 0.4,
    });

    // Initialize helper modules
    this.constraints = new ScheduleConstraints(this.llm);
    this.optimizer = new ScheduleOptimizer(this.llm);

    // Store configuration references
    this.scheduleTemplates = scheduleTemplates;
    this.pomodoroConfigs = pomodoroConfigs;
    this.blockTypes = blockTypes;

    console.log('🏗️ ScheduleBuilderAgent initialized with OpenAI GPT-3.5-turbo-16k');
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
      const scheduleStructure = await this.optimizer.determineScheduleStructure(
        analysisResult,
        userPreferences,
        scheduleStyle
      ) || this.constraints.getDefaultScheduleStructure();

      // Step 2: Allocate priority tasks to optimal time slots
      const taskAllocation = await this.optimizer.allocatePriorityTasks(
        userPreferences.todaysProfile?.priorities || [],
        analysisResult.synthesizedRecommendations,
        scheduleStructure
      );

      // Step 3: Integrate calendar events and constraints
      const calendarIntegration = await this.constraints.integrateCalendarConstraints(
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
      const healthOptimizedSchedule = await this.optimizer.optimizeForHealthAndEnergy(
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
   * Add Pomodoro timing and structured breaks
   */
  async addPomodoroTiming(integratedSchedule, pomodoroStyle, recommendations) {
    const pomodoroConfig = this.pomodoroConfigs[pomodoroStyle];
    const pomodoroPrompt = createPomodoroPrompt(integratedSchedule, pomodoroConfig, recommendations);

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
   * Add communication and email processing blocks
   */
  async addCommunicationBlocks(healthOptimizedSchedule, emailData, emailAnalysis) {
    const communicationPrompt = createCommunicationPrompt(
      healthOptimizedSchedule.healthOptimizedSchedule,
      emailData,
      emailAnalysis
    );

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
    const finalSchedulePrompt = createFinalSchedulePrompt(
      communicationSchedule.communicationIntegratedSchedule,
      userPreferences.todaysProfile,
      analysisResult.synthesizedRecommendations,
      options
    );

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
   * Helper: Add basic Pomodoro structure (fallback)
   */
  addBasicPomodoroStructure(schedule, config) {
    return {
      pomodoroStructuredSchedule: [],
      pomodoroSummary: {
        totalPomodoroSessions: 0,
        totalWorkTime: "0 hours",
        totalBreakTime: "0 minutes"
      }
    };
  }

  /**
   * Helper: Generate basic final schedule (fallback)
   */
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

  /**
   * Helper: Generate fallback schedule
   */
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
