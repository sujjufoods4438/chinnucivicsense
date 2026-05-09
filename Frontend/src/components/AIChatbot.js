import React, { useState, useRef, useEffect } from 'react';
import { GoogleGenerativeAI } from '@google/generative-ai';

const AIChatbot = () => {
  const [isOpen, setIsOpen] = useState(false);
  const [messages, setMessages] = useState([
    { text: "Hi! I'm CivicBot. How can I help you improve our city today?", sender: "bot" }
  ]);
  const [input, setInput] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const messagesEndRef = useRef(null);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages]);

  const handleSend = async () => {
    if (!input.trim()) return;
    
    const userMsg = input.trim();
    setMessages(prev => [...prev, { text: userMsg, sender: "user" }]);
    setInput("");
    setIsLoading(true);

    try {
      const apiKey = process.env.REACT_APP_GEMINI_API_KEY;
      if (!apiKey || apiKey === 'YOUR_API_KEY') {
        throw new Error('Gemini API key is not configured.');
      }

      const genAI = new GoogleGenerativeAI(apiKey);
      const model = genAI.getGenerativeModel({ model: "gemini-1.5-flash" });
      
      const prompt = `You are CivicBot, an enthusiastic and helpful AI assistant for the CivicSense platform. 
      CivicSense is an app where citizens report civic issues (like potholes, garbage, water leaks) using AI image analysis.
      Users can earn points for reporting issues and checking the leaderboard.
      The user says: "${userMsg}". 
      Respond concisely, friendly, and helpfully. Do not use markdown.`;

      const result = await model.generateContent(prompt);
      const response = result.response.text();

      setMessages(prev => [...prev, { text: response, sender: "bot" }]);
    } catch (error) {
      setMessages(prev => [...prev, { 
        text: "Sorry, I couldn't connect right now. Please check if the API key is configured.", 
        sender: "bot" 
      }]);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div style={{ position: 'fixed', bottom: '20px', right: '20px', zIndex: 1000 }}>
      {isOpen ? (
        <div style={{ width: '300px', height: '400px', background: '#fff', borderRadius: '12px', boxShadow: '0 5px 15px rgba(0,0,0,0.2)', display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
          <div style={{ background: '#3b82f6', color: '#fff', padding: '15px', fontWeight: 'bold', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <span>🤖 CivicBot</span>
            <button onClick={() => setIsOpen(false)} style={{ background: 'transparent', border: 'none', color: '#fff', cursor: 'pointer', fontSize: '16px' }}>✖</button>
          </div>
          
          <div style={{ flex: 1, padding: '10px', overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: '8px', background: '#f8fafc' }}>
            {messages.map((msg, i) => (
              <div key={i} style={{ 
                alignSelf: msg.sender === 'user' ? 'flex-end' : 'flex-start',
                background: msg.sender === 'user' ? '#3b82f6' : '#e2e8f0',
                color: msg.sender === 'user' ? '#fff' : '#1e293b',
                padding: '8px 12px',
                borderRadius: '8px',
                maxWidth: '80%',
                fontSize: '14px'
              }}>
                {msg.text}
              </div>
            ))}
            {isLoading && <div style={{ alignSelf: 'flex-start', color: '#64748b', fontSize: '12px' }}>Thinking...</div>}
            <div ref={messagesEndRef} />
          </div>

          <div style={{ padding: '10px', borderTop: '1px solid #e2e8f0', display: 'flex', gap: '8px' }}>
            <input 
              type="text" 
              value={input}
              onChange={e => setInput(e.target.value)}
              onKeyPress={e => e.key === 'Enter' && handleSend()}
              placeholder="Ask me anything..."
              style={{ flex: 1, padding: '8px', border: '1px solid #cbd5e1', borderRadius: '4px', outline: 'none' }}
            />
            <button onClick={handleSend} disabled={isLoading} style={{ background: '#3b82f6', color: '#fff', border: 'none', borderRadius: '4px', padding: '0 12px', cursor: 'pointer' }}>
              Send
            </button>
          </div>
        </div>
      ) : (
        <button 
          onClick={() => setIsOpen(true)} 
          style={{ width: '60px', height: '60px', borderRadius: '30px', background: '#3b82f6', color: '#fff', border: 'none', boxShadow: '0 4px 10px rgba(0,0,0,0.3)', cursor: 'pointer', fontSize: '24px', display: 'flex', alignItems: 'center', justifyContent: 'center' }}
        >
          💬
        </button>
      )}
    </div>
  );
};

export default AIChatbot;
