/**
 * Conversation Analyzer Module
 *
 * Analyzes iMessage conversation history and generates context-aware message suggestions
 * using AI to understand relationship dynamics and communication patterns.
 */

const sqlite3 = require('sqlite3').verbose();
const path = require('path');
const os = require('os');

/**
 * Get conversation history with a contact from iMessage database
 */
async function getConversationHistory(phoneNumber, analysisType = 'recent', maxMessages = 50) {
  return new Promise((resolve, reject) => {
    const chatDbPath = path.join(os.homedir(), 'Library', 'Messages', 'chat.db');
    const db = new sqlite3.Database(chatDbPath, sqlite3.OPEN_READONLY, (err) => {
      if (err) {
        console.error('❌ Chat.db access error:', err.message);
        resolve({ messages: [], summary: 'Could not access message database' });
        return;
      }

      // Normalize phone number for matching
      const normalizedPhone = phoneNumber.replace(/\D/g, '');
      const last10Digits = normalizedPhone.slice(-10);

      // First, get overview of entire conversation history
      const overviewQuery = `
        SELECT
          COUNT(*) as total_messages,
          MIN(m.date) as first_message_date,
          MAX(m.date) as last_message_date,
          datetime(MIN(m.date)/1000000000 + 978307200, 'unixepoch', 'localtime') as first_formatted,
          datetime(MAX(m.date)/1000000000 + 978307200, 'unixepoch', 'localtime') as last_formatted,
          COUNT(CASE WHEN m.is_from_me = 1 THEN 1 END) as sent_count,
          COUNT(CASE WHEN m.is_from_me = 0 THEN 1 END) as received_count
        FROM message m
        JOIN chat_message_join cmj ON m.ROWID = cmj.message_id
        JOIN chat c ON cmj.chat_id = c.ROWID
        JOIN chat_handle_join chj ON c.ROWID = chj.chat_id
        JOIN handle h ON chj.handle_id = h.ROWID
        WHERE h.id LIKE '%${last10Digits}%'
          AND m.text IS NOT NULL AND m.text != ''
      `;

      db.get(overviewQuery, (err, overview) => {
        if (err) {
          console.error('❌ Overview query error:', err);
          resolve({ messages: [], summary: 'Error analyzing conversation history' });
          return;
        }

        if (!overview || overview.total_messages === 0) {
          resolve({
            messages: [],
            summary: 'No conversation history found',
            relationship: { total_messages: 0, years_known: 0 }
          });
          return;
        }

        // Calculate relationship timeline
        const firstDate = new Date(overview.first_message_date/1000000000 * 1000 + 978307200000);
        const lastDate = new Date(overview.last_message_date/1000000000 * 1000 + 978307200000);
        const daysSinceFirst = Math.floor((Date.now() - firstDate) / (1000 * 60 * 60 * 24));
        const daysSinceLast = Math.floor((Date.now() - lastDate) / (1000 * 60 * 60 * 24));
        const relationshipSpan = Math.floor((lastDate - firstDate) / (1000 * 60 * 60 * 24));

        // Get sample messages for analysis (simplified query for debugging)
        const messageQuery = `
          SELECT
            m.text,
            m.is_from_me,
            m.date,
            datetime(m.date/1000000000 + 978307200, 'unixepoch', 'localtime') as formatted_date
          FROM message m
          JOIN chat_message_join cmj ON m.ROWID = cmj.message_id
          JOIN chat c ON cmj.chat_id = c.ROWID
          JOIN chat_handle_join chj ON c.ROWID = chj.chat_id
          JOIN handle h ON chj.handle_id = h.ROWID
          WHERE h.id LIKE '%${last10Digits}%'
            AND m.text IS NOT NULL AND m.text != ''
          ORDER BY m.date DESC
          LIMIT ${maxMessages}
        `;

        db.all(messageQuery, (err, messages) => {
          if (err) {
            console.error('❌ Messages query error:', err);
            resolve({ messages: [], summary: 'Error retrieving messages' });
            return;
          }

          const relationshipData = {
            total_messages: overview.total_messages,
            years_known: Math.round(relationshipSpan / 365 * 10) / 10,
            days_since_last: daysSinceLast,
            conversation_balance: `${overview.sent_count} sent, ${overview.received_count} received`,
            first_contact: overview.first_formatted,
            last_contact: overview.last_formatted,
            analysis_type: daysSinceLast < 30 ? 'recent' : 'dormant_relationship'
          };

          resolve({
            messages: messages || [],
            relationship: relationshipData,
            summary: `Found ${overview.total_messages} messages spanning ${Math.round(relationshipSpan/365*10)/10} years. Last contact: ${daysSinceLast} days ago.`
          });

          db.close();
        });
      });
    });
  });
}

/**
 * Analyze conversation history and generate context-aware message suggestions
 */
