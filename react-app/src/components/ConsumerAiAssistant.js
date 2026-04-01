import React, { useEffect, useMemo, useRef, useState } from 'react';
import { httpsCallable } from 'firebase/functions';
import { functionsInstance } from '../firebase';
import {
  buildLocalAssistantFallback,
  buildPromptSuggestions,
  findRelevantService,
} from '../utils/aiAssistant';

export default function ConsumerAiAssistant({ services = [], onBookService }) {
  const [question, setQuestion] = useState('');
  const [messages, setMessages] = useState([
    {
      role: 'assistant',
      text: 'Hi, I’m Gito AI. Ask me which service to book or the expected cost.',
    },
  ]);
  const [loading, setLoading] = useState(false);
  const [insights, setInsights] = useState([]);
  const [selectedService, setSelectedService] = useState('');
  const [isOpen, setIsOpen] = useState(false);
  const messagesRef = useRef(null);

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

  useEffect(() => {
    if (messagesRef.current) {
      messagesRef.current.scrollTop = messagesRef.current.scrollHeight;
    }
  }, [messages, loading, isOpen]);

  const promptSuggestions = useMemo(
    () => buildPromptSuggestions(selectedService || 'service').slice(0, 2),
    [selectedService]
  );

  const sendQuestion = async (promptText) => {
    const text = (promptText || question).trim();
    if (!text) return;

    setQuestion('');
    setLoading(true);
    setIsOpen(true);
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

  const matchedService = services.find((service) => service.name === selectedService)
    || findRelevantService(messages[messages.length - 1]?.text || '');

  return (
    <div
      style={{
        position: 'fixed',
        right: '16px',
        bottom: '16px',
        zIndex: 1200,
      }}
    >
      {!isOpen && (
        <button
          onClick={() => setIsOpen(true)}
          style={{
            border: 'none',
            borderRadius: '999px',
            background: 'linear-gradient(135deg, #1d4ed8 0%, #111827 100%)',
            color: 'white',
            fontWeight: 'bold',
            padding: '12px 16px',
            cursor: 'pointer',
            boxShadow: '0 12px 24px rgba(15, 23, 42, 0.2)',
          }}
        >
          🤖 Ask Gito AI
        </button>
      )}

      {isOpen && (
        <section
          style={{
            width: 'min(360px, calc(100vw - 24px))',
            height: 'min(520px, 72vh)',
            display: 'flex',
            flexDirection: 'column',
            background: 'linear-gradient(135deg, #111827 0%, #1d4ed8 100%)',
            borderRadius: '16px',
            color: 'white',
            overflow: 'hidden',
            boxShadow: '0 18px 36px rgba(15, 23, 42, 0.22)',
          }}
        >
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '8px', padding: '12px 14px', borderBottom: '1px solid rgba(255,255,255,0.12)' }}>
            <div>
              <div style={{ fontSize: '11px', opacity: 0.8, textTransform: 'uppercase', letterSpacing: '0.08em' }}>Gito AI</div>
              <div style={{ fontSize: '16px', fontWeight: 'bold' }}>Quick booking help</div>
            </div>
            <div style={{ display: 'flex', gap: '6px', alignItems: 'center' }}>
              {matchedService && (
                <button
                  onClick={() => onBookService?.(matchedService)}
                  style={{
                    padding: '7px 10px',
                    borderRadius: '8px',
                    border: 'none',
                    background: '#f59e0b',
                    color: '#111827',
                    fontWeight: 'bold',
                    cursor: 'pointer',
                    fontSize: '12px',
                  }}
                >
                  Book
                </button>
              )}
              <button
                onClick={() => setIsOpen(false)}
                style={{
                  width: '30px',
                  height: '30px',
                  borderRadius: '999px',
                  border: '1px solid rgba(255,255,255,0.18)',
                  background: 'rgba(255,255,255,0.08)',
                  color: 'white',
                  cursor: 'pointer',
                }}
              >
                ×
              </button>
            </div>
          </div>

          <div
            ref={messagesRef}
            style={{
              flex: 1,
              overflowY: 'auto',
              padding: '12px',
              display: 'flex',
              flexDirection: 'column',
              gap: '8px',
            }}
          >
            {messages.slice(-4).map((message, index) => (
              <div
                key={`${message.role}-${index}`}
                style={{
                  alignSelf: message.role === 'user' ? 'flex-end' : 'flex-start',
                  background: message.role === 'user' ? '#f59e0b' : 'rgba(255,255,255,0.12)',
                  color: message.role === 'user' ? '#111827' : 'white',
                  borderRadius: '10px',
                  padding: '8px 10px',
                  maxWidth: '92%',
                  fontSize: '13px',
                  lineHeight: 1.45,
                }}
              >
                {message.text}
              </div>
            ))}
            {loading && <div style={{ fontSize: '12px', opacity: 0.8 }}>Gito AI is replying...</div>}
          </div>

          <div style={{ marginTop: 'auto', padding: '12px', borderTop: '1px solid rgba(255,255,255,0.12)', background: 'rgba(17,24,39,0.22)' }}>
            <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap', marginBottom: '8px' }}>
              {promptSuggestions.map((prompt) => (
                <button
                  key={prompt}
                  onClick={() => sendQuestion(prompt)}
                  style={{
                    border: '1px solid rgba(255,255,255,0.2)',
                    background: 'rgba(255,255,255,0.08)',
                    color: 'white',
                    borderRadius: '999px',
                    padding: '6px 10px',
                    cursor: 'pointer',
                    fontSize: '12px',
                  }}
                >
                  {prompt}
                </button>
              ))}
            </div>

            <div style={{ display: 'flex', gap: '8px' }}>
              <input
                value={question}
                onChange={(event) => setQuestion(event.target.value)}
                onKeyDown={(event) => {
                  if (event.key === 'Enter') {
                    event.preventDefault();
                    sendQuestion();
                  }
                }}
                placeholder="Ask about service or price"
                style={{
                  flex: 1,
                  padding: '10px 12px',
                  borderRadius: '8px',
                  border: '1px solid rgba(255,255,255,0.15)',
                  background: 'rgba(255,255,255,0.96)',
                  color: '#111827',
                }}
              />
              <button
                onClick={() => sendQuestion()}
                disabled={loading}
                style={{
                  padding: '10px 14px',
                  borderRadius: '8px',
                  border: 'none',
                  background: loading ? '#93c5fd' : '#22c55e',
                  color: '#052e16',
                  fontWeight: 'bold',
                  cursor: loading ? 'not-allowed' : 'pointer',
                }}
              >
                Ask
              </button>
            </div>
          </div>
        </section>
      )}
    </div>
  );
}
