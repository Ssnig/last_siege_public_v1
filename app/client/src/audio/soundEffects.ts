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
}

export const soundEffects = new SoundEffectsManager();
