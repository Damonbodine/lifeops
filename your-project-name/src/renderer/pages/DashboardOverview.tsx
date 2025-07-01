import React from 'react';
import Sidebar from '../components/Sidebar';
import MetricCard from '../components/MetricCard';
import Chart from '../components/Chart';
import './DashboardOverview.scss';

export default function DashboardOverview() {
  const chartData = [45, 55, 35, 48, 52, 58, 50, 48, 55, 60, 48, 35];
  const chartLabels = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

  const subscriptions = [
    {
      name: 'Supabase',
      price: '$599',
      period: '/year',
      status: 'Paid',
      statusColor: 'green',
      icon: '🚀'
    },
    {
      name: 'Vercel',
      price: '$20',
      period: '/month',
      status: 'Expiring',
      statusColor: 'orange',
      icon: '▲'
    },
    {
      name: 'Auth0',
      price: '$20-80',
      period: '/month',
      status: 'Canceled',
      statusColor: 'red',
      icon: '🔐'
    },
    {
      name: 'Google Cloud',
      price: '$100-200',
      period: '/month',
      status: 'Paid',
      statusColor: 'green',
      icon: '☁️'
    },
    {
      name: 'Stripe',
      price: '$70',
      period: '/month',
      status: 'Paid',
      statusColor: 'green',
      icon: 'S'
    }
  ];

  return (
    <div className="dashboard-layout">
      <Sidebar activeItem="overview" />
      
      <div className="main-content">
        <div className="content-header">
          <div className="header-left">
            <h1>Overview</h1>
          </div>
          <div className="header-right">
            <button className="btn-primary">+ Dashboard</button>
          </div>
        </div>

        <div className="content-body">
          <div className="metrics-grid">
            <MetricCard
              title="Tickets"
              value="31"
              icon="🎫"
              trend={{
                value: 15,
                direction: 'up',
                label: 'increase vs last month'
              }}
            />
            <MetricCard
              title="Sign ups"
              value="240"
              icon="👥"
              trend={{
                value: 5,
                direction: 'down',
                label: 'decrease vs last month'
              }}
            />
            <MetricCard
              title="Open issues"
              value="21"
              icon="⚠️"
              trend={{
                value: 12,
                direction: 'up',
                label: 'increase vs last month'
              }}
            />
          </div>

          <div className="dashboard-grid">
            <div className="chart-section">
              <div className="app-usage-header">
                <h2>App usage</h2>
                <div className="usage-stats">
                  <span className="usage-increase">+28%</span>
                  <span className="usage-description">
                    increase in app usage with 6,521 new products purchased
                  </span>
                </div>
              </div>
              <Chart
                title=""
                data={chartData}
                labels={chartLabels}
                height={300}
                color="#3b82f6"
              />
            </div>

            <div className="subscriptions-section">
              <div className="subscriptions-header">
                <h2>Our subscriptions</h2>
                <div className="subscriptions-icon">💳</div>
              </div>
              <div className="subscriptions-list">
                {subscriptions.map((subscription, index) => (
                  <div key={index} className="subscription-item">
                    <div className="subscription-info">
                      <div className="subscription-icon">{subscription.icon}</div>
                      <div className="subscription-details">
                        <span className="subscription-name">{subscription.name}</span>
                        <span className="subscription-price">
                          {subscription.price} {subscription.period}
                        </span>
                      </div>
                    </div>
                    <div className={`subscription-status ${subscription.statusColor}`}>
                      {subscription.status}
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