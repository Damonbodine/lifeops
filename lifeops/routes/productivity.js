const express = require('express');
const router = express.Router();

// Import productivity services (lazy loading to avoid initialization issues)
let productivityOrchestrator, InterviewAgent, DataCollectionAgent, ScheduleAnalysisAgent, ScheduleBuilderAgent;
let interviewAgent, dataCollectionAgent, scheduleAnalysisAgent, scheduleBuilderAgent;

// Lazy initialization function
function initializeAgents() {
  if (!productivityOrchestrator) {
    try {
      productivityOrchestrator = require('../services/productivityOrchestrator');
      InterviewAgent = require('../services/agents/interviewAgent');
      DataCollectionAgent = require('../services/agents/dataCollectionAgent');
      ScheduleAnalysisAgent = require('../services/agents/scheduleAnalysisAgent');
      ScheduleBuilderAgent = require('../services/agents/scheduleBuilderAgent');
      
      interviewAgent = new InterviewAgent();
      dataCollectionAgent = new DataCollectionAgent();
      scheduleAnalysisAgent = new ScheduleAnalysisAgent();
      scheduleBuilderAgent = new ScheduleBuilderAgent();
      
      console.log('✅ All agents initialized successfully');
    } catch (error) {
      console.error('❌ Agent initialization error:', error);
      throw error;
    }
  }
}

// ==========================================
// PRODUCTIVITY ORCHESTRATION ENDPOINTS
// ==========================================

// Health check endpoint
router.get('/health', (req, res) => {
  res.json({
    success: true,
    message: 'Productivity orchestration system is running',
    timestamp: new Date().toISOString()
  });
});

