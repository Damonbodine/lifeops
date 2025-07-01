# 🧠 LangGraph Implementation Guide for LifeOps

> **Comprehensive guide for implementing the AI brain of LifeOps using LangGraph nodes and workflows**

---

## 🎯 LangGraph Overview for LifeOps

LangGraph serves as the intelligent orchestration layer for LifeOps, managing complex decision-making workflows that adapt to user context, preferences, and real-time data. Each node represents a specialized AI capability that can be composed into powerful workflows.

### Core LangGraph Principles in LifeOps

1. **Stateful Conversations**: Maintain context across interactions
2. **Conditional Routing**: Dynamic workflow paths based on data
3. **Human-in-the-Loop**: User confirmation for significant decisions
4. **Error Recovery**: Graceful handling of AI failures
5. **Performance Optimization**: Efficient node execution and caching

---

## 🏗️ Graph Architecture Design

### Master Graph Structure

```typescript
import { StateGraph, START, END } from "@langchain/langgraph";
import { BaseMessage } from "@langchain/core/messages";

interface LifeOpsState {
  // Core context
  userContext: {
    currentMood: MoodData;
    energyLevel: number;
    currentActivity: string;
    timeOfDay: Date;
  };
  
  // Input processing
  rawInputs: {
    voiceTranscription?: string;
    appUsageData?: AppUsageData[];
    calendarEvents?: CalendarEvent[];
    emailContent?: EmailData[];
    messageContent?: MessageData[];
  };

  // Processed data
  processedData: {
    extractedTasks?: Task[];
    moodAnalysis?: MoodAnalysis;
    scheduleConflicts?: ScheduleConflict[];
    prioritizedTasks?: TaskStructure;
  };

  // AI outputs
  aiOutputs: {
    dailyPlan?: DailyPlan;
    taskRecommendations?: TaskRecommendation[];
    scheduleAdjustments?: ScheduleAdjustment[];
    productivityInsights?: ProductivityInsight[];
    conversationResponse?: string;
  };

  // User interactions
  userFeedback: {
    confirmations?: UserConfirmation[];
    modifications?: UserModification[];
    satisfaction?: number;
  };

  // Error handling
  errors: GraphError[];
  retryCount: number;
}

const lifeOpsGraph = new StateGraph<LifeOpsState>({
  channels: {
    userContext: { value: null },
    rawInputs: { value: null },
    processedData: { value: null },
    aiOutputs: { value: null },
    userFeedback: { value: null },
    errors: { value: [] },
    retryCount: { value: 0 }
  }
});
```

### Graph Flow Definition

```typescript
// Define the main workflow
lifeOpsGraph
  .addNode("contextCollector", contextCollectorNode)
  .addNode("moodInterpreter", moodInterpreterNode)
  .addNode("taskClassifier", taskClassifierNode)
  .addNode("scheduleBuilder", scheduleBuilderNode)
  .addNode("voiceIntentHandler", voiceIntentHandlerNode)
  .addNode("productivityEvaluator", productivityEvaluatorNode)
  .addNode("conflictResolver", conflictResolverNode)
  .addNode("userConfirmation", userConfirmationNode)
  .addNode("executionCoordinator", executionCoordinatorNode)
  .addNode("errorHandler", errorHandlerNode);

// Define conditional edges
lifeOpsGraph
  .addEdge(START, "contextCollector")
  .addConditionalEdges("contextCollector", routeBasedOnInputType)
  .addConditionalEdges("moodInterpreter", routeBasedOnMoodState)
  .addConditionalEdges("taskClassifier", routeBasedOnTaskComplexity)
  .addConditionalEdges("scheduleBuilder", routeBasedOnConflicts)
  .addConditionalEdges("userConfirmation", routeBasedOnUserResponse)
  .addEdge("executionCoordinator", END);

// Error handling edges
lifeOpsGraph
  .addEdge("errorHandler", "contextCollector") // Retry from beginning
  .addConditionalEdges("*", routeToErrorHandler); // Catch all errors
```

---

## 🧩 Individual Node Implementations

### 1. Context Collector Node

