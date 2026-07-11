'use client';

import React, { useState, useEffect, useRef } from 'react';
import styles from '@/styles/Dashboard.module.css';
import { Colony } from '@/lib/simulation/colony';
import { Ant } from '@/lib/simulation/ant';
import { Vector2D } from '@/lib/simulation/vector';
import SettingsModal, { Settings } from '@/components/SettingsModal';
import SolanaFeed from '@/components/SolanaFeed';
import LoreBook from '@/components/LoreBook';
import AntInspector from '@/components/AntInspector';
import SimulationCanvas from '@/components/SimulationCanvas';

export default function Dashboard() {
  const [colony, setColony] = useState<Colony | null>(null);
  const [activeTool, setActiveTool] = useState<'select' | 'sugar' | 'water'>('select');
  const [selectedAnt, setSelectedAnt] = useState<Ant | null>(null);
  const [isPaused, setIsPaused] = useState<boolean>(false);
  const [simSpeed, setSimSpeed] = useState<number>(1.0);
  const [isSettingsOpen, setIsSettingsOpen] = useState<boolean>(false);
  
  // Tick state to force React HUD re-renders in sync with the canvas updates
  const [hudTick, setHudTick] = useState<number>(0);

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
    elevenVoice: 'onwK4e9Gkvt875cghbq6',
    useMock: true,
  });

  const [solanaSource, setSolanaSource] = useState<string>('mock');

  // References to keep loops clean
  const colonyRef = useRef<Colony | null>(null);
  const settingsRef = useRef<Settings>(settings);

  // Load settings on mount
  useEffect(() => {
    const saved = localStorage.getItem('ai_antfarm_settings');
    if (saved) {
      try {
        const parsed = JSON.parse(saved);
        setSettings(parsed);
        settingsRef.current = parsed;
      } catch (e) {
        console.error('Error loading settings', e);
      }
    }
  }, []);

  // Initialize Colony on mount
  useEffect(() => {
    // Canvas dimensions matching client sizes
    const col = new Colony(800, 500);
    colonyRef.current = col;
    setColony(col);

    // Initial database sync if real Snowflake configured
    if (!settingsRef.current.useMock && settingsRef.current.snowflakeAccount) {
      fetch('/api/telemetry', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-snowflake-account': settingsRef.current.snowflakeAccount,
          'x-snowflake-username': settingsRef.current.snowflakeUser,
          'x-snowflake-password': settingsRef.current.snowflakePass,
          'x-snowflake-database': settingsRef.current.snowflakeDb,
          'x-snowflake-schema': settingsRef.current.snowflakeSchema,
          'x-snowflake-warehouse': settingsRef.current.snowflakeWarehouse,
        },
        body: JSON.stringify({ type: 'init' })
      }).catch(err => console.error('Error initializing Snowflake tables:', err));
    }

    // HUD Ticker: forces React overlays to redraw twice per second
    const hudInterval = setInterval(() => {
      setHudTick(prev => prev + 1);
    }, 500);

    return () => {
      clearInterval(hudInterval);
    };
  }, []);

  // Solana Blockhash Polling Loop
  useEffect(() => {
    const fetchSolanaData = async () => {
      const activeSettings = settingsRef.current;
      const url = `/api/solana?mock=${activeSettings.useMock}&rpcUrl=${encodeURIComponent(activeSettings.solanaRpc)}`;

      try {
        const response = await fetch(url);
        if (!response.ok) throw new Error('API route returned error');
        
        const data = await response.json();
        
        if (colonyRef.current) {
          const oldHash = colonyRef.current.currentHash;
          colonyRef.current.applySolanaHash(data.hash, data.slot);
          setSolanaSource(data.source);

          // If blockhash changed, log event
          if (oldHash !== data.hash) {
            colonyRef.current.logLore('BLOCK_HEARTBEAT', `Blockchain pulse received: slot ${data.slot} hash extracted.`);
          }
        }
      } catch (err) {
        console.error('Error in Solana polling:', err);
      }
    };

    // Run immediately and then poll every 3 seconds (reduces RPC overhead)
    fetchSolanaData();
    const interval = setInterval(fetchSolanaData, 3000);

    return () => clearInterval(interval);
  }, [settings.useMock, settings.solanaRpc]);

  // Snowflake Telemetry batch ingestion loop
  useEffect(() => {
    const flushTelemetry = async () => {
      const activeColony = colonyRef.current;
      const activeSettings = settingsRef.current;
      if (!activeColony || isPaused) return;

      // 1. Map ants to telemetry records
      const timestamp = new Date().toISOString();
      const telemetryRecords = activeColony.ants.map(ant => ({
        eventId: `evt-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
        antId: ant.id,
        slot: activeColony.currentSlot,
        blockhash: activeColony.currentHash,
        x: ant.pos.x,
        y: ant.pos.y,
        action: ant.state,
        energy: ant.energy,
        carriedItem: ant.carriedItem,
        timestamp
      }));

      // 2. Transmit batch to Snowflake API
      try {
        const headers: any = { 'Content-Type': 'application/json' };
        if (!activeSettings.useMock) {
          headers['x-snowflake-account'] = activeSettings.snowflakeAccount;
          headers['x-snowflake-username'] = activeSettings.snowflakeUser;
          headers['x-snowflake-password'] = activeSettings.snowflakePass;
          headers['x-snowflake-database'] = activeSettings.snowflakeDb;
          headers['x-snowflake-schema'] = activeSettings.snowflakeSchema;
          headers['x-snowflake-warehouse'] = activeSettings.snowflakeWarehouse;
        }

        await fetch('/api/telemetry', {
          method: 'POST',
          headers,
          body: JSON.stringify({
            type: 'telemetry',
            telemetry: telemetryRecords
          })
        });

      } catch (err) {
        console.error('Failed flushing telemetry batch:', err);
      }
    };

    // Batch upload every 5 seconds
    const telemetryInterval = setInterval(flushTelemetry, 5000);
    return () => clearInterval(telemetryInterval);
  }, [isPaused]);

  // Adjust simulation speed multiplier inside the colony
  useEffect(() => {
    if (colonyRef.current) {
      // Modify base speed variables of ants by setting local speed modifier
      for (const ant of colonyRef.current.ants) {
        ant.speedModifier = simSpeed;
      }
    }
  }, [simSpeed, hudTick]);

  const handleSettingsSave = (newSettings: Settings) => {
    setSettings(newSettings);
    settingsRef.current = newSettings;
    
    // Re-initialize tables if changing to Snowflake
    if (!newSettings.useMock && newSettings.snowflakeAccount) {
      fetch('/api/telemetry', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-snowflake-account': newSettings.snowflakeAccount,
          'x-snowflake-username': newSettings.snowflakeUser,
          'x-snowflake-password': newSettings.snowflakePass,
          'x-snowflake-database': newSettings.snowflakeDb,
          'x-snowflake-schema': newSettings.snowflakeSchema,
          'x-snowflake-warehouse': newSettings.snowflakeWarehouse,
        },
        body: JSON.stringify({ type: 'init' })
      }).catch(err => console.error('Error re-initializing Snowflake tables:', err));
    }
  };

  const handleWhisper = (antId: string, whisperText: string) => {
    if (colonyRef.current) {
      colonyRef.current.whisperToAnt(antId, whisperText);
      // Log event locally to trigger state re-render
      setHudTick(prev => prev + 1);
    }
  };

  const handleResetColony = () => {
    if (confirm('Are you sure you want to flood the tunnels and reset the colony?')) {
      const col = new Colony(800, 500);
      colonyRef.current = col;
      setColony(col);
      setSelectedAnt(null);
      col.logLore('RESET', 'The colony has been wiped clean. New generation spawned.');
    }
  };

  // Get current active parameters from colony ref for rendering
  const activeHash = colonyRef.current?.currentHash || '00000000';
  const activeSlot = colonyRef.current?.currentSlot || 0;
  const activeWind = colonyRef.current?.wind || new Vector2D(0, 0);
  const activeMutation = colonyRef.current?.mutationSpeed || 1.0;
  const activeLore = colonyRef.current?.lore || [];
  const activeFoodStock = colonyRef.current?.foodCollected || 0;

  return (
    <div className={styles.container}>
      {/* Top Header Controls */}
      <header className={`${styles.header} glass-panel`}>
        <div className={styles.logoContainer}>
          <span className={styles.logoText}>AI ANTFARM</span>
          <span className={styles.logoSub}>v1.1.0-SOLANA</span>
        </div>

        <div className={styles.controls}>
          <button 
            className="cyber-btn" 
            onClick={() => setIsPaused(!isPaused)}
            style={{ borderColor: isPaused ? 'var(--neon-gold)' : 'var(--neon-cyan)' }}
          >
            {isPaused ? '▶ RESUME SIM' : '⏸ PAUSE SIM'}
          </button>
          
          <button className="cyber-btn magenta" onClick={handleResetColony}>
            ☄️ RESET COLONY
          </button>

          <div className={styles.speedControls}>
            <span>TIME DILATION:</span>
            <input 
              type="range" 
              className={styles.speedSlider} 
              min="0.2" 
              max="3.0" 
              step="0.1" 
              value={simSpeed}
              onChange={(e) => setSimSpeed(parseFloat(e.target.value))}
            />
            <span style={{ minWidth: '35px' }}>{simSpeed.toFixed(1)}x</span>
          </div>

          <div className={styles.speedControls} style={{ borderLeft: '1px solid var(--border-color)', paddingLeft: '16px' }}>
            <span>FOOD STOCK: <strong className="glow-gold" style={{ color: 'var(--neon-gold)' }}>{activeFoodStock}mg</strong></span>
          </div>

          <button className="cyber-btn gold" onClick={() => setIsSettingsOpen(true)}>
            ⚙️ SYSTEMS CONFIG
          </button>
        </div>
      </header>

      {/* Main Dashboard Layout */}
      {colony && (
        <main className={styles.mainLayout}>
          {/* Left Column: Solana Stats & Lore Chronicle */}
          <div className={styles.leftSidebar}>
            <div className={styles.solanaFeedSection}>
              <SolanaFeed 
                currentHash={activeHash} 
                currentSlot={activeSlot} 
                wind={activeWind} 
                mutationSpeed={activeMutation} 
                source={solanaSource}
              />
            </div>
            <div className={styles.loreBookSection}>
              <LoreBook events={activeLore} />
            </div>
          </div>

          {/* Center Column: Simulation Viewport */}
          <div className={styles.canvasContainer}>
            <div className={`${styles.canvasToolbar} glass-panel`} style={{ borderBottom: 'none', borderBottomLeftRadius: 0, borderBottomRightRadius: 0 }}>
              <div className={styles.toolGroup}>
                <button 
                  className={`${styles.toolBtn} ${styles.select} ${activeTool === 'select' ? styles.active : ''}`}
                  onClick={() => setActiveTool('select')}
                >
                  👁️ SELECT / ABDUCT
                </button>
                <button 
                  className={`${styles.toolBtn} ${styles.sugar} ${activeTool === 'sugar' ? styles.active : ''}`}
                  onClick={() => setActiveTool('sugar')}
                >
                  🍯 SPAWN SUGAR
                </button>
                <button 
                  className={`${styles.toolBtn} ${styles.water} ${activeTool === 'water' ? styles.active : ''}`}
                  onClick={() => setActiveTool('water')}
                >
                  💧 DEPOSIT WATER
                </button>
              </div>
              <span className={styles.instructions}>
                ENVIRONMENTAL SIMULATION VIEWPORT - 60 FPS
              </span>
            </div>
            <SimulationCanvas 
              colony={colony} 
              activeTool={activeTool} 
              selectedAnt={selectedAnt} 
              onSelectAnt={setSelectedAnt}
              isPaused={isPaused}
            />
          </div>

          {/* Right Column: Ant Inspector sidebar */}
          <div className={styles.rightSidebar}>
            <AntInspector 
              ant={selectedAnt} 
              currentHash={activeHash}
              currentSlot={activeSlot}
              onWhisper={handleWhisper}
              geminiKey={settings.geminiKey}
              elevenKey={settings.elevenKey}
              elevenVoice={settings.elevenVoice}
            />
          </div>
        </main>
      )}

      {/* Settings Modal */}
      <SettingsModal 
        isOpen={isSettingsOpen} 
        onClose={() => setIsSettingsOpen(false)} 
        onSave={handleSettingsSave} 
      />
    </div>
  );
}
