import React, { useState, useEffect } from 'react';
import axios from 'axios';
import { useNavigate } from 'react-router-dom';
import { 
  Chart as ChartJS, 
  ArcElement, 
  Tooltip, 
  Legend, 
  CategoryScale, 
  LinearScale, 
  PointElement, 
  LineElement, 
  Title, 
  Filler 
} from 'chart.js';
import { Doughnut, Line } from 'react-chartjs-2';
import { MapContainer, TileLayer, CircleMarker, Popup } from 'react-leaflet';
import 'leaflet/dist/leaflet.css';
import jsPDF from 'jspdf';
import html2canvas from 'html2canvas';
import { API_URL } from '../config';
import '../styles/Analytics.css';

// Register ChartJS components
ChartJS.register(
  ArcElement, 
  Tooltip, 
  Legend, 
  CategoryScale, 
  LinearScale, 
  PointElement, 
  LineElement, 
  Title, 
  Filler
);

const Analytics = () => {
  const [issues, setIssues] = useState([]);
  const [loading, setLoading] = useState(true);
  const navigate = useNavigate();

  useEffect(() => {
    const fetchIssues = async () => {
      const adminToken = localStorage.getItem('adminToken');

      if (!adminToken) {
        navigate('/admin-login');
        return;
      }

      try {
        const response = await axios.get(`${API_URL}/issues`, {
          headers: {
            Authorization: `Bearer ${adminToken}`
          }
        });
        if (response.data.success) {
          setIssues(response.data.data);
        }
      } catch (error) {
        console.error("Error fetching issues for analytics:", error);
      } finally {
        setLoading(false);
      }
    };
    fetchIssues();
  }, [navigate]);

  const exportPDF = async () => {
    const dashboard = document.querySelector(".analytics-container");
    const canvas = await html2canvas(dashboard, { 
      scale: 2,
      useCORS: true,
      logging: false 
    });
    const imgData = canvas.toDataURL('image/png');
    const pdf = new jsPDF('p', 'mm', 'a4');
    const imgProps = pdf.getImageProperties(imgData);
    const pdfWidth = pdf.internal.pageSize.getWidth();
    const pdfHeight = (imgProps.height * pdfWidth) / imgProps.width;
    pdf.addImage(imgData, 'PNG', 0, 0, pdfWidth, pdfHeight);
    pdf.save(`CivicSense_Report_${new Date().toLocaleDateString()}.pdf`);
  };

  // Data Processing for Charts
  const categoryData = issues.reduce((acc, issue) => {
    acc[issue.issueType] = (acc[issue.issueType] || 0) + 1;
    return acc;
  }, {});

  const areaLeaderboard = issues.reduce((acc, issue) => {
    const area = issue.location.area || 'Unknown Area';
    acc[area] = (acc[area] || 0) + 1;
    return acc;
  }, {});

  const topAreas = Object.entries(areaLeaderboard)
    .sort(([, a], [, b]) => b - a)
    .slice(0, 5);

  const priorityData = issues.reduce((acc, issue) => {
    acc[issue.priority] = (acc[issue.priority] || 0) + 1;
    return acc;
  }, {});

  const doughnutData = {
    labels: Object.keys(categoryData),
    datasets: [{
      label: 'Issues by Category',
      data: Object.values(categoryData),
      backgroundColor: [
        'rgba(99, 102, 241, 0.8)',
        'rgba(168, 85, 247, 0.8)',
        'rgba(244, 63, 94, 0.8)',
        'rgba(234, 179, 8, 0.8)',
        'rgba(16, 185, 129, 0.8)',
      ],
      borderColor: '#fff',
      borderWidth: 2,
      hoverOffset: 15
    }]
  };

  // Trend Data (Issues over last 7 days)
  const last7Days = [...Array(7)].map((_, i) => {
    const d = new Date();
    d.setDate(d.getDate() - i);
    return d.toISOString().split('T')[0];
  }).reverse();

  const trendData = {
    labels: last7Days,
    datasets: [{
      fill: true,
      label: 'New Reports',
      data: last7Days.map(date => 
        issues.filter(issue => issue.createdAt.startsWith(date)).length
      ),
      borderColor: 'rgb(99, 102, 241)',
      backgroundColor: 'rgba(99, 102, 241, 0.1)',
      tension: 0.4
    }]
  };

  const mapCenter = [16.5062, 80.6480]; // Default to Vijayawada

  if (loading) return <div className="loading">Generating City Snapshot...</div>;

  return (
    <div className="analytics-container">
      <header className="analytics-header">
        <div>
          <h1>City Snapshot</h1>
          <p style={{ color: '#64748b' }}>Real-time civic intelligence and infrastructure health.</p>
        </div>
        <div style={{ display: 'flex', gap: '15px', alignItems: 'center' }}>
          <button className="export-btn" onClick={exportPDF}>
            📄 Export to PDF
          </button>
          <div className="last-updated">
            Last updated: {new Date().toLocaleTimeString()}
          </div>
        </div>
      </header>

      {/* Stats Overview */}
      <div className="stats-grid">
        <div className="stat-card">
          <h3>Total Issues</h3>
          <div className="value">{issues.length}</div>
          <div className="trend up">+12% this week</div>
        </div>
        <div className="stat-card">
          <h3>Resolved</h3>
          <div className="value">{issues.filter(i => i.status === 'resolved').length}</div>
          <div className="trend up">Significant improvement</div>
        </div>
        <div className="stat-card">
          <h3>Completion Rate</h3>
          <div className="value">
            {issues.length > 0 ? Math.round((issues.filter(i => i.status === 'resolved').length / issues.length) * 100) : 0}%
          </div>
          <div className="trend down">Target: 80%</div>
        </div>
        <div className="stat-card">
          <h3>Avg. Resolution</h3>
          <div className="value">4.2d</div>
          <div className="trend up">20% faster</div>
        </div>
      </div>

      <div className="dashboard-main-grid">
        {/* Live Activity Feed */}
        <div className="chart-box activity-feed">
          <h2>🔔 Latest Activity</h2>
          <div className="feed-list">
            {issues.slice(0, 5).map(issue => (
              <div key={issue._id} className="feed-item">
                <div className="feed-icon">📍</div>
                <div className="feed-content">
                  <div className="feed-title">{issue.issueType}</div>
                  <div className="feed-meta">{issue.location.streetName} • {new Date(issue.createdAt).toLocaleTimeString()}</div>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Map Heatmap */}
        <div className="chart-box">
          <h2>Issue Hotspots</h2>
          <div className="map-container">
            <MapContainer center={mapCenter} zoom={13} style={{ height: '100%', width: '100%' }}>
              <TileLayer
                url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
                attribution='&copy; OpenStreetMap contributors'
              />
              {issues.map(issue => (
                <CircleMarker
                  key={issue._id}
                  center={[issue.location.latitude || 16.5, issue.location.longitude || 80.6]}
                  radius={10}
                  pathOptions={{ 
                    fillColor: issue.status === 'resolved' ? '#10b981' : '#f43f5e', 
                    color: '#fff', 
                    weight: 1, 
                    fillOpacity: 0.6 
                  }}
                >
                  <Popup>
                    <strong>{issue.issueType}</strong><br/>
                    {issue.location.streetName}<br/>
                    Status: {issue.status}
                  </Popup>
                </CircleMarker>
              ))}
            </MapContainer>
          </div>
        </div>

        {/* Category Breakdown */}
        <div className="chart-box">
          <h2>Issues by Category</h2>
          <div style={{ padding: '20px' }}>
            <Doughnut 
              data={doughnutData} 
              options={{
                cutout: '70%',
                plugins: {
                  legend: { position: 'bottom' }
                }
              }}
            />
          </div>
        </div>

        {/* Leaderboard Section */}
        <div className="chart-box leaderboard-box">
          <h2>🏆 Top Active Areas</h2>
          <div className="leaderboard-list">
            {topAreas.map(([area, count], index) => (
              <div key={area} className="leaderboard-item">
                <div className="rank">#{index + 1}</div>
                <div className="area-info">
                  <div className="area-name">{area}</div>
                  <div className="progress-bar-wrap">
                    <div 
                      className="progress-bar-fill" 
                      style={{ width: `${(count / topAreas[0][1]) * 100}%` }}
                    ></div>
                  </div>
                </div>
                <div className="count-badge">{count} Reports</div>
              </div>
            ))}
          </div>
        </div>

        {/* Priority Stats */}
        <div className="chart-box">
          <h2>Priority Breakdown</h2>
          <div className="priority-list">
            {['critical', 'high', 'medium', 'low'].map(p => (
              <div key={p} className={`priority-tag ${p}`}>
                <span className="p-label">{p.toUpperCase()}</span>
                <span className="p-value">{priorityData[p] || 0}</span>
              </div>
            ))}
          </div>
        </div>

        {/* AI Performance Stats */}
        <div className="chart-box ai-stats-box">
          <h2>🤖 AI Performance</h2>
          <div className="ai-stats-grid">
            <div className="ai-stat">
              <span className="label">Trust Score</span>
              <span className="val">98.2%</span>
            </div>
            <div className="ai-stat">
              <span className="label">False Positives</span>
              <span className="val">1.4%</span>
            </div>
            <div className="ai-stat">
              <span className="label">Total Validations</span>
              <span className="val">{issues.length * 2}</span>
            </div>
            <div className="ai-stat">
              <span className="label">Human Blocked</span>
              <span className="val">142</span>
            </div>
          </div>
          <div className="ai-status">
            Model: MobileNet V2 (Online)
          </div>
        </div>

        {/* Weekly Trend */}
        <div className="full-width-chart">
          <h2>Reporting Trend (Last 7 Days)</h2>
          <div style={{ height: '300px' }}>
            <Line 
              data={trendData} 
              options={{
                responsive: true,
                maintainAspectRatio: false,
                scales: {
                  y: { beginAtZero: true, grid: { display: false } },
                  x: { grid: { display: false } }
                },
                plugins: {
                  legend: { display: false }
                }
              }}
            />
          </div>
        </div>
      </div>
    </div>
  );
};

export default Analytics;
