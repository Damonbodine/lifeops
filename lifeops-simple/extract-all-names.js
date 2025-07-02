#!/usr/bin/env node

const { exec } = require('child_process');
const fs = require('fs');

console.log('📇 Extracting ALL first names from your contacts in batches...');

let allFirstNames = new Set(); // Use Set to automatically handle duplicates
let totalProcessed = 0;
const batchSize = 100;

async function extractBatch(startIndex, endIndex) {
  return new Promise((resolve) => {
    const batchScript = `
    tell application "Contacts"
      try
        set allPeople to every person
        set totalCount to count of allPeople
        set actualEnd to ${endIndex}
        if actualEnd > totalCount then set actualEnd to totalCount
        
        if ${startIndex} > totalCount then
          return "BATCH_EMPTY"
        end if
        
        set batchPeople to items ${startIndex} thru actualEnd of allPeople
        set firstNames to {}
        
        repeat with aPerson in batchPeople
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
        
        return "BATCH:" & nameString & "|PROCESSED:" & (count of batchPeople)
      on error errorMsg
        return "ERROR: " & errorMsg
      end try
    end tell
    `;
    
    exec(`osascript -e '${batchScript}'`, { timeout: 30000 }, (error, stdout, stderr) => {
      if (error) {
        console.log(`❌ Batch ${startIndex}-${endIndex} failed:`, error.message);
        resolve({ success: false, names: [] });
        return;
      }
      
      const output = stdout.trim();
      if (output === 'BATCH_EMPTY') {
        resolve({ success: true, names: [], processed: 0, finished: true });
        return;
      }
      
      if (output.startsWith('BATCH:')) {
        const parts = output.split('|');
        const nameData = parts[0].replace('BATCH:', '');
        const processed = parseInt(parts[1].replace('PROCESSED:', ''));
        
        const names = nameData ? nameData.split(',').map(n => n.trim()).filter(n => n.length > 0) : [];
        resolve({ success: true, names, processed, finished: false });
      } else {
        console.log(`❌ Batch ${startIndex}-${endIndex} unexpected output:`, output);
        resolve({ success: false, names: [] });
      }
    });
  });
}

async function extractAllNames() {
  console.log('🚀 Starting batch extraction...');
  
  let currentIndex = 1;
  let batchCount = 0;
  
  while (true) {
    const endIndex = currentIndex + batchSize - 1;
    batchCount++;
    
    console.log(`📦 Processing batch ${batchCount}: contacts ${currentIndex}-${endIndex}`);
    
    const result = await extractBatch(currentIndex, endIndex);
    
    if (!result.success) {
      console.log(`⚠️ Batch ${batchCount} failed, continuing...`);
      currentIndex += batchSize;
      continue;
    }
    
    if (result.finished) {
      console.log('✅ All contacts processed!');
      break;
    }
    
    // Add names to our set
    result.names.forEach(name => allFirstNames.add(name));
    totalProcessed += result.processed;
    
    console.log(`   ✅ Batch ${batchCount}: Found ${result.names.length} unique names in ${result.processed} contacts`);
    console.log(`   📊 Total processed: ${totalProcessed}, Total unique names: ${allFirstNames.size}`);
    
    currentIndex += batchSize;
    
    // Small delay to avoid overwhelming the system
    await new Promise(resolve => setTimeout(resolve, 1000));
  }
  
  // Convert Set to Array and save results
  const firstNamesArray = Array.from(allFirstNames).sort();
  
  console.log(`\\n🎉 EXTRACTION COMPLETE!`);
  console.log(`📊 Total contacts processed: ${totalProcessed}`);
  console.log(`📝 Total unique first names found: ${firstNamesArray.length}`);
  console.log(`📋 Sample names: ${firstNamesArray.slice(0, 20).join(', ')}...`);
  
  const contactNames = {
    totalProcessed: totalProcessed,
    uniqueFirstNames: firstNamesArray.length,
    firstNames: firstNamesArray,
    extractedAt: new Date().toISOString(),
    batchesProcessed: batchCount
  };
  
  fs.writeFileSync('contact-first-names.json', JSON.stringify(contactNames, null, 2));
  console.log('💾 Saved all first names to contact-first-names.json');
  
  // Create a smaller list of most common actual names (filter out obvious usernames/emails)
  const realNames = firstNamesArray.filter(name => {
    return name.length >= 2 && 
           !name.includes('@') && 
           !name.includes('.') && 
           /^[A-Za-z]/.test(name) &&
           !name.includes('_') &&
           !name.includes('+');
  });
  
  console.log(`🎯 Filtered to ${realNames.length} real first names`);
  console.log(`📋 Top real names: ${realNames.slice(0, 30).join(', ')}`);
  
  fs.writeFileSync('contact-real-names.json', JSON.stringify(realNames, null, 2));
  console.log('💾 Saved filtered real names to contact-real-names.json');
  
  return firstNamesArray;
}

extractAllNames().catch(console.error);