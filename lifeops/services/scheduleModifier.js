/**
 * Schedule Modifier - Schedule building and modification logic
 * Extracted from ProductivityOrchestrator for better organization
 */

const { HumanMessage, SystemMessage } = require('@langchain/core/messages');
const { timeToMinutes, addMinutes, calculateSchedulingConstraints } = require('../utils/scheduleUtils');

/**
 * Apply user modifications to the schedule
 */
async function applyScheduleModifications(schedule, modifications) {
  // Implementation for handling schedule modifications
  // This would involve AI-powered rescheduling based on user requests
  console.log('🔧 Applying schedule modifications:', modifications);
  return schedule; // Simplified for now
}

/**
 * Get fallback schedule when LLM fails
 */
function getFallbackSchedule(schedulingPrefs, currentSession) {
  // Use scheduling constraints if available
  const constraints = calculateSchedulingConstraints(schedulingPrefs || {});

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
  while (timeToMinutes(currentTime) < timeToMinutes(constraints.endTime) - 30) {
    const remainingMinutes = timeToMinutes(constraints.endTime) - timeToMinutes(currentTime);

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

    const endTime = addMinutes(currentTime, duration);

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
          startTime: addMinutes(pomodoroStart, 25),
          duration: 5,
          type: 'short'
        });
      }

      pomodoroStart = addMinutes(pomodoroStart, 30); // 25 min work + 5 min break
    }

    // Move to next block
    currentTime = addMinutes(endTime, blockId % 3 === 0 ? longBreak : shortBreak);
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
      totalWorkTime: `${Math.round(scheduleBlocks.reduce((sum, block) => sum + timeToMinutes(block.endTime) - timeToMinutes(block.startTime), 0) / 60 * 10) / 10} hours`,
      totalBreakTime: `${Math.round(breakSchedule.reduce((sum, br) => sum + br.duration, 0) / 60 * 10) / 10} hours`,
      pomodoroSessions: pomodoroSchedule.length,
      priorityTasksCovered: scheduleBlocks.filter(b => b.priority === 'high').length,
      scheduleWindow: `${constraints.startTime} - ${constraints.endTime}`
    }
  };
}

/**
 * Build comprehensive daily schedule with Pomodoros and breaks
 */
async function buildDailySchedule(llm, analysisResult, userPreferences, currentSession, cleanLLMResponse, validateScheduleStructure, enforceTimeConstraints, getFallbackScheduleFn) {
  // Extract scheduling constraints from user responses
  const schedulingPrefs = currentSession.userResponses?.scheduling || {};
  const targetDay = schedulingPrefs.targetDay || 'today';
  const timeBlock = schedulingPrefs.timeBlock || 'full_day';

  // Calculate target date and time constraints
  const constraints = calculateSchedulingConstraints(schedulingPrefs);

  const buildPrompt = `Create a comprehensive, time-blocked schedule optimized for maximum productivity.

SCHEDULING CONSTRAINTS:
- Target Day: ${targetDay}${schedulingPrefs.customDate ? ` (${schedulingPrefs.customDate})` : ''}
- Time Period: ${timeBlock}
- Schedule Window: ${constraints.startTime} to ${constraints.endTime}
- Available Hours: ${constraints.availableHours}

Analysis Results:
${JSON.stringify(analysisResult, null, 2)}

User Preferences:
${JSON.stringify(userPreferences.todaysProfile, null, 2)}

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
    const response = await llm.invoke([
      new SystemMessage('You are an expert at creating detailed, time-blocked productivity schedules with Pomodoro technique integration. You MUST respond ONLY with valid JSON. Do not include any explanatory text, markdown formatting, or other content - only the JSON object.'),
      new HumanMessage(buildPrompt + '\n\nIMPORTANT: Respond with ONLY the JSON object. No text, no explanations, no markdown formatting. Just the raw JSON.')
    ]);

    let schedule;
    try {
      schedule = JSON.parse(cleanLLMResponse(response.content));
      console.log('🤖 AI generated schedule:', JSON.stringify(schedule, null, 2));

      // Validate schedule structure
      if (!validateScheduleStructure(schedule)) {
        console.warn('⚠️ Schedule validation failed, using fallback');
        console.log('🔍 AI schedule structure that failed validation:', JSON.stringify(schedule, null, 2));
        schedule = getFallbackScheduleFn(schedulingPrefs, currentSession);
      } else {
        console.log('✅ AI schedule passed validation, enforcing time constraints');
        console.log('🔍 Time constraints to enforce:', constraints);
        // Enforce time constraints on AI-generated schedule
        schedule = enforceTimeConstraints(schedule, constraints);
      }
    } catch (parseError) {
      console.error('❌ LLM returned non-JSON content:', response.content.substring(0, 100) + '...');
      // Provide fallback schedule
      schedule = getFallbackScheduleFn(schedulingPrefs, currentSession);
    }

    return schedule;
  } catch (error) {
    console.error('❌ Schedule building error:', error);
    console.log('🔧 Using fallback schedule due to error');
    return getFallbackScheduleFn(schedulingPrefs, currentSession);
  }
}

module.exports = {
  applyScheduleModifications,
  getFallbackSchedule,
  buildDailySchedule
};
