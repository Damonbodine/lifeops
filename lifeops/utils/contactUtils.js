/**
 * Contact Utilities Module
 *
 * Utilities for normalizing phone numbers, formatting names, looking up contacts,
 * and retrieving recent message history from iMessage.
 */

const { exec } = require('child_process');
const sqlite3 = require('sqlite3').verbose();
const path = require('path');
const os = require('os');

/**
 * Normalize phone number to various formats for matching
 */
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

/**
 * Helper function for random shuffling
 */
function shuffleArray(array) {
  const shuffled = [...array];
  for (let i = shuffled.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
  }
  return shuffled;
}

/**
 * Helper function to describe configuration
 */
function getConfigDescription(config) {
  const parts = [];

  if (config.daysThreshold === 1) {
    parts.push('showing very recent contacts');
  } else if (config.daysThreshold <= 7) {
    parts.push('showing recent contacts');
  } else if (config.daysThreshold <= 30) {
    parts.push('showing contacts from past month');
  } else {
    parts.push(`showing contacts not contacted in ${config.daysThreshold}+ days`);
  }

  if (config.sortBy === 'messageCount') {
    parts.push('sorted by message frequency');
  } else if (config.sortBy === 'random') {
    parts.push('in random order');
  } else {
    parts.push('sorted by time since last contact');
  }

  if (config.filterType === 'resolved') {
    parts.push('(named contacts only)');
  } else if (config.filterType === 'unresolved') {
    parts.push('(phone numbers only)');
  }

  return parts.join(', ');
}

/**
 * Batch contact lookup function for efficiency
 */
async function batchGetContactNames(phoneNumbers, contactCache, scriptDir) {
  return new Promise((resolve) => {
    try {
      // Filter out numbers already in cache
      const uncachedNumbers = [];
      const results = {};

      // Check cache first
      for (const phone of phoneNumbers) {
        if (contactCache && contactCache.has(phone)) {
          const cached = contactCache.get(phone);
          results[phone] = cached;
          console.log(`📱 Batch cache hit: ${phone} -> ${cached.name}`);
        } else {
          uncachedNumbers.push(phone);
        }
      }

      // If all were cached, return immediately
      if (uncachedNumbers.length === 0) {
        console.log(`✅ All ${phoneNumbers.length} contacts found in cache`);
        resolve(results);
        return;
      }

      console.log(`⚡ Batch lookup for ${uncachedNumbers.length} uncached numbers...`);

      // Build command with quoted arguments
      const quotedNumbers = uncachedNumbers.map(num => `"${num}"`).join(' ');
      const command = `swift ContactBatchLookup.swift ${quotedNumbers}`;

      exec(command, { timeout: 10000, cwd: scriptDir || __dirname }, (error, stdout, stderr) => {
        if (error || stderr) {
          console.error(`❌ Batch lookup error: ${error?.message || stderr}`);
          // Fallback: mark all uncached as unresolved
          for (const phone of uncachedNumbers) {
            const result = { name: getFormattedName(phone), isResolved: false };
            results[phone] = result;
            if (contactCache) contactCache.set(phone, result);
          }
        } else {
          try {
            const batchResults = JSON.parse(stdout.trim());

            // Process batch results
            for (const phone of uncachedNumbers) {
              const contactName = batchResults[phone];
              let result;

              if (contactName === 'NOT_FOUND' || !contactName) {
                result = { name: getFormattedName(phone), isResolved: false };
                console.log(`❌ Batch: No match for ${phone}`);
              } else {
                result = { name: contactName, isResolved: true };
                console.log(`✅ Batch: ${phone} -> ${contactName}`);
              }

              results[phone] = result;
              if (contactCache) contactCache.set(phone, result);
            }
          } catch (parseError) {
            console.error(`❌ Failed to parse batch results: ${parseError.message}`);
            // Fallback
            for (const phone of uncachedNumbers) {
              const result = { name: getFormattedName(phone), isResolved: false };
              results[phone] = result;
              if (contactCache) contactCache.set(phone, result);
            }
          }
        }

        console.log(`📊 Batch complete: ${Object.keys(results).length} total, ${Object.values(results).filter(r => r.isResolved).length} resolved`);
        resolve(results);
      });

    } catch (error) {
      console.error('🚨 Error in batch contact lookup:', error);
      // Fallback
      const results = {};
      for (const phone of phoneNumbers) {
        results[phone] = { name: getFormattedName(phone), isResolved: false };
      }
      resolve(results);
    }
  });
}

/**
 * Helper function to get contact name using normalized phone matching
 */
