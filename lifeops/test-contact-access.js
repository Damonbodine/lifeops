#!/usr/bin/env node

const { exec } = require('child_process');

console.log('🧪 Testing Contacts access...\n');

// Test 1: Basic access
console.log('Test 1: Basic Contacts access');
exec(`osascript -e 'tell application "Contacts" to return count of people'`, (error, stdout, stderr) => {
    if (error) {
        console.log('❌ Failed:', error.message);
    } else {
        console.log('✅ Success: Found', stdout.trim(), 'contacts');
    }
    
    // Test 2: Get first contact name
    console.log('\nTest 2: Reading contact names');
    exec(`osascript -e 'tell application "Contacts" to return name of first person'`, (error2, stdout2, stderr2) => {
        if (error2) {
            console.log('❌ Failed:', error2.message);
        } else {
            console.log('✅ Success: First contact is', stdout2.trim());
        }
        
        // Test 3: Search for a phone number
        console.log('\nTest 3: Phone number search');
        const testScript = `
        tell application "Contacts"
          try
            set testPeople to every person
            repeat with i from 1 to 10
              try
                set aPerson to item i of testPeople
                set phoneList to phone of aPerson
                if (count of phoneList) > 0 then
                  return (name of aPerson) & " - " & (value of first item of phoneList)
                end if
              end try
            end repeat
            return "No contacts with phones found in first 10"
          on error errMsg
            return "ERROR: " & errMsg
          end try
        end tell`;
        
        exec(`osascript -e '${testScript}'`, { timeout: 10000 }, (error3, stdout3, stderr3) => {
            if (error3) {
                console.log('❌ Failed:', error3.message);
            } else {
                console.log('✅ Success:', stdout3.trim());
            }
            
            console.log('\n📋 Summary:');
            console.log('- Contacts permission:', !error ? '✅ Granted' : '❌ Denied');
            console.log('- Name access:', !error2 ? '✅ Working' : '❌ Blocked');  
            console.log('- Phone access:', !error3 ? '✅ Working' : '❌ Blocked');
        });
    });
});