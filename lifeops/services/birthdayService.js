const sqlite3 = require('sqlite3').verbose();
const path = require('path');

/**
 * Service for accessing birthday data
 * Based on your existing ics-parser.js functionality
 */
class BirthdayService {
  constructor() {
    this.dbPath = path.join(__dirname, '../birthdays.db');
  }

  /**
   * Get today's birthdays
   */
  async getTodaysBirthdays() {
    return new Promise((resolve, reject) => {
      const db = new sqlite3.Database(this.dbPath, sqlite3.OPEN_READONLY, (err) => {
        if (err) {
          console.error('❌ Error accessing birthdays.db:', err.message);
          resolve([]); // Return empty array instead of rejecting
          return;
        }

        const today = new Date();
        const month = today.getMonth() + 1;
        const day = today.getDate();
        
        db.all(
          'SELECT * FROM birthdays WHERE birth_month = ? AND birth_day = ?',
          [month, day],
          (err, rows) => {
            db.close();
            if (err) {
              console.error('❌ Error getting today\'s birthdays:', err);
              resolve([]);
            } else {
              // Process results to match expected format
              const birthdays = (rows || []).map(row => ({
                name: row.name,
                displayName: row.name,
                date: new Date(today.getFullYear(), month - 1, day),
                month: row.birth_month,
                day: row.birth_day,
                facebookId: row.facebook_id,
                facebookUrl: row.facebook_url
              }));
              resolve(birthdays);
            }
          }
        );
      });
    });
  }

  /**
   * Get upcoming birthdays within N days
   */
  async getUpcomingBirthdays(days = 30) {
    return new Promise((resolve, reject) => {
      const db = new sqlite3.Database(this.dbPath, sqlite3.OPEN_READONLY, (err) => {
        if (err) {
          console.error('❌ Error accessing birthdays.db:', err.message);
          resolve([]); // Return empty array instead of rejecting
          return;
        }

        // Get all birthdays and filter them in JavaScript for simplicity
        db.all('SELECT * FROM birthdays ORDER BY birth_month, birth_day', (err, rows) => {
          db.close();
          if (err) {
            console.error('❌ Error getting upcoming birthdays:', err);
            resolve([]);
            return;
          }

          const today = new Date();
          const endDate = new Date();
          endDate.setDate(today.getDate() + days);
          
          const upcomingBirthdays = [];
          
          (rows || []).forEach(row => {
            // Calculate this year's birthday
            const thisYearBirthday = new Date(today.getFullYear(), row.birth_month - 1, row.birth_day);
            
            // If this year's birthday has passed, check next year's
            let birthdayToCheck = thisYearBirthday;
            if (thisYearBirthday < today) {
              birthdayToCheck = new Date(today.getFullYear() + 1, row.birth_month - 1, row.birth_day);
            }
            
            // Check if birthday falls within the date range
            if (birthdayToCheck >= today && birthdayToCheck <= endDate) {
              upcomingBirthdays.push({
                name: row.name,
                displayName: row.name,
                date: birthdayToCheck,
                month: row.birth_month,
                day: row.birth_day,
                facebookId: row.facebook_id,
                facebookUrl: row.facebook_url,
                daysAway: Math.ceil((birthdayToCheck - today) / (1000 * 60 * 60 * 24))
              });
            }
          });
          
          // Sort by date
          upcomingBirthdays.sort((a, b) => a.date - b.date);
          
          resolve(upcomingBirthdays);
        });
      });
    });
  }

  /**
   * Get birthdays for a specific date range
   */
  async getBirthdaysForDateRange(startDate, endDate) {
    return new Promise((resolve, reject) => {
      const db = new sqlite3.Database(this.dbPath, sqlite3.OPEN_READONLY, (err) => {
        if (err) {
          console.error('❌ Error accessing birthdays.db:', err.message);
          resolve([]);
          return;
        }

        // For simplicity, get all birthdays and filter in JavaScript
        db.all('SELECT * FROM birthdays ORDER BY birth_month, birth_day', (err, rows) => {
          db.close();
          if (err) {
            console.error('❌ Error getting birthdays for date range:', err);
            resolve([]);
            return;
          }

          const birthdays = [];
          
          (rows || []).forEach(row => {
            // Check both this year and next year
            for (let year of [startDate.getFullYear(), startDate.getFullYear() + 1]) {
              const birthday = new Date(year, row.birth_month - 1, row.birth_day);
              
              if (birthday >= startDate && birthday <= endDate) {
                birthdays.push({
                  name: row.name,
                  displayName: row.name,
                  date: birthday,
                  month: row.birth_month,
                  day: row.birth_day,
                  facebookId: row.facebook_id,
                  facebookUrl: row.facebook_url
                });
              }
            }
          });
          
          // Sort by date
          birthdays.sort((a, b) => a.date - b.date);
          
          resolve(birthdays);
        });
      });
    });
  }

  /**
   * Search for birthdays by name
   */
  async searchBirthdaysByName(searchTerm) {
    return new Promise((resolve, reject) => {
      const db = new sqlite3.Database(this.dbPath, sqlite3.OPEN_READONLY, (err) => {
        if (err) {
          console.error('❌ Error accessing birthdays.db:', err.message);
          resolve([]);
          return;
        }

        db.all(
          'SELECT * FROM birthdays WHERE name LIKE ? ORDER BY birth_month, birth_day',
          [`%${searchTerm}%`],
          (err, rows) => {
            db.close();
            if (err) {
              console.error('❌ Error searching birthdays:', err);
              resolve([]);
            } else {
              const birthdays = (rows || []).map(row => ({
                name: row.name,
                displayName: row.name,
                month: row.birth_month,
                day: row.birth_day,
                facebookId: row.facebook_id,
                facebookUrl: row.facebook_url
              }));
              resolve(birthdays);
            }
          }
        );
      });
    });
  }

  /**
   * Get birthday statistics
   */
  async getBirthdayStats() {
    return new Promise((resolve, reject) => {
      const db = new sqlite3.Database(this.dbPath, sqlite3.OPEN_READONLY, (err) => {
        if (err) {
          console.error('❌ Error accessing birthdays.db:', err.message);
          resolve({});
          return;
        }

        db.get('SELECT COUNT(*) as total FROM birthdays', (err, row) => {
          if (err) {
            db.close();
            console.error('❌ Error getting birthday stats:', err);
            resolve({});
            return;
          }

          // Get monthly distribution
          db.all(
            'SELECT birth_month, COUNT(*) as count FROM birthdays GROUP BY birth_month ORDER BY birth_month',
            (err, monthlyRows) => {
              db.close();
              if (err) {
                console.error('❌ Error getting monthly birthday stats:', err);
                resolve({ total: row.total });
              } else {
                const monthlyDistribution = {};
                (monthlyRows || []).forEach(monthRow => {
                  monthlyDistribution[monthRow.birth_month] = monthRow.count;
                });

                resolve({
                  total: row.total,
                  monthlyDistribution
                });
              }
            }
          );
        });
      });
    });
  }
}

module.exports = BirthdayService;