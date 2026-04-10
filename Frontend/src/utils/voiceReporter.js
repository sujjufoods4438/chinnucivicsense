/**
 * Voice Reporting Module
 * Uses Web Speech API for real-time voice input
 */

export const VoiceReporter = {
  recognition: null,
  isListening: false,
  transcript: '',

  init: function() {
    const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
    if (!SpeechRecognition) {
      console.warn('Speech Recognition API not supported');
      return false;
    }
    
    this.recognition = new SpeechRecognition();
    this.recognition.continuous = true;
    this.recognition.interimResults = true;
    this.recognition.lang = localStorage.getItem('preferredLanguage') === 'hi' ? 'hi-IN' : 'en-US';
    
    return true;
  },

  start: function(onResultCallback, onErrorCallback) {
    if (!this.recognition) {
      if (!this.init()) {
        onErrorCallback('Speech Recognition not supported');
        return;
      }
    }

    this.transcript = '';
    this.isListening = true;

    this.recognition.onstart = () => {
      console.log('Voice input started');
    };

    this.recognition.onresult = (event) => {
      let interimTranscript = '';
      for (let i = event.resultIndex; i < event.results.length; i++) {
        const transcript = event.results[i][0].transcript;
        if (event.results[i].isFinal) {
          this.transcript += transcript + ' ';
        } else {
          interimTranscript += transcript;
        }
      }
      
      if (onResultCallback) {
        onResultCallback({
          final: this.transcript,
          interim: interimTranscript,
          isFinal: event.results[event.results.length - 1].isFinal
        });
      }
    };

    this.recognition.onerror = (event) => {
      console.error('Speech recognition error:', event.error);
      if (onErrorCallback) {
        onErrorCallback(event.error);
      }
    };

    this.recognition.onend = () => {
      this.isListening = false;
      console.log('Voice input stopped');
    };

    try {
      this.recognition.start();
    } catch (err) {
      console.error('Could not start voice recognition:', err);
      onErrorCallback(err.message);
    }
  },

  stop: function() {
    if (this.recognition && this.isListening) {
      this.recognition.stop();
      this.isListening = false;
    }
    return this.transcript;
  },

  abort: function() {
    if (this.recognition) {
      this.recognition.abort();
      this.isListening = false;
      this.transcript = '';
    }
  },

  setLanguage: function(lang) {
    if (this.recognition) {
      this.recognition.lang = lang === 'hi' ? 'hi-IN' : 'en-US';
    }
  },

  getTranscript: function() {
    return this.transcript;
  }
};

export default VoiceReporter;
