import React, { useState, useRef, useEffect } from 'react';
import { auth, db } from '../firebase';
import { doc, getDoc, collection, addDoc, serverTimestamp, onSnapshot, query, orderBy, setDoc, updateDoc, increment } from 'firebase/firestore';
import styled, { keyframes, createGlobalStyle } from 'styled-components';

const fadeIn = keyframes`
  from { opacity: 0; transform: translateY(10px); }
  to { opacity: 1; transform: translateY(0); }
`;

const GlobalStyle = createGlobalStyle`
  @import url('https://fonts.googleapis.com/css2?family=Outfit:wght@300;400;600&display=swap');
  body {
    font-family: 'Outfit', sans-serif;
  }
`;

const ChatContainer = styled.div`
  max-width: 450px;
  margin: 2rem auto;
  background: rgba(255, 255, 255, 0.84);
  backdrop-filter: blur(12px);
  -webkit-backdrop-filter: blur(12px);
  border: 1px solid rgba(255, 255, 255, 0.4);
  border-radius: 24px;
  box-shadow: 0 12px 40px rgba(31, 38, 135, 0.12);
  overflow: hidden;
  display: flex;
  flex-direction: column;
  animation: ${fadeIn} 0.6s ease-out;
  position: relative;
`;

const Header = styled.div`
  background: linear-gradient(135deg, #1e40af 0%, #3b82f6 100%);
  color: #fff;
  padding: 1.25rem;
  font-size: 1.25rem;
  font-weight: 600;
  text-align: center;
  letter-spacing: 0.5px;
  box-shadow: 0 4px 12px rgba(0, 0, 0, 0.08);
`;

const Messages = styled.div`
  padding: 1.5rem;
  height: 420px;
  overflow-y: auto;
  background: #f8fafc;
  display: flex;
  flex-direction: column;
  gap: 1rem;

  &::-webkit-scrollbar {
    width: 6px;
  }
  &::-webkit-scrollbar-thumb {
    background: rgba(0, 0, 0, 0.1);
    border-radius: 10px;
  }
`;

const Bubble = styled.div`
  background: ${props => props.user 
    ? 'linear-gradient(135deg, #3b82f6 0%, #2563eb 100%)' 
    : '#fff'};
  color: ${props => props.user ? '#fff' : '#1e293b'};
  padding: 0.8rem 1.25rem;
  border-radius: ${props => props.user ? '22px 22px 4px 22px' : '22px 22px 22px 4px'};
  align-self: ${props => props.user ? 'flex-end' : 'flex-start'};
  max-width: 85%;
  font-size: 0.95rem;
  line-height: 1.5;
  box-shadow: 0 4px 12px rgba(0, 0, 0, 0.03);
  animation: ${fadeIn} 0.3s ease-out;
  border: ${props => props.user ? 'none' : '1px solid #e2e8f0'};
`;

const ImagePreview = styled.img`
  max-width: 100%;
  border-radius: 12px;
  margin-bottom: 0.5rem;
  display: block;
`;

const InputRow = styled.form`
  display: flex;
  padding: 1.25rem;
  background: #fff;
  border-top: 1px solid #f1f5f9;
  align-items: center;
  gap: 0.75rem;
`;

const Input = styled.input`
  flex: 1;
  border: 1px solid #e2e8f0;
  border-radius: 14px;
  padding: 0.8rem 1rem;
  font-size: 0.95rem;
  outline: none;
  transition: all 0.2s;
  font-family: inherit;

  &:focus {
    border-color: #3b82f6;
    box-shadow: 0 0 0 4px rgba(59, 130, 246, 0.1);
  }
`;

const IconButton = styled.label`
  background: #f1f5f9;
  color: #64748b;
  width: 42px;
  height: 42px;
  border-radius: 12px;
  display: flex;
  align-items: center;
  justify-content: center;
  cursor: pointer;
  transition: all 0.2s;

  &:hover {
    background: #e2e8f0;
    color: #334155;
  }
`;

const SendButton = styled.button`
  background: #3b82f6;
  color: #fff;
  border: none;
  width: 42px;
  height: 42px;
  border-radius: 12px;
  display: flex;
  align-items: center;
  justify-content: center;
  cursor: pointer;
  transition: all 0.2s;

  &:hover {
    background: #2563eb;
    transform: translateY(-1px);
    box-shadow: 0 4px 12px rgba(59, 130, 246, 0.3);
  }

  &:disabled {
    background: #cbd5e1;
    cursor: not-allowed;
    transform: none;
    box-shadow: none;
  }
`;

const TypingIndicator = styled.div`
  display: flex;
  gap: 4px;
  padding: 12px;
  align-self: flex-start;
  span {
    width: 6px;
    height: 6px;
    background: #cbd5e1;
    border-radius: 50%;
    animation: bounce 1.4s infinite ease-in-out both;
  }
  span:nth-child(1) { animation-delay: -0.32s; }
  span:nth-child(2) { animation-delay: -0.16s; }

  @keyframes bounce {
    0%, 80%, 100% { transform: scale(0); }
    40% { transform: scale(1.0); }
  }
`;


