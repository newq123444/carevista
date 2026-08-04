// src/components/VoiceNoteInput.tsx — Voice-to-text care note input using Web Speech API
import React, { useState, useRef, useEffect } from 'react';
import { voiceApi } from '../services/api';
import { useCreateNoteFromVoice } from '../hooks';

const NOTE_TYPES: [string, string][] = [
  ['personal_care', 'Personal Care'],
  ['continence', 'Continence & Toileting'],
  ['nutrition', 'Nutrition & Fluids'],
  ['repositioning', 'Repositioning'],
  ['nursing_observation', 'Nursing Observation'],
  ['sleep', 'Sleep'],
  ['behaviour', 'Behaviour'],
  ['wound_care', 'Wound Care'],
  ['fall_observation', 'Fall / Post-Fall Observation'],
  ['activities', 'Activities & Wellbeing'],
  ['gp_visit', 'GP / Clinical Visit'],
  ['hospital_visit', 'Hospital Visit'],
  ['family_update', 'Family Communication'],
  ['end_of_life', 'End of Life Care'],
  ['handover', 'Handover Note'],
  ['medication_note', 'Medication Note'],
  ['incident_note', 'Incident / Concern'],
  ['social_wellbeing', 'Social Wellbeing'],
];

const pulseKeyframes = `
@keyframes voicePulse {
  0% { transform: scale(1); box-shadow: 0 0 0 0 rgba(220, 38, 38, 0.5); }
  50% { transform: scale(1.05); box-shadow: 0 0 0 12px rgba(220, 38, 38, 0); }
  100% { transform: scale(1); box-shadow: 0 0 0 0 rgba(220, 38, 38, 0); }
}
@keyframes dotPulse {
  0%, 100% { opacity: 1; }
  50% { opacity: 0.3; }
}
`;

interface VoiceNoteInputProps {
  residentId: string;
  onNoteCreated?: () => void;
}

