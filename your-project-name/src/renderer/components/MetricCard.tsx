import React from 'react';
import './MetricCard.scss';

interface MetricCardProps {
  title: string;
  value: string | number;
  icon: string;
  trend?: {
    value: number;
    direction: 'up' | 'down';
    label: string;
  };
  className?: string;
}

export default function MetricCard({ title, value, icon, trend, className = '' }: MetricCardProps) {
  return (
    <div className={`metric-card ${className}`}>
      <div className="metric-header">
        <div className="metric-info">
          <span className="metric-title">{title}</span>
          <span className="metric-value">{value}</span>
        </div>
        <div className="metric-icon">
          {icon}
        </div>
      </div>
      
      {trend && (
        <div className="metric-trend">
          <span className={`trend-indicator ${trend.direction}`}>
            {trend.direction === 'up' ? '↗' : '↘'} {Math.abs(trend.value)}%
          </span>
          <span className="trend-label">{trend.label}</span>
        </div>
      )}
    </div>
  );
}