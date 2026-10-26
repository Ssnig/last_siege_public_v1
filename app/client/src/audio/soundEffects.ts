/**
 * Procedural Web Audio API sound synthesizer.
 * Provides instant sound effects for UI actions without requiring external audio files.
 */

class SoundEffectsManager {
  private noiseBuffer: AudioBuffer | null = null;
  private lastSoundTimes: Map<string, number> = new Map();
  private audioFileCache: Map<string, HTMLAudioElement | null> = new Map();

  private ctx: AudioContext | null = null;
  private volume: number = 0.7;
  private isMuted: boolean = false;

  constructor() {
    if (typeof window !== 'undefined') {
      try {
        const savedVolume = localStorage.getItem('game-volume');
        if (savedVolume !== null) {
          this.volume = parseFloat(savedVolume);
        }
        this.isMuted = localStorage.getItem('game-muted') === 'true';
      } catch {
        // Fallback to default volume if localStorage is restricted
      }
      this.preloadTowerSounds();
      this.preloadUnitSounds();
    }
  }

  private getAudioContext(): AudioContext | null {
    if (typeof window === 'undefined') return null;
    if (this.ctx && this.ctx.state === 'closed') {
      this.ctx = null;
    }
    if (!this.ctx) {
      try {
        const AudioCtx = window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
        if (AudioCtx) {
          this.ctx = new AudioCtx();
        }
      } catch {}
    }
    if (this.ctx && this.ctx.state === 'suspended') {
      try {
        this.ctx.resume().catch(() => {});
      } catch {}
    }
    return this.ctx;
  }

  public getVolume(): number {
    return this.volume;
  }

  public setVolume(vol: number): void {
    this.volume = Math.max(0, Math.min(1, vol));
    if (typeof window !== 'undefined') {
      try {
        localStorage.setItem('game-volume', this.volume.toString());
      } catch {}
    }
  }

  public getMuted(): boolean {
    return this.isMuted;
  }

  public setMuted(muted: boolean): void {
    this.isMuted = muted;
    if (typeof window !== 'undefined') {
      try {
        localStorage.setItem('game-muted', muted ? 'true' : 'false');
      } catch {}
    }
  }

  /** Short high-tech/8-bit hover tick */
  public playHover(): void {
    if (this.isMuted || this.volume <= 0) return;
    const ctx = this.getAudioContext();
    if (!ctx) return;

    try {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();

      osc.type = 'triangle';
      osc.frequency.setValueAtTime(520, ctx.currentTime);
      osc.frequency.exponentialRampToValueAtTime(780, ctx.currentTime + 0.04);

      const effectiveGain = this.volume * 0.15;
      gain.gain.setValueAtTime(effectiveGain, ctx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.05);

      osc.connect(gain);
      gain.connect(ctx.destination);

      osc.start();
      osc.stop(ctx.currentTime + 0.05);
    } catch {
      // Audio context might be restricted before user gesture
    }
  }

