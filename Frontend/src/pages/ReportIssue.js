import React, { useState, useRef, useEffect } from 'react';
import axios from 'axios';
import { useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import '../styles/ReportIssue.css';
import * as tf from "@tensorflow/tfjs";
import * as mobilenet from "@tensorflow-models/mobilenet";
import { detectAIImage, classifyCivicContent } from '../utils/aiImageDetector';
import { VoiceReporter } from '../utils/voiceReporter';
// LanguageSelector not used here (inline select used instead)

import L from "leaflet";
import "leaflet/dist/leaflet.css";
import { API_BASE_URL } from "../config";

delete L.Icon.Default.prototype._getIconUrl;

L.Icon.Default.mergeOptions({
  iconRetinaUrl: require("leaflet/dist/images/marker-icon-2x.png"),
  iconUrl: require("leaflet/dist/images/marker-icon.png"),
  shadowUrl: require("leaflet/dist/images/marker-shadow.png"),
});

function ReportIssue() {
  const { t, i18n } = useTranslation();
  const [formData, setFormData] = useState({
    issueType: '',
    title: '',
    description: '',
    location: {
      streetName: '',
      area: '',
      city: '',
      district: '',
      state: '',
      municipality: ''
    },
    latitude: null,
    longitude: null,
    image: null
  });
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [loading, setLoading] = useState(false);
  const [voiceActive, setVoiceActive] = useState(false);
  const [voiceTranscript, setVoiceTranscript] = useState('');
  const [isEmergency, setIsEmergency] = useState(false);
  const [emergencyPriority, setEmergencyPriority] = useState('medium');
  const navigate = useNavigate();
  const videoRef = useRef(null);
  const streamRef = useRef(null);
  const [cameraActive, setCameraActive] = useState(false);
  const [cameraError, setCameraError] = useState('');
  const [previewSrc, setPreviewSrc] = useState(null);
  const [model, setModel] = useState(null);
  const [aiResult, setAiResult] = useState(null);
  const [aiDetecting, setAiDetecting] = useState(false);

  const [cameraMode, setCameraMode] = useState(false);
  const [faceWarning, setFaceWarning] = useState(false);
  const [civicConfidence, setCivicConfidence] = useState(0);
  const [civicMatched, setCivicMatched] = useState(false);
  const [overrideMode, setOverrideMode] = useState(false);
  const [overrideReason, setOverrideReason] = useState('');
  const [googleCheckResult, setGoogleCheckResult] = useState(null);
  const [contentCheckResult, setContentCheckResult] = useState(null);

  const handleLocationChange = (e) => {
    const { name, value } = e.target;
    setFormData({
      ...formData,
      location: {
        ...formData.location,
        [name]: value
      }
    });
  };

  const handleChange = (e) => {
    const { name, value } = e.target;
    setFormData({
      ...formData,
      [name]: value
    });
  };

  const handleImageChange = (e) => {
    setFormData({
      ...formData,
      image: e.target.files[0]
    });
    if (e.target.files[0]) {
      try {
        const url = URL.createObjectURL(e.target.files[0]);
        setPreviewSrc(url);
      } catch (err) {
        setPreviewSrc(null);
      }
    }
  };

  const startVoiceInput = () => {
    if (!VoiceReporter.init()) {
      setError(t('voiceReport.notSupported'));
      return;
    }

    setVoiceActive(true);
    setVoiceTranscript('');

    VoiceReporter.start(
      (result) => {
        setVoiceTranscript(result.final || result.interim);
        if (result.isFinal) {
          setFormData(prev => ({
            ...prev,
            description: prev.description + ' ' + result.final
          }));
        }
      },
      (err) => {
        setError(t('voiceReport.error') + ': ' + err);
        setVoiceActive(false);
      }
    );
  };

  const stopVoiceInput = () => {
    const finalTranscript = VoiceReporter.stop();
    setVoiceActive(false);
    if (finalTranscript) {
      setFormData(prev => ({
        ...prev,
        description: (prev.description + ' ' + finalTranscript).trim()
      }));
    }
  };

  const handleEmergencyChange = (e) => {
    setIsEmergency(e.target.checked);
    if (e.target.checked) {
      setSuccess(t('emergency.systemAlert'));
    }
  };

  useEffect(() => {
    const loadModel = async () => {
      try {
        await tf.ready();
        const loadedModel = await mobilenet.load({ version: 2, alpha: 1.0 });
        setModel(loadedModel);
        console.log("MobileNet AI Model Loaded.");
      } catch (err) {
        console.error("Failed to load AI model", err);
      }
    };
    loadModel();

    return () => {
      if (streamRef.current) {
        streamRef.current.getTracks().forEach(t => t.stop());
      }
      if (previewSrc) URL.revokeObjectURL(previewSrc);
    };
  }, [previewSrc]);

  const validateImageWithAI = async (imageElement) => {
    setAiDetecting(true);
    setAiResult(null);
    setGoogleCheckResult(null);
    setContentCheckResult(null);
    setFaceWarning(false);
    setCivicMatched(false);
    setCivicConfidence(0);

    try {
      // Step 1: Run AI/Real detection + Google image detection
      let detection;
      try {
        detection = await detectAIImage(imageElement, formData.image);
        console.log('AI Detection Result:', detection);
      } catch (aiErr) {
        console.error('AI detection failed:', aiErr);
        setAiDetecting(false);
        return true;
      }

      // Store Google check result for display
      if (detection.googleCheck) {
        setGoogleCheckResult(detection.googleCheck);
      }

      // Block Google/internet images
      if (detection.googleCheck && detection.googleCheck.isGoogleImage) {
        setAiResult({
          type: 'google_image',
          confidence: detection.googleCheck.confidence,
          reason: detection.googleCheck.reason,
          scores: detection.scores
        });
        setFormData(prev => ({ ...prev, image: null }));
        setPreviewSrc(null);
        setAiDetecting(false);
        return false;
      }

      // Block AI-generated images
      if (!detection.isReal) {
        setAiResult({
          type: 'ai_generated',
          confidence: detection.confidence,
          reason: detection.reason,
          scores: detection.scores
        });
        setFormData(prev => ({ ...prev, image: null }));
        setPreviewSrc(null);
        setAiDetecting(false);
        return false;
      }

      // Step 2: MobileNet classification for civic content
      if (model) {
        const predictions = await model.classify(imageElement);
        const labels = predictions.map(p => p.className.toLowerCase()).join(' ');
        const topLabel = predictions[0]?.className || 'unknown';
        const topProbability = predictions[0]?.probability || 0;
        const topConfidence = (topProbability * 100).toFixed(1);
        console.log('MobileNet Labels:', labels);

        // Classify civic content
        const contentResult = await classifyCivicContent(predictions);
        setContentCheckResult(contentResult);

        // Block human images
        if (contentResult.isHuman) {
          setFaceWarning(true);
          setAiResult({
            type: 'invalid_content',
            confidence: contentResult.humanScore,
            reason: contentResult.reason,
            scores: detection.scores
          });
          setFormData(prev => ({ ...prev, image: null }));
          setPreviewSrc(null);
          setAiDetecting(false);
          return false;
        }

        // Block document/certificate images
        if (contentResult.isDocument) {
          setAiResult({
            type: 'invalid_content',
            confidence: contentResult.documentScore,
            reason: contentResult.reason,
            scores: detection.scores
          });
          setFormData(prev => ({ ...prev, image: null }));
          setPreviewSrc(null);
          setAiDetecting(false);
          return false;
        }

        // Set civic confidence
        setCivicConfidence(contentResult.civicScore);
        setCivicMatched(contentResult.isCivic);

        // Auto-fill form based on classification
        const fileName = formData.image?.name?.toLowerCase() || '';
        let locationStr = formData.location.streetName || formData.location.area || 'reported location';
        
        let issueType = contentResult.isCivic ? contentResult.civicType : topLabel;
        if (issueType === 'other') {
          issueType = topLabel; // Override 'other' with the raw AI label natively
        }
        
        let autoTitle = '';
        let autoDesc = '';
        if (issueType === 'garbage') {
          autoTitle = `🗑️ Garbage Overflow Detected at ${locationStr}`;
          autoDesc = `Garbage accumulation at ${locationStr}. High priority waste management needed.`;
        } else if (issueType === 'pothole') {
          autoTitle = `🕳️ Pothole Damage at ${locationStr}`;
          autoDesc = `Dangerous pothole detected. Immediate road repair required.`;
        } else if (issueType === 'streetlight') {
          autoTitle = `💡 Streetlight Failure at ${locationStr}`;
          autoDesc = `Public lighting not working. Safety hazard at night.`;
        } else if (issueType === 'water_leak') {
          autoTitle = `💧 Water Leak at ${locationStr}`;
          autoDesc = `Water leakage/drainage issue. Risk of flooding.`;
        } else if (issueType === 'damaged_road') {
          autoTitle = `🛣️ Damaged Road at ${locationStr}`;
          autoDesc = `Road infrastructure damage requiring repair.`;
        } else {
          autoTitle = `📍 Civic Issue at ${locationStr}`;
          autoDesc = `AI detected civic infrastructure problem: ${topLabel}`;
        }

        setFormData(prev => ({
          ...prev,
          issueType: issueType,
          title: autoTitle,
          description: autoDesc
        }));

        console.log(`✅ AI CLASSIFIED: ${issueType} from filename: ${fileName} | label: ${topLabel}`);
      }

      setAiResult({
        type: 'real',
        confidence: detection.confidence,
        reason: detection.reason,
        scores: detection.scores,
        googleCheck: detection.googleCheck
      });

      if (cameraMode) {
        setSuccess('Live camera issue detected. Auto-submitting report...');
        await submitReport();
        setCameraMode(false);
      }

      setAiDetecting(false);
      return true;

    } catch (err) {
      console.error('Validation error:', err);
      setAiDetecting(false);
      return true;
    }
  };

  const stopCamera = () => {
    if (streamRef.current) {
      streamRef.current.getTracks().forEach(track => track.stop());
      streamRef.current = null;
    }

    if (videoRef.current) {
      videoRef.current.pause();
      videoRef.current.srcObject = null;
    }

    setCameraActive(false);
    setCameraMode(false);
  };

  const startCamera = async () => {
    setCameraError("");

    try {
      if (streamRef.current) {
        streamRef.current.getTracks().forEach(track => track.stop());
      }

      const stream = await navigator.mediaDevices.getUserMedia({
        video: true,
        audio: false
      });

      streamRef.current = stream;

      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        videoRef.current.onloadeddata = () => {
          videoRef.current.play();
        };
      }

      setCameraActive(true);
      setCameraMode(true);

    } catch (err) {
      console.error("Camera error:", err);
      setCameraError("Unable to access camera. Check permissions.");
    }
  };

  const capturePhoto = async () => {
    try {
      const video = videoRef.current;
      if (!video) return setCameraError('Camera not ready');
      const canvas = document.createElement('canvas');
      canvas.width = video.videoWidth || 640;
      canvas.height = video.videoHeight || 480;
      const ctx = canvas.getContext('2d');
      ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
      const blob = await new Promise(resolve => canvas.toBlob(resolve, 'image/jpeg', 0.9));
      const file = new File([blob], `camera_${Date.now()}.jpg`, { type: 'image/jpeg' });
      setFormData(prev => ({ ...prev, image: file }));
      const url = URL.createObjectURL(file);
      setPreviewSrc(url);

      const img = new Image();
      img.onload = async () => {
        await validateImageWithAI(img);
      };
      img.src = url;

      stopCamera();
      setSuccess('Photo captured');
    } catch (err) {
      console.error('Capture failed', err);
      setCameraError('Capture failed');
    }
  };

  const handleCopyMunicipality = async () => {
    const muni = formData.location.municipality || '';
    if (!muni) return setError('No municipality to copy');
    try {
      await navigator.clipboard.writeText(muni);
      setSuccess('Municipality copied to clipboard');
    } catch (err) {
      setError('Failed to copy');
    }
  };

  const handleContactMunicipality = () => {
    const muni = formData.location.municipality || '';
    const subject = encodeURIComponent('Civic Issue: ' + (formData.title || formData.issueType || ''));
    const body = encodeURIComponent(`Please contact the municipality (${muni}) regarding an issue at coordinates: ${formData.latitude}, ${formData.longitude}`);
    window.open(`mailto:?subject=${subject}&body=${body}`);
  };

  const handleChangeLocation = () => {
    setFormData({
      ...formData,
      latitude: null,
      longitude: null,
      location: {
        streetName: '', 
        area: '',
        city: '',
        district: '',
        state: '',
        municipality: ''
      }
    });
    setSuccess('You can now enter location manually');
  };

  const handleGetLocation = () => {
    if (!navigator.geolocation) {
      setError('Geolocation is not supported by this browser');
      return;
    }

    navigator.geolocation.getCurrentPosition(
      (position) => {
        const lat = position.coords.latitude;
        const lon = position.coords.longitude;

        setFormData(prev => ({
          ...prev,
          latitude: lat,
          longitude: lon
        }));

        fetch(`https://nominatim.openstreetmap.org/reverse?format=jsonv2&lat=${lat}&lon=${lon}&addressdetails=1&zoom=18`, {
          headers: {
            "Accept": "application/json"
          }
        })
          .then(res => {
            if (!res.ok) {
              throw new Error("Reverse geocoding API failed");
            }
            return res.json();
          })
          .then(data => {
            if (!data || !data.address) {
              throw new Error("No address data");
            }

            const addr = data.address;

            // Build a detailed street name from multiple address components
            const streetParts = [
              addr.house_number,
              addr.road || addr.pedestrian || addr.cycleway || addr.footway,
              addr.neighbourhood,
            ].filter(Boolean);
            
            const streetName = streetParts.length > 0 
              ? streetParts.join(', ') 
              : (addr.display_name ? addr.display_name.split(',').slice(0, 2).join(',') : 'Unknown Street');

            setFormData(prev => ({
              ...prev,
              location: {
                streetName: streetName,
                area: addr.neighbourhood || addr.suburb || addr.city_district || '',
                city: addr.city || addr.town || addr.village || '',
                district: addr.county || addr.state_district || '',
                state: addr.state || '',
                municipality: addr.city || addr.town || addr.village || addr.county || ''
              }
            }));

            setSuccess('Location obtained successfully with street name');
          })
          .catch((err) => {
            console.error('Reverse geocode failed:', err);

            setFormData(prev => ({
              ...prev,
              location: {
                streetName: "GPS Location",
                area: "",
                city: `Lat: ${lat.toFixed(5)}`,
                district: "",
                state: "",
                municipality: ""
              }
            }));

            setSuccess('Location coordinates obtained (address lookup limited)');
          });
      },
      (error) => {
        setError('Could not get location: ' + error.message);
      }
    );
  };

  const submitReport = async () => {
    setError('');
    setSuccess('');
    setLoading(true);

    if (aiResult && aiResult.type !== 'real') {
      if (!overrideMode || !overrideReason.trim()) {
        setError('Cannot submit: image validation failed. Provide override reason if you believe this is valid.');
        setLoading(false);
        return;
      }
    }

    const token = localStorage.getItem('token');
    if (!token) {
      setError('Please login first');
      setLoading(false);
      return;
    }

    try {
      const fd = new FormData();
      fd.append('issueType', formData.issueType);
      fd.append('title', formData.title);
      fd.append('description', formData.description);
      fd.append('latitude', formData.latitude || '');
      fd.append('longitude', formData.longitude || '');
      fd.append('location', JSON.stringify(formData.location || {}));

      if (isEmergency) {
        fd.append('isEmergency', 'true');
        fd.append('emergencyPriority', emergencyPriority);
      }

      if (overrideMode && overrideReason.trim()) {
        fd.append('overrideReason', overrideReason.trim());
      }

      if (formData.image instanceof File) {
        fd.append('image', formData.image);
      } else if (formData.image) {
        fd.append('image', formData.image);
      }

      const response = await axios.post(`${API_BASE_URL}/api/issues`, fd, {
        headers: {
          Authorization: `Bearer ${token}`,
          'Content-Type': 'multipart/form-data'
        }
      });

      if (response.data.success) {
        setSuccess(t('common.success') + '! ' + t('reportIssue.title'));
        setFormData({
          issueType: '',
          title: '',
          description: '',
          location: {
            streetName: '',
            area: '',
            city: '',
            district: '',
            state: '',
            municipality: ''
          },
          latitude: null,
          longitude: null,
          image: null
        });
        setIsEmergency(false);
        setEmergencyPriority('medium');
        setOverrideMode(false);
        setOverrideReason('');
        setTimeout(() => navigate('/citizen-dashboard'), 2000);
      }
    } catch (err) {
      setError(err.response?.data?.message || 'Failed to report issue');
    } finally {
      setLoading(false);
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    await submitReport();
  };

  return (
    <div className="report-issue-container">
      <div className="report-issue-box">
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
          <h2>{t('reportIssue.title')}</h2>
          <select value={i18n.language} onChange={(e) => i18n.changeLanguage(e.target.value)}>
            <option value="en">English</option>
            <option value="hi">Hindi</option>
            <option value="te">Telugu</option>
          </select>
        </div>
        <form onSubmit={handleSubmit}>
          <div className="form-group ai-detection-box" style={{ background: '#f4f6fb', padding: '15px', borderRadius: '8px', borderLeft: '4px solid #667eea' }}>
            <h3 style={{ margin: '0 0 10px 0', color: '#667eea', fontSize: '16px' }}>
              🤖 {t('reportIssue.title')}
            </h3>
            <p style={{ margin: '0 6px 6px 0', color: '#333', fontWeight: 600 }}>
              {t('reportIssue.workflow')}
            </p>
            <ul style={{ margin: '0 0 8px 16px', color: '#555', fontSize: '14px', lineHeight: 1.45 }}>
              <li>{t('reportIssue.workflowStep1')}</li>
              <li>{t('reportIssue.workflowStep2')}</li>
              <li>{t('reportIssue.workflowStep3')}</li>
              <li>{t('reportIssue.workflowStep4')}</li>
              <li>{t('reportIssue.workflowStep5')}</li>
            </ul>
            <p style={{ margin: 0, color: '#555', fontSize: '14px' }}>
              {t('reportIssue.liveCameraNote')}
            </p>
          </div>

          <div className="form-group">
            <label>{t('reportIssue.voiceReport')}</label>
            <div style={{ display: 'flex', gap: '8px', marginBottom: '12px' }}>
              <button
                type="button"
                onClick={voiceActive ? stopVoiceInput : startVoiceInput}
                style={{
                  flex: 1,
                  padding: '10px 12px',
                  background: voiceActive ? '#dc2626' : '#3b82f6',
                  color: '#fff',
                  border: 'none',
                  borderRadius: '6px',
                  fontWeight: 600,
                  cursor: 'pointer'
                }}
              >
                {voiceActive ? t('reportIssue.stopVoice') : t('reportIssue.startVoice')}
              </button>
            </div>
            {voiceActive && (
              <div style={{ padding: '10px 12px', background: '#dbeafe', border: '1px solid #3b82f6', borderRadius: '6px', color: '#1e40af', fontSize: '14px', marginBottom: '12px' }}>
                🎤 {t('reportIssue.voiceInputActive')}
              </div>
            )}
            {voiceTranscript && (
              <div style={{ padding: '10px 12px', background: '#f0fdf4', border: '1px solid #10b981', borderRadius: '6px', color: '#047857', fontSize: '14px', marginBottom: '12px' }}>
                ✓ {t('voiceReport.recognized')} : {voiceTranscript}
              </div>
            )}
          </div>

          <div className="form-group">
            <label style={{ display: 'flex', alignItems: 'center', gap: '8px', cursor: 'pointer' }}>
              <input
                type="checkbox"
                checked={isEmergency}
                onChange={handleEmergencyChange}
                style={{ cursor: 'pointer', width: '18px', height: '18px' }}
              />
              <span style={{ fontWeight: 600, color: isEmergency ? '#dc2626' : '#374151' }}>
                {t('reportIssue.markAsEmergency')}
              </span>
            </label>
            {isEmergency && (
              <div style={{ marginTop: '10px', padding: '10px 12px', background: '#fef2f2', border: '1px solid #dc2626', borderRadius: '6px' }}>
                <label style={{ display: 'block', marginBottom: '8px', fontWeight: 600, color: '#991b1b' }}>
                  {t('emergency.priority')}:
                </label>
                <select
                  value={emergencyPriority}
                  onChange={(e) => setEmergencyPriority(e.target.value)}
                  style={{
                    width: '100%',
                    padding: '8px 10px',
                    borderRadius: '4px',
                    border: '1px solid #fca5a5',
                    background: '#fff',
                    color: '#991b1b'
                  }}
                >
                  <option value="critical">{t('reportIssue.emergencyCritical')}</option>
                  <option value="high">{t('reportIssue.emergencyHigh')}</option>
                  <option value="medium">{t('reportIssue.emergencyMedium')}</option>
                </select>
              </div>
            )}
          </div>

          <div className="form-group">
            <label>{t('reportIssue.uploadImage')}</label>
            <div className="image-upload-box">
              <input
                type="file"
                accept="image/*"
                onChange={handleImageChange}
                id="fileInput"
              />
              <div style={{ marginTop: 10, display: 'flex', gap: 8 }}>
                <button type="button" className="btn-secondary" onClick={() => document.getElementById('fileInput').click()}>{t('reportIssue.chooseImage')}</button>
                <button type="button" className="btn-secondary" onClick={startCamera}>{t('reportIssue.useCamera')}</button>
              </div>

              {cameraError && <div className="error" style={{ marginTop: 8 }}>{cameraError}</div>}

              {cameraActive && (
                <div className="camera-box">
                  <video
                    ref={videoRef}
                    autoPlay
                    playsInline
                    muted
                    style={{
                      width: "100%",
                      height: "300px",
                      objectFit: "cover",
                      borderRadius: "10px",
                      background: "black"
                    }}
                  />
                  <div style={{ display: 'flex', gap: 8, marginTop: 8 }}>
                    <button type="button" className="btn-location" onClick={capturePhoto}>{t('reportIssue.capturePhoto')}</button>
                    <button type="button" className="btn-secondary" onClick={stopCamera}>{t('reportIssue.closeCamera')}</button>
                  </div>
                </div>
              )}

              {previewSrc && (
                <div style={{ marginTop: 10 }}>
                  <img
                    id="previewImage"
                    src={previewSrc}
                    alt="preview"
                    style={{ maxWidth: 200, borderRadius: 8, border: '2px solid #e5e7eb', display: 'block' }}
                    onLoad={(e) => {
                      if (formData.image) validateImageWithAI(e.target);
                    }}
                  />
                </div>
              )}

              {civicMatched && (
                <div style={{ marginTop: 10, padding: '8px 12px', borderRadius: 8, background: '#f0fdf4', border: '1px solid #86efac', color: '#166534', fontWeight: 700, display: 'inline-flex', alignItems: 'center' }}>
                  {t('reportIssue.civicMatched')}
                </div>
              )}

              {civicMatched && (
                <div style={{ marginTop: 10 }}>
                  <div style={{ fontSize: 12, fontWeight: 600, color: '#374151', marginBottom: 4 }}>{t('reportIssue.civicConfidence')}: {civicConfidence}%</div>
                  <div style={{ height: 8, background: '#e5e7eb', borderRadius: 4, overflow: 'hidden' }}>
                    <div style={{
                      height: '100%',
                      borderRadius: 4,
                      width: `${civicConfidence}%`,
                      background: civicConfidence >= 70 ? '#10b981' : civicConfidence >= 50 ? '#f59e0b' : '#ef4444',
                      transition: 'width 0.5s'
                    }} />
                  </div>
                </div>
              )}

              <div style={{ marginTop: 10, padding: '8px 12px', borderRadius: 8, background: '#fff1f2', border: '1px solid #fecaca', color: '#b91c1c', fontWeight: 700, display: 'inline-flex', alignItems: 'center' }}>
                {t('reportIssue.realCivicImage')}
              </div>

              {faceWarning && (
                <div style={{ marginTop: 10, padding: '10px 12px', borderRadius: 8, background: '#fefce8', border: '1px solid #f59e0b', color: '#92400e', fontWeight: 700 }}>
                  {t('reportIssue.faceWarning')}
                </div>
              )}

              {/* Google Image Detection Result */}
              {googleCheckResult && (
                <div style={{
                  marginTop: 10, padding: '10px 12px', borderRadius: 8,
                  background: googleCheckResult.isGoogleImage ? '#fef2f2' : '#f0fdf4',
                  border: `1px solid ${googleCheckResult.isGoogleImage ? '#fca5a5' : '#86efac'}`,
                  color: googleCheckResult.isGoogleImage ? '#991b1b' : '#065f46',
                  fontWeight: 600, fontSize: 13
                }}>
                  {googleCheckResult.isGoogleImage ? (
                    <>
                      {t('imageValidation.googleWarning')}
                      <div style={{ marginTop: 4, fontSize: 12, fontWeight: 400 }}>
                        {googleCheckResult.signals && googleCheckResult.signals.map((s, i) => (
                          <div key={i}>• {s}</div>
                        ))}
                      </div>
                    </>
                  ) : (
                    <>✅ {t('imageValidation.sourceVerified')} — {t('imageValidation.realVerified')}</>
                  )}
                </div>
              )}

              {/* Content Classification Result */}
              {contentCheckResult && (
                <div style={{
                  marginTop: 10, padding: '10px 12px', borderRadius: 8,
                  background: contentCheckResult.isCivic ? '#f0fdf4' : contentCheckResult.isHuman ? '#fef2f2' : '#fefce8',
                  border: `1px solid ${contentCheckResult.isCivic ? '#86efac' : contentCheckResult.isHuman ? '#fca5a5' : '#fde68a'}`,
                  fontSize: 13
                }}>
                  <div style={{ fontWeight: 700, color: contentCheckResult.isCivic ? '#065f46' : contentCheckResult.isHuman ? '#991b1b' : '#92400e' }}>
                    {contentCheckResult.isCivic
                      ? `✅ ${t('imageValidation.civicOnly')}: ${contentCheckResult.civicType}`
                      : contentCheckResult.isHuman
                        ? `🚫 ${t('imageValidation.invalidContent')}: Human/Person`
                        : contentCheckResult.isDocument
                          ? `🚫 ${t('imageValidation.invalidContent')}: Document/Certificate`
                          : `⚠️ AI Label: ${contentCheckResult.topLabel}`
                    }
                  </div>
                  <div style={{ marginTop: 4, fontSize: 12, color: '#6b7280' }}>
                    {contentCheckResult.reason}
                  </div>
                </div>
              )}

              {aiDetecting && (
                <div style={{ marginTop: 14, padding: '14px 16px', background: '#f0f4ff', borderRadius: 10, borderLeft: '4px solid #6366f1', display: 'flex', alignItems: 'center', gap: 12 }}>
                  <div style={{ width: 20, height: 20, border: '3px solid #c7d2fe', borderTopColor: '#4338ca', borderRadius: '50%', animation: 'spin 0.8s linear infinite', flexShrink: 0 }} />
                  <div>
                    <div style={{ fontWeight: 600, color: '#3730a3', fontSize: 14 }}>{t('reportIssue.analyzingImage')}</div>
                    <div style={{ fontSize: 12, color: '#6b7280', marginTop: 2 }}>{t('reportIssue.analyzingDetails')}</div>
                  </div>
                </div>
              )}

              {aiResult && !aiDetecting && (() => {
                const isReal = aiResult.type === 'real';
                const isInvalid = aiResult.type === 'invalid_content';
                const isGoogle = aiResult.type === 'google_image';
                const s = aiResult.scores || {};
                const factors = [
                  { label: t('imageValidation.exifMetadata'), score: s.exifScore, tip: 'Camera metadata presence' },
                  { label: t('imageValidation.sensorNoise'), score: s.noiseScore, tip: 'Natural camera noise level' },
                  { label: t('imageValidation.edgeFrequency'), score: s.edgeScore, tip: 'Edge variation (AI = too uniform)' },
                  { label: t('imageValidation.colorChannels'), score: s.channelScore, tip: 'RGB channel correlation' },
                  { label: t('imageValidation.blockArtifacts'), score: s.blockScore, tip: 'AI model grid patterns' },
                ];
                return (
                  <div style={{
                    marginTop: 14, borderRadius: 12, overflow: 'hidden',
                    border: `2px solid ${isReal ? '#10b981' : isGoogle ? '#f97316' : isInvalid ? '#f59e0b' : '#ef4444'}`,
                    background: isReal ? '#f0fdf4' : isGoogle ? '#fff7ed' : isInvalid ? '#fffbeb' : '#fef2f2'
                  }}>
                    <div style={{ padding: '12px 16px', background: isReal ? '#10b981' : isGoogle ? '#f97316' : isInvalid ? '#f59e0b' : '#ef4444', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                      <div style={{ color: '#fff', fontWeight: 700, fontSize: 14 }}>
                        {isReal ? `✅ ${t('imageValidation.realVerified').toUpperCase()}` 
                          : isGoogle ? `🌐 ${t('imageValidation.googleImage').toUpperCase()}`
                          : isInvalid ? `🚫 ${t('imageValidation.invalidContent').toUpperCase()}` 
                          : `🤖 ${t('imageValidation.aiGenerated').toUpperCase()}`}
                      </div>
                      <div style={{ background: 'rgba(255,255,255,0.25)', color: '#fff', borderRadius: 20, padding: '2px 12px', fontWeight: 700, fontSize: 13 }}>
                        {isInvalid ? 'Invalid' : isGoogle ? 'Google' : `${aiResult.confidence}% ${isReal ? 'Real' : 'AI'}`}
                      </div>
                    </div>
                    <div style={{ padding: '10px 16px', fontSize: 13, color: isReal ? '#065f46' : isGoogle ? '#9a3412' : isInvalid ? '#92400e' : '#991b1b', borderBottom: '1px solid ' + (isReal ? '#a7f3d0' : isGoogle ? '#fed7aa' : isInvalid ? '#fed7aa' : '#fecaca') }}>
                      {isReal ? '📷' : isGoogle ? '🌐' : isInvalid ? '⚠️' : '🤖'} {aiResult.reason}
                    </div>
                    <div style={{ padding: '12px 16px', display: 'flex', flexDirection: 'column', gap: 8 }}>
                      <div style={{ fontSize: 11, fontWeight: 600, color: '#6b7280', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: 2 }}>{t('imageValidation.detectionBreakdown')}</div>
                      {factors.map(f => (
                        <div key={f.label}>
                          <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 12, color: '#374151', marginBottom: 3 }}>
                            <span>{f.label}</span>
                            <span style={{ color: f.score >= 60 ? '#10b981' : f.score >= 35 ? '#f59e0b' : '#ef4444', fontWeight: 600 }}>{f.score ?? '—'}%</span>
                          </div>
                          <div style={{ height: 5, background: '#e5e7eb', borderRadius: 3, overflow: 'hidden' }}>
                            <div style={{
                              height: '100%', borderRadius: 3, transition: 'width 0.5s',
                              width: `${f.score ?? 0}%`,
                              background: f.score >= 60 ? '#10b981' : f.score >= 35 ? '#f59e0b' : '#ef4444'
                            }} />
                          </div>
                        </div>
                      ))}
                    </div>
                    {!isReal && !isInvalid && !isGoogle && (
                      <div style={{ padding: '10px 16px', background: '#fee2e2', color: '#991b1b', fontSize: 13, fontWeight: 500 }}>
                        {t('imageValidation.uploadRejected')}
                      </div>
                    )}
                    {isGoogle && (
                      <div style={{ padding: '10px 16px', background: '#ffedd5', color: '#9a3412', fontSize: 13, fontWeight: 500 }}>
                        🌐 {t('imageValidation.googleImage')}
                      </div>
                    )}
                    {isInvalid && (
                      <div style={{ padding: '10px 16px', background: '#fef3c7', color: '#92400e', fontSize: 13, fontWeight: 500 }}>
                        {t('imageValidation.contentFailed')}
                      </div>
                    )}
                    {(isInvalid || isGoogle) && (
                      <div style={{ padding: '12px 16px', background: '#fef3c7', borderTop: '1px solid #fed7aa' }}>
                        <div style={{ fontSize: 12, fontWeight: 600, color: '#92400e', marginBottom: 6 }}>
                          {t('imageValidation.overrideReason')}:
                        </div>
                        <div style={{ display: 'flex', gap: 8 }}>
                          <input
                            type="text"
                            placeholder={t('imageValidation.overrideReason')}
                            value={overrideReason}
                            onChange={(e) => setOverrideReason(e.target.value)}
                            style={{ flex: 1, padding: '6px 10px', fontSize: 12, borderRadius: 4, border: '1px solid #d97706' }}
                          />
                          <button
                            type="button"
                            onClick={() => setOverrideMode(!overrideMode)}
                            style={{
                              padding: '6px 12px',
                              borderRadius: 4,
                              border: '1px solid #d97706',
                              background: overrideMode ? '#d97706' : 'transparent',
                              color: overrideMode ? '#fff' : '#d97706',
                              fontWeight: 600,
                              fontSize: 12,
                              cursor: 'pointer'
                            }}
                          >
                            {overrideMode ? `✓ ${t('imageValidation.override')}` : t('imageValidation.override')}
                          </button>
                        </div>
                      </div>
                    )}
                  </div>
                );
              })()}
            </div>
          </div>

          <div className="form-group">
            <label>{t('reportIssue.titleLabel')}</label>
            <input
              name="title"
              value={formData.title}
              onChange={handleChange}
              placeholder="AI generates from image analysis..."
              required
            />
          </div>

          <div className="form-group">
            <label>{t('reportIssue.descriptionLabel')}</label>
            <textarea
              name="description"
              value={formData.description}
              onChange={handleChange}
              placeholder="AI generates detailed description..."
              required
            />
          </div>

          <div className="location-section">
            <h3>{t('reportIssue.locationDetails')}</h3>
            <button type="button" className="btn-location" onClick={handleGetLocation}>
              {t('reportIssue.getGPS')}
            </button>

            {formData.latitude && formData.longitude && (
              <div style={{ marginTop: '15px', marginBottom: '15px', padding: '14px', background: '#eef2ff', borderRadius: '8px', borderLeft: '4px solid #667eea', fontSize: '14px', color: '#333' }}>
                <strong style={{ color: '#667eea' }}>📍 {t('reportIssue.gpsCoordinates')}:</strong><br/>
                Lat: {formData.latitude.toFixed(6)} | Lng: {formData.longitude.toFixed(6)}
                {formData.location.streetName && formData.location.streetName !== 'GPS Location' && (
                  <div style={{ marginTop: '8px', padding: '8px 10px', background: '#dbeafe', borderRadius: '6px', fontWeight: 600, color: '#1e40af' }}>
                    🏠 {t('reportIssue.streetName')}: {formData.location.streetName}
                  </div>
                )}
                {formData.location.area && (
                  <div style={{ marginTop: '4px', fontSize: '13px', color: '#4b5563' }}>
                    📍 {formData.location.area}{formData.location.city ? `, ${formData.location.city}` : ''}{formData.location.district ? `, ${formData.location.district}` : ''}
                  </div>
                )}
              </div>
            )}

            <div className="form-row">
              <div className="form-group">
                <label>{t('reportIssue.streetName')}:</label>
                <input
                  type="text"
                  name="streetName"
                  value={formData.location.streetName}
                  onChange={handleLocationChange}
                  required
                />
              </div>
              <div className="form-group">
                <label>{t('reportIssue.area')}:</label>
                <input
                  type="text"
                  name="area"
                  value={formData.location.area}
                  onChange={handleLocationChange}
                  required
                />
              </div>
            </div>

            <div className="form-row">
              <div className="form-group">
                <label>{t('reportIssue.city')}:</label>
                <input
                  type="text"
                  name="city"
                  value={formData.location.city}
                  onChange={handleLocationChange}
                  required
                />
              </div>
              <div className="form-group">
                <label>{t('reportIssue.district')}:</label>
                <input
                  type="text"
                  name="district"
                  value={formData.location.district}
                  onChange={handleLocationChange}
                  required
                />
              </div>
            </div>

            <div className="form-row">
              <div className="form-group">
                <label>{t('reportIssue.state')}:</label>
                <input
                  type="text"
                  name="state"
                  value={formData.location.state}
                  onChange={handleLocationChange}
                  required
                />
              </div>
              <div className="form-group">
                <label>{t('reportIssue.municipality')}:</label>
                <input
                  type="text"
                  name="municipality"
                  value={formData.location.municipality}
                  onChange={handleLocationChange}
                  required
                />
              </div>
            </div>

            {formData.latitude && formData.longitude && (
              <div className="location-panel">
                <div>
                  <strong>{t('reportIssue.locationSummary')}:</strong> {formData.location.streetName || ''} {formData.location.area ? `, ${formData.location.area}` : ''}
                  <div>{formData.location.city}{formData.location.district ? `, ${formData.location.district}` : ''}</div>
                </div>
                <div className="location-actions">
                  <button type="button" className="btn-location" onClick={() => window.open(`https://www.google.com/maps?q=${formData.latitude},${formData.longitude}`, '_blank')}>{t('reportIssue.getDirections')}</button>
                  <button type="button" className="btn-secondary" onClick={handleCopyMunicipality}>{t('reportIssue.copyMunicipality')}</button>
                  <button type="button" className="btn-secondary" onClick={handleContactMunicipality}>{t('reportIssue.contactMunicipality')}</button>
                  <button type="button" className="btn-secondary" onClick={handleChangeLocation}>{t('reportIssue.editLocation')}</button>
                </div>
              </div>
            )}
          </div>

          {error && <p className="error">{error}</p>}
          {success && <p className="success">{success}</p>}

          <button type="submit" disabled={loading} className="submit-btn">
            {loading ? t('reportIssue.reporting') : t('reportIssue.submitReport')}
          </button>
        </form>
      </div>
    </div>
  );
}

export default ReportIssue;