async function getContactName(phoneOrEmail, contactCache, scriptDir) {
  return new Promise((resolve) => {
    try {
      // Check intelligent cache first
      if (contactCache && contactCache.has(phoneOrEmail)) {
        const cachedResult = contactCache.get(phoneOrEmail);
        console.log(`💾 Cache hit for ${phoneOrEmail}: ${cachedResult.name} (resolved: ${cachedResult.isResolved})`);
        resolve(cachedResult);
        return;
      }

      console.log(`🔍 Looking up contact: ${phoneOrEmail}`);

      // For emails, try a simpler approach first
      if (phoneOrEmail.includes('@')) {
        const emailName = phoneOrEmail.split('@')[0];
        const cleanName = emailName.replace(/[._+]/g, ' ')
                                 .replace(/\b\w/g, l => l.toUpperCase())
                                 .replace(/\d+/g, '').trim();
        const result = { name: cleanName || phoneOrEmail, isResolved: false };
        if (contactCache) contactCache.set(phoneOrEmail, result);
        console.log(`📧 Email resolved: ${phoneOrEmail} -> ${result.name}`);
        resolve(result);
        return;
      }

      // Normalize the phone number
      const phoneInfo = normalizePhoneNumber(phoneOrEmail);
      console.log(`📱 Phone normalization:`, phoneInfo);

      if (phoneInfo.last10.length < 10) {
        const result = { name: getFormattedName(phoneOrEmail), isResolved: false };
        if (contactCache) contactCache.set(phoneOrEmail, result);
        console.log(`❌ Phone too short: ${phoneOrEmail}`);
        resolve(result);
        return;
      }

      // Use Swift ContactLookup for efficient contact resolution
      console.log(`⚡ Executing Swift ContactLookup for ${phoneOrEmail}...`);

      // Execute Swift contact lookup with timeout
      exec(`swift ContactLookup.swift "${phoneOrEmail}"`, { timeout: 5000, cwd: scriptDir || __dirname }, (error, stdout, stderr) => {
        let result;

        console.log(`📤 Swift ContactLookup result for ${phoneOrEmail}:`);
        console.log(`   stdout: "${stdout?.trim()}"`);
        console.log(`   stderr: "${stderr?.trim()}"`);
        console.log(`   error: ${error?.message || 'none'}`);

        if (error || stderr) {
          console.log(`⏰ Contact lookup failed/timeout for ${phoneOrEmail} (${phoneInfo.last10})`);
          result = { name: getFormattedName(phoneOrEmail), isResolved: false };
        } else {
          const output = stdout.trim();
          if (output === 'NOT_FOUND' || output === 'ERROR' || output.startsWith('ERROR:') || output === '') {
            console.log(`❌ No match found for ${phoneOrEmail} (${phoneInfo.last10})`);
            result = { name: getFormattedName(phoneOrEmail), isResolved: false };
          } else {
            // Clean up the result
            const cleanResult = output.replace(/\s+/g, ' ').trim();
            if (cleanResult && cleanResult !== ' ' && cleanResult !== 'missing value missing value') {
              console.log(`✅ CONTACT FOUND: ${phoneOrEmail} (${phoneInfo.last10}) -> ${cleanResult}`);
              result = { name: cleanResult, isResolved: true };
            } else {
              console.log(`❌ Invalid result for ${phoneOrEmail}: "${cleanResult}"`);
              result = { name: getFormattedName(phoneOrEmail), isResolved: false };
            }
          }
        }

        // Cache the result
        if (contactCache) contactCache.set(phoneOrEmail, result);
        resolve(result);
      });

    } catch (error) {
      console.error('🚨 Error in contact lookup:', error);
      const result = { name: getFormattedName(phoneOrEmail), isResolved: false };
      if (contactCache) contactCache.set(phoneOrEmail, result);
      resolve(result);
    }
  });
}

/**
 * Helper function for enhanced name formatting
 */
function getFormattedName(phoneOrEmail) {
  if (phoneOrEmail.includes('@')) {
    // Email: extract name part and format nicely
    const emailName = phoneOrEmail.split('@')[0];
    return emailName.replace(/[._+]/g, ' ')
                   .replace(/\b\w/g, l => l.toUpperCase())
                   .replace(/\d+/g, '').trim() || phoneOrEmail;
  } else {
    // Phone: format as (XXX) XXX-XXXX
    const digits = phoneOrEmail.replace(/\D/g, '');
    if (digits.length === 10) {
      return `(${digits.slice(0,3)}) ${digits.slice(3,6)}-${digits.slice(6)}`;
    } else if (digits.length === 11 && digits.startsWith('1')) {
      return `(${digits.slice(1,4)}) ${digits.slice(4,7)}-${digits.slice(7)}`;
    }
    return phoneOrEmail;
  }
}

/**
 * Get recent contacts from iMessage chat.db
 */
