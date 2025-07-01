import React from 'react';
import './Chart.scss';

interface ChartProps {
  title: string;
  subtitle?: string;
  data: number[];
  labels?: string[];
  height?: number;
  color?: string;
  className?: string;
}

export default function Chart({ 
  title, 
  subtitle, 
  data, 
  labels = [], 
  height = 200, 
  color = '#3b82f6',
  className = ''
}: ChartProps) {
  const maxValue = Math.max(...data);
  const normalizedData = data.map(value => (value / maxValue) * 100);

  return (
    <div className={`chart ${className}`}>
      <div className="chart-header">
        <h3 className="chart-title">{title}</h3>
        {subtitle && <p className="chart-subtitle">{subtitle}</p>}
      </div>
      
      <div className="chart-container" style={{ height: `${height}px` }}>
        <div className="chart-bars">
          {normalizedData.map((value, index) => (
            <div key={index} className="bar-wrapper">
              <div 
                className="bar" 
                style={{ 
                  height: `${value}%`,
                  backgroundColor: color,
                  opacity: 0.8 + (value / 100) * 0.2
                }}
              />
              {labels[index] && (
                <span className="bar-label">{labels[index]}</span>
              )}
            </div>
          ))}
        </div>
      </div>
      
      <div className="chart-footer">
        <span className="chart-info">
          This year is forecasted to increase in your traffic by the end of the current year
        </span>
      </div>
    </div>
  );
}