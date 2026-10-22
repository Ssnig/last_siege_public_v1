/**
 * Procedural Web Audio API sound synthesizer.
 * Provides instant sound effects for UI actions without requiring external audio files.
 */

class SoundEffectsManager {
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
}

export const soundEffects = new SoundEffectsManager();
