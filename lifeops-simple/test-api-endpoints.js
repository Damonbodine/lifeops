require('dotenv').config();

/**
 * TEST CHECKPOINT 3: API Endpoints Integration Test
 * 
 * This script tests:
 * 1. New email API endpoints
 * 2. Authentication status
 * 3. Email fetching with different parameters
 * 4. Error handling
 */

async function testApiEndpoints() {
  console.log('🧪 TEST CHECKPOINT 3: API Endpoints Integration');
  console.log('='.repeat(60));

  const baseUrl = 'http://localhost:3000';

  try {
    // Test 1: Health check
    console.log('\n🏥 1. Health Check:');
    const healthResponse = await fetch(`${baseUrl}/api/health`);
    const healthData = await healthResponse.json();
    console.log(`Status: ${healthData.status}`);
    console.log(`OpenAI: ${healthData.openai ? '✅' : '❌'}`);
    console.log(`Gmail: ${healthData.gmail ? '✅' : '❌'}`);

    // Test 2: Email service status
    console.log('\n📧 2. Email Service Status:');
    const statusResponse = await fetch(`${baseUrl}/api/email/status`);
    const statusData = await statusResponse.json();
    console.log(`Authenticated: ${statusData.email.authenticated ? '✅' : '❌'}`);
    console.log(`Has Refresh Token: ${statusData.email.hasRefreshToken ? '✅' : '❌'}`);
    console.log(`AI Available: ${statusData.ai.openaiAvailable ? '✅' : '❌'}`);
    console.log(`Service Ready: ${statusData.ready ? '✅' : '❌'}`);

    // Test 3: Email fetching - Recent emails
    console.log('\n📬 3. Recent Emails Test:');
    const recentResponse = await fetch(`${baseUrl}/api/emails?type=recent&maxResults=3`);
    const recentData = await recentResponse.json();
    
    if (recentData.error) {
      console.log(`❌ Error: ${recentData.error}`);
      console.log(`Message: ${recentData.message}`);
    } else {
      console.log(`✅ Fetched ${recentData.count} recent emails`);
      console.log(`Type: ${recentData.type}`);
      
      if (recentData.emails.length > 0) {
        const firstEmail = recentData.emails[0];
        console.log(`\nFirst email preview:`);
        console.log(`  Subject: ${firstEmail.subject}`);
        console.log(`  From: ${firstEmail.from}`);
        console.log(`  Summary: ${firstEmail.summary}`);
        console.log(`  Urgency: ${firstEmail.urgency}`);
        console.log(`  Category: ${firstEmail.category}`);
      }
    }

    // Test 4: Email fetching - Unread emails
    console.log('\n📮 4. Unread Emails Test:');
    const unreadResponse = await fetch(`${baseUrl}/api/emails?type=unread&maxResults=2`);
    const unreadData = await unreadResponse.json();
    
    if (unreadData.error) {
      console.log(`❌ Error: ${unreadData.error}`);
    } else {
      console.log(`✅ Found ${unreadData.count} unread emails`);
      
      if (unreadData.emails.length > 0) {
        console.log(`Unread emails:`);
        unreadData.emails.forEach((email, index) => {
          console.log(`  ${index + 1}. ${email.subject} (${email.urgency})`);
        });
      }
    }

    // Test 5: Email fetching - All emails
    console.log('\n📫 5. All Emails Test:');
    const allResponse = await fetch(`${baseUrl}/api/emails?type=all&maxResults=2`);
    const allData = await allResponse.json();
    
    if (allData.error) {
      console.log(`❌ Error: ${allData.error}`);
    } else {
      console.log(`✅ Fetched ${allData.count} emails`);
      console.log(`Categories found:`);
      
      const categories = {};
      allData.emails.forEach(email => {
        categories[email.category] = (categories[email.category] || 0) + 1;
      });
      
      Object.entries(categories).forEach(([category, count]) => {
        console.log(`  ${category}: ${count}`);
      });
    }

    // Test 6: Error handling test
    console.log('\n⚠️ 6. Error Handling Test:');
    const errorResponse = await fetch(`${baseUrl}/api/emails?maxResults=abc`);
    console.log(`Invalid parameter handling: ${errorResponse.status === 500 ? '✅ Properly handled' : '❌ Not handled'}`);

    // Test 7: Authentication URL (without actually authenticating)
    console.log('\n🔗 7. Auth URL Generation Test:');
    const authUrlResponse = await fetch(`${baseUrl}/api/email/auth-url`);
    const authUrlData = await authUrlResponse.json();
    
    if (authUrlData.authUrl) {
      console.log(`✅ Auth URL generated successfully`);
      console.log(`URL length: ${authUrlData.authUrl.length} chars`);
      console.log(`Contains client ID: ${authUrlData.authUrl.includes(process.env.GMAIL_CLIENT_ID) ? '✅' : '❌'}`);
    } else {
      console.log(`❌ Failed to generate auth URL`);
    }

    console.log('\n🎉 TEST CHECKPOINT 3 COMPLETED!');
    console.log('='.repeat(60));

  } catch (error) {
    console.error('\n❌ Test failed:', error);
    console.log('\n🚨 TEST CHECKPOINT 3 FAILED');
    console.log('Make sure the server is running: npm start');
    console.log('='.repeat(60));
  }
}

// Helper function to make fetch requests
async function fetch(url, options = {}) {
  // Use node-fetch or a similar library if available, or use the built-in fetch in newer Node versions
  try {
    const response = await import('node-fetch').then(fetch => fetch.default(url, options));
    return response;
  } catch (importError) {
    // Fallback for older Node versions
    console.log('⚠️ Using simplified fetch - install node-fetch for better testing');
    const http = require('http');
    const https = require('https');
    const urlParse = require('url').parse;
    
    return new Promise((resolve, reject) => {
      const parsedUrl = urlParse(url);
      const client = parsedUrl.protocol === 'https:' ? https : http;
      
      const req = client.request({
        hostname: parsedUrl.hostname,
        port: parsedUrl.port,
        path: parsedUrl.path,
        method: options.method || 'GET',
        headers: options.headers || {}
      }, (res) => {
        let data = '';
        res.on('data', chunk => data += chunk);
        res.on('end', () => {
          resolve({
            status: res.statusCode,
            json: () => Promise.resolve(JSON.parse(data))
          });
        });
      });
      
      req.on('error', reject);
      if (options.body) req.write(options.body);
      req.end();
    });
  }
}

// Run the test
testApiEndpoints();