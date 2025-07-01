require('dotenv').config();
const express = require('express');
const { google } = require('googleapis');
const OpenAI = require('openai');
const sqlite3 = require('sqlite3').verbose();
const path = require('path');
const os = require('os');

const app = express();
const port = 3000;

app.use(express.json());
app.use(express.static('public'));

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

// Gmail setup
const oauth2Client = new google.auth.OAuth2(
  process.env.GMAIL_CLIENT_ID,
  process.env.GMAIL_CLIENT_SECRET,
  'http://localhost'
);

const gmail = google.gmail({ version: 'v1', auth: oauth2Client });

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
    // Mock emails for demo (you can replace with real Gmail API later)
    const mockEmails = [
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

    console.log('📧 Processing email summaries...');
    const summaries = [];

    for (const email of mockEmails) {
      const summary = await summarizeEmail(email);
      summaries.push({
        id: email.id,
        from: email.from,
        subject: email.subject,
        timestamp: email.timestamp,
        ...summary
      });
    }

    res.json({ emails: summaries });
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
  const { intent, duration, completed } = req.body;
  const session = {
    id: Date.now(),
    intent,
    duration: parseInt(duration),
    completed: completed || false,
    timestamp: new Date().toISOString()
  };
  
  sessions.push(session);
  
  if (completed) {
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
    const db = new sqlite3.Database(chatDbPath, sqlite3.OPEN_READONLY, (err) => {
      if (err) {
        console.log('Chat.db access requires Full Disk Access permission');
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
          MAX(message.date) as last_message_date,
          COUNT(message.ROWID) as message_count
        FROM message 
        JOIN chat_message_join ON message.ROWID = chat_message_join.message_id
        JOIN chat ON chat_message_join.chat_id = chat.ROWID
        JOIN chat_handle_join ON chat.ROWID = chat_handle_join.chat_id
        JOIN handle ON chat_handle_join.handle_id = handle.ROWID
        WHERE message.date > ? AND handle.id IS NOT NULL
        GROUP BY handle.id
        HAVING COUNT(message.ROWID) >= 2
        ORDER BY last_message_date DESC
        LIMIT 20
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
          const lastMessage = new Date((row.last_message_date / 1000000) + 978307200000); // Convert Apple timestamp
          const daysSince = Math.floor((Date.now() - lastMessage.getTime()) / (24 * 60 * 60 * 1000));
          
          const displayName = await getContactName(row.contact);
          
          return {
            contact: displayName,
            rawContact: row.contact,
            lastMessage,
            daysSince,
            messageCount: row.message_count
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
    const recentContacts = await getRecentContacts(90); // Look back 90 days
    const needsCheckIn = recentContacts.filter(contact => contact.daysSince >= daysThreshold);
    
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

// Health check
app.get('/api/health', (req, res) => {
  res.json({
    status: 'OK',
    openai: !!process.env.OPENAI_API_KEY,
    gmail: !!process.env.GMAIL_CLIENT_ID,
    stats: dailyStats
  });
});

app.listen(port, () => {
  console.log(`🚀 LifeOps Email Summarizer running at http://localhost:${port}`);
  console.log('📋 Environment:', {
    openai: !!process.env.OPENAI_API_KEY,
    gmail: !!process.env.GMAIL_CLIENT_ID
  });
});