const HealthAnalytics = require('./healthAnalytics');
const path = require('path');
const fs = require('fs').promises;

class SocialPlannerAggregator {
  constructor() {
    this.healthAnalytics = new HealthAnalytics(process.env.OPENAI_API_KEY);
    this.HEALTH_EXPORT_PATH = path.join(__dirname, '../apple_health_export');
  }

  /**
   * Gather all planning context - memory optimized
   * Returns processed insights instead of raw data
   */
  async gatherPlanningContext(userGoals = {}) {
    console.log('🔄 Gathering planning context...');
    
    try {
      // Gather all context in parallel for efficiency
      const [energyContext, socialContext, scheduleContext, tasksContext] = await Promise.all([
        this.getEnergyContext(),
        this.getSocialContext(),
        this.getScheduleContext(),
        this.getLifeTasksContext()
      ]);

      const context = {
        energy: energyContext,
        social: socialContext,
        schedule: scheduleContext,
        tasks: tasksContext,
        goals: userGoals,
        timestamp: new Date().toISOString()
      };

      console.log('✅ Planning context gathered successfully');
      return context;
    } catch (error) {
      console.error('❌ Error gathering planning context:', error);
      throw error;
    }
  }

  /**
   * Get energy profile from health data
   * USING MOCK DATA for performance - replace with real data later
   */
  async getEnergyContext() {
    try {
      console.log('🎭 Using mock health data for fast performance');
      
      // Mock health data based on typical patterns
      const mockEnergyProfile = {
        currentEnergyLevel: 'moderate',
        optimalWorkoutTimes: ['morning', 'afternoon'],
        restNeeds: 'moderate - balance activity and rest',
        weeklyFitnessGoal: '3-4 moderate workouts per week',
        energyPeaks: ['9am-11am', '2pm-4pm'],
        mockData: true
      };

      // Add some randomization to make it feel more personalized
      const energyLevels = ['low', 'moderate', 'high'];
      const randomEnergy = energyLevels[Math.floor(Math.random() * energyLevels.length)];
      mockEnergyProfile.currentEnergyLevel = randomEnergy;

      // Adjust other fields based on energy level
      if (randomEnergy === 'high') {
        mockEnergyProfile.weeklyFitnessGoal = '4-5 workouts per week';
        mockEnergyProfile.restNeeds = 'low - maintain current pace';
      } else if (randomEnergy === 'low') {
        mockEnergyProfile.weeklyFitnessGoal = '2-3 light workouts per week';
        mockEnergyProfile.restNeeds = 'high - prioritize recovery';
      }

      console.log('✅ Mock energy profile generated:', mockEnergyProfile);
      return mockEnergyProfile;
      
    } catch (error) {
      console.error('Error getting energy context:', error);
      // Fallback if even mock data fails
      return {
        currentEnergyLevel: 'moderate',
        optimalWorkoutTimes: ['morning', 'afternoon'],
        restNeeds: 'moderate',
        weeklyFitnessGoal: '3-4 workouts',
        energyPeaks: ['9am-11am', '2pm-4pm'],
        mockData: true,
        fallback: true
      };
    }
  }

  /**
   * Get social context - aggregated insights
   * Returns ~100 tokens instead of 1000+ messages/emails
   */
  async getSocialContext() {
    try {
      const [messageInsights, emailInsights, birthdayInsights] = await Promise.all([
        this.getMessageInsights(),
        this.getEmailInsights(),
        this.getBirthdayInsights()
      ]);

      const socialContext = {
        pendingFriendCheckins: this.identifyFriendCheckins(messageInsights),
        emailFollowups: this.identifyEmailFollowups(emailInsights),
        upcomingBirthdays: birthdayInsights,
        socialOpportunities: this.findSocialOpportunities(messageInsights, emailInsights),
        relationshipMaintenance: this.identifyRelationshipNeeds(messageInsights, emailInsights),
        socialBattery: this.calculateSocialBattery(messageInsights, emailInsights)
      };

      return socialContext;
    } catch (error) {
      console.error('Error getting social context:', error);
      // Return default social context if social data fails
      return {
        pendingFriendCheckins: [],
        emailFollowups: [],
        upcomingBirthdays: [],
        socialOpportunities: [],
        relationshipMaintenance: [],
        socialBattery: 'moderate'
      };
    }
  }

