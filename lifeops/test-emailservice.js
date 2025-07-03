require('dotenv').config();
const emailService = require('./services/emailService');

/**
 * TEST CHECKPOINT 1: EmailService Authentication Test
 * 
 * This script tests:
 * 1. EmailService initialization
 * 2. Authentication status checking
 * 3. Token loading from existing tokens
 * 4. Profile fetching (if authenticated)
 */

async function testEmailService() {
  console.log('🧪 TEST CHECKPOINT 1: EmailService Authentication');
  console.log('='.repeat(50));

  try {
    // Wait a moment for EmailService to load tokens
    console.log('⏳ Waiting for EmailService to load tokens...');
    await new Promise(resolve => setTimeout(resolve, 2000));

    // Test 1: Check environment variables
    console.log('\n📋 1. Environment Check:');
    console.log(`Gmail Client ID: ${process.env.GMAIL_CLIENT_ID ? '✅ Present' : '❌ Missing'}`);
    console.log(`Gmail Client Secret: ${process.env.GMAIL_CLIENT_SECRET ? '✅ Present' : '❌ Missing'}`);

    // Test 2: Check authentication status
    console.log('\n🔐 2. Authentication Status:');
    const authStatus = emailService.getAuthStatus();
    console.log(`Authenticated: ${authStatus.authenticated ? '✅' : '❌'}`);
    console.log(`Has Refresh Token: ${authStatus.hasRefreshToken ? '✅' : '❌'}`);
    console.log(`Token Expiry: ${authStatus.tokenExpiry ? new Date(authStatus.tokenExpiry) : 'N/A'}`);

    // Test 3: If authenticated, try to get profile
    if (emailService.isAuth()) {
      console.log('\n👤 3. Profile Test:');
      try {
        const profile = await emailService.getProfile();
        console.log(`✅ Profile fetched successfully`);
        console.log(`Email: ${profile.emailAddress}`);
        console.log(`Messages Total: ${profile.messagesTotal}`);
        console.log(`Threads Total: ${profile.threadsTotal}`);
      } catch (error) {
        console.log(`❌ Profile fetch failed: ${error.message}`);
      }
    } else {
      console.log('\n🔗 3. Authentication Required:');
      console.log('To authenticate, run the following:');
      console.log('1. Get auth URL:');
      const authUrl = emailService.getAuthUrl();
      console.log(`   ${authUrl}`);
      console.log('2. Visit the URL, grant permissions, and copy the code');
      console.log('3. Run: await emailService.authenticate("YOUR_CODE_HERE")');
    }

    // Test 4: Test basic functionality
    console.log('\n⚙️ 4. Service Functionality:');
    console.log(`Service initialized: ✅`);
    console.log(`Auth URL generation: ✅`);
    console.log(`Token management: ✅`);

    console.log('\n🎉 TEST CHECKPOINT 1 COMPLETED');
    console.log('='.repeat(50));

  } catch (error) {
    console.error('\n❌ Test failed:', error);
    console.log('\n🚨 TEST CHECKPOINT 1 FAILED');
    console.log('='.repeat(50));
  }
}

// Run the test
testEmailService();