function AIAssistantChatbot() {
  // Chat state
  const [messages, setMessages] = useState([
    { text: "👋 Namaste! I’m your Gigtos Assistant. Need a plumber, electrician, or painter in Kavali? I'm here to help!", user: false }
  ]);
  const [history, setHistory] = useState([]); // For Gemini context
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const [instructions, setInstructions] = useState("");
  const [selectedImage, setSelectedImage] = useState(null);
  const [allJobChats, setAllJobChats] = useState([]); // All jobs' chat data for AI
  const messagesEndRef = useRef(null);
  const fileInputRef = useRef(null);
  // Fetch all jobs' chat data for AI (not shown to user, but available for context)
  useEffect(() => {
    const user = auth.currentUser;
    if (!user) return;
    // Get all jobs for user
    const jobsCol = collection(db, 'users', user.uid, 'chats');
    onSnapshot(jobsCol, (jobsSnap) => {
      const jobIds = jobsSnap.docs.map(doc => doc.id);
      // For each job, get messages
      Promise.all(jobIds.map(async (jid) => {
        const msgsCol = collection(db, 'users', user.uid, 'chats', jid, 'messages');
        const q = query(msgsCol, orderBy('timestamp'));
        const snap = await getDoc(doc(db, 'users', user.uid, 'chats', jid));
        return new Promise(resolve => {
          onSnapshot(q, (msgSnap) => {
            const msgs = msgSnap.docs.map(doc => doc.data());
            resolve({ jobId: jid, meta: snap.exists() ? snap.data() : {}, messages: msgs });
          });
        });
      })).then(allChats => setAllJobChats(allChats));
    });
  }, []);

  useEffect(() => {
    const fetchInstructions = async () => {
      try {
        const docRef = doc(db, 'config', 'ai_instructions');
        const docSnap = await getDoc(docRef);
        if (docSnap.exists() && docSnap.data().text) {
          setInstructions(docSnap.data().text);
          return;
        }
        const response = await fetch('/AI_ASSISTANT_INSTRUCTIONS.md');
        const text = await response.text();
        setInstructions(text);
      } catch (error) {
        setInstructions("You are Gigtos AI, helping with bookings in Kavali. Guide users accurately and politely.");
      }
    };
    fetchInstructions();
  }, []);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  const fileToBase64 = (file) => new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.readAsDataURL(file);
    reader.onload = () => resolve(reader.result.split(',')[1]);
    reader.onerror = error => reject(error);
  });

  async function saveInternalPriceSuggestion(suggestedPrice) {
    try {
      const user = auth.currentUser;
      const urlParams = new URLSearchParams(window.location.search);
      const bookingId = urlParams.get('bookingId');
      const serviceType = document.title.split('|')[0].trim(); // Extract service type from title if possible

      // ⚠️ DO NOT save raw image Base64 here. Firestore limit is 1MB.
      // In production, we would upload to Firebase Storage and save the URL.
      // For now, we save metadata to record that a suggestion was made for this context.
      await addDoc(collection(db, 'ai_price_estimates'), {
        userId: user ? user.uid : 'anonymous',
        bookingId: bookingId || 'standalone_chat', 
        userEmail: user ? user.email : 'N/A',
        suggestedPrice: suggestedPrice,
        serviceType: serviceType,
        timestamp: serverTimestamp(),
        pageContext: {
          title: document.title,
          url: window.location.href
        },
        status: 'pending_review'
      });
      console.log('✅ Internal price suggestion metadata saved');
    } catch (e) {
      console.error('Error saving AI suggestion:', e);
    }
  }

  async function sendToGemini(userInput, imageFile = null) {
    setLoading(true);
    const apiKey = process.env.REACT_APP_GEMINI_API_KEY;

    try {
      let imagePart = null;
      if (imageFile) {
        const base64 = await fileToBase64(imageFile);
        imagePart = { inline_data: { mime_type: imageFile.type, data: base64 } };
      }

      // Build context-aware system instruction
      const systemContext = `SYSTEM CONTEXT: Current Page: "${document.title}". URL: "${window.location.href}". 
      LATEST AI INSTRUCTIONS: ${instructions}
      ROLE: You are a Booking Advisor and Curator. Help the consumer compare quotes and select the best worker. Do NOT assign workers directly.
      IMPORTANT: If an image is provided, identify the service needed and suggest an INTERNAL price for workers/admins in the format [INTERNAL_PRICE: ₹X]. 
      Internal prices must NOT be shown to users. The user is a consumer.`;

      const contents = [
        ...history,
        {
          role: "user",
          parts: [
            { text: userInput || (imageFile ? "I've uploaded a photo of the work needed." : "") },
            ...(imagePart ? [imagePart] : [])
          ]
        }
      ];

      const response = await fetch(
        `https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent?key=${apiKey}`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            contents,
            system_instruction: { parts: [{ text: systemContext }] },
            generationConfig: { temperature: 0.4, maxOutputTokens: 400 }
          })
        }
      );

      if (!response.ok) throw new Error("Gemini API Error");

      const data = await response.json();
      let aiText = data?.candidates?.[0]?.content?.parts?.[0]?.text?.trim() || "I'm here to help, but I'm having trouble responding right now.";

      // Extract and hide internal pricing from consumer
      let suggestedPriceMatch = aiText.match(/\[INTERNAL_PRICE: ₹?(\d+)\]/i);
      if (suggestedPriceMatch) {
         const suggestedPrice = suggestedPriceMatch[1];
         aiText = aiText.replace(/\[INTERNAL_PRICE: ₹?\d+\]/gi, "").trim();
         
         // Fix: Only save metadata, don't pass massive base64 again
         await saveInternalPriceSuggestion(suggestedPrice);
      }

      setMessages(msgs => [...msgs, { text: aiText, user: false }]);
      // Update history for next turn
      setHistory(prev => [
        ...prev,
        { role: "user", parts: [{ text: userInput || "Image Uploaded" }] },
        { role: "model", parts: [{ text: aiText }] }
      ]);

    } catch (e) {
      console.error(e);
      setMessages(msgs => [...msgs, { text: "Connection error. Please try again.", user: false }]);
    }
    setLoading(false);
  }


  async function handleSend(e) {
    e.preventDefault();
    if ((!input.trim() && !selectedImage) || loading) return;

    const user = auth.currentUser;
    if (!user) return;

    const userText = input.trim();
    const imageToUpload = selectedImage;
    const imageUrl = imageToUpload ? URL.createObjectURL(imageToUpload) : null;

    // Save user message to Firestore (current chat thread, e.g., 'current' job)
    const msgData = {
      text: userText,
      user: true,
      image: imageUrl || null,
      timestamp: serverTimestamp(),
      role: 'user',
    };
    await addDoc(collection(db, 'users', user.uid, 'chats', 'current', 'messages'), msgData);

    // --- User behavior tracking ---
    // Save/Update user behavior profile
    const behaviorRef = doc(db, 'users', user.uid, 'behavior', 'profile');
    // Example: track prompt keywords, message count, last active, and most recent service request
    const promptKeywords = userText
      .toLowerCase()
      .split(/\W+/)
      .filter(w => w.length > 2);
    const serviceMatch = userText.match(/plumber|electrician|painter|cleaner|carpenter|ac|fridge|sofa|maid|repair|install|service|booking/i);
    try {
      await setDoc(
        behaviorRef,
        {
          lastActive: serverTimestamp(),
          lastPrompt: userText,
          lastService: serviceMatch ? serviceMatch[0].toLowerCase() : '',
          promptKeywords: promptKeywords,
        },
        { merge: true }
      );
      await updateDoc(behaviorRef, { messageCount: increment(1) });
    } catch (err) {
      // Ignore errors for behavior tracking
    }
    // --- End user behavior tracking ---

    // Cleanup generated object URL eventually
    if (imageUrl) {
      setTimeout(() => URL.revokeObjectURL(imageUrl), 60000);
    }

    setInput("");
    setSelectedImage(null);
    if (fileInputRef.current) fileInputRef.current.value = "";

    sendToGemini(userText, imageToUpload);
  }

  const handleImageChange = (e) => {
    if (e.target.files && e.target.files[0]) {
      setSelectedImage(e.target.files[0]);
    }
  };

  // No job selection UI, just chat
  return (
    <>
      <GlobalStyle />
      <ChatContainer>
        <Header>Gigtos Assistant</Header>
        <Messages>
          {messages.map((msg, i) => (
            <Bubble key={i} user={msg.user}>
              {msg.image && <ImagePreview src={msg.image} alt="Upload" />}
              {msg.text}
            </Bubble>
          ))}
          {loading && <TypingIndicator><span /><span /><span /></TypingIndicator>}
          <div ref={messagesEndRef} />
        </Messages>
        <InputRow onSubmit={handleSend}>
          <IconButton htmlFor="ai-chat-image">
            📷
            <input
              id="ai-chat-image"
              type="file"
              accept="image/*"
              hidden
              onChange={handleImageChange}
              ref={fileInputRef}
            />
          </IconButton>
          <Input
            value={input}
            onChange={e => setInput(e.target.value)}
            placeholder={selectedImage ? "Describe the photo..." : "How can I help you?"}
            disabled={loading}
          />
          <SendButton type="submit" disabled={loading || (!input.trim() && !selectedImage)}>
            {loading ? '...' : '→'}
          </SendButton>
        </InputRow>
        {selectedImage && (
          <div style={{ padding: '0 1.25rem 0.5rem', fontSize: '0.8rem', color: '#3b82f6' }}>
            📍 Photo attached: {selectedImage.name}
          </div>
        )}
      </ChatContainer>
    </>
  );
}

export default AIAssistantChatbot;
