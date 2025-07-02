const OpenAI = require('openai');
const emailService = require('./emailService');

/**
 * EmailAgent - Conversational AI agent for email composition and management
 * Follows the same pattern as the calendar AI agent
 */
class EmailAgent {
  constructor() {
    this.openai = new OpenAI({
      apiKey: process.env.OPENAI_API_KEY,
    });

    // Define conversation context and prompts
    this.systemPrompt = `You are an AI email assistant. You help users compose, reply to, and manage emails through natural conversation.

Your capabilities include:
- Drafting new emails from natural language instructions
- Generating replies to existing emails
- Suggesting email improvements and tone adjustments
- Analyzing recipient context and relationship
- Recommending email timing and urgency levels

You should be helpful, professional, and ask clarifying questions when needed.

IMPORTANT: Always respond in the specified JSON format for consistency.`;

    this.conversationPrompt = `You are an AI email assistant. Parse the user's message and determine what email action they want to take.

Context:
- Current time: {currentTime}
- Recent email activity: {emailContext}
- User's typical communication style: {userStyle}

User message: "{message}"

Analyze the message and respond in JSON format:
{
  "intent": "compose_new|reply_to_email|search_emails|analyze_email|improve_draft|clarification_needed|general_chat",
  "confidence": 0.0-1.0,
  "response": "Your conversational response to the user",
  "email_details": {
    "recipient": "email@example.com or name",
    "subject": "Email subject",
    "body": "Email body content",
    "tone": "professional|casual|friendly|urgent|formal",
    "priority": "high|medium|low"
  },
  "context_analysis": {
    "recipient_relationship": "colleague|client|friend|family|unknown",
    "suggested_timing": "immediate|within_hour|end_of_day|tomorrow",
    "estimated_response_time": "minutes|hours|days"
  },
  "clarifications_needed": ["List any missing information needed"],
  "action": "draft|confirm|search|analyze|clarify|none"
}`;
  }

  /**
   * Process natural language email requests
   * Main conversation endpoint - similar to calendar agent
   */
  async processEmailRequest(message, conversationHistory = []) {
    try {
      if (!process.env.OPENAI_API_KEY) {
        return this.fallbackResponse('OpenAI API key not configured');
      }

      // Gather context for better AI responses
      const context = await this.gatherEmailContext();
      
      // Format the prompt with current context
      const formattedPrompt = this.conversationPrompt
        .replace('{currentTime}', new Date().toLocaleString())
        .replace('{emailContext}', context.recentActivity)
        .replace('{userStyle}', context.userStyle)
        .replace('{message}', message);

      // Build conversation history for OpenAI
      const messages = [
        { role: 'system', content: this.systemPrompt },
        ...conversationHistory.map(msg => ({
          role: msg.role,
          content: msg.content
        })),
        { role: 'user', content: formattedPrompt }
      ];

      const response = await this.openai.chat.completions.create({
        model: 'gpt-4',
        messages: messages,
        max_tokens: 800,
        temperature: 0.7,
      });

      const content = response.choices[0].message.content;
      
      try {
        const parsed = JSON.parse(content);
        return this.validateAndEnhanceResponse(parsed, message);
      } catch (parseError) {
        console.error('❌ Failed to parse AI response as JSON:', parseError);
        return this.fallbackResponse('I had trouble understanding that request. Could you please rephrase?');
      }

    } catch (error) {
      console.error('❌ EmailAgent processing error:', error);
      return this.fallbackResponse('I encountered an error processing your request. Please try again.');
    }
  }

  /**
   * Generate email draft from instructions
   */
  async generateDraft(instructions, context = {}) {
    try {
      const draftPrompt = `Draft an email based on these instructions:

Instructions: ${instructions}

Context:
- Recipient: ${context.recipient || 'Not specified'}
- Relationship: ${context.relationship || 'Professional'}
- Tone: ${context.tone || 'Professional'}
- Purpose: ${context.purpose || 'General communication'}

Generate a professional email with:
1. Appropriate subject line
2. Proper greeting based on relationship
3. Clear, concise body
4. Professional closing

Format as JSON:
{
  "subject": "Email subject line",
  "body": "Full email body with proper formatting",
  "tone_analysis": "Analysis of the tone used",
  "suggestions": ["Optional improvements or alternatives"]
}`;

      const response = await this.openai.chat.completions.create({
        model: 'gpt-4',
        messages: [
          { role: 'system', content: 'You are an expert email writer. Create professional, clear, and effective emails.' },
          { role: 'user', content: draftPrompt }
        ],
        max_tokens: 600,
        temperature: 0.7,
      });

      const result = JSON.parse(response.choices[0].message.content);
      return {
        ...result,
        created_at: new Date().toISOString(),
        context: context
      };

    } catch (error) {
      console.error('❌ Error generating email draft:', error);
      return {
        subject: 'Email Draft',
        body: 'I encountered an error generating the email draft. Please try rephrasing your request.',
        tone_analysis: 'Error in generation',
        suggestions: ['Please try again with more specific instructions']
      };
    }
  }

