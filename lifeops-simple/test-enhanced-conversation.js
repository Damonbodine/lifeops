#!/usr/bin/env node

const sqlite3 = require('sqlite3').verbose();
const path = require('path');
const os = require('os');

async function testEnhancedConversation(phoneNumber) {
  console.log(`🧪 Testing enhanced conversation analysis for: ${phoneNumber}`);
  
  const chatDbPath = path.join(os.homedir(), 'Library', 'Messages', 'chat.db');
  const normalizedPhone = phoneNumber.replace(/\D/g, '');
  const last10Digits = normalizedPhone.slice(-10);
  
  console.log(`📱 Normalized to last10: ${last10Digits}`);
  
  return new Promise((resolve, reject) => {
    const db = new sqlite3.Database(chatDbPath, sqlite3.OPEN_READONLY, (err) => {
      if (err) {
        console.error('❌ Chat.db access error:', err.message);
        resolve();
        return;
      }

      // First test: Check if we can find any messages for this contact
      const findContactQuery = `
        SELECT DISTINCT h.id, COUNT(*) as message_count
        FROM handle h
        JOIN chat_handle_join chj ON h.ROWID = chj.handle_id
        JOIN chat c ON chj.chat_id = c.ROWID
        JOIN chat_message_join cmj ON c.ROWID = cmj.chat_id
        JOIN message m ON cmj.message_id = m.ROWID
        WHERE h.id LIKE '%${last10Digits}%'
          AND m.text IS NOT NULL AND m.text != ''
        GROUP BY h.id
      `;
      
      console.log('\n🔍 Searching for contact handles...');
      db.all(findContactQuery, (err, handles) => {
        if (err) {
          console.error('❌ Handle search error:', err);
          db.close();
          resolve();
          return;
        }
        
        console.log(`📞 Found ${handles.length} matching handles:`);
        handles.forEach(handle => {
          console.log(`   ${handle.id} - ${handle.message_count} messages`);
        });
        
        if (handles.length === 0) {
          console.log('❌ No handles found for this phone number');
          console.log(`   Searching for: %${last10Digits}%`);
          
          // Let's see what handles exist
          db.all("SELECT id FROM handle WHERE id LIKE '%${last10Digits.slice(-4)}%' LIMIT 5", (err, sampleHandles) => {
            if (!err && sampleHandles.length > 0) {
              console.log('\n📋 Sample handles with similar numbers:');
              sampleHandles.forEach(h => console.log(`   ${h.id}`));
            }
            db.close();
            resolve();
          });
          return;
        }
        
        // Now test the enhanced overview query
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
        
        console.log('\n📊 Getting conversation overview...');
        db.get(overviewQuery, (err, overview) => {
          if (err) {
            console.error('❌ Overview query error:', err);
            db.close();
            resolve();
            return;
          }
          
          if (!overview || overview.total_messages === 0) {
            console.log('❌ No messages found in overview query');
            db.close();
            resolve();
            return;
          }
          
          console.log('✅ Conversation Overview:');
          console.log(`   Total messages: ${overview.total_messages}`);
          console.log(`   First message: ${overview.first_formatted}`);
          console.log(`   Last message: ${overview.last_formatted}`);
          console.log(`   Sent: ${overview.sent_count}, Received: ${overview.received_count}`);
          
          // Calculate timeline
          const firstDate = new Date(overview.first_message_date/1000000000 * 1000 + 978307200000);
          const lastDate = new Date(overview.last_message_date/1000000000 * 1000 + 978307200000);
          const daysSinceLast = Math.floor((Date.now() - lastDate) / (1000 * 60 * 60 * 24));
          const relationshipSpan = Math.floor((lastDate - firstDate) / (1000 * 60 * 60 * 24));
          
          console.log(`   Days since last contact: ${daysSinceLast}`);
          console.log(`   Relationship span: ${Math.round(relationshipSpan/365*10)/10} years`);
          
          // Test getting sample messages
          const messagesQuery = `
            SELECT 
              m.text,
              m.is_from_me,
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
          
          console.log('\n💬 Sample recent messages:');
          db.all(messagesQuery, (err, messages) => {
            if (err) {
              console.error('❌ Messages query error:', err);
            } else {
              messages.forEach((msg, index) => {
                const sender = msg.is_from_me ? 'You' : 'Them';
                const preview = msg.text.length > 50 ? msg.text.substring(0, 50) + '...' : msg.text;
                console.log(`   ${index + 1}. ${sender} (${msg.formatted_date}): "${preview}"`);
              });
            }
            
            db.close();
            resolve();
          });
        });
      });
    });
  });
}

// Test with different phone number formats
async function runTests() {
  console.log('🧪 Testing Enhanced Conversation Analysis\n');
  
  const testNumbers = [
    '+13473577328',  // Eric Chia with country code
    '3473577328',    // Eric Chia without country code  
    '6462566056',    // Matthew Sandoval
    '+12013708465'   // Another contact from the list
  ];
  
  for (const number of testNumbers) {
    await testEnhancedConversation(number);
    console.log('\n' + '='.repeat(60) + '\n');
  }
}

runTests();