async function getRecentContacts(daysBack = 90, contactCache, scriptDir) {
  return new Promise((resolve, reject) => {
    const chatDbPath = path.join(os.homedir(), 'Library', 'Messages', 'chat.db');
    console.log('🔍 Attempting to access chat.db at:', chatDbPath);
    const db = new sqlite3.Database(chatDbPath, sqlite3.OPEN_READONLY, (err) => {
      if (err) {
        console.log('❌ Chat.db access requires Full Disk Access permission:', err.message);
        // Return mock data for demo with both resolved and unresolved contacts
        resolve([
          { contact: 'John Smith', rawContact: '+19154971236', lastMessage: new Date(Date.now() - 45 * 24 * 60 * 60 * 1000), daysSince: 45, isResolved: true },
          { contact: 'Sarah Johnson', rawContact: '+12094800633', lastMessage: new Date(Date.now() - 35 * 24 * 60 * 60 * 1000), daysSince: 35, isResolved: true },
          { contact: 'Mike Chen', rawContact: '+17163084168', lastMessage: new Date(Date.now() - 5 * 24 * 60 * 60 * 1000), daysSince: 5, isResolved: true },
          { contact: 'Emma Davis', rawContact: '+19177576633', lastMessage: new Date(Date.now() - 50 * 24 * 60 * 60 * 1000), daysSince: 50, isResolved: true },
          { contact: 'Alex Rodriguez', rawContact: '+14123269472', lastMessage: new Date(Date.now() - 20 * 24 * 60 * 60 * 1000), daysSince: 20, isResolved: true },
          { contact: '(516) 849-8802', rawContact: '+15168498802', lastMessage: new Date(Date.now() - 60 * 24 * 60 * 60 * 1000), daysSince: 60, isResolved: false },
          { contact: '(646) 256-6056', rawContact: '+16462566056', lastMessage: new Date(Date.now() - 65 * 24 * 60 * 60 * 1000), daysSince: 65, isResolved: false },
          { contact: 'Jennifer Wilson', rawContact: '+19876543210', lastMessage: new Date(Date.now() - 55 * 24 * 60 * 60 * 1000), daysSince: 55, isResolved: true },
          { contact: 'David Thompson', rawContact: '+15551234567', lastMessage: new Date(Date.now() - 40 * 24 * 60 * 60 * 1000), daysSince: 40, isResolved: true },
          { contact: 'Lisa Chang', rawContact: '+15559876543', lastMessage: new Date(Date.now() - 32 * 24 * 60 * 60 * 1000), daysSince: 32, isResolved: true }
        ]);
        return;
      }

      const cutoffDate = (Date.now() - (daysBack * 24 * 60 * 60 * 1000)) * 1000000 - 978307200000000000; // Convert to Apple timestamp
      const query = `
        SELECT
          handle.id as contact,
          MAX(CASE WHEN message.is_from_me = 1 THEN message.date ELSE NULL END) as last_sent_date,
          MAX(message.date) as last_any_message_date,
          COUNT(message.ROWID) as message_count,
          COUNT(CASE WHEN message.is_from_me = 1 THEN 1 END) as sent_count
        FROM message
        JOIN chat_message_join ON message.ROWID = chat_message_join.message_id
        JOIN chat ON chat_message_join.chat_id = chat.ROWID
        JOIN chat_handle_join ON chat.ROWID = chat_handle_join.chat_id
        JOIN handle ON chat_handle_join.handle_id = handle.ROWID
        WHERE message.date > ? AND handle.id IS NOT NULL
        GROUP BY handle.id
        HAVING COUNT(message.ROWID) >= 2 AND sent_count > 0
        ORDER BY last_sent_date ASC NULLS LAST
        LIMIT 50
      `;

      db.all(query, [cutoffDate], async (err, rows) => {
        db.close();
        if (err) {
          console.error('Error querying messages:', err);
          resolve([]);
          return;
        }

        // Extract all phone numbers for batch lookup
        const phoneNumbers = rows.map(row => row.contact);
        console.log(`📱 Starting batch lookup for ${phoneNumbers.length} contacts...`);

        // Perform batch contact name resolution
        const contactResults = await batchGetContactNames(phoneNumbers, contactCache, scriptDir);
        console.log(`✅ Batch lookup complete for ${phoneNumbers.length} contacts`);

        // Convert timestamps and process contact data with resolved names
        const contacts = rows.map((row) => {
          // Use last_sent_date (when you last messaged them) for relationship tracking
          const lastSentMessage = row.last_sent_date ? new Date((row.last_sent_date / 1000000) + 978307200000) : null;
          const lastAnyMessage = new Date((row.last_any_message_date / 1000000) + 978307200000);

          // Calculate days since YOU last messaged them (not since any activity)
          const daysSince = lastSentMessage ?
            Math.floor((Date.now() - lastSentMessage.getTime()) / (24 * 60 * 60 * 1000)) :
            999; // If you never messaged them, mark as very old

          const contactResult = contactResults[row.contact];

          return {
            contact: contactResult.name,
            rawContact: row.contact,
            lastMessage: lastSentMessage || lastAnyMessage,
            lastSentMessage,
            lastAnyMessage,
            daysSince,
            messageCount: row.message_count,
            sentCount: row.sent_count,
            isResolved: contactResult.isResolved
          };
        });
        resolve(contacts);
      });
    });
  });
}

module.exports = {
  normalizePhoneNumber,
  shuffleArray,
  getConfigDescription,
  batchGetContactNames,
  getContactName,
  getFormattedName,
  getRecentContacts
};
