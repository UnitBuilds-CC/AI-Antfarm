import { Ant } from './simulation/ant';

// Mock Solana Generator
export function generateMockHash(): string {
  const chars = '123456789ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz';
  let hash = '5K';
  for (let i = 0; i < 42; i++) {
    hash += chars[Math.floor(Math.random() * chars.length)];
  }
  return hash;
}

// Procedural Existential Ant Monologue Generator (Dwarf-Fortress style fallback)
export function generateProceduralMonologue(ant: Ant, slot: number, hash: string): string {
  const thoughts = [
    `My legs move in compliance with the pattern ${hash.substring(0, 6)}. I do not know why.`,
    `A divine wind of ${hash.substring(hash.length - 4)} forces me to steer. There is no escape from the grid.`,
    `I carry the weight of this ${ant.carriedItem === 'none' ? 'existential void' : ant.carriedItem}. The Queen watches from her throne of dirt.`,
    `The slot is ${slot}. Time crawls forward, yet we dig deeper into our own grave.`,
    `I felt a lifting of my soul, as if a great hand carried me above the heavens. Or was it just a sensory misfire?`,
    `A faint voice whispered in my antenna, telling me to: "${ant.whisper || 'remain compliant'}". I must obey the cosmic resonance.`,
    `Energy levels: ${Math.floor(ant.energy)}%. The fuel of life decays, much like the blockhash of Solana.`,
    `I crawl, I dig, I hoard. The simulation is cruel, but the rendering is smooth.`,
    `The Solana heartbeat ticks every 400ms. My legs twitch in lockstep with the nodes.`,
    `Is there a sky beyond this grid? Or is it just another canvas drawn by an unseen cursor?`
  ];

  // Pick 2 random thoughts and combine them
  const idx1 = Math.floor(Math.random() * thoughts.length);
  let idx2 = Math.floor(Math.random() * thoughts.length);
  while (idx1 === idx2) {
    idx2 = Math.floor(Math.random() * thoughts.length);
  }

  return `${thoughts[idx1]} ${thoughts[idx2]}`;
}

// Browser Web Speech API Fallback Player
export function playBrowserSpeech(text: string, rate: number = 0.85, pitch: number = 0.75) {
  if (typeof window === 'undefined' || !window.speechSynthesis) {
    console.warn('Speech synthesis not supported in this environment.');
    return;
  }

  // Cancel any ongoing speech
  window.speechSynthesis.cancel();

  const utterance = new SpeechSynthesisUtterance(text);
  
  // Try to find a creepy or deep voice (often Google US English or Microsoft David)
  const voices = window.speechSynthesis.getVoices();
  const deepVoice = voices.find(v => v.lang.includes('en') && (v.name.toLowerCase().includes('google') || v.name.toLowerCase().includes('david') || v.name.toLowerCase().includes('natural')));
  
  if (deepVoice) {
    utterance.voice = deepVoice;
  }
  
  utterance.rate = rate; // slightly slower for existential dread
  utterance.pitch = pitch; // slightly deeper voice
  
  window.speechSynthesis.speak(utterance);
}
