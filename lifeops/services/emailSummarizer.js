const OpenAI = require('openai');

/**
 * Enhanced EmailSummarizer class adapted from main LifeOps project
 * Provides advanced AI-powered email analysis and summarization
 */
class EmailSummarizer {
  constructor() {
    this.openai = new OpenAI({
      apiKey: process.env.OPENAI_API_KEY,
    });

    // Define prompts for different types of analysis
    this.summaryPrompt = `
You are an AI assistant that summarizes emails for a busy professional. Analyze the email and provide a concise, actionable summary.

Email Details:
From: {from}
Subject: {subject}
Body: {body}

Provide a JSON response with:
{
  "summary": "One sentence summary of the email",
  "keyPoints": ["list", "of", "key", "points"],
  "actionItems": ["specific", "actions", "needed"],
  "urgency": "critical|high|medium|low",
  "requiresResponse": true/false,
  "suggestedResponse": "brief response suggestion if applicable",
  "deadline": "ISO date if mentioned or null",
  "category": "work|personal|promotional|social|other"
}

Urgency levels:
- CRITICAL: Immediate action required, emergency, urgent deadline
- HIGH: Important, time-sensitive, from key contacts
- MEDIUM: Normal priority, standard business communication
- LOW: Informational, no action required, can be delayed

Focus on actionable insights and time-sensitive information.`;

    this.personalEmailPrompt = `
You are summarizing a personal email for someone who wants to stay connected with friends and family while managing their time effectively.

Email Details:
From: {from}
Subject: {subject}
Body: {body}

Provide a JSON response with:
{
  "summary": "Warm, personal summary",
  "keyPoints": ["important", "personal", "details"],
  "actionItems": ["ways", "to", "respond", "or", "follow", "up"],
  "urgency": "critical|high|medium|low",
  "requiresResponse": true/false,
  "suggestedResponse": "thoughtful response suggestion",
  "relationshipNote": "context about relationship or emotional tone",
  "category": "personal"
}

Focus on:
- Emotional context and relationship dynamics
- Important life updates or events
- Opportunities to strengthen relationships
- Time-sensitive personal matters`;
  }

  /**
   * Summarize a single email with advanced AI analysis
   */
  async summarizeEmail(email) {
    try {
      if (!process.env.OPENAI_API_KEY) {
        console.log('⚠️ No OpenAI API key, using fallback summarization');
        return this.fallbackSummarization(email);
      }

      return await this.aiSummarization(email);
    } catch (error) {
      console.error('❌ Error summarizing email:', error);
      return this.fallbackSummarization(email);
    }
  }

  /**
   * Summarize multiple emails in batch (with rate limiting)
   */
  async summarizeBatch(emails) {
    const results = [];
    
    // Process emails in chunks to manage API rate limits
    const chunkSize = 3;
    for (let i = 0; i < emails.length; i += chunkSize) {
      const chunk = emails.slice(i, i + chunkSize);
      
      console.log(`📧 Processing email batch ${Math.floor(i/chunkSize) + 1}/${Math.ceil(emails.length/chunkSize)}`);
      
      const chunkPromises = chunk.map(async (email) => {
        try {
          const summary = await this.summarizeEmail(email);
          return {
            id: email.id,
            from: email.from,
            subject: email.subject,
            timestamp: email.date.toISOString(),
            ...summary
          };
        } catch (error) {
          console.error(`❌ Error summarizing email ${email.id}:`, error);
          return {
            id: email.id,
            from: email.from,
            subject: email.subject,
            timestamp: email.date.toISOString(),
            ...this.fallbackSummarization(email)
          };
        }
      });

      const chunkResults = await Promise.all(chunkPromises);
      results.push(...chunkResults);

      // Add delay between chunks to respect rate limits
      if (i + chunkSize < emails.length) {
        await new Promise(resolve => setTimeout(resolve, 1500));
      }
    }

    return results;
  }