```typescript
import { RunnableConfig } from "@langchain/core/runnables";

interface ContextCollectorInput {
  timestamp: Date;
  triggeredBy: "voice" | "app_change" | "calendar_sync" | "scheduled" | "user_action";
  rawData: any;
}

async function contextCollectorNode(
  state: LifeOpsState,
  config: RunnableConfig
): Promise<Partial<LifeOpsState>> {
  try {
    // Gather current system context
    const currentApp = await getCurrentActiveApp();
    const calendarEvents = await getUpcomingCalendarEvents(24); // Next 24 hours
    const recentAppUsage = await getRecentAppUsage(2); // Last 2 hours
    const lastMoodEntry = await getLastMoodEntry();
    const pendingTasks = await getPendingTasks();

    // Enrich context with historical patterns
    const behaviorPatterns = await getUserBehaviorPatterns();
    const energyPattern = await predictEnergyLevel(new Date());

    const enrichedContext = {
      currentMood: lastMoodEntry || { valence: 0, arousal: 0.5, confidence: 0.3 },
      energyLevel: energyPattern.predicted,
      currentActivity: categorizeActivity(currentApp),
      timeOfDay: new Date(),
      behaviorContext: {
        patterns: behaviorPatterns,
        recentUsage: recentAppUsage,
        upcomingEvents: calendarEvents,
        taskBacklog: pendingTasks
      }
    };

    return {
      userContext: enrichedContext,
      rawInputs: {
        ...state.rawInputs,
        appUsageData: recentAppUsage,
        calendarEvents: calendarEvents
      }
    };

  } catch (error) {
    return {
      errors: [...state.errors, {
        node: "contextCollector",
        error: error.message,
        timestamp: new Date(),
        recoverable: true
      }]
    };
  }
}
```

### 2. Mood Interpreter Node

```typescript
import { ChatOpenAI } from "@langchain/openai";
import { PromptTemplate } from "@langchain/core/prompts";

const moodAnalysisPrompt = PromptTemplate.fromTemplate(`
You are an expert mood interpreter for a productivity app. Analyze the user's current emotional state based on multiple data sources.

Current Context:
- Time of day: {timeOfDay}
- Recent app usage: {recentApps}
- Voice input (if any): {voiceInput}
- Calendar pressure: {calendarPressure}
- Previous mood: {previousMood}

Analyze and respond with a JSON object containing:
1. mood: {{ valence: -1 to 1, arousal: 0 to 1, confidence: 0 to 1 }}
2. energy: {{ level: 0 to 10, sustainability: hours, recommendation: string }}
3. workRecommendations: {{ taskIntensity: "low"|"medium"|"high", breakFrequency: minutes, socialPreference: "avoid"|"neutral"|"seek" }}
4. reasoning: string explaining your analysis

Be empathetic and consider the holistic picture of the user's state.
`);

async function moodInterpreterNode(
  state: LifeOpsState,
  config: RunnableConfig
): Promise<Partial<LifeOpsState>> {
  const llm = new ChatOpenAI({
    modelName: "gpt-4",
    temperature: 0.3,
    maxTokens: 1000
  });

  try {
    // Prepare context for mood analysis
    const context = {
      timeOfDay: state.userContext.timeOfDay.toLocaleString(),
      recentApps: state.rawInputs.appUsageData?.slice(-5).map(app => app.appName).join(", "),
      voiceInput: state.rawInputs.voiceTranscription || "None",
      calendarPressure: calculateCalendarPressure(state.rawInputs.calendarEvents),
      previousMood: JSON.stringify(state.userContext.currentMood)
    };

    const chain = moodAnalysisPrompt.pipe(llm);
    const response = await chain.invoke(context);
    
    const moodAnalysis = JSON.parse(response.content as string);

    // Validate and sanitize the response
    const validatedMood = validateMoodData(moodAnalysis);

    // Store mood analysis for future reference
    await saveMoodEntry({
      ...validatedMood.mood,
      timestamp: new Date(),
      source: "ai_analysis",
      context: context,
      reasoning: validatedMood.reasoning
    });

    return {
      processedData: {
        ...state.processedData,
        moodAnalysis: validatedMood
      },
      userContext: {
        ...state.userContext,
        currentMood: validatedMood.mood,
        energyLevel: validatedMood.energy.level
      }
    };

  } catch (error) {
    // Fallback to previous mood data
    return {
      errors: [...state.errors, {
        node: "moodInterpreter",
        error: error.message,
        timestamp: new Date(),
        recoverable: true,
        fallbackUsed: true
      }]
    };
  }
}

function calculateCalendarPressure(events: CalendarEvent[]): string {
  if (!events || events.length === 0) return "low";
  
  const upcomingCount = events.filter(e => 
    new Date(e.start) > new Date() && 
    new Date(e.start) < new Date(Date.now() + 4 * 60 * 60 * 1000) // Next 4 hours
  ).length;
  
  if (upcomingCount >= 3) return "high";
  if (upcomingCount >= 1) return "medium";
  return "low";
}
```

### 3. Task Classifier Node

```typescript
const taskClassificationPrompt = PromptTemplate.fromTemplate(`
You are a task classification expert for a productivity system that uses the 1-3-5 method (1 big task, 3 medium tasks, 5 small tasks).

