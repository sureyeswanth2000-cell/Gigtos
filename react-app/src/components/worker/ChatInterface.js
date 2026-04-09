import React, { useState, useEffect, useRef } from 'react';

const LS_KEY = 'worker_support_chat';
const QUICK_REPLIES = ['Payment issue', 'Job dispute', 'Technical problem', 'Other'];

export default function ChatInterface({ workerName }) {
  const [messages, setMessages] = useState([]);
  const [input, setInput] = useState('');
  const messagesEndRef = useRef(null);

  useEffect(() => {
    const stored = localStorage.getItem(LS_KEY);
    if (stored) {
      setMessages(JSON.parse(stored));
    } else {
      const welcome = [{
        id: 1,
        role: 'support',
        text: `Hi ${workerName || 'there'}! 👋 Welcome to Gigtos Support. How can we help you today?`,
        time: new Date().toISOString()
      }];
      setMessages(welcome);
      localStorage.setItem(LS_KEY, JSON.stringify(welcome));
    }
  }, [workerName]);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  const sendMessage = (text) => {
    if (!text.trim()) return;
    const newMsg = {
      id: Date.now(),
      role: 'worker',
      text: text.trim(),
      time: new Date().toISOString()
    };
    const updated = [...messages, newMsg];
    setMessages(updated);
    localStorage.setItem(LS_KEY, JSON.stringify(updated));
    setInput('');

    // Simulate support reply after delay
    setTimeout(() => {
      const reply = {
        id: Date.now() + 1,
        role: 'support',
        text: `Thanks for reaching out! Our team will review your message about "${text.trim().substring(0, 30)}..." and get back to you shortly. ⏱️`,
        time: new Date().toISOString()
      };
      const withReply = [...updated, reply];
      setMessages(withReply);
      localStorage.setItem(LS_KEY, JSON.stringify(withReply));
    }, 1500);
  };

  const formatTime = (iso) => {
    const d = new Date(iso);
    return d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  };

  return (
    <div className="chat-container">
      {/* Status bar */}
      <div style={{
        background: '#F5F3FF',
        borderRadius: 10,
        padding: '8px 14px',
        marginBottom: 12,
        fontSize: 13,
        color: '#7C3AED',
        fontWeight: 500,
        textAlign: 'center',
        border: '1px solid #E9D5FF'
      }}>
        🟢 Support is online · Typically replies in 1-2 hours
      </div>

      {/* Quick Replies */}
      <div className="filter-row" style={{ marginBottom: 8 }}>
        {QUICK_REPLIES.map(q => (
          <button
            key={q}
            className="filter-chip"
            onClick={() => sendMessage(q)}
          >
            {q}
          </button>
        ))}
      </div>

      {/* Messages */}
      <div className="chat-messages">
        {messages.map(msg => (
          <div key={msg.id} style={{
            display: 'flex',
            flexDirection: 'column',
            alignItems: msg.role === 'worker' ? 'flex-end' : 'flex-start',
            marginBottom: 10
          }}>
            <div className={`chat-bubble ${msg.role}`}>
              {msg.text}
            </div>
            <div className="chat-timestamp">{formatTime(msg.time)}</div>
          </div>
        ))}
        <div ref={messagesEndRef} />
      </div>

      {/* Input */}
      <div className="chat-input-row">
        <input
          type="text"
          className="chat-input"
          placeholder="Type your message..."
          value={input}
          onChange={e => setInput(e.target.value)}
          onKeyDown={e => e.key === 'Enter' && sendMessage(input)}
        />
        <button
          className="btn-primary"
          style={{ width: 48, height: 48, borderRadius: 24, padding: 0, fontSize: 20, flexShrink: 0 }}
          onClick={() => sendMessage(input)}
        >
          ➤
        </button>
      </div>
    </div>
  );
}