export default function VoiceNoteInput({ residentId, onNoteCreated }: VoiceNoteInputProps) {
  const [isRecording, setIsRecording] = useState(false);
  const [transcript, setTranscript] = useState('');
  const [interimText, setInterimText] = useState('');
  const [noteType, setNoteType] = useState('personal_care');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState('');
  const recognitionRef = useRef<any>(null);
  const createNote = useCreateNoteFromVoice();

  const SpeechRecognition = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
  const isSupported = !!SpeechRecognition;

  useEffect(() => {
    return () => {
      if (recognitionRef.current) {
        try { recognitionRef.current.stop(); } catch (_) {}
      }
    };
  }, []);

  const startRecording = () => {
    if (!SpeechRecognition) return;
    setError('');
    const recognition = new SpeechRecognition();
    recognition.continuous = true;
    recognition.interimResults = true;
    recognition.lang = 'en-GB';

    recognition.onresult = (event: any) => {
      let finalText = '';
      let interim = '';
      for (let i = 0; i < event.results.length; i++) {
        const result = event.results[i];
        if (result.isFinal) {
          finalText += result[0].transcript + ' ';
        } else {
          interim += result[0].transcript;
        }
      }
      if (finalText) {
        setTranscript(prev => prev + finalText);
      }
      setInterimText(interim);
    };

    recognition.onerror = (event: any) => {
      setError(`Speech recognition error: ${event.error}`);
      setIsRecording(false);
    };

    recognition.onend = () => {
      setIsRecording(false);
      setInterimText('');
    };

    recognitionRef.current = recognition;
    recognition.start();
    setIsRecording(true);
  };

  const stopRecording = () => {
    if (recognitionRef.current) {
      recognitionRef.current.stop();
    }
    setIsRecording(false);
    setInterimText('');
  };

  const toggleRecording = () => {
    if (isRecording) {
      stopRecording();
    } else {
      startRecording();
    }
  };

  const handleCreateNote = async () => {
    if (!transcript.trim()) {
      setError('No transcription text to create a note from');
      return;
    }
    setIsSubmitting(true);
    setError('');
    try {
      // First send transcription to backend
      const formData = new FormData();
      formData.append('text', transcript.trim());
      if (residentId) {
        formData.append('residentId', residentId);
      }
      const transcribeRes = await voiceApi.transcribe(formData);
      const transcriptionId = transcribeRes.data?.id || transcribeRes.data?.transcription?.id;

      // Then create care note from transcription
      await createNote.mutateAsync({
        transcriptionId,
        residentId,
        noteType,
      });

      setTranscript('');
      setInterimText('');
      if (onNoteCreated) onNoteCreated();
    } catch (err: any) {
      setError(err.response?.data?.error || 'Failed to create note from voice');
    } finally {
      setIsSubmitting(false);
    }
  };

  // Fallback for unsupported browsers
  if (!isSupported) {
    return (
      <div style={{ padding: 16, background: 'var(--surface-2)', borderRadius: 'var(--radius)', marginBottom: 16 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 12 }}>
          <span style={{ fontSize: '1.2rem' }}>🎤</span>
          <span style={{ fontWeight: 600, fontSize: '0.9rem' }}>Voice Note</span>
          <span style={{ fontSize: '0.78rem', color: 'var(--text-muted)', marginLeft: 8 }}>Voice input not supported in this browser</span>
        </div>
        <div style={{ marginBottom: 12 }}>
          <label className="form-label">Note Type</label>
          <select className="form-input" value={noteType} onChange={e => setNoteType(e.target.value)} style={{ maxWidth: 250 }}>
            {NOTE_TYPES.map(([val, label]) => <option key={val} value={val}>{label}</option>)}
          </select>
        </div>
        <textarea
          className="form-input"
          rows={4}
          placeholder="Type your note here (voice input unavailable)..."
          value={transcript}
          onChange={e => setTranscript(e.target.value)}
          style={{ resize: 'vertical', marginBottom: 12 }}
        />
        {error && <div style={{ color: 'var(--danger)', fontSize: '0.82rem', marginBottom: 8 }}>{error}</div>}
        <button
          className="btn btn-primary"
          onClick={handleCreateNote}
          disabled={isSubmitting || !transcript.trim() || !residentId}
        >
          {isSubmitting ? 'Creating...' : 'Create Care Note'}
        </button>
      </div>
    );
  }

  return (
    <div style={{ padding: 16, background: 'var(--surface-2)', borderRadius: 'var(--radius)', marginBottom: 16 }}>
      <style>{pulseKeyframes}</style>
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 16 }}>
        <span style={{ fontSize: '1.2rem' }}>🎤</span>
        <span style={{ fontWeight: 600, fontSize: '0.9rem' }}>Voice Note</span>
        {isRecording && (
          <span style={{ display: 'flex', alignItems: 'center', gap: 6, marginLeft: 8 }}>
            <span style={{ width: 8, height: 8, borderRadius: '50%', background: '#dc2626', animation: 'dotPulse 1s infinite' }} />
            <span style={{ fontSize: '0.82rem', color: '#dc2626', fontWeight: 600 }}>Listening...</span>
          </span>
        )}
      </div>

      <div style={{ display: 'flex', alignItems: 'center', gap: 16, marginBottom: 16 }}>
        {/* Microphone button */}
        <button
          type="button"
          onClick={toggleRecording}
          style={{
            width: 64,
            height: 64,
            borderRadius: '50%',
            border: 'none',
            background: isRecording ? '#dc2626' : 'var(--primary)',
            color: '#fff',
            fontSize: '1.5rem',
            cursor: 'pointer',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            flexShrink: 0,
            animation: isRecording ? 'voicePulse 1.5s infinite' : 'none',
            transition: 'background 0.2s',
          }}
          title={isRecording ? 'Stop recording' : 'Start recording'}
        >
          {isRecording ? '⏹' : '🎤'}
        </button>

        {/* Note type selector */}
        <div style={{ flex: 1 }}>
          <label className="form-label" style={{ marginBottom: 4 }}>Note Type</label>
          <select className="form-input" value={noteType} onChange={e => setNoteType(e.target.value)}>
            {NOTE_TYPES.map(([val, label]) => <option key={val} value={val}>{label}</option>)}
          </select>
        </div>
      </div>

      {/* Live transcription display */}
      <div style={{ marginBottom: 12 }}>
        <label className="form-label" style={{ marginBottom: 4 }}>Transcription</label>
        <textarea
          className="form-input"
          rows={4}
          placeholder={isRecording ? 'Speak now... your words will appear here' : 'Press the microphone button and start speaking'}
          value={transcript + interimText}
          onChange={e => { setTranscript(e.target.value); setInterimText(''); }}
          style={{ resize: 'vertical', fontStyle: interimText ? 'italic' : 'normal' }}
        />
      </div>

      {error && <div style={{ color: 'var(--danger)', fontSize: '0.82rem', marginBottom: 8 }}>{error}</div>}

      {/* Action buttons */}
      <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
        <button
          className="btn btn-primary"
          onClick={handleCreateNote}
          disabled={isSubmitting || !transcript.trim() || !residentId}
        >
          {isSubmitting ? 'Creating...' : 'Create Care Note'}
        </button>
        {transcript && (
          <button
            type="button"
            className="btn btn-ghost btn-sm"
            onClick={() => { setTranscript(''); setInterimText(''); }}
          >
            Clear
          </button>
        )}
        {!residentId && (
          <span style={{ fontSize: '0.78rem', color: 'var(--text-muted)' }}>Select a resident first</span>
        )}
      </div>
    </div>
  );
}
