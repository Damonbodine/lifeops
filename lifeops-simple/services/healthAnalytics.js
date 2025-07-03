const OpenAI = require('openai');
const HealthDataParserSimple = require('./healthDataParserSimple');

class HealthAnalytics {
  constructor(openaiApiKey) {
    this.openai = new OpenAI({ apiKey: openaiApiKey });
    this.parser = new HealthDataParserSimple();
    this.healthData = null;
  }

  async loadHealthData(exportPath) {
    try {
      console.log('Loading multi-year health data from:', exportPath);
      // Load 2023-2025 data for better analysis (2+ years of data)
      this.healthData = await this.parser.parseRecentHealthData(exportPath, 2023);
      console.log('Health data loaded successfully');
      return this.healthData;
    } catch (error) {
      console.error('Error loading health data:', error);
      throw error;
    }
  }

  async analyzeTrends(metricType = 'all', timeframe = 90) {
    if (!this.healthData) {
      throw new Error('Health data not loaded. Call loadHealthData first.');
    }

    const recentData = this.parser.getRecentTrends(this.healthData.records, timeframe);
    const dailyMetrics = this.parser.aggregateDailyMetrics(recentData);
    const healthSummary = this.generateHealthSummary(dailyMetrics);
    
    // Create more detailed data context for analysis
    const dataContext = this.createDetailedDataContext(recentData, dailyMetrics);
    
    const analysisPrompt = `
    You have access to ${timeframe} days of comprehensive health data. Here's the detailed breakdown:

    HEALTH DATA SUMMARY:
    ${JSON.stringify(healthSummary, null, 2)}

    DETAILED METRICS:
    ${dataContext}

    ANALYSIS REQUIREMENTS:
    Please provide a comprehensive health analysis including:
    1. **Key Trends & Patterns**: What notable patterns do you see across different metrics?
    2. **Health Insights**: Correlations between different health metrics (e.g., sleep vs energy, activity vs heart rate)
    3. **Areas for Improvement**: Specific metrics that show concerning trends or could be optimized
    4. **Actionable Recommendations**: 5 specific, measurable actions to improve health outcomes
    5. **Positive Highlights**: What's working well in the current health patterns

    Focus on practical, actionable insights based on the actual data patterns you observe.
    `;

    const completion = await this.openai.chat.completions.create({
      model: "gpt-4",
      messages: [
        {
          role: "system",
          content: "You are an expert health data analyst and wellness coach. Provide detailed, actionable insights based on real health data patterns. Focus on trends, correlations, and practical recommendations."
        },
        {
          role: "user", 
          content: analysisPrompt
        }
      ],
      max_tokens: 1500
    });

    return {
      analysis: completion.choices[0].message.content,
      rawData: dailyMetrics,
      healthSummary,
      timeframe: timeframe
    };
  }

  async generateHealthBrief() {
    if (!this.healthData) {
      throw new Error('Health data not loaded. Call loadHealthData first.');
    }

    const recent7Days = this.parser.getRecentTrends(this.healthData.records, 7);
    const recent30Days = this.parser.getRecentTrends(this.healthData.records, 30);
    
    const daily7 = this.parser.aggregateDailyMetrics(recent7Days);
    const daily30 = this.parser.aggregateDailyMetrics(recent30Days);

    const briefPrompt = `
    Create a concise daily health brief based on this data:
    
    LAST 7 DAYS:
    ${JSON.stringify(this.generateHealthSummary(daily7), null, 2)}
    
    LAST 30 DAYS AVERAGE:
    ${JSON.stringify(this.generateHealthSummary(daily30), null, 2)}
    
    Provide a brief morning briefing format that includes:
    1. Yesterday's key metrics vs your recent average
    2. One notable trend (positive or concerning)
    3. One specific recommendation for today
    
    Keep it concise and motivational.
    `;

    const completion = await this.openai.chat.completions.create({
      model: "gpt-4",
      messages: [
        {
          role: "system",
          content: "You are a personal health coach providing daily morning briefings. Be encouraging and specific."
        },
        {
          role: "user",
          content: briefPrompt
        }
      ],
      max_tokens: 300
    });

    return completion.choices[0].message.content;
  }

