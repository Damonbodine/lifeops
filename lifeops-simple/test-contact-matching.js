#!/usr/bin/env node

const { exec } = require('child_process');

// Test with a phone number from Messages: +16462566056
const phoneNumber = '+16462566056';

function normalizePhoneNumber(phoneNumber) {
  if (!phoneNumber) return { original: phoneNumber, normalized: '', digits: '', last10: '' };
  
  // Remove all non-digit characters
  const digits = phoneNumber.replace(/\D/g, '');
  
  let normalized = '';
  let last10 = '';
  
  if (digits.length === 11 && digits.startsWith('1')) {
    // US number with country code
    normalized = digits;
    last10 = digits.slice(1);
  } else if (digits.length === 10) {
    // US number without country code
    normalized = '1' + digits;
    last10 = digits;
  } else if (digits.length > 10) {
    // International or malformed - use last 10 digits
    last10 = digits.slice(-10);
    normalized = '1' + last10;
  } else {
    // Too short - use as is
    normalized = digits;
    last10 = digits;
  }
  
  return {
    original: phoneNumber,
    normalized: normalized,
    digits: digits,
    last10: last10,
    area: last10.slice(0, 3),
    exchange: last10.slice(3, 6),
    number: last10.slice(6, 10)
  };
}

const phoneInfo = normalizePhoneNumber(phoneNumber);
console.log('🔍 Testing contact lookup for:', phoneNumber);
console.log('📱 Normalized to last10:', phoneInfo.last10);

// Test AppleScript search with debug info
const appleScript = `
  tell application "Contacts"
    try
      set targetDigits to "${phoneInfo.last10}"
      set foundName to ""
      set peopleList to every person
      set searchCount to 0
      set debugInfo to "Searching for: " & targetDigits & return
      
      repeat with aPerson in peopleList
        set searchCount to searchCount + 1
        try
          set phoneList to phone of aPerson
          repeat with aPhone in phoneList
            set phoneValue to value of aPhone as string
            
            -- Normalize phone number by extracting digits only
            set normalizedPhone to ""
            repeat with i from 1 to count of characters in phoneValue
              set currentChar to character i of phoneValue
              if currentChar is in "0123456789" then
                set normalizedPhone to normalizedPhone & currentChar
              end if
            end repeat
            
            -- Get last 10 digits for comparison
            set phoneLength to count of characters in normalizedPhone
            set comparablePhone to ""
            if phoneLength >= 10 then
              set comparablePhone to text (phoneLength - 9) thru phoneLength of normalizedPhone
            else
              set comparablePhone to normalizedPhone
            end if
            
            -- Debug first few contacts
            if searchCount <= 3 then
              set debugInfo to debugInfo & "Contact " & searchCount & ": " & (name of aPerson) & " has " & phoneValue & " -> normalized: " & comparablePhone & return
            end if
            
            -- Check if normalized numbers match
            if comparablePhone is equal to targetDigits then
              set firstName to ""
              set lastName to ""
              try
                set firstName to first name of aPerson as string
              end try
              try  
                set lastName to last name of aPerson as string
              end try
              if firstName is not "" or lastName is not "" then
                set foundName to firstName & " " & lastName
                exit repeat
              end if
            end if
          end repeat
          if foundName is not "" then exit repeat
          
          -- Limit search to first 50 contacts for quick test
          if searchCount > 50 then exit repeat
        end try
      end repeat
      
      if foundName is not "" then
        return "FOUND: " & foundName
      else
        return "NOT_FOUND - " & debugInfo
      end if
    on error errorMsg
      return "ERROR: " & errorMsg
    end try
  end tell
`;

console.log('🍎 Running AppleScript contact lookup...');

exec(`osascript -e '${appleScript}'`, { timeout: 30000 }, (error, stdout, stderr) => {
  console.log('\n📤 AppleScript result:');
  if (error) {
    console.log('❌ Error:', error.message);
  }
  if (stderr) {
    console.log('⚠️ Stderr:', stderr);
  }
  console.log('✅ Output:', stdout?.trim());
});