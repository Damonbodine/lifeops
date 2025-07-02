#!/usr/bin/env node

// Quick test to isolate the conversation history issue
const sqlite3 = require('sqlite3').verbose();
const path = require('path');
const os = require('os');

async function testConversationHistory(phoneNumber, analysisType = 'recent', maxMessages = 50) {
  console.log(`🔍 Testing getConversationHistory for: ${phoneNumber}`);
  
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
      
      console.log(`📱 Normalized phone: ${normalizedPhone} -> last 10: ${last10Digits}`);
      
      // Test the overview query first
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

      console.log(`🔍 Running overview query...`);
      
      db.get(overviewQuery, (err, overview) => {
        if (err) {
          console.error('❌ Overview query error:', err);
          resolve({ messages: [], summary: 'Error analyzing conversation history' });
          return;
        }

        console.log('📊 Overview result:', overview);
        
        if (!overview || overview.total_messages === 0) {
          console.log('❌ No messages found');
          resolve({ 
            messages: [], 
            summary: 'No conversation history found',
            relationship: { total_messages: 0, years_known: 0 }
          });
          return;
        }

        console.log(`✅ Found ${overview.total_messages} messages!`);
        
        // Test a simple message query
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
          LIMIT 5
        `;
        
        console.log(`📱 Getting sample messages...`);
        
        db.all(messageQuery, (err, messages) => {
          if (err) {
            console.error('❌ Messages query error:', err);
            resolve({ messages: [], summary: 'Error retrieving messages' });
            return;
          }

          console.log(`✅ Retrieved ${messages.length} sample messages`);
          messages.forEach((msg, i) => {
            const sender = msg.is_from_me ? 'You' : 'Them';
            console.log(`   ${i+1}. ${sender}: "${msg.text.substring(0, 50)}..."`);
          });

          resolve({
            messages: messages || [],
            relationship: { total_messages: overview.total_messages },
            summary: `Found ${overview.total_messages} messages`
          });

          db.close();
        });
      });
    });
  });
}

// Test with Eric Chia
testConversationHistory('3473577328').then(result => {
  console.log('\n🎯 Final result:');
  console.log(`   Messages: ${result.messages.length}`);
  console.log(`   Summary: ${result.summary}`);
  console.log(`   Total messages: ${result.relationship?.total_messages || 0}`);
});