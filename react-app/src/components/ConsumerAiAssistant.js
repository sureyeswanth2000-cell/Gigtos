import React, { useEffect, useMemo, useState } from 'react';
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
  const [isExpanded, setIsExpanded] = useState(false);

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

  const promptSuggestions = useMemo(
    () => buildPromptSuggestions(selectedService || 'service').slice(0, 2),
    [selectedService]
  );

  const sendQuestion = async (promptText) => {
    const text = (promptText || question).trim();
    if (!text) return;

    setQuestion('');
    setLoading(true);
    setMessages((prev) => [...prev, { role: 'user', text }]);
    setIsExpanded(true);

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
  const visibleMessages = isExpanded ? messages.slice(-3) : messages.slice(-1);
  const showConversation = isExpanded || messages.length > 1;

  return (
    <section
      style={{
        marginBottom: '20px',
        padding: '14px 16px',
        background: 'linear-gradient(135deg, #111827 0%, #1d4ed8 100%)',
        borderRadius: '14px',
        color: 'white',
        boxShadow: '0 10px 24px rgba(15, 23, 42, 0.16)',
      }}
    >
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '12px', flexWrap: 'wrap' }}>
        <div style={{ flex: 1, minWidth: '220px' }}>
          <div style={{ fontSize: '11px', letterSpacing: '0.08em', opacity: 0.8, textTransform: 'uppercase' }}>
            Gito AI
          </div>
          <div style={{ fontSize: '18px', fontWeight: 'bold', margin: '4px 0' }}>
            🤖 Quick booking help
          </div>
          <div style={{ fontSize: '13px', color: 'rgba(255,255,255,0.85)' }}>
            Ask for the right service or expected cost.
          </div>
        </div>

        <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
          {matchedService && (
            <button
              onClick={() => onBookService?.(matchedService)}
              style={{
                padding: '9px 12px',
                borderRadius: '8px',
                border: 'none',
                background: '#f59e0b',
                color: '#111827',
                fontWeight: 'bold',
                cursor: 'pointer',
              }}
            >
              Book {matchedService.name}
            </button>
          )}
          <button
            onClick={() => setIsExpanded((prev) => !prev)}
            style={{
              padding: '9px 12px',
              borderRadius: '8px',
              border: '1px solid rgba(255,255,255,0.2)',
              background: 'rgba(255,255,255,0.08)',
              color: 'white',
              fontWeight: 'bold',
              cursor: 'pointer',
            }}
          >
            {isExpanded ? 'Hide AI' : 'Open AI'}
          </button>
        </div>
      </div>

      <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap', marginTop: '12px' }}>
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

      <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap', marginTop: '12px' }}>
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
            minWidth: '220px',
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

      {showConversation && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', marginTop: '12px' }}>
          {visibleMessages.map((message, index) => (
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
      )}
    </section>
  );
}
