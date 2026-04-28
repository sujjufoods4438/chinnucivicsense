import React, { useState, useEffect, useCallback } from 'react';
import axios from 'axios';
import { useNavigate } from 'react-router-dom';
import { API_BASE_URL } from '../config';
import '../styles/Dashboard.css';
import { io } from 'socket.io-client';
import { MapContainer, TileLayer, CircleMarker, Popup } from 'react-leaflet';
import 'leaflet/dist/leaflet.css';

function AdminDashboard() {
  const [issues, setIssues] = useState([]);
  const [statistics, setStatistics] = useState(null);
  const [selectedIssue, setSelectedIssue] = useState(null);
  const [filterStatus, setFilterStatus] = useState('all');
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [loading, setLoading] = useState(true);
  const [unreadCount, setUnreadCount] = useState(0);
  const navigate = useNavigate();

  const adminToken = localStorage.getItem('adminToken');

  const fetchIssues = useCallback(async () => {
    try {
      const response = await axios.get(`${API_BASE_URL}/api/issues`, {
        headers: {
          Authorization: `Bearer ${adminToken}`
        }
      });
      setIssues(response.data.data);
    } catch (err) {
      setError('Failed to fetch issues');
      console.error(err);
    } finally {
      setLoading(false);
    }
  }, [adminToken]);

  const fetchStatistics = useCallback(async () => {
    try {
      const response = await axios.get(`${API_BASE_URL}/api/issues/stats/dashboard`, {
        headers: {
          Authorization: `Bearer ${adminToken}`
        }
      });
      setStatistics(response.data.data);
    } catch (err) {
      console.error('Failed to fetch statistics');
    }
  }, [adminToken]);

  useEffect(() => {
    if (!adminToken) {
      navigate('/admin-login');
      return;
    }
    fetchIssues();
    fetchStatistics();

    // Socket.io Real-time connection
    const socket = io(API_BASE_URL);
    socket.on('new_issue', (issue) => {
      setIssues(prev => [issue, ...prev]);
      setUnreadCount(prev => prev + 1);
      fetchStatistics();
    });

    socket.on('issue_updated', (updatedIssue) => {
      setIssues(prev => prev.map(i => i._id === updatedIssue._id ? updatedIssue : i));
      setUnreadCount(prev => prev + 1);
      fetchStatistics();
    });

    return () => socket.disconnect();
  }, [adminToken, navigate, fetchIssues, fetchStatistics]);

  const handleUpdateIssue = async (issueId, updateData) => {
    try {
      const response = await axios.put(
        `${API_BASE_URL}/api/issues/${issueId}`,
        updateData,
        {
          headers: {
            Authorization: `Bearer ${adminToken}`
          }
        }
      );
      console.info('Update response:', response.data);
      setSelectedIssue(response.data.data);
      setSuccess('Issue updated successfully');
      // refresh lists and make updated item visible
      await fetchIssues();
      await fetchStatistics();
      setFilterStatus('all');
    } catch (err) {
      console.error('Update failed', err);
      const msg = err.response?.data?.message || err.message || 'Unknown error';
      setError('Failed to update issue: ' + msg);
    }
  };

  const handleStatusChange = (issueId, newStatus) => {
    handleUpdateIssue(issueId, { status: newStatus });
  };



  const handleLogout = () => {
    localStorage.removeItem('adminToken');
    localStorage.removeItem('adminUser');
    navigate('/admin-login');
  };

  const filteredIssues = filterStatus === 'all' 
    ? issues 
    : issues.filter(issue => issue.status === filterStatus);

  return (
    <div className="admin-dashboard">
      <header className="dashboard-header">
        <h1>Admin Dashboard - CivicSense AI</h1>
        <div className="header-actions" style={{ alignItems: 'center' }}>
          <div className="notification-bell" onClick={() => setUnreadCount(0)} style={{ position: 'relative', cursor: 'pointer', marginRight: '15px' }}>
            🔔
            {unreadCount > 0 && <span style={{ position: 'absolute', top: -5, right: -10, background: 'red', color: 'white', borderRadius: '50%', padding: '2px 6px', fontSize: '12px' }}>{unreadCount}</span>}
          </div>
          <button className="logout-btn" onClick={handleLogout}>Logout</button>
        </div>
      </header>

      {error && <div className="error-message">{error}</div>}
      {success && <div style={{ margin: 20, padding: 12, background: '#d4edda', color: '#155724', borderRadius: 6 }}>{success}</div>}

      {statistics && (
        <div className="statistics-section">
          <h2>Dashboard Statistics</h2>
          <div className="stats-grid">
            <div className="stat-card">
              <h3>Total Issues</h3>
              <p className="stat-value">{statistics.totalIssues}</p>
            </div>
            <div className="stat-card">
              <h3>Resolved</h3>
              <p className="stat-value">{statistics.resolvedIssues}</p>
            </div>
            <div className="stat-card">
              <h3>In Progress</h3>
              <p className="stat-value">{statistics.inProgressIssues}</p>
            </div>
            <div className="stat-card">
              <h3>Reported</h3>
              <p className="stat-value">{statistics.reportedIssues}</p>
            </div>
            <div className="stat-card">
              <h3>Rejected</h3>
              <p className="stat-value">{statistics.rejectedIssues || 0}</p>
            </div>
          </div>
        </div>
      )}

      <div className="issues-section">
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <h2>Live Issue Map (Heatmap)</h2>
          <div className="heatmap-legend" style={{ display: 'flex', gap: '15px', background: '#f8f9fa', padding: '8px 15px', borderRadius: '20px', fontSize: '14px', fontWeight: 'bold' }}>
            <span><span style={{color: 'red'}}>🔴</span> Critical</span>
            <span><span style={{color: '#f1c40f'}}>🟡</span> Medium</span>
            <span><span style={{color: 'green'}}>🟢</span> Low</span>
          </div>
        </div>
        <div style={{ height: '400px', width: '100%', marginBottom: '30px', borderRadius: '8px', overflow: 'hidden', boxShadow: '0 2px 10px rgba(0,0,0,0.1)' }}>
          <MapContainer center={[16.506174, 80.648015]} zoom={12} style={{ height: '100%', width: '100%' }}>
            <TileLayer
              attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
              url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
            />
            {issues.map(issue => {
              if (issue.location && issue.location.latitude && issue.location.longitude) {
                const color = issue.priority === 'critical' || issue.priority === 'high' ? 'red' : issue.priority === 'medium' ? '#f1c40f' : 'green';
                return (
                  <CircleMarker
                    key={issue._id}
                    center={[issue.location.latitude, issue.location.longitude]}
                    pathOptions={{ color, fillColor: color, fillOpacity: 0.6 }}
                    radius={10}
                  >
                    <Popup>
                      <strong>{issue.issueType}</strong><br/>
                      {issue.status}
                    </Popup>
                  </CircleMarker>
                );
              }
              return null;
            })}
          </MapContainer>
        </div>

        <h2>Issue Management</h2>
        
        <div className="filter-section">
          <label>Filter by Status:</label>
          <select value={filterStatus} onChange={(e) => setFilterStatus(e.target.value)}>
            <option value="all">All Issues</option>
            <option value="reported">Reported</option>
            <option value="in_progress">In Progress</option>
            <option value="resolved">Resolved</option>
            <option value="rejected">Rejected</option>
          </select>
        </div>

        {loading ? (
          <p>Loading issues...</p>
        ) : filteredIssues.length === 0 ? (
          <p>No issues found</p>
        ) : (
          <div className="issues-list">
            {filteredIssues.map((issue) => (
              <div key={issue._id} className="issue-card">
                <div className="issue-header">
                  <h3>{issue.issueType}</h3>
                  <div style={{ display: 'flex', gap: 10 }}>
                    <span className={`status-badge ${issue.status}`}>{issue.status}</span>
                    <span style={{ 
                      padding: '4px 8px', borderRadius: '12px', fontSize: '12px', fontWeight: 'bold', color: 'white',
                      backgroundColor: issue.priority === 'critical' || issue.priority === 'high' ? '#e74c3c' : issue.priority === 'medium' ? '#f1c40f' : '#2ecc71'
                    }}>
                      ⚡ {issue.priority ? issue.priority.toUpperCase() : 'LOW'}
                    </span>
                  </div>
                </div>
                {issue.image && (
                  <div style={{ margin: '12px 0' }}>
                    <img
                      src={issue.image}
                      alt="issue"
                      className="issue-thumb"
                      onError={(e) => { e.target.style.display = 'none'; }}
                    />
                  </div>
                )}
                <p><strong>Description:</strong> {issue.description}</p>
                <p><strong>Location:</strong> {issue.location.streetName}, {issue.location.city}</p>
                <p><strong>Reporter:</strong> {issue.reportedBy?.name || 'Unknown'}</p>
                <p><strong>Reported on:</strong> {new Date(issue.createdAt).toLocaleDateString()}</p>

                <div className="issue-actions">
                  <select 
                    value={issue.status} 
                    onChange={(e) => handleStatusChange(issue._id, e.target.value)}
                  >
                    <option value="reported">Reported</option>
                    <option value="in_progress">In Progress</option>
                    <option value="resolved">Resolved</option>
                    <option value="rejected">Rejected</option>
                  </select>

                  {/* Priority removed */}

                  <button 
                    className="btn-view-details"
                    onClick={() => setSelectedIssue(issue)}
                  >
                    View Details
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {selectedIssue && (
        <div className="modal-overlay" onClick={() => setSelectedIssue(null)}>
          <div className="modal-content" onClick={(e) => e.stopPropagation()}>
            <button className="close-btn" onClick={() => setSelectedIssue(null)}>×</button>
            <h2>Issue Details</h2>
              <div className="issue-details">
              <p><strong>Issue Type:</strong> {selectedIssue.issueType}</p>
              {selectedIssue.image && (
                <div style={{ margin: '12px 0' }}>
                  <img src={selectedIssue.image} alt="detail" style={{ maxWidth: '100%', borderRadius: 6 }} onError={(e)=>{e.target.style.display='none'}} />
                </div>
              )}
              <p><strong>Description:</strong> {selectedIssue.description}</p>
              <p><strong>Status:</strong> {selectedIssue.status}</p>
              <p><strong>Reporter:</strong> {selectedIssue.reportedBy?.name}</p>
              <p><strong>Reporter Email:</strong> {selectedIssue.reportedBy?.email}</p>
              <p><strong>Reporter Phone:</strong> {selectedIssue.reportedBy?.phone || 'N/A'}</p>
              
              <h3>Location:</h3>
              <p>Street: {selectedIssue.location.streetName}</p>
              <p>Area: {selectedIssue.location.area}</p>
              <p>City: {selectedIssue.location.city}</p>
              <p>District: {selectedIssue.location.district}</p>
              <p>State: {selectedIssue.location.state}</p>
              <p>Municipality: {selectedIssue.location.municipality}</p>
              
              {selectedIssue.comments && (
                <p><strong>Comments:</strong> {selectedIssue.comments}</p>
              )}
              
              <p><strong>Reported on:</strong> {new Date(selectedIssue.createdAt).toLocaleString()}</p>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

export default AdminDashboard;
