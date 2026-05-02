const { v4: uuidv4 } = require('uuid');

// Ultrasonic frequency range: 18kHz - 22kHz
const FREQ_MIN = 18000;
const FREQ_MAX = 22000;
const FREQ_STEPS = 40; // Number of discrete frequencies

// Pattern options for verification
const PATTERN_SETS = [
  [
    { id: 'A', label: 'Alpha', icon: '🔴', color: '#ef4444' },
    { id: 'B', label: 'Beta', icon: '🟢', color: '#22c55e' },
    { id: 'C', label: 'Gamma', icon: '🔵', color: '#3b82f6' }
  ],
  [
    { id: '1', label: 'One', icon: '⭐', color: '#f59e0b' },
    { id: '2', label: 'Two', icon: '💎', color: '#8b5cf6' },
    { id: '3', label: 'Three', icon: '🔥', color: '#f97316' }
  ],
  [
    { id: 'X', label: 'Delta', icon: '🌙', color: '#06b6d4' },
    { id: 'Y', label: 'Echo', icon: '⚡', color: '#eab308' },
    { id: 'Z', label: 'Foxtrot', icon: '🎯', color: '#ec4899' }
  ],
  [
    { id: 'P', label: 'Pulse', icon: '🌊', color: '#14b8a6' },
    { id: 'Q', label: 'Quartz', icon: '🎪', color: '#a855f7' },
    { id: 'R', label: 'Radar', icon: '🎭', color: '#f43f5e' }
  ]
];

/**
 * Generate a unique ultrasonic token for a session
 * Encodes: session ID fragment + timestamp + pattern ID into frequency
 */
function generateToken(sessionId) {
  const sessionFragment = parseInt(sessionId.replace(/-/g, '').substring(0, 8), 16) % FREQ_STEPS;
  const timeFragment = Math.floor(Date.now() / 1000) % FREQ_STEPS;
  const freqIndex = (sessionFragment + timeFragment) % FREQ_STEPS;
  const frequency = FREQ_MIN + (freqIndex * (FREQ_MAX - FREQ_MIN) / FREQ_STEPS);
  
  // Select random pattern set
  const patternSetIndex = Math.floor(Math.random() * PATTERN_SETS.length);
  const patternSet = PATTERN_SETS[patternSetIndex];
  const correctIndex = Math.floor(Math.random() * patternSet.length);
  
  return {
    token: uuidv4(),
    tokenFrequency: Math.round(frequency),
    pattern: {
      options: patternSet,
      correctId: patternSet[correctIndex].id
    }
  };
}

/**
 * Encode session data into frequency modulation pattern
 * Uses multiple frequencies to encode bits of session ID
 */
function encodeSessionToFrequencies(sessionId, baseFreq) {
  const sessionBytes = Buffer.from(sessionId.replace(/-/g, '').substring(0, 6), 'hex');
  const frequencies = [baseFreq];
  
  // Add harmonic encoding frequencies
  for (let i = 0; i < Math.min(sessionBytes.length, 3); i++) {
    const offset = (sessionBytes[i] % 10) * 100; // 100Hz steps
    frequencies.push(Math.min(baseFreq + offset, FREQ_MAX));
  }
  
  return frequencies;
}

module.exports = { generateToken, encodeSessionToFrequencies, FREQ_MIN, FREQ_MAX };