const OpenAI = require('openai');
const emailService = require('./emailService');

/**
 * Email content analysis and AI-powered features
 * Handles email summarization, conversation analysis, and reconnection email generation
 */
class EmailContentAnalyzer {
  constructor() {
    this.openai = new OpenAI({
      apiKey: process.env.OPENAI_API_KEY,
    });
  }

  /**
   * Extract email address from a string like "Name <email@domain.com>"
   */
  extractEmailAddress(emailString) {
    if (!emailString) return null;
    const match = emailString.match(/<([^>]+)>/) || emailString.match(/([^\s<>]+@[^\s<>]+)/);
    return match ? match[1] : emailString.trim();
  }

  /**
   * Extract display name from email string
   */
  extractDisplayName(fromField) {
    if (!fromField) return null;
    const match = fromField.match(/^([^<]+)</);
    return match ? match[1].trim().replace(/"/g, '') : null;
  }

  /**
   * Summarize email content for medium-tier storage
   */
  async summarizeEmail(email) {
    try {
      if (!email.body || email.body.length < 100) {
        return email.body || email.subject;
      }

      const prompt = `Summarize this email in 1-2 sentences, focusing on key topics and purpose:

Subject: ${email.subject}
Content: ${email.body.substring(0, 1000)}

Summary:`;

      const response = await this.openai.chat.completions.create({
        model: 'gpt-3.5-turbo',
        messages: [{ role: 'user', content: prompt }],
        max_tokens: 100,
        temperature: 0.3,
      });

      return response.choices[0].message.content.trim();
    } catch (error) {
      console.error('❌ Error summarizing email:', error);
      return email.subject || 'Email content summary unavailable';
    }
  }

  /**
   * Get conversation history with a specific contact for AI analysis
   * Optimized for speed - only fetches recent emails
   */
  async getConversationHistory(emailAddress, limit = 5) {
    try {
      // Search for emails TO or FROM this contact (recent only for speed)
      const query = `from:${emailAddress} OR to:${emailAddress}`;

      const emails = await emailService.getEmails({
        maxResults: limit, // Reduced from 10 to 5 for speed
        query: query
      });

      // Sort by date (newest first)
      return emails.sort((a, b) => new Date(b.date) - new Date(a.date));
    } catch (error) {
      console.error('❌ Error fetching conversation history:', error);
      return [];
    }
  }

  /**
   * Generate AI-powered reconnection email suggestion
   */
  async generateReconnectionEmail(emailAddress, relationship, userEmail) {
    try {
      // Get fuller conversation history for better context
      const conversationHistory = await this.getConversationHistory(emailAddress, 8);

      if (!relationship) {
        throw new Error('Relationship not found in database');
      }

      const daysSinceLastContact = Math.round(relationship.days_since_last_contact || 0);

      // Build detailed conversation analysis
      const conversationAnalysis = conversationHistory.map((email, i) => {
        const isFromUser = email.from === userEmail;
        const direction = isFromUser ? 'You wrote' : 'They wrote';
        const snippet = email.body ? email.body.substring(0, 150).replace(/\n/g, ' ') : 'No content';
        return `${direction}: "${email.subject}" (${new Date(email.date).toLocaleDateString()}) - ${snippet}...`;
      }).join('\n');

      const lastEmail = conversationHistory[0];
      const relationshipContext = conversationHistory.length > 0
        ? `You had ${conversationHistory.length} email exchanges. Here's the conversation flow:\n${conversationAnalysis}`
        : 'No recent email history found.';

      const prompt = `You're helping me reconnect with ${relationship.display_name || emailAddress} after ${daysSinceLastContact} days of no contact.

RELATIONSHIP CONTEXT:
- Contact: ${relationship.display_name || emailAddress} (${emailAddress})
- Historical emails sent: ${relationship.total_emails_sent || 0}
- Days since last contact: ${daysSinceLastContact}

CONVERSATION HISTORY:
${relationshipContext}

TASK: Write a personalized reconnection email that:
1. References specific details from our past conversations (be specific!)
2. Feels natural and authentic, not generic
3. Acknowledges the time gap without being awkward
4. Has a genuine reason for reaching out (based on past context)
5. Suggests a concrete next step

Make it feel like I actually know this person and am referencing our real relationship. Use details from the conversation history to make it personal.

FORMAT:
Subject: [write a specific, engaging subject line]

[Write the email body - 2-3 short paragraphs, conversational tone]`;

      const response = await this.openai.chat.completions.create({
        model: 'gpt-4o-mini', // Much better quality than 3.5-turbo, still fast
        messages: [{ role: 'user', content: prompt }],
        max_tokens: 400, // Increased for better quality
        temperature: 0.8, // Slightly more creative
      });

      const aiResponse = response.choices[0].message.content.trim();

      // Parse subject and body from AI response
      const lines = aiResponse.split('\n');
      const subjectIndex = lines.findIndex(line => line.toLowerCase().includes('subject'));
      const bodyIndex = lines.findIndex(line => line.toLowerCase().includes('email body') || line.toLowerCase().includes('body'));

      let subject = 'Catching up';
      let body = aiResponse;

      if (subjectIndex >= 0 && bodyIndex > subjectIndex) {
        subject = lines[subjectIndex + 1]?.trim() || subject;
        body = lines.slice(bodyIndex + 1).join('\n').trim() || body;
      }

      return {
        emailAddress,
        contactName: relationship.display_name || emailAddress,
        subject: subject,
        body: body,
        context: {
          daysSinceLastContact,
          totalEmailsSent: relationship.total_emails_sent || 0,
          lastSubject: lastEmail?.subject || 'No recent emails',
          conversationSample: conversationHistory.slice(0, 2).map(e => ({
            from: e.from === userEmail ? 'You' : e.from,
            subject: e.subject,
            date: new Date(e.date).toLocaleDateString()
          }))
        }
      };

    } catch (error) {
      console.error('❌ Error generating reconnection email:', error);
      throw error;
    }
  }
}

module.exports = EmailContentAnalyzer;