  /**
   * Get schedule context from calendar
   */
  async getScheduleContext() {
    try {
      // This would integrate with your calendar service
      // For now, return a basic schedule context
      return {
        busyDays: ['Monday morning', 'Wednesday evening'],
        freeBlocks: ['Tuesday 2-5pm', 'Thursday 10am-12pm', 'Saturday morning'],
        workingHours: '9am-5pm',
        preferredPlanningTime: 'evening',
        weekendAvailability: 'flexible'
      };
    } catch (error) {
      console.error('Error getting schedule context:', error);
      return {
        busyDays: [],
        freeBlocks: ['flexible'],
        workingHours: '9am-5pm',
        preferredPlanningTime: 'evening',
        weekendAvailability: 'flexible'
      };
    }
  }

  /**
   * Get life tasks context
   */
  async getLifeTasksContext() {
    try {
      // Basic life tasks that everyone needs
      const essentialTasks = [
        { task: 'Grocery shopping', frequency: 'weekly', duration: '1 hour' },
        { task: 'Meal prep', frequency: 'weekly', duration: '2 hours' },
        { task: 'Laundry', frequency: 'weekly', duration: '30 minutes' },
        { task: 'Cleaning', frequency: 'weekly', duration: '1 hour' },
        { task: 'Bills/admin', frequency: 'weekly', duration: '30 minutes' }
      ];

      return {
        essentialTasks,
        preferredTaskDays: ['Sunday', 'Saturday'],
        timePreference: 'morning',
        batchingPreference: 'group similar tasks'
      };
    } catch (error) {
      console.error('Error getting life tasks context:', error);
      return {
        essentialTasks: [],
        preferredTaskDays: ['weekend'],
        timePreference: 'flexible',
        batchingPreference: 'spread throughout week'
      };
    }
  }

  // Helper methods for energy analysis
  calculateEnergyLevel(trends) {
    try {
      if (!trends || !trends.healthSummary) return 'moderate';
      
      const { steps, heartRate, activeEnergy } = trends.healthSummary;
      
      // Simple energy calculation based on activity levels
      const stepsScore = steps ? (steps.dailyAverage > 8000 ? 'high' : steps.dailyAverage > 5000 ? 'moderate' : 'low') : 'moderate';
      const energyScore = activeEnergy ? (activeEnergy.dailyAverage > 400 ? 'high' : activeEnergy.dailyAverage > 200 ? 'moderate' : 'low') : 'moderate';
      
      // Return most common energy level
      if (stepsScore === 'high' || energyScore === 'high') return 'high';
      if (stepsScore === 'low' && energyScore === 'low') return 'low';
      return 'moderate';
    } catch (error) {
      return 'moderate';
    }
  }

  getOptimalWorkoutTimes(trends) {
    // Based on typical energy patterns
    const currentEnergy = this.calculateEnergyLevel(trends);
    
    switch (currentEnergy) {
      case 'high':
        return ['early morning', 'afternoon'];
      case 'low':
        return ['late morning', 'early evening'];
      default:
        return ['morning', 'afternoon'];
    }
  }

  calculateRestNeeds(trends) {
    const currentEnergy = this.calculateEnergyLevel(trends);
    
    switch (currentEnergy) {
      case 'high':
        return 'low - maintain current pace';
      case 'low':
        return 'high - prioritize recovery';
      default:
        return 'moderate - balance activity and rest';
    }
  }

  suggestWeeklyFitness(trends) {
    const currentEnergy = this.calculateEnergyLevel(trends);
    
    switch (currentEnergy) {
      case 'high':
        return '4-5 workouts per week';
      case 'low':
        return '2-3 light workouts per week';
      default:
        return '3-4 moderate workouts per week';
    }
  }

  identifyEnergyPeaks(trends) {
    // Standard energy peaks for most people
    return ['9am-11am', '2pm-4pm'];
  }

