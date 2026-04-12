import React, { useState, useEffect, useCallback } from 'react';
import axios from 'axios';
import { useNavigate } from 'react-router-dom';
import { API_BASE_URL, API_URL } from '../config';
import '../styles/Dashboard.css';
import { io } from 'socket.io-client';
import * as tf from "@tensorflow/tfjs";
import * as mobilenet from "@tensorflow-models/mobilenet";
import { detectAIImage, classifyCivicContent } from '../utils/aiImageDetector';
import { MapContainer, TileLayer, CircleMarker, Popup } from 'react-leaflet';
import 'leaflet/dist/leaflet.css';
import { Chart as ChartJS, CategoryScale, LinearScale, BarElement, Title, Tooltip, Legend, ArcElement, LineElement, PointElement } from 'chart.js';
import { Bar, Pie, Line } from 'react-chartjs-2';

ChartJS.register(CategoryScale, LinearScale, BarElement, Title, Tooltip, Legend, ArcElement, LineElement, PointElement);

const urlBase64ToUint8Array = (base64String) => {
  const padding = '='.repeat((4 - base64String.length % 4) % 4);
  const base64 = (base64String + padding)
    .replace(/-/g, '+')
    .replace(/_/g, '/');

  const rawData = window.atob(base64);
  const outputArray = new Uint8Array(rawData.length);

  for (let i = 0; i < rawData.length; ++i) {
    outputArray[i] = rawData.charCodeAt(i);
  }
  return outputArray;
};

