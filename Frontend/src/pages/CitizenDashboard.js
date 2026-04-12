import React, { useState, useEffect, useCallback } from 'react';
import axios from 'axios';
import { useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { API_BASE_URL, API_URL } from '../config';
import { io } from 'socket.io-client';
import { LocalNotifications } from '@capacitor/local-notifications';
import '../styles/CitizenDashboard.css';
import EmergencyAlertSystem from '../components/EmergencyAlertSystem';
import LanguageSelector from '../components/LanguageSelector';

const STATUS_META = {
  reported:    { label: 'Reported',    color: '#f59e0b', bg: '#fef3c7', icon: '📝' },
  in_progress: { label: 'In Progress', color: '#3b82f6', bg: '#dbeafe', icon: '🔧' },
  resolved:    { label: 'Resolved',    color: '#10b981', bg: '#d1fae5', icon: '✅' },
  rejected:    { label: 'Rejected',    color: '#ef4444', bg: '#fee2e2', icon: '❌' },
};

const PRIORITY_META = {
  low:      { label: 'Low',      color: '#6b7280', bg: '#f3f4f6' },
  medium:   { label: 'Medium',   color: '#d97706', bg: '#fef3c7' },
  critical: { label: 'Critical', color: '#dc2626', bg: '#fee2e2' },
};

const ISSUE_ICONS = {
  pothole:      '🕳️',
  garbage:      '🗑️',
  water_leak:   '💧',
  damaged_road: '🚧',
  streetlight:  '💡',
  sewage:       '🪣',
  other:        '📌',
};

function CitizenDashboard() {
  const [issues, setIssues]     = useState([]);
  const [error, setError]       = useState('');
  const [loading, setLoading]   = useState(true);
  const [filter, setFilter]     = useState('all');
  const [expanded, setExpanded] = useState(null);
  const [notification, setNotification] = useState('');
  const [ringtone, setRingtone] = useState(localStorage.getItem('ringtone') || 'triangle');
  const { t } = useTranslation();
  const navigate = useNavigate();

  const token = localStorage.getItem('token');
  const user  = JSON.parse(localStorage.getItem('user') || '{}');

  const fetchUserIssues = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const response = await axios.get(`${API_URL}/issues/user/my-issues`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      setIssues(response.data.data || []);
    } catch (err) {
      setError('Failed to fetch your complaints. Please try again.');
      console.error(err);
    } finally {
      setLoading(false);
    }
  }, [token]);

  useEffect(() => {
    if (!token) { navigate('/login'); return; }

    fetchUserIssues();
    
    // Request Native Notification Permissions
    const requestPermissions = async () => {
      const status = await LocalNotifications.checkPermissions();
      if (status.display !== 'granted') {
        await LocalNotifications.requestPermissions();
      }
    };
    requestPermissions();

    const playUserAlert = () => {
      try {
        const context = new (window.AudioContext || window.webkitAudioContext)();
        const now = context.currentTime;
        const g = context.createGain();
        g.gain.setValueAtTime(0.08, now);
        g.connect(context.destination);

        const o = context.createOscillator();
        let freq = 720;
        let type = 'triangle';

        if (ringtone === 'sine') {
          type = 'sine';
          freq = 880;
        } else if (ringtone === 'square') {
          type = 'square';
          freq = 660;
        } else if (ringtone === 'sawtooth') {
          type = 'sawtooth';
          freq = 520;
        }

        o.type = type;
        o.frequency.setValueAtTime(freq, now);
        o.connect(g);

        o.start(now);
        o.stop(now + 0.18);

        if (ringtone === 'chime') {
          const o2 = context.createOscillator();
          o2.type = 'triangle';
          o2.frequency.setValueAtTime(freq * 1.5, now + 0.14);
          o2.connect(g);
          o2.start(now + 0.14);
          o2.stop(now + 0.34);
        }
      } catch (e) {
        console.warn('Notification sound failed', e);
      }
    };

    const socket = io(API_BASE_URL);

    socket.on('new_issue', (issue) => {
      if (issue.reportedBy === user.id || issue.reportedBy?._id === user.id) {
        setNotification('✅ Your complaint has been submitted and recorded live.');
      }
      fetchUserIssues();
      playUserAlert();
    });

    socket.on('issue_updated', async (updatedIssue) => {
      const reporterId = updatedIssue.reportedBy?.id || updatedIssue.reportedBy?._id || updatedIssue.reportedBy;
      if (reporterId === user.id) {
        setNotification(`🔔 Complaint update: status changed to ${updatedIssue.status}.`);
        
        // Native Mobile Notification
        await LocalNotifications.schedule({
          notifications: [
            {
              title: updatedIssue.status === 'resolved' ? '🎉 Issue Resolved!' : '📋 CivicSense Update',
              body: `Your report about "${updatedIssue.issueType}" has been updated to: ${updatedIssue.status.toUpperCase()}`,
              id: Math.floor(Math.random() * 1000),
              schedule: { at: new Date(Date.now() + 1000) },
              sound: 'beep.wav',
              attachments: [],
              actionTypeId: "",
              extra: null
            }
          ]
        });

        if (updatedIssue.status === 'resolved') {
          setNotification('🎉 Your complaint has been resolved. Great news!');
        }
      }
      fetchUserIssues();
      playUserAlert();
    });

    return () => socket.disconnect();
  }, [token, navigate, fetchUserIssues, user.id, ringtone]);

  const handleLogout = () => {
    localStorage.removeItem('token');
    localStorage.removeItem('user');
    navigate('/login');
  };

  // Stats
  const total      = issues.length;
  const resolved   = issues.filter(i => i.status === 'resolved').length;
  const inProgress = issues.filter(i => i.status === 'in_progress').length;
  const pending    = issues.filter(i => i.status === 'reported').length;

  const filtered = filter === 'all' ? issues : issues.filter(i => i.status === filter);

  const formatDate = (d) => new Date(d).toLocaleDateString('en-IN', {
    day: '2-digit', month: 'short', year: 'numeric'
  });

  const getImageSrc = (issue) => {
    if (!issue.image) return null;
    if (issue.image.startsWith('http')) return issue.image;
    return `${API_BASE_URL}/uploads/${issue.image}`;
  };

  return (
    <div className="cd-root">
      {/* Sidebar */}
      <aside className="cd-sidebar">
        <div className="cd-brand">
          <span className="cd-brand-icon">🏛️</span>
          <div>
            <div className="cd-brand-name">CivicSense</div>
            <div className="cd-brand-sub">Citizen Portal</div>
          </div>
        </div>

        <nav className="cd-nav">
          <button className="cd-nav-item active">
            <span>📋</span> {t('dashboard.citizenTitle')}
          </button>
          <button className="cd-nav-item" onClick={() => navigate('/report-issue')}>
            <span>➕</span> {t('dashboard.reportIssue')}
          </button>
          <button className="cd-nav-item" onClick={() => navigate('/analytics')}>
            <span>📊</span> City Analytics
          </button>
        </nav>

        <div className="cd-user-card">
          <div className="cd-avatar">{user.name ? user.name[0].toUpperCase() : 'U'}</div>
          <div className="cd-user-info">
            <div className="cd-user-name">{user.name || 'Citizen'}</div>
            <div className="cd-user-email">{user.email || ''}</div>
          </div>
          <button className="cd-logout-btn" onClick={handleLogout} title="Logout">⏻</button>
        </div>
      </aside>

      {/* Main Content */}
      <main className="cd-main">
        {/* Emergency Alert System */}
        <EmergencyAlertSystem />

        {/* Top Header */}
        <div className="cd-topbar">
          <div>
            <h1 className="cd-title">{t('dashboard.citizenTitle')}</h1>
            <p className="cd-subtitle">{t('dashboard.subtitle')}</p>

          </div>
          <div className="cd-topbar-actions" style={{ alignItems: 'center' }}>
            <LanguageSelector />
            <label style={{ marginRight: 8, fontSize: 14, marginLeft: 16 }} htmlFor="ringtone-select">Ringtone:</label>
            <select
              id="ringtone-select"
              value={ringtone}
              onChange={(e) => {
                setRingtone(e.target.value);
                localStorage.setItem('ringtone', e.target.value);
              }}
              style={{ marginRight: 12, padding: '6px 10px', borderRadius: 4, border: '1px solid #ccc' }}
            >
              <option value="triangle">Classic</option>
              <option value="sine">Soft Chime</option>
              <option value="square">Alert</option>
              <option value="sawtooth">Buzz</option>
              <option value="chime">Melody</option>
            </select>
            <button className="cd-refresh-btn" onClick={fetchUserIssues} title="Refresh">🔄 Refresh</button>
            <button className="cd-report-btn" onClick={() => navigate('/report-issue')}>
              ➕ {t('dashboard.reportIssue')}
            </button>
          </div>
        </div>

        {/* Notification alert */}
        {notification && (
          <div className="cd-notification" style={{ margin: '0 0 16px', padding: '12px', background: '#eaf7f0', color: '#065f46', borderRadius: '8px', border: '1px solid #b7ebde' }}>
            {notification}
            <button onClick={() => setNotification('')} style={{ marginLeft: '12px', background: 'transparent', border: 'none', fontWeight: 'bold', cursor: 'pointer', color: '#064e3b' }}>✕</button>
          </div>
        )}

        {/* Stats Row */}
        <div className="cd-stats">
          <div className="cd-stat-card cd-stat-total">
            <div className="cd-stat-icon">📊</div>
            <div className="cd-stat-num">{total}</div>
            <div className="cd-stat-label">{t('dashboard.totalComplaints')}</div>
          </div>
          <div className="cd-stat-card cd-stat-pending">
            <div className="cd-stat-icon">📝</div>
            <div className="cd-stat-num">{pending}</div>
            <div className="cd-stat-label">{t('dashboard.pendingReview')}</div>
          </div>
          <div className="cd-stat-card cd-stat-progress">
            <div className="cd-stat-icon">🔧</div>
            <div className="cd-stat-num">{inProgress}</div>
            <div className="cd-stat-label">{t('dashboard.inProgress')}</div>
          </div>
          <div className="cd-stat-card cd-stat-resolved">
            <div className="cd-stat-icon">✅</div>
            <div className="cd-stat-num">{resolved}</div>
            <div className="cd-stat-label">{t('dashboard.resolved')}</div>
          </div>
        </div>

        {/* Filter Tabs */}
        <div className="cd-filters">
          {['all', 'reported', 'in_progress', 'resolved', 'rejected'].map(f => (
            <button
              key={f}
              className={`cd-filter-btn ${filter === f ? 'cd-filter-active' : ''}`}
              onClick={() => setFilter(f)}
            >
              {f === 'all' ? '🗂️ All' : `${STATUS_META[f]?.icon} ${STATUS_META[f]?.label}`}
              <span className="cd-filter-count">
                {f === 'all' ? total : issues.filter(i => i.status === f).length}
              </span>
            </button>
          ))}
        </div>

        {error && (
          <div className="cd-error">
            ⚠️ {error}
            <button onClick={fetchUserIssues}>Retry</button>
          </div>
        )}

        {/* Complaints List */}
        {loading ? (
          <div className="cd-loading">
            <div className="cd-spinner"></div>
            <p>{t('dashboard.loadingComplaints')}</p>
          </div>
        ) : filtered.length === 0 ? (
          <div className="cd-empty">
            <div className="cd-empty-icon">📭</div>
            <h3>{t('dashboard.noComplaints')}</h3>
            <p>{filter === 'all' ? t('dashboard.noComplaintsYet') : `${t('dashboard.no', { status: STATUS_META[filter]?.label || filter })} complaints.`}</p>
            {filter === 'all' && (
              <button className="cd-report-btn" onClick={() => navigate('/report-issue')}>
                Report Your First Issue
              </button>
            )}
          </div>
        ) : (
          <div className="cd-complaints-list">
            {filtered.map((issue) => {
              const status   = STATUS_META[issue.status]   || STATUS_META.reported;
              const priority = PRIORITY_META[issue.priority] || PRIORITY_META.low;
              const icon     = ISSUE_ICONS[issue.issueType] || '📌';
              const imgSrc   = getImageSrc(issue);
              const isOpen   = expanded === issue._id;

              return (
                <div key={issue._id} className={`cd-complaint-card ${isOpen ? 'cd-card-open' : ''}`}>
                  {/* Card Header */}
                  <div className="cd-card-header" onClick={() => setExpanded(isOpen ? null : issue._id)}>
                    <div className="cd-card-left">
                      <div className="cd-issue-icon">{icon}</div>
                      <div className="cd-card-info">
                        <div className="cd-card-title">
                          {issue.title || issue.issueType?.replace(/_/g, ' ') || 'Civic Issue'}
                        </div>
                        <div className="cd-card-meta">
                          <span>📍 {issue.location?.streetName || 'Unknown Street'}, {issue.location?.city || ''}</span>
                          <span>📅 {formatDate(issue.createdAt)}</span>
                        </div>
                      </div>
                    </div>
                    <div className="cd-card-right">
                      <span className="cd-status-badge" style={{ color: status.color, background: status.bg }}>
                        {status.icon} {status.label}
                      </span>
                      <span className="cd-priority-badge" style={{ color: priority.color, background: priority.bg }}>
                        {priority.label}
                      </span>
                      <span className="cd-card-chevron">{isOpen ? '▲' : '▼'}</span>
                    </div>
                  </div>

                  {/* Expanded Detail */}
                  {isOpen && (
                    <div className="cd-card-body">
                      {imgSrc && (
                        <div className="cd-card-img-wrap">
                          <img src={imgSrc} alt="Issue" className="cd-card-img" />
                        </div>
                      )}

                      <div className="cd-card-details">
                        <div className="cd-detail-row">
                          <div className="cd-detail-item">
                            <span className="cd-detail-label">Issue Type</span>
                            <span className="cd-detail-value">{icon} {issue.issueType?.replace(/_/g, ' ')}</span>
                          </div>
                          <div className="cd-detail-item">
                            <span className="cd-detail-label">Priority</span>
                            <span className="cd-detail-value" style={{ color: priority.color }}>{priority.label}</span>
                          </div>
                          <div className="cd-detail-item">
                            <span className="cd-detail-label">Status</span>
                            <span className="cd-detail-value" style={{ color: status.color }}>{status.icon} {status.label}</span>
                          </div>
                          <div className="cd-detail-item">
                            <span className="cd-detail-label">Date Reported</span>
                            <span className="cd-detail-value">{formatDate(issue.createdAt)}</span>
                          </div>
                        </div>

                        <div className="cd-detail-full">
                          <span className="cd-detail-label">Description</span>
                          <p className="cd-detail-desc">{issue.description}</p>
                        </div>

                        <div className="cd-detail-row">
                          <div className="cd-detail-item">
                            <span className="cd-detail-label">Street</span>
                            <span className="cd-detail-value">{issue.location?.streetName || '—'}</span>
                          </div>
                          <div className="cd-detail-item">
                            <span className="cd-detail-label">Area</span>
                            <span className="cd-detail-value">{issue.location?.area || '—'}</span>
                          </div>
                          <div className="cd-detail-item">
                            <span className="cd-detail-label">City</span>
                            <span className="cd-detail-value">{issue.location?.city || '—'}</span>
                          </div>
                          <div className="cd-detail-item">
                            <span className="cd-detail-label">District</span>
                            <span className="cd-detail-value">{issue.location?.district || '—'}</span>
                          </div>
                          <div className="cd-detail-item">
                            <span className="cd-detail-label">State</span>
                            <span className="cd-detail-value">{issue.location?.state || '—'}</span>
                          </div>
                          <div className="cd-detail-item">
                            <span className="cd-detail-label">Municipality</span>
                            <span className="cd-detail-value">{issue.location?.municipality || '—'}</span>
                          </div>
                          {issue.latitude && (
                            <div className="cd-detail-item">
                              <span className="cd-detail-label">Coordinates</span>
                              <span className="cd-detail-value">
                                {Number(issue.latitude).toFixed(5)}, {Number(issue.longitude).toFixed(5)}
                              </span>
                            </div>
                          )}
                        </div>

                        {issue.comments && (
                          <div className="cd-admin-comment">
                            <span className="cd-detail-label">💬 Admin Comments</span>
                            <p>{issue.comments}</p>
                          </div>
                        )}

                        {/* Progress Images Timeline */}
                        {issue.progressImages && issue.progressImages.length > 0 && (
                          <div style={{ marginTop: '16px', borderTop: '2px solid #e5e7eb', paddingTop: '14px' }}>
                            <span className="cd-detail-label" style={{ display: 'flex', alignItems: 'center', gap: '6px', marginBottom: '10px' }}>
                              📸 {t('dashboard.progressImages')}
                            </span>
                            <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                              {issue.progressImages.map((prog, idx) => (
                                <div key={idx} style={{
                                  padding: '10px',
                                  borderRadius: '8px',
                                  border: '1px solid ' + (prog.status === 'resolved' ? '#86efac' : prog.status === 'rejected' ? '#fca5a5' : '#93c5fd'),
                                  background: prog.status === 'resolved' ? '#f0fdf4' : prog.status === 'rejected' ? '#fef2f2' : '#eff6ff'
                                }}>
                                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '6px' }}>
                                    <span style={{
                                      padding: '2px 8px',
                                      borderRadius: '10px',
                                      fontSize: '11px',
                                      fontWeight: 700,
                                      color: '#fff',
                                      background: prog.status === 'resolved' ? '#10b981' : prog.status === 'rejected' ? '#ef4444' : '#3b82f6'
                                    }}>
                                      {prog.status === 'resolved' ? '✅ Resolved' : prog.status === 'rejected' ? '❌ Rejected' : '🔧 In Progress'}
                                    </span>
                                    <span style={{ fontSize: '11px', color: '#9ca3af' }}>
                                      {new Date(prog.timestamp).toLocaleString()}
                                    </span>
                                  </div>
                                  {prog.image && (
                                    <img
                                      src={prog.image}
                                      alt={`Progress ${idx + 1}`}
                                      style={{
                                        maxWidth: '100%',
                                        maxHeight: '180px',
                                        borderRadius: '6px',
                                        objectFit: 'cover',
                                        marginBottom: prog.comments ? '6px' : 0,
                                        display: 'block'
                                      }}
                                      onError={(e) => { e.target.style.display = 'none'; }}
                                    />
                                  )}
                                  {prog.comments && (
                                    <p style={{ margin: 0, fontSize: '12px', color: '#374151' }}>
                                      💬 {prog.comments}
                                    </p>
                                  )}
                                </div>
                              ))}
                            </div>
                          </div>
                        )}

                        {issue.resolutionDate && (
                          <div className="cd-resolved-badge">
                            ✅ Resolved on {formatDate(issue.resolutionDate)}
                          </div>
                        )}

                        {issue.latitude && issue.longitude && (
                          <a
                            className="cd-maps-link"
                            href={`https://www.google.com/maps?q=${issue.latitude},${issue.longitude}`}
                            target="_blank"
                            rel="noreferrer"
                          >
                            🗺️ View on Google Maps
                          </a>
                        )}
                      </div>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </main>
    </div>
  );
}

export default CitizenDashboard;
