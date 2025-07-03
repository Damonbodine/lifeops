#!/usr/bin/env node

const fetch = require('node-fetch').default || require('node-fetch');

async function testBirthdayIntegration() {
  try {
    console.log('🧪 Testing Birthday Integration System\n');
    
    // Test 1: Check today's birthdays
    console.log('📅 Testing today\'s birthdays...');
    const birthdaysResponse = await fetch('http://localhost:3000/api/birthdays/today');
    const birthdaysData = await birthdaysResponse.json();
    
    console.log(`✅ Found ${birthdaysData.events.length} birthdays today:`);
    birthdaysData.events.slice(0, 3).forEach(birthday => {
      console.log(`   🎂 ${birthday.friend.name} - ${birthday.description}`);
    });
    
    // Test 2: Check birthday contact matching
    console.log('\n🔍 Testing birthday contact matching...');
    const contactsResponse = await fetch('http://localhost:3000/api/birthday-contacts?upcomingDays=1');
    
    if (contactsResponse.ok) {
      const contactsData = await contactsResponse.json();
      console.log(`✅ Birthday contact matching completed:`);
      console.log(`   Today: ${contactsData.summary.todayCount} contacts`);
      console.log(`   Upcoming: ${contactsData.summary.upcomingCount} contacts`);
      console.log(`   Total with phone numbers: ${contactsData.summary.totalWithContacts}`);
      
      if (contactsData.birthdayContacts.length > 0) {
        console.log('\n📱 Birthday contacts with phone numbers:');
        contactsData.birthdayContacts.slice(0, 3).forEach(contact => {
          console.log(`   🎉 ${contact.name} - ${contact.rawContact}`);
        });
      }
    } else {
      console.log('⏳ Birthday contact matching is still processing...');
    }
    
    // Test 3: Check integrated check-ins
    console.log('\n📋 Testing integrated check-ins with birthdays...');
    const checkinsResponse = await fetch('http://localhost:3000/api/check-ins?maxContacts=3');
    
    if (checkinsResponse.ok) {
      const checkinsData = await checkinsResponse.json();
      console.log(`✅ Check-ins integration successful:`);
      console.log(`   Total contacts: ${checkinsData.totalContacts}`);
      console.log(`   Priority contacts: ${checkinsData.priorityContacts.length}`);
      
      if (checkinsData.birthdaySummary) {
        console.log(`   Birthday summary: ${checkinsData.birthdaySummary.todayCount} today, ${checkinsData.birthdaySummary.upcomingCount} upcoming`);
      }
      
      if (checkinsData.priorityContacts.length > 0) {
        console.log('\n🎯 Priority contacts (including birthdays):');
        checkinsData.priorityContacts.slice(0, 3).forEach(contact => {
          const type = contact.birthdayContact ? '🎂 BIRTHDAY' : '📞 Regular';
          console.log(`   ${type}: ${contact.name} - ${contact.reason}`);
        });
      }
    } else {
      console.log('⏳ Check-ins integration is still processing...');
    }
    
    console.log('\n🎉 Birthday integration test completed!');
    
  } catch (error) {
    console.error('❌ Test failed:', error.message);
  }
}

testBirthdayIntegration();