function AdminDashboard() {
  const [issues, setIssues] = useState([]);
  const [statistics, setStatistics] = useState(null);
  const [selectedIssue, setSelectedIssue] = useState(null);
  const [filterStatus, setFilterStatus] = useState('all');
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [unreadCount, setUnreadCount] = useState(0);
  const [loading, setLoading] = useState(true);
  const [progressImage, setProgressImage] = useState(null);
  const [progressComments, setProgressComments] = useState('');
  const [progressStatus, setProgressStatus] = useState('in_progress');
  const [uploadingProgress, setUploadingProgress] = useState(false);
  const [model, setModel] = useState(null);
  const [validatingImage, setValidatingImage] = useState(false);
  const [aiError, setAiError] = useState('');
  const navigate = useNavigate();

  const adminToken = localStorage.getItem('adminToken');

  useEffect(() => {
    const loadModel = async () => {
      try {
        await tf.ready();
        const loadedModel = await mobilenet.load({ version: 2, alpha: 1.0 });
        setModel(loadedModel);
        console.log('MobileNet model loaded for Admin Dashboard');
      } catch (err) {
        console.error('Failed to load AI model:', err);
      }
    };
    loadModel();
  }, []);

  const fetchIssues = useCallback(async () => {
    try {
      const response = await axios.get(`${API_URL}/issues`, {
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
      const response = await axios.get(`${API_URL}/issues/stats/dashboard`, {
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

    // Request notification permission and subscribe to push
    if ('serviceWorker' in navigator && 'PushManager' in window) {
      navigator.serviceWorker.ready.then((registration) => {
        registration.pushManager.getSubscription().then((existingSubscription) => {
          if (!existingSubscription) {
            registration.pushManager.subscribe({
              userVisibleOnly: true,
              applicationServerKey: urlBase64ToUint8Array('BNFv81Fm-YtTS4CRN9I2SLiDJ1lsM5ALR3qJ4SJCHgP2teBhGq_ds9HJbXoPxlBWfcQzCbTqHHMmXg50rhrWs9M')
            }).then((subscription) => {
              fetch(`${API_URL}/subscribe`, {
                method: 'POST',
                body: JSON.stringify(subscription),
                headers: { 'Content-Type': 'application/json' }
              });
            });
          }
        });
      });
    }

    // Socket.io Real-time connection
    const socket = io(API_BASE_URL);

    const playAlert = () => {
      try {
        const context = new (window.AudioContext || window.webkitAudioContext)();
        const o = context.createOscillator();
        const g = context.createGain();
        o.frequency.value = 650;
        o.type = 'sine';
        o.connect(g);
        g.connect(context.destination);
        g.gain.value = 0.1;
        o.start(0);
        o.stop(context.currentTime + 0.1);
      } catch (err) {
        console.warn('Sound alert failed', err);
      }
    };

    socket.on('new_issue', (issue) => {
      setIssues(prev => [issue, ...prev]);
      setUnreadCount(prev => prev + 1);
      setSuccess('New issue received in real time');
      fetchStatistics();
      playAlert();
    });

    socket.on('issue_updated', (updatedIssue) => {
      setIssues(prev => prev.map(i => i._id === updatedIssue._id ? updatedIssue : i));
      setUnreadCount(prev => prev + 1);
      setSuccess(`Issue updated: ${updatedIssue.issueType} (${updatedIssue.status})`);
      fetchStatistics();
      playAlert();
    });

    return () => socket.disconnect();
  }, [adminToken, navigate, fetchIssues, fetchStatistics]);

  const handleUpdateIssue = async (issueId, updateData) => {
    try {
      const response = await axios.put(
        `${API_URL}/issues/${issueId}`,
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

  const handleProgressImageUpload = async (issueId) => {
    if (!progressImage) {
      setError('Please select a progress image');
      return;
    }

    setValidatingImage(true);
    setAiError('');
    setError('');

    try {
      // Create a temporary image element for AI validation
      const img = new Image();
      const objectUrl = URL.createObjectURL(progressImage);
      
      const validationResult = await new Promise((resolve) => {
        img.onload = async () => {
          try {
            const detection = await detectAIImage(img, progressImage);
            if (!detection.isReal) {
              resolve({ valid: false, reason: detection.googleCheck?.isGoogleImage ? 'Google/Internet image detected' : 'Invalid or AI-generated image' });
              return;
            }

            if (model) {
              const predictions = await model.classify(img);
              const contentResult = await classifyCivicContent(predictions);
              
              if (contentResult.isHuman) {
                resolve({ valid: false, reason: 'Human faces or people detected in the progress image. Please upload only civic issue images.' });
                return;
              }
              if (contentResult.isDocument) {
                resolve({ valid: false, reason: 'Document or certificate detected. Please upload only civic issue images.' });
                return;
              }
              if (!contentResult.isCivic) {
                resolve({ valid: false, reason: `No relevant civic infrastructure found. AI Detected: ${contentResult.topLabel}. Upload site-related photos only.` });
                return;
              }
              
              resolve({ valid: true });
            } else {
              resolve({ valid: false, reason: 'AI Model is still initializing. Please wait a few seconds and try again.' });
            }
          } catch (e) {
            resolve({ valid: false, reason: 'Unexpected AI Validation Error: ' + e.message });
          }
        };
        img.onerror = () => resolve({ valid: false, reason: 'Failed to read image file' });
        img.src = objectUrl;
      });

      URL.revokeObjectURL(objectUrl);

      if (!validationResult.valid) {
        setAiError(validationResult.reason);
        setValidatingImage(false);
        return;
      }

      setUploadingProgress(true);
      const fd = new FormData();
      fd.append('image', progressImage);
      fd.append('status', progressStatus);
      fd.append('comments', progressComments);
      
      const response = await axios.post(
        `${API_URL}/issues/${issueId}/progress`,
        fd,
        {
          headers: {
            Authorization: `Bearer ${adminToken}`,
            'Content-Type': 'multipart/form-data'
          }
        }
      );
      
      if (response.data.success) {
        setSuccess('Progress image uploaded successfully!');
        setSelectedIssue(response.data.data);
        setProgressImage(null);
        setProgressComments('');
        await fetchIssues();
        await fetchStatistics();
      }
    } catch (err) {
      const msg = err.response?.data?.message || err.message || 'Upload failed';
      setError('Failed to upload progress image: ' + msg);
    } finally {
      setUploadingProgress(false);
      setValidatingImage(false);
    }
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
          <button onClick={() => navigate('/analytics')} style={{ marginRight: '10px', padding: '8px 16px', background: '#a855f7', color: 'white', border: 'none', borderRadius: '4px', cursor: 'pointer', fontWeight: 600 }}>
            📊 Analytics
          </button>
          <button onClick={() => navigate('/admin-live-detection')} style={{ marginRight: '10px', padding: '8px 16px', background: '#3498db', color: 'white', border: 'none', borderRadius: '4px', cursor: 'pointer', fontWeight: 600 }}>
            🎥 Live Detection
          </button>
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

      {/* Charts Section */}
      <div className="charts-section" style={{ margin: '30px 0', padding: '20px', background: '#f8f9fa', borderRadius: '8px' }}>
        <h2>Analytics Dashboard</h2>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(400px, 1fr))', gap: '20px' }}>
          {/* Bar Chart - Issues by Status */}
          <div style={{ background: 'white', padding: '20px', borderRadius: '8px', boxShadow: '0 2px 10px rgba(0,0,0,0.1)' }}>
            <Bar
              data={{
                labels: ['Reported', 'In Progress', 'Resolved', 'Rejected'],
                datasets: [{
                  label: 'Issues by Status',
                  data: [
                    statistics?.reportedIssues || 0,
                    statistics?.inProgressIssues || 0,
                    statistics?.resolvedIssues || 0,
                    statistics?.rejectedIssues || 0
                  ],
                  backgroundColor: ['#3498db', '#f1c40f', '#2ecc71', '#e74c3c'],
                  borderColor: ['#2980b9', '#f39c12', '#27ae60', '#c0392b'],
                  borderWidth: 1
                }]
              }}
              options={{
                responsive: true,
                plugins: {
                  legend: { position: 'top' },
                  title: { display: true, text: 'Issue Status Distribution' }
                }
              }}
            />
          </div>

          {/* Pie Chart - Issues by Priority */}
          <div style={{ background: 'white', padding: '20px', borderRadius: '8px', boxShadow: '0 2px 10px rgba(0,0,0,0.1)' }}>
            <Pie
              data={{
                labels: ['Low', 'Medium', 'High', 'Critical'],
                datasets: [{
                  data: [
                    statistics?.lowPriority || 0,
                    statistics?.mediumPriority || 0,
                    statistics?.highPriority || 0,
                    statistics?.criticalPriority || 0
                  ],
                  backgroundColor: ['#2ecc71', '#f1c40f', '#e67e22', '#e74c3c'],
                  borderColor: ['#27ae60', '#f39c12', '#d35400', '#c0392b'],
                  borderWidth: 1
                }]
              }}
              options={{
                responsive: true,
                plugins: {
                  legend: { position: 'right' },
                  title: { display: true, text: 'Issues by Priority Level' }
                }
              }}
            />
          </div>

          {/* Line Chart - Issues Over Time (Last 7 days) */}
          <div style={{ background: 'white', padding: '20px', borderRadius: '8px', boxShadow: '0 2px 10px rgba(0,0,0,0.1)', gridColumn: 'span 2' }}>
            <Line
              data={{
                labels: ['Day 1', 'Day 2', 'Day 3', 'Day 4', 'Day 5', 'Day 6', 'Day 7'],
                datasets: [{
                  label: 'New Issues',
                  data: [12, 19, 3, 5, 2, 3, 9],
                  borderColor: '#3498db',
                  backgroundColor: 'rgba(52, 152, 219, 0.1)',
                  tension: 0.1
                }, {
                  label: 'Resolved Issues',
                  data: [2, 3, 20, 5, 1, 4, 7],
                  borderColor: '#2ecc71',
                  backgroundColor: 'rgba(46, 204, 113, 0.1)',
                  tension: 0.1
                }]
              }}
              options={{
                responsive: true,
                plugins: {
                  legend: { position: 'top' },
                  title: { display: true, text: 'Issue Trends (Last 7 Days)' }
                },
                scales: {
                  y: { beginAtZero: true }
                }
              }}
            />
          </div>
        </div>
      </div>

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
          <div className="modal-content" onClick={(e) => e.stopPropagation()} style={{ maxHeight: '90vh', overflowY: 'auto' }}>
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

              {/* Progress Timeline */}
              <div style={{ marginTop: '20px', borderTop: '2px solid #e5e7eb', paddingTop: '16px' }}>
                <h3 style={{ margin: '0 0 12px 0', color: '#1e40af', display: 'flex', alignItems: 'center', gap: '8px' }}>
                  📸 Progress Timeline
                </h3>
                {selectedIssue.progressImages && selectedIssue.progressImages.length > 0 ? (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                    {selectedIssue.progressImages.map((prog, idx) => (
                      <div key={idx} style={{
                        padding: '12px',
                        borderRadius: '8px',
                        border: '1px solid ' + (prog.status === 'resolved' ? '#86efac' : prog.status === 'rejected' ? '#fca5a5' : '#93c5fd'),
                        background: prog.status === 'resolved' ? '#f0fdf4' : prog.status === 'rejected' ? '#fef2f2' : '#eff6ff',
                        position: 'relative'
                      }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '8px' }}>
                          <span style={{
                            padding: '2px 10px',
                            borderRadius: '12px',
                            fontSize: '12px',
                            fontWeight: 700,
                            color: '#fff',
                            background: prog.status === 'resolved' ? '#10b981' : prog.status === 'rejected' ? '#ef4444' : '#3b82f6'
                          }}>
                            {prog.status === 'resolved' ? '✅ Resolved' : prog.status === 'rejected' ? '❌ Rejected' : '🔧 In Progress'}
                          </span>
                          <span style={{ fontSize: '12px', color: '#6b7280' }}>
                            {new Date(prog.timestamp).toLocaleString()}
                          </span>
                        </div>
                        {prog.image && (
                          <img src={prog.image} alt={`Progress ${idx + 1}`} style={{
                            maxWidth: '100%',
                            maxHeight: '200px',
                            borderRadius: '6px',
                            objectFit: 'cover',
                            marginBottom: '8px'
                          }} onError={(e) => { e.target.style.display = 'none'; }} />
                        )}
                        {prog.comments && (
                          <p style={{ margin: 0, fontSize: '13px', color: '#374151' }}>
                            💬 {prog.comments}
                          </p>
                        )}
                      </div>
                    ))}
                  </div>
                ) : (
                  <p style={{ color: '#9ca3af', fontSize: '14px', fontStyle: 'italic' }}>
                    No progress updates yet
                  </p>
                )}
              </div>

              {/* Progress Image Upload */}
              <div style={{
                marginTop: '20px',
                padding: '16px',
                borderRadius: '8px',
                background: '#f8fafc',
                border: '2px dashed #cbd5e1'
              }}>
                <h3 style={{ margin: '0 0 12px 0', color: '#1e40af', fontSize: '15px' }}>
                  📤 Upload Progress Image
                </h3>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                  <div>
                    <label style={{ display: 'block', fontSize: '13px', fontWeight: 600, marginBottom: '4px', color: '#374151' }}>Status:</label>
                    <select
                      value={progressStatus}
                      onChange={(e) => setProgressStatus(e.target.value)}
                      style={{ width: '100%', padding: '8px 10px', borderRadius: '6px', border: '1px solid #d1d5db', fontSize: '14px' }}
                    >
                      <option value="in_progress">🔧 In Progress</option>
                      <option value="resolved">✅ Resolved</option>
                      <option value="rejected">❌ Rejected</option>
                    </select>
                  </div>
                  <div>
                    <label style={{ display: 'block', fontSize: '13px', fontWeight: 600, marginBottom: '4px', color: '#374151' }}>Progress Image:</label>
                    <input
                      type="file"
                      accept="image/*"
                      onChange={(e) => setProgressImage(e.target.files[0])}
                      style={{ width: '100%', padding: '6px', border: '1px solid #d1d5db', borderRadius: '6px', fontSize: '13px' }}
                    />
                  </div>
                  <div>
                    <label style={{ display: 'block', fontSize: '13px', fontWeight: 600, marginBottom: '4px', color: '#374151' }}>Comments:</label>
                    <textarea
                      value={progressComments}
                      onChange={(e) => setProgressComments(e.target.value)}
                      placeholder="Add progress notes..."
                      rows={3}
                      style={{ width: '100%', padding: '8px 10px', borderRadius: '6px', border: '1px solid #d1d5db', fontSize: '13px', resize: 'vertical' }}
                    />
                  </div>
                  {aiError && (
                    <div style={{ color: '#dc2626', fontSize: '13px', fontWeight: 600, padding: '8px', background: '#fee2e2', borderRadius: '6px', border: '1px solid #fecaca' }}>
                      ❌ AI Validation: {aiError}
                    </div>
                  )}
                  <button
                    onClick={() => handleProgressImageUpload(selectedIssue._id)}
                    disabled={uploadingProgress || validatingImage || !progressImage}
                    style={{
                      padding: '10px 16px',
                      background: (uploadingProgress || validatingImage) ? '#9ca3af' : (!progressImage ? '#d1d5db' : '#3b82f6'),
                      color: '#fff',
                      border: 'none',
                      borderRadius: '6px',
                      fontWeight: 600,
                      fontSize: '14px',
                      cursor: (uploadingProgress || validatingImage) || !progressImage ? 'not-allowed' : 'pointer'
                    }}
                  >
                    {validatingImage ? '🤖 AI Validating Image...' : uploadingProgress ? '⏳ Uploading...' : '📤 Upload Progress Image'}
                  </button>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

export default AdminDashboard;
