const fs = require('fs').promises;
const { exec } = require('child_process');
const path = require('path');

class HealthDataParserSimple {
  constructor() {
    this.recentDataFile = null;
  }

  async parseRecentHealthData(exportPath, startYear = 2024) {
    try {
      console.log(`📊 Extracting ${startYear}-2025 health data for better analysis...`);
      
      // Create a filtered file with multi-year data for better insights
      const exportFile = path.join(exportPath, 'export.xml');
      const recentFile = path.join(exportPath, `export_${startYear}_2025.xml`);
      
      // Check if recent file already exists
      try {
        const stats = await fs.stat(recentFile);
        if (stats.size > 10000) { // Increased size check for multi-year data
          console.log(`Using existing ${startYear}-2025 data file...`);
          return await this.parseFilteredFile(recentFile);
        }
      } catch (err) {
        // File doesn't exist, need to create it
      }

      // Extract header and recent records from multiple years
      await this.createMultiYearDataFile(exportFile, recentFile, startYear);
      return await this.parseFilteredFile(recentFile);
      
    } catch (error) {
      console.error('Error parsing recent health data:', error);
      throw error;
    }
  }

  async createMultiYearDataFile(sourceFile, targetFile, startYear) {
    return new Promise((resolve, reject) => {
      // Get last 6 months of data for better analysis without memory issues
      const sixMonthsAgo = new Date();
      sixMonthsAgo.setMonth(sixMonthsAgo.getMonth() - 6);
      const yearMonth = `${sixMonthsAgo.getFullYear()}-${String(sixMonthsAgo.getMonth() + 1).padStart(2, '0')}`;
      
      console.log(`Creating filtered file with data from ${yearMonth} onwards...`);
      
      const commands = [
        // Get XML header
        `head -20 "${sourceFile}" > "${targetFile}"`,
        // Add records from last 6 months for better analysis
        `grep -E 'startDate="(2024-0[7-9]|2024-1[0-2]|2025)' "${sourceFile}" >> "${targetFile}"`,
        // Add closing tag
        `echo '</HealthData>' >> "${targetFile}"`
      ];

      let completed = 0;
      
      commands.forEach((cmd, index) => {
        exec(cmd, (error, stdout, stderr) => {
          if (error && index !== 1) { // grep might not find matches, that's ok
            reject(error);
            return;
          }
          
          completed++;
          if (completed === commands.length) {
            console.log(`✅ Created filtered health data file for last 6 months`);
            resolve();
          }
        });
      });
    });
  }

  async createRecentDataFile(sourceFile, targetFile, year) {
    return new Promise((resolve, reject) => {
      const commands = [
        // Get XML header
        `head -20 "${sourceFile}" > "${targetFile}"`,
        // Add recent records
        `grep 'startDate="${year}' "${sourceFile}" >> "${targetFile}"`,
        // Add closing tag
        `echo '</HealthData>' >> "${targetFile}"`
      ];

      let completed = 0;
      
      commands.forEach((cmd, index) => {
        exec(cmd, (error, stdout, stderr) => {
          if (error && index !== 1) { // grep might not find matches, that's ok
            reject(error);
            return;
          }
          
          completed++;
          if (completed === commands.length) {
            console.log(`✅ Created filtered health data file for ${year}`);
            resolve();
          }
        });
      });
    });
  }

