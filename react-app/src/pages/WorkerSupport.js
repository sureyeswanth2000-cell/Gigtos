import React, { useState, useRef, useEffect } from 'react';

const purple = '#A259FF';

const QUICK_REPLIES = [
  'How do I get more jobs?',
  'My payment is delayed',
  'I need to cancel a booking',
  'Account issue',
];

const INITIAL_MESSAGES = [
  { id: 1, from: 'support', text: 'Hi! Welcome to Gigtos Support 👋 How can I help you today?', time: 'Just now' },
];

const AUTO_REPLIES = {
  'how do i get more jobs': 'To get more jobs, make sure your profile is complete and your status is active. Browse open work in the Open Work section!',
  'my payment is delayed': 'We apologize for the delay! Payments are processed within 2-3 business days. Please share your booking ID and we\'ll look into it.',
  'i need to cancel a booking': 'To cancel a booking, go to your work history and select the job. Please note cancellations within 2 hours may incur a penalty.',
  'account issue': 'For account issues, please provide your registered phone number and we\'ll assist you right away.',
};

export default function WorkerSupport() {
  const [messages, setMessages] = useState(INITIAL_MESSAGES);
  const [input, setInput] = useState('');
  const bottomRef = useRef(null);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  const sendMessage = (text) => {
    const userMsg = { id: Date.now(), from: 'user', text, time: new Date().toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' }) };
    const key = text.toLowerCase();
    const replyText = AUTO_REPLIES[key] || "Thanks for reaching out! A support agent will respond shortly. Our hours are 9 AM – 6 PM IST.";
    const supportMsg = { id: Date.now() + 1, from: 'support', text: replyText, time: new Date().toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' }) };
    setMessages(prev => [...prev, userMsg, supportMsg]);
    setInput('');
  };

  const handleSubmit = (e) => {
    e.preventDefault();
    if (input.trim()) sendMessage(input.trim());
  };

  return (
    <main style={{ maxWidth: 680, margin: '24px auto', padding: '0 16px', display: 'flex', flexDirection: 'column', height: 'calc(100vh - 160px)', minHeight: 480 }} aria-label="Support Chat">
      <h1 style={{ fontSize: 24, fontWeight: 700, marginBottom: 4 }}>💬 Support</h1>
      <p style={{ color: '#6b7280', marginBottom: 16, fontSize: 13 }}>Get help from the Gigtos support team</p>

      <div style={{ flex: 1, overflowY: 'auto', background: '#f9fafb', borderRadius: 12, border: '1px solid #e5e7eb', padding: 16, display: 'flex', flexDirection: 'column', gap: 12, marginBottom: 12 }} role="log" aria-live="polite" aria-label="Chat messages">
        {messages.map(msg => (
          <div key={msg.id} style={{ display: 'flex', justifyContent: msg.from === 'user' ? 'flex-end' : 'flex-start' }}>
            <div style={{ maxWidth: '75%', background: msg.from === 'user' ? purple : '#fff', color: msg.from === 'user' ? '#fff' : '#374151', borderRadius: msg.from === 'user' ? '12px 12px 0 12px' : '12px 12px 12px 0', padding: '10px 14px', boxShadow: '0 1px 4px rgba(0,0,0,0.08)' }}>
              <p style={{ margin: 0, fontSize: 14, lineHeight: 1.5 }}>{msg.text}</p>
              <p style={{ margin: '4px 0 0', fontSize: 11, opacity: 0.7, textAlign: 'right' }}>{msg.time}</p>
            </div>
          </div>
        ))}
        <div ref={bottomRef} />
      </div>

      <div style={{ marginBottom: 10 }}>
        <p style={{ fontSize: 12, color: '#9ca3af', marginBottom: 6 }}>Quick replies:</p>
        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
          {QUICK_REPLIES.map(r => (
            <button key={r} onClick={() => sendMessage(r)} style={{ padding: '6px 12px', border: `1px solid ${purple}`, borderRadius: 20, background: '#fff', color: purple, cursor: 'pointer', fontSize: 12, fontWeight: 600 }} aria-label={`Quick reply: ${r}`}>
              {r}
            </button>
          ))}
        </div>
      </div>

      <form onSubmit={handleSubmit} style={{ display: 'flex', gap: 10 }}>
        <input
          type="text"
          value={input}
          onChange={e => setInput(e.target.value)}
          placeholder="Type your message..."
          aria-label="Type your support message"
          style={{ flex: 1, padding: '12px 14px', borderRadius: 10, border: '1px solid #d1d5db', fontSize: 14 }}
        />
        <button type="submit" disabled={!input.trim()} style={{ padding: '12px 20px', background: purple, color: '#fff', border: 'none', borderRadius: 10, cursor: input.trim() ? 'pointer' : 'not-allowed', fontWeight: 700, opacity: input.trim() ? 1 : 0.6 }} aria-label="Send message">
          Send
        </button>
      </form>
    </main>
  );
}