Input Sources:
- Email content: {emailContent}
- Voice notes: {voiceNotes}
- Slack messages: {slackMessages}
- Manual tasks: {manualTasks}
- iMessage content: {messageContent}

Current Context:
- User's energy level: {energyLevel}/10
- Available time today: {availableTime} hours
- Current mood: {mood}
- Existing tasks: {existingTasks}

Extract and classify tasks using these criteria:
- BIG (1): High impact, 2+ hours, requires deep focus, deadline-sensitive
- MEDIUM (3): Moderate impact, 30-90 minutes, some focus required
- SMALL (5): Low impact, <30 minutes, can be done with low energy

Respond with JSON:
{{
  "extractedTasks": [
    {{
      "title": "string",
      "description": "string", 
      "source": "email|voice|slack|manual|imessage",
      "sourceId": "string",
      "estimatedDuration": minutes,
      "priority": "big|medium|small",
      "deadline": "ISO date or null",
      "energyRequired": "low|medium|high",
      "dependencies": ["task titles"],
      "confidence": 0.0-1.0
    }}
  ],
  "taskStructure": {{
    "big": [1 task],
    "medium": [up to 3 tasks],
    "small": [up to 5 tasks]
  }},
  "reasoning": "explanation of classification decisions",
  "recommendations": ["strategic suggestions"]
}}

Focus on actionable, specific tasks. Avoid duplicates and be conservative in estimates.
`);

async function taskClassifierNode(
  state: LifeOpsState,
  config: RunnableConfig
): Promise<Partial<LifeOpsState>> {
  const llm = new ChatOpenAI({
    modelName: "gpt-4",
    temperature: 0.2,
    maxTokens: 2000
  });

  try {
    // Aggregate input sources
    const inputSources = await aggregateTaskSources(state.rawInputs);
    const existingTasks = await getCurrentTasks();
    const availableTime = calculateAvailableTime(state.rawInputs.calendarEvents);

    const context = {
      emailContent: JSON.stringify(inputSources.emails),
      voiceNotes: JSON.stringify(inputSources.voice),
      slackMessages: JSON.stringify(inputSources.slack),
      manualTasks: JSON.stringify(inputSources.manual),
      messageContent: JSON.stringify(inputSources.messages),
      energyLevel: state.userContext.energyLevel,
      availableTime: availableTime.toFixed(1),
      mood: JSON.stringify(state.userContext.currentMood),
      existingTasks: JSON.stringify(existingTasks)
    };

    const chain = taskClassificationPrompt.pipe(llm);
    const response = await chain.invoke(context);
    
    const taskClassification = JSON.parse(response.content as string);

    // Validate and optimize task structure
    const optimizedStructure = optimizeTaskStructure(
      taskClassification.taskStructure,
      state.userContext
    );

    // Store tasks in database
    await saveTasks(taskClassification.extractedTasks);

    return {
      processedData: {
        ...state.processedData,
        extractedTasks: taskClassification.extractedTasks,
        prioritizedTasks: optimizedStructure
      },
      aiOutputs: {
        ...state.aiOutputs,
        taskRecommendations: taskClassification.recommendations
      }
    };

  } catch (error) {
    return {
      errors: [...state.errors, {
        node: "taskClassifier",
        error: error.message,
        timestamp: new Date(),
        recoverable: true
      }]
    };
  }
}

async function aggregateTaskSources(rawInputs: any): Promise<TaskSources> {
  return {
    emails: await extractTasksFromEmails(rawInputs.emailContent || []),
    voice: await extractTasksFromVoice(rawInputs.voiceTranscription || ""),
    slack: await extractTasksFromSlack(rawInputs.slackMessages || []),
    manual: await getManualTasks(),
    messages: await extractTasksFromMessages(rawInputs.messageContent || [])
  };
}
```

### 4. Schedule Builder Node

```typescript
const scheduleOptimizationPrompt = PromptTemplate.fromTemplate(`
You are an expert schedule optimizer that creates optimal daily plans based on user context and task priorities.

Context:
- Current time: {currentTime}
- User's energy pattern: {energyPattern}
- Mood state: {moodState}
- Calendar events: {calendarEvents}
- Available time blocks: {availableBlocks}

Tasks to Schedule:
- Big task (1): {bigTask}
- Medium tasks (3): {mediumTasks}
- Small tasks (5): {smallTasks}

User Preferences:
- Work hours: {workHours}
- Focus preferences: {focusPreferences}
- Break patterns: {breakPatterns}

Create an optimal schedule that:
1. Matches task energy requirements to user energy levels
2. Respects calendar constraints
3. Includes appropriate breaks
4. Allows for buffer time
5. Considers mood and focus state