// Simple test endpoint
router.get('/test-agents', (req, res) => {
  try {
    console.log('🔧 Testing agent initialization...');
    
    // Test each agent individually
    let results = {};
    
    try {
      console.log('Testing ProductivityOrchestrator...');
      const ProdOrch = require('../services/productivityOrchestrator');
      results.orchestrator = 'OK';
    } catch (e) {
      results.orchestrator = 'ERROR: ' + e.message;
    }
    
    try {
      console.log('Testing InterviewAgent...');
      const InterviewAgent = require('../services/agents/interviewAgent');
      const testInterview = new InterviewAgent();
      results.interview = 'OK';
    } catch (e) {
      results.interview = 'ERROR: ' + e.message;
    }
    
    try {
      console.log('Testing DataCollectionAgent...');
      const DataCollectionAgent = require('../services/agents/dataCollectionAgent');
      const testData = new DataCollectionAgent();
      results.dataCollection = 'OK';
    } catch (e) {
      results.dataCollection = 'ERROR: ' + e.message;
    }
    
    try {
      console.log('Testing ScheduleAnalysisAgent...');
      const ScheduleAnalysisAgent = require('../services/agents/scheduleAnalysisAgent');
      const testAnalysis = new ScheduleAnalysisAgent();
      results.scheduleAnalysis = 'OK';
    } catch (e) {
      results.scheduleAnalysis = 'ERROR: ' + e.message;
    }
    
    try {
      console.log('Testing ScheduleBuilderAgent...');
      const ScheduleBuilderAgent = require('../services/agents/scheduleBuilderAgent');
      const testBuilder = new ScheduleBuilderAgent();
      results.scheduleBuilder = 'OK';
    } catch (e) {
      results.scheduleBuilder = 'ERROR: ' + e.message;
    }
    
    res.json({
      success: true,
      results: results,
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    console.error('❌ Test agents error:', error);
    res.status(500).json({
      error: 'Failed to test agents',
      message: error.message
    });
  }
});

// Start daily productivity orchestration
router.post('/start-day', async (req, res) => {
  try {
    initializeAgents();
    const { userInput, preferences = {} } = req.body;
    
    console.log('🚀 Starting daily productivity orchestration...');
    
    const result = await productivityOrchestrator.startDailyOrchestration(userInput);
    
    res.json({
      success: result.success,
      orchestrationResult: result,
      nextStep: result.success ? 'interview' : 'retry',
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    console.error('❌ Daily orchestration error:', error);
    res.status(500).json({
      error: 'Failed to start daily orchestration',
      message: error.message
    });
  }
});

// ==========================================
// INTERVIEW MANAGEMENT ENDPOINTS
// ==========================================

// Start daily interview
router.post('/interview/start', async (req, res) => {
  try {
    const { userContext = {} } = req.body;
    
    const result = await interviewAgent.startDailyInterview(userContext);
    
    res.json({
      success: result.success,
      interview: result,
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    console.error('❌ Interview start error:', error);
    res.status(500).json({
      error: 'Failed to start daily interview',
      message: error.message
    });
  }
});

// Process interview response
router.post('/interview/respond', async (req, res) => {
  try {
    const { response, questionIndex } = req.body;
    
    if (!response) {
      return res.status(400).json({ error: 'Response is required' });
    }
    
    const result = await interviewAgent.processResponse(response, questionIndex);
    
    res.json({
      success: true,
      result: result,
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    console.error('❌ Interview response error:', error);
    res.status(500).json({
      error: 'Failed to process interview response',
      message: error.message
    });
  }
});

// Complete interview
router.post('/interview/complete', async (req, res) => {
  try {
    const { responses } = req.body;
    
    const analysis = await interviewAgent.processInterviewResponses(responses);
    
    res.json({
      success: true,
      analysis: analysis,
      readyForScheduling: true,
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    console.error('❌ Interview completion error:', error);
    res.status(500).json({
      error: 'Failed to complete interview',
      message: error.message
    });
  }
});

// Get interview status
router.get('/interview/status', (req, res) => {
  try {
    const status = interviewAgent.getStatus();
    res.json({
      success: true,
      status: status,
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    console.error('❌ Interview status error:', error);
    res.status(500).json({
      error: 'Failed to get interview status',
      message: error.message
    });
  }
});

// ==========================================
// DATA COLLECTION ENDPOINTS
// ==========================================

// Collect comprehensive data
router.get('/data/collect', async (req, res) => {
  try {
    const options = {
      includeEmails: req.query.includeEmails !== 'false',
      includeCalendar: req.query.includeCalendar !== 'false',
      includeHealth: req.query.includeHealth !== 'false',
      timeframe: req.query.timeframe || 'today'
    };
    
    const collectedData = await dataCollectionAgent.collectAllData(options);
    
    res.json({
      success: true,
      data: collectedData,
      summary: collectedData.summary,
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    console.error('❌ Data collection error:', error);
    res.status(500).json({
      error: 'Failed to collect data',
      message: error.message
    });
  }
});

// Get data collection status
router.get('/data/status', (req, res) => {
  try {
    const status = dataCollectionAgent.getStatus();
    res.json({
      success: true,
      status: status,
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    console.error('❌ Data collection status error:', error);
    res.status(500).json({
      error: 'Failed to get data collection status',
      message: error.message
    });
  }
});

// ==========================================
// SCHEDULE ANALYSIS ENDPOINTS
// ==========================================

// Analyze schedule patterns
router.post('/analyze-schedule', async (req, res) => {
  try {
    const { collectedData, userPreferences, options = {} } = req.body;
    
    if (!collectedData || !userPreferences) {
      return res.status(400).json({ 
        error: 'Collected data and user preferences are required' 
      });
    }
    
    const analysisResult = await scheduleAnalysisAgent.analyzeSchedulingPatterns(
      collectedData, 
      userPreferences, 
      options
    );
    
    res.json({
      success: analysisResult.success,
      analysis: analysisResult,
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    console.error('❌ Schedule analysis error:', error);
    res.status(500).json({
      error: 'Failed to analyze schedule patterns',
      message: error.message
    });
  }
});

// Get schedule analysis status
router.get('/analysis/status', (req, res) => {
  try {
    const status = scheduleAnalysisAgent.getStatus();
    res.json({
      success: true,
      status: status,
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    console.error('❌ Schedule analysis status error:', error);
    res.status(500).json({
      error: 'Failed to get schedule analysis status',
      message: error.message
    });
  }
});

// ==========================================
// SCHEDULE BUILDING ENDPOINTS
// ==========================================

// Build comprehensive daily schedule
router.post('/build-schedule', async (req, res) => {
  try {
    const { analysisResult, userPreferences, collectedData, options = {} } = req.body;
    
    if (!analysisResult || !userPreferences) {
      return res.status(400).json({ 
        error: 'Analysis result and user preferences are required' 
      });
    }
    
    const scheduleResult = await scheduleBuilderAgent.buildDailySchedule(
      analysisResult,
      userPreferences,
      collectedData,
      options
    );
    
    res.json({
      success: scheduleResult.success,
      schedule: scheduleResult.schedule,
      metadata: scheduleResult.metadata,
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    console.error('❌ Schedule building error:', error);
    res.status(500).json({
      error: 'Failed to build daily schedule',
      message: error.message
    });
  }
});

// Get schedule builder status
router.get('/builder/status', (req, res) => {
  try {
    const status = scheduleBuilderAgent.getStatus();
    res.json({
      success: true,
      status: status,
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    console.error('❌ Schedule builder status error:', error);
    res.status(500).json({
      error: 'Failed to get schedule builder status',
      message: error.message
    });
  }
});

// ==========================================
// SCHEDULE APPROVAL AND EXECUTION
// ==========================================

// Approve and activate schedule
router.post('/approve-schedule', async (req, res) => {
  try {
    const { modifications = {} } = req.body;
    
    const result = await productivityOrchestrator.approveSchedule(modifications);
    
    res.json({
      success: result.success,
      result: result,
      executionStarted: result.executionStarted,
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    console.error('❌ Schedule approval error:', error);
    res.status(500).json({
      error: 'Failed to approve schedule',
      message: error.message
    });
  }
});

// ==========================================
// COMPLETE ORCHESTRATION WORKFLOW
// ==========================================

// Complete end-to-end orchestration workflow
router.post('/orchestrate', async (req, res) => {
  try {
    initializeAgents();
    const { userInput, preferences = {}, options = {}, responses, phase } = req.body;
    
    console.log('🎯 Orchestration request - phase:', phase, 'responses:', !!responses);
    
    // Handle different phases of orchestration
    if (phase && (phase !== 'interview')) {
      // This is a continuation request
      console.log(`🎯 Continuing orchestration - phase: ${phase}`);
      
      if (phase === 'analysis') {
        // Step 2: Process interview responses and analyze patterns
        console.log('📊 Processing interview responses and collecting data...');
        
        // Process user responses
        const processedResponses = await productivityOrchestrator.processInterviewResponses(responses);
        
        // Collect all data sources
        const collectedData = await productivityOrchestrator.collectAllData();
        
        // Analyze patterns with AI
        console.log('🧠 Analyzing patterns with OpenAI GPT-3.5...');
        const analysisResult = await productivityOrchestrator.analyzeSchedulingPatterns(collectedData, processedResponses);
        
        res.json({
          success: true,
          phase: 'schedule_preview',
          analysis: analysisResult,
          collectedData: collectedData,
          userResponses: processedResponses,
          message: 'Analysis complete! Ready to build your schedule.',
          timestamp: new Date().toISOString()
        });
        
      } else if (phase === 'schedule') {
        // Step 3: Build schedule with user-approved analysis
        console.log('🏗️ Building schedule with OpenAI GPT-3.5...');
        
        const { analysis, userResponses } = req.body;
        const proposedSchedule = await productivityOrchestrator.buildDailySchedule(analysis, userResponses);
        
        res.json({
          success: true,
          phase: 'schedule_approval',
          schedule: proposedSchedule,
          message: 'Your personalized schedule is ready for approval!',
          timestamp: new Date().toISOString()
        });
        
      } else if (phase === 'approve') {
        // Step 4: Approve and activate schedule
        const { schedule, modifications = {} } = req.body;
        // Pass the complete schedule if provided, otherwise pass modifications
        const scheduleToApprove = schedule || modifications;
        const approvalResponse = await productivityOrchestrator.approveSchedule(scheduleToApprove);
        
        res.json({
          success: true,
          phase: 'complete',
          approval: approvalResponse,
          message: 'Your day is optimized and ready to begin!',
          timestamp: new Date().toISOString()
        });
      }
      
    } else {
      // Initial interview request
      console.log('🎯 Starting complete productivity orchestration workflow...');
      
      // Step 1: Start interview (returns questions, doesn't complete workflow)
      const interviewResult = await productivityOrchestrator.conductDailyInterview(userInput);
      
      res.json({
        success: true,
        phase: 'interview',
        interview: interviewResult,
        message: 'Interview questions ready! Please answer to continue.',
        timestamp: new Date().toISOString()
      });
    }
    
  } catch (error) {
    console.error('❌ Complete orchestration error:', error);
    res.status(500).json({
      error: 'Failed to process orchestration request',
      message: error.message,
      timestamp: new Date().toISOString()
    });
  }
});


// ==========================================
// SYSTEM STATUS AND MANAGEMENT
// ==========================================

// Get overall productivity system status
router.get('/status', (req, res) => {
  try {
    initializeAgents();
    
    // Return simplified status for dashboard
    const status = {
      interview: { 
        active: interviewAgent ? interviewAgent.getStatus().active : false 
      },
      dataCollection: { 
        availableSources: dataCollectionAgent ? dataCollectionAgent.getStatus().availableSources : ['emails', 'calendar', 'tasks', 'contacts']
      },
      scheduleAnalysis: { 
        llmAvailable: scheduleAnalysisAgent ? scheduleAnalysisAgent.getStatus().llmAvailable : true 
      },
      scheduleBuilder: { 
        llmAvailable: scheduleBuilderAgent ? scheduleBuilderAgent.getStatus().llmAvailable : true 
      },
      systemReady: !!(productivityOrchestrator && interviewAgent && dataCollectionAgent && scheduleAnalysisAgent && scheduleBuilderAgent),
      timestamp: new Date().toISOString()
    };
    
    res.json({
      success: true,
      status: status
    });
  } catch (error) {
    console.error('❌ Productivity status error:', error);
    // Fallback status
    res.json({
      success: true,
      status: {
        interview: { active: false },
        dataCollection: { availableSources: ['emails', 'calendar', 'tasks', 'contacts'] },
        scheduleAnalysis: { llmAvailable: true },
        scheduleBuilder: { llmAvailable: true },
        systemReady: false,
        timestamp: new Date().toISOString()
      }
    });
  }
});

// ==========================================
// RESET AND RESTART ENDPOINTS
// ==========================================

// Reset orchestration state to start fresh
router.post('/reset', async (req, res) => {
  try {
    initializeAgents();
    
    // Reset the productivity orchestrator state
    if (productivityOrchestrator) {
      productivityOrchestrator.state = {
        userPreferences: {},
        todaysPlan: null,
        currentSession: null,
        executionMode: false,
        conversationHistory: [],
        scheduledTasks: [],
        pomodoroActive: false,
        lastUpdate: null
      };
      
      // Clear any scheduled jobs
      if (productivityOrchestrator.scheduledJobs) {
        productivityOrchestrator.scheduledJobs.forEach(job => job.destroy());
        productivityOrchestrator.scheduledJobs.clear();
      }
      
      console.log('🔄 Orchestration state reset successfully');
    }
    
    res.json({
      success: true,
      message: 'Orchestration state reset - ready for fresh start',
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    console.error('❌ Reset error:', error);
    res.status(500).json({
      error: 'Failed to reset orchestration state',
      message: error.message
    });
  }
});

module.exports = router;