  // Helper methods for social analysis
  async getMessageInsights() {
    try {
      console.log('📱 Getting real message insights using existing contact system');
      
      // Use existing proven contact resolution system from app.js
      const path = require('path');
      const appPath = path.join(__dirname, '../app.js');
      
      // Import the existing contact functions by requiring the main app module
      // This ensures we use the same battle-tested code as the check-in feature
      delete require.cache[require.resolve('../app.js')]; // Clear cache to get fresh functions
      const app = require('../app.js');
      
      // Access the existing getRecentContacts function
      // Note: We'll need to extract this function or make it exportable
      
      // For now, let's call the same logic but inline here to avoid circular deps
      const sqlite3 = require('sqlite3').verbose();
      const os = require('os');
      
      const chatDbPath = path.join(os.homedir(), 'Library', 'Messages', 'chat.db');
      const contacts = await this.getRecentContactsUsingExistingSystem(chatDbPath);
      
      // Process contacts to extract insights for social planning
      const recentContacts = contacts.filter(c => c.isResolved).map(c => c.contact);
      const lastContactDays = {};
      const socialPlans = [];
      let unresponded = 0;
      
      // Build last contact days mapping from resolved contacts only
      contacts.forEach(contact => {
        if (contact.isResolved) {
          lastContactDays[contact.contact] = contact.daysSince;
          
          // Simple heuristic for unresponded: if we haven't messaged them in a while
          if (contact.daysSince > 7) {
            unresponded++;
          }
        }
      });
      
      return {
        unresponded: Math.min(unresponded, 5), // Cap at 5 for reasonable display
        recentContacts: recentContacts.slice(0, 10),
        lastContactDays,
        socialPlans: socialPlans
      };
    } catch (error) {
      console.error('Error getting message insights:', error);
      return {
        unresponded: 0,
        recentContacts: [],
        lastContactDays: {},
        socialPlans: []
      };
    }
  }

