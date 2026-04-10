import React, { useState, useRef, useEffect, useCallback } from 'react';
import axios from 'axios';
import { useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import * as tf from "@tensorflow/tfjs";
import * as mobilenet from "@tensorflow-models/mobilenet";
import { detectAIImage, classifyCivicContent } from '../utils/aiImageDetector';
import { API_BASE_URL } from '../config';
import LanguageSelector from '../components/LanguageSelector';

const AdminLiveDetection = () => {
  const { t } = useTranslation(); // eslint-disable-line no-unused-vars
  const navigate = useNavigate();
  const videoRef = useRef(null);
  const streamRef = useRef(null);
  const canvasRef = useRef(null);

  const [isLive, setIsLive] = useState(false);
  const [facingMode, setFacingMode] = useState('user');
  const [videoDevices, setVideoDevices] = useState([]);
  const [currentDeviceId, setCurrentDeviceId] = useState(null);
  const [model, setModel] = useState(null);
  const [lastCapture, setLastCapture] = useState(null);
  const [detectionResult, setDetectionResult] = useState(null);
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [detectedIssue, setDetectedIssue] = useState(null);
  const [autoSubmitting, setAutoSubmitting] = useState(false);
  const [detectionHistory, setDetectionHistory] = useState([]);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [modelLoading, setModelLoading] = useState(true);
  const [loadProgress, setLoadProgress] = useState(0);
  const [backendType, setBackendType] = useState('webgl');

  const loadModel = useCallback(async (retryCount = 0) => {
    if (retryCount > 3) {
      setModelLoading(false);
      setError('AI model load failed after 3 retries. Using fallback mode.');
      return;
    }
    
    try {
      setModelLoading(true);
      setLoadProgress(10);
      
      await tf.setBackend(backendType);
      await tf.ready();
      setLoadProgress(30);
      
      const loadedModel = await mobilenet.load({ 
        version: 2, 
        alpha: 1.0 
      });
      setModel(loadedModel);
      setModelLoading(false);
      setLoadProgress(100);
      setError('');
      console.log('✅ MobileNet model loaded successfully');
    } catch (err) {
      console.error(`AI model load failed (attempt ${retryCount + 1}):`, err);
      setLoadProgress(0);
      if (backendType === 'webgl') {
        setBackendType('cpu');
        loadModel(retryCount + 1);
      } else {
        setModelLoading(false);
        setError('AI model failed to load. Fallback mode active.');
      }
    }
  }, [backendType]);

  useEffect(() => {
    const adminUser = localStorage.getItem('adminUser');
    if (!adminUser) {
      navigate('/admin-login');
      return;
    }
    loadModel();
  }, [navigate, loadModel]);

  const updateVideoDevices = useCallback(async () => {
    try {
      const devices = await navigator.mediaDevices.enumerateDevices();
      const videoInputs = devices.filter(device => device.kind === 'videoinput');
      setVideoDevices(videoInputs);

      if (!currentDeviceId && videoInputs.length > 0) {
        const front = videoInputs.find(d => /front|user/i.test(d.label));
        const back = videoInputs.find(d => /back|rear|environment/i.test(d.label));
        let chosen = front?.deviceId || videoInputs[0].deviceId;
        if (facingMode === 'environment' && back) {
          chosen = back.deviceId;
        }
        setCurrentDeviceId(chosen);
      }

      return videoInputs;
    } catch (err) {
      console.warn('Could not enumerate devices:', err);
      return [];
    }
  }, [currentDeviceId, facingMode]);

  const startLiveCamera = useCallback(async (deviceId) => {
    try {
      const videoOptions = deviceId
        ? { deviceId: { exact: deviceId }, width: { ideal: 1280 }, height: { ideal: 720 } }
        : currentDeviceId
        ? { deviceId: { exact: currentDeviceId }, width: { ideal: 1280 }, height: { ideal: 720 } }
        : { facingMode, width: { ideal: 1280 }, height: { ideal: 720 } };

      navigator.mediaDevices.getUserMedia({
        video: videoOptions,
        audio: false
      }).then(stream => {
        streamRef.current = stream;
        if (videoRef.current) {
          videoRef.current.srcObject = stream;
          videoRef.current.play();
        }

        if (deviceId) {
          setCurrentDeviceId(deviceId);
        }

        setIsLive(true);
        setError('');
        return stream;
      }).catch(err => {
        setError('Camera access denied: ' + err.message);
      });
    } catch (err) {
      setError('Camera access denied: ' + err.message);
    }
  }, [currentDeviceId, facingMode]);

  const stopLiveCamera = useCallback(() => {
    try {
      if (streamRef.current) {
        streamRef.current.getTracks().forEach(track => track.stop());
        streamRef.current = null;
      }
      if (videoRef.current) {
        // Safe check for srcObject and play exceptions
        videoRef.current.srcObject = null;
      }
    } catch (e) {
      console.warn("Error stopping camera", e);
    }
    setIsLive(false);
  }, []);

  // Move the component mount effect after function definitions to avoid 'use-before-define'
  useEffect(() => {
    let isMounted = true;
    const init = async () => {
      const videoInputs = await updateVideoDevices();
      if (!isMounted) return;
      
      let startDevice = currentDeviceId;
      if (!startDevice && videoInputs?.length > 0) {
        const front = videoInputs.find(d => /front|user/i.test(d.label));
        startDevice = front ? front.deviceId : videoInputs[0].deviceId;
      }
      await startLiveCamera(startDevice);
    };
    init();

    return () => {
      isMounted = false;
      stopLiveCamera();
    };
    // Include all used functions and state in dependencies
  }, [updateVideoDevices, startLiveCamera, stopLiveCamera, currentDeviceId]);

  const resolveNextDeviceId = () => {
    if (videoDevices.length <= 1) {
      return currentDeviceId;
    }

    const front = videoDevices.find(d => /front|user/i.test(d.label));
    const back = videoDevices.find(d => /back|rear|environment/i.test(d.label));

    if (facingMode === 'user' && back) {
      return back.deviceId;
    }
    if (facingMode === 'environment' && front) {
      return front.deviceId;
    }

    const currentIndex = videoDevices.findIndex(d => d.deviceId === currentDeviceId);
    const nextIndex = currentIndex === -1 || currentIndex === videoDevices.length - 1 ? 0 : currentIndex + 1;
    return videoDevices[nextIndex].deviceId;
  };

  const switchCamera = async () => {
    const currentEnumerated = await updateVideoDevices();
    if (currentEnumerated.length <= 1) {
      setError('Only one camera available; cannot switch.');
      return;
    }

    const nextDeviceId = resolveNextDeviceId();
    if (!nextDeviceId) {
      setError('No next camera found.');
      return;
    }

    stopLiveCamera();
    setCurrentDeviceId(nextDeviceId);
    setFacingMode(prev => (prev === 'user' ? 'environment' : 'user'));

    try {
      navigator.mediaDevices.getUserMedia({
        video: { deviceId: { exact: nextDeviceId }, width: { ideal: 1280 }, height: { ideal: 720 } },
        audio: false
      }).then(stream => {
        streamRef.current = stream;
        if (videoRef.current) {
          videoRef.current.srcObject = stream;
          videoRef.current.play();
        }
        setIsLive(true);
        setError('');
      }).catch(err => {
        setError('Camera switch failed: ' + err.message);
        setIsLive(false);
      });
    } catch (err) {
      setError('Camera switch failed: ' + err.message);
      setIsLive(false);
    }
  };

  const captureFrame = async () => {
    if (!videoRef.current) return;

    setIsAnalyzing(true);
    setError('');

    try {
      const video = videoRef.current;
      const canvas = canvasRef.current || document.createElement('canvas');
      canvas.width = video.videoWidth || 640;
      canvas.height = video.videoHeight || 480;

      const ctx = canvas.getContext('2d');
      ctx.drawImage(video, 0, 0);
      
      const dataUrl = canvas.toDataURL('image/jpeg', 0.9);
      setLastCapture(dataUrl);

      const img = new Image();
      img.onload = async () => {
        try {
          await analyzeFrame(img);
        } catch (e) {
          setError('Analysis failed: ' + e.message);
          setIsAnalyzing(false);
        }
      };
      img.onerror = () => {
        setError('Failed to load captured frame data.');
        setIsAnalyzing(false);
      };
      img.src = dataUrl;
    } catch (err) {
      setError('Failed to capture frame: ' + err.message);
      setIsAnalyzing(false);
    }
  };

  const analyzeFrame = async (imageElement) => {
    try {
      // Step 1: Check if image is real (not AI-generated or Google image)
      const detection = await detectAIImage(imageElement);
      
      if (!detection.isReal) {
        setDetectionResult({
          type: 'invalid',
          message: detection.googleCheck?.isGoogleImage 
            ? t('adminLiveDetection.googleDetected') 
            : t('adminLiveDetection.invalidImage'),
          confidence: detection.confidence
        });
        setDetectedIssue(null);
        setIsAnalyzing(false);
        return;
      }

      // Step 2: MobileNet classification
      if (!model) {
        setDetectionResult({
          type: 'invalid', // Block submission
          message: 'AI model unavailable. Cannot verify if this is a civic issue.',
          confidence: detection.confidence
        });
        setDetectedIssue(null);
        setIsAnalyzing(false);
        return;
      }

      const predictions = await model.classify(imageElement);
      const topLabel = predictions[0]?.className || 'unknown';
      const topConfidence = (predictions[0]?.probability * 100).toFixed(1);

      // Step 3: Civic content classification - block humans and documents
      const contentResult = await classifyCivicContent(predictions);

      // Block human images
      if (contentResult.isHuman) {
        setDetectionResult({
          type: 'human_detected',
          message: t('adminLiveDetection.humanDetected'),
          label: topLabel,
          confidence: topConfidence,
          reason: contentResult.reason
        });
        setDetectedIssue(null);
        setIsAnalyzing(false);
        return;
      }

      // Block document/certificate images
      if (contentResult.isDocument) {
        setDetectionResult({
          type: 'no_civic',
          message: `🚫 Document/certificate detected - ${t('adminLiveDetection.noCivicDetected')}`,
          label: topLabel,
          confidence: topConfidence,
          reason: contentResult.reason
        });
        setDetectedIssue(null);
        setIsAnalyzing(false);
        return;
      }

      // Check if it's a civic issue
      if (!contentResult.isCivic) {
        setDetectionResult({
          type: 'no_civic',
          message: t('adminLiveDetection.noCivicDetected'),
          label: topLabel,
          confidence: topConfidence,
          reason: contentResult.reason
        });
        setDetectedIssue(null);
        setIsAnalyzing(false);
        return;
      }

      // Civic issue detected!
      let dynamicCivicType = contentResult.civicType;
      if (dynamicCivicType === 'other') {
        dynamicCivicType = topLabel;
      }

      const detected = {
        issueType: dynamicCivicType,
        label: topLabel,
        confidence: topConfidence,
        realScore: detection.confidence,
        civicScore: contentResult.civicScore,
        timestamp: new Date().toLocaleTimeString()
      };

      setDetectedIssue(detected);
      setDetectionResult({
        type: 'success',
        message: `✅ ${t('adminLiveDetection.civicDetected')}: ${contentResult.civicType}`,
        issue: detected
      });

      setDetectionHistory(prev => [detected, ...prev].slice(0, 20));
    } catch (err) {
      setError('Analysis error: ' + err.message);
    } finally {
      setIsAnalyzing(false);
    }
  };

  const autoSubmitIssue = async () => {
    if (!detectedIssue) return;

    setAutoSubmitting(true);
    setError('');

    try {
      const adminToken = localStorage.getItem('adminToken');
      if (!adminToken) {
        setError('Admin session expired');
        setAutoSubmitting(false);
        return;
      }

      // Try to get actual location
      let lat = 0;
      let lon = 0;
      let locData = { city: 'Live Detection', area: 'Admin Camera', streetName: 'Live Detection Zone', municipality: 'Admin Console' };

      try {
        if (navigator?.geolocation?.getCurrentPosition) {
          const position = await new Promise((resolve, reject) => {
            navigator.geolocation.getCurrentPosition(resolve, reject, { timeout: 5000 });
          });
          lat = position.coords.latitude;
          lon = position.coords.longitude;
          locData.streetName = `Geo: ${Number(lat).toFixed(4)}, ${Number(lon).toFixed(4)}`;
        }
      } catch (geoErr) {
        console.log('Could not get actual GPS location, using defaults.');
      }

      const issueData = new FormData();
      issueData.append('issueType', detectedIssue.issueType);
      issueData.append('title', `Live Detection: ${detectedIssue.issueType} (${detectedIssue.confidence}% confidence)`);
      issueData.append('description', `🚨 LIVE ADMIN DETECTION\n\n📊 AI Classification: ${detectedIssue.label}\n🔍 Real Score: ${detectedIssue.realScore}%\n🏛️ Civic Score: ${detectedIssue.civicScore}%\n⏰ Detected: ${detectedIssue.timestamp}\n\nAuto-detected by admin live camera system.`);
      issueData.append('latitude', lat);
      issueData.append('longitude', lon);
      issueData.append('location', JSON.stringify(locData));
      issueData.append('isLiveDetection', 'true');

      if (lastCapture) {
        const response = await fetch(lastCapture);
        const blob = await response.blob();
        issueData.append('image', blob, `live_detection_${Date.now()}.jpg`);
      }

      const response = await axios.post(`${API_BASE_URL}/api/issues`, issueData, {
        headers: {
          Authorization: `Bearer ${adminToken}`,
          'Content-Type': 'multipart/form-data'
        }
      });

      if (response.data.success) {
        setSuccess(`✅ Issue auto-submitted! ID: ${response.data.data?._id}`);
        setDetectedIssue(null);
        setDetectionResult(null);
        setLastCapture(null);
        setTimeout(() => setSuccess(''), 3000);
      }
    } catch (err) {
      setError('Submission failed: ' + (err.response?.data?.message || err.message));
    } finally {
      setAutoSubmitting(false);
    }
  };

  return (
    <div style={{ background: '#0f172a', color: '#fff', minHeight: '100vh', padding: '20px' }}>
      <div style={{ maxWidth: '1400px', margin: '0 auto' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '24px' }}>
          <div>
            <h1 style={{ margin: '0 0 4px 0', fontSize: '28px' }}>
              🎥 {t('adminLiveDetection.title')}
            </h1>
            <p style={{ margin: 0, color: '#94a3b8', fontSize: '14px' }}>
              {t('adminLiveDetection.subtitle')}
            </p>
          </div>
          <div style={{ display: 'flex', gap: '12px', alignItems: 'center' }}>
            <LanguageSelector />
            <button
              onClick={() => navigate('/admin-dashboard')}
              style={{
                padding: '8px 16px',
                background: '#495057',
                color: '#fff',
                border: 'none',
                borderRadius: '6px',
                cursor: 'pointer',
                fontWeight: 600
              }}
            >
              {t('adminLiveDetection.backToDashboard')}
            </button>
          </div>
        </div>

        {error && (
          <div
            style={{
              background: '#fee2e2',
              border: '1px solid #fca5a5',
              color: '#991b1b',
              padding: '12px 16px',
              borderRadius: '8px',
              marginBottom: '16px',
              fontWeight: 600
            }}
          >
            ❌ {error}
          </div>
        )}
        {success && (
          <div
            style={{
              background: '#dcfce7',
              border: '1px solid #86efac',
              color: '#166534',
              padding: '12px 16px',
              borderRadius: '8px',
              marginBottom: '16px',
              fontWeight: 600
            }}
          >
            {success}
          </div>
        )}

        <div style={{ display:'flex', alignItems:'center', marginBottom: '12px', color: '#cbd5e1', gap:'10px' }}>
          <span style={{ fontWeight:800, color:'#38bdf8' }}>{t('adminLiveDetection.liveMobileMode')}</span>
          <span>{t('adminLiveDetection.currentDevice')}: {videoDevices.find(d => d.deviceId === currentDeviceId)?.label || 'Unknown / not enumerated'}</span>
        </div>

        <div style={{ background: modelLoading ? '#fef3c7' : model ? '#d1fae5' : '#fee2e2', padding: '12px', borderRadius: '8px', marginBottom: '16px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
            {modelLoading ? (
              <>
                <div style={{ width: '12px', height: '12px', borderRadius: '50%', background: '#f59e0b', animation: 'spin 1s linear infinite' }} />
                <span>{t('adminLiveDetection.aiModelLoading')} {loadProgress}%</span>
              </>
            ) : model ? (
              <span>✅ {t('adminLiveDetection.aiModelReady')} (Backend: {backendType.toUpperCase()})</span>
            ) : (
              <>
                <span>⚠️ {t('adminLiveDetection.aiModelUnavailable')}</span>
                <button onClick={() => loadModel(0)} style={{ padding: '4px 12px', background: '#3b82f6', color: 'white', border: 'none', borderRadius: '4px', cursor: 'pointer' }}>
                  {t('adminLiveDetection.retryLoad')}
                </button>
              </>
            )}
          </div>
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: '2fr 1fr', gap: '20px', marginBottom: '20px' }}>
          <div style={{ background: '#1e293b', border: '2px solid #3b82f6', borderRadius: '12px', padding: '16px', overflow: 'hidden' }}>
            <h2 style={{ margin: '0 0 12px 0', fontSize: '16px', fontWeight: 700 }}>
              📹 {t('adminLiveDetection.liveCameraFeed')}
            </h2>

            {isLive ? (
              <>
                <video
                  ref={videoRef}
                  style={{
                    width: '100%',
                    height: 'auto',
                    background: '#000',
                    borderRadius: '8px',
                    marginBottom: '12px',
                    aspectRatio: '16 / 9'
                  }}
                />
                <canvas ref={canvasRef} style={{ display: 'none' }} />

                <div style={{ display: 'flex', gap: '8px' }}>
                  <button
                    onClick={switchCamera}
                    style={{
                      padding: '12px 16px',
                      background: '#3b82f6',
                      color: '#fff',
                      border: 'none',
                      borderRadius: '6px',
                      fontWeight: 600,
                      cursor: 'pointer'
                    }}
                  >
                    🔄 {facingMode === 'user' ? t('adminLiveDetection.switchToRear') : t('adminLiveDetection.switchToFront')}
                  </button>
                  <button
                    onClick={captureFrame}
                    disabled={isAnalyzing}
                    style={{
                      flex: 1,
                      padding: '12px',
                      background: isAnalyzing ? '#64748b' : '#10b981',
                      color: '#fff',
                      border: 'none',
                      borderRadius: '6px',
                      fontWeight: 600,
                      cursor: isAnalyzing ? 'not-allowed' : 'pointer'
                    }}
                  >
                    {isAnalyzing ? t('adminLiveDetection.analyzing') : `📸 ${t('adminLiveDetection.captureAnalyze')}`}
                  </button>
                  <button
                    onClick={stopLiveCamera}
                    style={{
                      padding: '12px 24px',
                      background: '#ef4444',
                      color: '#fff',
                      border: 'none',
                      borderRadius: '6px',
                      fontWeight: 600,
                      cursor: 'pointer'
                    }}
                  >
                    {t('adminLiveDetection.stop')}
                  </button>
                </div>
              </>
            ) : (
              <button
                onClick={startLiveCamera}
                style={{
                  width: '100%',
                  padding: '24px',
                  background: '#3b82f6',
                  color: '#fff',
                  border: 'none',
                  borderRadius: '8px',
                  fontWeight: 700,
                  fontSize: '16px',
                  cursor: 'pointer',
                  transition: 'background 0.3s'
                }}
              >
                📹 {t('adminLiveDetection.startLiveCamera')}
              </button>
            )}
          </div>

          <div style={{ background: '#1e293b', border: '2px solid ' + (detectionResult?.type === 'success' ? '#10b981' : detectionResult?.type === 'invalid' || detectionResult?.type === 'human_detected' ? '#ef4444' : '#f59e0b'), borderRadius: '12px', padding: '16px' }}>
            <h2 style={{ margin: '0 0 12px 0', fontSize: '16px', fontWeight: 700 }}>
              🔍 {t('adminLiveDetection.detectionResult')}
            </h2>

            {!detectionResult ? (
              <div style={{ textAlign: 'center', padding: '24px 0', color: '#94a3b8' }}>
                <div style={{ fontSize: '32px', marginBottom: '8px' }}>📷</div>
                <p style={{ margin: 0 }}>{t('adminLiveDetection.waitingCapture')}</p>
              </div>
            ) : (
              <>
                <div style={{
                  background: detectionResult.type === 'success' ? '#064e3b' 
                    : detectionResult.type === 'human_detected' ? '#7f1d1d'
                    : detectionResult.type === 'invalid' ? '#78350f' 
                    : '#663300',
                  padding: '12px',
                  borderRadius: '6px',
                  marginBottom: '12px',
                  fontWeight: 600
                }}>
                  {detectionResult.message}
                </div>

                {/* Show reason for rejection */}
                {detectionResult.reason && detectionResult.type !== 'success' && (
                  <div style={{ 
                    padding: '8px 12px', 
                    borderRadius: '6px', 
                    marginBottom: '12px',
                    background: '#1a1a2e',
                    border: '1px solid #475569',
                    fontSize: '13px', 
                    color: '#94a3b8' 
                  }}>
                    💡 {detectionResult.reason}
                  </div>
                )}

                {detectedIssue && (
                  <div style={{ fontSize: '14px', lineHeight: '1.6', marginBottom: '12px' }}>
                    <div>
                      <span style={{ color: '#94a3b8' }}>{t('adminLiveDetection.issueType')}:</span>{' '}
                      <span style={{ fontWeight: 600, color: '#10b981' }}>
                        {detectedIssue.issueType.toUpperCase()}
                      </span>
                    </div>
                    <div>
                      <span style={{ color: '#94a3b8' }}>{t('adminLiveDetection.aiLabel')}:</span>{' '}
                      <span>{detectedIssue.label}</span>
                    </div>
                    <div>
                      <span style={{ color: '#94a3b8' }}>{t('adminLiveDetection.confidence')}:</span>{' '}
                      <span>{detectedIssue.confidence}%</span>
                    </div>
                    <div>
                      <span style={{ color: '#94a3b8' }}>{t('adminLiveDetection.realScore')}:</span>{' '}
                      <span>{detectedIssue.realScore}%</span>
                    </div>
                    {detectedIssue.civicScore && (
                      <div>
                        <span style={{ color: '#94a3b8' }}>Civic Score:</span>{' '}
                        <span style={{ color: '#10b981', fontWeight: 600 }}>{detectedIssue.civicScore}%</span>
                      </div>
                    )}
                  </div>
                )}

                {detectedIssue && (
                  <button
                    onClick={autoSubmitIssue}
                    disabled={autoSubmitting}
                    style={{
                      width: '100%',
                      padding: '10px',
                      background: autoSubmitting ? '#64748b' : '#059669',
                      color: '#fff',
                      border: 'none',
                      borderRadius: '6px',
                      fontWeight: 600,
                      cursor: autoSubmitting ? 'not-allowed' : 'pointer'
                    }}
                  >
                    {autoSubmitting ? t('adminLiveDetection.submitting') : t('adminLiveDetection.autoSubmit')}
                  </button>
                )}

                {/* Show "No civic issue" guidance */}
                {(detectionResult.type === 'no_civic' || detectionResult.type === 'human_detected') && (
                  <div style={{
                    marginTop: '12px',
                    padding: '12px',
                    borderRadius: '6px',
                    background: '#1a1a2e',
                    border: '1px solid #475569',
                    fontSize: '13px',
                    color: '#cbd5e1'
                  }}>
                    <div style={{ fontWeight: 600, marginBottom: '6px', color: '#f59e0b' }}>
                      💡 {t('adminLiveDetection.noCivicDetected')}
                    </div>
                    <ul style={{ margin: 0, paddingLeft: '16px', lineHeight: '1.6' }}>
                      <li>Point camera at a civic infrastructure issue</li>
                      <li>E.g.: potholes, garbage, water leaks, damaged roads</li>
                      <li>Avoid human faces, documents, or screenshots</li>
                    </ul>
                  </div>
                )}
              </>
            )}
          </div>
        </div>

        {lastCapture && (
          <div style={{ background: '#1e293b', border: '1px solid #475569', borderRadius: '8px', padding: '12px', marginBottom: '20px' }}>
            <h3 style={{ margin: '0 0 12px 0', fontSize: '14px', fontWeight: 600 }}>
              {t('adminLiveDetection.lastCaptured')}
            </h3>
            <img
              src={lastCapture}
              alt="Last capture"
              style={{
                width: '100%',
                maxWidth: '200px',
                borderRadius: '6px',
                border: '1px solid #475569'
              }}
            />
          </div>
        )}

        {detectionHistory.length > 0 && (
          <div style={{ background: '#1e293b', border: '1px solid #475569', borderRadius: '12px', padding: '16px' }}>
            <h2 style={{ margin: '0 0 12px 0', fontSize: '16px', fontWeight: 700 }}>
              📊 {t('adminLiveDetection.detectionHistory')}
            </h2>
            <div style={{ maxHeight: '300px', overflowY: 'auto' }}>
              {detectionHistory.map((item, idx) => (
                <div
                  key={idx}
                  style={{
                    background: '#0f172a',
                    padding: '10px 12px',
                    borderRadius: '6px',
                    marginBottom: '8px',
                    fontSize: '13px',
                    borderLeft: '3px solid #3b82f6'
                  }}
                >
                  <div style={{ fontWeight: 600, color: '#10b981' }}>
                    {item.issueType.toUpperCase()}
                  </div>
                  <div style={{ color: '#94a3b8', fontSize: '12px' }}>
                    {item.label} • {item.confidence}% • {item.timestamp}
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default AdminLiveDetection;
