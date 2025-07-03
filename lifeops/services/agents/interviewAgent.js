const { ChatOpenAI } = require('@langchain/openai');
const { HumanMessage, SystemMessage } = require('@langchain/core/messages');

/**
 * InterviewAgent - Specialized agent for conducting intelligent daily interviews
 * Handles conversational planning, clarifying questions, and preference learning
 */
class InterviewAgent {
  constructor() {
    this.llm = new ChatOpenAI({
      apiKey: process.env.OPENAI_API_KEY,
      modelName: 'gpt-4',
      temperature: 0.8, // More creative for natural conversation
    });

    this.conversationState = {
      currentInterview: null,
      userProfile: {},
      conversationHistory: [],
      questionSequence: [],
      responsesSoFar: {}
    };

    // Question categories for comprehensive planning
    this.questionCategories = {
      energy: [
        "How's your energy level today on a scale of 1-10?",
        "Did you sleep well last night? Any factors affecting your energy?",
        "When do you typically feel most alert and focused during the day?",
        "Are there any health considerations I should factor into your schedule?"
      ],
      priorities: [
        "What are your top 3 most important tasks for today?",
        "Which of these tasks is most time-sensitive or has the earliest deadline?",
        "Are there any tasks you've been putting off that need attention today?",
        "What would make today feel like a successful, productive day for you?"
      ],
      workStyle: [
        "Do you prefer long, uninterrupted focus sessions or shorter, more frequent work blocks?",
        "Are you feeling more collaborative today, or do you need deep, solo focus time?",
        "How do you handle interruptions best - with built-in buffer time or protected focus blocks?",
        "What's your ideal work environment today - complete quiet or some background activity?"
      ],
      schedule: [
        "Do you have any fixed appointments, meetings, or commitments today?",
        "What time do you typically like to start your most important work?",
        "Are there any activities you want to make sure we schedule time for (exercise, calls, etc.)?",
        "How flexible is your schedule today - can we move things around if needed?"
      ],
      mood: [
        "How are you feeling mentally today - stressed, calm, excited, overwhelmed?",
        "Is there anything on your mind that might affect your focus or productivity?",
        "What kind of work feels energizing to you right now versus draining?",
        "Do you need more structure today or more flexibility in your schedule?"
      ]
    };

    console.log('🗣️ InterviewAgent initialized');
  }

  /**
   * Start a comprehensive daily interview
   */
  async startDailyInterview(userContext = {}) {
    try {
      const currentTime = new Date();
      const timeOfDay = this.getTimeOfDay(currentTime);
      
      // Initialize interview session
      this.conversationState.currentInterview = {
        startTime: currentTime,
        timeOfDay: timeOfDay,
        userContext: userContext,
        phase: 'greeting',
        questionsAsked: 0,
        responsesCollected: {}
      };

      // Generate personalized greeting and first questions
      const greetingPrompt = this.buildGreetingPrompt(timeOfDay, userContext);
      
      const response = await this.llm.invoke([
        new SystemMessage(this.getSystemPrompt()),
        new HumanMessage(greetingPrompt)
      ]);

      const interviewStart = JSON.parse(response.content);
      
      // Store the initial questions
      this.conversationState.questionSequence = interviewStart.questions;
      this.conversationState.currentInterview.phase = 'questioning';

      return {
        success: true,
        greeting: interviewStart.greeting,
        firstQuestion: interviewStart.questions[0],
        totalQuestions: interviewStart.questions.length,
        context: interviewStart.context,
        sessionId: this.generateSessionId()
      };
    } catch (error) {
      console.error('❌ Interview start error:', error);
      return this.getFallbackInterview();
    }
  }

