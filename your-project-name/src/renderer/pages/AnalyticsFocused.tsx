import React from 'react';
import Sidebar from '../components/Sidebar';
import Chart from '../components/Chart';
import './AnalyticsFocused.scss';

export default function AnalyticsFocused() {
  const performanceMetrics = [
    { label: 'Revenue', value: '$45,623', change: '+12.5%', trend: 'up' },
    { label: 'Conversion Rate', value: '3.24%', change: '+0.8%', trend: 'up' },
    { label: 'Avg. Session', value: '4m 32s', change: '-2.1%', trend: 'down' },
    { label: 'Bounce Rate', value: '24.8%', change: '-5.2%', trend: 'up' }
  ];

  const chartData1 = [2400, 1398, 9800, 3908, 4800, 3800, 4300, 5200, 4100, 3600, 4800, 5400];
  const chartData2 = [1200, 2100, 1800, 2700, 3400, 2800, 3600, 4200, 3800, 4600, 5200, 4800];
  const chartData3 = [800, 1200, 1600, 1400, 2200, 1800, 2400, 2800, 2600, 3200, 3600, 3400];

  const topPages = [
    { page: '/dashboard', views: 45231, bounce: '22%', conversion: '4.2%' },
    { page: '/products', views: 32145, bounce: '31%', conversion: '2.8%' },
    { page: '/checkout', views: 18756, bounce: '45%', conversion: '8.1%' },
    { page: '/profile', views: 12456, bounce: '28%', conversion: '1.9%' },
    { page: '/settings', views: 8765, bounce: '35%', conversion: '0.8%' }
  ];

  const trafficSources = [
    { source: 'Organic Search', percentage: 42.3, visitors: 18453 },
    { source: 'Direct', percentage: 28.7, visitors: 12534 },
    { source: 'Social Media', percentage: 15.2, visitors: 6634 },
    { source: 'Email', percentage: 8.9, visitors: 3889 },
    { source: 'Referral', percentage: 4.9, visitors: 2140 }
  ];

  return (
    <div className="analytics-layout">
      <Sidebar activeItem="analytics" />
      
      <div className="main-content">
        <div className="analytics-header">
          <div className="header-info">
            <h1>Analytics Dashboard</h1>
            <p>Real-time insights and performance metrics</p>
          </div>
          <div className="date-selector">
            <select className="date-range">
              <option>Last 30 days</option>
              <option>Last 7 days</option>
              <option>Last 90 days</option>
              <option>This year</option>
            </select>
          </div>
        </div>

        <div className="analytics-content">
          <div className="performance-overview">
            {performanceMetrics.map((metric, index) => (
              <div key={index} className="performance-card">
                <div className="metric-header">
                  <span className="metric-label">{metric.label}</span>
                  <span className={`metric-change ${metric.trend}`}>
                    {metric.change}
                  </span>
                </div>
                <div className="metric-value">{metric.value}</div>
              </div>
            ))}
          </div>

          <div className="charts-section">
            <div className="main-chart">
              <Chart
                title="Revenue Trends"
                subtitle="Monthly revenue over the past year"
                data={chartData1}
                labels={['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec']}
                height={350}
                color="#10b981"
              />
            </div>
            <div className="secondary-charts">
              <Chart
                title="User Growth"
                data={chartData2}
                labels={['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec']}
                height={200}
                color="#3b82f6"
                className="compact"
              />
              <Chart
                title="Page Views"
                data={chartData3}
                labels={['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec']}
                height={200}
                color="#8b5cf6"
                className="compact"
              />
            </div>
          </div>

          <div className="analytics-tables">
            <div className="top-pages-section">
              <h3>Top Pages</h3>
              <div className="data-table">
                <div className="table-header">
                  <span>Page</span>
                  <span>Views</span>
                  <span>Bounce Rate</span>
                  <span>Conversion</span>
                </div>
                {topPages.map((page, index) => (
                  <div key={index} className="table-row">
                    <span className="page-url">{page.page}</span>
                    <span className="page-views">{page.views.toLocaleString()}</span>
                    <span className="bounce-rate">{page.bounce}</span>
                    <span className="conversion-rate">{page.conversion}</span>
                  </div>
                ))}
              </div>
            </div>

            <div className="traffic-sources-section">
              <h3>Traffic Sources</h3>
              <div className="traffic-list">
                {trafficSources.map((source, index) => (
                  <div key={index} className="traffic-item">
                    <div className="source-info">
                      <span className="source-name">{source.source}</span>
                      <span className="source-visitors">{source.visitors.toLocaleString()} visitors</span>
                    </div>
                    <div className="source-percentage">
                      <div className="percentage-bar">
                        <div 
                          className="percentage-fill"
                          style={{ width: `${source.percentage}%` }}
                        ></div>
                      </div>
                      <span className="percentage-text">{source.percentage}%</span>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}