import React, { useState, useEffect } from 'react';
import styled, { keyframes } from 'styled-components';
import { db } from '../firebase';
import { doc, getDoc, setDoc } from 'firebase/firestore';
import { Save, RotateCcw, Brain, Info } from 'lucide-react';

const fadeIn = keyframes`
  from { opacity: 0; transform: translateY(20px); }
  to { opacity: 1; transform: translateY(0); }
`;

const PageContainer = styled.div`
  max-width: 900px;
  margin: 2rem auto;
  padding: 2rem;
  background: rgba(255, 255, 255, 0.7);
  backdrop-filter: blur(15px);
  -webkit-backdrop-filter: blur(15px);
  border: 1px solid rgba(255, 255, 255, 0.3);
  border-radius: 32px;
  box-shadow: 0 10px 40px rgba(0, 0, 0, 0.08);
  animation: ${fadeIn} 0.8s cubic-bezier(0.16, 1, 0.3, 1);
  font-family: 'Outfit', sans-serif;
`;

const Title = styled.h1`
  font-size: 2.5rem;
  font-weight: 700;
  color: #1e293b;
  margin-bottom: 0.5rem;
  background: linear-gradient(135deg, #1e293b 0%, #334155 100%);
  -webkit-background-clip: text;
  -webkit-text-fill-color: transparent;
  display: flex;
  align-items: center;
  gap: 1rem;
`;

const Description = styled.p`
  color: #64748b;
  font-size: 1.1rem;
  margin-bottom: 2.5rem;
  display: flex;
  align-items: flex-start;
  gap: 1rem;
  background: #f8fafc;
  padding: 1rem;
  border-radius: 16px;
  border: 1px solid #e2e8f0;
`;

const EditorCard = styled.div`
  background: #fff;
  border-radius: 24px;
  padding: 2rem;
  box-shadow: 0 4px 20px rgba(0, 0, 0, 0.03);
  border: 1px solid #f1f5f9;
`;

const Label = styled.label`
  display: block;
  font-size: 0.875rem;
  font-weight: 600;
  color: #475569;
  text-transform: uppercase;
  letter-spacing: 1px;
  margin-bottom: 0.75rem;
`;

const TextArea = styled.textarea`
  width: 100%;
  height: 400px;
  padding: 1.5rem;
  border: 1px solid #e2e8f0;
  border-radius: 16px;
  font-family: 'Fira Code', monospace;
  font-size: 1rem;
  line-height: 1.6;
  color: #334155;
  outline: none;
  resize: vertical;
  transition: border-color 0.2s, box-shadow 0.2s;

  &:focus {
    border-color: #2d7ff9;
    box-shadow: 0 0 0 4px rgba(45, 127, 249, 0.1);
  }
`;

const ButtonRow = styled.div`
  display: flex;
  justify-content: flex-end;
  margin-top: 2rem;
  gap: 1rem;
`;

const StatusMessage = styled.span`
  align-self: center;
  font-size: 0.9rem;
  color: ${props => props.error ? '#ef4444' : '#10b981'};
  font-weight: 500;
`;

const PrimaryButton = styled.button`
  padding: 0.75rem 2.5rem;
  background: linear-gradient(135deg, #2d7ff9 0%, #1a5fcc 100%);
  color: #fff;
  border: none;
  border-radius: 12px;
  font-size: 1rem;
  font-weight: 600;
  cursor: pointer;
  transition: transform 0.2s, box-shadow 0.2s;
  display: flex;
  align-items: center;
  gap: 0.5rem;

  &:hover {
    transform: translateY(-2px);
    box-shadow: 0 6px 20px rgba(45, 127, 249, 0.3);
  }

  &:active { transform: translateY(0); }
  &:disabled {
    background: #cbd5e1;
    cursor: not-allowed;
    transform: none;
    box-shadow: none;
  }
`;

const SecondaryButton = styled.button`
  padding: 0.75rem 2rem;
  background: #f8fafc;
  color: #64748b;
  border: 1px solid #e2e8f0;
  border-radius: 12px;
  font-size: 1rem;
  font-weight: 600;
  cursor: pointer;
  transition: background 0.2s;
  display: flex;
  align-items: center;
  gap: 0.5rem;

  &:hover { background: #f1f5f9; }
`;

function AIInstructions() {
  const [content, setContent] = useState("");
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [status, setStatus] = useState("");

  useEffect(() => {
    fetch('/Gigtos/AI_ASSISTANT_INSTRUCTIONS.md')
      .then(res => res.text())
      .then(text => {
        setContent(text);
        setLoading(false);
      })
      .catch(err => {
        console.error("Failed to load baseline instructions:", err);
        setLoading(false);
      });
      
    async function loadFromFirestore() {
      try {
        const docRef = doc(db, 'config', 'ai_instructions');
        const docSnap = await getDoc(docRef);
        if (docSnap.exists()) {
          setContent(docSnap.data().markdown);
        }
      } catch (e) {
        console.warn("Firestore fetch failed, using static file baseline.");
      }
    }
    loadFromFirestore();
  }, []);

  const handleSave = async () => {
    setSaving(true);
    setStatus("");
    try {
      await setDoc(doc(db, 'config', 'ai_instructions'), {
        markdown: content,
        updatedAt: new Date(),
      });
      setStatus("Instructions updated successfully!");
      setTimeout(() => setStatus(""), 3000);
    } catch (e) {
      console.error(e);
      setStatus("Error saving instructions. Please try again.");
    }
    setSaving(false);
  };

  const handleReset = () => {
    if (window.confirm("Restore to default instructions? This will discard your current changes.")) {
      fetch('/Gigtos/AI_ASSISTANT_INSTRUCTIONS.md')
        .then(res => res.text())
        .then(text => setContent(text));
    }
  };

  if (loading) return <PageContainer><Title>Loading...</Title></PageContainer>;

  return (
    <PageContainer>
      <Title>AI Assistant Brain</Title>
      <Description>
        Configure the identity, domain knowledge, and behavioral rules for the Gigtos AI Assistant.
      </Description>
      
      <EditorCard>
        <Label>System Instructions (Markdown)</Label>
        <TextArea 
          value={content}
          onChange={(e) => setContent(e.target.value)}
          placeholder="# AI Assistant Brain..."
        />
        
        <ButtonRow>
          {status && <StatusMessage error={status.includes("Error")}>{status}</StatusMessage>}
          <SecondaryButton onClick={handleReset} disabled={saving}>Reset to Default</SecondaryButton>
          <PrimaryButton onClick={handleSave} disabled={saving}>
            {saving ? 'Saving...' : 'Sync with AI'}
          </PrimaryButton>
        </ButtonRow>
      </EditorCard>
    </PageContainer>
  );
}

export default AIInstructions;
