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
      this.ctx.resume().catch(() => {});
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

  private tryPlayAudioFile(filename: string): boolean {
    if (typeof window === 'undefined') return false;
    const path = `/assets/sfx/towers/${filename}`;
    let cached = this.audioFileCache.get(path);
    if (cached === undefined) {
      const audio = new Audio(path);
      audio.volume = this.volume;
      this.audioFileCache.set(path, audio);
      cached = audio;
    }
    if (cached && !isNaN(cached.duration) && cached.duration > 0) {
      try {
        const clone = cached.cloneNode() as HTMLAudioElement;
        clone.volume = this.volume;
        clone.play().catch(() => {});
        return true;
      } catch {
        return false;
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
  }

  /**
   * Checks whether a custom audio file is currently available for a tower sound.
   */
  public isCustomAudio(towerId: string, soundType: 'shoot' | 'impact'): boolean {
    const norm = this.normalizeTowerId(towerId);
    const mp3 = `/assets/sfx/towers/${norm}_${soundType}.mp3`;
    const wav = `/assets/sfx/towers/${norm}_${soundType}.wav`;
    const a = this.audioFileCache.get(mp3) || this.audioFileCache.get(wav);
    return !!(a && !isNaN(a.duration) && a.duration > 0);
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

}


export const soundEffects = new SoundEffectsManager();