  async parseFilteredFile(filePath) {
    try {
      const content = await fs.readFile(filePath, 'utf8');
      
      // Simple regex parsing instead of full XML parsing
      const records = {
        heartRate: this.extractRecords(content, 'HKQuantityTypeIdentifierHeartRate'),
        steps: this.extractRecords(content, 'HKQuantityTypeIdentifierStepCount'),
        activeEnergy: this.extractRecords(content, 'HKQuantityTypeIdentifierActiveEnergyBurned'),
        basalEnergy: this.extractRecords(content, 'HKQuantityTypeIdentifierBasalEnergyBurned'),
        walkingDistance: this.extractRecords(content, 'HKQuantityTypeIdentifierDistanceWalkingRunning'),
        sleepAnalysis: this.extractRecords(content, 'HKCategoryTypeIdentifierSleepAnalysis'),
        hrv: this.extractRecords(content, 'HKQuantityTypeIdentifierHeartRateVariabilitySDNN'),
        respiratoryRate: this.extractRecords(content, 'HKQuantityTypeIdentifierRespiratoryRate'),
        physicalEffort: this.extractRecords(content, 'HKQuantityTypeIdentifierPhysicalEffort'),
        walkingSpeed: this.extractRecords(content, 'HKQuantityTypeIdentifierWalkingSpeed'),
        flightsClimbed: this.extractRecords(content, 'HKQuantityTypeIdentifierFlightsClimbed'),
        timeInDaylight: this.extractRecords(content, 'HKQuantityTypeIdentifierTimeInDaylight')
      };

      // Extract basic info
      const exportDateMatch = content.match(/<ExportDate value="([^"]+)"/);
      const exportDate = exportDateMatch ? exportDateMatch[1] : new Date().toISOString();

      // Count total records
      const totalRecords = Object.values(records).reduce((sum, arr) => sum + arr.length, 0);
      
      console.log(`📈 Parsed ${totalRecords} recent health records`);
      
      return {
        exportDate,
        me: this.extractMe(content),
        records,
        workouts: this.extractWorkouts(content),
        sleepAnalysis: records.sleepAnalysis
      };
      
    } catch (error) {
      console.error('Error parsing filtered file:', error);
      throw error;
    }
  }

  extractRecords(content, type) {
    const pattern = new RegExp(`<Record[^>]+type="${type}"[^>]*>`, 'g');
    const matches = content.match(pattern) || [];
    
    return matches.map(match => {
      const value = match.match(/value="([^"]+)"/);
      const unit = match.match(/unit="([^"]+)"/);
      const startDate = match.match(/startDate="([^"]+)"/);
      const endDate = match.match(/endDate="([^"]+)"/);
      const sourceName = match.match(/sourceName="([^"]+)"/);
      
      return {
        value: value ? (type.includes('Sleep') ? value[1] : parseFloat(value[1])) : 0,
        unit: unit ? unit[1] : '',
        startDate: startDate ? new Date(startDate[1]) : new Date(),
        endDate: endDate ? new Date(endDate[1]) : new Date(),
        sourceName: sourceName ? sourceName[1] : 'Apple Health'
      };
    }).filter(record => !isNaN(record.startDate.getTime())); // Filter invalid dates
  }

  extractMe(content) {
    const meMatch = content.match(/<Me[^>]+>/);
    if (!meMatch) return {};
    
    const meText = meMatch[0];
    return {
      dateOfBirth: this.extractAttribute(meText, 'HKCharacteristicTypeIdentifierDateOfBirth'),
      biologicalSex: this.extractAttribute(meText, 'HKCharacteristicTypeIdentifierBiologicalSex'),
      bloodType: this.extractAttribute(meText, 'HKCharacteristicTypeIdentifierBloodType'),
      fitzpatrickSkinType: this.extractAttribute(meText, 'HKCharacteristicTypeIdentifierFitzpatrickSkinType')
    };
  }

  extractWorkouts(content) {
    const pattern = /<Workout[^>]*>/g;
    const matches = content.match(pattern) || [];
    
    return matches.slice(-50).map(match => { // Last 50 workouts
      return {
        activityType: this.extractAttribute(match, 'workoutActivityType'),
        duration: parseFloat(this.extractAttribute(match, 'duration')) || 0,
        durationUnit: this.extractAttribute(match, 'durationUnit'),
        totalDistance: parseFloat(this.extractAttribute(match, 'totalDistance')) || 0,
        totalDistanceUnit: this.extractAttribute(match, 'totalDistanceUnit'),
        totalEnergyBurned: parseFloat(this.extractAttribute(match, 'totalEnergyBurned')) || 0,
        totalEnergyBurnedUnit: this.extractAttribute(match, 'totalEnergyBurnedUnit'),
        sourceName: this.extractAttribute(match, 'sourceName'),
        startDate: new Date(this.extractAttribute(match, 'startDate')),
        endDate: new Date(this.extractAttribute(match, 'endDate'))
      };
    }).filter(workout => !isNaN(workout.startDate.getTime()));
  }

  extractAttribute(text, attr) {
    const match = text.match(new RegExp(`${attr}="([^"]+)"`));
    return match ? match[1] : '';
  }

  // Utility methods for analytics
  aggregateDailyMetrics(records) {
    const dailyMetrics = {};
    
    Object.keys(records).forEach(metricType => {
      records[metricType].forEach(record => {
        const dateKey = record.startDate.toISOString().split('T')[0];
        
        if (!dailyMetrics[dateKey]) {
          dailyMetrics[dateKey] = {};
        }
        
        if (!dailyMetrics[dateKey][metricType]) {
          dailyMetrics[dateKey][metricType] = [];
        }
        
        dailyMetrics[dateKey][metricType].push(record.value);
      });
    });

    // Calculate aggregates
    Object.keys(dailyMetrics).forEach(date => {
      Object.keys(dailyMetrics[date]).forEach(metricType => {
        const values = dailyMetrics[date][metricType];
        dailyMetrics[date][metricType] = {
          sum: values.reduce((a, b) => a + b, 0),
          avg: values.reduce((a, b) => a + b, 0) / values.length,
          min: Math.min(...values),
          max: Math.max(...values),
          count: values.length
        };
      });
    });

    return dailyMetrics;
  }

  getRecentTrends(records, days = 30) {
    const cutoffDate = new Date();
    cutoffDate.setDate(cutoffDate.getDate() - days);
    
    const recentData = {};
    
    Object.keys(records).forEach(metricType => {
      recentData[metricType] = records[metricType].filter(
        record => record.startDate >= cutoffDate
      );
    });
    
    return recentData;
  }
}

module.exports = HealthDataParserSimple;