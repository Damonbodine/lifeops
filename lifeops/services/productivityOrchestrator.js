const { ChatOpenAI } = require('@langchain/openai');
const { ChatAnthropic } = require('@langchain/anthropic');
const { HumanMessage, SystemMessage } = require('@langchain/core/messages');
const emailService = require('./emailService');
const HealthAnalytics = require('./healthAnalytics');

// Extracted modules
const OrchestrationState = require('./orchestrationState');
const {
  cleanLLMResponse,
  validateScheduleStructure,
  enforceTimeConstraints,
  calculateTargetDate,
  calculateSchedulingConstraints
} = require('../utils/scheduleUtils');
const {
  initializeCalendar,
  getTodaysCalendarEvents,
  createCalendarEvents
} = require('./calendarIntegration');
const {
  applyScheduleModifications,
  getFallbackSchedule,
  buildDailySchedule
} = require('./scheduleModifier');
const {
  initializePomodoroIntegration,
  setupAutomatedExecution,
  setupPomodoroExecution,
  sendNotification
} = require('./executionManager');
const {
  conductDailyInterview,
  processInterviewResponses
} = require('./interviewAgent');

/**
 * ProductivityOrchestrator - The main AI orchestrator for ultimate productivity
 * Coordinates all agents and manages the complete daily productivity workflow
 */
class ProductivityOrchestrator {
  constructor() {
    this.llm = new ChatOpenAI({
      apiKey: process.env.OPENAI_API_KEY,
      modelName: 'gpt-4o',
      temperature: 0.7,
    });

    // Agent state management - using extracted state class
    this.state = new OrchestrationState();

    // Load existing agents
    this.agents = {
      interview: null,      // Will be loaded dynamically
      dataCollection: null,
      scheduleAnalysis: null,
      scheduleBuilder: null,
      executionManager: null
    };

    // Core integrations
    this.healthAnalytics = new HealthAnalytics(process.env.OPENAI_API_KEY);
    this.calendar = null;
    this.initializeCalendarIntegration();

    // Optional Pomodoro and Notification integration (fail gracefully)
    this.pomodoroManager = null;
    this.notificationManager = null;
    this.initializePomodoroIntegration();

    // Scheduled jobs
    this.scheduledJobs = new Map();

    console.log('🧠 ProductivityOrchestrator initialized');
  }

  /**
   * Initialize Google Calendar integration
   */
  async initializeCalendarIntegration() {
    this.calendar = await initializeCalendar();
  }

  /**
   * Initialize Pomodoro and Notification integration (optional)
   */
  async initializePomodoroIntegration() {
    const managers = await initializePomodoroIntegration();
    this.pomodoroManager = managers.pomodoroManager;
    this.notificationManager = managers.notificationManager;
  }

  /**
   * Start the daily productivity orchestration flow
   */
  async startDailyOrchestration(userInput = null) {
    try {
      console.log('🚀 Starting daily productivity orchestration...');
      
      // Step 1: Interview the user about their day
      const interviewResult = await this.conductDailyInterview(userInput);
      
      // Step 2: Collect all data sources
      const collectedData = await this.collectAllData();
      
      // Step 3: Analyze patterns with multi-provider AI
      console.log('🧠 Analyzing patterns with OpenAI GPT-3.5...');
      const analysisResult = await this.analyzeSchedulingPatterns(collectedData, interviewResult);
      
      // Step 4: Build schedule with Anthropic Claude
      console.log('🏗️ Building schedule with OpenAI GPT-3.5...');
      const proposedSchedule = await this.buildDailySchedule(analysisResult, interviewResult);
      
      // Step 5: Present schedule for approval
      const approvalResponse = await this.presentScheduleForApproval(proposedSchedule);
      
      return {
        success: true,
        interviewResult,
        collectedData,
        analysisResult,
        proposedSchedule,
        approvalResponse,
        timestamp: new Date().toISOString()
      };
    } catch (error) {
      console.error('❌ Daily orchestration error:', error);
      return {
        success: false,
        error: error.message,
        timestamp: new Date().toISOString()
      };
    }
  }

  /**
   * Conduct intelligent daily interview with the user
   */
  async conductDailyInterview(initialInput = null) {
    const result = await conductDailyInterview(this.llm, initialInput);

    // Store interview in state
    this.state.updateCurrentSession({
      startTime: new Date(),
      interviewQuestions: result.questions,
      userResponses: {},
      status: 'interviewing'
    });

    return result;
  }

