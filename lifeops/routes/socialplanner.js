const express = require('express');
const router = express.Router();

// Import Social Planner services
const SocialPlannerAgent = require('../services/socialPlannerAgent');
const UserGoalsInterview = require('../services/userGoalsInterview');

// Initialize services
let socialPlannerAgent = null;
let userGoalsInterview = null;

// Initialize services function
function initializeSocialPlannerServices() {
  try {
    if (!process.env.OPENAI_API_KEY) {
      console.log('⚠️ OpenAI API key not found - Social Planner will use fallback responses');
    }
    
    socialPlannerAgent = new SocialPlannerAgent(process.env.OPENAI_API_KEY);
    userGoalsInterview = new UserGoalsInterview();
    
    console.log('✅ Social Planner services initialized successfully');
  } catch (error) {
    console.error('❌ Error initializing Social Planner services:', error);
  }
}

// Initialize services on startup
initializeSocialPlannerServices();

// ==========================================
// SOCIAL PLANNER INTERVIEW ENDPOINTS
// ==========================================

// Get interview questions
router.get('/interview', async (req, res) => {
  try {
    console.log('🌟 Loading social planner interview questions...');
    
    if (!userGoalsInterview) {
      console.log('⚠️ Interview service not initialized, reinitializing...');
      initializeSocialPlannerServices();
    }
    
    const interview = await userGoalsInterview.getQuestions();
    
    res.json({
      success: true,
      ...interview,
      timestamp: new Date().toISOString()
    });
    
  } catch (error) {
    console.error('❌ Error loading social interview:', error);
    res.status(500).json({ 
      error: 'Failed to load interview questions', 
      message: error.message 
    });
  }
});

// Process interview responses
router.post('/interview/process', async (req, res) => {
  try {
    const { responses } = req.body;
    console.log('🌟 Processing interview responses...');
    
    if (!userGoalsInterview) {
      initializeSocialPlannerServices();
    }
    
    // Validate responses
    const validation = userGoalsInterview.validateResponses(responses);
    if (!validation.isValid) {
      return res.status(400).json({ 
        success: false,
        error: 'Invalid responses', 
        details: validation.errors 
      });
    }
    
    // Process responses
    const processedResponses = await userGoalsInterview.processResponses(responses);
    
    res.json({
      success: true,
      data: processedResponses,
      timestamp: new Date().toISOString()
    });
    
  } catch (error) {
    console.error('❌ Error processing interview responses:', error);
    res.status(500).json({ 
      error: 'Failed to process responses', 
      message: error.message 
    });
  }
});

// ==========================================
// SOCIAL PLAN GENERATION ENDPOINTS
// ==========================================

// Generate social plan
router.post('/generate', async (req, res) => {
  try {
    const { responses } = req.body;
    console.log('🌟 Starting social plan generation...');
    
    // Memory monitoring
    const startMemory = process.memoryUsage();
    console.log('🧠 Starting memory usage:', Math.round(startMemory.heapUsed / 1024 / 1024), 'MB');
    
    if (!socialPlannerAgent) {
      console.log('⚠️ Social planner agent not initialized, reinitializing...');
      initializeSocialPlannerServices();
    }
    
    if (!socialPlannerAgent) {
      throw new Error('Social planner agent failed to initialize');
    }
    
    // Validate responses first
    if (!userGoalsInterview) {
      initializeSocialPlannerServices();
    }
    
    const validation = userGoalsInterview.validateResponses(responses);
    if (!validation.isValid) {
      return res.status(400).json({ 
        success: false,
        error: 'Invalid responses', 
        details: validation.errors 
      });
    }
    
    // Generate the social plan (memory-optimized)
    const plan = await socialPlannerAgent.generateWeeklyPlan(responses);
    
    // Memory monitoring
    const endMemory = process.memoryUsage();
    const memoryUsed = Math.round(endMemory.heapUsed / 1024 / 1024);
    const memoryDiff = Math.round((endMemory.heapUsed - startMemory.heapUsed) / 1024 / 1024);
    
    console.log('🧠 Ending memory usage:', memoryUsed, 'MB');
    console.log('🧠 Memory difference:', memoryDiff, 'MB');
    console.log('✅ Social plan generated successfully');
    
    res.json({
      success: true,
      plan,
      metadata: {
        generatedAt: new Date().toISOString(),
        memoryUsage: memoryUsed + 'MB',
        memoryIncrease: memoryDiff + 'MB',
        planningDuration: 'weekly',
        userProfile: plan.metadata?.userProfile || 'processed'
      }
    });
    
  } catch (error) {
    console.error('❌ Error generating social plan:', error);
    
    // Memory monitoring even on error
    const errorMemory = process.memoryUsage();
    console.log('🧠 Error memory usage:', Math.round(errorMemory.heapUsed / 1024 / 1024), 'MB');
    
    res.status(500).json({ 
      success: false,
      error: 'Failed to generate social plan', 
      message: error.message,
      timestamp: new Date().toISOString()
    });
  }
});