Respond with JSON:
{{
  "dailySchedule": {{
    "timeBlocks": [
      {{
        "startTime": "ISO datetime",
        "endTime": "ISO datetime",
        "type": "task|break|buffer|meeting",
        "taskId": "string or null",
        "description": "string",
        "energyMatch": "perfect|good|acceptable|poor"
      }}
    ],
    "pomodoroSessions": [
      {{
        "startTime": "ISO datetime",
        "duration": minutes,
        "taskId": "string",
        "intent": "string",
        "breakAfter": minutes
      }}
    ]
  }},
  "optimization": {{
    "score": 0.0-1.0,
    "reasoning": "explanation",
    "alternatives": [{{
      "description": "string",
      "tradeoffs": "string"
    }}],
    "riskFactors": ["potential issues"]
  }}
}}
`);

async function scheduleBuilderNode(
  state: LifeOpsState,
  config: RunnableConfig
): Promise<Partial<LifeOpsState>> {
  const llm = new ChatOpenAI({
    modelName: "gpt-4",
    temperature: 0.3,
    maxTokens: 3000
  });

  try {
    const userPreferences = await getUserPreferences();
    const energyPattern = await getEnergyPattern(state.userContext.timeOfDay);
    const availableBlocks = calculateAvailableTimeBlocks(
      state.rawInputs.calendarEvents,
      userPreferences.workHours
    );

    const context = {
      currentTime: new Date().toISOString(),
      energyPattern: JSON.stringify(energyPattern),
      moodState: JSON.stringify(state.processedData.moodAnalysis),
      calendarEvents: JSON.stringify(state.rawInputs.calendarEvents),
      availableBlocks: JSON.stringify(availableBlocks),
      bigTask: JSON.stringify(state.processedData.prioritizedTasks?.big[0]),
      mediumTasks: JSON.stringify(state.processedData.prioritizedTasks?.medium),
      smallTasks: JSON.stringify(state.processedData.prioritizedTasks?.small),
      workHours: JSON.stringify(userPreferences.workHours),
      focusPreferences: JSON.stringify(userPreferences.focusPreferences),
      breakPatterns: JSON.stringify(userPreferences.breakPatterns)
    };

    const chain = scheduleOptimizationPrompt.pipe(llm);
    const response = await chain.invoke(context);
    
    const scheduleOptimization = JSON.parse(response.content as string);

    // Validate schedule feasibility
    const validatedSchedule = await validateScheduleFeasibility(
      scheduleOptimization.dailySchedule,
      state.rawInputs.calendarEvents
    );

    // Resolve any conflicts
    const resolvedSchedule = await resolveScheduleConflicts(validatedSchedule);

    return {
      aiOutputs: {
        ...state.aiOutputs,
        dailyPlan: {
          date: new Date(),
          schedule: resolvedSchedule,
          optimization: scheduleOptimization.optimization,
          createdAt: new Date()
        }
      }
    };

  } catch (error) {
    return {
      errors: [...state.errors, {
        node: "scheduleBuilder",
        error: error.message,
        timestamp: new Date(),
        recoverable: true
      }]
    };
  }
}
```

### 5. Voice Intent Handler Node

```typescript
const voiceIntentPrompt = PromptTemplate.fromTemplate(`
You are a voice command interpreter for a productivity app. Parse the user's voice input and determine their intent and required actions.

Voice Input: "{voiceInput}"

Current Context:
- Active app: {activeApp}
- Current time: {currentTime}
- User's current activity: {currentActivity}
- Recent conversation: {conversationHistory}
- Mood state: {moodState}

Classify the intent and extract parameters:

Intent Types:
1. PLANNING - "schedule time for X", "plan my day", "when should I do X"
2. TASK_MANAGEMENT - "add task", "mark complete", "what's next"
3. MOOD_REFLECTION - "I'm feeling X", "today was difficult", "celebrate"
4. APP_CONTROL - "start pomodoro", "take a break", "show analytics"
5. QUESTION - "how am I doing", "what's my schedule", "productivity tips"

