#!/usr/bin/env node

/**
 * Contacts Permission Request Script
 * 
 * This script will trigger macOS to show the Contacts permission dialog
 * for Terminal/Node.js applications.
 */

const { exec } = require('child_process');

console.log('🔐 Requesting Contacts permission for Terminal...');
console.log('📱 A macOS permission dialog should appear.');
console.log('👆 Please click "OK" to grant Contacts access.\n');

// Method 1: Try accessing Contacts directly (most reliable)
const requestPermissionScript = `
tell application "Contacts"
    try
        -- Attempt to access contacts to trigger permission request
        set contactCount to count of people
        display notification "Contacts permission granted! Found " & contactCount & " contacts." with title "LifeOps"
        return "SUCCESS: " & contactCount & " contacts found"
    on error errMsg
        display notification "Contacts permission needed. Please grant access in System Settings." with title "LifeOps"
        return "ERROR: " & errMsg
    end try
end tell
`;

console.log('Attempting to access Contacts...');

exec(`osascript -e '${requestPermissionScript}'`, { timeout: 30000 }, (error, stdout, stderr) => {
    if (error) {
        console.log('❌ Permission request failed:', error.message);
        console.log('\n📋 Manual steps:');
        console.log('1. Open System Settings > Privacy & Security > Contacts');
        console.log('2. Add Terminal.app and toggle it ON');
        console.log('3. Restart this script\n');
        
        // Method 2: Try alternative approach
        console.log('🔄 Trying alternative method...');
        
        const altScript = `
        tell application "System Events"
            tell application "Contacts" to activate
            delay 1
            tell application "System Preferences"
                activate
                reveal pane "com.apple.preference.security"
            end tell
        end tell
        `;
        
        exec(`osascript -e '${altScript}'`, (altError, altStdout, altStderr) => {
            if (altError) {
                console.log('❌ Alternative method also failed');
                console.log('🛠️  Please manually grant Contacts permission in System Settings');
            } else {
                console.log('✅ Opened System Settings - please navigate to Privacy & Security > Contacts');
            }
        });
        
    } else {
        const result = stdout.trim();
        console.log('✅ Result:', result);
        
        if (result.includes('SUCCESS')) {
            console.log('🎉 Contacts permission granted successfully!');
            console.log('🚀 You can now restart your LifeOps server to see contact names.');
            console.log('\nRestart command: pkill -f "node.*app.js" && node app.js');
        } else {
            console.log('⚠️  Permission may not be fully granted yet.');
            console.log('🔄 Please check System Settings if needed.');
        }
    }
});

// Backup method: Direct system database check
setTimeout(() => {
    console.log('\n🔍 Checking permission status...');
    
    exec('tccutil query ContactsService', (error, stdout, stderr) => {
        if (stdout.includes('Terminal')) {
            console.log('✅ Terminal found in permissions database');
        } else {
            console.log('⚠️  Terminal may not have Contacts permission yet');
        }
    });
}, 3000);