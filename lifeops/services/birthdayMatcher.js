/**
 * Birthday Matcher Module
 *
 * Matches birthdays from calendar with contacts in address book,
 * providing phone numbers and suggested messages for birthday greetings.
 */

const { exec } = require('child_process');
const { getTodaysBirthdays, getUpcomingBirthdays } = require('../ics-parser');

/**
 * Match birthdays with contacts to find phone numbers
 */
async function matchBirthdaysWithContacts(birthdays) {
  console.log(`🔍 Matching ${birthdays.length} birthdays with contacts...`);
  const matchedBirthdays = [];

  // Use batch lookup for better performance
  const birthdayNames = birthdays.map(b => b.name);

  try {
    const batchResult = await new Promise((resolve) => {
      // Create a JSON file with the names to search
      const searchData = JSON.stringify({ names: birthdayNames });
      exec(`echo '${searchData}' | ./ContactBatchLookup`, { timeout: 30000 }, (error, stdout) => {
        if (error) {
          console.error('❌ Batch contact lookup error:', error.message);
          resolve({});
          return;
        }

        try {
          const result = JSON.parse(stdout);
          resolve(result);
        } catch (parseError) {
          console.error('❌ Error parsing batch lookup result:', parseError);
          resolve({});
        }
      });
    });

    // Match birthday data with contact results
    for (const birthday of birthdays) {
      const contactMatch = batchResult[birthday.name];

      if (contactMatch && contactMatch.found) {
        // Found a matching contact with phone number
        matchedBirthdays.push({
          ...birthday,
          hasContact: true,
          contactName: contactMatch.name,
          phoneNumber: contactMatch.primaryPhone,
          reason: `🎂 It's ${birthday.name}'s birthday today!`,
          suggestedMessage: `Happy birthday ${birthday.name}! 🎉 Hope you have an amazing day!`,
          birthdayContact: true,
          daysSince: 0, // Birthday is today
          messageCount: 'Unknown' // We'd need to check chat.db for actual count
        });
      }
      // Note: We skip unmatched birthdays to keep the list clean and focused
    }

    console.log(`📱 Found ${matchedBirthdays.length} birthday contacts with phone numbers`);
    return matchedBirthdays;

  } catch (error) {
    console.error('❌ Error in batch birthday matching:', error);
    return [];
  }
}

/**
 * Get today's birthdays with contact information
 */
async function getTodaysBirthdayContacts() {
  try {
    console.log('🎂 Getting today\'s birthday contacts...');

    const todaysBirthdays = await getTodaysBirthdays();
    if (todaysBirthdays.length === 0) {
      return [];
    }

    console.log(`🎉 Found ${todaysBirthdays.length} birthdays today, matching with contacts...`);
    const matchedBirthdays = await matchBirthdaysWithContacts(todaysBirthdays);

    // Filter to only those we have contact info for
    const contactableBirthdays = matchedBirthdays.filter(b => b.hasContact);
    console.log(`📱 ${contactableBirthdays.length} birthday contacts have phone numbers`);

    return contactableBirthdays;
  } catch (error) {
    console.error('❌ Error getting birthday contacts:', error);
    return [];
  }
}

/**
 * Get upcoming birthdays with contact information
 */
async function getUpcomingBirthdayContacts(days = 7) {
  try {
    console.log(`🎂 Getting upcoming birthday contacts (next ${days} days)...`);

    const upcomingBirthdays = await getUpcomingBirthdays(days);
    if (upcomingBirthdays.length === 0) {
      return [];
    }

    console.log(`📅 Found ${upcomingBirthdays.length} upcoming birthdays, matching with contacts...`);
    const matchedBirthdays = await matchBirthdaysWithContacts(upcomingBirthdays);

    // Filter to only those we have contact info for and add days until birthday
    const contactableBirthdays = matchedBirthdays
      .filter(b => b.hasContact)
      .map(birthday => {
        const today = new Date();
        const currentYear = today.getFullYear();
        let birthdayThisYear = new Date(currentYear, birthday.birth_month - 1, birthday.birth_day);

        // If birthday already passed this year, it's next year
        if (birthdayThisYear < today) {
          birthdayThisYear = new Date(currentYear + 1, birthday.birth_month - 1, birthday.birth_day);
        }

        const daysUntil = Math.ceil((birthdayThisYear - today) / (1000 * 60 * 60 * 24));

        return {
          ...birthday,
          daysUntilBirthday: daysUntil,
          reason: `🎂 ${birthday.name}'s birthday is in ${daysUntil} day${daysUntil === 1 ? '' : 's'}`,
          suggestedMessage: daysUntil <= 1 ?
            `Happy birthday ${birthday.name}! 🎉 Hope you have an amazing day!` :
            `Hi ${birthday.name}! Your birthday is coming up in ${daysUntil} days. Looking forward to celebrating with you! 🎉`,
          daysSince: -daysUntil // Negative since it's in the future
        };
      });

    console.log(`📱 ${contactableBirthdays.length} upcoming birthday contacts have phone numbers`);
    return contactableBirthdays;
  } catch (error) {
    console.error('❌ Error getting upcoming birthday contacts:', error);
    return [];
  }
}

module.exports = {
  matchBirthdaysWithContacts,
  getTodaysBirthdayContacts,
  getUpcomingBirthdayContacts
};
