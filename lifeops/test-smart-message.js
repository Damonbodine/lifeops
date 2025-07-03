#!/usr/bin/env node

// Use native fetch if available, otherwise require node-fetch
let fetch;
try {
  fetch = globalThis.fetch || require('node-fetch');
} catch (e) {
  console.log('⚠️ node-fetch not available, using curl instead');
}

async function testSmartMessage() {
  try {
    console.log('🧪 Testing Smart Message API...');
    console.log('📍 Endpoint: http://localhost:3000/api/smart-message');
    
    const testData = {
      phoneNumber: '6462566056',
      contactName: 'Matthew Sandoval',
      daysBack: 30
    };
    
    console.log('📤 Sending request with data:', testData);
    
    const response = await fetch('http://localhost:3000/api/smart-message', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(testData)
    });
    
    console.log('📥 Response status:', response.status);
    console.log('📥 Response headers:', response.headers.raw());
    
    const result = await response.text();
    console.log('📥 Raw response:', result);
    
    try {
      const jsonResult = JSON.parse(result);
      console.log('✅ Parsed JSON result:', JSON.stringify(jsonResult, null, 2));
      
      if (jsonResult.success && jsonResult.analysis) {
        console.log('\n🎯 Smart Message Analysis:');
        console.log(`   Messages found: ${jsonResult.analysis.messageCount}`);
        console.log(`   Topics: ${jsonResult.analysis.topics}`);
        console.log(`   Suggestions: ${jsonResult.analysis.suggestions.length}`);
        console.log('\n💬 Message suggestions:');
        jsonResult.analysis.suggestions.forEach((suggestion, index) => {
          console.log(`   ${index + 1}. "${suggestion}"`);
        });
      }
    } catch (parseError) {
      console.error('❌ Failed to parse JSON response:', parseError.message);
    }
    
  } catch (error) {
    console.error('❌ Test failed:', error.message);
    console.error('   Make sure the server is running on http://localhost:3000');
  }
}

testSmartMessage();