import React from 'react';
import Sidebar from '../components/Sidebar';
import MetricCard from '../components/MetricCard';
import Chart from '../components/Chart';
import './RelationshipIntelligence.scss';

export default function RelationshipIntelligence() {
  const connectionData = [12, 15, 8, 18, 22, 16, 20, 14, 25, 19, 17, 23];
  const connectionLabels = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

  const relationshipMetrics = [
    {
      name: 'Active Connections',
      value: '47',
      change: '+8%',
      trend: 'up',
      icon: '👥'
    },
    {
      name: 'Messages Sent',
      value: '156',
      change: '+12%',
      trend: 'up',
      icon: '💬'
    },
    {
      name: 'Response Rate',
      value: '89%',
      change: '+3%',
      trend: 'up',
      icon: '⚡'
    },
    {
      name: 'Deep Conversations',
      value: '12',
      change: 'Stable',
      trend: 'stable',
      icon: '🧠'
    }
  ];

  const recentConnections = [
    {
      name: 'Sarah Chen',
      lastContact: '2 hours ago',
      relationship: 'Close Friend',
      mood: 'positive',
      platform: 'iMessage',
      icon: '👩‍💼',
      status: 'responded'
    },
    {
      name: 'Alex Johnson',
      lastContact: '1 day ago',
      relationship: 'Colleague',
      mood: 'neutral',
      platform: 'Slack',
      icon: '👨‍💻',
      status: 'pending'
    },
    {
      name: 'Mom',
      lastContact: '3 days ago',
      relationship: 'Family',
      mood: 'warm',
      platform: 'Phone',
      icon: '👩‍🦳',
      status: 'overdue'
    },
    {
      name: 'David Park',
      lastContact: '1 week ago',
      relationship: 'Old Friend',
      mood: 'nostalgic',
      platform: 'WhatsApp',
      icon: '👨‍🎓',
      status: 'overdue'
    }
  ];

  const upcomingBirthdays = [
    {
      name: 'Alex Byrne',
      date: 'Today',
      age: '28',
      relationship: 'Close Friend',
      icon: '🎂'
    },
    {
      name: 'Sunshine James',
      date: 'Today',
      age: '32',
      relationship: 'Work Friend',
      icon: '🎂'
    },
    {
      name: 'Jessica Liu',
      date: 'Tomorrow',
      age: '29',
      relationship: 'Family Friend',
      icon: '🎁'
    },
    {
      name: 'Mike Rodriguez',
      date: 'This Week',
      age: '35',
      relationship: 'Neighbor',
      icon: '📅'
    }
  ];

  const relationshipInsights = [
    {
      type: 'suggestion',
      icon: '💡',
      title: 'Reach out to David',
      description: 'You haven\'t talked to David in over a week. He mentioned wanting to catch up.',
      action: 'Send Message',
      priority: 'high'
    },
    {
      type: 'celebration',
      icon: '🎉',
      title: 'Strong week for connections',
      description: 'You\'ve maintained contact with 15 people this week - 25% above your average.',
      action: 'View Stats',
      priority: 'low'
    },
    {
      type: 'reminder',
      icon: '⏰',
      title: 'Birthday reminders active',
      description: 'Alex and Sunshine both have birthdays today. Don\'t forget to wish them well!',
      action: 'Send Wishes',
      priority: 'high'
    },
    {
      type: 'pattern',
      icon: '📈',
      title: 'Evening texting trend',
      description: 'You get 60% more responses when texting between 7-9 PM.',
      action: 'Learn More',
      priority: 'medium'
    }
  ];

  return (
    <div className="dashboard-layout">
      <Sidebar activeItem="relationships" />
      
      <div className="main-content">
        <div className="page-header">
          <div className="header-content">
            <h1>🧠 Relationship Intelligence</h1>
            <p>Strengthen connections and nurture meaningful relationships</p>
          </div>
          <div className="header-actions">
            <button className="btn btn-secondary">Sync Contacts</button>
            <button className="btn btn-primary">Add Connection</button>
          </div>
        </div>

        <div className="metrics-grid">
          {relationshipMetrics.map((metric, index) => (
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
                <h3>Connection Activity</h3>
                <div className="chart-tabs">
                  <button className="tab active">Monthly</button>
                  <button className="tab">Weekly</button>
                  <button className="tab">Daily</button>
                </div>
              </div>
              <Chart 
                data={connectionData} 
                labels={connectionLabels} 
                type="line"
                color="#8b5cf6"
              />
            </div>
          </div>

          <div className="birthdays-section">
            <div className="section-header">
              <h3>Upcoming Birthdays</h3>
              <button className="btn-text">View Calendar</button>
            </div>
            <div className="birthdays-list">
              {upcomingBirthdays.map((birthday, index) => (
                <div key={index} className="birthday-item">
                  <div className="birthday-icon">{birthday.icon}</div>
                  <div className="birthday-details">
                    <div className="birthday-name">{birthday.name}</div>
                    <div className="birthday-meta">
                      {birthday.date} • Turning {birthday.age}
                    </div>
                    <div className="birthday-relationship">{birthday.relationship}</div>
                  </div>
                  <button className="btn-birthday">Send Wishes</button>
                </div>
              ))}
            </div>
          </div>
        </div>

        <div className="content-grid">
          <div className="connections-section">
            <div className="section-header">
              <h3>Recent Connections</h3>
              <button className="btn-text">View All</button>
            </div>
            <div className="connections-list">
              {recentConnections.map((connection, index) => (
                <div key={index} className={`connection-item ${connection.status}`}>
                  <div className="connection-avatar">{connection.icon}</div>
                  <div className="connection-details">
                    <div className="connection-name">{connection.name}</div>
                    <div className="connection-meta">
                      {connection.relationship} • {connection.platform}
                    </div>
                    <div className="connection-time">{connection.lastContact}</div>
                  </div>
                  <div className={`connection-status ${connection.status}`}>
                    {connection.status === 'responded' && '✅'}
                    {connection.status === 'pending' && '⏳'}
                    {connection.status === 'overdue' && '⚠️'}
                  </div>
                </div>
              ))}
            </div>
          </div>

          <div className="insights-section">
            <div className="section-header">
              <h3>Relationship Insights</h3>
              <button className="btn-icon">🤖</button>
            </div>
            <div className="insights-list">
              {relationshipInsights.map((insight, index) => (
                <div key={index} className={`insight-item ${insight.priority}`}>
                  <div className="insight-icon">{insight.icon}</div>
                  <div className="insight-content">
                    <div className="insight-title">{insight.title}</div>
                    <div className="insight-description">{insight.description}</div>
                  </div>
                  <button className="insight-action">{insight.action}</button>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}