  /**
   * AI-powered email summarization using OpenAI
   */
  async aiSummarization(email) {
    try {
      // Determine if this is a personal email based on patterns
      const isPersonal = this.isPersonalEmail(email);
      const prompt = isPersonal ? this.personalEmailPrompt : this.summaryPrompt;

      // Prepare the prompt with email data
      const formattedPrompt = prompt
        .replace('{from}', email.from)
        .replace('{subject}', email.subject)
        .replace('{body}', email.body.substring(0, 2000)); // Limit body length

      const response = await this.openai.chat.completions.create({
        model: 'gpt-3.5-turbo',
        messages: [{ role: 'user', content: formattedPrompt }],
        max_tokens: 400,
        temperature: 0.2,
      });

      const content = response.choices[0].message.content;
      
      // Try to parse JSON response
      try {
        const parsed = JSON.parse(content);
        return this.validateAndCleanSummary(parsed);
      } catch (parseError) {
        console.error('❌ Failed to parse AI response as JSON:', parseError);
        return this.fallbackSummarization(email);
      }

    } catch (error) {
      console.error('❌ OpenAI API error:', error);
      return this.fallbackSummarization(email);
    }
  }

  /**
   * Determine if an email is personal based on patterns
   */
  isPersonalEmail(email) {
    const personalPatterns = [
      // Personal email providers
      /@gmail\.com/i,
      /@yahoo\.com/i,
      /@hotmail\.com/i,
      /@outlook\.com/i,
      /@icloud\.com/i,
      
      // Personal language patterns in subject
      /birthday/i,
      /congratulations/i,
      /wedding/i,
      /baby/i,
      /family/i,
      /vacation/i,
      /thanks/i,
      /thank you/i,
    ];

    const from = email.from.toLowerCase();
    const subject = email.subject.toLowerCase();
    
    return personalPatterns.some(pattern => 
      pattern.test(from) || pattern.test(subject)
    );
  }

  /**
   * Validate and clean AI summary response
   */
  validateAndCleanSummary(summary) {
    const cleaned = {
      summary: summary.summary || 'Email summary not available',
      keyPoints: Array.isArray(summary.keyPoints) ? summary.keyPoints.slice(0, 5) : ['No key points identified'],
      actionItems: Array.isArray(summary.actionItems) ? summary.actionItems.slice(0, 3) : [],
      urgency: ['critical', 'high', 'medium', 'low'].includes(summary.urgency) ? summary.urgency : 'medium',
      requiresResponse: typeof summary.requiresResponse === 'boolean' ? summary.requiresResponse : false,
      suggestedResponse: summary.suggestedResponse || null,
      deadline: summary.deadline || null,
      category: summary.category || 'other',
      relationshipNote: summary.relationshipNote || null
    };

    return cleaned;
  }

  /**
   * Fallback summarization when AI is not available
   */
  fallbackSummarization(email) {
    const bodyWords = email.body.split(' ').slice(0, 20).join(' ');
    const hasUrgentKeywords = /urgent|asap|immediately|deadline|important/i.test(email.subject + ' ' + email.body);
    const hasQuestionMarks = email.body.includes('?');

    return {
      summary: `Email from ${this.extractName(email.from)}: ${email.subject}`,
      keyPoints: [
        `Subject: ${email.subject}`,
        `From: ${this.extractName(email.from)}`,
        bodyWords ? `Preview: ${bodyWords}...` : 'No content preview'
      ],
      actionItems: hasQuestionMarks ? ['Review and respond to questions'] : [],
      urgency: hasUrgentKeywords ? 'high' : 'medium',
      requiresResponse: hasQuestionMarks,
      suggestedResponse: hasQuestionMarks ? 'Thank you for your email. I will review and get back to you.' : null,
      deadline: null,
      category: this.isPersonalEmail(email) ? 'personal' : 'work'
    };
  }

  /**
   * Extract name from email address
   */
  extractName(emailAddress) {
    // Try to extract name from "Name <email>" format
    const nameMatch = emailAddress.match(/^([^<]+)</);
    if (nameMatch) {
      return nameMatch[1].trim().replace(/"/g, '');
    }
    
    // Fall back to email username
    return emailAddress.split('@')[0];
  }

  /**
   * Generate alert message for important emails
   */
  generateAlert(email, summary) {
    const name = this.extractName(email.from);
    
    if (summary.urgency === 'critical') {
      return `🚨 CRITICAL: ${name} - ${summary.summary}`;
    } else if (summary.urgency === 'high') {
      return `⚡ HIGH PRIORITY: ${name} - ${summary.summary}`;
    } else if (summary.category === 'personal') {
      return `💝 Personal: ${name} - ${summary.summary}`;
    } else {
      return `📧 ${name}: ${summary.summary}`;
    }
  }

  /**
   * Get service status
   */
  getStatus() {
    return {
      openaiAvailable: !!process.env.OPENAI_API_KEY,
      serviceReady: true,
      lastProcessed: new Date().toISOString()
    };
  }
}

// Export singleton instance
module.exports = new EmailSummarizer();