Respond with JSON:
{{
  "intent": {{
    "type": "PLANNING|TASK_MANAGEMENT|MOOD_REFLECTION|APP_CONTROL|QUESTION",
    "confidence": 0.0-1.0,
    "parameters": {{
      "action": "specific action to take",
      "entities": {{"key": "extracted values"}},
      "timeframe": "when this applies",
      "context": "additional context"
    }}
  }},
  "response": {{
    "text": "conversational response to user",
    "actions": [
      {{
        "type": "ui_update|data_change|calendar_sync|notification",
        "target": "component or data to modify", 
        "payload": {{"key": "value"}}
      }}
    ],
    "followUp": "optional follow-up question"
  }},
  "conversationMemory": {{
    "keyPoints": ["important things to remember"],
    "userPreferences": {{"preference": "value"}},
    "context": "conversation context to maintain"
  }}
}}
`);

async function voiceIntentHandlerNode(
  state: LifeOpsState,
  config: RunnableConfig
): Promise<Partial<LifeOpsState>> {
  const llm = new ChatOpenAI({
    modelName: "gpt-4",
    temperature: 0.4,
    maxTokens: 1500
  });

  try {
    const conversationHistory = await getRecentConversations(5);
    const currentApp = await getCurrentActiveApp();

    const context = {
      voiceInput: state.rawInputs.voiceTranscription || "",
      activeApp: currentApp.name,
      currentTime: new Date().toLocaleString(),
      currentActivity: state.userContext.currentActivity,
      conversationHistory: JSON.stringify(conversationHistory),
      moodState: JSON.stringify(state.userContext.currentMood)
    };

    const chain = voiceIntentPrompt.pipe(llm);
    const response = await chain.invoke(context);
    
    const voiceIntent = JSON.parse(response.content as string);

    // Execute the identified actions
    const executionResults = await executeVoiceActions(voiceIntent.response.actions);

    // Store conversation for context
    await storeConversationTurn({
      userInput: state.rawInputs.voiceTranscription,
      intent: voiceIntent.intent,
      response: voiceIntent.response.text,
      actions: voiceIntent.response.actions,
      timestamp: new Date(),
      executionResults
    });

    return {
      aiOutputs: {
        ...state.aiOutputs,
        conversationResponse: voiceIntent.response.text
      },
      userFeedback: {
        ...state.userFeedback,
        pendingConfirmations: extractConfirmationRequests(voiceIntent.response.actions)
      }
    };

  } catch (error) {
    return {
      errors: [...state.errors, {
        node: "voiceIntentHandler",
        error: error.message,
        timestamp: new Date(),
        recoverable: true
      }],
      aiOutputs: {
        ...state.aiOutputs,
        conversationResponse: "I'm sorry, I didn't understand that. Could you please try again?"
      }
    };
  }
}
```

### 6. Productivity Evaluator Node

```typescript
const productivityEvaluationPrompt = PromptTemplate.fromTemplate(`
You are a productivity coach analyzing a user's daily performance. Provide insightful, encouraging feedback.

Daily Data:
- App usage: {appUsage}
- Completed tasks: {completedTasks}
- Pomodoro sessions: {pomodoroData}
- Mood entries: {moodEntries}
- Planned vs actual: {scheduleAdherence}

Calculate scores (0-100) for:
1. Focus Time - quality and quantity of deep work
2. Task Completion - finishing planned tasks vs new reactive work
3. Intent Alignment - doing what was planned vs getting distracted
4. Life Balance - work vs personal time, energy management

Respond with JSON:
{{
  "productivityScore": {{
    "overall": 0-100,
    "categories": {{
      "focusTime": 0-100,
      "taskCompletion": 0-100, 
      "intentAlignment": 0-100,
      "lifeBalance": 0-100
    }},
    "trend": "improving|declining|stable",
    "percentile": "vs previous 30 days"
  }},
  "insights": {{
    "wins": ["specific achievements to celebrate"],
    "opportunities": ["areas for improvement"],
    "patterns": ["behavioral patterns noticed"],
    "correlations": ["mood vs productivity insights"]
  }},
  "coaching": {{
    "tone": "encouraging|motivating|supportive|challenging",
    "message": "personalized coaching message",
    "actionableAdvice": ["specific suggestions"],
    "tomorrowFocus": "what to prioritize tomorrow"
  }}
}}

Be specific, empathetic, and focus on progress over perfection.
`);

async function productivityEvaluatorNode(
  state: LifeOpsState,
  config: RunnableConfig
): Promise<Partial<LifeOpsState>> {
  const llm = new ChatOpenAI({
    modelName: "gpt-4",
    temperature: 0.5,
    maxTokens: 2000
  });

  try {
    const dailyData = await aggregateDailyData(new Date());
    const historicalContext = await getHistoricalProductivityData(30);

    const context = {
      appUsage: JSON.stringify(dailyData.appUsage),
      completedTasks: JSON.stringify(dailyData.completedTasks),
      pomodoroData: JSON.stringify(dailyData.pomodoroSessions),
      moodEntries: JSON.stringify(dailyData.moodEntries),
      scheduleAdherence: JSON.stringify(dailyData.scheduleComparison)
    };

    const chain = productivityEvaluationPrompt.pipe(llm);
    const response = await chain.invoke(context);
    
    const evaluation = JSON.parse(response.content as string);

    // Calculate historical context
    const enhancedEvaluation = {
      ...evaluation,
      historicalContext: {
        averageScore: calculateAverage(historicalContext.scores),
        bestDay: findBestDay(historicalContext),
        improvementTrend: calculateTrend(historicalContext.scores),
        streakData: calculateStreaks(historicalContext)
      }
    };

    // Store for future reference
    await saveProductivityScore({
      date: new Date(),
      scores: evaluation.productivityScore,
      insights: evaluation.insights,
      coaching: evaluation.coaching,
      historicalContext: enhancedEvaluation.historicalContext
    });

    return {
      aiOutputs: {
        ...state.aiOutputs,
        productivityInsights: enhancedEvaluation
      }
    };

  } catch (error) {
    return {
      errors: [...state.errors, {
        node: "productivityEvaluator",
        error: error.message,
        timestamp: new Date(),
        recoverable: true
      }]
    };
  }
}
```

