import React, { useState, useEffect } from 'react';
import axios from 'axios';
import { API_URL } from '../config';
import { useNavigate } from 'react-router-dom';

const Leaderboard = () => {
  const [users, setUsers] = useState([]);
  const [loading, setLoading] = useState(true);
  const navigate = useNavigate();

  useEffect(() => {
    const fetchLeaderboard = async () => {
      try {
        const response = await axios.get(`${API_URL}/auth/leaderboard`);
        if (response.data.success) {
          setUsers(response.data.data);
        }
      } catch (err) {
        console.error('Failed to load leaderboard', err);
      } finally {
        setLoading(false);
      }
    };
    fetchLeaderboard();
  }, []);

  return (
    <div style={{ maxWidth: '800px', margin: '40px auto', padding: '20px', background: '#fff', borderRadius: '12px', boxShadow: '0 4px 15px rgba(0,0,0,0.1)' }}>
      <button onClick={() => navigate(-1)} style={{ padding: '8px 16px', background: '#e2e8f0', border: 'none', borderRadius: '6px', cursor: 'pointer', marginBottom: '20px' }}>
        ← Back
      </button>
      <h1 style={{ textAlign: 'center', color: '#1e293b', marginBottom: '10px' }}>🏆 Civic Leaderboard</h1>
      <p style={{ textAlign: 'center', color: '#64748b', marginBottom: '30px' }}>
        Earn points by reporting and fixing civic issues in your area!
      </p>

      {loading ? (
        <div style={{ textAlign: 'center', padding: '40px' }}>Loading heroes...</div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '15px' }}>
          {users.map((user, index) => (
            <div key={user._id} style={{ 
              display: 'flex', 
              alignItems: 'center', 
              padding: '16px', 
              background: index === 0 ? '#fef3c7' : index === 1 ? '#f1f5f9' : index === 2 ? '#fff7ed' : '#f8fafc',
              border: `2px solid ${index === 0 ? '#f59e0b' : index === 1 ? '#94a3b8' : index === 2 ? '#ea580c' : 'transparent'}`,
              borderRadius: '12px',
              transition: 'transform 0.2s'
            }}>
              <div style={{ fontSize: '24px', fontWeight: 'bold', color: '#64748b', width: '40px' }}>
                {index === 0 ? '🥇' : index === 1 ? '🥈' : index === 2 ? '🥉' : `#${index + 1}`}
              </div>
              <div style={{ flex: 1, marginLeft: '15px' }}>
                <h3 style={{ margin: '0 0 5px 0', fontSize: '18px', color: '#1e293b' }}>
                  {user.name}
                </h3>
                <div style={{ display: 'flex', gap: '8px' }}>
                  {user.badges && user.badges.map((badge, i) => (
                    <span key={i} style={{ padding: '2px 8px', background: '#dbeafe', color: '#2563eb', borderRadius: '12px', fontSize: '12px', fontWeight: 'bold' }}>
                      🌟 {badge}
                    </span>
                  ))}
                </div>
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end' }}>
                <div style={{ fontSize: '24px', fontWeight: 'bold', color: '#10b981' }}>
                  {user.points || 0}
                </div>
                <div style={{ fontSize: '12px', color: '#64748b', textTransform: 'uppercase', letterSpacing: '1px' }}>
                  Points
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
};

export default Leaderboard;