  /**
   * Process user responses to interview questions
   */
  async processInterviewResponses(responses) {
    try {
      const currentSession = this.state.getState().currentSession;
      if (!currentSession) {
        throw new Error('No active interview session');
      }

      // Store responses
      this.state.updateCurrentSession({
        userResponses: responses,
        status: 'responses_collected'
      });

      // Analyze responses with AI using extracted function
      const analysis = await processInterviewResponses(this.llm, responses);

      // Store analysis in user preferences
      this.state.updateUserPreferences({
        todaysProfile: analysis
      });

      return analysis;
    } catch (error) {
      console.error('❌ Error processing interview responses:', error);
      throw error;
    }
  }

  /**
   * Collect data from all integrated sources
   */
  async collectAllData() {
    try {
      console.log('📊 Collecting data from all sources...');
      
      const dataPromises = [];

      // Email data
      if (emailService.isAuth()) {
        dataPromises.push(
          emailService.getUnreadEmails(20).then(emails => ({ source: 'emails', data: emails }))
        );
      }

      // Calendar data
      if (this.calendar) {
        dataPromises.push(
          getTodaysCalendarEvents(this.calendar).then(events => ({ source: 'calendar', data: events }))
        );
      }

      // Health data - SIMPLIFIED to prevent memory overflow
      dataPromises.push(
        Promise.resolve({
          source: 'health',
          data: {
            energyLevel: 'good',
            optimalTimes: ['09:00-11:00', '14:00-16:00'],
            recommendation: 'Schedule deep work in morning, lighter tasks after lunch'
          }
        })
      );

      // Existing tasks (if any stored)
      const state = this.state.getState();
      dataPromises.push(
        Promise.resolve({ source: 'tasks', data: state.scheduledTasks || [] })
      );

      const results = await Promise.allSettled(dataPromises);
      
      const collectedData = {};
      results.forEach(result => {
        if (result.status === 'fulfilled' && result.value) {
          collectedData[result.value.source] = result.value.data;
        }
      });

      console.log('✅ Data collection complete:', Object.keys(collectedData));
      return collectedData;
    } catch (error) {
      console.error('❌ Data collection error:', error);
      return {};
    }
  }


  /**
   * Get health insights for scheduling
   */
  async getHealthInsights() {
    try {
      // Load health data if not already loaded
      const HEALTH_EXPORT_PATH = '/Users/damonbodine/Lifeops/lifeops/apple_health_export';
      await this.healthAnalytics.loadHealthData(HEALTH_EXPORT_PATH);
      
      // Get recent health brief
      const healthBrief = await this.healthAnalytics.generateHealthBrief();
      
      return {
        brief: healthBrief,
        timestamp: new Date()
      };
    } catch (error) {
      console.error('❌ Health insights error:', error);
      return { brief: 'Health data unavailable', timestamp: new Date() };
    }
  }

