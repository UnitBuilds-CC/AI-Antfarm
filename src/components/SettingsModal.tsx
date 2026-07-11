'use client';

import React, { useState, useEffect } from 'react';
import styles from '@/styles/Components.module.css';

export interface Settings {
  solanaRpc: string;
  snowflakeAccount: string;
  snowflakeUser: string;
  snowflakePass: string;
  snowflakeDb: string;
  snowflakeSchema: string;
  snowflakeWarehouse: string;
  geminiKey: string;
  elevenKey: string;
  elevenVoice: string;
  useMock: boolean;
}

interface SettingsModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSave: (settings: Settings) => void;
}

export default function SettingsModal({ isOpen, onClose, onSave }: SettingsModalProps) {
  const [settings, setSettings] = useState<Settings>({
    solanaRpc: '',
    snowflakeAccount: '',
    snowflakeUser: '',
    snowflakePass: '',
    snowflakeDb: '',
    snowflakeSchema: '',
    snowflakeWarehouse: '',
    geminiKey: '',
    elevenKey: '',
    elevenVoice: 'onwK4e9Gkvt875cghbq6', // Sirius deep voice
    useMock: true,
  });

  // Load from localStorage
  useEffect(() => {
    const saved = localStorage.getItem('ai_antfarm_settings');
    if (saved) {
      try {
        const parsed = JSON.parse(saved);
        setSettings(prev => ({ ...prev, ...parsed }));
      } catch (e) {
        console.error('Error loading settings', e);
      }
    }
  }, [isOpen]);

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
    const { name, value, type } = e.target;
    const val = type === 'checkbox' ? (e.target as HTMLInputElement).checked : value;
    setSettings(prev => ({ ...prev, [name]: val }));
  };

  const handleSave = () => {
    localStorage.setItem('ai_antfarm_settings', JSON.stringify(settings));
    onSave(settings);
    onClose();
  };

  if (!isOpen) return null;

  return (
    <div className={styles.modalOverlay}>
      <div className={`${styles.modalContent} glass-panel pulse-border-cyan`}>
        <div className={styles.panelHeader}>
          <div className={styles.panelTitle}>⚙️ CONFIGURATION INTERFACE</div>
          <button className={styles.whisperBtn} onClick={onClose}>✕</button>
        </div>

        <div className={styles.modalBody}>
          <div className={styles.formGroup}>
            <label style={{ display: 'flex', alignItems: 'center', gap: '8px', cursor: 'pointer' }}>
              <input 
                type="checkbox" 
                name="useMock" 
                checked={settings.useMock} 
                onChange={handleChange} 
              />
              ACTIVATE LOCAL OFFLINE MODE (MOCK ALL SERVICES)
            </label>
          </div>

          <div style={{ opacity: settings.useMock ? 0.5 : 1, transition: 'opacity 0.2s' }}>
            <h3 style={{ fontSize: '0.75rem', fontFamily: 'var(--font-mono)', borderBottom: '1px solid rgba(255,255,255,0.05)', paddingBottom: '4px', marginBottom: '12px', color: 'var(--neon-cyan)' }}>SOLANA ENDPOINT</h3>
            <div className={styles.formGroup}>
              <label>RPC Endpoint (Devnet/Mainnet)</label>
              <input 
                type="text" 
                name="solanaRpc" 
                placeholder="https://api.devnet.solana.com" 
                value={settings.solanaRpc}
                onChange={handleChange}
                disabled={settings.useMock}
              />
            </div>

            <h3 style={{ fontSize: '0.75rem', fontFamily: 'var(--font-mono)', borderBottom: '1px solid rgba(255,255,255,0.05)', paddingBottom: '4px', marginBottom: '12px', color: 'var(--neon-cyan)', marginTop: '16px' }}>SNOWFLAKE TELEMETRY DATABASE</h3>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px' }}>
              <div className={styles.formGroup}>
                <label>Account</label>
                <input 
                  type="text" 
                  name="snowflakeAccount" 
                  placeholder="xy12345.us-east-1"
                  value={settings.snowflakeAccount}
                  onChange={handleChange}
                  disabled={settings.useMock}
                />
              </div>
              <div className={styles.formGroup}>
                <label>User</label>
                <input 
                  type="text" 
                  name="snowflakeUser" 
                  placeholder="ANT_LOGGER"
                  value={settings.snowflakeUser}
                  onChange={handleChange}
                  disabled={settings.useMock}
                />
              </div>
              <div className={styles.formGroup} style={{ gridColumn: 'span 2' }}>
                <label>Password</label>
                <input 
                  type="password" 
                  name="snowflakePass" 
                  value={settings.snowflakePass}
                  onChange={handleChange}
                  disabled={settings.useMock}
                />
              </div>
              <div className={styles.formGroup}>
                <label>Database</label>
                <input 
                  type="text" 
                  name="snowflakeDb" 
                  placeholder="ANTFARM_DB"
                  value={settings.snowflakeDb}
                  onChange={handleChange}
                  disabled={settings.useMock}
                />
              </div>
              <div className={styles.formGroup}>
                <label>Schema</label>
                <input 
                  type="text" 
                  name="snowflakeSchema" 
                  placeholder="PUBLIC"
                  value={settings.snowflakeSchema}
                  onChange={handleChange}
                  disabled={settings.useMock}
                />
              </div>
              <div className={styles.formGroup} style={{ gridColumn: 'span 2' }}>
                <label>Warehouse</label>
                <input 
                  type="text" 
                  name="snowflakeWarehouse" 
                  placeholder="COMPUTE_WH"
                  value={settings.snowflakeWarehouse}
                  onChange={handleChange}
                  disabled={settings.useMock}
                />
              </div>
            </div>

            <h3 style={{ fontSize: '0.75rem', fontFamily: 'var(--font-mono)', borderBottom: '1px solid rgba(255,255,255,0.05)', paddingBottom: '4px', marginBottom: '12px', color: 'var(--neon-cyan)', marginTop: '16px' }}>COGNITIVE INTERFACES</h3>
            <div className={styles.formGroup}>
              <label>Google Gemini API Key</label>
              <input 
                type="password" 
                name="geminiKey" 
                placeholder="AIzaSy..." 
                value={settings.geminiKey}
                onChange={handleChange}
                disabled={settings.useMock}
              />
            </div>
            <div className={styles.formGroup}>
              <label>ElevenLabs API Key</label>
              <input 
                type="password" 
                name="elevenKey" 
                placeholder="xi-api-key..." 
                value={settings.elevenKey}
                onChange={handleChange}
                disabled={settings.useMock}
              />
            </div>
            <div className={styles.formGroup}>
              <label>ElevenLabs Voice ID</label>
              <input 
                type="text" 
                name="elevenVoice" 
                placeholder="onwK4e9Gkvt875cghbq6" 
                value={settings.elevenVoice}
                onChange={handleChange}
                disabled={settings.useMock}
              />
            </div>
          </div>
        </div>

        <div className={styles.modalFooter}>
          <button className="cyber-btn" onClick={onClose} style={{ background: 'transparent', borderColor: 'var(--text-muted)', color: 'var(--text-muted)' }}>CANCEL</button>
          <button className="cyber-btn gold" onClick={handleSave}>SAVE PROTOCOLS</button>
        </div>
      </div>
    </div>
  );
}