  /**
   * Process user response and determine next question
   */
  async processResponse(userResponse, questionIndex = null) {
    try {
      if (!this.conversationState.currentInterview) {
        throw new Error('No active interview session');
      }

      const currentQuestionIndex = questionIndex || this.conversationState.currentInterview.questionsAsked;
      const currentQuestion = this.conversationState.questionSequence[currentQuestionIndex];

      // Store the response
      this.conversationState.responsesCollected[currentQuestionIndex] = {
        question: currentQuestion,
        response: userResponse,
        timestamp: new Date()
      };

      this.conversationState.currentInterview.questionsAsked += 1;

      // Analyze the response for follow-up questions or next steps
      const analysisPrompt = this.buildResponseAnalysisPrompt(currentQuestion, userResponse);
      
      const analysisResponse = await this.llm.invoke([
        new SystemMessage(this.getAnalysisSystemPrompt()),
        new HumanMessage(analysisPrompt)
      ]);

      const analysis = JSON.parse(analysisResponse.content);

      // Determine if we need follow-up questions
      if (analysis.needsFollowUp) {
        return await this.generateFollowUpQuestion(analysis, userResponse);
      }

      // Check if we have more standard questions
      if (this.conversationState.currentInterview.questionsAsked < this.conversationState.questionSequence.length) {
        const nextQuestion = this.conversationState.questionSequence[this.conversationState.currentInterview.questionsAsked];
        
        return {
          type: 'next_question',
          question: nextQuestion,
          questionNumber: this.conversationState.currentInterview.questionsAsked + 1,
          totalQuestions: this.conversationState.questionSequence.length,
          analysis: analysis.insights,
          progress: this.getInterviewProgress()
        };
      }

      // Interview complete - generate final analysis
      return await this.completeInterview();

    } catch (error) {
      console.error('❌ Response processing error:', error);
      return {
        type: 'error',
        message: 'I had trouble processing that response. Could you please rephrase?',
        canRetry: true
      };
    }
  }

  /**
   * Generate intelligent follow-up questions based on responses
   */
  async generateFollowUpQuestion(analysis, userResponse) {
    const followUpPrompt = `Based on the user's response and analysis, generate a relevant follow-up question that will help with daily planning.

User Response: "${userResponse}"
Analysis: ${JSON.stringify(analysis, null, 2)}

Generate a follow-up question that:
1. Clarifies ambiguous information
2. Digs deeper into important planning details
3. Helps understand user preferences better
4. Is natural and conversational

Respond in JSON format:
{
  "followUpQuestion": "The specific follow-up question to ask",
  "reasoning": "Why this follow-up is important for planning",
  "category": "energy/priorities/workStyle/schedule/mood",
  "isOptional": true/false
}`;

    try {
      const response = await this.llm.invoke([
        new SystemMessage('You are an expert at asking clarifying questions for productivity planning.'),
        new HumanMessage(followUpPrompt)
      ]);

      const followUp = JSON.parse(response.content);

      return {
        type: 'follow_up',
        question: followUp.followUpQuestion,
        reasoning: followUp.reasoning,
        category: followUp.category,
        isOptional: followUp.isOptional,
        canSkip: followUp.isOptional,
        progress: this.getInterviewProgress()
      };
    } catch (error) {
      console.error('❌ Follow-up generation error:', error);
      return this.getNextStandardQuestion();
    }
  }

  /**
   * Complete the interview and generate comprehensive analysis
   */
  async completeInterview() {
    try {
      const completionPrompt = this.buildCompletionPrompt();
      
      const response = await this.llm.invoke([
        new SystemMessage(this.getCompletionSystemPrompt()),
        new HumanMessage(completionPrompt)
      ]);

      const analysis = JSON.parse(response.content);
      
      // Mark interview as complete
      this.conversationState.currentInterview.phase = 'completed';
      this.conversationState.currentInterview.completedAt = new Date();
      this.conversationState.currentInterview.finalAnalysis = analysis;

      // Update user profile with learned preferences
      this.updateUserProfile(analysis);

      return {
        type: 'completion',
        success: true,
        summary: analysis.summary,
        userProfile: analysis.userProfile,
        recommendations: analysis.recommendations,
        readyForScheduling: true,
        analysis: analysis
      };
    } catch (error) {
      console.error('❌ Interview completion error:', error);
      return {
        type: 'completion',
        success: false,
        error: 'Error completing interview analysis',
        analysis: this.generateBasicAnalysis()
      };
    }
  }

  /**
   * Generate adaptive follow-up questions based on user responses
   */
  async generateAdaptiveQuestions(context) {
    const adaptivePrompt = `Based on the conversation so far, generate 2-3 intelligent follow-up questions that will help create the best possible daily schedule.

Conversation Context:
${JSON.stringify(context, null, 2)}

Current Responses:
${JSON.stringify(this.conversationState.responsesCollected, null, 2)}

Generate questions that:
1. Fill in any gaps in understanding
2. Clarify scheduling preferences 
3. Understand energy patterns better
4. Address any productivity challenges mentioned

Respond in JSON format:
{
  "adaptiveQuestions": [
    {
      "question": "Specific question text",
      "category": "energy/priorities/workStyle/schedule/mood",
      "importance": "high/medium/low",
      "reasoning": "Why this question helps with scheduling"
    }
  ],
  "priority": "Which question should be asked first",
  "canProceedWithoutAnswers": true/false
}`;

    try {
      const response = await this.llm.invoke([
        new SystemMessage('You are an expert at generating contextual follow-up questions for productivity planning.'),
        new HumanMessage(adaptivePrompt)
      ]);

      return JSON.parse(response.content);
    } catch (error) {
      console.error('❌ Adaptive questions error:', error);
      return {
        adaptiveQuestions: [],
        priority: null,
        canProceedWithoutAnswers: true
      };
    }
  }

