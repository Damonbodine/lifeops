#!/usr/bin/env node

const { exec } = require('child_process');
const fs = require('fs');

console.log('📇 Extracting all first names from your 15,817 contacts...');

// AppleScript to extract all unique first names  
const extractNamesScript = `
tell application "Contacts"
  try
    set allPeople to every person
    set firstNames to {}
    set nameCount to 0
    
    repeat with aPerson in allPeople
      set nameCount to nameCount + 1
      try
        set personName to name of aPerson
        if personName is not "" then
          set nameWords to words of personName
          if (count of nameWords) > 0 then
            set firstName to first item of nameWords
            if firstName is not in firstNames then
              set end of firstNames to firstName
            end if
          end if
        end if
      end try
    end repeat
    
    set AppleScript's text item delimiters to ","
    set nameString to firstNames as string
    set AppleScript's text item delimiters to ""
    
    return "TOTAL:" & (count of allPeople) & "|NAMES:" & (count of firstNames) & "|DATA:" & nameString
  on error errorMsg
    return "ERROR: " & errorMsg
  end try
end tell
`;

console.log('🍎 Running AppleScript to extract first names...');

exec(`osascript -e '${extractNamesScript}'`, { timeout: 120000 }, (error, stdout, stderr) => {
  if (error) {
    console.error('❌ Error:', error.message);
    return;
  }
  
  if (stderr) {
    console.log('⚠️ Stderr:', stderr);
  }
  
  const output = stdout.trim();
  console.log('📤 Raw output length:', output.length);
  
  if (output.startsWith('TOTAL:')) {
    // Parse the results
    const parts = output.split('|');
    const totalContacts = parts[0].replace('TOTAL:', '');
    const uniqueNames = parts[1].replace('NAMES:', '');
    const nameData = parts[2].replace('DATA:', '');
    
    console.log(`✅ Successfully processed ${totalContacts} contacts`);
    console.log(`✅ Found ${uniqueNames} unique first names`);
    
    // Split names and clean them
    const nameArray = nameData.split(',').map(name => name.trim()).filter(name => name.length > 0);
    
    console.log(`📝 Sample first names: ${nameArray.slice(0, 10).join(', ')}...`);
    
    // Save to file for use in contact resolution
    const contactNames = {
      totalContacts: parseInt(totalContacts),
      uniqueFirstNames: nameArray.length,
      firstNames: nameArray,
      extractedAt: new Date().toISOString()
    };
    
    fs.writeFileSync('contact-first-names.json', JSON.stringify(contactNames, null, 2));
    console.log('💾 Saved first names to contact-first-names.json');
    
    // Also create a smaller AppleScript-friendly array
    const scriptFriendlyNames = nameArray.slice(0, 100); // Top 100 most common
    console.log(`🎯 Created script-friendly list of top ${scriptFriendlyNames.length} names`);
    console.log(`📋 Top names: ${scriptFriendlyNames.slice(0, 20).join(', ')}`);
    
    // Save the script-friendly version
    fs.writeFileSync('contact-names-top100.json', JSON.stringify(scriptFriendlyNames, null, 2));
    console.log('💾 Saved top 100 names to contact-names-top100.json');
    
  } else {
    console.log('❌ Unexpected output format:', output);
  }
});