  /**
   * Analyze scheduling patterns and optimal timing
   */
  async analyzeSchedulingPatterns(collectedData, interviewResult) {
    // Summarize data to prevent token overflow
    const summarizedData = {
      emails: {
        total: collectedData.emails?.total || 0,
        urgent: collectedData.emails?.byUrgency?.high || 0,
        categories: Object.keys(collectedData.emails?.byCategory || {}),
        estimatedTime: collectedData.emails?.estimatedResponseTime || 0
      },
      calendar: {
        eventsToday: collectedData.calendar?.length || 0,
        nextEvent: collectedData.calendar?.[0]?.summary || 'none',
        busyPeriods: collectedData.calendar?.map(e => ({start: e.start?.dateTime, end: e.end?.dateTime}))?.slice(0, 3) || []
      },
      health: collectedData.health || {},
      tasks: {
        count: collectedData.tasks?.length || 0,
        pending: collectedData.tasks?.filter(t => t.status === 'pending')?.length || 0
      }
    };

    const state = this.state.getState();
    const analysisPrompt = `You are an expert productivity analyst. Analyze this data to determine optimal scheduling patterns for today.

Collected Data Summary:
${JSON.stringify(summarizedData, null, 2)}

User Interview Analysis:
${JSON.stringify(state.userPreferences.todaysProfile, null, 2)}

Analyze and provide recommendations for:
1. Optimal time blocks for different types of work
2. Email processing time slots
3. Break timing based on health data
4. Meeting scheduling preferences
5. Energy-based task allocation

Current time: ${new Date().toLocaleString()}

Respond in JSON format:
{
  "optimalScheduling": {
    "deepWorkBlocks": [{"start": "09:00", "end": "11:00", "reason": "Peak energy period"}],
    "emailProcessing": [{"start": "11:00", "end": "11:30", "reason": "Natural break point"}],
    "meetings": [{"start": "14:00", "end": "16:00", "reason": "Post-lunch collaborative time"}],
    "adminTasks": [{"start": "16:00", "end": "17:00", "reason": "Lower energy period"}]
  },
  "conflictAnalysis": {
    "existingCommitments": ["List any calendar conflicts"],
    "availableSlots": ["List free time blocks"],
    "recommendations": ["Specific scheduling suggestions"]
  },
  "healthConsiderations": {
    "breakTiming": "Based on health data recommendations",
    "workloadAdjustments": "Adjustments based on sleep/energy",
    "stressManagement": "Stress-reduction scheduling suggestions"
  }
}`;

    try {
      const response = await this.llm.invoke([
        new SystemMessage('You are an expert productivity and health-based scheduling analyst.'),
        new HumanMessage(analysisPrompt)
      ]);

      return JSON.parse(cleanLLMResponse(response.content));
    } catch (error) {
      console.error('❌ Scheduling analysis error:', error);
      return {
        optimalScheduling: {
          deepWorkBlocks: [{ start: "09:00", end: "11:00", reason: "Default morning focus time" }],
          emailProcessing: [{ start: "11:00", end: "11:30", reason: "Mid-morning check" }],
          meetings: [{ start: "14:00", end: "16:00", reason: "Afternoon collaborative time" }],
          adminTasks: [{ start: "16:00", end: "17:00", reason: "End of day tasks" }]
        },
        conflictAnalysis: { existingCommitments: [], availableSlots: [], recommendations: [] },
        healthConsiderations: { breakTiming: "Standard breaks", workloadAdjustments: "None", stressManagement: "Regular breaks" }
      };
    }
  }

  /**
   * Build comprehensive daily schedule with Pomodoros and breaks
   */
  async buildDailySchedule(analysisResult, interviewResult) {
    const state = this.state.getState();
    const schedulingPrefs = state.currentSession.userResponses?.scheduling || {};

    // Use the imported buildDailySchedule function
    const schedule = await buildDailySchedule(
      this.llm,
      analysisResult,
      state.userPreferences,
      state.currentSession,
      cleanLLMResponse,
      validateScheduleStructure,
      enforceTimeConstraints,
      (prefs, session) => getFallbackSchedule(prefs || schedulingPrefs, session || state.currentSession)
    );

    // Store proposed schedule
    this.state.setTodaysPlan({
      schedule: schedule,
      status: 'proposed',
      createdAt: new Date()
    });

    return schedule;
  }

  /**
   * Present schedule for user approval with explanations
   */
  async presentScheduleForApproval(proposedSchedule) {
    const state = this.state.getState();
    const presentationPrompt = `Create a compelling presentation of this productivity schedule for user approval.

Proposed Schedule:
${JSON.stringify(proposedSchedule, null, 2)}

User Preferences:
${JSON.stringify(state.userPreferences.todaysProfile, null, 2)}

Create a clear, motivating presentation that:
1. Highlights how the schedule addresses their priorities
2. Explains the reasoning behind time allocations
3. Shows health and energy considerations
4. Provides options for customization
5. Makes it easy to approve or request changes

Respond in JSON format:
{
  "presentation": {
    "title": "Your Optimized Day Plan",
    "overview": "High-level summary of the day",
    "highlights": [
      "Key benefit 1",
      "Key benefit 2", 
      "Key benefit 3"
    ],
    "timeBreakdown": {
      "focusWork": "X hours of deep work",
      "communications": "X minutes for email/messages",
      "breaks": "X minutes of strategic breaks",
      "meetings": "X hours for meetings/calls"
    }
  },
  "reasoning": {
    "energyOptimization": "How schedule matches energy levels",
    "priorityAlignment": "How top priorities are addressed",
    "healthConsiderations": "Health-based scheduling decisions"
  },
  "options": {
    "approve": "Accept this schedule as-is",
    "modify": "Request specific changes",
    "reschedule": "Major timing adjustments needed"
  },
  "nextSteps": "What happens after approval"
}`;

    try {
      const response = await this.llm.invoke([
        new SystemMessage('You are an expert at presenting productivity plans in compelling, user-friendly formats.'),
        new HumanMessage(presentationPrompt)
      ]);

      return JSON.parse(cleanLLMResponse(response.content));
    } catch (error) {
      console.error('❌ Schedule presentation error:', error);
      return {
        presentation: {
          title: "Your Productivity Schedule",
          overview: "A structured day plan optimized for your priorities and energy levels.",
          highlights: ["Focused work blocks", "Strategic break timing", "Priority task allocation"]
        },
        reasoning: { energyOptimization: "Standard energy patterns", priorityAlignment: "Based on stated priorities" },
        options: { approve: "Accept schedule", modify: "Request changes", reschedule: "Major adjustments" },
        nextSteps: "Schedule will be activated and notifications will begin"
      };
    }
  }