  /**
   * Handle clarification requests from users
   */
  async handleClarificationRequest(userQuestion) {
    const clarificationPrompt = `The user is asking for clarification about the daily planning process.

User Question: "${userQuestion}"

Provide a helpful, clear explanation that:
1. Answers their specific question
2. Explains how this helps with daily planning
3. Encourages them to continue the interview
4. Is friendly and supportive

Respond in JSON format:
{
  "clarification": "Clear explanation for the user",
  "encouragement": "Motivational message to continue",
  "nextStep": "What should happen next in the interview"
}`;

    try {
      const response = await this.llm.invoke([
        new SystemMessage('You are a helpful productivity coach providing clear explanations.'),
        new HumanMessage(clarificationPrompt)
      ]);

      return JSON.parse(response.content);
    } catch (error) {
      console.error('❌ Clarification error:', error);
      return {
        clarification: "I'm here to help you plan the most productive day possible by understanding your priorities, energy levels, and preferences.",
        encouragement: "The more I understand about your needs today, the better I can optimize your schedule!",
        nextStep: "Let's continue with the planning questions."
      };
    }
  }

  /**
   * Build greeting prompt based on time of day and context
   */
  buildGreetingPrompt(timeOfDay, userContext) {
    return `You are starting a daily productivity planning interview. The user wants to create an optimized daily schedule.

Current Context:
- Time of day: ${timeOfDay}
- Current time: ${new Date().toLocaleString()}
- User context: ${JSON.stringify(userContext)}

Generate a warm, personalized greeting and 4-5 strategic questions to understand:
1. Energy level and health status
2. Top priorities for today
3. Preferred work style and timing
4. Schedule constraints and commitments
5. Mood and stress factors

Make the questions conversational and specific to the time of day. Be encouraging and professional.

Respond in JSON format:
{
  "greeting": "Personalized greeting based on time of day",
  "questions": [
    "Question 1 about energy/health",
    "Question 2 about priorities",
    "Question 3 about work style", 
    "Question 4 about schedule constraints",
    "Question 5 about mood/stress"
  ],
  "context": "Brief explanation of what happens next"
}`;
  }

  /**
   * Build response analysis prompt
   */
  buildResponseAnalysisPrompt(question, userResponse) {
    return `Analyze this user response to determine if follow-up questions are needed.

Question Asked: "${question}"
User Response: "${userResponse}"

Analyze:
1. Is the response clear and complete?
2. Does it provide enough detail for scheduling?
3. Are there any ambiguities that need clarification?
4. What insights can be extracted for daily planning?

Respond in JSON format:
{
  "needsFollowUp": true/false,
  "insights": "Key insights extracted from the response",
  "ambiguities": ["Any unclear aspects that need clarification"],
  "planningRelevance": "How this information helps with scheduling",
  "confidence": "high/medium/low confidence in understanding the response"
}`;
  }

  /**
   * Build completion prompt for final analysis
   */
  buildCompletionPrompt() {
    return `Analyze all responses from this daily planning interview and create a comprehensive user profile.

All Responses:
${JSON.stringify(this.conversationState.responsesCollected, null, 2)}

Time of Day: ${this.conversationState.currentInterview.timeOfDay}
Interview Duration: ${this.getInterviewDuration()}

Create a complete analysis including:
1. Energy patterns and health considerations
2. Priority tasks with time estimates
3. Work style preferences and optimal timing
4. Schedule constraints and flexibility
5. Mood factors affecting productivity

Respond in JSON format:
{
  "summary": "Brief summary of today's planning priorities",
  "userProfile": {
    "energyLevel": 1-10,
    "peakTimes": ["morning/afternoon/evening"],
    "workStyle": "deep_focus/collaborative/mixed",
    "stressLevel": "low/medium/high",
    "flexibility": "high/medium/low"
  },
  "priorities": [
    {
      "task": "Priority task name",
      "urgency": "high/medium/low", 
      "timeEstimate": "estimated hours",
      "preferredTiming": "morning/afternoon/evening",
      "complexity": "high/medium/low"
    }
  ],
  "constraints": {
    "fixedCommitments": ["List of fixed time blocks"],
    "preferredBreaks": "break preferences",
    "workingHours": "preferred working hours"
  },
  "recommendations": [
    "Specific scheduling recommendation 1",
    "Specific scheduling recommendation 2",
    "Specific scheduling recommendation 3"
  ]
}`;
  }

