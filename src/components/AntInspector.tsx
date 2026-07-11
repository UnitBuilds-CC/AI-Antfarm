'use client';

import React, { useState, useEffect, useRef } from 'react';
import styles from '@/styles/Components.module.css';
import { Ant } from '@/lib/simulation/ant';
import { playBrowserSpeech } from '@/lib/mockData';

interface AntInspectorProps {
  ant: Ant | null;
  currentHash: string;
  currentSlot: number;
  onWhisper: (antId: string, whisper: string) => void;
  geminiKey: string;
  elevenKey: string;
  elevenVoice: string;
}

export default function AntInspector({
  ant,
  currentHash,
  currentSlot,
  onWhisper,
  geminiKey,
  elevenKey,
  elevenVoice
}: AntInspectorProps) {
  const [monologue, setMonologue] = useState<string>('');
  const [displayedText, setDisplayedText] = useState<string>('');
  const [whisper, setWhisper] = useState<string>('');
  const [isGeneratingText, setIsGeneratingText] = useState<boolean>(false);
  const [isGeneratingAudio, setIsGeneratingAudio] = useState<boolean>(false);
  const [audioSource, setAudioSource] = useState<string>('');
  const [isPlayingAudio, setIsPlayingAudio] = useState<boolean>(false);

  const audioRef = useRef<HTMLAudioElement | null>(null);
  const typewriterIntervalRef = useRef<NodeJS.Timeout | null>(null);

  // Clear monologue when ant changes
  useEffect(() => {
    setMonologue('');
    setDisplayedText('');
    setWhisper('');
    setIsPlayingAudio(false);
    if (audioRef.current) {
      audioRef.current.pause();
    }
  }, [ant]);

  // Clean up typewriter and audio on unmount
  useEffect(() => {
    return () => {
      if (typewriterIntervalRef.current) clearInterval(typewriterIntervalRef.current);
    };
  }, []);

  if (!ant) {
    return (
      <div className={`${styles.panel} glass-panel`}>
        <div className={styles.emptyInspector}>
          <div className={styles.emptyInspectorIcon}>🐜</div>
          <div style={{ textTransform: 'uppercase', fontSize: '0.8rem', letterSpacing: '1px' }}>COLONY OBSERVER</div>
          <p style={{ fontSize: '0.65rem', marginTop: '8px', color: 'var(--text-muted)' }}>
            Select an active member of the colony to inspect their state, trace their historic telemetry record, or inject cognitive whispers into their mind.
          </p>
        </div>
      </div>
    );
  }

  // Typewriter effect
  const startTypewriter = (text: string) => {
    if (typewriterIntervalRef.current) {
      clearInterval(typewriterIntervalRef.current);
    }
    setDisplayedText('');
    let i = 0;
    
    // Type write speed
    typewriterIntervalRef.current = setInterval(() => {
      setDisplayedText(prev => prev + text.charAt(i));
      i++;
      if (i >= text.length) {
        if (typewriterIntervalRef.current) clearInterval(typewriterIntervalRef.current);
      }
    }, 25);
  };

  const handleTriggerMonologue = async () => {
    if (isGeneratingText || isGeneratingAudio) return;
    
    setIsGeneratingText(true);
    setMonologue('');
    setDisplayedText('');
    setIsPlayingAudio(false);

    try {
      // 1. Fetch text monologue from Gemini API route
      const response = await fetch('/api/monologue', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-gemini-api-key': geminiKey,
        },
        body: JSON.stringify({
          antId: ant.id,
          role: ant.role,
          action: ant.state,
          carriedItem: ant.carriedItem,
          energy: ant.energy,
          history: ant.history,
          blockhash: currentHash,
          slot: currentSlot,
          whisper: ant.whisper,
        })
      });

      if (!response.ok) throw new Error('Failed to generate monologue text');
      
      const textData = await response.json();
      const monologueText = textData.text;
      setMonologue(monologueText);
      startTypewriter(monologueText);
      setIsGeneratingText(false);

      // 2. Fetch audio voiceover from ElevenLabs proxy API route
      setIsGeneratingAudio(true);
      const audioResponse = await fetch('/api/speech', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-elevenlabs-api-key': elevenKey,
          'x-elevenlabs-voice-id': elevenVoice,
        },
        body: JSON.stringify({ text: monologueText })
      });

      if (!audioResponse.ok) throw new Error('Audio proxy returned error');
      
      const contentType = audioResponse.headers.get('content-type') || '';
      if (contentType.includes('application/json')) {
        const audioData = await audioResponse.json();
        if (audioData.mock) {
          // Play using native browser Web Speech fallback
          setIsGeneratingAudio(false);
          setIsPlayingAudio(true);
          playBrowserSpeech(monologueText);
          setIsPlayingAudio(false); // mock doesn't stream play updates easily, just reset flag
          return;
        }
      }

      // We have a binary audio buffer, play it
      const audioBlob = await audioResponse.blob();
      const audioUrl = URL.createObjectURL(audioBlob);
      setAudioSource(audioUrl);
      setIsGeneratingAudio(false);
      setIsPlayingAudio(true);

      if (audioRef.current) {
        audioRef.current.src = audioUrl;
        audioRef.current.play();
      }
    } catch (e) {
      console.error(e);
      setIsGeneratingText(false);
      setIsGeneratingAudio(false);
      setIsPlayingAudio(false);
      const fallback = `My system errors... The Solana current slot ${currentSlot} registers only blank vectors in my mind.`;
      setMonologue(fallback);
      startTypewriter(fallback);
    }
  };

  const handleWhisperSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!whisper.trim()) return;
    onWhisper(ant.id, whisper.trim());
    setWhisper('');
  };

  const formattedAge = (ant.age / 60).toFixed(1); // convert ticks to fake seconds

  return (
    <div className={`${styles.panel} glass-panel`}>
      <audio 
        ref={audioRef} 
        style={{ display: 'none' }} 
        onEnded={() => {
          setIsPlayingAudio(false);
          if (audioSource) URL.revokeObjectURL(audioSource);
        }}
      />

      <div className={styles.panelHeader}>
        <div className={styles.panelTitle}>🐜 UNIT DETAILED TELEMETRY</div>
      </div>

      <div className={styles.panelContent}>
        <div className={styles.inspectorCard} style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between' }}>
            <span style={{ color: 'var(--neon-cyan)', fontWeight: 700 }}>{ant.id}</span>
            <span style={{ color: 'var(--text-muted)' }}>Role: {ant.role.toUpperCase()}</span>
          </div>

          <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.7rem', color: 'var(--text-secondary)' }}>
            <span>State: <strong style={{ color: ant.state === 'resting' ? 'var(--neon-gold)' : 'var(--text-primary)' }}>{ant.state.toUpperCase()}</strong></span>
            <span>Age: {formattedAge}s</span>
          </div>

          <div>
            <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.7rem' }}>
              <span>Energy Reserves</span>
              <span>{Math.round(ant.energy)}%</span>
            </div>
            <div className={styles.energyBarContainer}>
              <div className={styles.energyBar} style={{ width: `${ant.energy}%` }}></div>
            </div>
          </div>

          <div style={{ fontSize: '0.7rem', color: 'var(--text-secondary)' }}>
            Carrying Substrate: <strong style={{ color: ant.carriedItem !== 'none' ? 'var(--neon-cyan)' : 'var(--text-muted)' }}>{ant.carriedItem.toUpperCase()}</strong>
          </div>

          {ant.whisper && (
            <div style={{ fontSize: '0.7rem', color: 'var(--neon-gold)', border: '1px solid rgba(255, 208, 0, 0.2)', padding: '4px 8px', background: 'rgba(255, 208, 0, 0.03)', borderRadius: '2px' }}>
              🧠 Echoing Whisper: "{ant.whisper}"
            </div>
          )}

          <div>
            <div style={{ fontSize: '0.7rem', textTransform: 'uppercase', color: 'var(--text-muted)', marginBottom: '4px' }}>Historic Record</div>
            <ul className={styles.logList}>
              {ant.history.map((log, index) => (
                <li key={index}>» {log}</li>
              ))}
            </ul>
          </div>
        </div>

        <div style={{ marginTop: '16px' }}>
          <button 
            className="cyber-btn magenta" 
            style={{ width: '100%', display: 'flex', justifyContent: 'center', alignItems: 'center', gap: '8px' }}
            onClick={handleTriggerMonologue}
            disabled={isGeneratingText || isGeneratingAudio}
          >
            {isGeneratingText ? (
              <span>⚡ DECODING SYNAPTIC BURST...</span>
            ) : isGeneratingAudio ? (
              <span>🔊 SYNTHESIZING VOICEOVER...</span>
            ) : isPlayingAudio ? (
              <span>🗣️ PLAYING MONOLOGUE VOICE...</span>
            ) : (
              <span>🧠 EXTRACT INNER MONOLOGUE</span>
            )}
          </button>
        </div>

        {displayedText && (
          <div className={styles.monologueContainer}>
            <div className={styles.monologueQuote}>
              "{displayedText}"
            </div>
            <div className={styles.monologueSource}>
              Cognitive Monologue Generated by Gemini 2.0 Flash-Lite
            </div>
          </div>
        )}

        {ant.role !== 'queen' && (
          <form className={styles.whisperForm} onSubmit={handleWhisperSubmit}>
            <input 
              type="text" 
              className={styles.whisperInput} 
              placeholder="Whisper command into antenna..." 
              value={whisper}
              onChange={(e) => setWhisper(e.target.value)}
            />
            <button type="submit" className={styles.whisperBtn}>WHISPER</button>
          </form>
        )}
      </div>
    </div>
  );
}