---

## 🔄 Conditional Routing Logic

### Dynamic Workflow Routing

```typescript
// Route based on input type
function routeBasedOnInputType(state: LifeOpsState): string {
  const hasVoiceInput = !!state.rawInputs.voiceTranscription;
  const hasCalendarChange = state.rawInputs.calendarEvents?.some(e => e.isNew);
  const hasNewMessages = state.rawInputs.messageContent?.length > 0;

  if (hasVoiceInput) {
    return "voiceIntentHandler";
  } else if (hasCalendarChange) {
    return "scheduleBuilder";
  } else if (hasNewMessages) {
    return "taskClassifier";
  } else {
    return "moodInterpreter";
  }
}

// Route based on mood state
function routeBasedOnMoodState(state: LifeOpsState): string {
  const mood = state.processedData.moodAnalysis;
  
  if (!mood) return "taskClassifier";
  
  // If user is overwhelmed or stressed, focus on schedule optimization
  if (mood.mood.valence < -0.3 || mood.mood.arousal > 0.8) {
    return "scheduleBuilder";
  }
  
  // If user is energetic and positive, proceed with task classification
  if (mood.mood.valence > 0.3 && mood.energy.level > 7) {
    return "taskClassifier";
  }
  
  // Default path
  return "taskClassifier";
}

// Route based on conflicts
function routeBasedOnConflicts(state: LifeOpsState): string {
  const schedule = state.aiOutputs.dailyPlan;
  
  if (!schedule) return "errorHandler";
  
  const hasConflicts = schedule.optimization.riskFactors?.length > 0;
  const needsUserInput = schedule.optimization.score < 0.7;
  
  if (hasConflicts || needsUserInput) {
    return "userConfirmation";
  }
  
  return "executionCoordinator";
}

// Route based on user response
function routeBasedOnUserResponse(state: LifeOpsState): string {
  const lastConfirmation = state.userFeedback.confirmations?.slice(-1)[0];
  
  if (!lastConfirmation) return "userConfirmation"; // Wait for response
  
  if (lastConfirmation.approved) {
    return "executionCoordinator";
  } else if (lastConfirmation.modifications) {
    return "scheduleBuilder"; // Rebuild with modifications
  } else {
    return "conflictResolver"; // Try alternative approach
  }
}

// Error handling routing
function routeToErrorHandler(state: LifeOpsState): string {
  const hasErrors = state.errors.length > 0;
  const canRetry = state.retryCount < 3;
  
  if (hasErrors && canRetry) {
    return "errorHandler";
  }
  
  return "END"; // Give up gracefully
}
```

---

## 🛠️ Node Utilities & Helpers

### Common Utilities

