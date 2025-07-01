import React from 'react';
import Sidebar from '../components/Sidebar';
import './MinimalFocusLayout.scss';

export default function MinimalFocusLayout() {
  const primaryActions = [
    {
      title: 'Start New Project',
      description: 'Begin your next big idea',
      icon: '🚀',
      color: '#3b82f6'
    },
    {
      title: 'Join Team',
      description: 'Collaborate with others',
      icon: '🤝',
      color: '#10b981'
    }
  ];

  const recentProjects = [
    { name: 'Mobile App Redesign', progress: 85, status: 'active' },
    { name: 'Dashboard Analytics', progress: 60, status: 'active' },
    { name: 'API Integration', progress: 100, status: 'completed' }
  ];

  return (
    <div className="minimal-layout">
      <Sidebar activeItem="overview" />
      
      <div className="main-content">
        <div className="hero-section">
          <div className="hero-content">
            <h1>Welcome to Lifeops</h1>
            <p>Your productivity companion for managing life and work seamlessly.</p>
            
            <div className="primary-actions">
              {primaryActions.map((action, index) => (
                <button 
                  key={index} 
                  className="primary-action-btn"
                  style={{ '--accent-color': action.color } as React.CSSProperties}
                >
                  <span className="action-icon">{action.icon}</span>
                  <div className="action-content">
                    <span className="action-title">{action.title}</span>
                    <span className="action-description">{action.description}</span>
                  </div>
                </button>
              ))}
            </div>
          </div>
        </div>

        <div className="content-sections">
          <div className="stats-overview">
            <div className="stat-item">
              <div className="stat-number">2,847</div>
              <div className="stat-label">Tasks Completed</div>
            </div>
            <div className="stat-divider"></div>
            <div className="stat-item">
              <div className="stat-number">12</div>
              <div className="stat-label">Active Projects</div>
            </div>
            <div className="stat-divider"></div>
            <div className="stat-item">
              <div className="stat-number">98%</div>
              <div className="stat-label">Success Rate</div>
            </div>
          </div>

          <div className="recent-section">
            <h2>Recent Projects</h2>
            <div className="projects-list">
              {recentProjects.map((project, index) => (
                <div key={index} className="project-item">
                  <div className="project-info">
                    <span className="project-name">{project.name}</span>
                    <div className="progress-bar">
                      <div 
                        className="progress-fill"
                        style={{ width: `${project.progress}%` }}
                      ></div>
                    </div>
                  </div>
                  <div className="project-meta">
                    <span className="progress-text">{project.progress}%</span>
                    <span className={`status ${project.status}`}>
                      {project.status}
                    </span>
                  </div>
                </div>
              ))}
            </div>
            <button className="view-all-projects">View All Projects →</button>
          </div>

          <div className="quick-access">
            <h2>Quick Access</h2>
            <div className="quick-actions-grid">
              <div className="quick-action">
                <div className="qa-icon">📋</div>
                <span>Tasks</span>
              </div>
              <div className="quick-action">
                <div className="qa-icon">📅</div>
                <span>Calendar</span>
              </div>
              <div className="quick-action">
                <div className="qa-icon">📊</div>
                <span>Reports</span>
              </div>
              <div className="quick-action">
                <div className="qa-icon">⚙️</div>
                <span>Settings</span>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}