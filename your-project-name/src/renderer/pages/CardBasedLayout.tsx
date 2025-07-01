import React from 'react';
import Sidebar from '../components/Sidebar';
import './CardBasedLayout.scss';

export default function CardBasedLayout() {
  const actionCards = [
    {
      title: 'Create New Project',
      description: 'Start a new project with templates',
      icon: '📁',
      color: '#3b82f6',
      action: 'Create'
    },
    {
      title: 'Team Collaboration',
      description: 'Invite team members and collaborate',
      icon: '👥',
      color: '#10b981',
      action: 'Invite'
    },
    {
      title: 'Analytics Dashboard',
      description: 'View detailed analytics and reports',
      icon: '📊',
      color: '#8b5cf6',
      action: 'View'
    },
    {
      title: 'Settings & Config',
      description: 'Manage app settings and preferences',
      icon: '⚙️',
      color: '#f59e0b',
      action: 'Configure'
    }
  ];

  const recentActivities = [
    { action: 'Created new project', time: '2 minutes ago', type: 'create' },
    { action: 'Updated team settings', time: '1 hour ago', type: 'update' },
    { action: 'Exported analytics report', time: '3 hours ago', type: 'export' },
    { action: 'Added new team member', time: '1 day ago', type: 'add' },
    { action: 'Completed project milestone', time: '2 days ago', type: 'complete' }
  ];

  const quickStats = [
    { label: 'Active Projects', value: '12', change: '+2 this week' },
    { label: 'Team Members', value: '8', change: '+1 this month' },
    { label: 'Completed Tasks', value: '156', change: '+24 this week' },
    { label: 'Success Rate', value: '94%', change: '+2% this month' }
  ];

  return (
    <div className="card-layout">
      <Sidebar activeItem="overview" />
      
      <div className="main-content">
        <div className="content-header">
          <div className="header-left">
            <h1>Dashboard</h1>
            <p>Welcome back! Here's what's happening with your projects.</p>
          </div>
          <div className="header-right">
            <button className="btn-secondary">View All</button>
            <button className="btn-primary">New Project</button>
          </div>
        </div>

        <div className="content-body">
          <div className="quick-stats">
            <div className="stats-grid">
              {quickStats.map((stat, index) => (
                <div key={index} className="stat-card">
                  <div className="stat-value">{stat.value}</div>
                  <div className="stat-label">{stat.label}</div>
                  <div className="stat-change">{stat.change}</div>
                </div>
              ))}
            </div>
          </div>

          <div className="main-grid">
            <div className="action-cards-section">
              <h2>Quick Actions</h2>
              <div className="action-cards-grid">
                {actionCards.map((card, index) => (
                  <div key={index} className="action-card" style={{ '--accent-color': card.color } as React.CSSProperties}>
                    <div className="card-icon">{card.icon}</div>
                    <div className="card-content">
                      <h3>{card.title}</h3>
                      <p>{card.description}</p>
                    </div>
                    <button className="card-action">{card.action}</button>
                  </div>
                ))}
              </div>
            </div>

            <div className="activity-section">
              <h2>Recent Activity</h2>
              <div className="activity-feed">
                {recentActivities.map((activity, index) => (
                  <div key={index} className="activity-item">
                    <div className={`activity-icon ${activity.type}`}>
                      {activity.type === 'create' && '➕'}
                      {activity.type === 'update' && '✏️'}
                      {activity.type === 'export' && '📤'}
                      {activity.type === 'add' && '👤'}
                      {activity.type === 'complete' && '✅'}
                    </div>
                    <div className="activity-content">
                      <span className="activity-action">{activity.action}</span>
                      <span className="activity-time">{activity.time}</span>
                    </div>
                  </div>
                ))}
              </div>
              <button className="view-all-activity">View All Activity</button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}