```typescript
// Validation utilities
function validateMoodData(moodData: any): MoodAnalysis {
  return {
    mood: {
      valence: Math.max(-1, Math.min(1, moodData.mood?.valence || 0)),
      arousal: Math.max(0, Math.min(1, moodData.mood?.arousal || 0.5)),
      confidence: Math.max(0, Math.min(1, moodData.mood?.confidence || 0.5))
    },
    energy: {
      level: Math.max(0, Math.min(10, moodData.energy?.level || 5)),
      sustainability: Math.max(0, moodData.energy?.sustainability || 2),
      recommendation: moodData.energy?.recommendation || "moderate"
    },
    workRecommendations: {
      taskIntensity: ["low", "medium", "high"].includes(moodData.workRecommendations?.taskIntensity) 
        ? moodData.workRecommendations.taskIntensity : "medium",
      breakFrequency: Math.max(15, Math.min(120, moodData.workRecommendations?.breakFrequency || 30)),
      socialPreference: ["avoid", "neutral", "seek"].includes(moodData.workRecommendations?.socialPreference)
        ? moodData.workRecommendations.socialPreference : "neutral"
    },
    reasoning: moodData.reasoning || "Analysis based on available context"
  };
}

// Optimization utilities
function optimizeTaskStructure(taskStructure: any, userContext: any): TaskStructure {
  const { energyLevel, currentMood } = userContext;
  
  // Reorder tasks based on energy level and mood
  const optimizedBig = taskStructure.big?.slice(0, 1) || [];
  let optimizedMedium = taskStructure.medium?.slice(0, 3) || [];
  let optimizedSmall = taskStructure.small?.slice(0, 5) || [];
  
  // If low energy, prefer easier tasks
  if (energyLevel < 5) {
    optimizedMedium = optimizedMedium.filter(t => t.energyRequired !== "high");
    optimizedSmall = optimizedSmall.sort((a, b) => 
      (a.energyRequired === "low" ? -1 : 1) - (b.energyRequired === "low" ? -1 : 1)
    );
  }
  
  // If negative mood, add buffer time and reduce cognitive load
  if (currentMood.valence < 0) {
    optimizedMedium = optimizedMedium.slice(0, 2); // Reduce medium tasks
    optimizedSmall = optimizedSmall.slice(0, 3); // Reduce small tasks
  }
  
  return {
    big: optimizedBig,
    medium: optimizedMedium,
    small: optimizedSmall
  };
}

// Execution utilities
async function executeVoiceActions(actions: VoiceAction[]): Promise<ActionResult[]> {
  const results: ActionResult[] = [];
  
  for (const action of actions) {
    try {
      let result: any;
      
      switch (action.type) {
        case "ui_update":
          result = await updateUI(action.target, action.payload);
          break;
        case "data_change":
          result = await updateData(action.target, action.payload);
          break;
        case "calendar_sync":
          result = await syncCalendar(action.payload);
          break;
        case "notification":
          result = await showNotification(action.payload);
          break;
        default:
          throw new Error(`Unknown action type: ${action.type}`);
      }
      
      results.push({
        action: action.type,
        success: true,
        result: result
      });
      
    } catch (error) {
      results.push({
        action: action.type,
        success: false,
        error: error.message
      });
    }
  }
  
  return results;
}
```

---

## 🔒 Error Handling & Recovery

### Comprehensive Error Handling

```typescript
async function errorHandlerNode(
  state: LifeOpsState,
  config: RunnableConfig
): Promise<Partial<LifeOpsState>> {
  const lastError = state.errors.slice(-1)[0];
  
  if (!lastError) {
    return { retryCount: 0 }; // No errors to handle
  }
  
  // Determine recovery strategy
  const recoveryStrategy = determineRecoveryStrategy(lastError, state.retryCount);
  
  switch (recoveryStrategy) {
    case "retry":
      return await retryWithBackoff(state);
      
    case "fallback":
      return await useFallbackData(state);
      
    case "simplify":
      return await simplifyRequest(state);
      
    case "user_intervention":
      return await requestUserIntervention(state);
      
    default:
      return await gracefulDegradation(state);
  }
}

function determineRecoveryStrategy(error: GraphError, retryCount: number): RecoveryStrategy {
  // Rate limit errors - backoff and retry
  if (error.error.includes("rate limit")) {
    return "retry";
  }
  
  // Model errors - try simpler prompt
  if (error.error.includes("model") && retryCount < 2) {
    return "simplify";
  }
  
  // API errors - use cached data
  if (error.error.includes("API") || error.error.includes("network")) {
    return "fallback";
  }
  
  // Complex errors - ask user
  if (retryCount >= 2) {
    return "user_intervention";
  }
  
  return "retry";
}

async function retryWithBackoff(state: LifeOpsState): Promise<Partial<LifeOpsState>> {
  const backoffMs = Math.pow(2, state.retryCount) * 1000; // Exponential backoff
  await new Promise(resolve => setTimeout(resolve, backoffMs));
  
  return {
    retryCount: state.retryCount + 1,
    errors: state.errors.slice(0, -1) // Remove last error to retry
  };
}

async function useFallbackData(state: LifeOpsState): Promise<Partial<LifeOpsState>> {
  // Use cached or default data instead of AI processing
  const fallbackPlan = await generateFallbackPlan(state.userContext);
  
  return {
    aiOutputs: {
      ...state.aiOutputs,
      dailyPlan: fallbackPlan,
      conversationResponse: "I'm using your previous preferences since I'm having trouble connecting to AI services."
    },
    errors: [] // Clear errors since we handled them
  };
}
```

---

## 📊 Performance Optimization

### Caching & Efficiency

