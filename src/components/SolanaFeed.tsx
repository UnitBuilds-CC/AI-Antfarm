'use client';

import React from 'react';
import styles from '@/styles/Components.module.css';
import { Vector2D } from '@/lib/simulation/vector';

interface SolanaFeedProps {
  currentHash: string;
  currentSlot: number;
  wind: Vector2D;
  mutationSpeed: number;
  source: string;
}

export default function SolanaFeed({ currentHash, currentSlot, wind, mutationSpeed, source }: SolanaFeedProps) {
  // Format hash for rendering
  const formatHash = (h: string) => {
    if (!h) return 'N/A';
    if (h.length <= 12) return h;
    return `${h.substring(0, 8)}...${h.substring(h.length - 8)}`;
  };

  // Get status color based on source
  const getSourceIndicator = () => {
    switch (source.toLowerCase()) {
      case 'rpc':
        return { label: 'LIVE SOLANA NODE', style: { color: '#00ff66', textShadow: '0 0 5px rgba(0,255,102,0.4)' } };
      case 'mock':
        return { label: 'MOCK ENTROPY SEED', style: { color: 'var(--neon-gold)', textShadow: '0 0 5px var(--neon-gold-glow)' } };
      default:
        return { label: 'DEGRADED FALLBACK', style: { color: 'var(--neon-magenta)', textShadow: '0 0 5px var(--neon-magenta-glow)' } };
    }
  };

  const status = getSourceIndicator();
  const windAngleDeg = Math.round((wind.heading() * 180) / Math.PI) || 0;
  const windSpeed = Math.round(wind.mag() * 100) || 0;

  return (
    <div className={`${styles.panel} glass-panel`}>
      <div className={styles.panelHeader}>
        <div className={styles.panelTitle}>🔗 SOLANA ENTROPY PULSE</div>
        <div style={{ fontSize: '0.6rem', fontFamily: 'var(--font-mono)', ...status.style }}>
          ■ {status.label}
        </div>
      </div>
      
      <div className={styles.panelContent}>
        <div className={styles.feedGrid}>
          <div className={styles.statCard}>
            <div className={styles.statLabel}>Current Blockhash</div>
            <div className={`${styles.statValue} glow-cyan`} title={currentHash}>
              {formatHash(currentHash)}
            </div>
          </div>

          <div className={styles.statCard}>
            <div className={styles.statLabel}>Slot Height</div>
            <div className={`${styles.statValue} ${styles.gold} glow-gold`}>
              {currentSlot.toLocaleString()}
            </div>
          </div>

          <div className={styles.statCard}>
            <div className={styles.statLabel}>Entropy Wind Vector</div>
            <div className={styles.statValue}>
              {windSpeed > 0 ? `${windSpeed}m/s @ ${windAngleDeg}°` : '0m/s (Calm)'}
            </div>
          </div>

          <div className={styles.statCard}>
            <div className={styles.statLabel}>Mutation speed</div>
            <div className={styles.statValue} style={{ color: mutationSpeed > 1.2 ? 'var(--neon-magenta)' : 'var(--text-primary)' }}>
              {mutationSpeed.toFixed(2)}x
            </div>
          </div>
        </div>
        
        <div style={{ fontSize: '0.65rem', color: 'var(--text-muted)', lineHeight: '1.4', fontFamily: 'var(--font-mono)' }}>
          * Wind vector and ant velocity modifiers are extracted directly from the byte-entropy of the ticking blockhash.
        </div>
      </div>
    </div>
  );
}
