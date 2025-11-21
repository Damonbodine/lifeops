/**
 * Pomodoro Configuration Presets
 * Defines various timing configurations for different work styles
 */

const pomodoroConfigs = {
  classic: {
    name: 'Classic Pomodoro',
    work: 25,
    shortBreak: 5,
    longBreak: 15,
    cycles: 4,
    description: 'Traditional 25/5 minute cycles'
  },
  extended: {
    name: 'Extended Deep Work',
    work: 90,
    shortBreak: 15,
    longBreak: 30,
    cycles: 3,
    description: '90-minute deep work sessions'
  },
  flexible: {
    name: 'Flexible Focus',
    work: 45,
    shortBreak: 10,
    longBreak: 20,
    cycles: 4,
    description: '45-minute balanced sessions'
  },
  sprint: {
    name: 'Quick Sprint',
    work: 15,
    shortBreak: 3,
    longBreak: 10,
    cycles: 6,
    description: 'Short, intense focus bursts'
  },
  custom: {
    name: 'Custom',
    work: 25,
    shortBreak: 5,
    longBreak: 15,
    cycles: 4,
    description: 'User-customizable timing'
  }
};

/**
 * Session state constants
 */
const sessionStates = {
  IDLE: 'idle',
  WORK: 'work',
  SHORT_BREAK: 'short_break',
  LONG_BREAK: 'long_break',
  PAUSED: 'paused',
  COMPLETED: 'completed'
};

/**
 * Break activity suggestions
 */
const breakSuggestions = {
  short: [
    'Stand and stretch your neck and shoulders',
    'Take 5 deep breaths and relax',
    'Look out the window at something distant',
    'Drink some water and hydrate',
    'Do some light stretching'
  ],
  long: [
    'Take a 10-15 minute walk outside',
    'Do some yoga or meditation',
    'Have a healthy snack and hydrate',
    'Listen to music and relax',
    'Call a friend or family member',
    'Tidy up your workspace',
    'Read a few pages of a book'
  ]
};

module.exports = {
  pomodoroConfigs,
  sessionStates,
  breakSuggestions
};
