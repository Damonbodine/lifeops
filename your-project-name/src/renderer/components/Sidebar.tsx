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
  { id: 'overview', label: 'Overview', icon: '🏠' },
  { id: 'analytics', label: 'Analytics', icon: '📊' },
  { id: 'ecommerce', label: 'E-commerce', icon: '🛒' },
  { id: 'crypto', label: 'Crypto', icon: '₿' },
  { id: 'customers', label: 'Customers', icon: '👥', hasSubmenu: true },
  { id: 'products', label: 'Products', icon: '📦', hasSubmenu: true },
  { id: 'orders', label: 'Orders', icon: '📋', hasSubmenu: true },
  { id: 'invoices', label: 'Invoices', icon: '🧾', hasSubmenu: true },
  { id: 'jobs', label: 'Jobs', icon: '💼', hasSubmenu: true },
  { id: 'logistics', label: 'Logistics', icon: '🚚', hasSubmenu: true },
  { id: 'blog', label: 'Blog', icon: '📝', hasSubmenu: true },
];

const generalItems: NavItem[] = [
  { id: 'settings', label: 'Settings', icon: '⚙️' },
];

export default function Sidebar({ activeItem = 'overview', onItemClick }: SidebarProps) {
  const handleItemClick = (itemId: string) => {
    if (onItemClick) {
      onItemClick(itemId);
    }
  };

  return (
    <div className="sidebar">
      <div className="sidebar-header">
        <div className="brand">
          <div className="brand-icon">📱</div>
          <span className="brand-name">DeviasKit</span>
        </div>
        <div className="workspace">
          <div className="workspace-icon">🔧</div>
          <div className="workspace-info">
            <span className="workspace-label">Workspace</span>
            <span className="workspace-name">Devias</span>
          </div>
          <div className="workspace-dropdown">⌄</div>
        </div>
      </div>

      <div className="sidebar-content">
        <div className="nav-section">
          <div className="nav-title">Dashboards</div>
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
          <div className="nav-title">General</div>
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