// ==========================================
// SOCIAL PLAN MANAGEMENT ENDPOINTS
// ==========================================

// Get social planning status
router.get('/status', async (req, res) => {
  try {
    const memoryUsage = process.memoryUsage();
    
    res.json({
      success: true,
      status: 'active',
      services: {
        socialPlannerAgent: {
          initialized: !!socialPlannerAgent,
          type: 'SocialPlannerAgent'
        },
        userGoalsInterview: {
          initialized: !!userGoalsInterview,
          type: 'UserGoalsInterview'
        }
      },
      memoryUsage: {
        heapUsed: Math.round(memoryUsage.heapUsed / 1024 / 1024) + 'MB',
        heapTotal: Math.round(memoryUsage.heapTotal / 1024 / 1024) + 'MB',
        rss: Math.round(memoryUsage.rss / 1024 / 1024) + 'MB'
      },
      environment: {
        openaiConfigured: !!process.env.OPENAI_API_KEY,
        nodeVersion: process.version
      },
      timestamp: new Date().toISOString()
    });
    
  } catch (error) {
    console.error('❌ Error getting social planner status:', error);
    res.status(500).json({ 
      success: false,
      error: error.message 
    });
  }
});

// Reinitialize services
router.post('/reinitialize', async (req, res) => {
  try {
    console.log('🔄 Reinitializing Social Planner services...');
    initializeSocialPlannerServices();
    
    res.json({
      success: true,
      message: 'Social Planner services reinitialized',
      services: {
        socialPlannerAgent: !!socialPlannerAgent,
        userGoalsInterview: !!userGoalsInterview
      },
      timestamp: new Date().toISOString()
    });
    
  } catch (error) {
    console.error('❌ Error reinitializing services:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to reinitialize services',
      message: error.message
    });
  }
});

// ==========================================
// CALENDAR INTEGRATION ENDPOINTS
// ==========================================

// Export social plan to calendar (placeholder for future integration)
router.post('/export-calendar', async (req, res) => {
  try {
    const { plan } = req.body;
    
    console.log('📅 Calendar export requested...');
    
    // TODO: Integrate with Google Calendar API when ready
    // This is a placeholder for future calendar integration
    
    res.json({ 
      success: true, 
      message: 'Calendar export feature will be integrated soon!',
      planReceived: !!plan,
      activitiesCount: {
        social: plan?.social?.length || 0,
        health: plan?.health?.length || 0,
        lifeTasks: plan?.lifeTasks?.length || 0
      },
      timestamp: new Date().toISOString()
    });
    
  } catch (error) {
    console.error('❌ Error with calendar export:', error);
    res.status(500).json({ 
      success: false,
      error: 'Calendar export failed',
      message: error.message 
    });
  }
});

// ==========================================
// HEALTH CHECK AND DEBUGGING ENDPOINTS
// ==========================================

// Health check endpoint
router.get('/health', (req, res) => {
  const memoryUsage = process.memoryUsage();
  
  res.json({
    status: 'healthy',
    uptime: process.uptime(),
    memory: {
      used: Math.round(memoryUsage.heapUsed / 1024 / 1024) + 'MB',
      total: Math.round(memoryUsage.heapTotal / 1024 / 1024) + 'MB'
    },
    services: {
      agent: !!socialPlannerAgent,
      interview: !!userGoalsInterview
    },
    timestamp: new Date().toISOString()
  });
});

// Get sample interview questions for testing
router.get('/sample', async (req, res) => {
  try {
    const sampleResponses = {
      social_energy: 'Moderate - mix of social and alone time feels right',
      exercise_preference: 'Solo workouts (gym, running, yoga)',
      relationship_priorities: ['Close friends', 'Family members'],
      life_balance: ['Health and fitness', 'Social connections'],
      weekly_goals: ['Connecting with friends and family', 'Staying consistent with health habits'],
      energy_schedule: 'Mid-morning (9am-12pm)',
      social_style: ['One-on-one conversations', 'Small group gatherings (3-5 people)']
    };
    
    res.json({
      success: true,
      sampleResponses,
      description: 'Sample interview responses for testing',
      timestamp: new Date().toISOString()
    });
    
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Error handling middleware for this router
router.use((error, req, res, next) => {
  console.error('❌ Social Planner route error:', error);
  res.status(500).json({
    success: false,
    error: 'Internal server error in Social Planner',
    message: error.message,
    timestamp: new Date().toISOString()
  });
});

module.exports = router;