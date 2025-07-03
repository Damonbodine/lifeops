import React from 'react';
import './Sidebar.scss';

interface SidebarProps {
  activeItem?: string;
  onItemClick?: (item: string) => void;
}

interface NavItem {
  id: string;
  label: string;
  icon: string;
  hasSubmenu?: boolean;
}

const navigationItems: NavItem[] = [
  { id: 'dashboard', label: 'Dashboard', icon: '📊' },
  { id: 'pomodoro', label: 'Smart Pomodoro', icon: '🍅' },
  { id: 'tasks', label: '1-3-5 Tasks', icon: '📋' },
  { id: 'email', label: 'Email Analysis', icon: '📧' },
  { id: 'health', label: 'Health Analytics', icon: '🏃' },
  { id: 'relationships', label: 'Relationship Intelligence', icon: '🧠' },
  { id: 'calendar', label: 'Calendar View', icon: '📅' },
];

const generalItems: NavItem[] = [
  { id: 'checkin', label: 'Check In', icon: '❤️' },
  { id: 'settings', label: 'Settings', icon: '⚙️' },
];

export default function Sidebar({ activeItem = 'dashboard', onItemClick }: SidebarProps) {
  const handleItemClick = (itemId: string) => {
    if (onItemClick) {
      onItemClick(itemId);
    }
  };

  return (
    <div className="sidebar">
      <div className="sidebar-header">
        <div className="brand">
          <div className="brand-icon">🧐</div>
          <span className="brand-name">LifeOps</span>
        </div>
        <div className="workspace">
          <div className="workspace-icon">🎯</div>
          <div className="workspace-info">
            <span className="workspace-label">Personal OS</span>
            <span className="workspace-name">v1.0</span>
          </div>
          <div className="workspace-dropdown">⌄</div>
        </div>
      </div>

      <div className="sidebar-content">
        <div className="nav-section">
          <div className="nav-title">Core Features</div>
          {navigationItems.map((item) => (
            <div
              key={item.id}
              className={`nav-item ${activeItem === item.id ? 'active' : ''}`}
              onClick={() => handleItemClick(item.id)}
            >
              <span className="nav-icon">{item.icon}</span>
              <span className="nav-label">{item.label}</span>
              {item.hasSubmenu && <span className="nav-arrow">›</span>}
            </div>
          ))}
        </div>

        <div className="nav-section">
          <div className="nav-title">System</div>
          {generalItems.map((item) => (
            <div
              key={item.id}
              className={`nav-item ${activeItem === item.id ? 'active' : ''}`}
              onClick={() => handleItemClick(item.id)}
            >
              <span className="nav-icon">{item.icon}</span>
              <span className="nav-label">{item.label}</span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}