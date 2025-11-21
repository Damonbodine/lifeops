const { SystemMessage, HumanMessage } = require('@langchain/core/messages');

/**
 * Analysis Synthesizer
 * Combines multiple analyses into unified recommendations with conflict resolution
 */

/**
 * Synthesize all analyses into comprehensive recommendations
 */
async function synthesizeAnalyses(llm, analysisResults, userPreferences) {
  // Extract only key findings to avoid token limits
  const keyFindings = analysisResults.map(result => {
    if (result.status === 'fulfilled' && result.value) {
      // Extract only essential fields from each analysis
      const value = result.value;
      return {
        type: value.analysisType || 'unknown',
        keyRecommendations: value.keyRecommendations || value.unifiedRecommendations || {},
        optimalTiming: value.optimalTiming || value.optimalScheduleStructure || {},
        summary: value.summary || value.brief || 'No summary available'
      };
    }
    return null;
  }).filter(Boolean);

  const synthesisPrompt = `Synthesize multiple scheduling analyses into unified, actionable recommendations.

Key Analysis Findings:
${JSON.stringify(keyFindings, null, 2)}

User Preferences:
${JSON.stringify(userPreferences.todaysProfile, null, 2)}

Current Time: ${new Date().toLocaleString()}

Provide synthesized scheduling recommendations:

Respond in JSON format:
{
  "unifiedRecommendations": {
    "optimalScheduleStructure": {
      "morningBlock": {
        "time": "09:00-12:00",
        "activities": ["deep work", "priority tasks"],
        "energyAlignment": "peak productivity period",
        "protections": ["no meetings", "no email checking"]
      },
      "afternoonBlock": {
        "time": "13:00-17:00",
        "activities": ["meetings", "collaboration", "admin"],
        "energyAlignment": "social and administrative work",
        "flexibility": "more interruptions acceptable"
      }
    },
    "criticalSuccessFactors": [
      "protect morning deep work time",
      "batch similar activities together",
      "schedule breaks based on energy patterns"
    ]
  },
  "implementationPriority": {
    "highPriority": ["establish morning focus block", "batch email processing"],
    "mediumPriority": ["optimize meeting timing", "schedule health breaks"],
    "lowPriority": ["fine-tune transition times", "optimize environment"]
  },
  "adaptationGuidance": {
    "flexibilityPoints": "where schedule can be adjusted if needed",
    "nonNegotiables": "elements that must be protected",
    "realTimeAdjustments": "how to handle unexpected changes"
  }
}`;

  try {
    const response = await llm.invoke([
      new SystemMessage('You are an expert at synthesizing multiple productivity analyses into unified, actionable recommendations.'),
      new HumanMessage(synthesisPrompt)
    ]);

    return JSON.parse(response.content);
  } catch (error) {
    console.error('❌ Synthesis error:', error);
    return getFallbackSynthesis();
  }
}

/**
 * Determine optimal scheduling window based on synthesized analysis
 */
function determineOptimalWindow(synthesizedAnalysis) {
  // Extract optimal windows from synthesized analysis
  const optimal = synthesizedAnalysis.unifiedRecommendations?.optimalScheduleStructure;

  if (!optimal) {
    return {
      morningOptimal: '09:00-11:00',
      afternoonOptimal: '14:00-16:00',
      explanation: 'Default productive time windows based on circadian rhythms'
    };
  }

  return {
    morningOptimal: optimal.morningBlock?.time || '09:00-12:00',
    afternoonOptimal: optimal.afternoonBlock?.time || '13:00-17:00',
    explanation: 'Optimized based on user preferences and data analysis'
  };
}

/**
 * Identify potential conflicts in recommendations
 */
function identifyConflicts(synthesizedAnalysis) {
  // Analyze for conflicts between different recommendations
  const conflicts = {
    timeConflicts: [],
    energyConflicts: [],
    priorityConflicts: [],
    resolutionSuggestions: []
  };

  // Check for timing conflicts
  const scheduleStructure = synthesizedAnalysis.unifiedRecommendations?.optimalScheduleStructure;
  if (scheduleStructure) {
    // Look for overlapping time blocks
    const morningTime = scheduleStructure.morningBlock?.time;
    const afternoonTime = scheduleStructure.afternoonBlock?.time;

    if (morningTime && afternoonTime) {
      // Parse times and check for overlaps
      // Add conflict detection logic here as needed
    }
  }

  // Check for energy-priority conflicts
  const priorities = synthesizedAnalysis.implementationPriority;
  if (priorities) {
    // Verify high-priority items are scheduled during high-energy times
    if (priorities.highPriority && Array.isArray(priorities.highPriority)) {
      priorities.highPriority.forEach(item => {
        // Add validation logic here
      });
    }
  }

  return conflicts;
}

/**
 * Generate adaptation suggestions for real-time schedule adjustments
 */
function generateAdaptationSuggestions(synthesizedAnalysis) {
  const adaptationGuidance = synthesizedAnalysis.unifiedRecommendations?.adaptationGuidance || {};

  return {
    energyDips: adaptationGuidance.energyDips ||
      'When energy is lower than expected, shift demanding tasks to later or take a 10-minute break to recharge',
    unexpectedMeetings: adaptationGuidance.unexpectedMeetings ||
      'For urgent meetings, try to schedule during flexible time blocks. Reschedule admin tasks if needed.',
    taskOverruns: adaptationGuidance.taskOverruns ||
      'If tasks take longer than planned, protect your highest priority items and defer low-priority tasks',
    healthEvents: adaptationGuidance.healthEvents ||
      'For health issues or fatigue, prioritize rest breaks and shift to lighter administrative tasks',
    flexibilityPoints: adaptationGuidance.flexibilityPoints ||
      'Admin blocks and communication tasks can be moved with minimal impact',
    nonNegotiables: adaptationGuidance.nonNegotiables ||
      'Deep focus blocks for priority tasks should be protected whenever possible',
    realTimeAdjustments: adaptationGuidance.realTimeAdjustments ||
      'Reassess every 2 hours, adjust as needed based on actual energy and progress'
  };
}

/**
 * Fallback synthesis for error handling
 */
function getFallbackSynthesis() {
  return {
    unifiedRecommendations: {
      optimalScheduleStructure: {
        morningBlock: {
          time: "09:00-12:00",
          activities: ["deep work", "priority tasks"],
          energyAlignment: "peak productivity",
          protections: ["no interruptions"]
        },
        afternoonBlock: {
          time: "13:00-17:00",
          activities: ["meetings", "admin"],
          energyAlignment: "collaborative work",
          flexibility: "moderate interruptions OK"
        }
      },
      criticalSuccessFactors: [
        "protect morning focus time",
        "batch similar activities",
        "take regular breaks"
      ]
    },
    implementationPriority: {
      highPriority: ["establish morning focus block"],
      mediumPriority: ["optimize meeting timing"],
      lowPriority: ["fine-tune transitions"]
    },
    adaptationGuidance: {
      flexibilityPoints: "afternoon admin blocks",
      nonNegotiables: "morning deep work time",
      realTimeAdjustments: "reassess every 2 hours"
    }
  };
}

module.exports = {
  synthesizeAnalyses,
  determineOptimalWindow,
  identifyConflicts,
  generateAdaptationSuggestions,
  getFallbackSynthesis
};
