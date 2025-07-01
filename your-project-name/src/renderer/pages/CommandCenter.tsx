import React, { useState } from 'react';
import Sidebar from '../components/Sidebar';
import './CommandCenter.scss';

export default function CommandCenter() {
  const [activeCommand, setActiveCommand] = useState('');

  const systemStatus = [
    { service: 'Database', status: 'online', uptime: '99.9%', response: '12ms' },
    { service: 'API Gateway', status: 'online', uptime: '99.8%', response: '45ms' },
    { service: 'Auth Service', status: 'warning', uptime: '98.2%', response: '89ms' },
    { service: 'File Storage', status: 'online', uptime: '99.5%', response: '23ms' },
    { service: 'Cache Layer', status: 'online', uptime: '99.9%', response: '8ms' }
  ];

  const recentCommands = [
    { command: 'deploy production --force', status: 'success', time: '2m ago', user: 'admin' },
    { command: 'backup database --full', status: 'running', time: '5m ago', user: 'system' },
    { command: 'scale workers +3', status: 'success', time: '12m ago', user: 'devops' },
    { command: 'rollback version 2.1.4', status: 'failed', time: '18m ago', user: 'admin' },
    { command: 'restart services --all', status: 'success', time: '25m ago', user: 'admin' }
  ];

  const quickActions = [
    { name: 'Deploy', icon: '🚀', command: 'deploy', description: 'Deploy to production' },
    { name: 'Backup', icon: '💾', command: 'backup', description: 'Create system backup' },
    { name: 'Scale', icon: '📈', command: 'scale', description: 'Auto-scale resources' },
    { name: 'Monitor', icon: '👀', command: 'monitor', description: 'View system logs' },
    { name: 'Restart', icon: '🔄', command: 'restart', description: 'Restart services' },
    { name: 'Security', icon: '🔒', command: 'security', description: 'Security scan' }
  ];

  const alerts = [
    { type: 'warning', message: 'High CPU usage on server-03', time: '5m ago' },
    { type: 'info', message: 'Scheduled maintenance in 2 hours', time: '15m ago' },
    { type: 'error', message: 'Failed login attempt detected', time: '32m ago' }
  ];

  const executeCommand = (command: string) => {
    setActiveCommand(command);
    // Simulate command execution
    setTimeout(() => setActiveCommand(''), 2000);
  };

  return (
    <div className="command-layout">
      <Sidebar activeItem="overview" />
      
      <div className="main-content">
        <div className="command-header">
          <div className="header-info">
            <h1>Command Center</h1>
            <p>System control and monitoring dashboard</p>
          </div>
          <div className="system-health">
            <div className="health-indicator online">
              <div className="status-dot"></div>
              <span>All Systems Operational</span>
            </div>
          </div>
        </div>

        <div className="command-content">
          <div className="terminal-section">
            <div className="terminal-header">
              <div className="terminal-title">
                <span>🖥️ Terminal</span>
                <div className="terminal-controls">
                  <div className="control-dot red"></div>
                  <div className="control-dot yellow"></div>
                  <div className="control-dot green"></div>
                </div>
              </div>
            </div>
            <div className="terminal-body">
              <div className="command-line">
                <span className="prompt">lifeops@command-center:~$</span>
                <input 
                  type="text" 
                  className="command-input"
                  placeholder="Enter command..."
                  value={activeCommand}
                  onChange={(e) => setActiveCommand(e.target.value)}
                />
              </div>
              <div className="terminal-output">
                {recentCommands.slice(0, 5).map((cmd, index) => (
                  <div key={index} className="output-line">
                    <span className="timestamp">[{cmd.time}]</span>
                    <span className="command-text">$ {cmd.command}</span>
                    <span className={`status ${cmd.status}`}>
                      {cmd.status === 'success' && '✓'}
                      {cmd.status === 'failed' && '✗'}
                      {cmd.status === 'running' && '⟳'}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          </div>

          <div className="dashboard-grid">
            <div className="quick-actions-panel">
              <h3>Quick Actions</h3>
              <div className="actions-grid">
                {quickActions.map((action, index) => (
                  <div 
                    key={index} 
                    className="action-button"
                    onClick={() => executeCommand(action.command)}
                  >
                    <div className="action-icon">{action.icon}</div>
                    <div className="action-content">
                      <span className="action-name">{action.name}</span>
                      <span className="action-desc">{action.description}</span>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            <div className="system-status-panel">
              <h3>System Status</h3>
              <div className="status-list">
                {systemStatus.map((service, index) => (
                  <div key={index} className="status-item">
                    <div className="service-info">
                      <span className="service-name">{service.service}</span>
                      <span className={`service-status ${service.status}`}>
                        <div className="status-indicator"></div>
                        {service.status}
                      </span>
                    </div>
                    <div className="service-metrics">
                      <span className="metric">
                        <label>Uptime:</label> {service.uptime}
                      </span>
                      <span className="metric">
                        <label>Response:</label> {service.response}
                      </span>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            <div className="alerts-panel">
              <h3>System Alerts</h3>
              <div className="alerts-list">
                {alerts.map((alert, index) => (
                  <div key={index} className={`alert-item ${alert.type}`}>
                    <div className="alert-icon">
                      {alert.type === 'warning' && '⚠️'}
                      {alert.type === 'error' && '🚨'}
                      {alert.type === 'info' && 'ℹ️'}
                    </div>
                    <div className="alert-content">
                      <span className="alert-message">{alert.message}</span>
                      <span className="alert-time">{alert.time}</span>
                    </div>
                  </div>
                ))}
              </div>
              <button className="view-all-alerts">View All Alerts</button>
            </div>

            <div className="metrics-panel">
              <h3>Live Metrics</h3>
              <div className="metrics-grid">
                <div className="metric-item">
                  <div className="metric-value">847</div>
                  <div className="metric-label">Active Users</div>
                  <div className="metric-change up">+12%</div>
                </div>
                <div className="metric-item">
                  <div className="metric-value">2.1TB</div>
                  <div className="metric-label">Data Processed</div>
                  <div className="metric-change up">+5%</div>
                </div>
                <div className="metric-item">
                  <div className="metric-value">99.9%</div>
                  <div className="metric-label">System Uptime</div>
                  <div className="metric-change stable">0%</div>
                </div>
                <div className="metric-item">
                  <div className="metric-value">23ms</div>
                  <div className="metric-label">Avg Response</div>
                  <div className="metric-change down">-8%</div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}