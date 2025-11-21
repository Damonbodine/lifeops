/**
 * Schedule Builder Configuration
 * Contains templates, pomodoro configurations, and time block definitions
 */

/**
 * Schedule building templates and patterns
 */
const scheduleTemplates = {
  focusIntensive: 'deep-work-blocks-with-short-breaks',
  collaborative: 'meeting-heavy-with-prep-time',
  mixed: 'balanced-work-and-collaboration',
  adminFocused: 'task-processing-and-communication',
  creative: 'inspiration-based-flexible-blocks'
};

/**
 * Pomodoro timing configurations
 */
const pomodoroConfigs = {
  classic: { work: 25, shortBreak: 5, longBreak: 15, cycles: 4 },
  extended: { work: 90, shortBreak: 15, longBreak: 30, cycles: 3 },
  flexible: { work: 45, shortBreak: 10, longBreak: 20, cycles: 4 },
  micro: { work: 15, shortBreak: 3, longBreak: 10, cycles: 6 }
};

/**
 * Time block types with specific properties
 */
const blockTypes = {
  deepWork: {
    minDuration: 45,
    maxDuration: 120,
    bufferBefore: 10,
    bufferAfter: 10,
    interruptionTolerance: 'none',
    energyRequirement: 'high'
  },
  meeting: {
    minDuration: 15,
    maxDuration: 120,
    bufferBefore: 5,
    bufferAfter: 5,
    interruptionTolerance: 'none',
    energyRequirement: 'medium'
  },
  admin: {
    minDuration: 15,
    maxDuration: 60,
    bufferBefore: 0,
    bufferAfter: 0,
    interruptionTolerance: 'high',
    energyRequirement: 'low'
  },
  creative: {
    minDuration: 60,
    maxDuration: 90,
    bufferBefore: 15,
    bufferAfter: 10,
    interruptionTolerance: 'low',
    energyRequirement: 'medium-high'
  },
  break: {
    minDuration: 5,
    maxDuration: 30,
    bufferBefore: 0,
    bufferAfter: 0,
    interruptionTolerance: 'high',
    energyRequirement: 'recovery'
  }
};

/**
 * Default schedule structure for fallback scenarios
 */
const defaultScheduleStructure = {
  scheduleStructure: {
    morningBlock: {
      startTime: "09:00",
      endTime: "12:00",
      primaryPurpose: "deep work and high-priority tasks",
      energyLevel: "high",
      interruptionPolicy: "strict protection",
      recommendedActivities: ["complex problem solving", "creative work"]
    },
    midDayBlock: {
      startTime: "12:00",
      endTime: "13:00",
      primaryPurpose: "break and energy restoration",
      energyLevel: "transition",
      interruptionPolicy: "flexible",
      recommendedActivities: ["lunch", "movement", "relaxation"]
    },
    afternoonBlock: {
      startTime: "13:00",
      endTime: "17:00",
      primaryPurpose: "collaboration and communication",
      energyLevel: "medium",
      interruptionPolicy: "moderate protection",
      recommendedActivities: ["meetings", "email", "admin tasks"]
    }
  }
};

module.exports = {
  scheduleTemplates,
  pomodoroConfigs,
  blockTypes,
  defaultScheduleStructure
};
