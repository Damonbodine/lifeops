#!/usr/bin/env node

const sqlite3 = require('sqlite3').verbose();
const path = require('path');
const os = require('os');

// Test script to explore message content in chat.db
async function testMessageContent() {
  const chatDbPath = path.join(os.homedir(), 'Library', 'Messages', 'chat.db');
  
  console.log('🔍 Testing message content access...');
  console.log('📁 Database path:', chatDbPath);
  
  return new Promise((resolve, reject) => {
    const db = new sqlite3.Database(chatDbPath, sqlite3.OPEN_READONLY, (err) => {
      if (err) {
        console.error('❌ Error accessing chat.db:', err.message);
        console.log('💡 Tip: Make sure Terminal has Full Disk Access permission');
        reject(err);
        return;
      }
      
      console.log('✅ Successfully opened chat.db');
      
      // Test 1: Check message table structure
      db.get("PRAGMA table_info(message)", (err, result) => {
        if (err) {
          console.error('❌ Error getting table info:', err);
          return;
        }
        console.log('📋 Message table accessible');
      });
      
      // Test 2: Count total messages
      db.get("SELECT COUNT(*) as total FROM message", (err, row) => {
        if (err) {
          console.error('❌ Error counting messages:', err);
          return;
        }
        console.log(`📊 Total messages in database: ${row.total}`);
      });
      
      // Test 3: Count messages with text content
      db.get(`
        SELECT 
          COUNT(*) as total_messages,
          COUNT(CASE WHEN text IS NOT NULL AND text != '' THEN 1 END) as messages_with_text,
          COUNT(CASE WHEN is_from_me = 1 THEN 1 END) as sent_messages,
          COUNT(CASE WHEN is_from_me = 0 THEN 1 END) as received_messages
        FROM message 
        WHERE date > (strftime('%s', 'now', '-7 days') - 978307200) * 1000000000
      `, (err, row) => {
        if (err) {
          console.error('❌ Error analyzing recent messages:', err);
          return;
        }
        
        console.log('\n📈 Last 7 days message analysis:');
        console.log(`   Total messages: ${row.total_messages}`);
        console.log(`   Messages with text: ${row.messages_with_text}`);
        console.log(`   Sent by you: ${row.sent_messages}`);
        console.log(`   Received: ${row.received_messages}`);
        console.log(`   Text coverage: ${Math.round((row.messages_with_text / row.total_messages) * 100)}%`);
      });
      
      // Test 4: Sample some actual message content (anonymized)
      db.all(`
        SELECT 
          CASE WHEN length(text) > 50 THEN substr(text, 1, 50) || '...' ELSE text END as sample_text,
          is_from_me,
          length(text) as text_length,
          datetime(date/1000000000 + 978307200, 'unixepoch', 'localtime') as formatted_date
        FROM message 
        WHERE text IS NOT NULL 
          AND text != '' 
          AND date > (strftime('%s', 'now', '-1 days') - 978307200) * 1000000000
        ORDER BY date DESC 
        LIMIT 5
      `, (err, rows) => {
        if (err) {
          console.error('❌ Error getting sample messages:', err);
        } else {
          console.log('\n💬 Sample recent messages (anonymized):');
          rows.forEach((row, index) => {
            const direction = row.is_from_me ? '→ SENT' : '← RECEIVED';
            console.log(`   ${index + 1}. ${direction} (${row.text_length} chars): "${row.sample_text}"`);
            console.log(`      Date: ${row.formatted_date}`);
          });
        }
        
        db.close();
        resolve(rows.length > 0);
      });
    });
  });
}

// Test conversation analysis for a specific contact
async function testConversationAnalysis(phoneNumber) {
  const chatDbPath = path.join(os.homedir(), 'Library', 'Messages', 'chat.db');
  
  console.log(`\n🔍 Testing conversation analysis for: ${phoneNumber}`);
  
  return new Promise((resolve, reject) => {
    const db = new sqlite3.Database(chatDbPath, sqlite3.OPEN_READONLY, (err) => {
      if (err) {
        reject(err);
        return;
      }
      
      // Get conversation history for specific contact
      const query = `
        SELECT 
          m.text,
          m.is_from_me,
          datetime(m.date/1000000000 + 978307200, 'unixepoch', 'localtime') as formatted_date,
          m.date
        FROM message m
        JOIN chat_message_join cmj ON m.ROWID = cmj.message_id
        JOIN chat c ON cmj.chat_id = c.ROWID
        JOIN chat_handle_join chj ON c.ROWID = chj.chat_id
        JOIN handle h ON chj.handle_id = h.ROWID
        WHERE h.id LIKE '%${phoneNumber.replace(/\D/g, '')}%'
          AND m.text IS NOT NULL 
          AND m.text != ''
          AND m.date > (strftime('%s', 'now', '-30 days') - 978307200) * 1000000000
        ORDER BY m.date DESC
        LIMIT 20
      `;
      
      db.all(query, (err, rows) => {
        if (err) {
          console.error('❌ Error getting conversation:', err);
          reject(err);
          return;
        }
        
        console.log(`📱 Found ${rows.length} recent messages in conversation`);
        
        if (rows.length > 0) {
          console.log('\n💬 Conversation sample:');
          rows.reverse().forEach((row, index) => {
            const direction = row.is_from_me ? 'You' : 'Them';
            const preview = row.text.length > 60 ? row.text.substring(0, 60) + '...' : row.text;
            console.log(`   ${direction}: "${preview}"`);
          });
          
          // Analyze conversation patterns
          const sentCount = rows.filter(r => r.is_from_me).length;
          const receivedCount = rows.filter(r => !r.is_from_me).length;
          const avgLength = rows.reduce((sum, r) => sum + r.text.length, 0) / rows.length;
          
          console.log('\n📊 Conversation Analysis:');
          console.log(`   Your messages: ${sentCount}`);
          console.log(`   Their messages: ${receivedCount}`);
          console.log(`   Avg message length: ${Math.round(avgLength)} characters`);
          console.log(`   Conversation balance: ${Math.round((sentCount / rows.length) * 100)}% you, ${Math.round((receivedCount / rows.length) * 100)}% them`);
        }
        
        db.close();
        resolve(rows);
      });
    });
  });
}

// Run tests
async function runTests() {
  try {
    console.log('🧪 Starting chat.db message content tests...\n');
    
    const hasMessageContent = await testMessageContent();
    
    if (hasMessageContent) {
      console.log('\n✅ Message content access confirmed!');
      
      // Test with a known phone number (adjust as needed)
      const testNumber = '6462566056'; // Matthew Sandoval's number (last 10 digits)
      await testConversationAnalysis(testNumber);
      
      console.log('\n🎯 Ready to build GPT conversation analysis!');
    } else {
      console.log('\n❌ No message content found or accessible');
    }
    
  } catch (error) {
    console.error('\n❌ Test failed:', error.message);
  }
}

// Run the tests
runTests();