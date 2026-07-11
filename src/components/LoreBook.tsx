'use client';

import React from 'react';
import styles from '@/styles/Components.module.css';
import { ColonyEvent } from '@/lib/simulation/colony';

interface LoreBookProps {
  events: ColonyEvent[];
}

export default function LoreBook({ events }: LoreBookProps) {
  return (
    <div className={`${styles.panel} glass-panel`} style={{ height: '100%' }}>
      <div className={styles.panelHeader}>
        <div className={styles.panelTitle}>📖 CHRONICLES OF THE ANTFARM</div>
        <div style={{ fontSize: '0.65rem', color: 'var(--text-muted)' }}>
          {events.length} LOGS RECORDED
        </div>
      </div>

      <div className={styles.panelContent}>
        {events.length === 0 ? (
          <div style={{ display: 'flex', height: '100%', alignItems: 'center', justifyContent: 'center', color: 'var(--text-muted)', fontSize: '0.75rem', fontFamily: 'var(--font-mono)' }}>
            No lore events recorded. The soil rests in silence.
          </div>
        ) : (
          <div className={styles.loreList}>
            {events.map((event, index) => (
              <div key={`${event.slot}-${index}`} className={styles.loreItem}>
                <div className={styles.loreMeta}>
                  <span className={styles.loreSlot}>Slot #{event.slot}</span>
                  <span className={styles.loreTime}>{event.timestamp}</span>
                  <span className={`${styles.loreType} ${styles['type_' + event.type] || ''}`}>
                    {event.type.replace('_', ' ')}
                  </span>
                </div>
                <div style={{ fontSize: '0.8rem', color: 'var(--text-primary)' }}>
                  {event.text}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
