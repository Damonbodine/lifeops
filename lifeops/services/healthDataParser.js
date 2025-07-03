const fs = require('fs').promises;
const xml2js = require('xml2js');
const path = require('path');

class HealthDataParser {
  constructor() {
    this.parser = new xml2js.Parser();
  }

  async parseHealthExport(exportPath) {
    try {
      const xmlData = await fs.readFile(path.join(exportPath, 'export.xml'), 'utf8');
      const result = await this.parser.parseStringPromise(xmlData);
      
      return {
        exportDate: result.HealthData.ExportDate[0].$.value,
        me: this.parseMe(result.HealthData.Me[0].$),
        records: this.parseRecords(result.HealthData.Record || []),
        workouts: this.parseWorkouts(result.HealthData.Workout || []),
        sleepAnalysis: this.parseSleepAnalysis(result.HealthData.Record || [])
      };
    } catch (error) {
      console.error('Error parsing health data:', error);
      throw error;
    }
  }

  parseMe(meData) {
    return {
      dateOfBirth: meData.HKCharacteristicTypeIdentifierDateOfBirth,
      biologicalSex: meData.HKCharacteristicTypeIdentifierBiologicalSex,
      bloodType: meData.HKCharacteristicTypeIdentifierBloodType,
      fitzpatrickSkinType: meData.HKCharacteristicTypeIdentifierFitzpatrickSkinType
    };
  }

  parseRecords(records) {
    const categorizedRecords = {
      heartRate: [],
      steps: [],
      activeEnergy: [],
      basalEnergy: [],
      walkingDistance: [],
      sleepAnalysis: [],
      hrv: [],
      respiratoryRate: [],
      physicalEffort: [],
      walkingSpeed: [],
      flightsClimbed: [],
      timeInDaylight: []
    };

    records.forEach(record => {
      const type = record.$.type;
      const data = {
        value: parseFloat(record.$.value),
        unit: record.$.unit,
        sourceName: record.$.sourceName,
        startDate: new Date(record.$.startDate),
        endDate: new Date(record.$.endDate),
        creationDate: new Date(record.$.creationDate)
      };

      switch (type) {
        case 'HKQuantityTypeIdentifierHeartRate':
          categorizedRecords.heartRate.push(data);
          break;
        case 'HKQuantityTypeIdentifierStepCount':
          categorizedRecords.steps.push(data);
          break;
        case 'HKQuantityTypeIdentifierActiveEnergyBurned':
          categorizedRecords.activeEnergy.push(data);
          break;
        case 'HKQuantityTypeIdentifierBasalEnergyBurned':
          categorizedRecords.basalEnergy.push(data);
          break;
        case 'HKQuantityTypeIdentifierDistanceWalkingRunning':
          categorizedRecords.walkingDistance.push(data);
          break;
        case 'HKCategoryTypeIdentifierSleepAnalysis':
          categorizedRecords.sleepAnalysis.push({
            ...data,
            value: record.$.value
          });
          break;
        case 'HKQuantityTypeIdentifierHeartRateVariabilitySDNN':
          categorizedRecords.hrv.push(data);
          break;
        case 'HKQuantityTypeIdentifierRespiratoryRate':
          categorizedRecords.respiratoryRate.push(data);
          break;
        case 'HKQuantityTypeIdentifierPhysicalEffort':
          categorizedRecords.physicalEffort.push(data);
          break;
        case 'HKQuantityTypeIdentifierWalkingSpeed':
          categorizedRecords.walkingSpeed.push(data);
          break;
        case 'HKQuantityTypeIdentifierFlightsClimbed':
          categorizedRecords.flightsClimbed.push(data);
          break;
        case 'HKQuantityTypeIdentifierTimeInDaylight':
          categorizedRecords.timeInDaylight.push(data);
          break;
      }
    });

    return categorizedRecords;
  }

  parseWorkouts(workouts) {
    return workouts.map(workout => ({
      activityType: workout.$.workoutActivityType,
      duration: parseFloat(workout.$.duration),
      durationUnit: workout.$.durationUnit,
      totalDistance: parseFloat(workout.$.totalDistance),
      totalDistanceUnit: workout.$.totalDistanceUnit,
      totalEnergyBurned: parseFloat(workout.$.totalEnergyBurned),
      totalEnergyBurnedUnit: workout.$.totalEnergyBurnedUnit,
      sourceName: workout.$.sourceName,
      startDate: new Date(workout.$.startDate),
      endDate: new Date(workout.$.endDate),
      creationDate: new Date(workout.$.creationDate)
    }));
  }

  parseSleepAnalysis(records) {
    return records
      .filter(record => record.$.type === 'HKCategoryTypeIdentifierSleepAnalysis')
      .map(record => ({
        value: record.$.value,
        startDate: new Date(record.$.startDate),
        endDate: new Date(record.$.endDate),
        sourceName: record.$.sourceName
      }));
  }

  async parseECGData(exportPath) {
    try {
      const ecgDir = path.join(exportPath, 'electrocardiograms');
      const files = await fs.readdir(ecgDir);
      const ecgFiles = files.filter(file => file.endsWith('.csv'));
      
      const ecgData = [];
      for (const file of ecgFiles) {
        const filePath = path.join(ecgDir, file);
        const content = await fs.readFile(filePath, 'utf8');
        const lines = content.split('\n');
        
        const ecgRecord = {
          filename: file,
          dateOfBirth: this.extractValue(lines, 'Date of Birth'),
          recordedDate: this.extractValue(lines, 'Recorded Date'),
          classification: this.extractValue(lines, 'Classification'),
          symptoms: this.extractValue(lines, 'Symptoms'),
          softwareVersion: this.extractValue(lines, 'Software Version'),
          device: this.extractValue(lines, 'Device'),
          sampleRate: this.extractValue(lines, 'Sample Rate')
        };
        
        ecgData.push(ecgRecord);
      }
      
      return ecgData;
    } catch (error) {
      console.error('Error parsing ECG data:', error);
      return [];
    }
  }

  extractValue(lines, key) {
    const line = lines.find(line => line.startsWith(key));
    if (line) {
      const parts = line.split(',');
      return parts.length > 1 ? parts[1].replace(/"/g, '').trim() : '';
    }
    return '';
  }

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

module.exports = HealthDataParser;