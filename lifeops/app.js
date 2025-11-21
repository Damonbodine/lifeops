require('dotenv').config();
const express = require('express');
const { google } = require('googleapis');
const OpenAI = require('openai');
const sqlite3 = require('sqlite3').verbose();
const path = require('path');
const os = require('os');
const fs = require('fs').promises;
const { exec } = require('child_process');

// Import new services
const emailService = require('./services/emailService');
const emailSummarizer = require('./services/emailSummarizer');
const emailRelationshipAnalyzer = require('./services/emailRelationshipAnalyzer');
const { getTodaysBirthdays, getUpcomingBirthdays } = require('./ics-parser');
const HealthAnalytics = require('./services/healthAnalytics');

// Import extracted modules
const HealthDataCache = require('./services/healthDataCache');
const ContactCache = require('./services/contactCache');
const {
  normalizePhoneNumber,
  shuffleArray,
  getConfigDescription,
  batchGetContactNames,
  getContactName,
  getFormattedName,
  getRecentContacts
} = require('./utils/contactUtils');
const {
  matchBirthdaysWithContacts,
  getTodaysBirthdayContacts,
  getUpcomingBirthdayContacts
} = require('./services/birthdayMatcher');
const {
  getConversationHistory,
  analyzeConversationAndSuggestMessage
} = require('./services/conversationAnalyzer');

const app = express();
const port = 3000;

app.use(express.json());

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

// Legacy OAuth2 setup (keeping for calendar functionality)
const oauth2Client = new google.auth.OAuth2(
  process.env.GMAIL_CLIENT_ID,
  process.env.GMAIL_CLIENT_SECRET,
  'urn:ietf:wg:oauth:2.0:oob'
);

const calendar = google.calendar({ version: 'v3', auth: oauth2Client });

// Initialize Health Analytics with caching to prevent memory crashes
const healthAnalytics = new HealthAnalytics(process.env.OPENAI_API_KEY);
const HEALTH_EXPORT_PATH = path.join(__dirname, 'apple_health_export');
const healthDataCache = new HealthDataCache(healthAnalytics, HEALTH_EXPORT_PATH);

// Wrapper function for backwards compatibility
async function getHealthData() {
  return healthDataCache.getHealthData();
}

// Load legacy tokens for calendar (if needed)
async function loadLegacyToken() {
  try {
    const TOKEN_PATH = 'token.json';
    const token = await fs.readFile(TOKEN_PATH);
    oauth2Client.setCredentials(JSON.parse(token));
    console.log('✅ Legacy token loaded for calendar functionality.');
  } catch (err) {
    console.log('⚠️ Legacy token not found, calendar may not work.');
  }
}

async function summarizeEmail(email) {
  try {
    const prompt = `
Summarize this email concisely:

From: ${email.from}
Subject: ${email.subject}
Body: ${email.body}

Provide:
1. One sentence summary
2. Priority level (High/Medium/Low) 
3. Action needed (Yes/No)
4. Key points (max 3)

Format as JSON:
{
  "summary": "...",
  "priority": "...",
  "actionNeeded": "...",
  "keyPoints": ["...", "...", "..."]
}`;

    const response = await openai.chat.completions.create({
      model: 'gpt-3.5-turbo',
      messages: [{ role: 'user', content: prompt }],
      max_tokens: 250,
      temperature: 0.1,
    });

    return JSON.parse(response.choices[0].message.content);
  } catch (error) {
    console.error('Error summarizing email:', error.message);
    return {
      summary: 'Failed to summarize email',
      priority: 'Medium',
      actionNeeded: 'Unknown',
      keyPoints: ['Could not analyze email content']
    };
  }
}

// Enhanced API endpoint using new EmailService and EmailSummarizer
app.get('/api/emails', async (req, res) => {
  try {
    console.log('📧 Fetching and analyzing emails with new services...');
    
    // Check if EmailService is authenticated
    if (!emailService.isAuth()) {
      return res.json({
        error: 'Gmail not authenticated',
        authStatus: emailService.getAuthStatus(),
        message: 'Please authenticate with Gmail to access emails'
      });
    }

    // Get query parameters
    const { 
      maxResults = 5, 
      type = 'recent' // 'recent', 'unread', or 'all'
    } = req.query;

    let emails = [];

    // Fetch emails based on type
    switch (type) {
      case 'unread':
        emails = await emailService.getUnreadEmails(parseInt(maxResults));
        break;
      case 'recent':
        emails = await emailService.getRecentEmails(parseInt(maxResults));
        break;
      default:
        const result = await emailService.getEmails({ maxResults: parseInt(maxResults) });
        emails = result.messages;
    }

    if (emails.length === 0) {
      return res.json({ 
        emails: [], 
        message: `No ${type} emails found`,
        count: 0 
      });
    }

    console.log(`📧 Processing ${emails.length} emails with AI...`);

    // Use enhanced EmailSummarizer for batch processing
    const summarizedEmails = await emailSummarizer.summarizeBatch(emails);

    res.json({ 
      emails: summarizedEmails,
      count: summarizedEmails.length,
      type: type,
      authStatus: emailService.getAuthStatus()
    });
  } catch (error) {
    console.error('❌ Error processing emails:', error);
    res.status(500).json({ 
      error: 'Failed to process emails', 
      details: error.message,
      authStatus: emailService.getAuthStatus()
    });
  }
});

// Additional email API endpoints
app.get('/api/email/status', (req, res) => {
  const authStatus = emailService.getAuthStatus();
  const summarizerStatus = emailSummarizer.getStatus();
  
  res.json({
    email: authStatus,
    ai: summarizerStatus,
    ready: authStatus.authenticated && summarizerStatus.openaiAvailable
  });
});

app.get('/api/email/auth-url', (req, res) => {
  try {
    const authUrl = emailService.getAuthUrl();
    res.json({ authUrl });
  } catch (error) {
    res.status(500).json({ error: 'Failed to generate auth URL' });
  }
});

app.post('/api/email/authenticate', async (req, res) => {
  try {
    const { code } = req.body;
    if (!code) {
      return res.status(400).json({ error: 'Authorization code required' });
    }

    const success = await emailService.authenticate(code);
    if (success) {
      res.json({ 
        success: true, 
        message: 'Authentication successful',
        status: emailService.getAuthStatus()
      });
    } else {
      res.status(400).json({ error: 'Authentication failed' });
    }
  } catch (error) {
    res.status(500).json({ error: 'Authentication error', details: error.message });
  }
});

// Import EmailAgent
const emailAgent = require('./services/emailAgent');

// Email AI Agent endpoints
app.post('/api/ai-email', async (req, res) => {
  try {
    const { message, conversationHistory = [] } = req.body;
    
    if (!message) {
      return res.status(400).json({ error: 'Message is required' });
    }

    console.log('🤖 Processing email AI request:', message);
    
    // Check if EmailAgent is ready
    const status = emailAgent.getStatus();
    if (!status.serviceReady) {
      return res.json({
        intent: 'error',
        response: 'Email service is not fully configured. Please check OpenAI API key and Gmail authentication.',
        action: 'none',
        serviceStatus: status
      });
    }

    // Process the request with EmailAgent
    const result = await emailAgent.processEmailRequest(message, conversationHistory);
    
    res.json(result);
  } catch (error) {
    console.error('❌ Email AI processing error:', error);
    res.status(500).json({
      error: 'Failed to process email request',
      response: 'I encountered an error processing your request. Please try again.',
      action: 'none'
    });
  }
});

