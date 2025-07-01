import { MemoryRouter as Router, Routes, Route } from 'react-router-dom';
import { useState } from 'react';
import DashboardOverview from './pages/DashboardOverview';
import CardBasedLayout from './pages/CardBasedLayout';
import MinimalFocusLayout from './pages/MinimalFocusLayout';
import AnalyticsFocused from './pages/AnalyticsFocused';
import CommandCenter from './pages/CommandCenter';
import './App.css';

function LayoutSelector() {
  const [selectedLayout, setSelectedLayout] = useState<string | null>(null);

  if (selectedLayout === 'dashboard') {
    return <DashboardOverview />;
  }
  
  if (selectedLayout === 'cards') {
    return <CardBasedLayout />;
  }
  
  if (selectedLayout === 'minimal') {
    return <MinimalFocusLayout />;
  }

  if (selectedLayout === 'analytics') {
    return <AnalyticsFocused />;
  }

  if (selectedLayout === 'command') {
    return <CommandCenter />;
  }

  return (
    <div className="layout-selector">
      <div className="selector-container">
        <h1>Choose Your Homepage Layout</h1>
        <p>Select one of the five options below to see your Lifeops dashboard</p>
        
        <div className="layout-options">
          <div className="layout-option" onClick={() => setSelectedLayout('dashboard')}>
            <div className="option-preview dashboard-preview">
              <div className="preview-sidebar"></div>
              <div className="preview-content">
                <div className="preview-header"></div>
                <div className="preview-metrics">
                  <div className="preview-metric"></div>
                  <div className="preview-metric"></div>
                  <div className="preview-metric"></div>
                </div>
                <div className="preview-chart"></div>
              </div>
            </div>
            <h3>Dashboard Overview</h3>
            <p>Complete dashboard with metrics, charts, and subscription management</p>
          </div>

          <div className="layout-option" onClick={() => setSelectedLayout('cards')}>
            <div className="option-preview cards-preview">
              <div className="preview-sidebar"></div>
              <div className="preview-content">
                <div className="preview-header"></div>
                <div className="preview-cards">
                  <div className="preview-card"></div>
                  <div className="preview-card"></div>
                  <div className="preview-card"></div>
                  <div className="preview-card"></div>
                </div>
              </div>
            </div>
            <h3>Card-Based Layout</h3>
            <p>Grid-based layout with action cards and activity feed</p>
          </div>

          <div className="layout-option" onClick={() => setSelectedLayout('minimal')}>
            <div className="option-preview minimal-preview">
              <div className="preview-sidebar"></div>
              <div className="preview-content">
                <div className="preview-hero"></div>
                <div className="preview-stats"></div>
                <div className="preview-recent"></div>
              </div>
            </div>
            <h3>Minimal Focus</h3>
            <p>Clean, spacious layout with focus on primary actions</p>
          </div>

          <div className="layout-option" onClick={() => setSelectedLayout('analytics')}>
            <div className="option-preview analytics-preview">
              <div className="preview-sidebar"></div>
              <div className="preview-content">
                <div className="preview-header"></div>
                <div className="preview-analytics-grid">
                  <div className="preview-chart large"></div>
                  <div className="preview-metrics-small">
                    <div className="preview-metric small"></div>
                    <div className="preview-metric small"></div>
                  </div>
                </div>
              </div>
            </div>
            <h3>Analytics Focused</h3>
            <p>Data-driven dashboard with detailed charts and performance metrics</p>
          </div>

          <div className="layout-option" onClick={() => setSelectedLayout('command')}>
            <div className="option-preview command-preview">
              <div className="preview-sidebar dark"></div>
              <div className="preview-content dark">
                <div className="preview-terminal"></div>
                <div className="preview-command-grid">
                  <div className="preview-status"></div>
                  <div className="preview-actions"></div>
                </div>
              </div>
            </div>
            <h3>Command Center</h3>
            <p>Terminal-style interface with system controls and monitoring</p>
          </div>
        </div>
      </div>
    </div>
  );
}

export default function App() {
  return (
    <Router>
      <Routes>
        <Route path="/" element={<LayoutSelector />} />
      </Routes>
    </Router>
  );
}