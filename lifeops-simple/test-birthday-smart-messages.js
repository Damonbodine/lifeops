#!/usr/bin/env node

const fetch = require('node-fetch').default || require('node-fetch');

async function testBirthdaySmartMessages() {
  try {
    console.log('🧪 Testing Birthday Smart Messages Implementation\n');
    
    // Test 1: Regular message (should use conversation context)
    console.log('📞 Test 1: Regular Smart Message for Eric Chia...');
    const regularResponse = await fetch('http://localhost:3000/api/smart-message', {
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
    
    const regularResult = await regularResponse.json();
    
    console.log('✅ Regular Message Results:');
    console.log(`   HasConversation: ${regularResult.analysis.hasConversation}`);
    console.log(`   RelationshipType: ${regularResult.analysis.relationshipType}`);
    console.log(`   Suggestion: "${regularResult.analysis.suggestedMessage}"`);
    console.log(`   Topics: ${regularResult.analysis.topics}`);
    
    // Test 2: Birthday message (should use birthday-specific prompts)
    console.log('\n🎂 Test 2: Birthday Smart Message for Eric Chia...');
    const birthdayResponse = await fetch('http://localhost:3000/api/smart-message', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        phoneNumber: '3473577328',
        contactName: 'Eric Chia',
        daysBack: 30,
        birthdayContact: true,
        specialOccasion: 'birthday'
      })
    });
    
    const birthdayResult = await birthdayResponse.json();
    
    console.log('✅ Birthday Message Results:');
    console.log(`   HasConversation: ${birthdayResult.analysis.hasConversation}`);
    console.log(`   RelationshipType: ${birthdayResult.analysis.relationshipType}`);
    console.log(`   Suggestion: "${birthdayResult.analysis.suggestedMessage}"`);
    console.log(`   Topics: ${birthdayResult.analysis.topics}`);
    
    // Test 3: Compare the differences
    console.log('\n🔍 Comparison Analysis:');
    
    const regularHasBirthday = regularResult.analysis.suggestedMessage.toLowerCase().includes('birthday') || 
                              regularResult.analysis.suggestedMessage.toLowerCase().includes('happy');
                              
    const birthdayHasBirthday = birthdayResult.analysis.suggestedMessage.toLowerCase().includes('birthday') || 
                               birthdayResult.analysis.suggestedMessage.toLowerCase().includes('happy');
    
    console.log(`   Regular message mentions birthday: ${regularHasBirthday}`);
    console.log(`   Birthday message mentions birthday: ${birthdayHasBirthday}`);
    
    if (birthdayHasBirthday && !regularHasBirthday) {
      console.log('✅ SUCCESS: Birthday detection is working correctly!');
      console.log('   Regular messages use conversation context');
      console.log('   Birthday messages use celebratory language');
    } else if (birthdayHasBirthday && regularHasBirthday) {
      console.log('⚠️  Both messages mention birthday - may need prompt tuning');
    } else {
      console.log('❌ Birthday detection may not be working as expected');
    }
    
    console.log('\n🎉 Birthday Smart Message test completed!');
    
  } catch (error) {
    console.error('❌ Test failed:', error.message);
  }
}

testBirthdaySmartMessages();