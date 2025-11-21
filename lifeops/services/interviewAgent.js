/**
 * Interview Agent - Handles daily user interviews and response processing
 * Extracted from ProductivityOrchestrator for better organization
 */

const { HumanMessage, SystemMessage } = require('@langchain/core/messages');
const { cleanLLMResponse } = require('../utils/scheduleUtils');

/**
 * Conduct intelligent daily interview with the user
 */
async function conductDailyInterview(llm, initialInput = null) {
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
    const response = await llm.invoke([
      new SystemMessage('You are an expert productivity coach and AI interview specialist.'),
      new HumanMessage(interviewPrompt)
    ]);

    let result = JSON.parse(cleanLLMResponse(response.content));

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
async function processInterviewResponses(llm, responses) {
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

  try {
    const analysisResponse = await llm.invoke([
      new SystemMessage('You are an expert at analyzing productivity preferences and creating personalized work schedules.'),
      new HumanMessage(analysisPrompt)
    ]);

    const analysis = JSON.parse(cleanLLMResponse(analysisResponse.content));
    return analysis;
  } catch (error) {
    console.error('❌ Error processing interview responses:', error);
    throw error;
  }
}

module.exports = {
  conductDailyInterview,
  processInterviewResponses
};
