require('dotenv').config();
const emailService = require('./services/emailService');
const emailSummarizer = require('./services/emailSummarizer');

/**
 * TEST CHECKPOINT 2: Email Fetching and Parsing Test
 * 
 * This script tests:
 * 1. Email fetching from Gmail API
 * 2. Email parsing (headers, body, etc.)
 * 3. AI summarization
 * 4. Batch processing
 */

async function testEmailFetching() {
  console.log('🧪 TEST CHECKPOINT 2: Email Fetching and Parsing');
  console.log('='.repeat(60));

  try {
    // Wait for EmailService to load tokens
    console.log('⏳ Waiting for EmailService to initialize...');
    await new Promise(resolve => setTimeout(resolve, 2000));

    // Test 1: Check authentication
    console.log('\n🔐 1. Authentication Check:');
    if (!emailService.isAuth()) {
      console.log('❌ Not authenticated! Run token migration first.');
      return;
    }
    console.log('✅ Authenticated and ready');

    // Test 2: Fetch recent emails
    console.log('\n📧 2. Fetching Recent Emails:');
    console.log('Fetching last 3 emails...');
    
    const recentEmails = await emailService.getRecentEmails(3);
    console.log(`✅ Fetched ${recentEmails.length} recent emails`);

    if (recentEmails.length === 0) {
      console.log('⚠️ No recent emails found, trying all emails...');
      const result = await emailService.getEmails({ maxResults: 3 });
      recentEmails.push(...result.messages);
    }

    // Test 3: Display email parsing results
    console.log('\n📋 3. Email Parsing Results:');
    recentEmails.forEach((email, index) => {
      console.log(`\n--- Email ${index + 1} ---`);
      console.log(`ID: ${email.id}`);
      console.log(`From: ${email.from}`);
      console.log(`Subject: ${email.subject}`);
      console.log(`Date: ${email.date}`);
      console.log(`Read: ${email.isRead ? 'Yes' : 'No'}`);
      console.log(`Has Attachments: ${email.hasAttachments ? 'Yes' : 'No'}`);
      console.log(`Body Length: ${email.body.length} chars`);
      console.log(`Body Preview: ${email.body.substring(0, 100)}...`);
    });

    // Test 4: AI Summarization
    console.log('\n🤖 4. AI Summarization Test:');
    console.log(`OpenAI Available: ${emailSummarizer.getStatus().openaiAvailable ? '✅' : '❌'}`);

    if (recentEmails.length > 0) {
      console.log(`\nTesting summarization on first email...`);
      const firstEmail = recentEmails[0];
      
      const summary = await emailSummarizer.summarizeEmail(firstEmail);
      
      console.log('\n📊 Summary Results:');
      console.log(`Summary: ${summary.summary}`);
      console.log(`Urgency: ${summary.urgency}`);
      console.log(`Category: ${summary.category}`);
      console.log(`Requires Response: ${summary.requiresResponse ? 'Yes' : 'No'}`);
      console.log(`Key Points: ${summary.keyPoints.join(', ')}`);
      console.log(`Action Items: ${summary.actionItems.length > 0 ? summary.actionItems.join(', ') : 'None'}`);
      
      if (summary.suggestedResponse) {
        console.log(`Suggested Response: ${summary.suggestedResponse}`);
      }
    }

    // Test 5: Batch Processing
    console.log('\n📦 5. Batch Processing Test:');
    if (recentEmails.length > 1) {
      console.log(`Processing ${recentEmails.length} emails in batch...`);
      
      const batchResults = await emailSummarizer.summarizeBatch(recentEmails.slice(0, 2));
      
      console.log(`✅ Batch processed ${batchResults.length} emails`);
      console.log('\n📊 Batch Results Summary:');
      
      batchResults.forEach((result, index) => {
        console.log(`\n--- Email ${index + 1} Summary ---`);
        console.log(`Subject: ${result.subject}`);
        console.log(`Summary: ${result.summary}`);
        console.log(`Urgency: ${result.urgency} | Category: ${result.category}`);
      });
    }

    console.log('\n🎉 TEST CHECKPOINT 2 COMPLETED SUCCESSFULLY!');
    console.log('='.repeat(60));

  } catch (error) {
    console.error('\n❌ Test failed:', error);
    console.log('\n🚨 TEST CHECKPOINT 2 FAILED');
    console.log('Error details:', error.message);
    console.log('='.repeat(60));
  }
}

// Run the test
testEmailFetching();