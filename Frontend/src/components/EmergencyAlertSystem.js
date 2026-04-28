import React, { useState, useEffect } from 'react';
import { io } from 'socket.io-client';
import { useTranslation } from 'react-i18next';
import { API_BASE_URL } from '../config';

const EmergencyAlertSystem = () => {
  const { t } = useTranslation();
  const [emergencyAlerts, setEmergencyAlerts] = useState([]);
  const [showAlerts, setShowAlerts] = useState(false);
  useEffect(() => {
    const socket = io(API_BASE_URL);

    socket.on('emergency_alert', (alert) => {
      console.log('Emergency alert received:', alert);
      setEmergencyAlerts(prev => [alert, ...prev].slice(0, 10));
      triggerEmergencySound();
      if ('Notification' in window && Notification.permission === 'granted') {
        new Notification(t('emergency.criticalIssue'), {
          body: `${alert.issueType}: ${alert.location}`,
          icon: '🚨',
          tag: 'emergency_alert',
          requireInteraction: true
        });
      }
    });

    return () => socket.disconnect();
  }, [t]);

  const triggerEmergencySound = () => {
    try {
      const context = new (window.AudioContext || window.webkitAudioContext)();
      const now = context.currentTime;

      // Multiple oscillators for alarm effect
      for (let freq of [800, 600, 800]) {
        const o = context.createOscillator();
        const g = context.createGain();
        
        o.frequency.value = freq;
        o.type = 'sine';
        g.gain.setValueAtTime(0.2, now);
        g.gain.exponentialRampToValueAtTime(0.01, now + 0.3);
        
        o.connect(g);
        g.connect(context.destination);
        
        o.start(now);
        o.stop(now + 0.3);
      }
    } catch (err) {
      console.error('Could not play emergency sound:', err);
    }
  };

  return (
    <div>
      {/* Emergency Alert Header */}
      {emergencyAlerts.length > 0 && (
        <div
          style={{
            background: 'linear-gradient(135deg, #dc2626, #991b1b)',
            color: '#fff',
            padding: '12px 16px',
            borderRadius: '8px',
            marginBottom: '16px',
            cursor: 'pointer',
            animation: 'pulse 1s infinite'
          }}
          onClick={() => setShowAlerts(!showAlerts)}
        >
          <div style={{ fontWeight: 700, fontSize: '16px', marginBottom: '4px' }}>
            🚨 {t('emergency.systemAlert')}
          </div>
          <div style={{ fontSize: '14px' }}>
            {emergencyAlerts.length} {t('dashboard.emergencyAlerts')}
          </div>
        </div>
      )}

      {/* Emergency Alerts List */}
      {showAlerts && emergencyAlerts.length > 0 && (
        <div style={{ marginBottom: '16px' }}>
          {emergencyAlerts.map((alert, idx) => (
            <div
              key={idx}
              style={{
                background: '#fef2f2',
                border: '2px solid #dc2626',
                borderRadius: '8px',
                padding: '12px',
                marginBottom: '8px'
              }}
            >
              <div style={{ fontWeight: 700, color: '#dc2626', marginBottom: '4px' }}>
                🚨 {alert.issueType.toUpperCase()}
              </div>
              <div style={{ fontSize: '14px', color: '#374151', marginBottom: '4px' }}>
                📍 {alert.location}
              </div>
              <div style={{ fontSize: '12px', color: '#6b7280' }}>
                ⏰ {new Date(alert.timestamp).toLocaleString()}
              </div>
              {alert.priority && (
                <div
                  style={{
                    marginTop: '8px',
                    padding: '4px 8px',
                    background:
                      alert.priority === 'critical'
                        ? '#fecaca'
                        : alert.priority === 'high'
                        ? '#fed7aa'
                        : '#fef3c7',
                    color:
                      alert.priority === 'critical'
                        ? '#991b1b'
                        : alert.priority === 'high'
                        ? '#92400e'
                        : '#78350f',
                    borderRadius: '4px',
                    fontSize: '12px',
                    fontWeight: 600
                  }}
                >
                  {alert.priority === 'critical'
                    ? t('reportIssue.emergencyCritical')
                    : alert.priority === 'high'
                    ? t('reportIssue.emergencyHigh')
                    : t('reportIssue.emergencyMedium')}
                </div>
              )}
            </div>
          ))}
        </div>
      )}

      <style>{`
        @keyframes pulse {
          0%, 100% { opacity: 1; }
          50% { opacity: 0.7; }
        }
      `}</style>
    </div>
  );
};

export default EmergencyAlertSystem;