  /**
   * Approve and activate the daily schedule
   */
  async approveSchedule(scheduleOrModifications = {}) {
    try {
      const state = this.state.getState();
      if (!state.todaysPlan) {
        throw new Error('No proposed schedule to approve');
      }

      let finalSchedule;

      // Check if we received a complete schedule object or just modifications
      if (scheduleOrModifications.scheduleBlocks) {
        // Complete schedule object sent from frontend
        console.log('📅 Using modified schedule from frontend');
        console.log('📋 Received schedule blocks:', scheduleOrModifications.scheduleBlocks.length);
        console.log('🔍 First block:', scheduleOrModifications.scheduleBlocks[0]);
        finalSchedule = scheduleOrModifications;
      } else if (Object.keys(scheduleOrModifications).length > 0) {
        // Modifications object
        console.log('🔧 Applying modifications to existing schedule');
        finalSchedule = await applyScheduleModifications(state.todaysPlan.schedule, scheduleOrModifications);
      } else {
        // No modifications, use original schedule
        console.log('📋 Using original proposed schedule');
        finalSchedule = state.todaysPlan.schedule;
      }

      // Activate the schedule
      this.state.setTodaysPlan({
        ...state.todaysPlan,
        status: 'active',
        activatedAt: new Date()
      });
      this.state.activateExecutionMode();

      // Calculate target date from scheduling preferences
      const schedulingPrefs = state.currentSession?.userResponses?.scheduling || {};
      const targetDate = calculateTargetDate(schedulingPrefs);

      // Schedule all calendar events for the correct date
      await createCalendarEvents(this.calendar, finalSchedule, targetDate, () => calculateTargetDate(schedulingPrefs));

      // Set up automated notifications and Pomodoro timers
      await setupAutomatedExecution(finalSchedule, this.scheduledJobs);

      // Optional: Set up Pomodoro and Notification execution (safe integration)
      await setupPomodoroExecution(finalSchedule, targetDate, this.pomodoroManager, this.notificationManager);

      console.log('✅ Daily schedule approved and activated');

      return {
        success: true,
        message: 'Your optimized daily schedule is now active!',
        schedule: finalSchedule,
        nextEvent: this.getNextScheduledEvent(),
        executionStarted: true
      };
    } catch (error) {
      console.error('❌ Schedule approval error:', error);
      return {
        success: false,
        error: error.message,
        schedule: null
      };
    }
  }


  /**
   * Get the next scheduled event
   */
  getNextScheduledEvent() {
    const state = this.state.getState();
    if (!state.todaysPlan || !state.todaysPlan.schedule || !state.todaysPlan.schedule.scheduleBlocks) {
      return null;
    }

    const now = new Date();
    const currentTime = `${now.getHours().toString().padStart(2, '0')}:${now.getMinutes().toString().padStart(2, '0')}`;

    const upcomingBlocks = state.todaysPlan.schedule.scheduleBlocks.filter(
      block => block.startTime > currentTime
    );

    return upcomingBlocks.length > 0 ? upcomingBlocks[0] : null;
  }

  /**
   * Get orchestrator status
   */
  getStatus() {
    const state = this.state.getState();
    const status = {
      active: state.executionMode,
      currentSession: state.currentSession,
      todaysPlan: state.todaysPlan,
      scheduledJobs: this.scheduledJobs.size,
      nextEvent: this.getNextScheduledEvent(),
      integrations: {
        email: emailService.isAuth(),
        calendar: !!this.calendar,
        health: !!this.healthAnalytics,
        openai: !!process.env.OPENAI_API_KEY,
        pomodoro: !!this.pomodoroManager,
        notifications: !!this.notificationManager
      },
      lastUpdate: state.lastUpdate
    };

    // Add Pomodoro status if available
    if (this.pomodoroManager) {
      status.pomodoro = this.pomodoroManager.getStatus();
    }

    // Add notification status if available
    if (this.notificationManager) {
      status.notifications = this.notificationManager.getStatus();
    }

    return status;
  }
}

// Export singleton instance
module.exports = new ProductivityOrchestrator();