```typescript
interface LangGraphCache {
  nodeResults: Map<string, CachedResult>;
  userPatterns: Map<string, UserPattern>;
  aiResponses: Map<string, string>;
}

class LifeOpsGraphRunner {
  private cache: LangGraphCache;
  private rateLimiter: RateLimiter;
  
  constructor() {
    this.cache = {
      nodeResults: new Map(),
      userPatterns: new Map(),
      aiResponses: new Map()
    };
    this.rateLimiter = new RateLimiter(60, 60000); // 60 requests per minute
  }
  
  async runWithOptimization(input: any): Promise<any> {
    // Check cache first
    const cacheKey = this.generateCacheKey(input);
    const cached = this.cache.nodeResults.get(cacheKey);
    
    if (cached && this.isCacheValid(cached)) {
      return cached.result;
    }
    
    // Rate limiting
    await this.rateLimiter.waitForPermission();
    
    // Run graph with monitoring
    const startTime = Date.now();
    const result = await this.graph.invoke(input);
    const duration = Date.now() - startTime;
    
    // Cache result if successful
    if (result && !result.errors?.length) {
      this.cache.nodeResults.set(cacheKey, {
        result,
        timestamp: Date.now(),
        duration,
        ttl: this.calculateTTL(input)
      });
    }
    
    // Log performance metrics
    await this.logPerformanceMetrics({
      duration,
      cacheHit: !!cached,
      nodeCount: Object.keys(result).length,
      errorCount: result.errors?.length || 0
    });
    
    return result;
  }
  
  private calculateTTL(input: any): number {
    // Different cache durations based on input type
    if (input.triggeredBy === "voice") return 5 * 60 * 1000; // 5 minutes
    if (input.triggeredBy === "calendar_sync") return 30 * 60 * 1000; // 30 minutes
    return 15 * 60 * 1000; // Default 15 minutes
  }
}
```

---

## 🧪 Testing Strategy

### LangGraph Testing Framework

```typescript
interface GraphTestCase {
  name: string;
  input: LifeOpsState;
  expectedOutput: Partial<LifeOpsState>;
  mockData?: any;
  timeout?: number;
}

describe("LifeOps LangGraph", () => {
  const testCases: GraphTestCase[] = [
    {
      name: "Morning planning with high energy",
      input: {
        userContext: {
          currentMood: { valence: 0.7, arousal: 0.8, confidence: 0.9 },
          energyLevel: 9,
          currentActivity: "planning",
          timeOfDay: new Date("2024-01-01T09:00:00")
        },
        rawInputs: {
          voiceTranscription: "I'm feeling great! Help me plan an ambitious day.",
          calendarEvents: [
            { title: "Team meeting", start: "2024-01-01T11:00:00", duration: 60 }
          ]
        }
      },
      expectedOutput: {
        aiOutputs: {
          dailyPlan: expect.objectContaining({
            optimization: expect.objectContaining({
              score: expect.any(Number)
            })
          })
        }
      }
    },
    
    {
      name: "Task extraction from voice",
      input: {
        rawInputs: {
          voiceTranscription: "Add a task to review the quarterly budget by Friday"
        }
      },
      expectedOutput: {
        processedData: {
          extractedTasks: expect.arrayContaining([
            expect.objectContaining({
              title: expect.stringContaining("budget"),
              priority: expect.stringMatching(/big|medium|small/),
              deadline: expect.any(String)
            })
          ])
        }
      }
    }
  ];

  testCases.forEach(testCase => {
    test(testCase.name, async () => {
      // Setup mocks
      if (testCase.mockData) {
        setupMocks(testCase.mockData);
      }
      
      // Run graph
      const result = await lifeOpsGraph.invoke(testCase.input);
      
      // Assertions
      expect(result).toMatchObject(testCase.expectedOutput);
      expect(result.errors).toHaveLength(0);
      
      // Cleanup
      cleanupMocks();
    }, testCase.timeout || 30000);
  });
});

// Integration tests
describe("LangGraph Integration", () => {
  test("End-to-end voice command processing", async () => {
    const input = {
      rawInputs: {
        voiceTranscription: "I'm feeling overwhelmed, can you lighten my schedule?"
      }
    };
    
    const result = await lifeOpsGraph.invoke(input);
    
    // Should flow through: contextCollector -> moodInterpreter -> scheduleBuilder -> userConfirmation
    expect(result.processedData.moodAnalysis).toBeDefined();
    expect(result.aiOutputs.dailyPlan).toBeDefined();
    expect(result.aiOutputs.conversationResponse).toContain("schedule");
  });
});
```

---

This comprehensive LangGraph implementation guide provides the foundation for building LifeOps' intelligent AI brain that can understand context, make smart decisions, and adapt to user needs while maintaining conversation continuity and error resilience.