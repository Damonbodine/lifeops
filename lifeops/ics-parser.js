const fs = require('fs');
const sqlite3 = require('sqlite3').verbose();

// Create/connect to SQLite database
const db = new sqlite3.Database('./birthdays.db');

// Create birthdays table
db.serialize(() => {
    db.run(`CREATE TABLE IF NOT EXISTS birthdays (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        name TEXT NOT NULL,
        facebook_id TEXT,
        birth_month INTEGER NOT NULL,
        birth_day INTEGER NOT NULL,
        facebook_url TEXT,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    )`);
});

function parseICSFile(filePath) {
    console.log('🎂 Parsing birthday calendar...');
    
    const content = fs.readFileSync(filePath, 'utf8');
    const lines = content.split('\n');
    
    let currentEvent = {};
    let events = [];
    let inEvent = false;
    
    for (let line of lines) {
        line = line.trim();
        
        if (line === 'BEGIN:VEVENT') {
            inEvent = true;
            currentEvent = {};
        } else if (line === 'END:VEVENT') {
            if (currentEvent.name && currentEvent.date) {
                events.push(currentEvent);
            }
            inEvent = false;
        } else if (inEvent) {
            // Parse date
            if (line.startsWith('DTSTART;VALUE=DATE:')) {
                const dateStr = line.replace('DTSTART;VALUE=DATE:', '');
                const month = parseInt(dateStr.substring(4, 6));
                const day = parseInt(dateStr.substring(6, 8));
                currentEvent.date = { month, day };
            }
            
            // Parse name from summary
            if (line.startsWith('SUMMARY:🎂 ')) {
                currentEvent.name = line.replace('SUMMARY:🎂 ', '');
            }
            
            // Parse Facebook URL from description
            if (line.startsWith('DESCRIPTION:')) {
                const match = line.match(/href='([^']+)'/);
                if (match) {
                    currentEvent.facebookUrl = match[1];
                    // Extract Facebook ID from URL
                    const idMatch = match[1].match(/facebook\.com\/(.+)$/);
                    if (idMatch) {
                        currentEvent.facebookId = idMatch[1];
                    }
                }
            }
        }
    }
    
    console.log(`📊 Found ${events.length} birthdays`);
    return events;
}

function saveBirthdaysToDatabase(events) {
    console.log('💾 Saving birthdays to database...');
    
    // Clear existing data
    db.run('DELETE FROM birthdays');
    
    const stmt = db.prepare(`
        INSERT INTO birthdays (name, facebook_id, birth_month, birth_day, facebook_url) 
        VALUES (?, ?, ?, ?, ?)
    `);
    
    events.forEach(event => {
        stmt.run(
            event.name,
            event.facebookId || null,
            event.date.month,
            event.date.day,
            event.facebookUrl || null
        );
    });
    
    stmt.finalize();
    console.log('✅ Birthdays saved successfully!');
}

function getBirthdaysForDateRange(startDate, endDate) {
    return new Promise((resolve, reject) => {
        const query = `
            SELECT * FROM birthdays 
            WHERE (birth_month = ? AND birth_day >= ?) 
               OR (birth_month > ? AND birth_month < ?)
               OR (birth_month = ? AND birth_day <= ?)
            ORDER BY birth_month, birth_day
        `;
        
        const startMonth = startDate.getMonth() + 1;
        const startDay = startDate.getDate();
        const endMonth = endDate.getMonth() + 1;
        const endDay = endDate.getDate();
        
        db.all(query, [
            startMonth, startDay,
            startMonth, endMonth,
            endMonth, endDay
        ], (err, rows) => {
            if (err) reject(err);
            else resolve(rows);
        });
    });
}

function getTodaysBirthdays() {
    return new Promise((resolve, reject) => {
        const today = new Date();
        const month = today.getMonth() + 1;
        const day = today.getDate();
        
        db.all(
            'SELECT * FROM birthdays WHERE birth_month = ? AND birth_day = ?',
            [month, day],
            (err, rows) => {
                if (err) reject(err);
                else resolve(rows);
            }
        );
    });
}

function getUpcomingBirthdays(days = 30) {
    return new Promise((resolve, reject) => {
        const today = new Date();
        const endDate = new Date();
        endDate.setDate(today.getDate() + days);
        
        getBirthdaysForDateRange(today, endDate)
            .then(resolve)
            .catch(reject);
    });
}

// Main execution
if (require.main === module) {
    const icsFilePath = './birthday-calendar.ics';
    
    if (fs.existsSync(icsFilePath)) {
        const events = parseICSFile(icsFilePath);
        saveBirthdaysToDatabase(events);
        
        // Test queries
        setTimeout(() => {
            getTodaysBirthdays().then(birthdays => {
                console.log(`🎉 Today's birthdays: ${birthdays.length}`);
                birthdays.forEach(b => console.log(`  - ${b.name}`));
            });
            
            getUpcomingBirthdays(7).then(birthdays => {
                console.log(`📅 Upcoming birthdays (next 7 days): ${birthdays.length}`);
                birthdays.forEach(b => console.log(`  - ${b.name} (${b.birth_month}/${b.birth_day})`));
            });
            
            db.close();
        }, 1000);
    } else {
        console.error('❌ ICS file not found:', icsFilePath);
    }
}

module.exports = {
    parseICSFile,
    saveBirthdaysToDatabase,
    getBirthdaysForDateRange,
    getTodaysBirthdays,
    getUpcomingBirthdays
};