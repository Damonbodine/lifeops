/**
 * Prompt templates for Schedule Builder Agent
 * Contains all LLM prompts for schedule generation
 */

const createPomodoroPrompt = (integratedSchedule, pomodoroConfig, recommendations) => `Add Pomodoro timing structure to the integrated schedule.

Integrated Schedule:
${JSON.stringify(integratedSchedule, null, 2)}

Pomodoro Configuration:
- Work Duration: ${pomodoroConfig.work} minutes
- Short Break: ${pomodoroConfig.shortBreak} minutes
- Long Break: ${pomodoroConfig.longBreak} minutes
- Cycles Before Long Break: ${pomodoroConfig.cycles}

Health Recommendations:
${JSON.stringify(recommendations, null, 2)}

Add Pomodoro structure to work blocks:

Respond in JSON format:
{
  "pomodoroStructuredSchedule": [
    {
      "startTime": "09:00",
      "endTime": "09:25",
      "type": "pomodoro_work",
      "task": "Priority Task 1",
      "pomodoroNumber": 1,
      "cyclePosition": "1 of 4",
      "nextBreakType": "short",
      "focusLevel": "high"
    },
    {
      "startTime": "09:25",
      "endTime": "09:30",
      "type": "pomodoro_break",
      "breakType": "short",
      "duration": 5,
      "suggestedActivity": "stretch and hydrate",
      "preparation": "for next pomodoro cycle"
    }
  ],
  "pomodoroSummary": {
    "totalPomodoroSessions": 8,
    "totalWorkTime": "3.5 hours",
    "totalBreakTime": "45 minutes",
    "longBreaks": 2,
    "adaptations": "adjusted for health recommendations"
  },
  "healthIntegration": {
    "movementBreaks": "included in long breaks",
    "hydrationReminders": "built into break suggestions",
    "eyeRestPeriods": "every 25-90 minutes depending on work type"
  }
}`;

const createCommunicationPrompt = (healthOptimizedSchedule, emailData, emailAnalysis) => `Add strategic communication and email processing blocks to the optimized schedule.

Current Schedule:
${JSON.stringify(healthOptimizedSchedule, null, 2)}

Email Data:
${JSON.stringify(emailData, null, 2)}

Email Processing Analysis:
${JSON.stringify(emailAnalysis, null, 2)}

Add communication blocks strategically:

Respond in JSON format:
{
  "communicationIntegratedSchedule": [
    {
      "startTime": "09:00",
      "endTime": "09:25",
      "type": "pomodoro_work",
      "task": "Priority work task",
      "emailPolicy": "no checking - focus protected"
    },
    {
      "startTime": "11:00",
      "endTime": "11:20",
      "type": "email_processing",
      "purpose": "urgent email triage and responses",
      "maxEmails": 10,
      "timeBoxed": true,
      "urgencyFilter": "high priority only"
    }
  ],
  "communicationStrategy": {
    "protectedFocusTime": "no email/messages during deep work blocks",
    "batchProcessing": "designated times for communication",
    "urgencyTriage": "immediate response only for true emergencies",
    "timeBoxing": "strict limits on communication time"
  },
  "emailProcessingSchedule": {
    "morningTriage": "brief urgent check after first pomodoro",
    "midDayProcessing": "main email processing session",
    "endOfDayReview": "final check and tomorrow preparation"
  }
}`;

const createFinalSchedulePrompt = (communicationSchedule, userPreferences, analysisResult, options) => `Generate the final comprehensive daily schedule with all optimizations and details.

Communication-Integrated Schedule:
${JSON.stringify(communicationSchedule, null, 2)}

User Preferences:
${JSON.stringify(userPreferences, null, 2)}

Analysis Results Summary:
${JSON.stringify(analysisResult, null, 2)}

Build Options:
${JSON.stringify(options, null, 2)}

Generate final detailed schedule:

Respond in JSON format:
{
  "scheduleBlocks": [
    {
      "id": "block-1",
      "startTime": "09:00",
      "endTime": "09:25",
      "type": "pomodoro_work",
      "task": "Complete project proposal draft",
      "description": "Focus on outline and key sections",
      "priority": "high",
      "energyLevel": "high",
      "pomodoroNumber": 1,
      "interruptionPolicy": "strict",
      "notifications": {
        "startReminder": "5 minutes before",
        "endReminder": "when complete",
        "breakReminder": "automatic"
      },
      "resources": ["laptop", "notes", "quiet environment"],
      "successMetrics": "complete draft outline"
    }
  ],
  "summary": {
    "totalBlocks": 16,
    "workTime": "6 hours",
    "breakTime": "1.5 hours",
    "focusBlocks": 8,
    "meetingBlocks": 2,
    "adminBlocks": 3,
    "pomodoroSessions": 12,
    "energyOptimized": true,
    "healthIntegrated": true
  },
  "executionGuidance": {
    "startingInstructions": "Begin with 5-minute preparation ritual",
    "transitionGuidance": "Use buffers for setup and cleanup",
    "interruption": "handle according to block-specific policies",
    "adaptation": "flexibility points for real-time adjustments"
  },
  "automation": {
    "notificationSchedule": "automatic reminders for each block",
    "pomodoroTimers": "auto-start with calendar integration",
    "breakActivities": "suggested activities for each break",
    "energyTracking": "monitor energy levels throughout day"
  }
}`;

module.exports = {
  createPomodoroPrompt,
  createCommunicationPrompt,
  createFinalSchedulePrompt
};
