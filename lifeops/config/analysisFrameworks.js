/**
 * Analysis Framework Configurations
 * Defines the frameworks and time slot types used for schedule analysis
 */

/**
 * Core analysis frameworks for different aspects of scheduling
 */
const analysisFrameworks = {
  energy: 'circadian-rhythm-optimization',
  productivity: 'peak-performance-scheduling',
  health: 'wellness-integrated-planning',
  behavioral: 'pattern-recognition-analysis'
};

/**
 * Time slot categories for optimization
 * Each category defines optimal duration ranges, energy requirements, and interruption tolerance
 */
const timeSlotTypes = {
  deepWork: {
    duration: [90, 120],
    energyRequired: 'high',
    interruptions: 'none'
  },
  collaboration: {
    duration: [30, 60],
    energyRequired: 'medium',
    interruptions: 'acceptable'
  },
  admin: {
    duration: [15, 45],
    energyRequired: 'low',
    interruptions: 'tolerable'
  },
  creative: {
    duration: [60, 90],
    energyRequired: 'medium-high',
    interruptions: 'minimal'
  },
  communication: {
    duration: [15, 30],
    energyRequired: 'low-medium',
    interruptions: 'acceptable'
  }
};

module.exports = {
  analysisFrameworks,
  timeSlotTypes
};