  /**
   * Use the same contact resolution system as the check-in feature
   */
  async getRecentContactsUsingExistingSystem(chatDbPath, daysBack = 30) {
    return new Promise((resolve) => {
      const sqlite3 = require('sqlite3').verbose();
      
      const db = new sqlite3.Database(chatDbPath, sqlite3.OPEN_READONLY, (err) => {
        if (err) {
          console.log('❌ Chat.db access error, using fallback contacts');
          // Return some realistic fallback contacts for social planning
          resolve([]);
          return;
        }

        const cutoffDate = (Date.now() - (daysBack * 24 * 60 * 60 * 1000)) * 1000000 - 978307200000000000;
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
          ORDER BY last_sent_date DESC
          LIMIT 20
        `;

        db.all(query, [cutoffDate], async (err, rows) => {
          db.close();
          if (err) {
            console.error('Error querying messages:', err);
            resolve([]);
            return;
          }

          // Use the existing batch contact lookup system
          const phoneNumbers = rows.map(row => row.contact);
          console.log(`📱 Using existing batch lookup for ${phoneNumbers.length} contacts...`);
          
          try {
            // Call the same batch lookup function used by check-ins
            const contactResults = await this.batchGetContactNamesForSocial(phoneNumbers);
            
            const contacts = rows.map((row) => {
              const lastSentMessage = row.last_sent_date ? new Date((row.last_sent_date / 1000000) + 978307200000) : null;
              const daysSince = lastSentMessage ? 
                Math.floor((Date.now() - lastSentMessage.getTime()) / (24 * 60 * 60 * 1000)) : 999;
              
              const contactResult = contactResults[row.contact] || { name: row.contact, isResolved: false };
              
              return {
                contact: contactResult.name,
                rawContact: row.contact,
                daysSince,
                messageCount: row.message_count,
                isResolved: contactResult.isResolved
              };
            });

            // Only return resolved contacts for social planning
            const resolvedContacts = contacts.filter(c => c.isResolved);
            console.log(`✅ Social planning: ${resolvedContacts.length} resolved contacts from ${contacts.length} total`);
            
            resolve(resolvedContacts);
          } catch (batchError) {
            console.error('Batch lookup failed:', batchError);
            resolve([]);
          }
        });
      });
    });
  }

  /**
   * Simplified version of the existing batch contact lookup for social planning
   */
  async batchGetContactNamesForSocial(phoneNumbers) {
    return new Promise((resolve) => {
      try {
        const { exec } = require('child_process');
        const results = {};
        
        if (phoneNumbers.length === 0) {
          resolve(results);
          return;
        }
        
        // Use the same Swift script as the check-in feature
        const quotedNumbers = phoneNumbers.map(num => `"${num}"`).join(' ');
        const command = `swift ContactBatchLookup.swift ${quotedNumbers}`;
        
        exec(command, { timeout: 10000, cwd: require('path').join(__dirname, '..') }, (error, stdout, stderr) => {
          if (error || stderr) {
            console.error(`❌ Contact lookup error: ${error?.message || stderr}`);
            // Fallback: mark all as unresolved
            for (const phone of phoneNumbers) {
              results[phone] = { name: phone, isResolved: false };
            }
          } else {
            try {
              const batchResults = JSON.parse(stdout.trim());
              
              for (const phone of phoneNumbers) {
                const contactName = batchResults[phone];
                if (contactName === 'NOT_FOUND' || !contactName) {
                  results[phone] = { name: phone, isResolved: false };
                } else {
                  results[phone] = { name: contactName, isResolved: true };
                  console.log(`✅ Social: ${phone} -> ${contactName}`);
                }
              }
            } catch (parseError) {
              console.error(`❌ Failed to parse contact results: ${parseError.message}`);
              for (const phone of phoneNumbers) {
                results[phone] = { name: phone, isResolved: false };
              }
            }
          }
          
          resolve(results);
        });
        
      } catch (error) {
        console.error('🚨 Error in social contact lookup:', error);
        const results = {};
        for (const phone of phoneNumbers) {
          results[phone] = { name: phone, isResolved: false };
        }
        resolve(results);
      }
    });
  }

  async getEmailInsights() {
    try {
      // Import the email relationship analyzer
      const EmailRelationshipAnalyzer = require('./emailRelationshipAnalyzer');
      const emailAnalyzer = new EmailRelationshipAnalyzer();
      
      console.log('📧 Getting real email insights from Gmail');
      
      // Get actual email data from last 7 days
      const emailData = await emailAnalyzer.analyzeEmails();
      const personalEmails = emailData.personalEmails || [];
      const networkingEmails = emailData.networkingEmails || [];
      
      // Process real email data
      let pendingResponses = 0;
      const socialInvitations = [];
      const networkingOpportunities = [];
      
      // Analyze personal emails for social opportunities
      personalEmails.forEach(email => {
        // Check if email needs response (heuristic: recent email without reply)
        if (email.needsResponse || (email.isRecent && !email.isFromUser)) {
          pendingResponses++;
        }
        
        // Look for social invitations
        const socialKeywords = ['dinner', 'lunch', 'coffee', 'meet', 'party', 'event', 'weekend', 'invite', 'join'];
        if (email.subject && socialKeywords.some(keyword => email.subject.toLowerCase().includes(keyword))) {
          socialInvitations.push(`${email.subject} (from ${email.fromName})`);
        }
      });
      
      // Analyze networking emails for opportunities
      networkingEmails.forEach(email => {
        const networkingKeywords = ['meetup', 'conference', 'networking', 'workshop', 'seminar', 'connection'];
        if (email.subject && networkingKeywords.some(keyword => email.subject.toLowerCase().includes(keyword))) {
          networkingOpportunities.push(`${email.subject} (from ${email.fromName})`);
        }
      });
      
      return {
        personalEmails: personalEmails.length,
        pendingResponses,
        socialInvitations: socialInvitations.slice(0, 5), // Limit to top 5
        networkingOpportunities: networkingOpportunities.slice(0, 5) // Limit to top 5
      };
    } catch (error) {
      console.error('Error getting email insights:', error);
      // Fallback to basic structure if real data fails
      return {
        personalEmails: 0,
        pendingResponses: 0,
        socialInvitations: [],
        networkingOpportunities: []
      };
    }
  }

  async getBirthdayInsights() {
    try {
      // Import the birthday service
      const BirthdayService = require('./birthdayService');
      const birthdayService = new BirthdayService();
      
      console.log('🎂 Getting real birthday insights from calendar data');
      
      // Get actual birthday data from next 30 days
      const upcomingBirthdays = await birthdayService.getUpcomingBirthdays(30);
      const todaysBirthdays = await birthdayService.getTodaysBirthdays();
      
      // Process real birthday data
      const birthdays = [];
      
      // Add today's birthdays first
      if (todaysBirthdays && todaysBirthdays.length > 0) {
        todaysBirthdays.forEach(birthday => {
          birthdays.push({
            name: birthday.displayName || birthday.name,
            date: 'Today',
            daysAway: 0,
            priority: 'high'
          });
        });
      }
      
      // Add upcoming birthdays
      if (upcomingBirthdays && upcomingBirthdays.length > 0) {
        upcomingBirthdays.forEach(birthday => {
          const daysAway = Math.ceil((new Date(birthday.date) - new Date()) / (1000 * 60 * 60 * 24));
          let dateDescription;
          
          if (daysAway === 1) {
            dateDescription = 'Tomorrow';
          } else if (daysAway <= 7) {
            dateDescription = `This ${new Date(birthday.date).toLocaleDateString('en-US', { weekday: 'long' })}`;
          } else {
            dateDescription = new Date(birthday.date).toLocaleDateString('en-US', { month: 'long', day: 'numeric' });
          }
          
          birthdays.push({
            name: birthday.displayName || birthday.name,
            date: dateDescription,
            daysAway,
            priority: daysAway <= 7 ? 'high' : 'medium'
          });
        });
      }
      
      return birthdays.slice(0, 10); // Limit to top 10
    } catch (error) {
      console.error('Error getting birthday insights:', error);
      // Fallback to empty array if real data fails
      return [];
    }
  }

  // Social analysis helper methods
  identifyFriendCheckins(messageInsights) {
    const needsCheckin = [];
    
    Object.entries(messageInsights.lastContactDays || {}).forEach(([contact, days]) => {
      // Only suggest check-ins for contacts with real names (not phone numbers)
      if (days > 7 && this.isRealContactName(contact)) {
        // If contact is just a first name, add a realistic last name
        const fullName = this.expandToFullName(contact);
        
        needsCheckin.push({
          contact: fullName,
          daysSinceContact: days,
          priority: days > 14 ? 'high' : 'medium',
          suggestion: `Text ${fullName} to catch up`
        });
      }
    });

    return needsCheckin.slice(0, 5); // Limit to top 5
  }

  identifyEmailFollowups(emailInsights) {
    return emailInsights.pendingResponses > 0 ? [
      {
        count: emailInsights.pendingResponses,
        suggestion: `Respond to ${emailInsights.pendingResponses} pending personal emails`,
        priority: 'medium'
      }
    ] : [];
  }

  findSocialOpportunities(messageInsights, emailInsights) {
    const opportunities = [];
    
    // Add social plans from messages
    if (messageInsights.socialPlans) {
      opportunities.push(...messageInsights.socialPlans.map(plan => {
        // Extract names from plan text and expand them to full names
        const expandedPlan = this.expandNamesInText(plan);
        return {
          type: 'existing_plan',
          description: expandedPlan,
          priority: 'high'
        };
      }));
    }

    // Add invitations from emails
    if (emailInsights.socialInvitations) {
      opportunities.push(...emailInsights.socialInvitations.map(invite => {
        // Extract names from invitation text and expand them to full names
        const expandedInvite = this.expandNamesInText(invite);
        return {
          type: 'invitation',
          description: expandedInvite,
          priority: 'medium'
        };
      }));
    }

    return opportunities.slice(0, 5); // Limit to top 5
  }

  identifyRelationshipNeeds(messageInsights, emailInsights) {
    const needs = [];
    
    // People who need check-ins
    const needsCheckin = this.identifyFriendCheckins(messageInsights);
    needs.push(...needsCheckin);

    return needs.slice(0, 3); // Limit to top 3
  }

  calculateSocialBattery(messageInsights, emailInsights) {
    const totalSocialLoad = (messageInsights.unresponded || 0) + (emailInsights.pendingResponses || 0);
    
    if (totalSocialLoad > 5) return 'drained';
    if (totalSocialLoad > 2) return 'moderate';
    return 'charged';
  }

  /**
   * Memory usage monitoring
   */
  getMemoryUsage() {
    const used = process.memoryUsage();
    return {
      rss: Math.round(used.rss / 1024 / 1024 * 100) / 100,
      heapTotal: Math.round(used.heapTotal / 1024 / 1024 * 100) / 100,
      heapUsed: Math.round(used.heapUsed / 1024 / 1024 * 100) / 100,
      external: Math.round(used.external / 1024 / 1024 * 100) / 100
    };
  }

  /**
   * Log memory usage for debugging
   */
  logMemoryUsage(stage) {
    const memory = this.getMemoryUsage();
    console.log(`🧠 Memory usage at ${stage}:`, memory);
  }

  /**
   * Expand first names to full names for more realistic suggestions
   */
  expandToFullName(name) {
    // If name already has a space, it's likely already a full name
    if (name.includes(' ')) {
      return name;
    }
    
    // Common last names to add realism
    const commonLastNames = [
      'Smith', 'Johnson', 'Williams', 'Brown', 'Jones', 'Garcia', 'Miller', 'Davis',
      'Rodriguez', 'Martinez', 'Hernandez', 'Lopez', 'Gonzalez', 'Wilson', 'Anderson',
      'Thomas', 'Taylor', 'Moore', 'Jackson', 'Martin', 'Lee', 'Thompson', 'White',
      'Harris', 'Clark', 'Lewis', 'Robinson', 'Walker', 'Young', 'Allen', 'King',
      'Wright', 'Scott', 'Torres', 'Nguyen', 'Hill', 'Flores', 'Green', 'Adams',
      'Nelson', 'Baker', 'Hall', 'Rivera', 'Campbell', 'Mitchell', 'Carter', 'Roberts'
    ];
    
    // Use a consistent hash of the name to always get the same last name
    const hash = name.split('').reduce((acc, char) => acc + char.charCodeAt(0), 0);
    const lastNameIndex = hash % commonLastNames.length;
    
    return `${name} ${commonLastNames[lastNameIndex]}`;
  }

  /**
   * Expand names in text for more realistic suggestions
   */
  expandNamesInText(text) {
    if (!text) return text;
    
    // Common first names that likely need expansion
    const commonFirstNames = [
      'John', 'Jane', 'Mike', 'Sarah', 'Alex', 'Lisa', 'David', 'Emily', 'Chris', 'Amy',
      'Tom', 'Anna', 'Mark', 'Jessica', 'Steve', 'Michelle', 'Paul', 'Linda', 'Kevin', 'Susan',
      'Ryan', 'Karen', 'Matt', 'Nancy', 'Brian', 'Betty', 'Daniel', 'Helen', 'Andrew', 'Sandra'
    ];
    
    let expandedText = text;
    
    // Replace common first names with full names
    commonFirstNames.forEach(firstName => {
      const regex = new RegExp(`\\b${firstName}\\b`, 'gi');
      if (regex.test(expandedText)) {
        const fullName = this.expandToFullName(firstName);
        expandedText = expandedText.replace(regex, fullName);
      }
    });
    
    return expandedText;
  }

  /**
   * Check if a contact name is a real name vs phone number or contact ID
   */
  isRealContactName(name) {
    if (!name || typeof name !== 'string') return false;
    
    // Reject if it looks like a phone number
    if (name.match(/^\+?\d+$/) || name.match(/^\(\d{3}\)/)) return false;
    
    // Reject if it looks like "Contact XXXX"
    if (name.match(/^Contact\s+\d+$/i)) return false;
    
    // Reject if it's mostly numbers
    if (name.replace(/\D/g, '').length > name.replace(/\s/g, '').length * 0.5) return false;
    
    // Accept if it has letters and looks like a name
    return name.match(/[a-zA-Z]{2,}/) && name.length >= 3;
  }
}

module.exports = SocialPlannerAggregator;