const express = require('express');
const router = express.Router();

// Import Pomodoro manager
const PomodoroManager = require('../services/pomodoroManager');

// Initialize Pomodoro manager
const pomodoroManager = new PomodoroManager();

// ==========================================
// POMODORO SESSION MANAGEMENT
// ==========================================

// Start new Pomodoro session
router.post('/start', async (req, res) => {
  try {
    const { config = 'classic', task = 'Focus work', options = {} } = req.body;
    
    const result = await pomodoroManager.startSession(config, task, options);
    
    res.json({
      success: result.success,
      sessionId: result.sessionId,
      session: result.session,
      message: result.message,
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    console.error('❌ Pomodoro start error:', error);
    res.status(500).json({
      error: 'Failed to start Pomodoro session',
      message: error.message
    });
  }
});

// Pause Pomodoro session
router.post('/:sessionId/pause', async (req, res) => {
  try {
    const { sessionId } = req.params;
    const result = await pomodoroManager.pauseSession(sessionId);
    
    res.json({
      success: result.success,
      message: result.message,
      error: result.error,
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    console.error('❌ Pomodoro pause error:', error);
    res.status(500).json({
      error: 'Failed to pause Pomodoro session',
      message: error.message
    });
  }
});

// Resume Pomodoro session
router.post('/:sessionId/resume', async (req, res) => {
  try {
    const { sessionId } = req.params;
    const result = await pomodoroManager.resumeSession(sessionId);
    
    res.json({
      success: result.success,
      message: result.message,
      error: result.error,
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    console.error('❌ Pomodoro resume error:', error);
    res.status(500).json({
      error: 'Failed to resume Pomodoro session',
      message: error.message
    });
  }
});

// End Pomodoro session
router.post('/:sessionId/end', async (req, res) => {
  try {
    const { sessionId } = req.params;
    const result = await pomodoroManager.endSession(sessionId);
    
    res.json({
      success: result.success,
      stats: result.stats,
      message: result.message,
      error: result.error,
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    console.error('❌ Pomodoro end error:', error);
    res.status(500).json({
      error: 'Failed to end Pomodoro session',
      message: error.message
    });
  }
});

// ==========================================
// POMODORO STATUS AND INFORMATION
// ==========================================

// Get current Pomodoro status
router.get('/status', (req, res) => {
  try {
    const status = pomodoroManager.getStatus();
    res.json({
      success: true,
      status: status,
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    console.error('❌ Pomodoro status error:', error);
    res.status(500).json({
      error: 'Failed to get Pomodoro status',
      message: error.message
    });
  }
});

// Get current session details
router.get('/current-session', (req, res) => {
  try {
    const currentSession = pomodoroManager.getCurrentSession();
    res.json({
      success: true,
      currentSession: currentSession,
      hasActiveSession: !!currentSession,
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    console.error('❌ Current session error:', error);
    res.status(500).json({
      error: 'Failed to get current session',
      message: error.message
    });
  }
});

// Get session history
router.get('/history', (req, res) => {
  try {
    const days = parseInt(req.query.days) || 7;
    const history = pomodoroManager.getSessionHistory(days);
    
    res.json({
      success: true,
      history: history,
      days: days,
      totalSessions: history.length,
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    console.error('❌ Session history error:', error);
    res.status(500).json({
      error: 'Failed to get session history',
      message: error.message
    });
  }
});

// ==========================================
// POMODORO CONFIGURATION
// ==========================================

// Get available Pomodoro configurations
router.get('/configs', (req, res) => {
  try {
    const status = pomodoroManager.getStatus();
    res.json({
      success: true,
      availableConfigs: status.availableConfigs,
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    console.error('❌ Configs error:', error);
    res.status(500).json({
      error: 'Failed to get Pomodoro configurations',
      message: error.message
    });
  }
});

// Update Pomodoro configuration
router.post('/configs/:configName', (req, res) => {
  try {
    const { configName } = req.params;
    const { config } = req.body;
    
    if (!config) {
      return res.status(400).json({ error: 'Configuration is required' });
    }
    
    const success = pomodoroManager.updateConfig(configName, config);
    
    if (success) {
      res.json({
        success: true,
        message: `Configuration '${configName}' updated successfully`,
        timestamp: new Date().toISOString()
      });
    } else {
      res.status(404).json({
        error: `Configuration '${configName}' not found`,
        timestamp: new Date().toISOString()
      });
    }
  } catch (error) {
    console.error('❌ Update config error:', error);
    res.status(500).json({
      error: 'Failed to update Pomodoro configuration',
      message: error.message
    });
  }
});

// ==========================================
// AUTOMATED SCHEDULING
// ==========================================

// Schedule Pomodoros from daily schedule
router.post('/schedule-from-plan', async (req, res) => {
  try {
    const { scheduleBlocks } = req.body;
    
    if (!scheduleBlocks) {
      return res.status(400).json({ error: 'Schedule blocks are required' });
    }
    
    const result = await pomodoroManager.scheduleFromDailySchedule(scheduleBlocks);
    
    res.json({
      success: result.success,
      scheduledSessions: result.scheduledSessions,
      message: result.message,
      error: result.error,
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    console.error('❌ Pomodoro scheduling error:', error);
    res.status(500).json({
      error: 'Failed to schedule Pomodoros from daily plan',
      message: error.message
    });
  }
});

// ==========================================
// POMODORO ANALYTICS
// ==========================================

// Get Pomodoro analytics summary
router.get('/analytics', (req, res) => {
  try {
    const days = parseInt(req.query.days) || 30;
    const history = pomodoroManager.getSessionHistory(days);
    
    // Calculate analytics
    const totalSessions = history.length;
    const completedSessions = history.filter(s => !s.endedEarly).length;
    const totalWorkTime = history.reduce((sum, s) => sum + (s.actualWorkTime || 0), 0);
    const averageEfficiency = totalSessions > 0 ? 
      Math.round(history.reduce((sum, s) => sum + (s.focusEfficiency || 0), 0) / totalSessions) : 0;
    
    // Group by day for trends
    const dailyStats = {};
    history.forEach(session => {
      const day = session.startTime.toISOString().split('T')[0];
      if (!dailyStats[day]) {
        dailyStats[day] = { sessions: 0, workTime: 0, efficiency: [] };
      }
      dailyStats[day].sessions++;
      dailyStats[day].workTime += session.actualWorkTime || 0;
      dailyStats[day].efficiency.push(session.focusEfficiency || 0);
    });
    
    res.json({
      success: true,
      analytics: {
        period: `${days} days`,
        totalSessions: totalSessions,
        completedSessions: completedSessions,
        completionRate: totalSessions > 0 ? Math.round((completedSessions / totalSessions) * 100) : 0,
        totalWorkTime: Math.round(totalWorkTime / 60000), // Convert to minutes
        averageWorkTime: totalSessions > 0 ? Math.round(totalWorkTime / totalSessions / 60000) : 0,
        averageEfficiency: averageEfficiency,
        dailyStats: dailyStats
      },
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    console.error('❌ Pomodoro analytics error:', error);
    res.status(500).json({
      error: 'Failed to get Pomodoro analytics',
      message: error.message
    });
  }
});

module.exports = router;