async function analyzeConversationAndSuggestMessage(openai, phoneNumber, contactName, daysBack = 30, isBirthdayMessage = false) {
  try {
    console.log(`🧠 Analyzing conversation with ${contactName} (${phoneNumber})`);

    // Get conversation history with relationship context
    const conversationData = await getConversationHistory(phoneNumber, 'auto');

    if (!conversationData.messages || conversationData.messages.length === 0) {
      return {
        hasConversation: false,
        suggestedMessage: `Hey ${contactName.split(' ')[0] || 'there'}! It's been a while. How have you been?`,
        reasoning: 'No conversation history found',
        conversationSummary: conversationData.summary,
        suggestions: [
          `Hey ${contactName.split(' ')[0] || 'there'}! How are things going?`,
          `Hi! Just thinking about you. Hope you're doing well!`,
          `Hey! It's been too long. What's new with you?`
        ],
        relationship: conversationData.relationship
      };
    }

    const { messages, relationship } = conversationData;

    // Prepare conversation context for GPT (limit messages to prevent token overflow)
    const sampleMessages = messages.slice(0, 25); // Use most relevant 25 messages
    const conversationText = sampleMessages.map(msg => {
      const sender = msg.is_from_me ? 'You' : contactName.split(' ')[0] || 'Contact';
      return `${sender}: ${msg.text}`;
    }).join('\n');

    // Analyze conversation patterns with relationship context
    const sentCount = messages.filter(m => m.is_from_me).length;
    const receivedCount = messages.filter(m => !m.is_from_me).length;
    const lastMessage = messages[0]; // Most recent message (messages are ordered DESC)
    const daysSinceLastMessage = relationship.days_since_last;

    // Birthday message context is now passed as parameter

    // Create relationship-aware GPT prompt
    const isDormantRelationship = daysSinceLastMessage > 30;
    let relationshipContext;

    if (isBirthdayMessage) {
      relationshipContext = `This is a BIRTHDAY MESSAGE! ${contactName}'s birthday is today or very soon. Focus on birthday celebration and warm wishes.`;
    } else {
      relationshipContext = isDormantRelationship ?
        `This is a long-dormant relationship. You've known ${contactName} for ${relationship.years_known} years with ${relationship.total_messages} total messages, but last spoke ${daysSinceLastMessage} days ago.` :
        `This is an active/recent relationship. You last spoke ${daysSinceLastMessage} days ago.`;
    }

    const prompt = `You are helping reconnect with ${contactName}. ${relationshipContext}

RELATIONSHIP TIMELINE:
- Known each other: ${relationship.years_known} years
- Total messages exchanged: ${relationship.total_messages}
- First contact: ${relationship.first_contact}
- Last contact: ${relationship.last_contact} (${daysSinceLastMessage} days ago)
- Message balance: ${relationship.conversation_balance}
- Relationship type: ${relationship.analysis_type}

CONVERSATION SAMPLE:
${conversationText}

CONVERSATION ANALYSIS:
- Sample messages analyzed: ${sampleMessages.length} of ${relationship.total_messages} total
- Messages from you: ${sentCount}
- Messages from them: ${receivedCount}
- Last message was from: ${lastMessage.is_from_me ? 'you' : 'them'}

GUIDELINES FOR ${isBirthdayMessage ? 'BIRTHDAY MESSAGE' : (isDormantRelationship ? 'DORMANT RELATIONSHIP RECONNECTION' : 'RECENT CONVERSATION FOLLOW-UP')}:
${isBirthdayMessage ? `
- This is a BIRTHDAY celebration message!
- Be warm, celebratory, and joyful
- Use birthday-specific language (Happy Birthday, celebrate, special day, etc.)
- Reference your relationship history if appropriate
- Include birthday emojis and celebratory tone
- Offer to celebrate together if you're close
- Keep it heartfelt and genuine
- Make them feel special and remembered` : `
- Be natural and conversational, not robotic
- ${isDormantRelationship ? 'Acknowledge the time gap gracefully without being awkward' : 'Continue the recent conversation naturally'}
- Reference shared history and topics when appropriate
- Match the tone and style of your previous conversations
- ${isDormantRelationship ? 'Show genuine interest in reconnecting' : 'Build on recent topics'}
- Keep it concise but meaningful (1-2 sentences)
- Be authentic to your relationship history`}

Respond with JSON in this exact format:
{
  "suggestedMessage": "Your primary message suggestion",
  "reasoning": "Why this message fits your specific relationship history",
  "conversationSummary": "Summary of your relationship and recent conversation patterns",
  "suggestions": ["Alternative message 1", "Alternative message 2", "Alternative message 3"],
  "conversationTone": "description of your typical communication style",
  "topics": "main topics you historically discuss",
  "relationshipType": "${isDormantRelationship ? 'dormant_reconnection' : 'recent_followup'}"
}`;

    const response = await openai.chat.completions.create({
      model: 'gpt-4',
      messages: [{ role: 'user', content: prompt }],
      max_tokens: 500,
      temperature: 0.7,
    });

    const analysis = JSON.parse(response.choices[0].message.content);

    return {
      hasConversation: true,
      ...analysis,
      messageCount: relationship.total_messages,
      daysSinceLastMessage,
      conversationBalance: relationship.conversation_balance,
      relationship: relationship,
      conversationSummary: conversationData.summary
    };

  } catch (error) {
    console.error('❌ Error analyzing conversation:', error);

    // Fallback response
    return {
      hasConversation: false,
      suggestedMessage: `Hey ${contactName.split(' ')[0] || 'there'}! Hope you're doing well. What's new?`,
      reasoning: 'Error analyzing conversation - using safe fallback',
      conversationSummary: 'Unable to analyze conversation',
      suggestions: [
        `Hi ${contactName.split(' ')[0] || 'there'}! How are you?`,
        `Hey! Just checking in. Hope things are good!`,
        `Hi! Been thinking about you. How's everything?`
      ]
    };
  }
}

module.exports = {
  getConversationHistory,
  analyzeConversationAndSuggestMessage
};
