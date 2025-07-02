require('dotenv').config();
const express = require('express');
const { google } = require('googleapis');
const OpenAI = require('openai');
const sqlite3 = require('sqlite3').verbose();
const path = require('path');
const os = require('os');
const fs = require('fs').promises;

// Import new services
const emailService = require('./services/emailService');
const emailSummarizer = require('./services/emailSummarizer');

const app = express();
const port = 3000;

app.use(express.json());
app.use(express.static('public'));

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

// In-memory storage (replace with database in production)
let sessions = [];
let tasks = { big: [], medium: [], small: [] };
let dailyStats = {
  focusTime: 0,
  completedSessions: 0,
  tasksCompleted: 0,
  productivityScore: 85
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
  const { type, text } = req.body;
  const limits = { big: 1, medium: 3, small: 5 };
  
  if (tasks[type].length >= limits[type]) {
    return res.status(400).json({ error: `Maximum ${limits[type]} ${type} tasks allowed` });
  }
  
  const task = {
    id: Date.now(),
    text,
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

// AI Daily Score endpoint
app.get('/api/ai-score', async (req, res) => {
  try {
    // Calculate dynamic productivity score based on actual data
    const focusScore = Math.min(100, (dailyStats.focusTime / 120) * 100); // Target: 2 hours
    const sessionScore = Math.min(100, (dailyStats.completedSessions / 4) * 100); // Target: 4 sessions
    const taskScore = Math.min(100, (dailyStats.tasksCompleted / 9) * 100); // Target: 9 tasks (1+3+5)
    
    const overallScore = Math.round((focusScore + sessionScore + taskScore) / 3);
    
    // Generate AI insights using OpenAI
    const prompt = `Based on this productivity data, provide insights:
    - Focus time: ${dailyStats.focusTime} minutes
    - Completed sessions: ${dailyStats.completedSessions}
    - Tasks completed: ${dailyStats.tasksCompleted}
    - Overall score: ${overallScore}%
    
    Provide:
    1. 2-3 strengths (if any)
    2. 2-3 improvement suggestions
    3. One motivational insight
    
    Format as JSON:
    {
      "score": ${overallScore},
      "strengths": ["...", "..."],
      "improvements": ["...", "..."],
      "motivation": "..."
    }`;

    const response = await openai.chat.completions.create({
      model: 'gpt-3.5-turbo',
      messages: [{ role: 'user', content: prompt }],
      max_tokens: 300,
      temperature: 0.7,
    });

    const insights = JSON.parse(response.choices[0].message.content);
    
    res.json({
      score: overallScore,
      stats: dailyStats,
      insights
    });
  } catch (error) {
    console.error('Error generating AI score:', error);
    res.json({
      score: overallScore || 85,
      stats: dailyStats,
      insights: {
        strengths: ["You're building good productivity habits"],
        improvements: ["Try longer focus sessions", "Break down big tasks"],
        motivation: "Every small step forward is progress worth celebrating!"
      }
    });
  }
});

// Helper function to normalize phone numbers
function normalizePhoneNumber(phoneNumber) {
  if (!phoneNumber) return phoneNumber;
  
  // Remove all non-digit characters
  const digits = phoneNumber.replace(/\D/g, '');
  
  // If it starts with 1 and has 11 digits, remove the leading 1
  if (digits.length === 11 && digits.startsWith('1')) {
    return '+1' + digits.slice(1);
  }
  
  // If it has 10 digits, add +1
  if (digits.length === 10) {
    return '+1' + digits;
  }
  
  // Otherwise, add + if not present
  return digits.startsWith('+') ? phoneNumber : '+' + digits;
}

// Helper function to get contact name using AppleScript
async function getContactName(phoneOrEmail) {
  return new Promise((resolve) => {
    try {
      const { exec } = require('child_process');
      
      // For emails, try a simpler approach first
      if (phoneOrEmail.includes('@')) {
        const emailName = phoneOrEmail.split('@')[0];
        const cleanName = emailName.replace(/[._+]/g, ' ')
                                   .replace(/\b\w/g, l => l.toUpperCase())
                                   .replace(/\d+/g, '').trim();
        if (cleanName && cleanName !== phoneOrEmail) {
          resolve({ name: cleanName, isResolved: false });
          return;
        }
      }
      
      // For phone numbers, try multiple formats to find contacts
      const digits = phoneOrEmail.replace(/\D/g, '');
      const searchFormats = [];
      
      if (digits.length === 10) {
        searchFormats.push(
          `(${digits.slice(0,3)}) ${digits.slice(3,6)}-${digits.slice(6)}`,
          `${digits.slice(0,3)}-${digits.slice(3,6)}-${digits.slice(6)}`,
          `+1${digits}`,
          digits
        );
      } else if (digits.length === 11 && digits.startsWith('1')) {
        const tenDigit = digits.slice(1);
        searchFormats.push(
          `(${tenDigit.slice(0,3)}) ${tenDigit.slice(3,6)}-${tenDigit.slice(6)}`,
          `${tenDigit.slice(0,3)}-${tenDigit.slice(3,6)}-${tenDigit.slice(6)}`,
          `+${digits}`,
          tenDigit,
          digits
        );
      }
      
      // Try to find contact with multiple phone formats
      const appleScript = `
        tell application "Contacts"
          try
            set searchResults to {}
            ${searchFormats.map(format => `
            try
              set tempResults to (every person whose (value of phones contains "${format}"))
              if length of tempResults > 0 then
                set searchResults to tempResults
              end if
            end try`).join('\n')}
            
            if length of searchResults > 0 then
              set contactPerson to item 1 of searchResults
              set firstName to ""
              set lastName to ""
              try
                set firstName to first name of contactPerson
              end try
              try
                set lastName to last name of contactPerson
              end try
              
              if firstName is not "" or lastName is not "" then
                return firstName & " " & lastName
              else
                try
                  set orgName to organization of contactPerson
                  if orgName is not "" then
                    return orgName
                  end if
                end try
                return "UNNAMED_CONTACT"
              end if
            else
              return "NOT_FOUND"
            end if
          on error errorMsg
            return "ERROR: " & errorMsg
          end try
        end tell
      `;
      
      // Execute AppleScript with timeout
      exec(`osascript -e '${appleScript}'`, { timeout: 5000 }, (error, stdout, stderr) => {
        if (error || stderr) {
          console.log(`Contact lookup failed for ${phoneOrEmail}:`, error?.message || stderr);
          resolve({ name: getFormattedName(phoneOrEmail), isResolved: false });
          return;
        }
        
        const result = stdout.trim();
        if (result === 'NOT_FOUND' || result === 'ERROR' || result.startsWith('ERROR:') || result === '') {
          resolve({ name: getFormattedName(phoneOrEmail), isResolved: false });
        } else if (result === 'UNNAMED_CONTACT') {
          resolve({ name: getFormattedName(phoneOrEmail), isResolved: false });
        } else {
          // Clean up the result
          const cleanResult = result.replace(/\s+/g, ' ').trim();
          if (cleanResult && cleanResult !== ' ' && cleanResult !== 'missing value missing value') {
            resolve({ name: cleanResult, isResolved: true });
          } else {
            resolve({ name: getFormattedName(phoneOrEmail), isResolved: false });
          }
        }
      });
      
    } catch (error) {
      console.error('Error in contact lookup:', error);
      resolve({ name: getFormattedName(phoneOrEmail), isResolved: false });
    }
  });
}

// Helper function for enhanced name formatting
function getFormattedName(phoneOrEmail) {
  if (phoneOrEmail.includes('@')) {
    // Email: extract name part and format nicely
    const emailName = phoneOrEmail.split('@')[0];
    return emailName.replace(/[._+]/g, ' ')
                   .replace(/\b\w/g, l => l.toUpperCase())
                   .replace(/\d+/g, '').trim() || phoneOrEmail;
  } else {
    // Phone: format as (XXX) XXX-XXXX
    const digits = phoneOrEmail.replace(/\D/g, '');
    if (digits.length === 10) {
      return `(${digits.slice(0,3)}) ${digits.slice(3,6)}-${digits.slice(6)}`;
    } else if (digits.length === 11 && digits.startsWith('1')) {
      return `(${digits.slice(1,4)}) ${digits.slice(4,7)}-${digits.slice(7)}`;
    }
    return phoneOrEmail;
  }
}

// Relationship tracking functions
async function getRecentContacts(daysBack = 90) {
  return new Promise((resolve, reject) => {
    const chatDbPath = path.join(os.homedir(), 'Library', 'Messages', 'chat.db');
    console.log('🔍 Attempting to access chat.db at:', chatDbPath);
    const db = new sqlite3.Database(chatDbPath, sqlite3.OPEN_READONLY, (err) => {
      if (err) {
        console.log('❌ Chat.db access requires Full Disk Access permission:', err.message);
        // Return mock data for demo
        resolve([
          { contact: 'John Smith', rawContact: '+19154971236', lastMessage: new Date(Date.now() - 45 * 24 * 60 * 60 * 1000), daysSince: 45 },
          { contact: 'Sarah Johnson', rawContact: '+12094800633', lastMessage: new Date(Date.now() - 35 * 24 * 60 * 60 * 1000), daysSince: 35 },
          { contact: 'Mike Chen', rawContact: '+17163084168', lastMessage: new Date(Date.now() - 5 * 24 * 60 * 60 * 1000), daysSince: 5 },
          { contact: 'Emma Davis', rawContact: '+19177576633', lastMessage: new Date(Date.now() - 50 * 24 * 60 * 60 * 1000), daysSince: 50 },
          { contact: 'Alex Rodriguez', rawContact: '+14123269472', lastMessage: new Date(Date.now() - 20 * 24 * 60 * 60 * 1000), daysSince: 20 }
        ]);
        return;
      }

      const cutoffDate = (Date.now() - (daysBack * 24 * 60 * 60 * 1000)) * 1000000 - 978307200000000000; // Convert to Apple timestamp
      const query = `
        SELECT 
          handle.id as contact,
          MAX(CASE WHEN message.is_from_me = 1 THEN message.date ELSE NULL END) as last_sent_date,
          MAX(message.date) as last_any_message_date,
          COUNT(message.ROWID) as message_count,
          COUNT(CASE WHEN message.is_from_me = 1 THEN 1 END) as sent_count
        FROM message 
        JOIN chat_message_join ON message.ROWID = chat_message_join.message_id
        JOIN chat ON chat_message_join.chat_id = chat.ROWID
        JOIN chat_handle_join ON chat.ROWID = chat_handle_join.chat_id
        JOIN handle ON chat_handle_join.handle_id = handle.ROWID
        WHERE message.date > ? AND handle.id IS NOT NULL
        GROUP BY handle.id
        HAVING COUNT(message.ROWID) >= 2 AND sent_count > 0
        ORDER BY last_sent_date ASC NULLS LAST
        LIMIT 50
      `;

      db.all(query, [cutoffDate], async (err, rows) => {
        db.close();
        if (err) {
          console.error('Error querying messages:', err);
          resolve([]);
          return;
        }

        // Convert timestamps and get contact names
        const contactPromises = rows.map(async (row) => {
          // Use last_sent_date (when you last messaged them) for relationship tracking
          const lastSentMessage = row.last_sent_date ? new Date((row.last_sent_date / 1000000) + 978307200000) : null;
          const lastAnyMessage = new Date((row.last_any_message_date / 1000000) + 978307200000);
          
          // Calculate days since YOU last messaged them (not since any activity)
          const daysSince = lastSentMessage ? 
            Math.floor((Date.now() - lastSentMessage.getTime()) / (24 * 60 * 60 * 1000)) :
            999; // If you never messaged them, mark as very old
          
          const contactResult = await getContactName(row.contact);
          
          return {
            contact: contactResult.name,
            rawContact: row.contact,
            lastMessage: lastSentMessage || lastAnyMessage,
            lastSentMessage,
            lastAnyMessage,
            daysSince,
            messageCount: row.message_count,
            sentCount: row.sent_count,
            isResolved: contactResult.isResolved
          };
        });

        const contacts = await Promise.all(contactPromises);
        resolve(contacts);
      });
    });
  });
}

async function getFriendsToCheckIn(daysThreshold = 30) {
  try {
    const recentContacts = await getRecentContacts(365); // Look back 1 year to find more contacts
    console.log('📊 Found', recentContacts.length, 'total contacts');
    console.log('📊 Sample contacts:', recentContacts.slice(0, 5).map(c => `${c.contact}: ${c.daysSince} days`));
    // Filter for contacts that need check-in AND have resolved names
    const needsCheckIn = recentContacts.filter(contact => 
      contact.daysSince >= daysThreshold && contact.isResolved
    );
    const totalNeedsCheckIn = recentContacts.filter(contact => contact.daysSince >= daysThreshold).length;
    
    console.log('📊 Total contacts needing check-in (>=' + daysThreshold + ' days):', totalNeedsCheckIn);
    console.log('📊 Contacts with resolved names:', needsCheckIn.length);
    
    // Return more contacts for scrollable display
    if (needsCheckIn.length > 0) {
      // Take up to 15 contacts for the scrollable list, sorted by days since contact
      const contactsToShow = needsCheckIn.slice(0, 15).map(contact => ({
        name: contact.contact,
        daysSince: contact.daysSince,
        reason: contact.daysSince > 60 ? "Long time since contact" : "Overdue for check-in",
        suggestedMessage: `Hey ${contact.contact.split(' ')[0]}, it's been a while! How have you been?`,
        rawContact: contact.rawContact,
        messageCount: contact.messageCount || 0,
        isResolved: contact.isResolved
      }));

      // Use AI to provide weekly goal and general insights
      const prompt = `Based on this data about ${needsCheckIn.length} contacts with resolved names who need check-ins (out of ${totalNeedsCheckIn} total), provide a weekly goal and insight:

Top contacts: ${needsCheckIn.slice(0, 5).map(c => `${c.contact}: ${c.daysSince} days`).join(', ')}

Provide response as JSON:
{
  "priorityContacts": [],
  "weeklyGoal": "...",
  "totalContacts": ${needsCheckIn.length},
  "totalUnfiltered": ${totalNeedsCheckIn},
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
        weeklyGoal: aiResult.weeklyGoal || "Check in with close friends this week",
        totalContacts: needsCheckIn.length,
        totalUnfiltered: totalNeedsCheckIn,
        insight: aiResult.insight || `Showing ${needsCheckIn.length} contacts with resolved names out of ${totalNeedsCheckIn} total`
      };
    }

    return {
      priorityContacts: [],
      weeklyGoal: "Great job staying connected! Keep up the regular communication."
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

// Check-in API endpoint
app.get('/api/check-ins', async (req, res) => {
  try {
    const checkInData = await getFriendsToCheckIn();
    res.json(checkInData);
  } catch (error) {
    console.error('Error getting check-ins:', error);
    res.status(500).json({ error: 'Failed to analyze relationships' });
  }
});

// Open Messages app endpoint
app.post('/api/open-messages', (req, res) => {
  const { contact } = req.body;
  
  try {
    const { exec } = require('child_process');
    
    // AppleScript to open Messages app with specific contact
    const appleScript = `
      tell application "Messages"
        activate
        set targetBuddy to "${contact}"
        
        try
          set targetChat to text chat id targetBuddy
          set visible of window 1 to true
        on error
          -- If chat doesn't exist, just open Messages app
          set visible of window 1 to true
        end try
      end tell
    `;
    
    exec(`osascript -e '${appleScript}'`, (error, stdout, stderr) => {
      if (error) {
        console.error('Error opening Messages:', error);
        // Fallback: just open Messages app
        exec('open -a Messages', (fallbackError) => {
          if (fallbackError) {
            res.status(500).json({ error: 'Failed to open Messages app' });
          } else {
            res.json({ success: true, message: 'Opened Messages app' });
          }
        });
      } else {
        res.json({ success: true, message: `Opened Messages for ${contact}` });
      }
    });
    
  } catch (error) {
    console.error('Error executing AppleScript:', error);
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
      maxResults: 20
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

// Load legacy tokens for calendar functionality
loadLegacyToken();

// EmailService loads its own tokens automatically
console.log('🚀 LifeOps server initialized with enhanced email services');

// If running directly (not imported as module), start the server
if (require.main === module) {
  app.listen(port, () => {
    console.log(`✅ Express server running directly on http://localhost:${port}`);
  });
}

module.exports = app;