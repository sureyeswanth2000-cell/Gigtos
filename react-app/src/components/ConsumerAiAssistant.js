import React, { useEffect, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { httpsCallable } from 'firebase/functions';
import { collection, query, where, getDocs } from 'firebase/firestore';
import { ref as storageRef, uploadBytes } from 'firebase/storage';
import { functionsInstance, db, auth, storage } from '../firebase';
import {
  buildLocalAssistantFallback,
  checkServiceNearby,
  findRelevantService,
} from '../utils/aiAssistant';
import { useLocation as useGigLocation } from '../context/LocationContext';

export default function ConsumerAiAssistant({
  services = [],
  onBookService,
  externalPrompt = '',
  onPromptConsumed,
}) {
  const navigate = useNavigate();
  const [question, setQuestion] = useState('');
  const [messages, setMessages] = useState([
    {
      role: 'assistant',
      text: "Hi there! I'm Gito Assistant, your booking helper. Tell me what you need - whether it's fixing a leak, installing a fan, or painting a room - and I'll help you find the right worker.",
    },
  ]);
  const [loading, setLoading] = useState(false);
  const [insights, setInsights] = useState([]);
  const [selectedService, setSelectedService] = useState('');
  const [isOpen, setIsOpen] = useState(false);
  const [pendingBooking, setPendingBooking] = useState(null);
  const [availableWorkers, setAvailableWorkers] = useState([]);
  const [memoryConsent, setMemoryConsent] = useState(false);
  const [memoryPanelOpen, setMemoryPanelOpen] = useState(false);
  const [memoryState, setMemoryState] = useState(null);
  const [memoryLoading, setMemoryLoading] = useState(false);
  const [problemPhotoFile, setProblemPhotoFile] = useState(null);
  const [uploadingProblemPhoto, setUploadingProblemPhoto] = useState(false);
  const messagesRef = useRef(null);
  const assistantSessionIdRef = useRef(`gito_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`);
  const { location } = useGigLocation() || {};

  const recordAiConversionEvent = async (eventType, extra = {}) => {
    if (!auth.currentUser) return;
    try {
      const callable = httpsCallable(functionsInstance, 'recordConsumerAiConversionEvent');
      await callable({
        eventType,
        assistantSessionId: assistantSessionIdRef.current,
        selectedService: extra.selectedService || selectedService || '',
        source: 'consumer_ai_assistant',
        ...extra,
      });
    } catch {
      // AI conversion logging should never block booking help.
    }
  };

  const safeFileName = (file) => (file?.name || 'problem-photo.jpg')
    .replace(/[^a-zA-Z0-9_.-]/g, '_')
    .slice(0, 80);

  const uploadProblemPhoto = async (file) => {
    if (!file) return '';
    const uid = auth.currentUser?.uid;
    if (!uid) throw new Error('Login required to analyze a problem photo.');
    if (!file.type?.startsWith('image/')) throw new Error('Please attach an image file.');
    if (file.size > 4 * 1024 * 1024) throw new Error('Photo must be under 4 MB for AI triage.');
    const path = `bookings/requested/${uid}/${Date.now()}_${safeFileName(file)}`;
    const ref = storageRef(storage, path);
    await uploadBytes(ref, file, { contentType: file.type || 'image/jpeg' });
    return path;
  };

  const loadMemoryState = async () => {
    if (!auth.currentUser) {
      setMessages((prev) => [...prev, { role: 'assistant', text: 'Please log in first to view or delete AI memory.' }]);
      return null;
    }
    setMemoryLoading(true);
    try {
      const callable = httpsCallable(functionsInstance, 'manageConsumerAiMemory');
      const response = await callable({ action: 'get' });
      setMemoryState(response.data || null);
      return response.data || null;
    } catch {
      setMessages((prev) => [...prev, { role: 'assistant', text: 'I could not load memory settings right now.' }]);
      return null;
    } finally {
      setMemoryLoading(false);
    }
  };

  const runMemoryAction = async (action, payload = {}) => {
    if (!auth.currentUser) return;
    setMemoryLoading(true);
    try {
      const callable = httpsCallable(functionsInstance, 'manageConsumerAiMemory');
      const response = await callable({ action, ...payload });
      setMemoryState(response.data || null);
    } catch {
      setMessages((prev) => [...prev, { role: 'assistant', text: 'Memory update failed. Please try again.' }]);
    } finally {
      setMemoryLoading(false);
    }
  };

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

  // Fetch available workers for proximity checks
  useEffect(() => {
    let active = true;

    const fetchWorkers = async () => {
      try {
        const snap = await getDocs(
          query(collection(db, 'worker_availability'), where('isAvailable', '==', true))
        );
        if (active) {
          setAvailableWorkers(snap.docs.map((d) => ({ id: d.id, ...d.data() })));
        }
      } catch {
        if (active) setAvailableWorkers([]);
      }
    };

    fetchWorkers();
    return () => { active = false; };
  }, []);

  useEffect(() => {
    if (messagesRef.current) {
      messagesRef.current.scrollTop = messagesRef.current.scrollHeight;
    }
  }, [messages, loading, isOpen]);

  const sendQuestion = async (promptText) => {
    const typedText = (promptText || question).trim();
    if (!typedText && !problemPhotoFile) return;
    const text = typedText || 'Please identify the service needed from this photo.';

    setQuestion('');
    setLoading(true);
    setIsOpen(true);
    setMessages((prev) => [...prev, { role: 'user', text: problemPhotoFile ? `${text}\n[Photo attached]` : text }]);

    const inferredService = findRelevantService(text)?.name || selectedService;
    if (inferredService) {
      setSelectedService(inferredService);
    }
    recordAiConversionEvent('message_sent', { selectedService: inferredService || selectedService || '' });

    // Run proximity check every time a message is processed
    const nearbyCheck = inferredService
      ? checkServiceNearby({
          serviceName: inferredService,
          workers: availableWorkers,
          userLat: location?.lat,
          userLng: location?.lng,
        })
      : null;

    if (!auth.currentUser) {
      const reply = buildLocalAssistantFallback({
        message: text,
        selectedService: inferredService,
        insights,
        nearbyCheck,
      });
      setMessages((prev) => [...prev, {
        role: 'assistant',
        text: problemPhotoFile ? 'Please log in first so I can safely check that photo. Text help is still available after login.' : reply,
      }]);
      setLoading(false);
      return;
    }

    try {
      let problemPhotoStoragePath = '';
      if (problemPhotoFile) {
        setUploadingProblemPhoto(true);
        problemPhotoStoragePath = await uploadProblemPhoto(problemPhotoFile);
        recordAiConversionEvent('problem_photo_attached', { selectedService: inferredService || selectedService || '' });
      }
      const callable = httpsCallable(functionsInstance, 'aiBookingAssistant');
      const response = await callable({
        message: text,
        selectedService: inferredService || '',
        memoryConsent,
        problemPhotoStoragePath,
        areaContext: {
          city: location?.city || '',
          source: location?.source || 'unknown',
        },
      });

      const reply = response.data?.reply || buildLocalAssistantFallback({
        message: text,
        selectedService: inferredService,
        insights,
        nearbyCheck,
      });

      setMessages((prev) => [...prev, { role: 'assistant', text: reply }]);
      if (response.data?.insights?.length) {
        setInsights(response.data.insights);
      }
      if (response.data?.memory?.written) {
        setMessages((prev) => [
          ...prev,
          { role: 'assistant', text: 'I saved that as a safe preference summary. You can turn memory off anytime.' },
        ]);
      }
      if (response.data?.photoTriage?.confidenceLevel) {
        const triage = response.data.photoTriage;
        recordAiConversionEvent('problem_photo_triaged', { selectedService: triage.serviceSuggestion || inferredService || selectedService || '' });
        setMessages((prev) => [
          ...prev,
          {
            role: 'assistant',
            text: `Photo signal: ${triage.confidenceLevel} confidence${triage.serviceSuggestion ? ` for ${triage.serviceSuggestion}` : ''}. Please confirm before booking.`,
          },
        ]);
      }
      setProblemPhotoFile(null);
    } catch {
      const reply = buildLocalAssistantFallback({
        message: text,
        selectedService: inferredService,
        insights,
        nearbyCheck,
      });
      setMessages((prev) => [...prev, { role: 'assistant', text: reply }]);
    } finally {
      setUploadingProblemPhoto(false);
      setLoading(false);
    }
  };

  const matchedService = services.find((service) => service.name === selectedService)
    || findRelevantService(messages[messages.length - 1]?.text || '');

  useEffect(() => {
    if (!externalPrompt || !externalPrompt.trim()) return;

    sendQuestion(externalPrompt.trim());
    if (onPromptConsumed) {
      onPromptConsumed();
    }
  }, [externalPrompt]);

  return (
    <div
      style={{
        position: 'fixed',
        right: '16px',
        bottom: '20px',
        zIndex: 1200,
      }}
    >
      {!isOpen && (
        <button
          onClick={() => {
            setIsOpen(true);
            recordAiConversionEvent('assistant_opened');
          }}
          style={{
            border: 'none',
            borderRadius: '999px',
            background: 'linear-gradient(135deg, #0f766e 0%, #11353e 100%)',
            color: 'white',
            fontWeight: 'bold',
            padding: '12px 16px',
            cursor: 'pointer',
            boxShadow: '0 12px 24px rgba(15, 23, 42, 0.24)',
          }}
        >
          Ask Gito
        </button>
      )}

      {isOpen && (
        <section
          style={{
            width: 'min(360px, calc(100vw - 24px))',
            height: 'min(520px, 72vh)',
            display: 'flex',
            flexDirection: 'column',
            background: 'linear-gradient(135deg, #0d2c33 0%, #0f766e 100%)',
            borderRadius: '16px',
            color: 'white',
            overflow: 'hidden',
            boxShadow: '0 18px 36px rgba(15, 23, 42, 0.22)',
          }}
        >
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '8px', padding: '12px 14px', borderBottom: '1px solid rgba(255,255,255,0.12)' }}>
            <div>
              <div style={{ fontSize: '11px', opacity: 0.8, textTransform: 'uppercase', letterSpacing: '0.08em' }}>Gito Assistant</div>
              <div style={{ fontSize: '16px', fontWeight: 'bold' }}>Quick booking help</div>
            </div>
            <div style={{ display: 'flex', gap: '6px', alignItems: 'center' }}>
              {matchedService && !pendingBooking && (
                <button
                  onClick={() => {
                    recordAiConversionEvent('book_clicked', { selectedService: matchedService.name });
                    if (!auth.currentUser) {
                      setMessages((prev) => [
                        ...prev,
                        {
                          role: 'assistant',
                          text: `Please log in first to book ${matchedService.name}. Redirecting you to the login page...`,
                        },
                      ]);
                      setTimeout(() => navigate('/auth?mode=user'), 1200);
                      return;
                    }
                    setPendingBooking(matchedService);
                    setMessages((prev) => [
                      ...prev,
                      {
                        role: 'assistant',
                        text: `I found a match: ${matchedService.name}. Would you like me to proceed with booking? Please confirm below.`,
                      },
                    ]);
                  }}
                  style={{
                    padding: '7px 10px',
                    borderRadius: '8px',
                    border: 'none',
                    background: '#f97316',
                    color: '#1f2937',
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
                  background: message.role === 'user' ? '#f97316' : 'rgba(255,255,255,0.12)',
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
            {loading && <div style={{ fontSize: '12px', opacity: 0.8 }}>Gito is replying...</div>}
          </div>

          <div style={{ marginTop: 'auto', padding: '12px', borderTop: '1px solid rgba(255,255,255,0.12)', background: 'rgba(17,24,39,0.22)' }}>
            {pendingBooking && (
              <div style={{
                background: 'rgba(249, 115, 22, 0.15)',
                border: '1px solid rgba(249, 115, 22, 0.4)',
                borderRadius: '10px',
                padding: '10px 12px',
                marginBottom: '10px',
              }}>
                <div style={{ fontSize: '12px', fontWeight: 'bold', marginBottom: '6px' }}>
                  Confirm booking for {pendingBooking.name}?
                </div>
                <div style={{ fontSize: '11px', opacity: 0.85, marginBottom: '8px' }}>
                  Gito will never auto-book. Your explicit confirmation is required.
                </div>
                <div style={{ display: 'flex', gap: '8px' }}>
                  <button
                    onClick={() => {
                      const serviceName = pendingBooking.name;
                      setMessages((prev) => [
                        ...prev,
                        { role: 'assistant', text: `Great! Opening the booking page for ${serviceName}. You can fill in the details there.` },
                      ]);
                      setPendingBooking(null);
                      recordAiConversionEvent('booking_page_opened', { selectedService: serviceName });
                      navigate(`/service?type=${encodeURIComponent(serviceName)}`);
                    }}
                    style={{
                      flex: 1,
                      padding: '7px 10px',
                      borderRadius: '8px',
                      border: 'none',
                      background: '#22c55e',
                      color: '#fff',
                      fontWeight: 'bold',
                      cursor: 'pointer',
                      fontSize: '12px',
                    }}
                  >
                    ✓ Yes, Proceed
                  </button>
                  <button
                    onClick={() => {
                      setMessages((prev) => [
                        ...prev,
                        { role: 'assistant', text: 'No problem! Booking cancelled. Ask me anything else.' },
                      ]);
                      setPendingBooking(null);
                    }}
                    style={{
                      flex: 1,
                      padding: '7px 10px',
                      borderRadius: '8px',
                      border: '1px solid rgba(255,255,255,0.3)',
                      background: 'rgba(255,255,255,0.1)',
                      color: '#fff',
                      fontWeight: 'bold',
                      cursor: 'pointer',
                      fontSize: '12px',
                    }}
                  >
                    ✕ Cancel
                  </button>
                </div>
              </div>
            )}

            {problemPhotoFile && (
              <div style={{ fontSize: '11px', opacity: 0.86, marginBottom: '8px' }}>
                Photo ready: {problemPhotoFile.name}
              </div>
            )}
            <div style={{ display: 'flex', gap: '8px' }}>
              <label
                title="Attach a problem photo"
                style={{
                  width: '38px',
                  height: '38px',
                  display: 'grid',
                  placeItems: 'center',
                  borderRadius: '8px',
                  border: '1px solid rgba(255,255,255,0.18)',
                  background: 'rgba(255,255,255,0.12)',
                  cursor: loading ? 'not-allowed' : 'pointer',
                }}
              >
                📷
                <input
                  type="file"
                  accept="image/*"
                  hidden
                  disabled={loading}
                  onChange={(event) => setProblemPhotoFile(event.target.files?.[0] || null)}
                />
              </label>
              <input
                value={question}
                onChange={(event) => setQuestion(event.target.value)}
                onKeyDown={(event) => {
                  if (event.key === 'Enter') {
                    event.preventDefault();
                    sendQuestion();
                  }
                }}
                placeholder="Ask me anything..."
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
                disabled={loading || uploadingProblemPhoto}
                style={{
                  padding: '10px 14px',
                  borderRadius: '8px',
                  border: 'none',
                  background: loading || uploadingProblemPhoto ? '#9ca3af' : '#f97316',
                  color: '#1f2937',
                  fontWeight: 'bold',
                  cursor: loading || uploadingProblemPhoto ? 'not-allowed' : 'pointer',
                }}
              >
                {uploadingProblemPhoto ? '...' : 'Ask'}
              </button>
            </div>
            <label style={{ display: 'flex', gap: '8px', alignItems: 'center', marginTop: '8px', fontSize: '11px', opacity: 0.86 }}>
              <input
                type="checkbox"
                checked={memoryConsent}
                onChange={(event) => setMemoryConsent(event.target.checked)}
              />
              Remember safe preferences only
            </label>
            <button
              type="button"
              onClick={async () => {
                const nextOpen = !memoryPanelOpen;
                setMemoryPanelOpen(nextOpen);
                if (nextOpen && !memoryState) await loadMemoryState();
              }}
              style={{
                marginTop: '8px',
                padding: '6px 8px',
                borderRadius: '8px',
                border: '1px solid rgba(255,255,255,0.18)',
                background: 'rgba(255,255,255,0.08)',
                color: 'white',
                cursor: 'pointer',
                fontSize: '11px',
              }}
            >
              AI memory controls
            </button>
            {memoryPanelOpen && (
              <div style={{
                marginTop: '8px',
                padding: '8px',
                borderRadius: '8px',
                border: '1px solid rgba(255,255,255,0.16)',
                background: 'rgba(15,23,42,0.24)',
                fontSize: '11px',
                lineHeight: 1.4,
              }}>
                {memoryLoading && <div>Loading memory...</div>}
                {!memoryLoading && memoryState && (
                  <>
                    <div style={{ marginBottom: '6px' }}>
                      Memory is {memoryState.memoryPaused ? 'paused' : 'active'}.
                    </div>
                    {memoryState.homeProfile && (
                      <div style={{ marginBottom: '6px', opacity: 0.9 }}>
                        Home: {[memoryState.homeProfile.preferredTimeWindow, memoryState.homeProfile.preferredLanguage, memoryState.homeProfile.preferredBudget].filter(Boolean).join(', ') || 'safe preferences saved'}
                      </div>
                    )}
                    {(memoryState.items || []).slice(0, 3).map((item) => (
                      <div key={item.id} style={{ marginBottom: '6px', opacity: 0.9 }}>
                        {item.summary}
                        <button
                          type="button"
                          onClick={() => runMemoryAction('delete_item', { memoryId: item.id })}
                          style={{ marginLeft: '6px', border: 'none', background: 'transparent', color: '#fbbf24', cursor: 'pointer' }}
                        >
                          forget
                        </button>
                      </div>
                    ))}
                    <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px', marginTop: '8px' }}>
                      <button type="button" onClick={() => runMemoryAction('set_pause', { memoryPaused: !memoryState.memoryPaused })} style={{ padding: '5px 7px', borderRadius: '6px', border: 'none', cursor: 'pointer' }}>
                        {memoryState.memoryPaused ? 'Resume' : 'Pause'}
                      </button>
                      <button type="button" onClick={() => runMemoryAction('delete_home_profile')} style={{ padding: '5px 7px', borderRadius: '6px', border: 'none', cursor: 'pointer' }}>
                        Clear home
                      </button>
                      <button type="button" onClick={() => runMemoryAction('delete_all')} style={{ padding: '5px 7px', borderRadius: '6px', border: 'none', cursor: 'pointer' }}>
                        Clear all
                      </button>
                    </div>
                  </>
                )}
              </div>
            )}
          </div>
        </section>
      )}
    </div>
  );
}
