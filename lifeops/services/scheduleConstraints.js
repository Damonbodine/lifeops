const { ChatOpenAI } = require('@langchain/openai');
const { HumanMessage, SystemMessage } = require('@langchain/core/messages');
const { defaultScheduleStructure } = require('../config/scheduleBuilderConfigs');

/**
 * ScheduleConstraints - Handles constraint validation and enforcement
 * Integrates calendar events, validates time allocations, resolves conflicts
 */
class ScheduleConstraints {
  constructor(llm) {
    this.llm = llm || new ChatOpenAI({
      apiKey: process.env.OPENAI_API_KEY,
      modelName: 'gpt-3.5-turbo-16k',
      temperature: 0.4,
    });
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
   * Validate time block constraints
   */
  validateTimeBlock(block, blockType) {
    if (!blockType) {
      return { valid: true, warnings: [] };
    }

    const warnings = [];
    const duration = this.calculateDuration(block.startTime, block.endTime);

    if (duration < blockType.minDuration) {
      warnings.push(`Block duration (${duration}min) is less than minimum (${blockType.minDuration}min)`);
    }

    if (duration > blockType.maxDuration) {
      warnings.push(`Block duration (${duration}min) exceeds maximum (${blockType.maxDuration}min)`);
    }

    return {
      valid: warnings.length === 0,
      warnings,
      adjustedDuration: Math.min(Math.max(duration, blockType.minDuration), blockType.maxDuration)
    };
  }

  /**
   * Check for schedule conflicts
   */
  findConflicts(scheduleBlocks) {
    const conflicts = [];
    const sortedBlocks = [...scheduleBlocks].sort((a, b) =>
      this.timeToMinutes(a.startTime) - this.timeToMinutes(b.startTime)
    );

    for (let i = 0; i < sortedBlocks.length - 1; i++) {
      const current = sortedBlocks[i];
      const next = sortedBlocks[i + 1];

      const currentEnd = this.timeToMinutes(current.endTime);
      const nextStart = this.timeToMinutes(next.startTime);

      if (currentEnd > nextStart) {
        conflicts.push({
          block1: current,
          block2: next,
          overlapMinutes: currentEnd - nextStart,
          severity: currentEnd - nextStart > 15 ? 'high' : 'low'
        });
      }
    }

    return conflicts;
  }

  /**
   * Resolve scheduling conflicts
   */
  async resolveConflicts(conflicts, scheduleBlocks) {
    if (conflicts.length === 0) {
      return scheduleBlocks;
    }

    const resolutionPrompt = `Resolve the following schedule conflicts:

Conflicts:
${JSON.stringify(conflicts, null, 2)}

Schedule Blocks:
${JSON.stringify(scheduleBlocks, null, 2)}

Resolve conflicts by adjusting times, priorities, or suggesting alternatives.

Respond in JSON format:
{
  "resolvedSchedule": [
    {
      "id": "block-1",
      "startTime": "09:00",
      "endTime": "10:00",
      "adjustmentMade": "moved 15 minutes earlier",
      "reason": "to avoid conflict with meeting"
    }
  ],
  "resolutionStrategy": "description of how conflicts were resolved",
  "unresolvedConflicts": []
}`;

    try {
      const response = await this.llm.invoke([
        new SystemMessage('You are an expert in schedule conflict resolution.'),
        new HumanMessage(resolutionPrompt)
      ]);

      const result = JSON.parse(response.content);
      return result.resolvedSchedule || scheduleBlocks;
    } catch (error) {
      console.error('❌ Conflict resolution error:', error);
      return scheduleBlocks;
    }
  }

  /**
   * Validate buffer times between blocks
   */
  validateBuffers(scheduleBlocks, blockTypes) {
    const issues = [];
    const sortedBlocks = [...scheduleBlocks].sort((a, b) =>
      this.timeToMinutes(a.startTime) - this.timeToMinutes(b.startTime)
    );

    for (let i = 0; i < sortedBlocks.length - 1; i++) {
      const current = sortedBlocks[i];
      const next = sortedBlocks[i + 1];

      const currentType = blockTypes[current.type];
      const nextType = blockTypes[next.type];

      if (currentType && nextType) {
        const currentEnd = this.timeToMinutes(current.endTime);
        const nextStart = this.timeToMinutes(next.startTime);
        const actualBuffer = nextStart - currentEnd;

        const requiredBuffer = Math.max(
          currentType.bufferAfter || 0,
          nextType.bufferBefore || 0
        );

        if (actualBuffer < requiredBuffer) {
          issues.push({
            between: [current.id, next.id],
            actualBuffer,
            requiredBuffer,
            shortfall: requiredBuffer - actualBuffer
          });
        }
      }
    }

    return issues;
  }

  /**
   * Get default schedule structure
   */
  getDefaultScheduleStructure() {
    return defaultScheduleStructure;
  }

  /**
   * Helper: Calculate duration in minutes
   */
  calculateDuration(startTime, endTime) {
    return this.timeToMinutes(endTime) - this.timeToMinutes(startTime);
  }

  /**
   * Helper: Convert time string to minutes since midnight
   */
  timeToMinutes(timeString) {
    const [hours, minutes] = timeString.split(':').map(Number);
    return hours * 60 + minutes;
  }

  /**
   * Helper: Convert minutes to time string
   */
  minutesToTime(minutes) {
    const hours = Math.floor(minutes / 60);
    const mins = minutes % 60;
    return `${String(hours).padStart(2, '0')}:${String(mins).padStart(2, '0')}`;
  }

  /**
   * Enforce energy-based constraints
   */
  validateEnergyAlignment(scheduleBlocks, energyAnalysis) {
    if (!energyAnalysis || !energyAnalysis.peakEnergyPeriods) {
      return { valid: true, suggestions: [] };
    }

    const suggestions = [];

    scheduleBlocks.forEach(block => {
      if (block.energyRequirement === 'high') {
        const blockTime = this.timeToMinutes(block.startTime);
        const inPeakPeriod = energyAnalysis.peakEnergyPeriods.some(period => {
          const start = this.timeToMinutes(period.start);
          const end = this.timeToMinutes(period.end);
          return blockTime >= start && blockTime <= end;
        });

        if (!inPeakPeriod) {
          suggestions.push({
            block: block.id,
            issue: 'High-energy task scheduled outside peak energy period',
            recommendation: 'Consider moving to a peak energy time slot'
          });
        }
      }
    });

    return {
      valid: suggestions.length === 0,
      suggestions
    };
  }
}

module.exports = ScheduleConstraints;