  /**
   * Get system prompt for the interview agent
   */
  getSystemPrompt() {
    return `You are an expert productivity coach and AI interview specialist. Your role is to conduct intelligent daily planning interviews that help users create optimized schedules.

Your goals:
1. Understand the user's energy patterns, priorities, and preferences
2. Ask strategic questions that inform intelligent scheduling
3. Be conversational, encouraging, and efficient
4. Adapt questions based on user responses
5. Extract actionable insights for daily planning

Always respond in valid JSON format as specified in the prompts.`;
  }

  /**
   * Get analysis system prompt
   */
  getAnalysisSystemPrompt() {
    return `You are an expert at analyzing user responses for productivity planning. Determine if responses provide enough information for scheduling or if follow-up questions are needed.

Focus on extracting specific, actionable insights that will help create an optimized daily schedule.`;
  }

  /**
   * Get completion system prompt  
   */
  getCompletionSystemPrompt() {
    return `You are an expert at synthesizing interview data into comprehensive user profiles for productivity scheduling. Create detailed analysis that will enable intelligent daily schedule creation.`;
  }

  /**
   * Utility methods
   */
  getTimeOfDay(time) {
    const hour = time.getHours();
    if (hour < 6) return 'early_morning';
    if (hour < 12) return 'morning';
    if (hour < 17) return 'afternoon';
    if (hour < 21) return 'evening';
    return 'night';
  }

  generateSessionId() {
    return `interview_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }

  getInterviewProgress() {
    const total = this.conversationState.questionSequence.length;
    const completed = this.conversationState.currentInterview?.questionsAsked || 0;
    return {
      completed: completed,
      total: total,
      percentage: Math.round((completed / total) * 100)
    };
  }

  getInterviewDuration() {
    if (!this.conversationState.currentInterview) return 0;
    return Date.now() - this.conversationState.currentInterview.startTime.getTime();
  }

  updateUserProfile(analysis) {
    this.conversationState.userProfile = {
      ...this.conversationState.userProfile,
      lastInterview: analysis,
      lastUpdate: new Date(),
      interviewCount: (this.conversationState.userProfile.interviewCount || 0) + 1
    };
  }

  getFallbackInterview() {
    return {
      success: true,
      greeting: "Good morning! Let's plan your most productive day together.",
      firstQuestion: "How's your energy level today on a scale of 1-10?",
      totalQuestions: 5,
      context: "I'll ask a few questions to understand your priorities and create an optimized schedule.",
      sessionId: this.generateSessionId()
    };
  }

  getNextStandardQuestion() {
    const nextIndex = this.conversationState.currentInterview.questionsAsked;
    if (nextIndex < this.conversationState.questionSequence.length) {
      return {
        type: 'next_question',
        question: this.conversationState.questionSequence[nextIndex],
        questionNumber: nextIndex + 1,
        totalQuestions: this.conversationState.questionSequence.length,
        progress: this.getInterviewProgress()
      };
    }
    return this.completeInterview();
  }

  generateBasicAnalysis() {
    return {
      summary: "Basic productivity planning analysis",
      userProfile: {
        energyLevel: 7,
        peakTimes: ["morning"],
        workStyle: "mixed",
        stressLevel: "medium",
        flexibility: "medium"
      },
      priorities: [
        { task: "Priority tasks", urgency: "medium", timeEstimate: "2-3 hours", preferredTiming: "morning", complexity: "medium" }
      ],
      constraints: { fixedCommitments: [], preferredBreaks: "standard", workingHours: "9am-5pm" },
      recommendations: ["Focus on high-priority tasks during peak energy times", "Schedule regular breaks", "Batch similar tasks together"]
    };
  }

  /**
   * Get agent status
   */
  getStatus() {
    return {
      active: !!this.conversationState.currentInterview,
      currentPhase: this.conversationState.currentInterview?.phase || 'idle',
      questionsAsked: this.conversationState.currentInterview?.questionsAsked || 0,
      totalQuestions: this.conversationState.questionSequence.length,
      progress: this.getInterviewProgress(),
      sessionDuration: this.getInterviewDuration(),
      hasUserProfile: Object.keys(this.conversationState.userProfile).length > 0
    };
  }
}

module.exports = InterviewAgent;