const { ChatOpenAI } = require('@langchain/openai');
const { ChatAnthropic } = require('@langchain/anthropic');
const { HumanMessage, SystemMessage } = require('@langchain/core/messages');
const emailService = require('./emailService');
const HealthAnalytics = require('./healthAnalytics');
const { google } = require('googleapis');
const cron = require('node-cron');
const notifier = require('node-notifier');

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

    // Agent state management
    this.state = {
      userPreferences: {},
      todaysPlan: null,
      currentSession: null,
      executionMode: false,
      conversationHistory: [],
      scheduledTasks: [],
      pomodoroActive: false,
      lastUpdate: null
    };

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
    this.initializeCalendar();

    // Scheduled jobs
    this.scheduledJobs = new Map();
    
    console.log('🧠 ProductivityOrchestrator initialized');
  }

  /**
   * Clean up LLM response content to handle markdown formatting
   */
  cleanLLMResponse(content) {
    let cleanContent = content.trim();
    if (cleanContent.startsWith('```json')) {
      cleanContent = cleanContent.replace(/```json\n?/, '').replace(/\n?```$/, '');
    }
    if (cleanContent.startsWith('```')) {
      cleanContent = cleanContent.replace(/```\n?/, '').replace(/\n?```$/, '');
    }
    return cleanContent;
  }

  /**
   * Initialize Google Calendar integration
   */
  async initializeCalendar() {
    try {
      const oauth2Client = new google.auth.OAuth2(
        process.env.GMAIL_CLIENT_ID,
        process.env.GMAIL_CLIENT_SECRET,
        'urn:ietf:wg:oauth:2.0:oob'
      );

      // Load stored tokens
      const fs = require('fs').promises;
      try {
        const token = await fs.readFile('/Users/damonbodine/Lifeops/lifeops/token.json');
        oauth2Client.setCredentials(JSON.parse(token));
        this.calendar = google.calendar({ version: 'v3', auth: oauth2Client });
        console.log('✅ Calendar integration ready');
      } catch (err) {
        console.log('⚠️ Calendar token not found');
      }
    } catch (error) {
      console.error('❌ Calendar initialization error:', error);
    }
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
    const currentTime = new Date();
    const timeOfDay = currentTime.getHours() < 12 ? 'morning' : 
                     currentTime.getHours() < 17 ? 'afternoon' : 'evening';

    const interviewPrompt = `You are an AI productivity coach conducting a daily planning interview. Your goal is to understand the user's priorities, energy, and preferences for today.

Current context:
- Time: ${currentTime.toLocaleString()}
- Time of day: ${timeOfDay}
- User input: ${initialInput || 'User is starting their daily planning session'}

Create a structured interview that captures:
1. Energy level and health status today (1-10 scale)
2. Preferred work style (deep focus, collaborative, admin tasks)
3. Any specific constraints or appointments  
4. Mood and stress level

IMPORTANT: Do NOT include questions about priorities or scheduling preferences - these will be handled by special structured UI sections that are automatically added.

Respond in this format:
{
  "greeting": "Personalized greeting for user",
  "questions": [
    "Question 1 about energy/health (1-10 scale)",
    "Question 2 about work style preference",
    "Question 3 about constraints/appointments",
    "Question 4 about mood/stress level"
  ],
  "structured_sections": {
    "priorities": {
      "title": "Today's Top 3 Priorities",
      "description": "Break down your most important tasks with time estimates",
      "placeholder_tasks": [
        "Most important task today",
        "Important but manageable task", 
        "Another key priority"
      ]
    }
  },
  "analysis": "Initial analysis based on time of day and context",
  "next_step": "What happens after user answers these questions"
}`;

    try {
      const response = await this.llm.invoke([
        new SystemMessage('You are an expert productivity coach and AI interview specialist.'),
        new HumanMessage(interviewPrompt)
      ]);

      let result = JSON.parse(this.cleanLLMResponse(response.content));
      
      // Ensure structured_sections exists and add scheduling section
      if (!result.structured_sections) {
        result.structured_sections = {};
      }
      
      // Always add scheduling section
      result.structured_sections.scheduling = {
        title: "When & How Long",
        description: "Choose the day and time period you want to optimize",
        day_options: [
          { value: "today", label: "Today", default: true },
          { value: "tomorrow", label: "Tomorrow" },
          { value: "custom", label: "Pick a Date" }
        ],
        time_block_options: [
          { value: "full_day", label: "Full Day (8 AM - 6 PM)", default: true },
          { value: "morning", label: "Morning Only (8 AM - 12 PM)" },
          { value: "afternoon", label: "Afternoon Only (12 PM - 6 PM)" },
          { value: "evening", label: "Evening Only (6 PM - 10 PM)" },
          { value: "work_hours", label: "Work Hours (9 AM - 5 PM)" },
          { value: "custom", label: "Custom Time Range" }
        ]
      };
      
      // Add priorities section if not already present
      if (!result.structured_sections.priorities) {
        result.structured_sections.priorities = {
          title: "Top 3 Priorities",
          description: "Break down your most important tasks with time estimates",
          placeholder_tasks: [
            "Most important task",
            "Important but manageable task", 
            "Another key priority"
          ]
        };
      }
        
      // Filter out priorities question from regular questions
      result.questions = result.questions.filter(q => 
        !q.toLowerCase().includes('priorities') && !q.toLowerCase().includes('top 3')
      );
      
      // Store interview in state
      this.state.currentSession = {
        startTime: new Date(),
        interviewQuestions: result.questions,
        userResponses: {},
        status: 'interviewing'
      };

      return result;
    } catch (error) {
      console.error('❌ Interview error:', error);
      return {
        greeting: `Good ${timeOfDay}! Let's plan your most productive day.`,
        questions: [
          "How's your energy level today on a scale of 1-10?",
          "Do you prefer deep focus work or collaborative tasks today?",
          "Any specific time constraints or important meetings?",
          "How are you feeling stress-wise? (relaxed/moderate/high stress)"
        ],
        structured_sections: {
          scheduling: {
            title: "When & How Long",
            description: "Choose the day and time period you want to optimize",
            day_options: [
              { value: "today", label: "Today", default: true },
              { value: "tomorrow", label: "Tomorrow" },
              { value: "custom", label: "Pick a Date" }
            ],
            time_block_options: [
              { value: "full_day", label: "Full Day (8 AM - 6 PM)", default: true },
              { value: "morning", label: "Morning Only (8 AM - 12 PM)" },
              { value: "afternoon", label: "Afternoon Only (12 PM - 6 PM)" },
              { value: "evening", label: "Evening Only (6 PM - 10 PM)" },
              { value: "work_hours", label: "Work Hours (9 AM - 5 PM)" },
              { value: "custom", label: "Custom Time Range" }
            ]
          },
          priorities: {
            title: "Top 3 Priorities",
            description: "Break down your most important tasks with time estimates",
            placeholder_tasks: [
              "Most important task",
              "Important but manageable task", 
              "Another key priority"
            ]
          }
        },
        analysis: "Starting daily planning session with standard productivity questions.",
        next_step: "Collect user responses and build personalized schedule"
      };
    }
  }

  /**
   * Process user responses to interview questions
   */
  async processInterviewResponses(responses) {
    try {
      if (!this.state.currentSession) {
        throw new Error('No active interview session');
      }

      // Store responses
      this.state.currentSession.userResponses = responses;
      this.state.currentSession.status = 'responses_collected';

      // Analyze responses with AI
      const analysisPrompt = `Analyze these user interview responses and extract key insights for daily planning:

User Responses:
${JSON.stringify(responses, null, 2)}

IMPORTANT SCHEDULING CONTEXT:
- Target Day: ${responses.scheduling?.targetDay || 'today'}
- Time Block: ${responses.scheduling?.timeBlock || 'full_day'}
- Custom Date: ${responses.scheduling?.customDate || 'N/A'}
- Custom Time Range: ${responses.scheduling?.customTimeRange ? `${responses.scheduling.customTimeRange.start} - ${responses.scheduling.customTimeRange.end}` : 'N/A'}

Note: The priorities field contains structured task data with time estimates. The scheduling field contains when and for how long the user wants to plan. Adjust your analysis to respect these scheduling constraints.

Extract and analyze:
1. Energy level and health considerations
2. Priority tasks and their urgency/importance
3. Preferred work style and timing
4. Constraints and time limitations
5. Stress/mood factors that affect planning

Provide specific insights that will help with intelligent scheduling.

Respond in JSON format:
{
  "energyProfile": {
    "level": 1-10,
    "peakTimes": ["morning", "afternoon", "evening"],
    "healthConsiderations": "Any health factors to consider"
  },
  "priorities": [
    {"task": "Priority 1", "urgency": "high/medium/low", "timeEstimate": "hours"},
    {"task": "Priority 2", "urgency": "high/medium/low", "timeEstimate": "hours"},
    {"task": "Priority 3", "urgency": "high/medium/low", "timeEstimate": "hours"}
  ],
  "workStyle": {
    "preference": "deep_focus/collaborative/mixed",
    "optimalBlockSize": "25min/90min/custom",
    "breakPreference": "short/long/flexible"
  },
  "constraints": {
    "timeBlocks": ["Any fixed commitments"],
    "deadlines": ["Time-sensitive items"],
    "limitations": "Any limiting factors"
  },
  "moodFactors": {
    "stressLevel": "low/medium/high",
    "motivation": "high/medium/low",
    "recommendations": "Mood-based scheduling suggestions"
  }
}`;

      const analysisResponse = await this.llm.invoke([
        new SystemMessage('You are an expert at analyzing productivity preferences and creating personalized work schedules.'),
        new HumanMessage(analysisPrompt)
      ]);

      const analysis = JSON.parse(this.cleanLLMResponse(analysisResponse.content));
      
      // Store analysis in user preferences
      this.state.userPreferences = {
        ...this.state.userPreferences,
        todaysProfile: analysis,
        lastUpdated: new Date()
      };

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
          this.getTodaysCalendarEvents().then(events => ({ source: 'calendar', data: events }))
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
      dataPromises.push(
        Promise.resolve({ source: 'tasks', data: this.state.scheduledTasks || [] })
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
   * Get today's calendar events
   */
  async getTodaysCalendarEvents() {
    if (!this.calendar) return [];

    try {
      const today = new Date();
      const tomorrow = new Date(today);
      tomorrow.setDate(tomorrow.getDate() + 1);

      const response = await this.calendar.events.list({
        calendarId: 'primary',
        timeMin: today.toISOString(),
        timeMax: tomorrow.toISOString(),
        singleEvents: true,
        orderBy: 'startTime',
      });

      return response.data.items || [];
    } catch (error) {
      console.error('❌ Calendar fetch error:', error);
      return [];
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

    const analysisPrompt = `You are an expert productivity analyst. Analyze this data to determine optimal scheduling patterns for today.

Collected Data Summary:
${JSON.stringify(summarizedData, null, 2)}

User Interview Analysis:
${JSON.stringify(this.state.userPreferences.todaysProfile, null, 2)}

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

      return JSON.parse(this.cleanLLMResponse(response.content));
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
   * Calculate the target date based on user scheduling preferences
   */
  calculateTargetDate(schedulingPrefs) {
    const targetDay = schedulingPrefs.targetDay || 'today';
    
    if (targetDay === 'today') {
      return new Date();
    } else if (targetDay === 'tomorrow') {
      const tomorrow = new Date();
      tomorrow.setDate(tomorrow.getDate() + 1);
      return tomorrow;
    } else if (targetDay === 'custom' && schedulingPrefs.customDate) {
      return new Date(schedulingPrefs.customDate);
    } else {
      // Fallback to today
      console.warn('⚠️ Unknown target day, falling back to today:', targetDay);
      return new Date();
    }
  }

  /**
   * Calculate scheduling constraints based on user preferences
   */
  calculateSchedulingConstraints(schedulingPrefs) {
    const timeBlock = schedulingPrefs.timeBlock || 'full_day';
    let startTime, endTime, availableHours;
    
    // Handle custom time range first
    if (timeBlock === 'custom' && schedulingPrefs.customTimeRange) {
      startTime = schedulingPrefs.customTimeRange.start;
      endTime = schedulingPrefs.customTimeRange.end;
    } else {
      // Use predefined time blocks
      switch (timeBlock) {
        case 'morning':
          startTime = '08:00';
          endTime = '12:00';
          break;
        case 'afternoon':
          startTime = '12:00';
          endTime = '18:00';
          break;
        case 'evening':
          startTime = '18:00';
          endTime = '22:00';
          break;
        case 'work_hours':
          startTime = '09:00';
          endTime = '17:00';
          break;
        case 'full_day':
        default:
          startTime = '08:00';
          endTime = '18:00';
          break;
      }
    }
    
    // Calculate available hours
    const start = new Date(`2000-01-01T${startTime}:00`);
    const end = new Date(`2000-01-01T${endTime}:00`);
    availableHours = Math.round((end - start) / (1000 * 60 * 60) * 10) / 10;
    
    return {
      startTime,
      endTime,
      availableHours,
      timeBlock
    };
  }

  /**
   * Build comprehensive daily schedule with Pomodoros and breaks
   */
  async buildDailySchedule(analysisResult, interviewResult) {
    // Extract scheduling constraints from user responses
    const schedulingPrefs = this.state.currentSession.userResponses?.scheduling || {};
    const targetDay = schedulingPrefs.targetDay || 'today';
    const timeBlock = schedulingPrefs.timeBlock || 'full_day';
    
    // Calculate target date and time constraints
    const constraints = this.calculateSchedulingConstraints(schedulingPrefs);
    
    const buildPrompt = `Create a comprehensive, time-blocked schedule optimized for maximum productivity.

SCHEDULING CONSTRAINTS:
- Target Day: ${targetDay}${schedulingPrefs.customDate ? ` (${schedulingPrefs.customDate})` : ''}
- Time Period: ${timeBlock}
- Schedule Window: ${constraints.startTime} to ${constraints.endTime}
- Available Hours: ${constraints.availableHours}

Analysis Results:
${JSON.stringify(analysisResult, null, 2)}

User Preferences:
${JSON.stringify(this.state.userPreferences.todaysProfile, null, 2)}

Current Time: ${new Date().toLocaleString()}

Build a detailed schedule including:
1. Specific time blocks for each priority task within the ${constraints.startTime}-${constraints.endTime} window
2. Pomodoro sessions (25min work + 5min break or 90min + 15min based on preference)
3. Email processing windows (if time allows)
4. Health-based break timing
5. Buffer time for unexpected tasks (if time allows)
6. Preparation time for meetings (if scheduled)

CRITICAL: All schedule blocks must fall within ${constraints.startTime} to ${constraints.endTime} (${constraints.availableHours} hours available).

Respond with a detailed JSON schedule:
{
  "scheduleBlocks": [
    {
      "startTime": "${constraints.startTime}",
      "endTime": "XX:XX", 
      "type": "pomodoro_work",
      "task": "Priority Task 1",
      "description": "Detailed task description",
      "pomodoroNumber": 1,
      "energy": "high"
    },
    {
      "startTime": "09:25",
      "endTime": "09:30",
      "type": "break",
      "task": "Short Break",
      "description": "5-minute break with movement",
      "energy": "recovery"
    }
  ],
  "summary": {
    "totalWorkTime": "6.5 hours",
    "totalBreakTime": "1.5 hours", 
    "pomodoroSessions": 12,
    "priorityTasksCovered": 3,
    "bufferTime": "30 minutes"
  },
  "recommendations": [
    "Hydrate during breaks",
    "Take a walk after lunch",
    "Review email only during scheduled times"
  ]
}`;

    try {
      const response = await this.llm.invoke([
        new SystemMessage('You are an expert at creating detailed, time-blocked productivity schedules with Pomodoro technique integration.'),
        new HumanMessage(buildPrompt)
      ]);

      let schedule;
      try {
        schedule = JSON.parse(this.cleanLLMResponse(response.content));
        // Validate schedule structure
        if (!this.validateScheduleStructure(schedule)) {
          console.warn('⚠️ Schedule validation failed, using fallback');
          schedule = this.getFallbackSchedule();
        } else {
          // Enforce time constraints on AI-generated schedule
          schedule = this.enforceTimeConstraints(schedule, constraints);
        }
      } catch (parseError) {
        console.error('❌ LLM returned non-JSON content:', response.content.substring(0, 100) + '...');
        // Provide fallback schedule
        schedule = this.getFallbackSchedule();
      }
      
      // Store proposed schedule
      this.state.todaysPlan = {
        schedule: schedule,
        status: 'proposed',
        createdAt: new Date()
      };

      return schedule;
    } catch (error) {
      console.error('❌ Schedule building error:', error);
      console.log('🔧 Using fallback schedule due to error');
      return this.getFallbackSchedule();
    }
  }

  /**
   * Present schedule for user approval with explanations
   */
  async presentScheduleForApproval(proposedSchedule) {
    const presentationPrompt = `Create a compelling presentation of this productivity schedule for user approval.

Proposed Schedule:
${JSON.stringify(proposedSchedule, null, 2)}

User Preferences:
${JSON.stringify(this.state.userPreferences.todaysProfile, null, 2)}

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

      return JSON.parse(this.cleanLLMResponse(response.content));
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
      if (!this.state.todaysPlan) {
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
        finalSchedule = await this.applyScheduleModifications(this.state.todaysPlan.schedule, scheduleOrModifications);
      } else {
        // No modifications, use original schedule
        console.log('📋 Using original proposed schedule');
        finalSchedule = this.state.todaysPlan.schedule;
      }

      // Activate the schedule
      this.state.todaysPlan.status = 'active';
      this.state.todaysPlan.activatedAt = new Date();
      this.state.executionMode = true;

      // Calculate target date from scheduling preferences
      const schedulingPrefs = this.state.currentSession?.userResponses?.scheduling || {};
      const targetDate = this.calculateTargetDate(schedulingPrefs);
      
      // Schedule all calendar events for the correct date
      await this.createCalendarEvents(finalSchedule, targetDate);

      // Set up automated notifications and Pomodoro timers
      await this.setupAutomatedExecution(finalSchedule);

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
   * Apply user modifications to the schedule
   */
  async applyScheduleModifications(schedule, modifications) {
    // Implementation for handling schedule modifications
    // This would involve AI-powered rescheduling based on user requests
    console.log('🔧 Applying schedule modifications:', modifications);
    return schedule; // Simplified for now
  }

  /**
   * Create calendar events for the schedule
   */
  async createCalendarEvents(schedule, targetDate = null) {
    if (!this.calendar) {
      console.log('⚠️ Calendar not available - events not created');
      return;
    }

    try {
      // Determine the target date for the schedule
      let scheduleDate;
      if (targetDate) {
        scheduleDate = new Date(targetDate);
      } else {
        // Fallback: try to get from stored scheduling preferences
        const schedulingPrefs = this.state.currentSession?.userResponses?.scheduling || {};
        scheduleDate = this.calculateTargetDate(schedulingPrefs);
      }
      
      console.log(`📅 Creating calendar events for: ${scheduleDate.toDateString()}`);
      console.log(`📅 ISO date: ${scheduleDate.toISOString().split('T')[0]}`);
      console.log(`📅 Input targetDate: ${targetDate}`);
      console.log(`📅 Scheduling prefs: ${JSON.stringify(this.state.currentSession?.userResponses?.scheduling || {})}`);
      const events = [];

      for (const block of schedule.scheduleBlocks) {
        if (block.type === 'pomodoro_work' || block.type === 'meeting' || block.type === 'admin') {
          const [startHour, startMin] = block.startTime.split(':');
          const [endHour, endMin] = block.endTime.split(':');
          
          const startTime = new Date(scheduleDate);
          startTime.setHours(parseInt(startHour), parseInt(startMin), 0, 0);
          
          const endTime = new Date(scheduleDate);
          endTime.setHours(parseInt(endHour), parseInt(endMin), 0, 0);

          const event = {
            summary: `🎯 ${block.task}`,
            description: `${block.description}\n\nScheduled by LifeOps AI Orchestrator`,
            start: { dateTime: startTime.toISOString() },
            end: { dateTime: endTime.toISOString() },
            colorId: block.type === 'pomodoro_work' ? '9' : '2' // Blue for work, green for other
          };

          events.push(event);
        }
      }

      // Create events in parallel
      const createPromises = events.map(event => 
        this.calendar.events.insert({
          calendarId: 'primary',
          resource: event
        })
      );

      await Promise.allSettled(createPromises);
      console.log(`✅ Created ${events.length} calendar events`);
    } catch (error) {
      console.error('❌ Calendar event creation error:', error);
    }
  }

  /**
   * Setup automated notifications and Pomodoro execution
   */
  async setupAutomatedExecution(schedule) {
    try {
      // Clear any existing scheduled jobs
      this.scheduledJobs.forEach(job => job.destroy());
      this.scheduledJobs.clear();

      const today = new Date();

      for (const block of schedule.scheduleBlocks) {
        const [hour, min] = block.startTime.split(':');
        const cronTime = `${min} ${hour} * * *`;

        // Schedule notification for each block
        const job = cron.schedule(cronTime, () => {
          this.sendNotification(block);
        });

        this.scheduledJobs.set(`${block.startTime}-${block.type}`, job);
      }

      console.log(`✅ Scheduled ${this.scheduledJobs.size} automated notifications`);
    } catch (error) {
      console.error('❌ Automated execution setup error:', error);
    }
  }

  /**
   * Send desktop notification for schedule events
   */
  sendNotification(block) {
    const icons = {
      pomodoro_work: '🎯',
      break: '☕',
      meeting: '👥',
      admin: '📋',
      email: '📧'
    };

    const title = `${icons[block.type] || '⏰'} ${block.task}`;
    const message = block.description || 'Time to focus!';

    notifier.notify({
      title: title,
      message: message,
      sound: true,
      wait: false,
      timeout: 10
    });

    console.log(`🔔 Notification sent: ${title}`);
  }

  /**
   * Get the next scheduled event
   */
  getNextScheduledEvent() {
    if (!this.state.todaysPlan || !this.state.todaysPlan.schedule || !this.state.todaysPlan.schedule.scheduleBlocks) {
      return null;
    }

    const now = new Date();
    const currentTime = `${now.getHours().toString().padStart(2, '0')}:${now.getMinutes().toString().padStart(2, '0')}`;

    const upcomingBlocks = this.state.todaysPlan.schedule.scheduleBlocks.filter(
      block => block.startTime > currentTime
    );

    return upcomingBlocks.length > 0 ? upcomingBlocks[0] : null;
  }

  /**
   * Validate schedule structure to ensure it meets required format
   */
  validateScheduleStructure(schedule) {
    try {
      // Check if schedule has required top-level properties
      if (!schedule || typeof schedule !== 'object') {
        return false;
      }

      // Check if scheduleBlocks exists and is an array
      if (!schedule.scheduleBlocks || !Array.isArray(schedule.scheduleBlocks)) {
        return false;
      }

      // Validate each schedule block
      for (const block of schedule.scheduleBlocks) {
        if (!block.startTime || !block.endTime || !block.type || !block.task) {
          return false;
        }
        
        // Validate time format (HH:MM)
        const timeRegex = /^([0-1]?[0-9]|2[0-3]):[0-5][0-9]$/;
        if (!timeRegex.test(block.startTime) || !timeRegex.test(block.endTime)) {
          return false;
        }
      }

      return true;
    } catch (error) {
      console.error('❌ Schedule validation error:', error);
      return false;
    }
  }

  /**
   * Add minutes to a time string (HH:MM format)
   */
  addMinutes(timeString, minutes) {
    const [hours, mins] = timeString.split(':').map(Number);
    const totalMinutes = hours * 60 + mins + minutes;
    const newHours = Math.floor(totalMinutes / 60) % 24;
    const newMins = totalMinutes % 60;
    return `${newHours.toString().padStart(2, '0')}:${newMins.toString().padStart(2, '0')}`;
  }

  /**
   * Get fallback schedule when LLM fails
   */
  getFallbackSchedule() {
    // Use scheduling constraints if available
    const schedulingPrefs = this.state.currentSession?.userResponses?.scheduling || {};
    const constraints = this.calculateSchedulingConstraints(schedulingPrefs);
    
    console.log(`🔧 Generating fallback schedule for ${constraints.timeBlock} (${constraints.startTime} - ${constraints.endTime}, ${constraints.availableHours} hours)`);
    
    const scheduleBlocks = [];
    const pomodoroSchedule = [];
    const breakSchedule = [];
    
    let currentTime = constraints.startTime;
    let blockId = 1;
    
    // Calculate how many blocks we can fit
    const totalMinutes = constraints.availableHours * 60;
    const blockDuration = Math.min(90, totalMinutes / 3); // 90 min max, or divide time into 3 blocks
    const shortBreak = 5;
    const longBreak = 15;
    
    // Generate blocks dynamically within the time constraints
    while (this.timeToMinutes(currentTime) < this.timeToMinutes(constraints.endTime) - 30) {
      const remainingMinutes = this.timeToMinutes(constraints.endTime) - this.timeToMinutes(currentTime);
      
      if (remainingMinutes <= 30) break; // Not enough time for another block
      
      // Determine block type and duration
      let blockType, task, description, duration;
      
      if (blockId === 1) {
        blockType = 'pomodoro_work';
        task = 'Priority Focus Session';
        description = 'Focus on your most important task';
        duration = Math.min(blockDuration, remainingMinutes - 5);
      } else if (remainingMinutes > 60) {
        blockType = 'pomodoro_work';
        task = `Focus Block ${blockId}`;
        description = 'Continue important project work';
        duration = Math.min(blockDuration, remainingMinutes - 5);
      } else {
        blockType = 'admin';
        task = 'Wrap-up & Admin';
        description = 'Complete remaining tasks and plan ahead';
        duration = Math.min(30, remainingMinutes);
      }
      
      const endTime = this.addMinutes(currentTime, duration);
      
      // Add work block
      scheduleBlocks.push({
        id: `block-${blockId}`,
        startTime: currentTime,
        endTime: endTime,
        type: blockType,
        task: task,
        description: description,
        pomodoroCount: Math.ceil(duration / 25),
        priority: blockId === 1 ? 'high' : 'medium'
      });
      
      // Add pomodoro sessions for this block
      let pomodoroStart = currentTime;
      for (let i = 0; i < Math.floor(duration / 25); i++) {
        pomodoroSchedule.push({
          startTime: pomodoroStart,
          type: 'work',
          duration: 25
        });
        
        if (i < Math.floor(duration / 25) - 1) {
          breakSchedule.push({
            startTime: this.addMinutes(pomodoroStart, 25),
            duration: 5,
            type: 'short'
          });
        }
        
        pomodoroStart = this.addMinutes(pomodoroStart, 30); // 25 min work + 5 min break
      }
      
      // Move to next block
      currentTime = this.addMinutes(endTime, blockId % 3 === 0 ? longBreak : shortBreak);
      blockId++;
      
      // Don't create too many blocks
      if (blockId > 6) break;
    }
    
    return {
      metadata: {
        createdAt: new Date().toISOString(),
        optimizedFor: ['productivity', 'focus'],
        totalBlocks: scheduleBlocks.length,
        pomodoroSessions: pomodoroSchedule.length,
        fallback: true,
        timeBlock: constraints.timeBlock,
        availableHours: constraints.availableHours
      },
      scheduleBlocks: scheduleBlocks,
      pomodoroSchedule: pomodoroSchedule,
      breakSchedule: breakSchedule,
      summary: {
        totalWorkTime: `${Math.round(scheduleBlocks.reduce((sum, block) => sum + this.timeToMinutes(block.endTime) - this.timeToMinutes(block.startTime), 0) / 60 * 10) / 10} hours`,
        totalBreakTime: `${Math.round(breakSchedule.reduce((sum, br) => sum + br.duration, 0) / 60 * 10) / 10} hours`,
        pomodoroSessions: pomodoroSchedule.length,
        priorityTasksCovered: scheduleBlocks.filter(b => b.priority === 'high').length,
        scheduleWindow: `${constraints.startTime} - ${constraints.endTime}`
      }
    };
  }

  /**
   * Convert time string (HH:MM) to minutes from midnight
   */
  timeToMinutes(timeString) {
    const [hours, minutes] = timeString.split(':').map(Number);
    return hours * 60 + minutes;
  }

  /**
   * Enforce time constraints on AI-generated schedule
   */
  enforceTimeConstraints(schedule, constraints) {
    if (!schedule || !schedule.scheduleBlocks || !Array.isArray(schedule.scheduleBlocks)) {
      return schedule;
    }

    console.log(`🔒 Enforcing time constraints: ${constraints.startTime} - ${constraints.endTime}`);
    
    const startMinutes = this.timeToMinutes(constraints.startTime);
    const endMinutes = this.timeToMinutes(constraints.endTime);
    
    // Filter and adjust blocks to fit within constraints
    const adjustedBlocks = [];
    
    for (const block of schedule.scheduleBlocks) {
      const blockStartMinutes = this.timeToMinutes(block.startTime);
      const blockEndMinutes = this.timeToMinutes(block.endTime);
      
      // Skip blocks that are completely outside the time window
      if (blockEndMinutes <= startMinutes || blockStartMinutes >= endMinutes) {
        console.log(`⚠️ Skipping block outside time window: ${block.startTime} - ${block.endTime}`);
        continue;
      }
      
      // Adjust block times to fit within constraints
      let adjustedStartTime = block.startTime;
      let adjustedEndTime = block.endTime;
      
      // Adjust start time if it's before the constraint window
      if (blockStartMinutes < startMinutes) {
        adjustedStartTime = constraints.startTime;
        console.log(`⚠️ Adjusted block start time from ${block.startTime} to ${adjustedStartTime}`);
      }
      
      // Adjust end time if it's after the constraint window
      if (blockEndMinutes > endMinutes) {
        adjustedEndTime = constraints.endTime;
        console.log(`⚠️ Adjusted block end time from ${block.endTime} to ${adjustedEndTime}`);
      }
      
      // Only add block if it still has meaningful duration (at least 15 minutes)
      if (this.timeToMinutes(adjustedEndTime) - this.timeToMinutes(adjustedStartTime) >= 15) {
        adjustedBlocks.push({
          ...block,
          startTime: adjustedStartTime,
          endTime: adjustedEndTime
        });
      }
    }
    
    // If no blocks remain, use fallback schedule
    if (adjustedBlocks.length === 0) {
      console.log('⚠️ No blocks fit within time constraints, using fallback schedule');
      return this.getFallbackSchedule();
    }
    
    // Update schedule with adjusted blocks
    const adjustedSchedule = {
      ...schedule,
      scheduleBlocks: adjustedBlocks
    };
    
    // Update summary if it exists
    if (adjustedSchedule.summary) {
      adjustedSchedule.summary.scheduleWindow = `${constraints.startTime} - ${constraints.endTime}`;
      adjustedSchedule.summary.totalBlocks = adjustedBlocks.length;
    }
    
    console.log(`✅ Enforced time constraints: ${adjustedBlocks.length} blocks within ${constraints.startTime} - ${constraints.endTime}`);
    return adjustedSchedule;
  }

  /**
   * Get orchestrator status
   */
  getStatus() {
    return {
      active: this.state.executionMode,
      currentSession: this.state.currentSession,
      todaysPlan: this.state.todaysPlan,
      scheduledJobs: this.scheduledJobs.size,
      nextEvent: this.getNextScheduledEvent(),
      integrations: {
        email: emailService.isAuth(),
        calendar: !!this.calendar,
        health: !!this.healthAnalytics,
        openai: !!process.env.OPENAI_API_KEY
      },
      lastUpdate: this.state.lastUpdate
    };
  }
}

// Export singleton instance
module.exports = new ProductivityOrchestrator();