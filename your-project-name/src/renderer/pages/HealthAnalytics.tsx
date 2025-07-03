import React from 'react';
import Sidebar from '../components/Sidebar';
import MetricCard from '../components/MetricCard';
import Chart from '../components/Chart';
import './HealthAnalytics.scss';

export default function HealthAnalytics() {
  const sleepData = [7.5, 8.2, 6.8, 7.9, 8.1, 7.3, 8.0, 7.6, 8.2, 7.4, 7.8, 8.3];
  const sleepLabels = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

  const stepsData = [8500, 9200, 7800, 10200, 9500, 8900, 11000, 9800, 10500, 8200, 9600, 10800];
  const heartRateData = [72, 74, 71, 73, 75, 72, 70, 73, 74, 71, 72, 73];

  const healthMetrics = [
    {
      name: 'Sleep Quality',
      value: '7.8h',
      change: '+12%',
      trend: 'up',
      icon: '😴'
    },
    {
      name: 'Daily Steps',
      value: '9,650',
      change: '+5%',
      trend: 'up',
      icon: '👟'
    },
    {
      name: 'Heart Rate',
      value: '72 bpm',
      change: 'Stable',
      trend: 'stable',
      icon: '❤️'
    },
    {
      name: 'Active Minutes',
      value: '45 min',
      change: '+8%',
      trend: 'up',
      icon: '🏃'
    }
  ];

  const recentActivities = [
    {
      type: 'Workout',
      duration: '45 min',
      intensity: 'High',
      time: '2 hours ago',
      icon: '💪'
    },
    {
      type: 'Walk',
      duration: '25 min',
      intensity: 'Moderate',
      time: '4 hours ago',
      icon: '🚶'
    },
    {
      type: 'Meditation',
      duration: '15 min',
      intensity: 'Low',
      time: '6 hours ago',
      icon: '🧘'
    },
    {
      type: 'Sleep',
      duration: '8.2 hours',
      intensity: 'Deep',
      time: 'Last night',
      icon: '😴'
    }
  ];

  return (
    <div className="dashboard-layout">
      <Sidebar activeItem="health" />
      
      <div className="main-content">
        <div className="page-header">
          <div className="header-content">
            <h1>🏃 Health Analytics</h1>
            <p>Track your wellness journey and optimize your health habits</p>
          </div>
          <div className="header-actions">
            <button className="btn btn-secondary">Sync Apple Health</button>
            <button className="btn btn-primary">Add Manual Entry</button>
          </div>
        </div>

        <div className="metrics-grid">
          {healthMetrics.map((metric, index) => (
            <MetricCard
              key={index}
              title={metric.name}
              value={metric.value}
              change={metric.change}
              trend={metric.trend}
              icon={metric.icon}
            />
          ))}
        </div>

        <div className="content-grid">
          <div className="chart-section">
            <div className="chart-container">
              <div className="chart-header">
                <h3>Sleep Patterns</h3>
                <div className="chart-tabs">
                  <button className="tab active">Daily</button>
                  <button className="tab">Weekly</button>
                  <button className="tab">Monthly</button>
                </div>
              </div>
              <Chart 
                data={sleepData} 
                labels={sleepLabels} 
                type="line"
                color="#4f46e5"
              />
            </div>
          </div>

          <div className="chart-section">
            <div className="chart-container">
              <div className="chart-header">
                <h3>Daily Steps</h3>
                <div className="chart-actions">
                  <button className="btn-icon">📊</button>
                </div>
              </div>
              <Chart 
                data={stepsData} 
                labels={sleepLabels} 
                type="bar"
                color="#10b981"
              />
            </div>
          </div>
        </div>

        <div className="content-grid">
          <div className="activity-section">
            <div className="section-header">
              <h3>Recent Activities</h3>
              <button className="btn-text">View All</button>
            </div>
            <div className="activity-list">
              {recentActivities.map((activity, index) => (
                <div key={index} className="activity-item">
                  <div className="activity-icon">{activity.icon}</div>
                  <div className="activity-details">
                    <div className="activity-name">{activity.type}</div>
                    <div className="activity-meta">
                      {activity.duration} • {activity.intensity} intensity
                    </div>
                  </div>
                  <div className="activity-time">{activity.time}</div>
                </div>
              ))}
            </div>
          </div>

          <div className="insights-section">
            <div className="section-header">
              <h3>Health Insights</h3>
              <button className="btn-icon">🤖</button>
            </div>
            <div className="insights-list">
              <div className="insight-item positive">
                <div className="insight-icon">✅</div>
                <div className="insight-content">
                  <div className="insight-title">Great sleep consistency!</div>
                  <div className="insight-description">
                    You've maintained 7+ hours of sleep for 6 days straight
                  </div>
                </div>
              </div>
              <div className="insight-item warning">
                <div className="insight-icon">⚠️</div>
                <div className="insight-content">
                  <div className="insight-title">Consider more cardio</div>
                  <div className="insight-description">
                    Your heart rate variability suggests adding 2 cardio sessions per week
                  </div>
                </div>
              </div>
              <div className="insight-item info">
                <div className="insight-icon">💡</div>
                <div className="insight-content">
                  <div className="insight-title">Optimal workout time</div>
                  <div className="insight-description">
                    Your energy peaks around 2-4 PM - perfect for afternoon workouts
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}