import React, { useState, useRef, useEffect } from 'react';
import axios from 'axios';
import { useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import '../styles/ReportIssue.css';
import * as tf from "@tensorflow/tfjs";
import * as mobilenet from "@tensorflow-models/mobilenet";
import { detectAIImage } from '../utils/aiImageDetector';
import { VoiceReporter } from '../utils/voiceReporter';
import LanguageSelector from '../components/LanguageSelector';

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
  const { t } = useTranslation();
  const [autoReporting, setAutoReporting] = useState(false);
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
    // Load MobileNet on mount
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
      // cleanup camera stream and object URLs
      if (streamRef.current) {
        streamRef.current.getTracks().forEach(t => t.stop());
      }
      if (previewSrc) URL.revokeObjectURL(previewSrc);
    };
  }, [previewSrc]);

  const validateImageWithAI = async (imageElement) => {
    setAiDetecting(true);
    setAiResult(null);

    try {
      // ── STEP 1: Real vs AI-Generated Detection ──────────────────────────
      const detection = await detectAIImage(imageElement, formData.image);
      console.log('AI Detection Result:', detection);

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

      // ── STEP 2: MobileNet Content Classification (on real photos) ──────
      if (model) {
        const predictions = await model.classify(imageElement);
        const labels = predictions.map(p => p.className.toLowerCase()).join(' ');
        const topLabel = predictions[0]?.className || 'unknown';
        const topProbability = predictions[0]?.probability || 0;
        const topConfidence = (topProbability * 100).toFixed(1);
        console.log('MobileNet Labels:', labels);

        // ── Check for human/person content (reject invalid images) ──
        const humanKeywords = ['person', 'human', 'man', 'woman', 'boy', 'girl', 'people', 'face', 'portrait', 'selfie'];
        const isHumanImage = humanKeywords.some(k => topLabel.toLowerCase().includes(k)) || 
                            humanKeywords.some(k => labels.includes(k)) ||
                            (predictions[0]?.probability > 0.4 && humanKeywords.some(k => topLabel.toLowerCase().includes(k)));

        let faceDetected = false;
        if ('FaceDetector' in window) {
          try {
            const detector = new window.FaceDetector();
            const faces = await detector.detect(imageElement);
            faceDetected = faces && faces.length > 0;
          } catch (err) {
            console.warn('FaceDetector API failed', err);
          }
        }

        // ── Reject generic non-civic contexts (screenshots, documents, indoor scenes) if no civic signal
        const nonCivicRejectKeywords = ['monitor', 'screen', 'web site', 'notebook', 'document', 'book', 'keyboard', 'camera', 'living room', 'bedroom', 'kitchen', 'table', 'street sign', 'vehicle interior'];
        const civicHints = ['pothole', 'road', 'street', 'garbage', 'dump', 'trash', 'water', 'drain', 'pipe', 'manhole', 'streetlight', 'sidewalk', 'pavement'];
        const isNonCivic = nonCivicRejectKeywords.some(k => topLabel.toLowerCase().includes(k) || labels.includes(k));
        const hasCivicHint = civicHints.some(k => topLabel.toLowerCase().includes(k) || labels.includes(k));

        if (isHumanImage || faceDetected) {
          setAiResult({
            type: 'invalid_content',
            reason: 'Image validation failed: This appears to be a photo of a person. Please upload an image of a civic issue (e.g., pothole, garbage, damaged infrastructure) only.',
            confidence: topConfidence,
            detected: topLabel
          });
          setFaceWarning(true);
          setFormData(prev => ({ ...prev, image: null }));
          setPreviewSrc(null);
          setAiDetecting(false);
          return false;
        }

        setFaceWarning(false);

        // Calculate civic confidence score
        const civicKeywordMatches = civicHints.filter(k => topLabel.toLowerCase().includes(k) || labels.includes(k)).length;
        const nonCivicMatches = nonCivicRejectKeywords.filter(k => topLabel.toLowerCase().includes(k) || labels.includes(k)).length;
        
        let civicScore = 50; // baseline
        if (hasCivicHint) {
          civicScore += civicKeywordMatches * 15; // +15 per civic hint matched
          civicScore = Math.min(civicScore, 95); // cap at 95
        }
        if (nonCivicMatches > 0) {
          civicScore -= nonCivicMatches * 20;
        }
        civicScore = Math.max(0, Math.min(100, civicScore));

        setCivicConfidence(civicScore);
        setCivicMatched(hasCivicHint);

        if (!hasCivicHint) {
          setAiResult({
            type: 'invalid_content',
            reason: 'Image validation failed: No civic issue content detected (pothole/garbage/streetlight/drainage/road). Please capture a relevant issue image.',
            confidence: topConfidence,
            detected: topLabel
          });
          setFormData(prev => ({ ...prev, image: null }));
          setPreviewSrc(null);
          setAiDetecting(false);
          return false;
        }

        if (isNonCivic) {
          setAiResult({
            type: 'invalid_content',
            reason: 'Image validation failed: The image appears unrelated to civic issues. Upload a photo of road damage, garbage, water leaks, streetlight failure, etc.',
            confidence: topConfidence,
            detected: topLabel
          });
          setFormData(prev => ({ ...prev, image: null }));
          setPreviewSrc(null);
          setAiDetecting(false);
          return false;
        }

        if (!hasCivicHint && !isHumanImage && topProbability > 0.7) {
          setAiResult({
            type: 'invalid_content',
            reason: 'Image may not show a civic issue. Please use a clear photo of road/infrastructure problem.',
            confidence: topConfidence,
            detected: topLabel
          });
          setFormData(prev => ({ ...prev, image: null }));
          setPreviewSrc(null);
          setAiDetecting(false);
          return false;
        }

        // ── Image Color/Texture Analysis for smarter classification ──
        const canvas = document.createElement('canvas');
        const ctx = canvas.getContext('2d');
        canvas.width = imageElement.naturalWidth || imageElement.width || 200;
        canvas.height = imageElement.naturalHeight || imageElement.height || 200;
        ctx.drawImage(imageElement, 0, 0, canvas.width, canvas.height);
        const imgData = ctx.getImageData(0, 0, canvas.width, canvas.height).data;

        // Calculate dominant color channels
        let darkPixels = 0, grayPixels = 0;
        const pixelCount = imgData.length / 4;
        for (let i = 0; i < imgData.length; i += 4) {
          const brightness = (imgData[i] + imgData[i+1] + imgData[i+2]) / 3;
          if (brightness < 80) darkPixels++;
          const diff = Math.abs(imgData[i] - imgData[i+1]) + Math.abs(imgData[i+1] - imgData[i+2]);
          if (diff < 30 && brightness > 60 && brightness < 180) grayPixels++;
        }
        const darkRatio = darkPixels / pixelCount;
        const grayRatio = grayPixels / pixelCount;

        // Auto-fill logic
        const fileName = formData.image?.name?.toLowerCase() || '';
        let detectedType = 'other';
        let autoTitle = '';
        let autoDesc = '';
        const locationStr = formData.location.streetName || formData.location.area || 'reported location';

        // ── POTHOLE keywords (expanded with MobileNet misclassifications)
        const potholeKeywords = ['pothole', 'hole', 'asphalt', 'crater', 'pit', 'manhole', 'grating', 'grate', 'turtle', 'terrapin', 'tortoise'];
        // ── GARBAGE keywords
        const garbageKeywords = ['trash', 'garbage', 'dump', 'waste', 'plastic', 'bag', 'container', 'bucket', 'debris', 'litter', 'rubbish', 'bin', 'can'];
        // ── STREETLIGHT keywords
        const lightKeywords = ['light', 'lamp', 'streetlight', 'pole', 'bulb', 'lantern', 'spotlight', 'electric'];
        // ── WATER keywords
        const waterKeywords = ['leak', 'water', 'flood', 'drain', 'pipe', 'puddle', 'wet', 'overflow', 'sewer', 'sewage'];
        // ── ROAD keywords
        const roadKeywords = ['road', 'street', 'concrete', 'sidewalk', 'curb', 'pavement', 'bridge', 'highway', 'path', 'crack'];

        const matchAny = (keywords) => keywords.some(k => labels.includes(k) || fileName.includes(k));

        if (matchAny(potholeKeywords) || (grayRatio > 0.3 && darkRatio > 0.15)) {
          detectedType = 'pothole';
          autoTitle = 'Pothole / Road Damage Detected on ' + locationStr;
          autoDesc = `🔍 AI ANALYSIS REPORT\n━━━━━━━━━━━━━━━━━━━━\n✅ Image verified as REAL photograph\n📊 AI Classification: ${topLabel} (${topConfidence}% confidence)\n\n⚠️ ISSUE: Dangerous pothole/road damage identified\n📍 Location: ${locationStr}\n📝 Details: A significant pothole or road surface damage has been detected through AI-powered image analysis. The damaged area poses risk to vehicles and pedestrians. Immediate repair and leveling is recommended.\n\n🤖 Auto-generated by CivicSense AI`;
        }
        else if (matchAny(garbageKeywords)) {
          detectedType = 'garbage';
          autoTitle = 'Garbage Overflow / Illegal Dumping at ' + locationStr;
          autoDesc = `🔍 AI ANALYSIS REPORT\n━━━━━━━━━━━━━━━━━━━━\n✅ Image verified as REAL photograph\n📊 AI Classification: ${topLabel} (${topConfidence}% confidence)\n\n⚠️ ISSUE: Garbage accumulation or illegal dumping detected\n📍 Location: ${locationStr}\n📝 Details: Significant waste buildup has been identified. This poses public health risks and requires urgent municipal cleanup action.\n\n🤖 Auto-generated by CivicSense AI`;
        }
        else if (matchAny(lightKeywords)) {
          detectedType = 'streetlight';
          autoTitle = 'Streetlight / Public Lighting Issue at ' + locationStr;
          autoDesc = `🔍 AI ANALYSIS REPORT\n━━━━━━━━━━━━━━━━━━━━\n✅ Image verified as REAL photograph\n📊 AI Classification: ${topLabel} (${topConfidence}% confidence)\n\n⚠️ ISSUE: Faulty or damaged streetlight detected\n📍 Location: ${locationStr}\n📝 Details: Public lighting infrastructure issue identified. Area may be unsafe at night. Electrical inspection and repair recommended.\n\n🤖 Auto-generated by CivicSense AI`;
        }
        else if (matchAny(waterKeywords)) {
          detectedType = 'water_leak';
          autoTitle = 'Water Leakage / Drainage Problem at ' + locationStr;
          autoDesc = `🔍 AI ANALYSIS REPORT\n━━━━━━━━━━━━━━━━━━━━\n✅ Image verified as REAL photograph\n📊 AI Classification: ${topLabel} (${topConfidence}% confidence)\n\n⚠️ ISSUE: Water leakage or drainage blockage detected\n📍 Location: ${locationStr}\n📝 Details: Possible pipeline burst or clogged drainage system. May cause waterlogging and infrastructure damage if not addressed promptly.\n\n🤖 Auto-generated by CivicSense AI`;
        }
        else if (matchAny(roadKeywords)) {
          detectedType = 'damaged_road';
          autoTitle = 'Road / Infrastructure Damage at ' + locationStr;
          autoDesc = `🔍 AI ANALYSIS REPORT\n━━━━━━━━━━━━━━━━━━━━\n✅ Image verified as REAL photograph\n📊 AI Classification: ${topLabel} (${topConfidence}% confidence)\n\n⚠️ ISSUE: Road or public infrastructure deterioration\n📍 Location: ${locationStr}\n📝 Details: General road damage or public infrastructure issue detected by AI scanner. Area needs maintenance and safety evaluation.\n\n🤖 Auto-generated by CivicSense AI`;
        }
        else {
          // Smart fallback — always give a meaningful result
          detectedType = 'other';
          autoTitle = 'Civic Infrastructure Issue Detected at ' + locationStr;
          autoDesc = `🔍 AI ANALYSIS REPORT\n━━━━━━━━━━━━━━━━━━━━\n✅ Image verified as REAL photograph\n📊 AI Classification: ${topLabel} (${topConfidence}% confidence)\n\n⚠️ ISSUE: Civic infrastructure issue requiring attention\n📍 Location: ${locationStr}\n📝 Details: AI analysis has verified this as a real photograph of a civic issue. Visual content analysis detected: ${topLabel}. Municipal authorities should inspect and assess the situation.\n\n🤖 Auto-generated by CivicSense AI`;
        }

        setFormData(prev => ({
          ...prev,
          issueType: detectedType,
          title: autoTitle,
          description: autoDesc
        }));
      }

      setAiResult({
        type: 'real',
        confidence: detection.confidence,
        reason: detection.reason,
        scores: detection.scores
      });

      // Live camera auto-submit workflow
      if (cameraMode) {
        setAutoReporting(true);
        setSuccess('Live camera issue detected. Auto-submitting report...');
        await submitReport();
        setCameraMode(false);
      }

      setAiDetecting(false);
      return true;

    } catch (err) {
      console.error('Validation error:', err);
      setAiDetecting(false);
      return true; // fail-open if error
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
    // Stop previous stream if exists
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
    // allow user to change manual fields
    setFormData({
      ...formData,
      latitude: null,
      longitude: null,
      location: {
        streetName: '', area: '', city: '', district: '', state: '', municipality: ''
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

      // Save coordinates first
      setFormData(prev => ({
        ...prev,
        latitude: lat,
        longitude: lon
      }));

      // Reverse geocoding with better error handling
      fetch(`https://nominatim.openstreetmap.org/reverse?format=jsonv2&lat=${lat}&lon=${lon}`, {
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

          setFormData(prev => ({
            ...prev,
            location: {
              streetName: addr.road || addr.pedestrian || addr.cycleway || '',
              area: addr.neighbourhood || addr.suburb || addr.city_district || '',
              city: addr.city || addr.town || addr.village || '',
              district: addr.county || addr.state_district || '',
              state: addr.state || '',
              municipality: addr.city || addr.town || addr.village || addr.county || ''
            }
          }));

          setSuccess('Location obtained successfully');
        })
        .catch((err) => {
          console.error('Reverse geocode failed:', err);

          // Fallback if API fails
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

      // Emergency alert data
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
      setAutoReporting(false);
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
          <LanguageSelector />
        </div>
        <form onSubmit={handleSubmit}>
          <div className="form-group ai-detection-box" style={{ background: '#f4f6fb', padding: '15px', borderRadius: '8px', borderLeft: '4px solid #667eea' }}>
            <h3 style={{ margin: '0 0 10px 0', color: '#667eea', fontSize: '16px' }}>
              🤖 {t('reportIssue.title')}
            </h3>
            <p style={{ margin: '0 6px 6px 0', color: '#333', fontWeight: 600 }}>
              ⚙️ Workflow
            </p>
            <ul style={{ margin: '0 0 8px 16px', color: '#555', fontSize: '14px', lineHeight: 1.45 }}>
              <li>{t('reportIssue.voiceReport')}</li>
              <li>Captures image (or live feed)</li>
              <li>AI model analyzes it</li>
              <li>System auto-detects issue type, location, priority</li>
              <li>Sends complaint automatically</li>
            </ul>
            <p style={{ margin: 0, color: '#555', fontSize: '14px' }}>
              Live camera capture is now active. Upload/scan land-infrastructure photos only (human/private images are blocked).
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
                ✓ {t('voiceReport.recognized')}: {voiceTranscript}
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
                <button type="button" className="btn-secondary" onClick={() => document.getElementById('fileInput').click()}>Choose Image</button>
                <button type="button" className="btn-secondary" onClick={startCamera}>Use Camera</button>
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
                    <button type="button" className="btn-location" onClick={capturePhoto}>Capture</button>
                    <button type="button" className="btn-secondary" onClick={stopCamera}>Close</button>
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
                  ✅ Matched civic issue
                </div>
              )}

              {civicMatched && (
                <div style={{ marginTop: 10 }}>
                  <div style={{ fontSize: 12, fontWeight: 600, color: '#374151', marginBottom: 4 }}>Civic Confidence: {civicConfidence}%</div>
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
                🚨 REAL CIVIC IMAGE REQUESTED (pothole, garbage, flood, streetlight, road damage)
              </div>

              {faceWarning && (
                <div style={{ marginTop: 10, padding: '10px 12px', borderRadius: 8, background: '#fefce8', border: '1px solid #f59e0b', color: '#92400e', fontWeight: 700 }}>
                  ⚠️ Face detected. Please point at civic structure only.
                </div>
              )}

              {/* Detecting spinner */}
              {aiDetecting && (
                <div style={{ marginTop: 14, padding: '14px 16px', background: '#f0f4ff', borderRadius: 10, borderLeft: '4px solid #6366f1', display: 'flex', alignItems: 'center', gap: 12 }}>
                  <div style={{ width: 20, height: 20, border: '3px solid #c7d2fe', borderTopColor: '#4338ca', borderRadius: '50%', animation: 'spin 0.8s linear infinite', flexShrink: 0 }} />
                  <div>
                    <div style={{ fontWeight: 600, color: '#3730a3', fontSize: 14 }}>🔬 Analyzing Image...</div>
                    <div style={{ fontSize: 12, color: '#6b7280', marginTop: 2 }}>Checking EXIF metadata, noise patterns, edge frequency & color distribution</div>
                  </div>
                </div>
              )}

              {/* Detection result panel */}
              {aiResult && !aiDetecting && (() => {
                const isReal = aiResult.type === 'real';
                const isInvalid = aiResult.type === 'invalid_content';
                const s = aiResult.scores || {};
                const factors = [
                  { label: 'EXIF Metadata', score: s.exifScore, tip: 'Camera metadata presence' },
                  { label: 'Sensor Noise', score: s.noiseScore, tip: 'Natural camera noise level' },
                  { label: 'Edge Frequency', score: s.edgeScore, tip: 'Edge variation (AI = too uniform)' },
                  { label: 'Color Channels', score: s.channelScore, tip: 'RGB channel correlation' },
                  { label: 'Block Artifacts', score: s.blockScore, tip: 'AI model grid patterns' },
                ];
                return (
                  <div style={{
                    marginTop: 14, borderRadius: 12, overflow: 'hidden',
                    border: `2px solid ${isReal ? '#10b981' : isInvalid ? '#f59e0b' : '#ef4444'}`,
                    background: isReal ? '#f0fdf4' : isInvalid ? '#fffbeb' : '#fef2f2'
                  }}>
                    {/* Header */}
                    <div style={{ padding: '12px 16px', background: isReal ? '#10b981' : isInvalid ? '#f59e0b' : '#ef4444', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                      <div style={{ color: '#fff', fontWeight: 700, fontSize: 14 }}>
                        {isReal ? '✅ REAL PHOTO VERIFIED' : isInvalid ? '🚫 INVALID CONTENT DETECTED' : '🤖 AI-GENERATED IMAGE DETECTED'}
                      </div>
                      <div style={{ background: 'rgba(255,255,255,0.25)', color: '#fff', borderRadius: 20, padding: '2px 12px', fontWeight: 700, fontSize: 13 }}>
                        {isInvalid ? 'Invalid' : `${aiResult.confidence}% ${isReal ? 'Real' : 'AI'}`}
                      </div>
                    </div>
                    {/* Reason */}
                    <div style={{ padding: '10px 16px', fontSize: 13, color: isReal ? '#065f46' : isInvalid ? '#92400e' : '#991b1b', borderBottom: '1px solid ' + (isReal ? '#a7f3d0' : isInvalid ? '#fed7aa' : '#fecaca') }}>
                      {isReal ? '📷' : isInvalid ? '⚠️' : '🤖'} {aiResult.reason}
                    </div>
                    {/* Factor breakdown */}
                    <div style={{ padding: '12px 16px', display: 'flex', flexDirection: 'column', gap: 8 }}>
                      <div style={{ fontSize: 11, fontWeight: 600, color: '#6b7280', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: 2 }}>Detection Breakdown</div>
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
                    {!isReal && !isInvalid && (
                      <div style={{ padding: '10px 16px', background: '#fee2e2', color: '#991b1b', fontSize: 13, fontWeight: 500 }}>
                        ❌ Upload rejected. Please submit a real photo taken with your camera.
                      </div>
                    )}
                    {isInvalid && (
                      <div style={{ padding: '10px 16px', background: '#fef3c7', color: '#92400e', fontSize: 13, fontWeight: 500 }}>
                        🚫 Content validation failed. Please upload an image of a civic issue only (e.g., potholes, garbage, damaged infrastructure).
                      </div>
                    )}
                    {isInvalid && (
                      <div style={{ padding: '12px 16px', background: '#fef3c7', borderTop: '1px solid #fed7aa' }}>
                        <div style={{ fontSize: 12, fontWeight: 600, color: '#92400e', marginBottom: 6 }}>I believe this is a valid civic issue:</div>
                        <div style={{ display: 'flex', gap: 8 }}>
                          <input
                            type="text"
                            placeholder="Explain why (e.g., pothole visibility issue with AI detection)"
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
                            {overrideMode ? '✓ Override' : 'Override'}
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
            <label>Title</label>
            <input
              name="title"
              value={formData.title}
              onChange={handleChange}
              placeholder="AI will generate title from image..."
              required
            />
          </div>

          <div className="form-group">
            <label>Description:</label>
            <textarea
              name="description"
              value={formData.description}
              onChange={handleChange}
              placeholder="AI will generate description from image..."
              required
            />
          </div>

          <div className="location-section">
            <h3>Location Details</h3>
            <button type="button" className="btn-location" onClick={handleGetLocation}>
              Get Current Location
            </button>

            {formData.latitude && formData.longitude && (
              <div style={{ marginTop: '15px', marginBottom: '15px', padding: '10px', background: '#eef2ff', borderRadius: '5px', borderLeft: '4px solid #667eea', fontSize: '14px', color: '#333' }}>
                <strong style={{ color: '#667eea' }}>Latitude:</strong> {formData.latitude.toFixed(6)} <br/>
                <strong style={{ color: '#667eea' }}>Longitude:</strong> {formData.longitude.toFixed(6)}
              </div>
            )}

            <div className="form-row">
              <div className="form-group">
                <label>Street Name:</label>
                <input
                  type="text"
                  name="streetName"
                  value={formData.location.streetName}
                  onChange={handleLocationChange}
                  required
                />
              </div>
              <div className="form-group">
                <label>Area:</label>
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
                <label>City:</label>
                <input
                  type="text"
                  name="city"
                  value={formData.location.city}
                  onChange={handleLocationChange}
                  required
                />
              </div>
              <div className="form-group">
                <label>District:</label>
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
                <label>State:</label>
                <input
                  type="text"
                  name="state"
                  value={formData.location.state}
                  onChange={handleLocationChange}
                  required
                />
              </div>
              <div className="form-group">
                <label>Municipality:</label>
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
                  <strong>Location:</strong> {formData.location.streetName || ''} {formData.location.area ? `, ${formData.location.area}` : ''}
                  <div>{formData.location.city}{formData.location.district ? `, ${formData.location.district}` : ''}</div>
                </div>
                <div className="location-actions">
                  <button type="button" className="btn-location" onClick={() => window.open(`https://www.google.com/maps?q=${formData.latitude},${formData.longitude}`, '_blank')}>Get directions</button>
                  <button type="button" className="btn-secondary" onClick={handleCopyMunicipality}>Copy municipality</button>
                  <button type="button" className="btn-secondary" onClick={handleContactMunicipality}>Contact municipality</button>
                  <button type="button" className="btn-secondary" onClick={handleChangeLocation}>Change</button>
                </div>
              </div>
            )}
          </div>

          {error && <p className="error">{error}</p>}
          {success && <p className="success">{success}</p>}

          <button type="submit" disabled={loading}>
            {loading ? 'Reporting...' : 'Submit Report'}
          </button>
        </form>
      </div>
    </div>
  );
}

export default ReportIssue;
