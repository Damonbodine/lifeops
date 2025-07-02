#!/usr/bin/env node

// Test the analysis function directly
const fetch = require('node-fetch').default || require('node-fetch');

async function debugAnalysis() {
  try {
    console.log('🧪 Testing smart message analysis directly...\n');
    
    // Test 1: Call API directly and capture full response
    console.log('📞 Testing API call with detailed logging...');
    const response = await fetch('http://localhost:3000/api/smart-message', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        phoneNumber: '3473577328',
        contactName: 'Eric Chia',
        daysBack: 30
      })
    });
    
    const result = await response.json();
    
    console.log('✅ API Response received:');
    console.log('   Success:', result.success);
    console.log('   HasConversation:', result.analysis?.hasConversation);
    console.log('   Reasoning:', result.analysis?.reasoning);
    console.log('   ConversationSummary:', result.analysis?.conversationSummary);
    console.log('   Relationship total messages:', result.analysis?.relationship?.total_messages);
    
    if (result.analysis?.relationship) {
      console.log('\n🔍 Relationship data found:');
      console.log('   Total messages:', result.analysis.relationship.total_messages);
      console.log('   Years known:', result.analysis.relationship.years_known);
      console.log('   Days since last:', result.analysis.relationship.days_since_last);
    }
    
    // Test 2: Compare with our direct conversation test
    console.log('\n🔄 Comparing with direct conversation lookup...');
    console.log('   Direct test found: 399 messages');
    console.log('   API analysis found:', result.analysis?.relationship?.total_messages || 0, 'messages');
    
    if (result.analysis?.relationship?.total_messages !== 399) {
      console.log('❌ MISMATCH DETECTED! Analysis function is not getting the conversation data.');
    } else {
      console.log('✅ Conversation data is reaching the analysis function correctly.');
    }
    
  } catch (error) {
    console.error('❌ Debug failed:', error.message);
  }
}

debugAnalysis();