// Email draft generation endpoint
app.post('/api/ai-email/draft', async (req, res) => {
  try {
    const { instructions, context = {} } = req.body;
    
    if (!instructions) {
      return res.status(400).json({ error: 'Instructions are required' });
    }

    console.log('✍️ Generating email draft:', instructions);
    
    const draft = await emailAgent.generateDraft(instructions, context);
    
    res.json({
      success: true,
      draft: draft,
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    console.error('❌ Error generating email draft:', error);
    res.status(500).json({
      error: 'Failed to generate email draft',
      message: error.message
    });
  }
});

// Email reply generation endpoint
app.post('/api/ai-email/reply', async (req, res) => {
  try {
    const { originalEmail, replyInstructions } = req.body;
    
    if (!originalEmail || !replyInstructions) {
      return res.status(400).json({ error: 'Original email and reply instructions are required' });
    }

    console.log('↩️ Generating email reply for:', originalEmail.subject);
    
    const reply = await emailAgent.generateReply(originalEmail, replyInstructions);
    
    res.json({
      success: true,
      reply: reply,
      originalEmail: {
        id: originalEmail.id,
        subject: originalEmail.subject,
        from: originalEmail.from
      },
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    console.error('❌ Error generating email reply:', error);
    res.status(500).json({
      error: 'Failed to generate email reply',
      message: error.message
    });
  }
});

// Contact cache statistics endpoint
app.get('/api/contact-cache/stats', (req, res) => {
  try {
    const stats = contactCache.getStats();
    res.json({
      success: true,
      cacheStats: stats,
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    console.error('❌ Error getting cache stats:', error);
    res.status(500).json({
      error: 'Failed to get cache statistics'
    });
  }
});

// Clear contact cache endpoint
app.post('/api/contact-cache/clear', (req, res) => {
  try {
    contactCache.cache.clear();
    console.log('🗑️ Contact cache cleared manually');
    res.json({
      success: true,
      message: 'Contact cache cleared successfully'
    });
  } catch (error) {
    console.error('❌ Error clearing cache:', error);
    res.status(500).json({
      error: 'Failed to clear cache'
    });
  }
});

// Email draft improvement endpoint
app.post('/api/ai-email/improve', async (req, res) => {
  try {
    const { draft, feedback } = req.body;
    
    if (!draft || !feedback) {
      return res.status(400).json({ error: 'Draft and feedback are required' });
    }

    console.log('🔧 Improving email draft with feedback:', feedback);
    
    const improved = await emailAgent.improveDraft(draft, feedback);
    
    res.json({
      success: true,
      improved: improved,
      originalDraft: draft,
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    console.error('❌ Error improving email draft:', error);
    res.status(500).json({
      error: 'Failed to improve email draft',
      message: error.message
    });
  }
});

// Email sending endpoint (connects to EmailService)
app.post('/api/ai-email/send', async (req, res) => {
  try {
    const { to, subject, body, originalEmailId } = req.body;
    
    if (!to || !subject || !body) {
      return res.status(400).json({ error: 'Recipient, subject, and body are required' });
    }

    console.log('📧 Sending email to:', to);
    
    // Check if EmailService is authenticated
    if (!emailService.isAuth()) {
      return res.status(401).json({
        error: 'Email service not authenticated',
        message: 'Please authenticate with Gmail to send emails'
      });
    }

    // Note: We'll need to add sendEmail method to EmailService
    // For now, return success response
    res.json({
      success: true,
      message: 'Email sending functionality will be implemented in EmailService',
      emailData: { to, subject, body },
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    console.error('❌ Error sending email:', error);
    res.status(500).json({
      error: 'Failed to send email',
      message: error.message
    });
  }
});

// Email agent status endpoint
app.get('/api/ai-email/status', (req, res) => {
  try {
    const status = emailAgent.getStatus();
    res.json(status);
  } catch (error) {
    console.error('❌ Error getting email agent status:', error);
    res.status(500).json({
      error: 'Failed to get email agent status',
      message: error.message
    });
  }
});

// Email Relationship Intelligence API Endpoints

// Start email relationship analysis (5-year email processing)
app.post('/api/email-relationships/analyze', async (req, res) => {
  try {
    const { yearsBack = 5 } = req.body;
    
    console.log(`🚀 Starting email relationship analysis (${yearsBack} years)`);
    
    // Check if EmailService is authenticated
    if (!emailService.isAuth()) {
      return res.status(401).json({
        error: 'Email service not authenticated',
        message: 'Please authenticate with Gmail to analyze email relationships'
      });
    }

    // Initialize database if needed
    await emailRelationshipAnalyzer.initializeDatabase();
    
    // Start processing (this is a long-running operation)
    emailRelationshipAnalyzer.processEmailHistory(yearsBack)
      .then(result => {
        console.log('✅ Email relationship analysis completed:', result);
      })
      .catch(error => {
        console.error('❌ Email relationship analysis failed:', error);
      });

    res.json({
      success: true,
      message: `Started analyzing ${yearsBack} years of email history. This may take several minutes.`,
      yearsBack: yearsBack,
      status: 'processing_started'
    });

  } catch (error) {
    console.error('❌ Error starting email relationship analysis:', error);
    res.status(500).json({
      error: 'Failed to start email relationship analysis',
      message: error.message
    });
  }
});

// Get processing status
app.get('/api/email-relationships/status', async (req, res) => {
  try {
    const processingStatus = await emailRelationshipAnalyzer.getProcessingStatus();
    const serviceStatus = emailRelationshipAnalyzer.getStatus();
    
    res.json({
      processing: processingStatus,
      service: serviceStatus,
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    console.error('❌ Error getting relationship analysis status:', error);
    res.status(500).json({
      error: 'Failed to get relationship analysis status',
      message: error.message
    });
  }
});

// Get dormant relationships (people to reach out to)
app.get('/api/email-relationships/dormant', async (req, res) => {
  try {
    const { 
      daysThreshold = 30, 
      minInteractions = 5, 
      limit = 20 
    } = req.query;

    console.log(`📧 Getting dormant relationships (>${daysThreshold} days, min ${minInteractions} interactions)`);
    
    const dormantRelationships = await emailRelationshipAnalyzer.getDormantRelationships(
      parseInt(daysThreshold), 
      parseInt(minInteractions)
    );

    // Process results for frontend
    const suggestions = dormantRelationships.slice(0, parseInt(limit)).map(relationship => ({
      name: relationship.display_name || relationship.email_address,
      email: relationship.email_address,
      daysSinceLastContact: Math.round(relationship.days_since_last_contact),
      totalInteractions: relationship.total_interactions,
      healthScore: Math.round(relationship.health_score),
      lastSubject: relationship.last_subject,
      communicationBalance: `${relationship.sent_by_user} sent, ${relationship.received_by_user} received`,
      relationship_type: relationship.relationship_type,
      suggestion_reason: relationship.days_since_last_contact > 90 ? 
        'Long-time relationship that needs reconnection' :
        'Regular contact who you haven\'t spoken with recently'
    }));

    res.json({
      success: true,
      suggestions: suggestions,
      criteria: {
        daysThreshold: parseInt(daysThreshold),
        minInteractions: parseInt(minInteractions),
        totalFound: dormantRelationships.length
      },
      timestamp: new Date().toISOString()
    });

  } catch (error) {
    console.error('❌ Error getting dormant relationships:', error);
    res.status(500).json({
      error: 'Failed to get dormant relationships',
      message: error.message
    });
  }
});

// Generate AI-powered reconnection email
app.post('/api/email-relationships/suggest-message', async (req, res) => {
  try {
    const { emailAddress } = req.body;
    
    if (!emailAddress) {
      return res.status(400).json({ error: 'Email address is required' });
    }

    console.log(`🤖 Generating AI reconnection email for ${emailAddress}`);
    
    // Use our new AI-powered email generation
    const suggestion = await emailRelationshipAnalyzer.generateReconnectionEmail(emailAddress);
    
    res.json({
      success: true,
      suggestion: suggestion,
      timestamp: new Date().toISOString()
    });

  } catch (error) {
    console.error('❌ Error generating reconnection email:', error);
    res.status(500).json({
      error: 'Failed to generate email suggestion',
      message: error.message
    });
  }
});

// Get relationship insights and statistics
app.get('/api/email-relationships/insights', async (req, res) => {
  try {
    console.log('📊 Getting email relationship insights');
    
    // Get overall statistics
    const relationshipCount = await emailRelationshipAnalyzer.getRelationshipCount();
    const databaseSize = await emailRelationshipAnalyzer.getDatabaseSize();
    const processingStatus = await emailRelationshipAnalyzer.getProcessingStatus();

    // Get dormant relationships for quick stats
    const dormantRelationships = await emailRelationshipAnalyzer.getDormantRelationships(30, 5);
    
    const insights = {
      overview: {
        totalRelationships: relationshipCount,
        databaseSize: databaseSize,
        lastProcessed: processingStatus.end_date || processingStatus.last_processed_date,
        processingStatus: processingStatus.status
      },
      dormantRelationships: {
        count: dormantRelationships.length,
        highPriority: dormantRelationships.filter(r => r.health_score > 70).length,
        needsAttention: dormantRelationships.filter(r => r.days_since_last_contact > 60).length
      },
      recommendations: [
        `You have ${dormantRelationships.length} relationships that could use attention`,
        `${dormantRelationships.filter(r => r.health_score > 70).length} high-value relationships need reconnection`,
        'Consider reaching out to maintain your professional network'
      ]
    };

    res.json({
      success: true,
      insights: insights,
      timestamp: new Date().toISOString()
    });

  } catch (error) {
    console.error('❌ Error getting relationship insights:', error);
    res.status(500).json({
      error: 'Failed to get relationship insights',
      message: error.message
    });
  }
});

// In-memory storage (replace with database in production)
let sessions = [];
let tasks = { big: [], medium: [], small: [] };
let dailyStats = {
  focusTime: 0,
  completedSessions: 0,
  tasksCompleted: 0
};

// Pomodoro session endpoints
app.post('/api/sessions', (req, res) => {
  const { intent, duration, breakDuration, cycleType, cycleCount, completed } = req.body;
  const session = {
    id: Date.now(),
    intent,
    duration: parseInt(duration),
    breakDuration: parseInt(breakDuration) || 5,
    cycleType: cycleType || 'work', // 'work' or 'break'
    cycleCount: cycleCount || 1,
    completed: completed || false,
    timestamp: new Date().toISOString()
  };
  
  sessions.push(session);
  
  // Only update stats for completed work sessions
  if (completed && cycleType === 'work') {
    dailyStats.completedSessions++;
    dailyStats.focusTime += session.duration;
  }
  
  res.json({ session, stats: dailyStats });
});

app.get('/api/sessions', (req, res) => {
  res.json({ sessions: sessions.slice(-10), stats: dailyStats }); // Last 10 sessions
});

// Task management endpoints
app.get('/api/tasks', (req, res) => {
  res.json({ tasks, stats: dailyStats });
});

app.post('/api/tasks', (req, res) => {
  const { type, text, duration } = req.body;
  const limits = { big: 1, medium: 3, small: 5 };
  
  if (tasks[type].length >= limits[type]) {
    return res.status(400).json({ error: `Maximum ${limits[type]} ${type} tasks allowed` });
  }
  
  // Validate duration
  const taskDuration = duration ? parseInt(duration) : null;
  if (taskDuration && (taskDuration < 5 || taskDuration > 480)) {
    return res.status(400).json({ error: 'Duration must be between 5 and 480 minutes' });
  }
  
  const task = {
    id: Date.now(),
    text,
    duration: taskDuration,
    completed: false,
    createdAt: new Date().toISOString()
  };
  
  tasks[type].push(task);
  res.json({ task, tasks });
});

app.put('/api/tasks/:type/:id', (req, res) => {
  const { type, id } = req.params;
  const { completed } = req.body;
  
  const task = tasks[type].find(t => t.id === parseInt(id));
  if (task) {
    const wasCompleted = task.completed;
    task.completed = completed;
    
    // Update completed tasks count
    if (completed && !wasCompleted) {
      dailyStats.tasksCompleted++;
    } else if (!completed && wasCompleted) {
      dailyStats.tasksCompleted--;
    }
    
    res.json({ task, stats: dailyStats });
  } else {
    res.status(404).json({ error: 'Task not found' });
  }
});

app.delete('/api/tasks/:type/:id', (req, res) => {
  const { type, id } = req.params;
  const taskIndex = tasks[type].findIndex(t => t.id === parseInt(id));
  
  if (taskIndex !== -1) {
    const task = tasks[type][taskIndex];
    if (task.completed) {
      dailyStats.tasksCompleted--;
    }
    tasks[type].splice(taskIndex, 1);
    res.json({ success: true, tasks });
  } else {
    res.status(404).json({ error: 'Task not found' });
  }
});

const contactCache = new ContactCache(30); // 30 minute TTL

async function getFriendsToCheckIn(config = {}) {
  // Set defaults
  const {
    daysThreshold = 30,
    lookbackDays = 365,
    maxContacts = 15,
    sortBy = 'daysSince',
    filterType = 'all',
    minMessages = 2
  } = config;
  try {
    // Get birthday contacts first (highest priority)
    const todaysBirthdayContacts = await getTodaysBirthdayContacts();
    const upcomingBirthdayContacts = await getUpcomingBirthdayContacts(7); // Next 7 days
    const allBirthdayContacts = [...todaysBirthdayContacts, ...upcomingBirthdayContacts];
    
    console.log(`🎂 Found ${allBirthdayContacts.length} birthday contacts (${todaysBirthdayContacts.length} today, ${upcomingBirthdayContacts.length} upcoming)`);
    
    // Get regular check-in contacts
    const recentContacts = await getRecentContacts(lookbackDays, contactCache, __dirname);
    console.log('📊 Found', recentContacts.length, 'total contacts');
    console.log('📊 Sample contacts:', recentContacts.slice(0, 5).map(c => `${c.contact}: ${c.daysSince} days`));
    
    // Apply filtering and sorting
    let filteredContacts = recentContacts.filter(contact => {
      // Basic filters
      if (contact.daysSince < daysThreshold) return false;
      if (contact.messageCount < minMessages) return false;
      
      // Type filter
      if (filterType === 'resolved' && !contact.isResolved) return false;
      if (filterType === 'unresolved' && contact.isResolved) return false;
      
      return true;
    });
    
    // Apply sorting
    if (sortBy === 'daysSince') {
      filteredContacts.sort((a, b) => b.daysSince - a.daysSince);
    } else if (sortBy === 'messageCount') {
      filteredContacts.sort((a, b) => b.messageCount - a.messageCount);
    } else if (sortBy === 'random') {
      filteredContacts = shuffleArray(filteredContacts);
    }
    
    // Limit results
    const allNeedsCheckIn = filteredContacts.slice(0, maxContacts);
    const resolvedNeedsCheckIn = allNeedsCheckIn.filter(contact => contact.isResolved);
    
    console.log('📊 Total contacts needing check-in (>=' + daysThreshold + ' days):', allNeedsCheckIn.length);
    console.log('📊 Contacts with resolved names:', resolvedNeedsCheckIn.length);
    
    // Format birthday contacts for display (highest priority)
    const birthdayContactsFormatted = allBirthdayContacts.map(birthday => ({
      name: birthday.contactName || birthday.name,
      daysSince: birthday.daysSince,
      reason: birthday.reason,
      suggestedMessage: birthday.suggestedMessage,
      rawContact: birthday.phoneNumber || 'No phone',
      messageCount: birthday.messageCount || 'Unknown',
      isResolved: !!birthday.phoneNumber,
      birthdayContact: true,
      birthdayInfo: {
        birthMonth: birthday.birth_month,
        birthDay: birthday.birth_day,
        daysUntilBirthday: birthday.daysUntilBirthday || 0,
        facebookUrl: birthday.facebook_url
      }
    }));

    // Calculate how many regular contacts to show (subtract birthday contacts from total)
    const maxRegularContacts = Math.max(5, maxContacts - birthdayContactsFormatted.length);
    
    // Return more contacts for scrollable display - show ALL contacts, not just resolved ones
    if (allNeedsCheckIn.length > 0 || birthdayContactsFormatted.length > 0) {
      // Take regular contacts for the scrollable list, sorted by days since contact
      const regularContactsToShow = allNeedsCheckIn.slice(0, maxRegularContacts).map(contact => ({
        name: contact.contact,
        daysSince: contact.daysSince,
        reason: contact.daysSince > 60 ? "Long time since contact" : "Overdue for check-in",
        suggestedMessage: contact.isResolved 
          ? `Hey ${contact.contact.split(' ')[0]}, it's been a while! How have you been?`
          : `Hey! It's been a while since we last talked. How have you been?`,
        rawContact: contact.rawContact,
        messageCount: contact.messageCount || 0,
        isResolved: contact.isResolved,
        birthdayContact: false
      }));
      
      // Combine birthday contacts (first) with regular contacts
      const contactsToShow = [...birthdayContactsFormatted, ...regularContactsToShow];

      // Use AI to provide context-aware weekly goal and insights
      const configDesc = getConfigDescription(config);
      const birthdayContext = birthdayContactsFormatted.length > 0 ? 
        `\n\nBirthday priorities:\n- Today's birthdays: ${todaysBirthdayContacts.length}\n- Upcoming birthdays: ${upcomingBirthdayContacts.length}\n- Birthday contacts: ${birthdayContactsFormatted.map(b => `${b.name} (${b.reason})`).join(', ')}` : '';
      
      const prompt = `Based on this relationship analysis (${configDesc}) with ${allNeedsCheckIn.length} contacts (${resolvedNeedsCheckIn.length} with resolved names) plus ${birthdayContactsFormatted.length} birthday contacts, provide a weekly goal and insight:

Analysis settings:
- Days threshold: ${daysThreshold}+ days since last contact
- Lookback period: ${lookbackDays} days
- Sort order: ${sortBy}
- Filter type: ${filterType}
- Min messages: ${minMessages}${birthdayContext}

Top regular contacts: ${allNeedsCheckIn.slice(0, 5).map(c => `${c.contact}: ${c.daysSince} days, ${c.messageCount} msgs`).join(', ')}

Provide response as JSON:
{
  "priorityContacts": [],
  "weeklyGoal": "...",
  "totalContacts": ${allNeedsCheckIn.length + birthdayContactsFormatted.length},
  "resolvedContacts": ${resolvedNeedsCheckIn.length + birthdayContactsFormatted.filter(b => b.isResolved).length},
  "insight": "..."
}`;

      const response = await openai.chat.completions.create({
        model: 'gpt-3.5-turbo',
        messages: [{ role: 'user', content: prompt }],
        max_tokens: 200,
        temperature: 0.7,
      });

      const aiResult = JSON.parse(response.choices[0].message.content);
      
      // Return the contacts list with AI insights
      return {
        priorityContacts: contactsToShow,
        weeklyGoal: aiResult.weeklyGoal || "Reconnect with people you haven't talked to in a while",
        totalContacts: allNeedsCheckIn.length + birthdayContactsFormatted.length,
        resolvedContacts: resolvedNeedsCheckIn.length + birthdayContactsFormatted.filter(b => b.isResolved).length,
        insight: aiResult.insight || `Showing ${allNeedsCheckIn.length} regular contacts and ${birthdayContactsFormatted.length} birthday contacts`,
        birthdaySummary: {
          todayCount: todaysBirthdayContacts.length,
          upcomingCount: upcomingBirthdayContacts.length,
          totalBirthdayContacts: birthdayContactsFormatted.length
        }
      };
    }

    // Handle case where there are only birthday contacts but no regular contacts
    if (birthdayContactsFormatted.length > 0) {
      return {
        priorityContacts: birthdayContactsFormatted,
        weeklyGoal: "Focus on birthday celebrations and staying connected!",
        totalContacts: birthdayContactsFormatted.length,
        resolvedContacts: birthdayContactsFormatted.filter(b => b.isResolved).length,
        insight: `Great! You have ${birthdayContactsFormatted.length} birthday contacts to celebrate with.`,
        birthdaySummary: {
          todayCount: todaysBirthdayContacts.length,
          upcomingCount: upcomingBirthdayContacts.length,
          totalBirthdayContacts: birthdayContactsFormatted.length
        }
      };
    }
    
    return {
      priorityContacts: [],
      weeklyGoal: "Great job staying connected! Keep up the regular communication.",
      totalContacts: 0,
      resolvedContacts: 0,
      insight: "All your recent contacts have been within the threshold period.",
      birthdaySummary: {
        todayCount: 0,
        upcomingCount: 0,
        totalBirthdayContacts: 0
      }
    };
  } catch (error) {
    console.error('Error analyzing check-ins:', error);
    return {
      priorityContacts: [
        {
          name: "John Smith",
          daysSince: 45,
          reason: "Long-time friend, hasn't heard from you in over a month",
          suggestedMessage: "Hey! Been thinking about you. How have things been lately?"
        },
        {
          name: "Sarah Johnson", 
          daysSince: 35,
          reason: "Close colleague, good to maintain professional relationship",
          suggestedMessage: "Hi Sarah! Hope your projects are going well. Coffee soon?"
        }
      ],
      weeklyGoal: "Reconnect with 2 old friends this week"
    };
  }
}

// Enhanced Check-in API endpoint with filtering
app.get('/api/check-ins', async (req, res) => {
  try {
    // Parse query parameters with defaults
    const {
      daysThreshold = 30,    // Days since last contact to show
      lookbackDays = 365,    // How far back to look for contacts
      maxContacts = 15,      // Maximum contacts to return
      sortBy = 'daysSince',  // Sort order: 'daysSince', 'messageCount', 'random'
      filterType = 'all',    // Filter: 'all', 'resolved', 'unresolved'
      minMessages = 2        // Minimum message count to include
    } = req.query;
    
    // Validate and convert parameters
    const config = {
      daysThreshold: Math.max(1, parseInt(daysThreshold) || 30),
      lookbackDays: Math.max(1, parseInt(lookbackDays) || 365),
      maxContacts: Math.max(1, Math.min(50, parseInt(maxContacts) || 15)),
      sortBy: ['daysSince', 'messageCount', 'random'].includes(sortBy) ? sortBy : 'daysSince',
      filterType: ['all', 'resolved', 'unresolved'].includes(filterType) ? filterType : 'all',
      minMessages: Math.max(1, parseInt(minMessages) || 2)
    };
    
    console.log('📊 Analysis Config:', config);
    
    const checkInData = await getFriendsToCheckIn(config);
    
    // Add configuration info to response
    checkInData.config = config;
    checkInData.configDescription = getConfigDescription(config);
    
    res.json(checkInData);
  } catch (error) {
    console.error('Error getting check-ins:', error);
    res.status(500).json({ error: 'Failed to analyze relationships' });
  }
});

// Configuration presets endpoint
app.get('/api/check-ins/presets', (req, res) => {
  const presets = {
    'recent-activity': {
      name: '🔥 Recent Activity',
      description: 'People you\'ve talked to recently (last 7 days)',
      config: { daysThreshold: 1, lookbackDays: 30, maxContacts: 10, sortBy: 'daysSince' },
      emoji: '🔥',
      color: '#FF6B6B'
    },
    'catch-up-mode': {
      name: '📞 Catch-Up Mode', 
      description: 'Long-term friends you haven\'t talked to in a while (30+ days)',
      config: { daysThreshold: 30, lookbackDays: 365, maxContacts: 15, sortBy: 'daysSince' },
      emoji: '📞',
      color: '#4ECDC4'
    },
    'reconnect-deep': {
      name: '🌊 Deep Reconnection',
      description: 'Important relationships that need attention (60+ days)',
      config: { daysThreshold: 60, lookbackDays: 730, maxContacts: 10, sortBy: 'messageCount' },
      emoji: '🌊', 
      color: '#45B7D1'
    },
    'high-frequency': {
      name: '⚡ High Frequency',
      description: 'People you message a lot but haven\'t recently (10+ messages)',
      config: { daysThreshold: 14, lookbackDays: 90, maxContacts: 8, sortBy: 'messageCount', minMessages: 10 },
      emoji: '⚡',
      color: '#96CEB4'
    },
    'random-surprise': {
      name: '🎲 Random Surprise',
      description: 'Randomly selected contacts for spontaneous check-ins',
      config: { daysThreshold: 21, lookbackDays: 180, maxContacts: 5, sortBy: 'random' },
      emoji: '🎲',
      color: '#FECA57'
    }
  };
  
  res.json({ success: true, presets });
});

// Open Messages app endpoint
app.post('/api/open-messages', (req, res) => {
  const { contact, rawContact, name } = req.body;
  
  try {
    const { exec } = require('child_process');
    
    // Use rawContact (phone number) if available, otherwise fall back to contact
    const targetContact = rawContact || contact;
    const displayName = name || contact;
    
    console.log(`📱 Opening Messages for: ${displayName} (${targetContact})`);
    
    // Enhanced AppleScript to open Messages with compose window
    const appleScript = `
      tell application "Messages"
        activate
        
        -- Wait a moment for Messages to fully load
        delay 0.5
        
        try
          -- Try to open existing conversation
          set targetBuddy to "${targetContact}"
          
          -- First try to find existing chat
          repeat with aChat in text chats
            repeat with aBuddy in participants of aChat
              if (id of aBuddy) contains "${targetContact.replace(/\D/g, '')}" then
                set active chat to aChat
                set visible of window 1 to true
                return "Found existing chat"
              end if
            end repeat
          end repeat
          
          -- If no existing chat found, create new message
          -- Use System Events to simulate creating a new message
          tell application "System Events"
            tell process "Messages"
              -- Try to click the compose button
              try
                click button 1 of group 1 of toolbar 1 of window 1
                delay 0.3
                
                -- Type the phone number in the To field
                set value of text field 1 of group 1 of window 1 to "${targetContact}"
                delay 0.2
                
                -- Press Enter to confirm the recipient
                keystroke return
                delay 0.2
                
                -- Focus on the message input field
                click text area 1 of scroll area 1 of group 1 of window 1
                
                return "Created new conversation"
              on error composeError
                -- Fallback: just make window visible
                set visible of window 1 to true
                return "Fallback: opened Messages app"
              end try
            end tell
          end tell
          
        on error mainError
          -- Final fallback: just open Messages app
          set visible of window 1 to true
          return "Error fallback: " & (mainError as string)
        end try
      end tell
    `;
    
    exec(`osascript -e '${appleScript}'`, (error, stdout, stderr) => {
      const result = stdout?.trim() || '';
      
      if (error) {
        console.error(`❌ Messages AppleScript error: ${error.message}`);
        console.log(`📋 AppleScript result: ${result}`);
        
        // Enhanced fallback: try URL scheme
        const phoneDigits = targetContact.replace(/\D/g, '');
        const smsUrl = `sms:${phoneDigits}`;
        
        console.log(`📱 Trying SMS URL fallback: ${smsUrl}`);
        
        exec(`open "${smsUrl}"`, (fallbackError) => {
          if (fallbackError) {
            console.error(`❌ SMS URL fallback failed: ${fallbackError.message}`);
            // Final fallback: just open Messages app
            exec('open -a Messages', (finalError) => {
              if (finalError) {
                res.status(500).json({ error: 'Failed to open Messages app' });
              } else {
                res.json({ 
                  success: true, 
                  message: `Opened Messages app (fallback for ${displayName})`,
                  method: 'app_only'
                });
              }
            });
          } else {
            res.json({ 
              success: true, 
              message: `Opened Messages via SMS URL for ${displayName}`,
              method: 'sms_url',
              target: targetContact
            });
          }
        });
      } else {
        console.log(`✅ Messages opened successfully: ${result}`);
        res.json({ 
          success: true, 
          message: `Opened Messages for ${displayName}`,
          method: 'applescript',
          target: targetContact,
          result: result
        });
      }
    });
    
  } catch (error) {
    console.error('🚨 Error executing Messages script:', error);
    res.status(500).json({ error: 'Failed to open Messages' });
  }
});

// Calendar endpoints
app.get('/api/calendar/today', async (req, res) => {
  try {
    console.log('📅 CALENDAR ENDPOINT HIT - NEW CODE RUNNING!');
    console.log('📅 Fetching today\'s calendar events...');
    
    // Check if we have valid credentials
    if (!oauth2Client.credentials || !oauth2Client.credentials.access_token) {
      console.log('⚠️ No calendar credentials found');
      return res.json({ 
        events: [], 
        error: 'Calendar not authenticated',
        message: 'Please authenticate with Google Calendar to view events'
      });
    }

    const today = new Date();
    const startOfDay = new Date(today.getFullYear(), today.getMonth(), today.getDate(), 0, 0, 0);
    const endOfDay = new Date(today.getFullYear(), today.getMonth(), today.getDate(), 23, 59, 59);

    const response = await calendar.events.list({
      calendarId: 'primary',
      timeMin: startOfDay.toISOString(),
      timeMax: endOfDay.toISOString(),
      singleEvents: true,
      orderBy: 'startTime',
      maxResults: 20
    });

    const events = response.data.items || [];
    console.log(`📅 Found ${events.length} events for today`);

    // Format events for frontend
    const formattedEvents = events.map(event => ({
      id: event.id,
      summary: event.summary || 'Untitled Event',
      start: event.start?.dateTime || event.start?.date,
      end: event.end?.dateTime || event.end?.date,
      location: event.location || '',
      description: event.description || '',
      status: event.status,
      htmlLink: event.htmlLink
    }));

    res.json({ events: formattedEvents });
  } catch (error) {
    console.error('❌ Error fetching today\'s events:', error);
    
    // Check if it's an authentication error
    if (error.code === 401 || error.message?.includes('invalid_grant')) {
      return res.json({ 
        events: [], 
        error: 'Calendar authentication expired',
        message: 'Please re-authenticate with Google Calendar'
      });
    }
    
    res.status(500).json({ 
      error: 'Failed to fetch calendar events',
      details: error.message 
    });
  }
});

app.get('/api/calendar/upcoming', async (req, res) => {
  try {
    const { days = 3 } = req.query;
    console.log(`📅 Fetching upcoming events for next ${days} days...`);
    
    // Check if we have valid credentials
    if (!oauth2Client.credentials || !oauth2Client.credentials.access_token) {
      console.log('⚠️ No calendar credentials found');
      return res.json({ 
        events: [], 
        error: 'Calendar not authenticated',
        message: 'Please authenticate with Google Calendar to view events'
      });
    }

    const tomorrow = new Date();
    tomorrow.setDate(tomorrow.getDate() + 1);
    tomorrow.setHours(0, 0, 0, 0);
    
    const endDate = new Date();
    endDate.setDate(endDate.getDate() + parseInt(days));
    endDate.setHours(23, 59, 59, 999);

    const response = await calendar.events.list({
      calendarId: 'primary',
      timeMin: tomorrow.toISOString(),
      timeMax: endDate.toISOString(),
      singleEvents: true,
      orderBy: 'startTime',
      maxResults: Math.min(250, Math.max(20, parseInt(days) * 5)) // Scale with days, max 250
    });

    const events = response.data.items || [];
    console.log(`📅 Found ${events.length} upcoming events`);

    // Format events for frontend
    const formattedEvents = events.map(event => ({
      id: event.id,
      summary: event.summary || 'Untitled Event',
      start: event.start?.dateTime || event.start?.date,
      end: event.end?.dateTime || event.end?.date,
      location: event.location || '',
      description: event.description || '',
      status: event.status,
      htmlLink: event.htmlLink
    }));

    res.json({ events: formattedEvents });
  } catch (error) {
    console.error('❌ Error fetching upcoming events:', error);
    
    // Check if it's an authentication error
    if (error.code === 401 || error.message?.includes('invalid_grant')) {
      return res.json({ 
        events: [], 
        error: 'Calendar authentication expired',
        message: 'Please re-authenticate with Google Calendar'
      });
    }
    
    res.status(500).json({ 
      error: 'Failed to fetch upcoming events',
      details: error.message 
    });
  }
});

app.post('/api/calendar/create', async (req, res) => {
  try {
    const { summary, description, start, end, location } = req.body;
    console.log('📅 Creating new calendar event:', summary);
    
    // Check if we have valid credentials
    if (!oauth2Client.credentials || !oauth2Client.credentials.access_token) {
      return res.status(401).json({ 
        error: 'Calendar not authenticated',
        message: 'Please authenticate with Google Calendar to create events'
      });
    }

    // Validate required fields
    if (!summary || !start || !end) {
      return res.status(400).json({ 
        error: 'Missing required fields',
        message: 'Event must have summary, start, and end times'
      });
    }

    const event = {
      summary: summary,
      description: description || '',
      location: location || '',
      start: {
        dateTime: new Date(start).toISOString(),
        timeZone: 'America/New_York', // You might want to make this dynamic
      },
      end: {
        dateTime: new Date(end).toISOString(),
        timeZone: 'America/New_York',
      },
    };

    const response = await calendar.events.insert({
      calendarId: 'primary',
      resource: event,
    });

    console.log('📅 Event created successfully:', response.data.id);
    
    res.json({ 
      event: {
        id: response.data.id,
        summary: response.data.summary,
        start: response.data.start?.dateTime || response.data.start?.date,
        end: response.data.end?.dateTime || response.data.end?.date,
        location: response.data.location,
        description: response.data.description,
        htmlLink: response.data.htmlLink
      }, 
      success: true 
    });
  } catch (error) {
    console.error('❌ Error creating calendar event:', error);
    
    // Check if it's an authentication error
    if (error.code === 401 || error.message?.includes('invalid_grant')) {
      return res.status(401).json({ 
        error: 'Calendar authentication expired',
        message: 'Please re-authenticate with Google Calendar'
      });
    }
    
    res.status(500).json({ 
      error: 'Failed to create calendar event',
      details: error.message 
    });
  }
});

// Delete calendar event endpoint
app.delete('/api/calendar/events/:eventId', async (req, res) => {
  try {
    const { eventId } = req.params;
    console.log(`🗑️ Deleting calendar event: ${eventId}`);
    
    // Check if we have valid credentials
    if (!oauth2Client.credentials || !oauth2Client.credentials.access_token) {
      console.log('⚠️ No calendar credentials found');
      return res.status(401).json({ 
        success: false,
        error: 'Calendar not authenticated',
        message: 'Please authenticate with Google Calendar to delete events'
      });
    }

    console.log('📊 Current credentials status:', {
      hasAccessToken: !!oauth2Client.credentials.access_token,
      tokenExpiry: oauth2Client.credentials.expiry_date
    });

    const deleteResult = await calendar.events.delete({
      calendarId: 'primary',
      eventId: eventId
    });

    console.log('✅ Event deleted successfully. Response:', deleteResult.status);
    res.json({ 
      success: true,
      message: 'Event deleted successfully'
    });
    
  } catch (error) {
    console.error('❌ Error deleting event:', {
      message: error.message,
      code: error.code,
      status: error.status,
      response: error.response?.data,
      stack: error.stack
    });
    
    if (error.code === 404 || error.status === 404) {
      return res.status(404).json({
        success: false,
        error: 'Event not found',
        message: 'The event you are trying to delete does not exist'
      });
    }
    
    if (error.code === 401 || error.status === 401 || error.message?.includes('invalid_grant')) {
      return res.status(401).json({ 
        success: false,
        error: 'Calendar authentication expired',
        message: 'Please re-authenticate with Google Calendar'
      });
    }

    if (error.code === 403 || error.status === 403) {
      return res.status(403).json({
        success: false,
        error: 'Permission denied',
        message: 'You do not have permission to delete this event'
      });
    }
    
    res.status(500).json({
      success: false,
      error: 'Failed to delete event',
      message: error.message || 'An unexpected error occurred',
      details: {
        code: error.code,
        status: error.status
      }
    });
  }
});

// Update calendar event endpoint
app.put('/api/calendar/events/:eventId', async (req, res) => {
  try {
    const { eventId } = req.params;
    const { summary, start, end, location, description } = req.body;
    
    console.log(`📝 Updating calendar event: ${eventId}`);
    
    // Check if we have valid credentials
    if (!oauth2Client.credentials || !oauth2Client.credentials.access_token) {
      console.log('⚠️ No calendar credentials found');
      return res.status(401).json({ 
        success: false,
        error: 'Calendar not authenticated',
        message: 'Please authenticate with Google Calendar to update events'
      });
    }

    // First, get the existing event
    const existingEvent = await calendar.events.get({
      calendarId: 'primary',
      eventId: eventId
    });

    // Prepare the updated event data
    const updatedEvent = {
      summary: summary || existingEvent.data.summary,
      location: location || existingEvent.data.location,
      description: description || existingEvent.data.description,
      start: start ? {
        dateTime: start,
        timeZone: 'America/New_York'
      } : existingEvent.data.start,
      end: end ? {
        dateTime: end,
        timeZone: 'America/New_York'
      } : existingEvent.data.end
    };

    const response = await calendar.events.update({
      calendarId: 'primary',
      eventId: eventId,
      resource: updatedEvent
    });

    console.log('✅ Event updated successfully');
    res.json({ 
      success: true,
      event: {
        id: response.data.id,
        summary: response.data.summary,
        start: response.data.start?.dateTime || response.data.start?.date,
        end: response.data.end?.dateTime || response.data.end?.date,
        location: response.data.location || '',
        description: response.data.description || '',
        htmlLink: response.data.htmlLink
      },
      message: 'Event updated successfully'
    });
    
  } catch (error) {
    console.error('❌ Error updating event:', error);
    
    if (error.code === 404) {
      return res.status(404).json({
        success: false,
        error: 'Event not found',
        message: 'The event you are trying to update does not exist'
      });
    }
    
    if (error.code === 401 || error.message?.includes('invalid_grant')) {
      return res.status(401).json({ 
        success: false,
        error: 'Calendar authentication expired',
        message: 'Please re-authenticate with Google Calendar'
      });
    }
    
    res.status(500).json({
      success: false,
      error: 'Failed to update event',
      message: error.message || 'An unexpected error occurred'
    });
  }
});

// Test delete permissions
app.get('/api/test-calendar-permissions', async (req, res) => {
  try {
    console.log('🔍 Testing Calendar permissions...');
    
    // Check if credentials are set
    if (!oauth2Client.credentials || !oauth2Client.credentials.access_token) {
      return res.json({ 
        success: false,
        error: 'No calendar credentials found'
      });
    }

    // Try to list calendars to check permissions
    const calendars = await calendar.calendarList.list();
    console.log('📅 Available calendars:', calendars.data.items?.length);
    
    // Try to list recent events
    const events = await calendar.events.list({
      calendarId: 'primary',
      maxResults: 5,
      singleEvents: true,
      orderBy: 'startTime'
    });
    
    const eventsList = events.data.items || [];
    console.log('📋 Recent events found:', eventsList.length);
    
    res.json({
      success: true,
      permissions: {
        canListCalendars: true,
        canListEvents: true,
        calendarsCount: calendars.data.items?.length || 0,
        eventsCount: eventsList.length,
        sampleEvents: eventsList.slice(0, 2).map(e => ({
          id: e.id,
          summary: e.summary,
          canEdit: e.creator?.email === e.organizer?.email,
          creator: e.creator?.email,
          organizer: e.organizer?.email
        }))
      }
    });
    
  } catch (error) {
    console.error('❌ Calendar permission test failed:', error);
    res.status(500).json({
      success: false,
      error: error.message,
      code: error.code
    });
  }
});

// Debug endpoint to test Calendar API directly
app.get('/api/debug-calendar', async (req, res) => {
  try {
    console.log('🔍 Testing Calendar API...');
    
    // Check if credentials are set
    const credentials = oauth2Client.credentials;
    console.log('📋 OAuth2 credentials loaded:', !!credentials.access_token);
    
    if (!credentials.access_token) {
      return res.json({
        success: false,
        error: 'No access token found',
        hasCredentials: false
      });
    }
    
    // Try to list calendar events
    const response = await calendar.events.list({
      calendarId: 'primary',
      maxResults: 5,
      singleEvents: true,
      orderBy: 'startTime'
    });
    
    console.log('📅 Calendar response:', response.data);
    
    res.json({
      success: true,
      hasCredentials: !!credentials.access_token,
      eventCount: response.data.items?.length || 0,
      events: response.data.items || [],
      scopes: credentials.scope
    });
  } catch (error) {
    console.error('❌ Debug Calendar error:', error);
    res.json({
      success: false,
      error: error.message,
      hasCredentials: !!oauth2Client.credentials?.access_token,
      code: error.code
    });
  }
});

// AI Calendar Assistant endpoint
app.post('/api/ai-calendar', async (req, res) => {
  try {
    const { message, conversationId } = req.body;
    console.log('🤖 AI Calendar request:', message);

    if (!message) {
      return res.status(400).json({ error: 'Message is required' });
    }

    // Check if we have valid calendar credentials
    if (!oauth2Client.credentials || !oauth2Client.credentials.access_token) {
      return res.json({
        response: "I'd love to help with your calendar, but you need to authenticate with Google Calendar first. Please set up your calendar connection.",
        action: 'authentication_required'
      });
    }

    // Get current time for context
    const now = new Date();
    const todayStr = now.toLocaleDateString('en-US', { 
      weekday: 'long', 
      year: 'numeric', 
      month: 'long', 
      day: 'numeric' 
    });
    const timeStr = now.toLocaleTimeString('en-US', { 
      hour: '2-digit', 
      minute: '2-digit',
      hour12: true
    });

    // Get today's events for context
    const today = new Date();
    const startOfDay = new Date(today.getFullYear(), today.getMonth(), today.getDate(), 0, 0, 0);
    const endOfDay = new Date(today.getFullYear(), today.getMonth(), today.getDate(), 23, 59, 59);

    let existingEvents = [];
    try {
      const response = await calendar.events.list({
        calendarId: 'primary',
        timeMin: startOfDay.toISOString(),
        timeMax: endOfDay.toISOString(),
        singleEvents: true,
        orderBy: 'startTime',
        maxResults: 10
      });
      existingEvents = response.data.items || [];
    } catch (error) {
      console.log('Could not fetch existing events for context');
    }

    const existingEventsContext = existingEvents.length > 0 
      ? `Today's existing events: ${existingEvents.map(e => `${e.summary} at ${new Date(e.start.dateTime || e.start.date).toLocaleTimeString('en-US', {hour: '2-digit', minute: '2-digit'})}`).join(', ')}`
      : 'No events scheduled for today';

    const prompt = `You are an AI calendar assistant. Parse the user's message and determine if they want to create, modify, or inquire about calendar events.

Current context:
- Today is ${todayStr}
- Current time is ${timeStr}
- ${existingEventsContext}

User message: "${message}"

Analyze the message and respond in JSON format:
{
  "intent": "create_event|modify_event|query_events|clarification_needed|general_chat",
  "confidence": 0.0-1.0,
  "response": "Your conversational response to the user",
  "event_details": {
    "title": "Event title",
    "start_date": "YYYY-MM-DD",
    "start_time": "HH:MM",
    "end_date": "YYYY-MM-DD", 
    "end_time": "HH:MM",
    "description": "Optional description",
    "location": "Optional location",
    "duration_minutes": 60
  },
  "conflicts": ["List any potential conflicts with existing events"],
  "clarifications_needed": ["List any missing information"],
  "action": "create|confirm|clarify|none"
}

Guidelines:
- If creating an event, parse dates relative to today
- Default meeting duration is 60 minutes unless specified
- Detect conflicts with existing events
- Ask for clarification if important details are missing
- Be conversational and helpful
- Handle natural language like "tomorrow at 2", "next Monday", "in 30 minutes"`;

    const aiResponse = await openai.chat.completions.create({
      model: 'gpt-4',
      messages: [{ role: 'user', content: prompt }],
      max_tokens: 800,
      temperature: 0.3,
    });

    const parsedResponse = JSON.parse(aiResponse.choices[0].message.content);
    
    // If AI wants to create an event and has enough details, prepare for confirmation
    if (parsedResponse.intent === 'create_event' && parsedResponse.event_details) {
      const eventDetails = parsedResponse.event_details;
      
      // Validate required fields
      if (eventDetails.title && eventDetails.start_date && eventDetails.start_time) {
        // Format the event for calendar creation
        const startDateTime = new Date(`${eventDetails.start_date}T${eventDetails.start_time}`);
        const endDateTime = eventDetails.end_date && eventDetails.end_time 
          ? new Date(`${eventDetails.end_date}T${eventDetails.end_time}`)
          : new Date(startDateTime.getTime() + (eventDetails.duration_minutes || 60) * 60000);

        parsedResponse.formatted_event = {
          summary: eventDetails.title,
          start: startDateTime.toISOString(),
          end: endDateTime.toISOString(),
          description: eventDetails.description || '',
          location: eventDetails.location || ''
        };
        
        parsedResponse.action = 'confirm';
      }
    }

    res.json(parsedResponse);
  } catch (error) {
    console.error('❌ AI Calendar error:', error);
    res.status(500).json({ 
      error: 'Failed to process calendar request',
      response: "I'm having trouble processing your request right now. Could you try again?",
      action: 'error'
    });
  }
});

// AI Task Scheduler - Convert 1-3-5 tasks into optimal calendar schedule
app.post('/api/ai-schedule-tasks', async (req, res) => {
  try {
    const { tasks, preferences = {} } = req.body;
    console.log('🤖 AI Task Scheduler request:', tasks);

    // Check if we have valid calendar credentials
    if (!oauth2Client.credentials || !oauth2Client.credentials.access_token) {
      return res.json({
        error: 'Calendar not authenticated',
        message: 'Please authenticate with Google Calendar first.'
      });
    }

    // Get current time and available time slots
    const now = new Date();
    const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    const endOfWeek = new Date(today.getTime() + 7 * 24 * 60 * 60 * 1000);

    // Fetch existing calendar events for context
    let existingEvents = [];
    try {
      const response = await calendar.events.list({
        calendarId: 'primary',
        timeMin: now.toISOString(),
        timeMax: endOfWeek.toISOString(),
        singleEvents: true,
        orderBy: 'startTime',
        maxResults: 50
      });
      existingEvents = response.data.items || [];
    } catch (error) {
      console.log('Could not fetch existing events for scheduling context');
    }

    // Prepare context for AI
    const currentTime = now.toLocaleString();
    const existingEventsContext = existingEvents.length > 0 
      ? existingEvents.map(e => {
          const start = new Date(e.start.dateTime || e.start.date);
          const end = new Date(e.end.dateTime || e.end.date);
          return `${e.summary}: ${start.toLocaleDateString()} ${start.toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'})} - ${end.toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'})}`;
        }).join('\n')
      : 'No existing events this week';

    const prompt = `You are an AI productivity scheduler. Create an optimal weekly schedule for these 1-3-5 tasks, avoiding conflicts with existing calendar events.

Current time: ${currentTime}
Working hours preference: ${preferences.workingHours || '9 AM - 6 PM'}
Energy preference: ${preferences.energyPreference || 'High energy tasks in morning, lighter tasks in afternoon'}

TASKS TO SCHEDULE:
Big Tasks (1): ${tasks.big?.map(t => `${t.text} (${t.duration ? t.duration + ' min' : 'no duration specified'})`).join(', ') || 'None'}
Medium Tasks (3): ${tasks.medium?.map(t => `${t.text} (${t.duration ? t.duration + ' min' : 'no duration specified'})`).join(', ') || 'None'}  
Small Tasks (5): ${tasks.small?.map(t => `${t.text} (${t.duration ? t.duration + ' min' : 'no duration specified'})`).join(', ') || 'None'}

EXISTING CALENDAR EVENTS (avoid conflicts):
${existingEventsContext}

SCHEDULING RULES:
- Use the user-provided duration for each task (when specified)
- Big tasks: Generally longer duration, schedule during peak energy times (9-11 AM, 2-4 PM)
- Medium tasks: Moderate duration, flexible timing but avoid post-lunch dip (1-2 PM)
- Small tasks: Shorter duration, perfect for low energy times or between meetings
- Add 15-minute buffers between different task types
- BATCHING OPTIMIZATION:
  * Group tasks with similar durations together (e.g., three 30-min tasks in a row)
  * Batch similar complexity tasks to maintain flow state
  * Create "power hours" for small tasks (batch 3-4 small tasks together)
  * Schedule big tasks when there's uninterrupted time available
- ENERGY OPTIMIZATION:
  * High energy times: Big tasks, complex work, creative tasks
  * Medium energy times: Medium tasks, administrative work
  * Low energy times: Small tasks, routine work, email/communication
- Respect existing calendar events and avoid back-to-back scheduling when possible
- Prefer weekdays for work tasks, but can use weekends for personal tasks
- If no duration specified, estimate based on task complexity and type

Respond with JSON:
{
  "schedule": [
    {
      "task_id": "big_1" | "medium_1" | "small_1",
      "task_text": "Original task text",
      "task_type": "big" | "medium" | "small",
      "title": "Calendar event title",
      "start_date": "YYYY-MM-DD",
      "start_time": "HH:MM",
      "end_date": "YYYY-MM-DD", 
      "end_time": "HH:MM",
      "duration_minutes": 120,
      "user_specified_duration": true,
      "reasoning": "Why this time slot",
      "energy_level": "high" | "medium" | "low",
      "batched_with": ["medium_2", "medium_3"],
      "optimization_strategy": "batching" | "energy_matching" | "gap_filling"
    }
  ],
  "summary": "Overall scheduling strategy explanation",
  "optimization_insights": {
    "batched_sessions": 2,
    "energy_aligned_tasks": 8,
    "total_buffer_time": "45 minutes",
    "peak_time_utilization": "85%"
  },
  "tips": ["Productivity tip 1", "Productivity tip 2"],
  "total_scheduled_time": "X hours Y minutes"
}`;

    const aiResponse = await openai.chat.completions.create({
      model: 'gpt-4',
      messages: [{ role: 'user', content: prompt }],
      max_tokens: 1500,
      temperature: 0.3,
    });

    const schedulingResult = JSON.parse(aiResponse.choices[0].message.content);
    
    // Format events for calendar creation
    const formattedEvents = schedulingResult.schedule.map(item => ({
      summary: item.title,
      description: `📋 Task: ${item.task_text}\n\n🧠 Energy Level: ${item.energy_level}\n💡 Reasoning: ${item.reasoning}`,
      start: new Date(`${item.start_date}T${item.start_time}`).toISOString(),
      end: new Date(`${item.end_date}T${item.end_time}`).toISOString(),
      colorId: item.task_type === 'big' ? '11' : item.task_type === 'medium' ? '9' : '2', // Red for big, blue for medium, green for small
      extendedProperties: {
        private: {
          lifeops_task_id: item.task_id,
          lifeops_task_type: item.task_type,
          lifeops_energy_level: item.energy_level
        }
      }
    }));

    res.json({
      success: true,
      schedule: schedulingResult.schedule,
      formatted_events: formattedEvents,
      summary: schedulingResult.summary,
      tips: schedulingResult.tips,
      total_time: schedulingResult.total_scheduled_time,
      events_count: formattedEvents.length
    });

  } catch (error) {
    console.error('❌ AI Task Scheduler error:', error);
    res.status(500).json({ 
      error: 'Failed to create task schedule',
      message: "I'm having trouble creating your schedule right now. Please try again."
    });
  }
});

// Confirm and commit task schedule to calendar
app.post('/api/ai-schedule-tasks/confirm', async (req, res) => {
  try {
    const { events } = req.body;
    console.log('📅 Creating AI task schedule with', events.length, 'events');

    // Check if we have valid credentials
    if (!oauth2Client.credentials || !oauth2Client.credentials.access_token) {
      return res.status(401).json({ 
        error: 'Calendar not authenticated',
        message: 'Please authenticate with Google Calendar first.'
      });
    }

    const createdEvents = [];
    const errors = [];

    // Create each event in the schedule
    for (const eventData of events) {
      try {
        const event = {
          summary: eventData.summary,
          description: eventData.description || '',
          start: {
            dateTime: eventData.start,
            timeZone: 'America/New_York',
          },
          end: {
            dateTime: eventData.end,
            timeZone: 'America/New_York',
          },
          colorId: eventData.colorId || '1',
          extendedProperties: eventData.extendedProperties || {}
        };

        const response = await calendar.events.insert({
          calendarId: 'primary',
          resource: event,
        });

        createdEvents.push({
          id: response.data.id,
          summary: response.data.summary,
          start: response.data.start?.dateTime,
          end: response.data.end?.dateTime,
          htmlLink: response.data.htmlLink
        });

      } catch (eventError) {
        console.error('Error creating event:', eventData.summary, eventError.message);
        errors.push({
          event: eventData.summary,
          error: eventError.message
        });
      }
    }

    const successCount = createdEvents.length;
    const errorCount = errors.length;

    console.log(`📅 Task scheduling complete: ${successCount} created, ${errorCount} failed`);
    
    res.json({ 
      success: true,
      created_events: createdEvents,
      errors: errors,
      summary: `Successfully scheduled ${successCount} of ${events.length} tasks. ${errorCount > 0 ? `${errorCount} events had errors.` : 'All events created successfully!'}`
    });

  } catch (error) {
    console.error('❌ Error confirming task schedule:', error);
    res.status(500).json({ 
      error: 'Failed to create task schedule',
      message: 'Sorry, I had trouble creating your task schedule. Please try again.'
    });
  }
});

// Confirm and create event endpoint
app.post('/api/ai-calendar/confirm', async (req, res) => {
  try {
    const { eventData } = req.body;
    console.log('📅 Creating AI-suggested event:', eventData.summary);

    // Check if we have valid credentials
    if (!oauth2Client.credentials || !oauth2Client.credentials.access_token) {
      return res.status(401).json({ 
        error: 'Calendar not authenticated',
        response: 'Please authenticate with Google Calendar first.'
      });
    }

    // Create the event using existing endpoint logic
    const event = {
      summary: eventData.summary,
      description: eventData.description || '',
      location: eventData.location || '',
      start: {
        dateTime: eventData.start,
        timeZone: 'America/New_York',
      },
      end: {
        dateTime: eventData.end,
        timeZone: 'America/New_York',
      },
    };

    const response = await calendar.events.insert({
      calendarId: 'primary',
      resource: event,
    });

    console.log('📅 AI Event created successfully:', response.data.id);
    
    res.json({ 
      success: true,
      event: {
        id: response.data.id,
        summary: response.data.summary,
        start: response.data.start?.dateTime || response.data.start?.date,
        end: response.data.end?.dateTime || response.data.end?.date,
        location: response.data.location,
        description: response.data.description,
        htmlLink: response.data.htmlLink
      },
      response: `Perfect! I've created "${eventData.summary}" in your calendar. The event is scheduled for ${new Date(eventData.start).toLocaleString()}.`
    });
  } catch (error) {
    console.error('❌ Error creating AI event:', error);
    res.status(500).json({ 
      error: 'Failed to create calendar event',
      response: 'Sorry, I had trouble creating that event. Please try again.'
    });
  }
});

// ====================================
// BIRTHDAY API ENDPOINTS
// ====================================

// Get today's birthdays
app.get('/api/birthdays/today', async (req, res) => {
  try {
    console.log('🎂 Getting today\'s birthdays...');
    const birthdays = await getTodaysBirthdays();
    
    // Format birthdays as calendar events
    const events = birthdays.map(birthday => ({
      id: `birthday_${birthday.id}`,
      summary: `🎂 ${birthday.name}'s Birthday`,
      start: new Date().toISOString().split('T')[0], // Today's date
      end: new Date().toISOString().split('T')[0],
      location: '',
      description: `Happy Birthday to ${birthday.name}!${birthday.facebook_url ? ` Visit their Facebook: ${birthday.facebook_url}` : ''}`,
      type: 'birthday',
      allDay: true,
      friend: {
        name: birthday.name,
        facebookId: birthday.facebook_id,
        facebookUrl: birthday.facebook_url
      }
    }));

    console.log(`🎉 Found ${events.length} birthdays today`);
    res.json({ events });
  } catch (error) {
    console.error('❌ Error getting today\'s birthdays:', error);
    res.status(500).json({ 
      events: [],
      error: 'Failed to get today\'s birthdays',
      details: error.message 
    });
  }
});

// Get upcoming birthdays
app.get('/api/birthdays/upcoming', async (req, res) => {
  try {
    const days = parseInt(req.query.days) || 30;
    console.log(`📅 Getting upcoming birthdays for next ${days} days...`);
    
    const birthdays = await getUpcomingBirthdays(days);
    
    // Format birthdays as calendar events
    const events = birthdays.map(birthday => {
      const currentYear = new Date().getFullYear();
      const birthdayDate = new Date(currentYear, birthday.birth_month - 1, birthday.birth_day);
      
      // If birthday has passed this year, show next year
      if (birthdayDate < new Date()) {
        birthdayDate.setFullYear(currentYear + 1);
      }
      
      const dateStr = birthdayDate.toISOString().split('T')[0];
      
      return {
        id: `birthday_${birthday.id}`,
        summary: `🎂 ${birthday.name}'s Birthday`,
        start: dateStr,
        end: dateStr,
        location: '',
        description: `Happy Birthday to ${birthday.name}!${birthday.facebook_url ? ` Visit their Facebook: ${birthday.facebook_url}` : ''}`,
        type: 'birthday',
        allDay: true,
        friend: {
          name: birthday.name,
          facebookId: birthday.facebook_id,
          facebookUrl: birthday.facebook_url,
          birthMonth: birthday.birth_month,
          birthDay: birthday.birth_day
        }
      };
    });

    console.log(`🎉 Found ${events.length} upcoming birthdays`);
    res.json({ events });
  } catch (error) {
    console.error('❌ Error getting upcoming birthdays:', error);
    res.status(500).json({ 
      events: [],
      error: 'Failed to get upcoming birthdays',
      details: error.message 
    });
  }
});

// Get birthday statistics
app.get('/api/birthdays/stats', async (req, res) => {
  try {
    console.log('📊 Getting birthday statistics...');
    
    const todaysBirthdays = await getTodaysBirthdays();
    const upcomingWeek = await getUpcomingBirthdays(7);
    const upcomingMonth = await getUpcomingBirthdays(30);
    
    const stats = {
      today: todaysBirthdays.length,
      thisWeek: upcomingWeek.length,
      thisMonth: upcomingMonth.length,
      todaysFriends: todaysBirthdays.map(b => b.name),
      nextBirthday: upcomingWeek.length > 0 ? {
        name: upcomingWeek[0].name,
        date: `${upcomingWeek[0].birth_month}/${upcomingWeek[0].birth_day}`
      } : null
    };

    console.log('📊 Birthday stats:', stats);
    res.json(stats);
  } catch (error) {
    console.error('❌ Error getting birthday stats:', error);
    res.status(500).json({ 
      error: 'Failed to get birthday statistics',
      details: error.message 
    });
  }
});

// Get birthday contacts (people whose birthdays are today/upcoming and we have their contact info)
app.get('/api/birthday-contacts', async (req, res) => {
  try {
    const includePast = req.query.includePast === 'true';
    const upcomingDays = parseInt(req.query.upcomingDays) || 7;
    
    console.log(`🎂 Getting birthday contacts (upcoming: ${upcomingDays} days, includePast: ${includePast})`);
    
    const todaysBirthdayContacts = await getTodaysBirthdayContacts();
    const upcomingBirthdayContacts = await getUpcomingBirthdayContacts(upcomingDays);
    
    const allBirthdayContacts = [...todaysBirthdayContacts, ...upcomingBirthdayContacts];
    
    // Format for check-ins display
    const formattedContacts = allBirthdayContacts.map(contact => ({
      name: contact.contactName || contact.name,
      rawContact: contact.phoneNumber || 'No phone',
      daysSince: contact.daysSince,
      reason: contact.reason,
      suggestedMessage: contact.suggestedMessage,
      messageCount: contact.messageCount,
      isResolved: !!contact.phoneNumber,
      birthdayContact: true,
      birthdayInfo: {
        birthMonth: contact.birth_month,
        birthDay: contact.birth_day,
        daysUntilBirthday: contact.daysUntilBirthday || 0,
        facebookUrl: contact.facebook_url
      }
    }));
    
    res.json({
      success: true,
      birthdayContacts: formattedContacts,
      summary: {
        todayCount: todaysBirthdayContacts.length,
        upcomingCount: upcomingBirthdayContacts.length,
        totalWithContacts: allBirthdayContacts.length
      }
    });
    
  } catch (error) {
    console.error('❌ Error getting birthday contacts:', error);
    res.status(500).json({ 
      error: 'Failed to get birthday contacts',
      details: error.message 
    });
  }
});

// Debug endpoint to test Gmail API directly
app.get('/api/debug-gmail', async (req, res) => {
  try {
    console.log('🔍 Testing Gmail API...');
    
    // Check if credentials are set
    const credentials = oauth2Client.credentials;
    console.log('📋 OAuth2 credentials loaded:', !!credentials.access_token);
    
    // Try to list messages
    const response = await gmail.users.messages.list({
      userId: 'me',
      maxResults: 5,
      q: 'is:unread'
    });
    
    console.log('📧 Gmail response:', response.data);
    
    res.json({
      success: true,
      hasCredentials: !!credentials.access_token,
      messageCount: response.data.messages?.length || 0,
      messages: response.data.messages || []
    });
  } catch (error) {
    console.error('❌ Debug Gmail error:', error);
    res.json({
      success: false,
      error: error.message,
      hasCredentials: !!oauth2Client.credentials?.access_token
    });
  }
});

// Health check
app.get('/api/health', (req, res) => {
  res.json({
    status: 'OK',
    openai: !!process.env.OPENAI_API_KEY,
    gmail: !!process.env.GMAIL_CLIENT_ID,
    stats: dailyStats
  });
});

// Health Analytics Routes
app.get('/api/health/overview', async (req, res) => {
  try {
    await getHealthData(); // Use cached data
    const overview = healthAnalytics.getHealthOverview();
    res.json({ overview });
  } catch (error) {
    console.error('Error loading health overview:', error);
    res.status(500).json({ error: 'Failed to load health data' });
  }
});

app.get('/api/health/trends', async (req, res) => {
  try {
    await getHealthData(); // Use cached data
    const timeframe = parseInt(req.query.days) || 90;
    const analysis = await healthAnalytics.analyzeTrends('all', timeframe);
    res.json(analysis);
  } catch (error) {
    console.error('Error analyzing health trends:', error);
    res.status(500).json({ error: 'Failed to analyze trends' });
  }
});

app.get('/api/health/workout-analysis', async (req, res) => {
  try {
    await getHealthData(); // Use cached data
    const analysis = await healthAnalytics.analyzeWorkoutPerformance();
    res.json({ analysis });
  } catch (error) {
    console.error('Error analyzing workouts:', error);
    res.status(500).json({ error: 'Failed to analyze workouts' });
  }
});

app.get('/api/health/sleep-analysis', async (req, res) => {
  try {
    await getHealthData(); // Use cached data
    const analysis = await healthAnalytics.analyzeSleepQuality();
    res.json({ analysis });
  } catch (error) {
    console.error('Error analyzing sleep:', error);
    res.status(500).json({ error: 'Failed to analyze sleep' });
  }
});

app.get('/api/health/daily-brief', async (req, res) => {
  try {
    await getHealthData(); // Use cached data
    const brief = await healthAnalytics.generateHealthBrief();
    res.json({ brief });
  } catch (error) {
    console.error('Error generating daily brief:', error);
    res.status(500).json({ error: 'Failed to generate daily brief' });
  }
});

app.get('/api/health/recommendations', async (req, res) => {
  try {
    await getHealthData(); // Use cached data
    const { goals, mood } = req.query;
    const recommendations = await healthAnalytics.generatePersonalizedRecommendations(goals, mood);
    res.json({ recommendations });
  } catch (error) {
    console.error('Error generating recommendations:', error);
    res.status(500).json({ error: 'Failed to generate recommendations' });
  }
});

app.get('/api/health/hrv-analysis', async (req, res) => {
  try {
    await getHealthData(); // Use cached data
    const analysis = await healthAnalytics.analyzeHeartRateVariability();
    res.json({ analysis });
  } catch (error) {
    console.error('Error analyzing HRV:', error);
    res.status(500).json({ error: 'Failed to analyze HRV' });
  }
});

// Load legacy tokens for calendar functionality
loadLegacyToken();

// Conversation Analysis and Smart Message Suggestions

// Smart Message Suggestion API endpoint
app.post('/api/smart-message', async (req, res) => {
  try {
    const { phoneNumber, contactName, daysBack = 30 } = req.body;
    
    if (!phoneNumber || !contactName) {
      return res.status(400).json({ 
        error: 'Phone number and contact name are required' 
      });
    }

    console.log(`🤖 Generating smart message for ${contactName} (${phoneNumber})`);
    
    // Detect if this is a birthday message request
    const isBirthdayMessage = req.body.birthdayContact || req.body.specialOccasion === 'birthday';
    
    if (isBirthdayMessage) {
      console.log(`🎂 Birthday message detected for ${contactName}!`);
    }
    
    const analysis = await analyzeConversationAndSuggestMessage(openai, phoneNumber, contactName, daysBack, isBirthdayMessage);
    
    res.json({
      success: true,
      contact: {
        name: contactName,
        phone: phoneNumber
      },
      analysis,
      timestamp: new Date().toISOString()
    });

  } catch (error) {
    console.error('❌ Error generating smart message:', error);
    res.status(500).json({
      error: 'Failed to generate smart message suggestion',
      message: error.message
    });
  }
});

// Import and mount productivity orchestration routes
try {
  console.log('📦 Loading productivity routes...');
  const productivityRoutes = require('./routes/productivity');
  const pomodoroRoutes = require('./routes/pomodoro');
  const notificationRoutes = require('./routes/notifications');

  app.use('/api/productivity', productivityRoutes);
  app.use('/api/pomodoro', pomodoroRoutes);
  app.use('/api/notifications', notificationRoutes);
  console.log('✅ Productivity routes mounted successfully');
} catch (error) {
  console.error('❌ Error loading productivity routes:', error.message);
}

// Import and mount social planner routes
try {
  console.log('📦 Loading social planner routes...');
  const socialPlannerRoutes = require('./routes/socialplanner');
  
  app.use('/api/social', socialPlannerRoutes);
  console.log('✅ Social planner routes mounted successfully at /api/social');
} catch (error) {
  console.error('❌ Error loading social planner routes:', error.message);
}


// Mount static middleware AFTER API routes to prevent conflicts
app.use(express.static('public'));

// EmailService loads its own tokens automatically
console.log('🚀 LifeOps server initialized with enhanced email services and productivity orchestration');

// If running directly (not imported as module), start the server
if (require.main === module) {
  app.listen(port, () => {
    console.log(`✅ Express server running directly on http://localhost:${port}`);
  });
}

module.exports = app;