  async analyzeWorkoutPerformance() {
    if (!this.healthData) {
      throw new Error('Health data not loaded. Call loadHealthData first.');
    }

    const recentWorkouts = this.healthData.workouts
      .filter(workout => {
        const cutoff = new Date();
        cutoff.setDate(cutoff.getDate() - 30);
        return workout.startDate >= cutoff;
      })
      .slice(-10);

    if (recentWorkouts.length === 0) {
      return "No recent workout data available for analysis.";
    }

    const workoutPrompt = `
    Analyze these recent workout sessions:
    
    ${JSON.stringify(recentWorkouts, null, 2)}
    
    Provide:
    1. Performance trends (duration, intensity, frequency)
    2. Activity type preferences and patterns
    3. Recovery time analysis
    4. Specific recommendations for workout optimization
    
    Focus on actionable coaching advice.
    `;

    const completion = await this.openai.chat.completions.create({
      model: "gpt-4",
      messages: [
        {
          role: "system",
          content: "You are a fitness coach analyzing workout performance data. Provide specific, actionable guidance."
        },
        {
          role: "user",
          content: workoutPrompt
        }
      ],
      max_tokens: 800
    });

    return completion.choices[0].message.content;
  }

  async analyzeSleepQuality() {
    if (!this.healthData) {
      throw new Error('Health data not loaded. Call loadHealthData first.');
    }

    const recentSleep = this.healthData.records.sleepAnalysis
      .filter(sleep => {
        const cutoff = new Date();
        cutoff.setDate(cutoff.getDate() - 14);
        return sleep.startDate >= cutoff;
      });

    if (recentSleep.length === 0) {
      return "No recent sleep data available for analysis.";
    }

    const sleepPrompt = `
    Analyze this sleep data from the past 2 weeks:
    
    ${JSON.stringify(recentSleep, null, 2)}
    
    Provide:
    1. Sleep duration and consistency patterns
    2. Sleep quality trends
    3. Correlation with activity levels (if apparent)
    4. Specific sleep optimization recommendations
    
    Focus on practical sleep hygiene advice.
    `;

    const completion = await this.openai.chat.completions.create({
      model: "gpt-4",
      messages: [
        {
          role: "system",
          content: "You are a sleep specialist analyzing sleep patterns. Provide evidence-based sleep optimization advice."
        },
        {
          role: "user",
          content: sleepPrompt
        }
      ],
      max_tokens: 600
    });

    return completion.choices[0].message.content;
  }

  async analyzeHeartRateVariability() {
    if (!this.healthData) {
      throw new Error('Health data not loaded. Call loadHealthData first.');
    }

    const recentHRV = this.healthData.records.hrv
      .filter(hrv => {
        const cutoff = new Date();
        cutoff.setDate(cutoff.getDate() - 21);
        return hrv.startDate >= cutoff;
      });

    if (recentHRV.length === 0) {
      return "No recent HRV data available for analysis.";
    }

    const hrvPrompt = `
    Analyze this Heart Rate Variability data from the past 3 weeks:
    
    ${JSON.stringify(recentHRV.map(hrv => ({
      value: hrv.value,
      date: hrv.startDate.toISOString().split('T')[0]
    })), null, 2)}
    
    Provide:
    1. HRV trends and patterns
    2. Stress and recovery indicators
    3. Correlation with sleep and activity
    4. Recommendations for optimizing recovery
    
    Explain what HRV changes might indicate about stress and recovery.
    `;

    const completion = await this.openai.chat.completions.create({
      model: "gpt-4",
      messages: [
        {
          role: "system",
          content: "You are a sports scientist specializing in HRV analysis. Explain findings in accessible terms."
        },
        {
          role: "user",
          content: hrvPrompt
        }
      ],
      max_tokens: 700
    });

    return completion.choices[0].message.content;
  }

  async generatePersonalizedRecommendations(userGoals = null, currentMood = null) {
    if (!this.healthData) {
      throw new Error('Health data not loaded. Call loadHealthData first.');
    }

    const recentData = this.parser.getRecentTrends(this.healthData.records, 14);
    const summary = this.generateHealthSummary(this.parser.aggregateDailyMetrics(recentData));

    const recommendationPrompt = `
    Based on this health data summary from the past 2 weeks:
    ${JSON.stringify(summary, null, 2)}
    
    User Goals: ${userGoals || 'General health and wellness'}
    Current Mood/Energy: ${currentMood || 'Not specified'}
    
    Generate 5 specific, actionable recommendations for today that:
    1. Are based on their actual health data patterns
    2. Align with their goals
    3. Consider their current mood/energy level
    4. Include both fitness and wellness aspects
    5. Are realistic and achievable
    
    Format as numbered list with brief explanations.
    `;

    const completion = await this.openai.chat.completions.create({
      model: "gpt-4",
      messages: [
        {
          role: "system",
          content: "You are a personal wellness coach creating data-driven, personalized daily recommendations."
        },
        {
          role: "user",
          content: recommendationPrompt
        }
      ],
      max_tokens: 600
    });

    return completion.choices[0].message.content;
  }

