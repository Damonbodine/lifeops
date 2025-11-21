/**
 * Schedule Utilities - Time and schedule manipulation helpers
 * Extracted from ProductivityOrchestrator for better organization
 */

/**
 * Clean up LLM response content to handle markdown formatting
 */
function cleanLLMResponse(content) {
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
 * Convert time string (HH:MM) to minutes from midnight
 */
function timeToMinutes(timeString) {
  const [hours, minutes] = timeString.split(':').map(Number);
  return hours * 60 + minutes;
}

/**
 * Add minutes to a time string (HH:MM format)
 */
function addMinutes(timeString, minutes) {
  const [hours, mins] = timeString.split(':').map(Number);
  const totalMinutes = hours * 60 + mins + minutes;
  const newHours = Math.floor(totalMinutes / 60) % 24;
  const newMins = totalMinutes % 60;
  return `${newHours.toString().padStart(2, '0')}:${newMins.toString().padStart(2, '0')}`;
}

/**
 * Validate schedule structure to ensure it meets required format
 */
function validateScheduleStructure(schedule) {
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
 * Calculate the target date based on user scheduling preferences
 */
function calculateTargetDate(schedulingPrefs) {
  const targetDay = schedulingPrefs.targetDay || 'today';

  if (targetDay === 'today') {
    return new Date();
  } else if (targetDay === 'tomorrow') {
    const tomorrow = new Date();
    tomorrow.setDate(tomorrow.getDate() + 1);
    return tomorrow;
  } else if (targetDay === 'custom' && schedulingPrefs.customDate) {
    // Fix timezone issue: parse date in local timezone, not UTC
    const customDateStr = schedulingPrefs.customDate;
    let targetDate;

    if (customDateStr.includes('T') || customDateStr.includes('Z')) {
      // Already has time info, use as-is
      targetDate = new Date(customDateStr);
    } else {
      // Date-only string (YYYY-MM-DD), parse as local date
      const [year, month, day] = customDateStr.split('-').map(Number);
      targetDate = new Date(year, month - 1, day); // month is 0-indexed
    }

    console.log(`📅 Parsing custom date: ${customDateStr} -> ${targetDate.toDateString()} (${targetDate.toISOString()})`);
    return targetDate;
  } else {
    // Fallback to today
    console.warn('⚠️ Unknown target day, falling back to today:', targetDay);
    return new Date();
  }
}

/**
 * Calculate scheduling constraints based on user preferences
 */
function calculateSchedulingConstraints(schedulingPrefs) {
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
 * Enforce time constraints on AI-generated schedule
 */
function enforceTimeConstraints(schedule, constraints) {
  if (!schedule || !schedule.scheduleBlocks || !Array.isArray(schedule.scheduleBlocks)) {
    return schedule;
  }

  console.log(`🔒 Enforcing time constraints: ${constraints.startTime} - ${constraints.endTime}`);

  const startMinutes = timeToMinutes(constraints.startTime);
  const endMinutes = timeToMinutes(constraints.endTime);

  // Filter and adjust blocks to fit within constraints
  const adjustedBlocks = [];

  for (const block of schedule.scheduleBlocks) {
    const blockStartMinutes = timeToMinutes(block.startTime);
    const blockEndMinutes = timeToMinutes(block.endTime);

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
    const blockDuration = timeToMinutes(adjustedEndTime) - timeToMinutes(adjustedStartTime);
    if (blockDuration >= 15) {
      adjustedBlocks.push({
        ...block,
        startTime: adjustedStartTime,
        endTime: adjustedEndTime
      });
      console.log(`✅ Added block: ${adjustedStartTime} - ${adjustedEndTime} (${blockDuration} min) - ${block.task}`);
    } else {
      console.log(`⚠️ Skipped block too short: ${adjustedStartTime} - ${adjustedEndTime} (${blockDuration} min) - ${block.task}`);
    }
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

module.exports = {
  cleanLLMResponse,
  timeToMinutes,
  addMinutes,
  validateScheduleStructure,
  calculateTargetDate,
  calculateSchedulingConstraints,
  enforceTimeConstraints
};
