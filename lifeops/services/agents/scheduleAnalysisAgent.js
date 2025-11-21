const { ChatOpenAI } = require('@langchain/openai');
const { analysisFrameworks, timeSlotTypes } = require('../../config/analysisFrameworks');
const {
  analyzeEnergyPatterns,
  analyzeProductivityPatterns,
  analyzeHealthBasedTiming,
  analyzeCalendarOptimization,
  analyzeEmailProcessingTiming,
  analyzeFocusBlockOpportunities,
  generateFallbackRecommendations
} = require('../scheduleAnalyses');
const {
  synthesizeAnalyses,
  determineOptimalWindow,
  identifyConflicts,
  generateAdaptationSuggestions
} = require('../analysisSynthesizer');

/**
 * ScheduleAnalysisAgent - Specialized agent for analyzing productivity patterns and optimal timing
 * Determines best times for different types of work based on data and user preferences
 */
class ScheduleAnalysisAgent {
  constructor() {
    // Temporarily use GPT-3.5 for reliable operation, with data summarization
    this.llm = new ChatOpenAI({
      apiKey: process.env.OPENAI_API_KEY,
      modelName: 'gpt-3.5-turbo-16k', // Use 16k context model for more data
      temperature: 0.3,
    });
    console.log('🧠 ScheduleAnalysisAgent initialized with OpenAI GPT-3.5-turbo-16k');

    // Load analysis frameworks and time slot configurations
    this.analysisFrameworks = analysisFrameworks;
    this.timeSlotTypes = timeSlotTypes;

    console.log('🧠 ScheduleAnalysisAgent initialized');
  }

  /**
   * Perform comprehensive scheduling analysis
   */
  async analyzeSchedulingPatterns(collectedData, userPreferences, options = {}) {
    try {
      console.log('🧠 Analyzing scheduling patterns and optimal timing...');

      const {
        analysisDepth = 'comprehensive',
        focusAreas = ['energy', 'productivity', 'health'],
        timeHorizon = 'today'
      } = options;

      // Run multiple analysis frameworks in parallel
      const analysisPromises = [
        analyzeEnergyPatterns(this.llm, collectedData, userPreferences),
        analyzeProductivityPatterns(this.llm, collectedData, userPreferences),
        analyzeHealthBasedTiming(this.llm, collectedData, userPreferences),
        analyzeCalendarOptimization(this.llm, collectedData),
        analyzeEmailProcessingTiming(this.llm, collectedData),
        analyzeFocusBlockOpportunities(this.llm, collectedData, userPreferences)
      ];

      const results = await Promise.allSettled(analysisPromises);

      // Synthesize all analyses into comprehensive recommendations
      const synthesizedAnalysis = await synthesizeAnalyses(this.llm, results, userPreferences);

      return {
        success: true,
        timestamp: new Date(),
        analysisResults: {
          energyAnalysis: results[0].status === 'fulfilled' ? results[0].value : null,
          productivityAnalysis: results[1].status === 'fulfilled' ? results[1].value : null,
          healthAnalysis: results[2].status === 'fulfilled' ? results[2].value : null,
          calendarAnalysis: results[3].status === 'fulfilled' ? results[3].value : null,
          emailAnalysis: results[4].status === 'fulfilled' ? results[4].value : null,
          focusAnalysis: results[5].status === 'fulfilled' ? results[5].value : null
        },
        synthesizedRecommendations: synthesizedAnalysis,
        optimalSchedulingWindow: determineOptimalWindow(synthesizedAnalysis),
        conflictResolution: identifyConflicts(synthesizedAnalysis),
        adaptationSuggestions: generateAdaptationSuggestions(synthesizedAnalysis)
      };
    } catch (error) {
      console.error('❌ Schedule analysis error:', error);
      return {
        success: false,
        error: error.message,
        fallbackRecommendations: generateFallbackRecommendations()
      };
    }
  }

  /**
   * Get agent status
   */
  getStatus() {
    return {
      analysisFrameworks: Object.keys(this.analysisFrameworks),
      timeSlotTypes: Object.keys(this.timeSlotTypes),
      llmAvailable: !!process.env.OPENAI_API_KEY,
      lastAnalysis: this.lastAnalysisTime || null,
      capabilities: [
        'energy pattern analysis',
        'productivity optimization',
        'health-based timing',
        'calendar optimization',
        'focus block identification'
      ]
    };
  }
}

module.exports = ScheduleAnalysisAgent;