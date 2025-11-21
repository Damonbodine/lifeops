/**
 * Execution Manager - Automated execution, notifications, and Pomodoro integration
 * Extracted from ProductivityOrchestrator for better organization
 */

const cron = require('node-cron');
const notifier = require('node-notifier');

// Optional Pomodoro and Notification services (fail gracefully if not available)
let PomodoroManager, NotificationManager;
try {
  PomodoroManager = require('./pomodoroManager');
  NotificationManager = require('./notificationManager');
} catch (error) {
  console.warn('⚠️ Pomodoro/Notification services not available:', error.message);
}

/**
 * Initialize Pomodoro and Notification integration (optional)
 */
async function initializePomodoroIntegration() {
  const result = {
    pomodoroManager: null,
    notificationManager: null
  };

  try {
    if (NotificationManager) {
      result.notificationManager = new NotificationManager();
      console.log('✅ NotificationManager ready');
    }

    if (PomodoroManager && result.notificationManager) {
      result.pomodoroManager = new PomodoroManager(result.notificationManager);
      console.log('✅ PomodoroManager ready');
    } else if (PomodoroManager) {
      result.pomodoroManager = new PomodoroManager();
      console.log('✅ PomodoroManager ready (without notifications)');
    }
  } catch (error) {
    console.warn('⚠️ Pomodoro integration initialization failed:', error.message);
  }

  return result;
}

/**
 * Setup automated notifications and Pomodoro execution
 */
async function setupAutomatedExecution(schedule, scheduledJobs) {
  try {
    // Clear any existing scheduled jobs
    scheduledJobs.forEach(job => job.destroy());
    scheduledJobs.clear();

    const today = new Date();

    for (const block of schedule.scheduleBlocks) {
      const [hour, min] = block.startTime.split(':');
      const cronTime = `${min} ${hour} * * *`;

      // Schedule notification for each block
      const job = cron.schedule(cronTime, () => {
        sendNotification(block);
      });

      scheduledJobs.set(`${block.startTime}-${block.type}`, job);
    }

    console.log(`✅ Scheduled ${scheduledJobs.size} automated notifications`);
  } catch (error) {
    console.error('❌ Automated execution setup error:', error);
  }
}

/**
 * Setup Pomodoro and enhanced notification execution (optional/safe)
 */
async function setupPomodoroExecution(schedule, targetDate, pomodoroManager, notificationManager) {
  try {
    // Only proceed if services are available
    if (!pomodoroManager && !notificationManager) {
      console.log('📝 Pomodoro services not available - using standard notifications');
      return;
    }

    console.log('🍅 Setting up enhanced Pomodoro execution...');

    // Set up schedule reminders if notification manager is available
    if (notificationManager) {
      await notificationManager.setupScheduleReminders(schedule.scheduleBlocks);
    }

    // Load schedule into pomodoro manager if available
    if (pomodoroManager) {
      await pomodoroManager.scheduleFromDailySchedule(schedule.scheduleBlocks);

      // Set up Pomodoro sessions for work blocks
      const workBlocks = schedule.scheduleBlocks.filter(block =>
        block.type === 'pomodoro_work' || block.type === 'deep_work'
      );

      if (workBlocks.length > 0) {
        console.log(`🍅 Loaded ${workBlocks.length} work blocks into Pomodoro manager`);

        // Optional: Auto-start first session if it's starting soon
        const firstBlock = workBlocks[0];
        const now = new Date();
        const startTime = new Date(targetDate);
        const [hours, minutes] = firstBlock.startTime.split(':');
        startTime.setHours(parseInt(hours), parseInt(minutes), 0, 0);

        const timeUntilStart = startTime.getTime() - now.getTime();

        // If starting within 30 minutes, set up auto-start
        if (timeUntilStart > 0 && timeUntilStart <= 30 * 60 * 1000) {
          setTimeout(() => {
            console.log('🍅 Auto-starting first Pomodoro session...');
            // Use the actual API from the existing PomodoroManager
            pomodoroManager.startSession('classic', firstBlock.task, { autoStart: true });
          }, timeUntilStart);
        }
      }
    }

    console.log('✅ Enhanced Pomodoro execution setup complete');
  } catch (error) {
    console.warn('⚠️ Pomodoro execution setup failed (continuing with standard flow):', error.message);
    // Don't throw error - continue with normal operation
  }
}

/**
 * Send desktop notification for schedule events
 */
function sendNotification(block) {
  const icons = {
    pomodoro_work: '🎯',
    break: '☕',
    meeting: '👥',
    admin: '📋',
    email: '📧'
  };

  const title = `${icons[block.type] || '⏰'} ${block.task}`;
  const message = block.description || 'Time to focus!';

  notifier.notify({
    title: title,
    message: message,
    sound: true,
    wait: false,
    timeout: 10
  });

  console.log(`🔔 Notification sent: ${title}`);
}

module.exports = {
  initializePomodoroIntegration,
  setupAutomatedExecution,
  setupPomodoroExecution,
  sendNotification
};
