require('dotenv').config();
const express = require('express');
const { google } = require('googleapis');
const OpenAI = require('openai');
const sqlite3 = require('sqlite3').verbose();
const path = require('path');
const os = require('os');
const fs = require('fs').promises;

const app = express();
const port = 3000;

app.use(express.json());
app.use(express.static('public'));

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

// OAuth2 setup
const TOKEN_PATH = 'token.json';
const oauth2Client = new google.auth.OAuth2(
  process.env.GMAIL_CLIENT_ID,
  process.env.GMAIL_CLIENT_SECRET,
  'urn:ietf:wg:oauth:2.0:oob'
);

const gmail = google.gmail({ version: 'v1', auth: oauth2Client });
const calendar = google.calendar({ version: 'v3', auth: oauth2Client });

async function loadToken() {
  try {
    const token = await fs.readFile(TOKEN_PATH);
    oauth2Client.setCredentials(JSON.parse(token));
    console.log('✅ Gmail token loaded successfully.');
  } catch (err) {
    console.error('❌ Error loading token.json. Please run `node authenticate.js` first.');
    // We will let the server run, but Gmail requests will fail.
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

// API endpoint to get summarized emails
app.get('/api/emails', async (req, res) => {
  try {
    // Try to fetch real Gmail emails first, fall back to mock data
    let emailsToSummarize = [];
    let gmailErrorForDebug = null;
    
    try {
      // Attempt to fetch real emails from Gmail
      const response = await gmail.users.messages.list({
        userId: 'me',
        maxResults: 5
        // Removed 'is:unread' filter to get recent emails
      });
      
      if (response.data.messages && response.data.messages.length > 0) {
        const emailPromises = response.data.messages.map(async (msg) => {
          const email = await gmail.users.messages.get({
            userId: 'me',
            id: msg.id,
            format: 'full'
          });
          
          const headers = email.data.payload.headers;
          const subject = headers.find(h => h.name === 'Subject')?.value || 'No Subject';
          const from = headers.find(h => h.name === 'From')?.value || 'Unknown Sender';
          
          // Get email body (simplified)
          let body = 'Email content could not be extracted';
          if (email.data.payload.body?.data) {
            body = Buffer.from(email.data.payload.body.data, 'base64').toString();
          }
          
          return {
            id: msg.id,
            from,
            subject,
            body: body.substring(0, 500), // Limit body length
            timestamp: new Date().toISOString()
          };
        });
        
        emailsToSummarize = await Promise.all(emailPromises);
      } else {
        // If no unread messages, use mock data as a fallback for now
        gmailErrorForDebug = "No unread emails found.";
        emailsToSummarize = [
          {
            id: 1,
            from: 'team@cartesia.ai',
            subject: 'Cartesia Weekly Update | Jul 1, 2025',
            body: 'Weekly updates from our AI voice team. New features released this week including real-time voice synthesis improvements and better latency. Our team has been working on optimizing the voice models for production use cases. Performance improvements of 40% in real-time processing.',
            timestamp: new Date().toISOString()
          }
        ];
      }
    } catch (gmailError) {
      console.error('!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!');
      console.error('!!! GMAIL API ERROR - FULL DETAILS:');
      console.error(gmailError);
      console.error('!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!');
      gmailErrorForDebug = gmailError.message;
      // Fall back to mock emails
      emailsToSummarize = [
      {
        id: 1,
        from: 'team@cartesia.ai',
        subject: 'Cartesia Weekly Update | Jul 1, 2025',
        body: 'Weekly updates from our AI voice team. New features released this week including real-time voice synthesis improvements and better latency. Our team has been working on optimizing the voice models for production use cases. Performance improvements of 40% in real-time processing.',
        timestamp: new Date().toISOString()
      },
      {
        id: 2,
        from: 'noreply@bolt.com', 
        subject: 'THANK YOU - World\'s Largest Hackathon presented by Bolt',
        body: 'Thank you for participating in our hackathon. Winners will be announced next week. Prize distribution starts Monday. Check your email for winner announcements and next steps for collecting prizes. Total prize pool of $100,000.',
        timestamp: new Date().toISOString()
      },
      {
        id: 3,
        from: 'events@langchain.com',
        subject: 'Austin LangChain July Hacky Hour @ Cosmic Coffee Saltillo', 
        body: 'Join us for our monthly LangChain meetup! This month we\'ll be discussing the latest updates to LangChain, including new tools and integrations. Food and drinks will be provided. RSVP required.',
        timestamp: new Date().toISOString()
      }
    ];
    }

    console.log('📧 Processing email summaries...');
    const summaries = [];

    for (const email of emailsToSummarize) {
      const summary = await summarizeEmail(email);
      summaries.push({
        id: email.id,
        from: email.from,
        subject: email.subject,
        timestamp: email.timestamp,
        ...summary
      });
    }

    res.json({ emails: summaries, error: gmailErrorForDebug });
  } catch (error) {
    console.error('Error processing emails:', error);
    res.status(500).json({ error: 'Failed to process emails' });
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

// Helper function to get contact name from AddressBook
async function getContactName(phoneOrEmail) {
  return new Promise((resolve) => {
    try {
      const addressBookPath = path.join(os.homedir(), 'Library', 'Application Support', 'AddressBook', 'AddressBook-v22.abcddb');
      const contactsDbPath = path.join(os.homedir(), 'Library', 'Application Support', 'AddressBook', 'Sources');
      
      // Try macOS Contacts database first
      const contactsPath = path.join(os.homedir(), 'Library', 'Application Support', 'AddressBook', 'AddressBook-v22.abcddb');
      
      const db = new sqlite3.Database(contactsPath, sqlite3.OPEN_READONLY, (err) => {
        if (err) {
          // If we can't access contacts, try to clean up the phone number
          if (phoneOrEmail.includes('@')) {
            // Email - extract name part before @
            const emailName = phoneOrEmail.split('@')[0];
            const cleanName = emailName.replace(/[._]/g, ' ').replace(/\b\w/g, l => l.toUpperCase());
            resolve(cleanName);
          } else {
            // Phone number - keep as is for now
            resolve(phoneOrEmail);
          }
          return;
        }

        // Query for contact name
        const normalizedPhone = normalizePhoneNumber(phoneOrEmail);
        const query = `
          SELECT ZABCDRECORD.ZFIRSTNAME, ZABCDRECORD.ZLASTNAME, ZABCDRECORD.ZORGANIZATION
          FROM ZABCDRECORD 
          JOIN ZABCDPHONENUMBER ON ZABCDRECORD.Z_PK = ZABCDPHONENUMBER.ZOWNER
          WHERE ZABCDPHONENUMBER.ZFULLNUMBER LIKE ? 
             OR ZABCDPHONENUMBER.ZFULLNUMBER LIKE ?
          LIMIT 1
        `;

        db.get(query, [`%${phoneOrEmail}%`, `%${normalizedPhone}%`], (err, row) => {
          db.close();
          
          if (err || !row) {
            // Fallback: format phone number nicely or clean email
            if (phoneOrEmail.includes('@')) {
              const emailName = phoneOrEmail.split('@')[0];
              const cleanName = emailName.replace(/[._]/g, ' ').replace(/\b\w/g, l => l.toUpperCase());
              resolve(cleanName);
            } else {
              resolve(phoneOrEmail);
            }
            return;
          }

          // Build full name
          let fullName = '';
          if (row.ZFIRSTNAME) fullName += row.ZFIRSTNAME;
          if (row.ZLASTNAME) fullName += (fullName ? ' ' : '') + row.ZLASTNAME;
          if (!fullName && row.ZORGANIZATION) fullName = row.ZORGANIZATION;
          
          resolve(fullName || phoneOrEmail);
        });
      });
    } catch (error) {
      console.error('Error accessing contacts:', error);
      resolve(phoneOrEmail);
    }
  });
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
          
          const displayName = await getContactName(row.contact);
          
          return {
            contact: displayName,
            rawContact: row.contact,
            lastMessage: lastSentMessage || lastAnyMessage,
            lastSentMessage,
            lastAnyMessage,
            daysSince,
            messageCount: row.message_count,
            sentCount: row.sent_count
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
    const needsCheckIn = recentContacts.filter(contact => contact.daysSince >= daysThreshold);
    console.log('📊 Contacts needing check-in (>=' + daysThreshold + ' days):', needsCheckIn.length);
    
    // Use AI to analyze and prioritize check-ins
    if (needsCheckIn.length > 0) {
      const prompt = `Analyze these contacts and suggest which 3-5 people I should prioritize checking in with:

${needsCheckIn.map(c => `- ${c.contact}: ${c.daysSince} days since last message`).join('\n')}

Consider:
1. How long it's been since contact
2. Relationship importance (close friends vs acquaintances)
3. Natural conversation starters

Provide response as JSON:
{
  "priorityContacts": [
    {
      "name": "...",
      "daysSince": ...,
      "reason": "...",
      "suggestedMessage": "..."
    }
  ],
  "weeklyGoal": "Check in with 2-3 close friends this week"
}`;

      const response = await openai.chat.completions.create({
        model: 'gpt-3.5-turbo',
        messages: [{ role: 'user', content: prompt }],
        max_tokens: 400,
        temperature: 0.7,
      });

      return JSON.parse(response.choices[0].message.content);
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
    // Mock calendar data for today
    const today = new Date();
    const mockEvents = [
      {
        id: '1',
        summary: 'Team Standup',
        start: new Date(today.getFullYear(), today.getMonth(), today.getDate(), 9, 0),
        end: new Date(today.getFullYear(), today.getMonth(), today.getDate(), 9, 30),
        location: 'Zoom',
        description: 'Daily team sync to discuss progress and blockers'
      },
      {
        id: '2', 
        summary: 'Focus Session - Code Review',
        start: new Date(today.getFullYear(), today.getMonth(), today.getDate(), 10, 30),
        end: new Date(today.getFullYear(), today.getMonth(), today.getDate(), 12, 0),
        description: 'Deep work time for reviewing pull requests and planning features'
      },
      {
        id: '3',
        summary: 'Lunch with Sarah',
        start: new Date(today.getFullYear(), today.getMonth(), today.getDate(), 12, 30),
        end: new Date(today.getFullYear(), today.getMonth(), today.getDate(), 13, 30),
        location: 'Corner Bakery Cafe'
      },
      {
        id: '4',
        summary: 'Product Planning Meeting',
        start: new Date(today.getFullYear(), today.getMonth(), today.getDate(), 15, 0),
        end: new Date(today.getFullYear(), today.getMonth(), today.getDate(), 16, 0),
        location: 'Conference Room B',
        description: 'Q4 roadmap planning and feature prioritization'
      }
    ];

    res.json({ events: mockEvents });
  } catch (error) {
    console.error('Error fetching today\'s events:', error);
    res.status(500).json({ error: 'Failed to fetch calendar events' });
  }
});

app.get('/api/calendar/upcoming', async (req, res) => {
  try {
    const { days = 3 } = req.query;
    
    // Mock upcoming events
    const today = new Date();
    const mockEvents = [
      {
        id: '5',
        summary: 'Client Demo',
        start: new Date(today.getFullYear(), today.getMonth(), today.getDate() + 1, 14, 0),
        end: new Date(today.getFullYear(), today.getMonth(), today.getDate() + 1, 15, 0),
        location: 'Zoom',
        description: 'Demo new features to client stakeholders'
      },
      {
        id: '6',
        summary: 'Doctor Appointment',
        start: new Date(today.getFullYear(), today.getMonth(), today.getDate() + 2, 11, 0),
        end: new Date(today.getFullYear(), today.getMonth(), today.getDate() + 2, 12, 0),
        location: 'Medical Center'
      },
      {
        id: '7',
        summary: 'Weekend Hiking Trip',
        start: new Date(today.getFullYear(), today.getMonth(), today.getDate() + 3, 8, 0),
        end: new Date(today.getFullYear(), today.getMonth(), today.getDate() + 3, 18, 0),
        location: 'Blue Ridge Mountains',
        description: 'Hiking trip with friends - remember to pack lunch and water'
      }
    ];

    res.json({ events: mockEvents });
  } catch (error) {
    console.error('Error fetching upcoming events:', error);
    res.status(500).json({ error: 'Failed to fetch upcoming events' });
  }
});

app.post('/api/calendar/create', async (req, res) => {
  try {
    const { summary, description, start, end, location } = req.body;
    
    // Mock event creation
    const newEvent = {
      id: Date.now().toString(),
      summary: summary || 'New Event',
      description,
      start: new Date(start),
      end: new Date(end),
      location,
      status: 'confirmed'
    };

    console.log('📅 Mock event created:', newEvent.summary);
    res.json({ event: newEvent, success: true });
  } catch (error) {
    console.error('Error creating calendar event:', error);
    res.status(500).json({ error: 'Failed to create calendar event' });
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

loadToken();
module.exports = app;