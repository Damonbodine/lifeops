require('dotenv').config();
const { google } = require('googleapis');
const OpenAI = require('openai');

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

async function getEmails() {
  try {
    console.log('📧 Fetching recent emails...');
    
    // Get emails from last hour
    const oneHourAgo = new Date(Date.now() - 60 * 60 * 1000);
    const query = `after:${oneHourAgo.toISOString().split('T')[0].replace(/-/g, '/')}`;
    
    const response = await gmail.users.messages.list({
      userId: 'me',
      maxResults: 5,
      q: query,
    });

    if (!response.data.messages) {
      console.log('No recent emails found');
      return [];
    }

    const emails = [];
    for (const message of response.data.messages.slice(0, 3)) {
      const fullMessage = await gmail.users.messages.get({
        userId: 'me',
        id: message.id,
        format: 'full',
      });

      const headers = fullMessage.data.payload.headers;
      const subject = headers.find(h => h.name === 'Subject')?.value || 'No Subject';
      const from = headers.find(h => h.name === 'From')?.value || 'Unknown';
      
      let body = '';
      if (fullMessage.data.payload.body.data) {
        body = Buffer.from(fullMessage.data.payload.body.data, 'base64').toString();
      }

      emails.push({ subject, from, body: body.substring(0, 1000) });
    }

    return emails;
  } catch (error) {
    console.error('Error fetching emails:', error.message);
    return [];
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

Format as JSON:
{
  "summary": "...",
  "priority": "...",
  "actionNeeded": "..."
}`;

    const response = await openai.chat.completions.create({
      model: 'gpt-3.5-turbo',
      messages: [{ role: 'user', content: prompt }],
      max_tokens: 200,
      temperature: 0.1,
    });

    const result = JSON.parse(response.choices[0].message.content);
    return result;
  } catch (error) {
    console.error('Error summarizing email:', error.message);
    return {
      summary: 'Failed to summarize',
      priority: 'Medium',
      actionNeeded: 'Unknown'
    };
  }
}

async function main() {
  console.log('🚀 LifeOps Email Summarizer Starting...');
  console.log('📋 Environment check:');
  console.log('  OpenAI API Key:', !!process.env.OPENAI_API_KEY);
  console.log('  Gmail Client ID:', !!process.env.GMAIL_CLIENT_ID);
  console.log('');

  // For now, we'll need Gmail auth token
  // Let's create a simple version that works
  console.log('⚠️  Gmail authentication needed. For demo, using mock data:');
  
  const mockEmails = [
    {
      from: 'team@cartesia.ai',
      subject: 'Cartesia Weekly Update | Jul 1, 2025',
      body: 'Weekly updates from our AI voice team. New features released this week including real-time voice synthesis improvements and better latency. Our team has been working on optimizing the voice models for production use cases.'
    },
    {
      from: 'noreply@bolt.com',
      subject: 'THANK YOU - World\'s Largest Hackathon presented by Bolt',
      body: 'Thank you for participating in our hackathon. Winners will be announced next week. Prize distribution starts Monday. Check your email for winner announcements and next steps for collecting prizes.'
    }
  ];

  console.log('📧 Processing emails...\n');

  for (const email of mockEmails) {
    console.log(`📬 Email: ${email.subject}`);
    console.log(`👤 From: ${email.from}`);
    
    const summary = await summarizeEmail(email);
    
    console.log(`📝 Summary: ${summary.summary}`);
    console.log(`⚡ Priority: ${summary.priority}`);
    console.log(`🎯 Action Needed: ${summary.actionNeeded}`);
    console.log('─'.repeat(50));
  }

  console.log('\n✅ Email summarization complete!');
}

main().catch(console.error);