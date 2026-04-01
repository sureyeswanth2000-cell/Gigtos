import React, { useEffect, useMemo, useState } from 'react';
import { httpsCallable } from 'firebase/functions';
import { functionsInstance } from '../firebase';
import {
  buildLocalAssistantFallback,
  buildPromptSuggestions,
  findRelevantService,
  formatPriceInsight,
} from '../utils/aiAssistant';

export default function ConsumerAiAssistant({ services = [], onBookService }) {
  const [question, setQuestion] = useState('');
  const [messages, setMessages] = useState([
    {
      role: 'assistant',
      text: 'Hi, I’m Gito AI. I can help you choose a service, compare expected costs, and guide you to booking in one step.',
    },
  ]);
  const [loading, setLoading] = useState(false);
  const [insights, setInsights] = useState([]);
  const [selectedService, setSelectedService] = useState('');

  useEffect(() => {
    let active = true;

    const loadInsights = async () => {
      try {
        const callable = httpsCallable(functionsInstance, 'getServiceInsights');
        const response = await callable({});
        if (active) {
          setInsights(response.data?.services || []);
        }
      } catch {
        if (active) {
          setInsights(
            services.map((service) => ({
              service: service.name,
              availableWorkers: 0,
              averageRating: null,
              minQuote: null,
              maxQuote: null,
              averageQuote: null,
              quoteCount: 0,
            }))
          );
        }
      }
    };

    loadInsights();
    return () => {
      active = false;
    };
  }, [services]);

  const promptSuggestions = useMemo(() => buildPromptSuggestions(selectedService || 'service'), [selectedService]);

  const sendQuestion = async (promptText) => {
    const text = (promptText || question).trim();
    if (!text) return;

    setQuestion('');
    setLoading(true);
    setMessages((prev) => [...prev, { role: 'user', text }]);

    const inferredService = findRelevantService(text)?.name || selectedService;
    if (inferredService) {
      setSelectedService(inferredService);
    }

    try {
      const callable = httpsCallable(functionsInstance, 'aiBookingAssistant');
      const response = await callable({
        message: text,
        selectedService: inferredService || '',
      });

      const reply = response.data?.reply || buildLocalAssistantFallback({
        message: text,
        selectedService: inferredService,
        insights,
      });

      setMessages((prev) => [...prev, { role: 'assistant', text: reply }]);
      if (response.data?.insights?.length) {
        setInsights(response.data.insights);
      }
    } catch {
      const reply = buildLocalAssistantFallback({
        message: text,
        selectedService: inferredService,
        insights,
      });
      setMessages((prev) => [...prev, { role: 'assistant', text: reply }]);
    } finally {
      setLoading(false);
    }
  };

  const matchedService = services.find((service) => service.name === selectedService) || findRelevantService(messages[messages.length - 1]?.text || '');

  return (
    <section style={{
      marginBottom: '32px',
      padding: '20px',
      background: 'linear-gradient(135deg, #111827 0%, #1d4ed8 100%)',
      borderRadius: '16px',
      color: 'white',
      boxShadow: '0 12px 30px rgba(15, 23, 42, 0.18)'
    }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', gap: '16px', flexWrap: 'wrap', marginBottom: '18px' }}>
        <div>
          <div style={{ fontSize: '12px', letterSpacing: '0.08em', opacity: 0.85, textTransform: 'uppercase' }}>
            AI Booking Assistant
          </div>
          <h2 style={{ margin: '6px 0', fontSize: '24px' }}>🤖 Ask Gito AI before you book</h2>
          <p style={{ margin: 0, color: 'rgba(255,255,255,0.85)', maxWidth: '620px' }}>
            Get help choosing the right service, checking current availability, and comparing expected worker quote ranges.
          </p>
        </div>
        {matchedService && (
          <button
            onClick={() => onBookService?.(matchedService)}
            style={{
              padding: '12px 16px',
              borderRadius: '10px',
              border: 'none',
              background: '#f59e0b',
              color: '#111827',
              fontWeight: 'bold',
              cursor: 'pointer',
              minWidth: '180px'
            }}
          >
            Book {matchedService.name} now
          </button>
        )}
      </div>

      <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px', marginBottom: '16px' }}>
        {promptSuggestions.map((prompt) => (
          <button
            key={prompt}
            onClick={() => sendQuestion(prompt)}
            style={{
              border: '1px solid rgba(255,255,255,0.2)',
              background: 'rgba(255,255,255,0.08)',
              color: 'white',
              borderRadius: '999px',
              padding: '8px 12px',
              cursor: 'pointer',
              fontSize: '13px'
            }}
          >
            {prompt}
          </button>
        ))}
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: '16px' }}>
        <div style={{ background: 'rgba(255,255,255,0.08)', borderRadius: '12px', padding: '14px' }}>
          <div style={{ minHeight: '160px', display: 'flex', flexDirection: 'column', gap: '10px', marginBottom: '14px' }}>
            {messages.slice(-4).map((message, index) => (
              <div
                key={`${message.role}-${index}`}
                style={{
                  alignSelf: message.role === 'user' ? 'flex-end' : 'flex-start',
                  background: message.role === 'user' ? '#f59e0b' : 'rgba(255,255,255,0.14)',
                  color: message.role === 'user' ? '#111827' : 'white',
                  borderRadius: '12px',
                  padding: '10px 12px',
                  maxWidth: '88%',
                  fontSize: '14px',
                  lineHeight: 1.5,
                }}
              >
                {message.text}
              </div>
            ))}
            {loading && <div style={{ fontSize: '13px', opacity: 0.8 }}>Gito AI is checking service data...</div>}
          </div>

          <div style={{ display: 'flex', gap: '10px', flexWrap: 'wrap' }}>
            <input
              value={question}
              onChange={(event) => setQuestion(event.target.value)}
              onKeyDown={(event) => {
                if (event.key === 'Enter') {
                  event.preventDefault();
                  sendQuestion();
                }
              }}
              placeholder="Example: Compare electrician prices or help me book a plumber"
              style={{
                flex: 1,
                minWidth: '240px',
                padding: '12px',
                borderRadius: '10px',
                border: '1px solid rgba(255,255,255,0.15)',
                background: 'rgba(255,255,255,0.95)',
                color: '#111827'
              }}
            />
            <button
              onClick={() => sendQuestion()}
              disabled={loading}
              style={{
                padding: '12px 18px',
                borderRadius: '10px',
                border: 'none',
                background: loading ? '#93c5fd' : '#22c55e',
                color: '#052e16',
                fontWeight: 'bold',
                cursor: loading ? 'not-allowed' : 'pointer'
              }}
            >
              Ask AI
            </button>
          </div>
        </div>

        <div style={{ background: 'rgba(255,255,255,0.08)', borderRadius: '12px', padding: '14px' }}>
          <h3 style={{ marginTop: 0, marginBottom: '12px', fontSize: '16px' }}>📊 Live service snapshot</h3>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
            {insights.slice(0, 4).map((insight) => (
              <div key={insight.service} style={{ background: 'rgba(255,255,255,0.08)', borderRadius: '10px', padding: '10px' }}>
                <div style={{ fontWeight: 'bold', marginBottom: '4px' }}>{insight.service}</div>
                <div style={{ fontSize: '12px', opacity: 0.9 }}>{insight.availableWorkers || 0} available workers</div>
                <div style={{ fontSize: '12px', opacity: 0.9 }}>Avg rating: {insight.averageRating ? `⭐${insight.averageRating}` : 'New service lane'}</div>
                <div style={{ fontSize: '12px', opacity: 0.9 }}>Quote range: {formatPriceInsight(insight)}</div>
                {insight.topWorkers?.length > 0 && (
                  <div style={{ fontSize: '11px', opacity: 0.85, marginTop: '4px' }}>
                    Top picks: {insight.topWorkers.map((worker) => `${worker.name}${worker.rating ? ` (⭐${worker.rating})` : ''}`).join(', ')}
                  </div>
                )}
              </div>
            ))}
          </div>
          <div style={{ fontSize: '11px', marginTop: '12px', opacity: 0.75 }}>
            Worker comparison is based on live availability and recent quote trends when backend data is available.
          </div>
        </div>
      </div>
    </section>
  );
}