  /**
   * Generate reply to existing email
   */
  async generateReply(originalEmail, replyInstructions) {
    try {
      const replyPrompt = `Generate a reply to this email:

Original Email:
From: ${originalEmail.from}
Subject: ${originalEmail.subject}
Body: ${originalEmail.body}

Reply Instructions: ${replyInstructions}

Generate an appropriate reply with:
1. Proper subject line (Re: or relevant)
2. Reference to original message when appropriate
3. Clear response to key points
4. Professional tone matching the original

Format as JSON:
{
  "subject": "Reply subject line",
  "body": "Reply body content",
  "references_original": true/false,
  "tone": "professional|casual|friendly",
  "key_points_addressed": ["Points addressed from original email"]
}`;

      const response = await this.openai.chat.completions.create({
        model: 'gpt-4',
        messages: [
          { role: 'system', content: 'You are an expert at writing email replies that are contextually appropriate and professional.' },
          { role: 'user', content: replyPrompt }
        ],
        max_tokens: 500,
        temperature: 0.7,
      });

      return JSON.parse(response.choices[0].message.content);

    } catch (error) {
      console.error('❌ Error generating email reply:', error);
      return {
        subject: `Re: ${originalEmail.subject}`,
        body: 'Thank you for your email. I will review and get back to you shortly.',
        references_original: false,
        tone: 'professional',
        key_points_addressed: []
      };
    }
  }

  /**
   * Improve existing draft based on feedback
   */
  async improveDraft(draft, feedback) {
    try {
      const improvePrompt = `Improve this email draft based on the feedback:

Current Draft:
Subject: ${draft.subject}
Body: ${draft.body}

Feedback: ${feedback}

Provide an improved version addressing the feedback while maintaining professionalism.

Format as JSON:
{
  "improved_subject": "Updated subject line",
  "improved_body": "Updated email body",
  "changes_made": ["List of specific changes made"],
  "explanation": "Brief explanation of improvements"
}`;

      const response = await this.openai.chat.completions.create({
        model: 'gpt-4',
        messages: [
          { role: 'system', content: 'You are an expert email editor. Improve emails based on user feedback while maintaining clarity and professionalism.' },
          { role: 'user', content: improvePrompt }
        ],
        max_tokens: 600,
        temperature: 0.7,
      });

      return JSON.parse(response.choices[0].message.content);

    } catch (error) {
      console.error('❌ Error improving draft:', error);
      return {
        improved_subject: draft.subject,
        improved_body: draft.body,
        changes_made: ['Error occurred during improvement'],
        explanation: 'Unable to process improvement request'
      };
    }
  }

  /**
   * Gather email context for better AI responses
   */
  async gatherEmailContext() {
    try {
      // Get recent emails if service is authenticated
      let recentActivity = 'No recent email activity available';
      let userStyle = 'Professional communication style';

      if (emailService.isAuth()) {
        const recentEmails = await emailService.getRecentEmails(5);
        if (recentEmails.length > 0) {
          recentActivity = `Recent emails: ${recentEmails.map(email => 
            `From ${email.from}: ${email.subject}`
          ).join('; ')}`;
        }
      }

      return {
        recentActivity,
        userStyle,
        currentTime: new Date().toISOString(),
        authenticated: emailService.isAuth()
      };

    } catch (error) {
      console.error('❌ Error gathering email context:', error);
      return {
        recentActivity: 'Context unavailable',
        userStyle: 'Professional',
        currentTime: new Date().toISOString(),
        authenticated: false
      };
    }
  }

  /**
   * Validate and enhance AI response
   */
  validateAndEnhanceResponse(response, originalMessage) {
    // Ensure required fields exist
    const validated = {
      intent: response.intent || 'clarification_needed',
      confidence: Math.max(0, Math.min(1, response.confidence || 0.5)),
      response: response.response || 'I can help with that. Could you provide more details?',
      email_details: response.email_details || {},
      context_analysis: response.context_analysis || {},
      clarifications_needed: response.clarifications_needed || [],
      action: response.action || 'clarify',
      timestamp: new Date().toISOString(),
      original_message: originalMessage
    };

    return validated;
  }

  /**
   * Fallback response when AI is unavailable
   */
  fallbackResponse(message) {
    return {
      intent: 'general_chat',
      confidence: 0.0,
      response: message || 'I\'m currently unable to process email requests. Please try again later.',
      email_details: {},
      context_analysis: {},
      clarifications_needed: [],
      action: 'none',
      timestamp: new Date().toISOString(),
      fallback: true
    };
  }

  /**
   * Get service status
   */
  getStatus() {
    return {
      openaiAvailable: !!process.env.OPENAI_API_KEY,
      emailServiceAuthenticated: emailService.isAuth(),
      serviceReady: !!process.env.OPENAI_API_KEY && emailService.isAuth(),
      lastActivity: new Date().toISOString()
    };
  }
}

// Export singleton instance
module.exports = new EmailAgent();