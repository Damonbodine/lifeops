const { ChatOpenAI } = require('@langchain/openai');
const { HumanMessage, SystemMessage } = require('@langchain/core/messages');

/**
 * ScheduleOptimizer - Handles schedule optimization algorithms
 * Determines optimal schedule structures, allocates tasks, optimizes for health and energy
 */
class ScheduleOptimizer {
  constructor(llm) {
    this.llm = llm || new ChatOpenAI({
      apiKey: process.env.OPENAI_API_KEY,
      modelName: 'gpt-3.5-turbo-16k',
      temperature: 0.4,
    });
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
      return null;
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
   * Optimize task sequencing based on dependencies and context switching
   */
  optimizeTaskSequence(tasks, energyPattern) {
    // Sort tasks by priority and energy alignment
    const sortedTasks = [...tasks].sort((a, b) => {
      // Prioritize high-energy tasks during peak periods
      if (a.energyRequirement === 'high' && b.energyRequirement !== 'high') return -1;
      if (a.energyRequirement !== 'high' && b.energyRequirement === 'high') return 1;

      // Then by priority
      const priorityOrder = { high: 0, medium: 1, low: 2 };
      return (priorityOrder[a.priority] || 2) - (priorityOrder[b.priority] || 2);
    });

    return sortedTasks;
  }

  /**
   * Calculate optimal break intervals
   */
  calculateBreakIntervals(workBlocks, pomodoroConfig) {
    const breaks = [];
    let pomodoroCount = 0;

    workBlocks.forEach((block, index) => {
      pomodoroCount++;

      const breakType = pomodoroCount % pomodoroConfig.cycles === 0 ? 'long' : 'short';
      const breakDuration = breakType === 'long' ? pomodoroConfig.longBreak : pomodoroConfig.shortBreak;

      if (index < workBlocks.length - 1) { // Don't add break after last block
        breaks.push({
          afterBlock: block.id,
          type: breakType,
          duration: breakDuration,
          position: index + 1
        });
      }
    });

    return breaks;
  }

  /**
   * Optimize for minimal context switching
   */
  minimizeContextSwitching(scheduleBlocks) {
    // Group similar tasks together to reduce context switching
    const grouped = {};

    scheduleBlocks.forEach(block => {
      const category = block.category || block.type || 'misc';
      if (!grouped[category]) {
        grouped[category] = [];
      }
      grouped[category].push(block);
    });

    // Calculate context switch cost
    let switchCount = 0;
    for (let i = 1; i < scheduleBlocks.length; i++) {
      const prevCategory = scheduleBlocks[i - 1].category || scheduleBlocks[i - 1].type;
      const currCategory = scheduleBlocks[i].category || scheduleBlocks[i].type;
      if (prevCategory !== currCategory) {
        switchCount++;
      }
    }

    return {
      contextSwitches: switchCount,
      groupedByCategory: grouped,
      optimization: switchCount > scheduleBlocks.length / 2 ? 'needed' : 'optimal'
    };
  }

  /**
   * Balance workload across the day
   */
  balanceWorkload(scheduleBlocks) {
    const hourlyLoad = {};

    scheduleBlocks.forEach(block => {
      const startHour = parseInt(block.startTime.split(':')[0]);
      const endHour = parseInt(block.endTime.split(':')[0]);

      for (let hour = startHour; hour < endHour; hour++) {
        if (!hourlyLoad[hour]) {
          hourlyLoad[hour] = { workMinutes: 0, blocks: [] };
        }

        const blockStart = hour === startHour ? parseInt(block.startTime.split(':')[1]) : 0;
        const blockEnd = hour === endHour - 1 ? parseInt(block.endTime.split(':')[1]) : 60;
        const minutes = blockEnd - blockStart;

        hourlyLoad[hour].workMinutes += minutes;
        hourlyLoad[hour].blocks.push(block.id);
      }
    });

    // Calculate balance metrics
    const loads = Object.values(hourlyLoad).map(h => h.workMinutes);
    const avgLoad = loads.reduce((sum, load) => sum + load, 0) / loads.length;
    const maxLoad = Math.max(...loads);
    const minLoad = Math.min(...loads.filter(l => l > 0));

    return {
      hourlyLoad,
      metrics: {
        averageLoad: avgLoad,
        maxLoad,
        minLoad,
        variance: maxLoad - minLoad,
        balanced: (maxLoad - minLoad) < 30 // Within 30 minutes variance
      }
    };
  }
}

module.exports = ScheduleOptimizer;