  createDetailedDataContext(recentData, dailyMetrics) {
    const dates = Object.keys(dailyMetrics).sort();
    const recentDates = dates.slice(-14); // Last 2 weeks
    
    let context = `Data covers ${dates.length} days with ${Object.keys(recentData).reduce((sum, key) => sum + recentData[key].length, 0)} total data points.\n\n`;
    
    // Recent daily averages
    context += "RECENT DAILY AVERAGES (Last 14 days):\n";
    recentDates.forEach(date => {
      const dayData = dailyMetrics[date];
      if (dayData.steps) context += `${date}: ${Math.round(dayData.steps.sum)} steps, `;
      if (dayData.heartRate) context += `${Math.round(dayData.heartRate.avg)} bpm avg HR, `;
      if (dayData.activeEnergy) context += `${Math.round(dayData.activeEnergy.sum)} cal active energy`;
      context += '\n';
    });
    
    // Weekly patterns
    context += "\nWEEKLY PATTERNS:\n";
    const weeklyData = this.calculateWeeklyPatterns(dailyMetrics);
    Object.keys(weeklyData).forEach(metric => {
      if (weeklyData[metric]) {
        context += `${metric}: ${JSON.stringify(weeklyData[metric])}\n`;
      }
    });
    
    return context;
  }

  calculateWeeklyPatterns(dailyMetrics) {
    const patterns = {};
    const dates = Object.keys(dailyMetrics).sort();
    
    // Group by day of week
    const dayOfWeek = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
    
    ['steps', 'heartRate', 'activeEnergy'].forEach(metric => {
      const weeklyAvgs = {};
      dayOfWeek.forEach(day => weeklyAvgs[day] = []);
      
      dates.forEach(date => {
        const dayData = dailyMetrics[date];
        if (dayData[metric]) {
          const day = dayOfWeek[new Date(date).getDay()];
          weeklyAvgs[day].push(dayData[metric].avg || dayData[metric].sum);
        }
      });
      
      // Calculate averages for each day
      const result = {};
      Object.keys(weeklyAvgs).forEach(day => {
        if (weeklyAvgs[day].length > 0) {
          result[day] = Math.round(weeklyAvgs[day].reduce((a, b) => a + b, 0) / weeklyAvgs[day].length);
        }
      });
      
      if (Object.keys(result).length > 0) {
        patterns[metric] = result;
      }
    });
    
    return patterns;
  }

  generateHealthSummary(dailyMetrics) {
    const dates = Object.keys(dailyMetrics).sort();
    const summary = {};

    ['steps', 'heartRate', 'activeEnergy', 'sleepAnalysis', 'hrv'].forEach(metric => {
      const values = dates
        .map(date => dailyMetrics[date][metric])
        .filter(val => val && val.avg !== undefined);

      if (values.length > 0) {
        const avgValues = values.map(v => v.avg);
        summary[metric] = {
          dailyAverage: avgValues.reduce((a, b) => a + b, 0) / avgValues.length,
          trend: this.calculateTrend(avgValues),
          dataPoints: values.length,
          min: Math.min(...avgValues),
          max: Math.max(...avgValues)
        };
      }
    });

    return summary;
  }

  calculateTrend(values) {
    if (values.length < 2) return 'insufficient_data';
    
    const firstHalf = values.slice(0, Math.floor(values.length / 2));
    const secondHalf = values.slice(Math.floor(values.length / 2));
    
    const firstAvg = firstHalf.reduce((a, b) => a + b, 0) / firstHalf.length;
    const secondAvg = secondHalf.reduce((a, b) => a + b, 0) / secondHalf.length;
    
    const percentChange = ((secondAvg - firstAvg) / firstAvg) * 100;
    
    if (percentChange > 5) return 'increasing';
    if (percentChange < -5) return 'decreasing';
    return 'stable';
  }

  getHealthOverview() {
    if (!this.healthData) {
      return null;
    }

    const recent = this.parser.getRecentTrends(this.healthData.records, 7);
    const overview = {
      totalRecords: Object.values(this.healthData.records).reduce((total, records) => total + records.length, 0),
      exportDate: this.healthData.exportDate,
      dataTypes: Object.keys(this.healthData.records).filter(key => this.healthData.records[key].length > 0),
      recentActivity: {
        steps: recent.steps.length,
        heartRate: recent.heartRate.length,
        workouts: this.healthData.workouts.filter(w => {
          const cutoff = new Date();
          cutoff.setDate(cutoff.getDate() - 7);
          return w.startDate >= cutoff;
        }).length
      }
    };

    return overview;
  }
}

module.exports = HealthAnalytics;