  /** Deep cinematic drum / battle strike */
  public playClick(): void {
    if (this.isMuted || this.volume <= 0) return;
    const ctx = this.getAudioContext();
    if (!ctx) return;

    try {
      // Low punch oscillator
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();

      osc.type = 'sine';
      osc.frequency.setValueAtTime(160, ctx.currentTime);
      osc.frequency.exponentialRampToValueAtTime(40, ctx.currentTime + 0.25);

      const effectiveGain = this.volume * 0.4;
      gain.gain.setValueAtTime(effectiveGain, ctx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.28);

      osc.connect(gain);
      gain.connect(ctx.destination);

      osc.start();
      osc.stop(ctx.currentTime + 0.28);

      // Metallic high gong accent
      const gongOsc = ctx.createOscillator();
      const gongGain = ctx.createGain();

      gongOsc.type = 'triangle';
      gongOsc.frequency.setValueAtTime(440, ctx.currentTime);
      gongOsc.frequency.exponentialRampToValueAtTime(320, ctx.currentTime + 0.35);

      gongGain.gain.setValueAtTime(effectiveGain * 0.5, ctx.currentTime);
      gongGain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.35);

      gongOsc.connect(gongGain);
      gongGain.connect(ctx.destination);

      gongOsc.start();
      gongOsc.stop(ctx.currentTime + 0.35);
    } catch {
      // Silently catch
    }
  }

  /** Soft modal transition sound */
  public playModal(): void {
    if (this.isMuted || this.volume <= 0) return;
    const ctx = this.getAudioContext();
    if (!ctx) return;

    try {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();

      osc.type = 'sine';
      osc.frequency.setValueAtTime(280, ctx.currentTime);
      osc.frequency.exponentialRampToValueAtTime(480, ctx.currentTime + 0.12);

      const effectiveGain = this.volume * 0.2;
      gain.gain.setValueAtTime(effectiveGain, ctx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.15);

      osc.connect(gain);
      gain.connect(ctx.destination);

      osc.start();
      osc.stop(ctx.currentTime + 0.15);
    } catch {
      // Silently catch
    }
  }

  /**
   * Resonant Burmese war drum (Sidaw / Pat-ma) strike.
   * - 'light': Snappy skin strike for countdown ticks.
   * - 'heavy': Deep reverberant war drum thud for final countdown seconds.
   * - 'battleStart': Double-strike flam + ceremonial gong ringing in battle.
   */
  public playWarDrum(intensity: 'light' | 'heavy' | 'battleStart' = 'heavy'): void {
    if (this.isMuted || this.volume <= 0) return;
    const ctx = this.getAudioContext();
    if (!ctx) return;

    try {
      const now = ctx.currentTime;
      const vol = this.volume;

      const triggerDrumHit = (time: number, isSubHeavy: boolean, peakGain: number) => {
        // 1. Drum skin impact snap (pitch transient)
        const snapOsc = ctx.createOscillator();
        const snapGain = ctx.createGain();
        snapOsc.type = 'triangle';
        snapOsc.frequency.setValueAtTime(isSubHeavy ? 240 : 320, time);
        snapOsc.frequency.exponentialRampToValueAtTime(60, time + 0.06);

        snapGain.gain.setValueAtTime(peakGain * 0.7, time);
        snapGain.gain.exponentialRampToValueAtTime(0.001, time + 0.08);

        snapOsc.connect(snapGain);
        snapGain.connect(ctx.destination);
        snapOsc.start(time);
        snapOsc.stop(time + 0.08);

        // 2. Deep body resonance (low sine drop)
        const bodyOsc = ctx.createOscillator();
        const bodyGain = ctx.createGain();
        bodyOsc.type = 'sine';
        bodyOsc.frequency.setValueAtTime(isSubHeavy ? 110 : 150, time);
        bodyOsc.frequency.exponentialRampToValueAtTime(isSubHeavy ? 38 : 50, time + (isSubHeavy ? 0.35 : 0.2));

        const bodyDuration = isSubHeavy ? 0.38 : 0.22;
        bodyGain.gain.setValueAtTime(peakGain, time);
        bodyGain.gain.exponentialRampToValueAtTime(0.001, time + bodyDuration);

        bodyOsc.connect(bodyGain);
        bodyGain.connect(ctx.destination);
        bodyOsc.start(time);
        bodyOsc.stop(time + bodyDuration);
      };

      if (intensity === 'light') {
        triggerDrumHit(now, false, vol * 0.3);
      } else if (intensity === 'heavy') {
        triggerDrumHit(now, true, vol * 0.55);
      } else if (intensity === 'battleStart') {
        // Flam strike: quick grace hit followed by massive war drum boom + gong
        triggerDrumHit(now, false, vol * 0.35);
        triggerDrumHit(now + 0.12, true, vol * 0.7);

        // Ceremonial brass gong strike
        const gongFrequencies = [280, 420, 680, 940];
        gongFrequencies.forEach((freq, idx) => {
          const gongOsc = ctx.createOscillator();
          const gongGain = ctx.createGain();
          gongOsc.type = idx % 2 === 0 ? 'sine' : 'triangle';
          gongOsc.frequency.setValueAtTime(freq, now + 0.14);

          const gongDecay = 1.4 - idx * 0.2;
          const gongAmp = vol * (0.25 / (idx + 1));
          gongGain.gain.setValueAtTime(gongAmp, now + 0.14);
          gongGain.gain.exponentialRampToValueAtTime(0.0001, now + 0.14 + gongDecay);

          gongOsc.connect(gongGain);
          gongGain.connect(ctx.destination);
          gongOsc.start(now + 0.14);
          gongOsc.stop(now + 0.14 + gongDecay);
        });
      }
    } catch {
      // Silently catch
    }
  }

  /**
   * Triumphant Konbaung Royal Brass Fanfare & Ceremonial Gong
   */
  public playVictory(): void {
    if (this.isMuted || this.volume <= 0) return;
    const ctx = this.getAudioContext();
    if (!ctx) return;

    try {
      const now = ctx.currentTime;
      const vol = this.volume;

      // Regal Brass Fanfare Notes: D4 -> F#4 -> A4 -> D5 (held with vibrato)
      const fanfareNotes = [
        { freq: 293.66, start: 0.0, dur: 0.16 }, // D4
        { freq: 369.99, start: 0.18, dur: 0.16 }, // F#4
        { freq: 440.00, start: 0.36, dur: 0.22 }, // A4
        { freq: 587.33, start: 0.60, dur: 0.95 }, // D5 (high triumphant finale)
        { freq: 440.00, start: 0.60, dur: 0.95 }, // A4 harmony chord
        { freq: 293.66, start: 0.60, dur: 0.95 }, // D4 foundation bass
      ];

      fanfareNotes.forEach((note) => {
        const noteStart = now + note.start;
        const noteEnd = noteStart + note.dur;

        const osc = ctx.createOscillator();
        const filter = ctx.createBiquadFilter();
        const gain = ctx.createGain();

        osc.type = 'sawtooth';
        osc.frequency.setValueAtTime(note.freq, noteStart);

        // Warm brass filter envelope
        filter.type = 'lowpass';
        filter.frequency.setValueAtTime(1200, noteStart);
        filter.frequency.exponentialRampToValueAtTime(2600, noteStart + 0.08);
        filter.frequency.exponentialRampToValueAtTime(800, noteEnd);

        // Note amplitude ADSR
        gain.gain.setValueAtTime(0.001, noteStart);
        gain.gain.linearRampToValueAtTime(vol * 0.28, noteStart + 0.04);
        gain.gain.exponentialRampToValueAtTime(0.001, noteEnd);

        osc.connect(filter);
        filter.connect(gain);
        gain.connect(ctx.destination);

        osc.start(noteStart);
        osc.stop(noteEnd);
      });

      // Royal Kyay-si Bronze Gong (shimmering metallic celebration)
      const gongStart = now + 0.60;
      const gongFrequencies = [311.13, 466.16, 622.25, 932.33, 1244.5];
      gongFrequencies.forEach((freq, idx) => {
        const gongOsc = ctx.createOscillator();
        const gongGain = ctx.createGain();

        gongOsc.type = idx % 2 === 0 ? 'sine' : 'triangle';
        gongOsc.frequency.setValueAtTime(freq, gongStart);
        gongOsc.detune.setValueAtTime(idx * 7 - 14, gongStart);

        const decay = 2.2 - idx * 0.25;
        gongGain.gain.setValueAtTime(vol * (0.22 / (idx + 1)), gongStart);
        gongGain.gain.exponentialRampToValueAtTime(0.0001, gongStart + decay);

        gongOsc.connect(gongGain);
        gongGain.connect(ctx.destination);
        gongOsc.start(gongStart);
        gongOsc.stop(gongStart + decay);
      });
    } catch {
      // Silently catch
    }
  }

  /**
   * Somber Defeat Dirge + Sub-bass Citadel Fall Rumble
   */
  public playDefeat(): void {
    if (this.isMuted || this.volume <= 0) return;
    const ctx = this.getAudioContext();
    if (!ctx) return;

    try {
      const now = ctx.currentTime;
      const vol = this.volume;

      // Somber descending minor dirge: A3 -> F3 -> D3 -> Low C#3
      const dirgeNotes = [
        { freq: 220.00, start: 0.0, dur: 0.35 }, // A3
        { freq: 174.61, start: 0.38, dur: 0.35 }, // F3
        { freq: 146.83, start: 0.76, dur: 0.45 }, // D3
        { freq: 138.59, start: 1.25, dur: 1.20 }, // C#3
        { freq: 69.30, start: 1.25, dur: 1.20 }, // Sub C#2 bass
      ];

      dirgeNotes.forEach((note) => {
        const noteStart = now + note.start;
        const noteEnd = noteStart + note.dur;

        const osc = ctx.createOscillator();
        const filter = ctx.createBiquadFilter();
        const gain = ctx.createGain();

        osc.type = 'sawtooth';
        osc.frequency.setValueAtTime(note.freq, noteStart);

        filter.type = 'lowpass';
        filter.frequency.setValueAtTime(600, noteStart);
        filter.frequency.exponentialRampToValueAtTime(300, noteEnd);

        gain.gain.setValueAtTime(0.001, noteStart);
        gain.gain.linearRampToValueAtTime(vol * 0.26, noteStart + 0.06);
        gain.gain.exponentialRampToValueAtTime(0.0001, noteEnd);

        osc.connect(filter);
        filter.connect(gain);
        gain.connect(ctx.destination);

        osc.start(noteStart);
        osc.stop(noteEnd);
      });

      // Sub-bass citadel collapse rumble
      const rumbleOsc = ctx.createOscillator();
      const rumbleGain = ctx.createGain();
      rumbleOsc.type = 'sine';
      rumbleOsc.frequency.setValueAtTime(85, now + 0.2);
      rumbleOsc.frequency.exponentialRampToValueAtTime(28, now + 1.8);

      rumbleGain.gain.setValueAtTime(vol * 0.45, now + 0.2);
      rumbleGain.gain.exponentialRampToValueAtTime(0.0001, now + 2.0);

      rumbleOsc.connect(rumbleGain);
      rumbleGain.connect(ctx.destination);
      rumbleOsc.start(now + 0.2);
      rumbleOsc.stop(now + 2.0);
    } catch {
      // Silently catch
    }
  }

  // ============================================================================
  // TOWER SHOOTING & IMPACT AUDIO SUBSYSTEM
  // ============================================================================

  private getNoiseBuffer(ctx: AudioContext): AudioBuffer {
    if (!this.noiseBuffer || this.noiseBuffer.sampleRate !== ctx.sampleRate) {
      const size = Math.floor(ctx.sampleRate * 1.0);
      const buffer = ctx.createBuffer(1, size, ctx.sampleRate);
      const data = buffer.getChannelData(0);
      for (let i = 0; i < size; i++) {
        data[i] = Math.random() * 2 - 1;
      }
      this.noiseBuffer = buffer;
    }
    return this.noiseBuffer;
  }

  private getPitchMultiplier(): number {
    return 0.94 + Math.random() * 0.12;
  }

  private throttle(key: string, minIntervalMs: number = 35): boolean {
    const now = typeof performance !== 'undefined' ? performance.now() : Date.now();
    const last = this.lastSoundTimes.get(key) || 0;
    if (now - last < minIntervalMs) return false;
    this.lastSoundTimes.set(key, now);
    return true;
  }

  private normalizeTowerId(id: string): string {
    const lower = (id || '').toLowerCase().trim();
    if (lower === 'basic') return 'archer';
    if (lower === 'pitchfork') return 'spear';
    return lower;
  }

  public preloadTowerSounds(): void {
    if (typeof window === 'undefined') return;
    const towerIds = [
      'archer', 'cannon', 'bomb', 'bell', 'spear',
      'gun', 'water_cannon', 'chinthe', 'dragon', 'sein_pyaung'
    ];
    for (const id of towerIds) {
      for (const kind of ['shoot', 'impact'] as const) {
        const path = `/assets/sfx/towers/${id}_${kind}.wav`;
        if (!this.audioFileCache.has(path)) {
          const audio = new Audio(path);
          audio.preload = 'auto';
          this.audioFileCache.set(path, audio);
        }
      }
    }
  }

  private tryPlayAudioFile(filename: string): boolean {
    if (typeof window === 'undefined') return false;
    const path = `/assets/sfx/towers/${filename}`;
    let cached = this.audioFileCache.get(path);
    if (cached === undefined) {
      const audio = new Audio(path);
      audio.volume = this.volume;
      audio.preload = 'auto';
      this.audioFileCache.set(path, audio);
      cached = audio;
    }
    if (cached) {
      if (!isNaN(cached.duration) && cached.duration > 0) {
        try {
          const clone = cached.cloneNode() as HTMLAudioElement;
          clone.volume = this.volume;
          clone.play().catch(() => {});
          return true;
        } catch {
          return false;
        }
      } else {
        try {
          cached.currentTime = 0;
          cached.volume = this.volume;
          cached.play().catch(() => {});
          return true;
        } catch {
          return false;
        }
      }
    }
    return false;
  }

  /**
   * Play shooting sound for any of the 10 towers.
   */

  /**
   * Clears the audio file cache so newly uploaded or deleted files are reloaded.
   */
  public reloadSoundCache(): void {
    this.audioFileCache.clear();
    this.preloadTowerSounds();
  }

  /**
   * Checks whether a custom audio file is currently available for a tower sound.
   */
  public isCustomAudio(towerId: string, soundType: 'shoot' | 'impact'): boolean {
    const norm = this.normalizeTowerId(towerId);
    const wav = `/assets/sfx/towers/${norm}_${soundType}.wav`;
    const mp3 = `/assets/sfx/towers/${norm}_${soundType}.mp3`;
    const a = this.audioFileCache.get(wav) || this.audioFileCache.get(mp3);
    if (!a) return false;
    if (a.error) return false;
    return true;
  }

  /**
   * Audition helper for Sound Editor: plays shoot sound with optional custom pitch, bypassing throttle.
   */
  public playTowerShootAudition(towerId: string, customPitch?: number): void {
    if (this.isMuted || this.volume <= 0) return;
    const norm = this.normalizeTowerId(towerId);

    if (this.tryPlayAudioFile(`${norm}_shoot.mp3`) || this.tryPlayAudioFile(`${norm}_shoot.wav`)) {
      return;
    }

    const ctx = this.getAudioContext();
    if (!ctx) return;

    try {
      const now = ctx.currentTime;
      const vol = this.volume;
      const pitch = customPitch !== undefined ? customPitch : this.getPitchMultiplier();

      switch (norm) {
        case 'archer': this.synthArcherShoot(ctx, now, vol, pitch); break;
        case 'cannon': this.synthCannonShoot(ctx, now, vol, pitch); break;
        case 'bomb': this.synthBombShoot(ctx, now, vol, pitch); break;
        case 'bell': this.synthBellShoot(ctx, now, vol, pitch); break;
        case 'spear': this.synthSpearShoot(ctx, now, vol, pitch); break;
        case 'gun': this.synthGunShoot(ctx, now, vol, pitch); break;
        case 'water_cannon': this.synthWaterCannonShoot(ctx, now, vol, pitch); break;
        case 'chinthe': this.synthChintheShoot(ctx, now, vol, pitch); break;
        case 'dragon': this.synthDragonShoot(ctx, now, vol, pitch); break;
        case 'sein_pyaung': this.synthSeinPyaungShoot(ctx, now, vol, pitch); break;
        default: this.synthArcherShoot(ctx, now, vol, pitch); break;
      }
    } catch {}
  }

  /**
   * Audition helper for Sound Editor: plays impact sound with optional custom pitch, bypassing throttle.
   */
  public playTowerImpactAudition(towerId: string, customPitch?: number): void {
    if (this.isMuted || this.volume <= 0) return;
    const norm = this.normalizeTowerId(towerId);

    if (this.tryPlayAudioFile(`${norm}_impact.mp3`) || this.tryPlayAudioFile(`${norm}_impact.wav`)) {
      return;
    }

    const ctx = this.getAudioContext();
    if (!ctx) return;

    try {
      const now = ctx.currentTime;
      const vol = this.volume;
      const pitch = customPitch !== undefined ? customPitch : this.getPitchMultiplier();

      switch (norm) {
        case 'archer': this.synthArcherImpact(ctx, now, vol, pitch); break;
        case 'cannon': this.synthCannonImpact(ctx, now, vol, pitch); break;
        case 'bomb': this.synthBombImpact(ctx, now, vol, pitch); break;
        case 'bell': this.synthBellImpact(ctx, now, vol, pitch); break;
        case 'spear': this.synthSpearImpact(ctx, now, vol, pitch); break;
        case 'gun': this.synthGunImpact(ctx, now, vol, pitch); break;
        case 'water_cannon': this.synthWaterCannonImpact(ctx, now, vol, pitch); break;
        case 'chinthe': this.synthChintheImpact(ctx, now, vol, pitch); break;
        case 'dragon': this.synthDragonImpact(ctx, now, vol, pitch); break;
        case 'sein_pyaung': this.synthSeinPyaungImpact(ctx, now, vol, pitch); break;
        default: this.synthArcherImpact(ctx, now, vol, pitch); break;
      }
    } catch {}
  }

  public playTowerShoot(towerId: string): void {
    if (this.isMuted || this.volume <= 0) return;
    const norm = this.normalizeTowerId(towerId);
    if (!this.throttle(`shoot_${norm}`, 30)) return;

    // Check for drop-in audio files first
    if (this.tryPlayAudioFile(`${norm}_shoot.mp3`) || this.tryPlayAudioFile(`${norm}_shoot.wav`)) {
      return;
    }

    const ctx = this.getAudioContext();
    if (!ctx) return;

    try {
      const now = ctx.currentTime;
      const vol = this.volume;
      const pitch = this.getPitchMultiplier();

      switch (norm) {
        case 'archer':
          this.synthArcherShoot(ctx, now, vol, pitch);
          break;
        case 'cannon':
          this.synthCannonShoot(ctx, now, vol, pitch);
          break;
        case 'bomb':
          this.synthBombShoot(ctx, now, vol, pitch);
          break;
        case 'bell':
          this.synthBellShoot(ctx, now, vol, pitch);
          break;
        case 'spear':
          this.synthSpearShoot(ctx, now, vol, pitch);
          break;
        case 'gun':
          this.synthGunShoot(ctx, now, vol, pitch);
          break;
        case 'water_cannon':
          this.synthWaterCannonShoot(ctx, now, vol, pitch);
          break;
        case 'chinthe':
          this.synthChintheShoot(ctx, now, vol, pitch);
          break;
        case 'dragon':
          this.synthDragonShoot(ctx, now, vol, pitch);
          break;
        case 'sein_pyaung':
          this.synthSeinPyaungShoot(ctx, now, vol, pitch);
          break;
        default:
          this.synthArcherShoot(ctx, now, vol, pitch);
          break;
      }
    } catch {
      // Silently catch
    }
  }

  /**
   * Play impact sound for any of the 10 towers.
   */
  public playTowerImpact(towerId: string): void {
    if (this.isMuted || this.volume <= 0) return;
    const norm = this.normalizeTowerId(towerId);
    if (!this.throttle(`impact_${norm}`, 30)) return;

    // Check for drop-in audio files first
    if (this.tryPlayAudioFile(`${norm}_impact.mp3`) || this.tryPlayAudioFile(`${norm}_impact.wav`)) {
      return;
    }

    const ctx = this.getAudioContext();
    if (!ctx) return;

    try {
      const now = ctx.currentTime;
      const vol = this.volume;
      const pitch = this.getPitchMultiplier();

      switch (norm) {
        case 'archer':
          this.synthArcherImpact(ctx, now, vol, pitch);
          break;
        case 'cannon':
          this.synthCannonImpact(ctx, now, vol, pitch);
          break;
        case 'bomb':
          this.synthBombImpact(ctx, now, vol, pitch);
          break;
        case 'bell':
          this.synthBellImpact(ctx, now, vol, pitch);
          break;
        case 'spear':
          this.synthSpearImpact(ctx, now, vol, pitch);
          break;
        case 'gun':
          this.synthGunImpact(ctx, now, vol, pitch);
          break;
        case 'water_cannon':
          this.synthWaterCannonImpact(ctx, now, vol, pitch);
          break;
        case 'chinthe':
          this.synthChintheImpact(ctx, now, vol, pitch);
          break;
        case 'dragon':
          this.synthDragonImpact(ctx, now, vol, pitch);
          break;
        case 'sein_pyaung':
          this.synthSeinPyaungImpact(ctx, now, vol, pitch);
          break;
        default:
          this.synthArcherImpact(ctx, now, vol, pitch);
          break;
      }
    } catch {
      // Silently catch
    }
  }

  // --- 1. ARCHER TOWER ---
  private synthArcherShoot(ctx: AudioContext, time: number, vol: number, pitch: number): void {
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = 'triangle';
    osc.frequency.setValueAtTime(560 * pitch, time);
    osc.frequency.exponentialRampToValueAtTime(180 * pitch, time + 0.08);

    gain.gain.setValueAtTime(vol * 0.22, time);
    gain.gain.exponentialRampToValueAtTime(0.001, time + 0.09);

    osc.connect(gain);
    gain.connect(ctx.destination);
    osc.start(time);
    osc.stop(time + 0.09);
  }

  private synthArcherImpact(ctx: AudioContext, time: number, vol: number, pitch: number): void {
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = 'sine';
    osc.frequency.setValueAtTime(680 * pitch, time);
    osc.frequency.exponentialRampToValueAtTime(110 * pitch, time + 0.06);

    gain.gain.setValueAtTime(vol * 0.25, time);
    gain.gain.exponentialRampToValueAtTime(0.001, time + 0.07);

    osc.connect(gain);
    gain.connect(ctx.destination);
    osc.start(time);
    osc.stop(time + 0.07);
  }

  // --- 2. CANNON TOWER ---
  private synthCannonShoot(ctx: AudioContext, time: number, vol: number, pitch: number): void {
    // 1. Heavy low punch
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = 'sine';
    osc.frequency.setValueAtTime(115 * pitch, time);
    osc.frequency.exponentialRampToValueAtTime(32 * pitch, time + 0.38);

    gain.gain.setValueAtTime(vol * 0.55, time);
    gain.gain.exponentialRampToValueAtTime(0.001, time + 0.40);

    osc.connect(gain);
    gain.connect(ctx.destination);
    osc.start(time);
    osc.stop(time + 0.40);

    // 2. Gunpowder explosion blast noise
    const noise = ctx.createBufferSource();
    noise.buffer = this.getNoiseBuffer(ctx);
    const filter = ctx.createBiquadFilter();
    filter.type = 'lowpass';
    filter.frequency.setValueAtTime(850, time);
    filter.frequency.exponentialRampToValueAtTime(180, time + 0.25);

    const noiseGain = ctx.createGain();
    noiseGain.gain.setValueAtTime(vol * 0.35, time);
    noiseGain.gain.exponentialRampToValueAtTime(0.001, time + 0.28);

    noise.connect(filter);
    filter.connect(noiseGain);
    noiseGain.connect(ctx.destination);
    noise.start(time);
    noise.stop(time + 0.28);
  }

  private synthCannonImpact(ctx: AudioContext, time: number, vol: number, pitch: number): void {
    // Ground shockwave thud
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = 'sine';
    osc.frequency.setValueAtTime(90 * pitch, time);
    osc.frequency.exponentialRampToValueAtTime(26 * pitch, time + 0.45);

    gain.gain.setValueAtTime(vol * 0.5, time);
    gain.gain.exponentialRampToValueAtTime(0.001, time + 0.48);

    osc.connect(gain);
    gain.connect(ctx.destination);
    osc.start(time);
    osc.stop(time + 0.48);

    // Earth crunch noise
    const noise = ctx.createBufferSource();
    noise.buffer = this.getNoiseBuffer(ctx);
    const filter = ctx.createBiquadFilter();
    filter.type = 'bandpass';
    filter.frequency.setValueAtTime(340, time);

    const noiseGain = ctx.createGain();
    noiseGain.gain.setValueAtTime(vol * 0.28, time);
    noiseGain.gain.exponentialRampToValueAtTime(0.001, time + 0.32);

    noise.connect(filter);
    filter.connect(noiseGain);
    noiseGain.connect(ctx.destination);
    noise.start(time);
    noise.stop(time + 0.32);
  }

  // --- 3. BOMB THROWING TOWER ---
  private synthBombShoot(ctx: AudioContext, time: number, vol: number, pitch: number): void {
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = 'triangle';
    osc.frequency.setValueAtTime(140 * pitch, time);
    osc.frequency.exponentialRampToValueAtTime(360 * pitch, time + 0.18);

    gain.gain.setValueAtTime(vol * 0.28, time);
    gain.gain.exponentialRampToValueAtTime(0.001, time + 0.20);

    osc.connect(gain);
    gain.connect(ctx.destination);
    osc.start(time);
    osc.stop(time + 0.20);
  }

  private synthBombImpact(ctx: AudioContext, time: number, vol: number, pitch: number): void {
    // Mortar shell detonation
    const noise = ctx.createBufferSource();
    noise.buffer = this.getNoiseBuffer(ctx);
    const filter = ctx.createBiquadFilter();
    filter.type = 'lowpass';
    filter.frequency.setValueAtTime(1400, time);
    filter.frequency.exponentialRampToValueAtTime(120, time + 0.45);

    const noiseGain = ctx.createGain();
    noiseGain.gain.setValueAtTime(vol * 0.48, time);
    noiseGain.gain.exponentialRampToValueAtTime(0.001, time + 0.48);

    noise.connect(filter);
    filter.connect(noiseGain);
    noiseGain.connect(ctx.destination);
    noise.start(time);
    noise.stop(time + 0.48);

    const sub = ctx.createOscillator();
    const subGain = ctx.createGain();
    sub.type = 'sine';
    sub.frequency.setValueAtTime(120 * pitch, time);
    sub.frequency.exponentialRampToValueAtTime(32 * pitch, time + 0.40);

    subGain.gain.setValueAtTime(vol * 0.42, time);
    subGain.gain.exponentialRampToValueAtTime(0.001, time + 0.42);

    sub.connect(subGain);
    subGain.connect(ctx.destination);
    sub.start(time);
    sub.stop(time + 0.42);
  }

  // --- 4. BELL TOWER ---
  private synthBellShoot(ctx: AudioContext, time: number, vol: number, pitch: number): void {
    // Resonant Burmese temple bronze bell chime
    const harmonics = [440 * pitch, 660 * pitch, 880 * pitch, 1320 * pitch];
    harmonics.forEach((freq, idx) => {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = idx % 2 === 0 ? 'sine' : 'triangle';
      osc.frequency.setValueAtTime(freq, time);

      const decay = 1.0 - idx * 0.15;
      gain.gain.setValueAtTime(vol * (0.24 / (idx + 1)), time);
      gain.gain.exponentialRampToValueAtTime(0.0001, time + decay);

      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.start(time);
      osc.stop(time + decay);
    });
  }

  private synthBellImpact(ctx: AudioContext, time: number, vol: number, pitch: number): void {
    // Sonic wave psychic distortion ring
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = 'sine';
    osc.frequency.setValueAtTime(380 * pitch, time);
    osc.frequency.exponentialRampToValueAtTime(260 * pitch, time + 0.35);

    gain.gain.setValueAtTime(vol * 0.22, time);
    gain.gain.exponentialRampToValueAtTime(0.001, time + 0.38);

    osc.connect(gain);
    gain.connect(ctx.destination);
    osc.start(time);
    osc.stop(time + 0.38);
  }

  // --- 5. SPEAR TOWER ---
  private synthSpearShoot(ctx: AudioContext, time: number, vol: number, pitch: number): void {
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = 'sawtooth';
    osc.frequency.setValueAtTime(360 * pitch, time);
    osc.frequency.exponentialRampToValueAtTime(140 * pitch, time + 0.10);

    gain.gain.setValueAtTime(vol * 0.26, time);
    gain.gain.exponentialRampToValueAtTime(0.001, time + 0.11);

    osc.connect(gain);
    gain.connect(ctx.destination);
    osc.start(time);
    osc.stop(time + 0.11);
  }

  private synthSpearImpact(ctx: AudioContext, time: number, vol: number, pitch: number): void {
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = 'triangle';
    osc.frequency.setValueAtTime(280 * pitch, time);
    osc.frequency.exponentialRampToValueAtTime(75 * pitch, time + 0.12);

    gain.gain.setValueAtTime(vol * 0.32, time);
    gain.gain.exponentialRampToValueAtTime(0.001, time + 0.13);

    osc.connect(gain);
    gain.connect(ctx.destination);
    osc.start(time);
    osc.stop(time + 0.13);
  }

  // --- 6. GUN TOWER ---
  private synthGunShoot(ctx: AudioContext, time: number, vol: number, pitch: number): void {
    // Sharp flintlock musket report
    const noise = ctx.createBufferSource();
    noise.buffer = this.getNoiseBuffer(ctx);
    const filter = ctx.createBiquadFilter();
    filter.type = 'bandpass';
    filter.frequency.setValueAtTime(2200, time);
    filter.frequency.exponentialRampToValueAtTime(450, time + 0.12);

    const noiseGain = ctx.createGain();
    noiseGain.gain.setValueAtTime(vol * 0.45, time);
    noiseGain.gain.exponentialRampToValueAtTime(0.001, time + 0.14);

    noise.connect(filter);
    filter.connect(noiseGain);
    noiseGain.connect(ctx.destination);
    noise.start(time);
    noise.stop(time + 0.14);

    const pop = ctx.createOscillator();
    const popGain = ctx.createGain();
    pop.type = 'triangle';
    pop.frequency.setValueAtTime(280 * pitch, time);
    pop.frequency.exponentialRampToValueAtTime(50 * pitch, time + 0.10);

    popGain.gain.setValueAtTime(vol * 0.35, time);
    popGain.gain.exponentialRampToValueAtTime(0.001, time + 0.11);

    pop.connect(popGain);
    popGain.connect(ctx.destination);
    pop.start(time);
    pop.stop(time + 0.11);
  }

  private synthGunImpact(ctx: AudioContext, time: number, vol: number, pitch: number): void {
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = 'triangle';
    osc.frequency.setValueAtTime(850 * pitch, time);
    osc.frequency.exponentialRampToValueAtTime(140 * pitch, time + 0.08);

    gain.gain.setValueAtTime(vol * 0.28, time);
    gain.gain.exponentialRampToValueAtTime(0.001, time + 0.09);

    osc.connect(gain);
    gain.connect(ctx.destination);
    osc.start(time);
    osc.stop(time + 0.09);
  }

  // --- 7. WATER CANNON ---
  private synthWaterCannonShoot(ctx: AudioContext, time: number, vol: number, _pitch: number): void {
    const noise = ctx.createBufferSource();
    noise.buffer = this.getNoiseBuffer(ctx);
    const filter = ctx.createBiquadFilter();
    filter.type = 'bandpass';
    filter.frequency.setValueAtTime(420, time);
    filter.frequency.exponentialRampToValueAtTime(950, time + 0.22);

    const gain = ctx.createGain();
    gain.gain.setValueAtTime(vol * 0.32, time);
    gain.gain.exponentialRampToValueAtTime(0.001, time + 0.25);

    noise.connect(filter);
    filter.connect(gain);
    gain.connect(ctx.destination);
    noise.start(time);
    noise.stop(time + 0.25);
  }

  private synthWaterCannonImpact(ctx: AudioContext, time: number, vol: number, _pitch: number): void {
    const noise = ctx.createBufferSource();
    noise.buffer = this.getNoiseBuffer(ctx);
    const filter = ctx.createBiquadFilter();
    filter.type = 'lowpass';
    filter.frequency.setValueAtTime(600, time);
    filter.frequency.exponentialRampToValueAtTime(180, time + 0.30);

    const gain = ctx.createGain();
    gain.gain.setValueAtTime(vol * 0.36, time);
    gain.gain.exponentialRampToValueAtTime(0.001, time + 0.32);

    noise.connect(filter);
    filter.connect(gain);
    gain.connect(ctx.destination);
    noise.start(time);
    noise.stop(time + 0.32);
  }

  // --- 8. CHINTHE STATUE ---
  private synthChintheShoot(ctx: AudioContext, time: number, vol: number, pitch: number): void {
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = 'sawtooth';
    osc.frequency.setValueAtTime(150 * pitch, time);
    osc.frequency.exponentialRampToValueAtTime(60 * pitch, time + 0.35);

    const filter = ctx.createBiquadFilter();
    filter.type = 'lowpass';
    filter.frequency.setValueAtTime(480, time);

    gain.gain.setValueAtTime(vol * 0.35, time);
    gain.gain.exponentialRampToValueAtTime(0.001, time + 0.38);

    osc.connect(filter);
    filter.connect(gain);
    gain.connect(ctx.destination);
    osc.start(time);
    osc.stop(time + 0.38);
  }

  private synthChintheImpact(ctx: AudioContext, time: number, vol: number, pitch: number): void {
    const chime = ctx.createOscillator();
    const chimeGain = ctx.createGain();
    chime.type = 'triangle';
    chime.frequency.setValueAtTime(587 * pitch, time);

    chimeGain.gain.setValueAtTime(vol * 0.26, time);
    chimeGain.gain.exponentialRampToValueAtTime(0.001, time + 0.35);

    chime.connect(chimeGain);
    chimeGain.connect(ctx.destination);
    chime.start(time);
    chime.stop(time + 0.35);
  }

  // --- 9. DRAGON TOWER ---
  private synthDragonShoot(ctx: AudioContext, time: number, vol: number, pitch: number): void {
    // Draconic roar + flame whoosh
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = 'sawtooth';
    osc.frequency.setValueAtTime(180 * pitch, time);
    osc.frequency.exponentialRampToValueAtTime(75 * pitch, time + 0.30);

    const filter = ctx.createBiquadFilter();
    filter.type = 'lowpass';
    filter.frequency.setValueAtTime(520, time);

    gain.gain.setValueAtTime(vol * 0.32, time);
    gain.gain.exponentialRampToValueAtTime(0.001, time + 0.32);

    osc.connect(filter);
    filter.connect(gain);
    gain.connect(ctx.destination);
    osc.start(time);
    osc.stop(time + 0.32);
  }

  private synthDragonImpact(ctx: AudioContext, time: number, vol: number, _pitch: number): void {
    const noise = ctx.createBufferSource();
    noise.buffer = this.getNoiseBuffer(ctx);
    const filter = ctx.createBiquadFilter();
    filter.type = 'bandpass';
    filter.frequency.setValueAtTime(900, time);
    filter.frequency.exponentialRampToValueAtTime(300, time + 0.35);

    const gain = ctx.createGain();
    gain.gain.setValueAtTime(vol * 0.34, time);
    gain.gain.exponentialRampToValueAtTime(0.001, time + 0.38);

    noise.connect(filter);
    filter.connect(gain);
    gain.connect(ctx.destination);
    noise.start(time);
    noise.stop(time + 0.38);
  }

  // --- 10. SEIN PYAUNG ---
  private synthSeinPyaungShoot(ctx: AudioContext, time: number, vol: number, pitch: number): void {
    // Heavy sniper blast + supersonic snap
    const snap = ctx.createOscillator();
    const snapGain = ctx.createGain();
    snap.type = 'triangle';
    snap.frequency.setValueAtTime(1800 * pitch, time);
    snap.frequency.exponentialRampToValueAtTime(250 * pitch, time + 0.05);

    snapGain.gain.setValueAtTime(vol * 0.35, time);
    snapGain.gain.exponentialRampToValueAtTime(0.001, time + 0.06);

    snap.connect(snapGain);
    snapGain.connect(ctx.destination);
    snap.start(time);
    snap.stop(time + 0.06);

    const boom = ctx.createOscillator();
    const boomGain = ctx.createGain();
    boom.type = 'sine';
    boom.frequency.setValueAtTime(130 * pitch, time);
    boom.frequency.exponentialRampToValueAtTime(25 * pitch, time + 0.48);

    boomGain.gain.setValueAtTime(vol * 0.58, time);
    boomGain.gain.exponentialRampToValueAtTime(0.001, time + 0.50);

    boom.connect(boomGain);
    boomGain.connect(ctx.destination);
    boom.start(time);
    boom.stop(time + 0.50);
  }

  private synthSeinPyaungImpact(ctx: AudioContext, time: number, vol: number, pitch: number): void {
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = 'sine';
    osc.frequency.setValueAtTime(110 * pitch, time);
    osc.frequency.exponentialRampToValueAtTime(22 * pitch, time + 0.55);

    gain.gain.setValueAtTime(vol * 0.52, time);
    gain.gain.exponentialRampToValueAtTime(0.001, time + 0.58);

    osc.connect(gain);
    gain.connect(ctx.destination);
    osc.start(time);
    osc.stop(time + 0.58);
  }


  // =========================================================================
  // --- UNIT AUDIO ENGINE (15 Units, Spawns, Abilities, Deaths) ---
  // =========================================================================

  private lastMobSpawnTime: Map<string, number> = new Map();
  private lastMobDeathTime = 0;

  /**
   * Preload unit sound files into memory cache.
   */
  public preloadUnitSounds(): void {
    if (typeof window === 'undefined') return;
    const unitFiles = [
      'monkey_spawn.wav', 'horse_rider_spawn.wav', 'sar_bal_gyi_spawn.wav',
      'gya_pu_spawn.wav', 'a_ba_spawn.wav', 'chon_toe_spawn.wav',
      'elephant_rider_spawn.wav', 'say_sayar_spawn.wav', 'shield_guy_spawn.wav',
      'doe_pat_spawn.wav', 'bandit_spawn.wav', 'belu_spawn.wav',
      'brute_spawn.wav', 'general_spawn.wav', 'sone_ma_spawn.wav',
      'say_sayar_ability.wav', 'shield_guy_ability.wav', 'doe_pat_ability.wav',
      'unit_death_light.wav', 'unit_death_medium.wav', 'unit_death_heavy.wav', 'unit_death_spirit.wav'
    ];

    for (const f of unitFiles) {
      const fullPath = `/assets/sfx/units/${f}`;
      if (!this.audioFileCache.has(fullPath)) {
        const audio = new Audio(fullPath);
        audio.preload = 'auto';
        this.audioFileCache.set(fullPath, audio);
      }
    }
  }

  private tryPlayUnitAudioFile(filename: string): boolean {
    if (typeof window === 'undefined') return false;
    const path = `/assets/sfx/units/${filename}`;
    let cached = this.audioFileCache.get(path);
    if (cached === undefined) {
      const audio = new Audio(path);
      audio.volume = this.volume;
      audio.preload = 'auto';
      this.audioFileCache.set(path, audio);
      cached = audio;
    }
    if (cached && !cached.error) {
      if (!cached.paused && cached.currentTime > 0) {
        try {
          const clone = cached.cloneNode(true) as HTMLAudioElement;
          clone.volume = this.volume;
          clone.play().catch(() => {});
          return true;
        } catch {
          return false;
        }
      } else {
        try {
          cached.currentTime = 0;
          cached.volume = this.volume;
          cached.play().catch(() => {});
          return true;
        } catch {
          return false;
        }
      }
    }
    return false;
  }

  /**
   * Plays the spawn / deployment sound for any of the 15 units.
   * Throttled to 200ms per unit ID to prevent distortion during batch spawns.
   */
  public playMobSpawn(unitId: string, customPitch?: number): void {
    if (this.isMuted || this.volume <= 0) return;
    const now = Date.now();
    const last = this.lastMobSpawnTime.get(unitId) || 0;
    if (now - last < 200) return;
    this.lastMobSpawnTime.set(unitId, now);

    this.playMobSpawnAudition(unitId, customPitch);
  }

  /**
   * Audition helper: plays unit spawn sound without throttling.
   */
  public playMobSpawnAudition(unitId: string, customPitch?: number): void {
    if (this.isMuted || this.volume <= 0) return;
    const cleanId = unitId.toLowerCase().trim();

    if (this.tryPlayUnitAudioFile(`${cleanId}_spawn.wav`)) {
      return;
    }

    const ctx = this.getAudioContext();
    if (!ctx) return;

    try {
      const time = ctx.currentTime;
      const vol = this.volume;
      const pitch = customPitch !== undefined ? customPitch : this.getPitchMultiplier();

      switch (cleanId) {
        case 'monkey': this.synthMonkeySpawn(ctx, time, vol, pitch); break;
        case 'horse_rider': this.synthCavalrySpawn(ctx, time, vol, pitch); break;
        case 'sar_bal_gyi': this.synthGuardSpawn(ctx, time, vol, pitch); break;
        case 'gya_pu': this.synthWingedNatSpawn(ctx, time, vol, pitch); break;
        case 'a_ba': this.synthMediumSpawn(ctx, time, vol, pitch); break;
        case 'chon_toe': this.synthSneakSpawn(ctx, time, vol, pitch); break;
        case 'elephant_rider': this.synthElephantSpawn(ctx, time, vol, pitch); break;
        case 'say_sayar': this.synthSaySayarSpawn(ctx, time, vol, pitch); break;
        case 'shield_guy': this.synthShieldGuySpawn(ctx, time, vol, pitch); break;
        case 'doe_pat': this.synthDoePatSpawn(ctx, time, vol, pitch); break;
        case 'bandit': this.synthBanditSpawn(ctx, time, vol, pitch); break;
        case 'belu': this.synthBeluSpawn(ctx, time, vol, pitch); break;
        case 'brute': this.synthBruteSpawn(ctx, time, vol, pitch); break;
        case 'general': this.synthGeneralSpawn(ctx, time, vol, pitch); break;
        case 'sone_ma': this.synthSoneMaSpawn(ctx, time, vol, pitch); break;
        default: this.synthGuardSpawn(ctx, time, vol, pitch); break;
      }
    } catch {}
  }

  /**
   * Audition helper for unit abilities.
   */
  public playMobAbilityAudition(unitId: string, abilityType?: string): void {
    this.playMobAbility(unitId, abilityType);
  }

  /**
   * Plays unique unit ability audio (Say Sayar heal, Shield Guy taunt, Doe Pat drum cadence).
   */
  public playMobAbility(unitId: string, abilityType?: string): void {
    if (this.isMuted || this.volume <= 0) return;
    const cleanId = unitId.toLowerCase().trim();

    if (this.tryPlayUnitAudioFile(`${cleanId}_ability.wav`)) {
      return;
    }

    const ctx = this.getAudioContext();
    if (!ctx) return;

    try {
      const time = ctx.currentTime;
      const vol = this.volume;
      const pitch = this.getPitchMultiplier();

      if (cleanId === 'say_sayar' || abilityType === 'heal_aura') {
        this.synthSaySayarHeal(ctx, time, vol, pitch);
      } else if (cleanId === 'shield_guy' || abilityType === 'taunt') {
        this.synthShieldTaunt(ctx, time, vol, pitch);
      } else if (cleanId === 'doe_pat' || abilityType === 'speed_aura') {
        this.synthDoePatAbility(ctx, time, vol, pitch);
      }
    } catch {}
  }

  /**
   * Plays defeat / death audio cue based on unit archetype.
   */
  public playMobDeath(unitId: string): void {
    if (this.isMuted || this.volume <= 0) return;
    const now = Date.now();
    if (now - this.lastMobDeathTime < 120) return;
    this.lastMobDeathTime = now;

    this.playMobDeathAudition(unitId);
  }

  /**
   * Audition helper for death sounds.
   */
  public playMobDeathAudition(unitId: string, customPitch?: number): void {
    if (this.isMuted || this.volume <= 0) return;
    const cleanId = unitId.toLowerCase().trim();

    let archetype: 'light' | 'medium' | 'heavy' | 'spirit' = 'medium';
    if (['monkey', 'bandit', 'chon_toe'].includes(cleanId)) archetype = 'light';
    else if (['elephant_rider', 'belu', 'brute', 'shield_guy'].includes(cleanId)) archetype = 'heavy';
    else if (['gya_pu', 'a_ba', 'sone_ma', 'say_sayar'].includes(cleanId)) archetype = 'spirit';

    if (this.tryPlayUnitAudioFile(`unit_death_${archetype}.wav`)) {
      return;
    }

    const ctx = this.getAudioContext();
    if (!ctx) return;

    try {
      const time = ctx.currentTime;
      const vol = this.volume * 0.75;
      const pitch = customPitch !== undefined ? customPitch : this.getPitchMultiplier();

      switch (archetype) {
        case 'light': this.synthDeathLight(ctx, time, vol, pitch); break;
        case 'heavy': this.synthDeathHeavy(ctx, time, vol, pitch); break;
        case 'spirit': this.synthDeathSpirit(ctx, time, vol, pitch); break;
        default: this.synthDeathMedium(ctx, time, vol, pitch); break;
      }
    } catch {}
  }

  // --- UNIT SYNTHESIS METHODS ---

  private synthMonkeySpawn(ctx: AudioContext, time: number, vol: number, pitch: number): void {
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = 'sine';
    osc.frequency.setValueAtTime(1400 * pitch, time);
    osc.frequency.exponentialRampToValueAtTime(2800 * pitch, time + 0.15);
    osc.frequency.exponentialRampToValueAtTime(1600 * pitch, time + 0.35);

    gain.gain.setValueAtTime(vol * 0.45, time);
    gain.gain.exponentialRampToValueAtTime(0.001, time + 0.42);

    osc.connect(gain);
    gain.connect(ctx.destination);
    osc.start(time);
    osc.stop(time + 0.42);
  }

  private synthCavalrySpawn(ctx: AudioContext, time: number, vol: number, pitch: number): void {
    // 3 Hoof beats
    [0.0, 0.14, 0.28].forEach((hb) => {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = 'triangle';
      osc.frequency.setValueAtTime(160 * pitch, time + hb);
      osc.frequency.exponentialRampToValueAtTime(45 * pitch, time + hb + 0.08);

      gain.gain.setValueAtTime(vol * 0.45, time + hb);
      gain.gain.exponentialRampToValueAtTime(0.001, time + hb + 0.09);

      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.start(time + hb);
      osc.stop(time + hb + 0.09);
    });

    // Whinny
    const w = ctx.createOscillator();
    const wGain = ctx.createGain();
    w.type = 'sine';
    w.frequency.setValueAtTime(800 * pitch, time + 0.25);
    w.frequency.linearRampToValueAtTime(1250 * pitch, time + 0.45);
    w.frequency.exponentialRampToValueAtTime(700 * pitch, time + 0.70);

    wGain.gain.setValueAtTime(vol * 0.35, time + 0.25);
    wGain.gain.exponentialRampToValueAtTime(0.001, time + 0.72);

    w.connect(wGain);
    wGain.connect(ctx.destination);
    w.start(time + 0.25);
    w.stop(time + 0.72);
  }

  private synthGuardSpawn(ctx: AudioContext, time: number, vol: number, pitch: number): void {
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = 'triangle';
    osc.frequency.setValueAtTime(120 * pitch, time);
    osc.frequency.exponentialRampToValueAtTime(40 * pitch, time + 0.25);

    gain.gain.setValueAtTime(vol * 0.55, time);
    gain.gain.exponentialRampToValueAtTime(0.001, time + 0.35);

    osc.connect(gain);
    gain.connect(ctx.destination);
    osc.start(time);
    osc.stop(time + 0.35);
  }

  private synthWingedNatSpawn(ctx: AudioContext, time: number, vol: number, pitch: number): void {
    [1046.5, 1318.5, 1568.0, 2093.0].forEach((f, idx) => {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = 'sine';
      osc.frequency.setValueAtTime(f * pitch, time + idx * 0.06);

      gain.gain.setValueAtTime(vol * 0.22, time + idx * 0.06);
      gain.gain.exponentialRampToValueAtTime(0.001, time + idx * 0.06 + 0.65);

      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.start(time + idx * 0.06);
      osc.stop(time + idx * 0.06 + 0.65);
    });
  }

  private synthMediumSpawn(ctx: AudioContext, time: number, vol: number, pitch: number): void {
    [880, 2428, 4752].forEach((f, idx) => {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = 'sine';
      osc.frequency.setValueAtTime(f * pitch, time);

      gain.gain.setValueAtTime((vol * 0.35) / (idx + 1), time);
      gain.gain.exponentialRampToValueAtTime(0.001, time + 0.85);

      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.start(time);
      osc.stop(time + 0.85);
    });
  }

  private synthSneakSpawn(ctx: AudioContext, time: number, vol: number, pitch: number): void {
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = 'triangle';
    osc.frequency.setValueAtTime(3200 * pitch, time);
    osc.frequency.exponentialRampToValueAtTime(350 * pitch, time + 0.32);

    gain.gain.setValueAtTime(vol * 0.38, time);
    gain.gain.exponentialRampToValueAtTime(0.001, time + 0.38);

    osc.connect(gain);
    gain.connect(ctx.destination);
    osc.start(time);
    osc.stop(time + 0.38);
  }

  private synthElephantSpawn(ctx: AudioContext, time: number, vol: number, pitch: number): void {
    // Ground stomp
    const stomp = ctx.createOscillator();
    const sGain = ctx.createGain();
    stomp.type = 'sine';
    stomp.frequency.setValueAtTime(75 * pitch, time);
    stomp.frequency.exponentialRampToValueAtTime(25 * pitch, time + 0.45);
    sGain.gain.setValueAtTime(vol * 0.65, time);
    sGain.gain.exponentialRampToValueAtTime(0.001, time + 0.50);
    stomp.connect(sGain);
    sGain.connect(ctx.destination);
    stomp.start(time);
    stomp.stop(time + 0.50);

    // Trumpet roar
    const roar = ctx.createOscillator();
    const rGain = ctx.createGain();
    roar.type = 'sawtooth';
    roar.frequency.setValueAtTime(180 * pitch, time + 0.15);
    roar.frequency.linearRampToValueAtTime(380 * pitch, time + 0.55);
    roar.frequency.exponentialRampToValueAtTime(190 * pitch, time + 0.95);
    rGain.gain.setValueAtTime(vol * 0.48, time + 0.15);
    rGain.gain.exponentialRampToValueAtTime(0.001, time + 0.98);
    roar.connect(rGain);
    rGain.connect(ctx.destination);
    roar.start(time + 0.15);
    roar.stop(time + 0.98);
  }

  private synthSaySayarSpawn(ctx: AudioContext, time: number, vol: number, pitch: number): void {
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = 'sine';
    osc.frequency.setValueAtTime(523.25 * pitch, time); // C5
    gain.gain.setValueAtTime(vol * 0.40, time);
    gain.gain.exponentialRampToValueAtTime(0.001, time + 0.55);
    osc.connect(gain);
    gain.connect(ctx.destination);
    osc.start(time);
    osc.stop(time + 0.55);
  }

  private synthSaySayarHeal(ctx: AudioContext, time: number, vol: number, pitch: number): void {
    [523.25, 659.25, 783.99, 1046.5].forEach((f, idx) => {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = 'sine';
      osc.frequency.setValueAtTime(f * pitch, time + idx * 0.10);
      gain.gain.setValueAtTime(vol * 0.30, time + idx * 0.10);
      gain.gain.exponentialRampToValueAtTime(0.001, time + idx * 0.10 + 0.45);
      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.start(time + idx * 0.10);
      osc.stop(time + idx * 0.10 + 0.45);
    });
  }

  private synthShieldGuySpawn(ctx: AudioContext, time: number, vol: number, pitch: number): void {
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = 'triangle';
    osc.frequency.setValueAtTime(220 * pitch, time);
    osc.frequency.exponentialRampToValueAtTime(60 * pitch, time + 0.22);
    gain.gain.setValueAtTime(vol * 0.55, time);
    gain.gain.exponentialRampToValueAtTime(0.001, time + 0.30);
    osc.connect(gain);
    gain.connect(ctx.destination);
    osc.start(time);
    osc.stop(time + 0.30);
  }

  private synthShieldTaunt(ctx: AudioContext, time: number, vol: number, pitch: number): void {
    [720, 1380, 2450].forEach((f) => {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = 'sine';
      osc.frequency.setValueAtTime(f * pitch, time);
      gain.gain.setValueAtTime(vol * 0.35, time);
      gain.gain.exponentialRampToValueAtTime(0.001, time + 0.45);
      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.start(time);
      osc.stop(time + 0.45);
    });
  }

  private synthDoePatSpawn(ctx: AudioContext, time: number, vol: number, pitch: number): void {
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = 'sine';
    osc.frequency.setValueAtTime(180 * pitch, time);
    osc.frequency.exponentialRampToValueAtTime(95 * pitch, time + 0.18);
    gain.gain.setValueAtTime(vol * 0.65, time);
    gain.gain.exponentialRampToValueAtTime(0.001, time + 0.28);
    osc.connect(gain);
    gain.connect(ctx.destination);
    osc.start(time);
    osc.stop(time + 0.28);
  }

  private synthDoePatAbility(ctx: AudioContext, time: number, vol: number, pitch: number): void {
    [0.0, 0.12, 0.24, 0.36].forEach((bt, idx) => {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = 'sine';
      osc.frequency.setValueAtTime((175 + idx * 15) * pitch, time + bt);
      osc.frequency.exponentialRampToValueAtTime(90 * pitch, time + bt + 0.12);
      gain.gain.setValueAtTime(vol * 0.55, time + bt);
      gain.gain.exponentialRampToValueAtTime(0.001, time + bt + 0.15);
      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.start(time + bt);
      osc.stop(time + bt + 0.15);
    });
  }

  private synthBanditSpawn(ctx: AudioContext, time: number, vol: number, pitch: number): void {
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = 'sawtooth';
    osc.frequency.setValueAtTime(4200 * pitch, time);
    osc.frequency.exponentialRampToValueAtTime(800 * pitch, time + 0.20);
    gain.gain.setValueAtTime(vol * 0.35, time);
    gain.gain.exponentialRampToValueAtTime(0.001, time + 0.25);
    osc.connect(gain);
    gain.connect(ctx.destination);
    osc.start(time);
    osc.stop(time + 0.25);
  }

  private synthBeluSpawn(ctx: AudioContext, time: number, vol: number, pitch: number): void {
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = 'sawtooth';
    osc.frequency.setValueAtTime(55 * pitch, time);
    osc.frequency.linearRampToValueAtTime(75 * pitch, time + 0.40);
    osc.frequency.exponentialRampToValueAtTime(40 * pitch, time + 0.75);
    gain.gain.setValueAtTime(vol * 0.65, time);
    gain.gain.exponentialRampToValueAtTime(0.001, time + 0.80);
    osc.connect(gain);
    gain.connect(ctx.destination);
    osc.start(time);
    osc.stop(time + 0.80);
  }

  private synthBruteSpawn(ctx: AudioContext, time: number, vol: number, pitch: number): void {
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = 'triangle';
    osc.frequency.setValueAtTime(110 * pitch, time);
    osc.frequency.exponentialRampToValueAtTime(50 * pitch, time + 0.35);
    gain.gain.setValueAtTime(vol * 0.58, time);
    gain.gain.exponentialRampToValueAtTime(0.001, time + 0.42);
    osc.connect(gain);
    gain.connect(ctx.destination);
    osc.start(time);
    osc.stop(time + 0.42);
  }

  private synthGeneralSpawn(ctx: AudioContext, time: number, vol: number, pitch: number): void {
    [261.63, 523.25, 784.88].forEach((f) => {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = 'sine';
      osc.frequency.setValueAtTime(f * pitch, time + 0.10);
      gain.gain.setValueAtTime(vol * 0.35, time + 0.10);
      gain.gain.exponentialRampToValueAtTime(0.001, time + 0.65);
      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.start(time + 0.10);
      osc.stop(time + 0.65);
    });
  }

  private synthSoneMaSpawn(ctx: AudioContext, time: number, vol: number, pitch: number): void {
    [220.0, 311.13, 440.0, 622.25].forEach((f) => {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = 'sine';
      osc.frequency.setValueAtTime(f * pitch, time);
      gain.gain.setValueAtTime(vol * 0.25, time);
      gain.gain.exponentialRampToValueAtTime(0.001, time + 0.65);
      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.start(time);
      osc.stop(time + 0.65);
    });
  }

  private synthDeathLight(ctx: AudioContext, time: number, vol: number, pitch: number): void {
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = 'sine';
    osc.frequency.setValueAtTime(580 * pitch, time);
    osc.frequency.exponentialRampToValueAtTime(140 * pitch, time + 0.22);
    gain.gain.setValueAtTime(vol * 0.45, time);
    gain.gain.exponentialRampToValueAtTime(0.001, time + 0.26);
    osc.connect(gain);
    gain.connect(ctx.destination);
    osc.start(time);
    osc.stop(time + 0.26);
  }

  private synthDeathMedium(ctx: AudioContext, time: number, vol: number, pitch: number): void {
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = 'triangle';
    osc.frequency.setValueAtTime(160 * pitch, time);
    osc.frequency.exponentialRampToValueAtTime(45 * pitch, time + 0.32);
    gain.gain.setValueAtTime(vol * 0.50, time);
    gain.gain.exponentialRampToValueAtTime(0.001, time + 0.36);
    osc.connect(gain);
    gain.connect(ctx.destination);
    osc.start(time);
    osc.stop(time + 0.36);
  }

  private synthDeathHeavy(ctx: AudioContext, time: number, vol: number, pitch: number): void {
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = 'sine';
    osc.frequency.setValueAtTime(75 * pitch, time);
    osc.frequency.exponentialRampToValueAtTime(25 * pitch, time + 0.45);
    gain.gain.setValueAtTime(vol * 0.60, time);
    gain.gain.exponentialRampToValueAtTime(0.001, time + 0.50);
    osc.connect(gain);
    gain.connect(ctx.destination);
    osc.start(time);
    osc.stop(time + 0.50);
  }

  private synthDeathSpirit(ctx: AudioContext, time: number, vol: number, pitch: number): void {
    [1850, 2600].forEach((f) => {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = 'sine';
      osc.frequency.setValueAtTime(f * pitch, time);
      gain.gain.setValueAtTime(vol * 0.28, time);
      gain.gain.exponentialRampToValueAtTime(0.001, time + 0.48);
      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.start(time);
      osc.stop(time + 0.48);
    });
  }

}



export const soundEffects = new SoundEffectsManager();
