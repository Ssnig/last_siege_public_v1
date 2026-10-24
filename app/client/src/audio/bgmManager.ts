/**
 * Background Music (BGM) Manager with smooth crossfade and volume controls.
 * Manages game soundtrack playback across menus, lobby, and combat.
 */

export type BGMTrack = 'overall' | 'in_game';

const TRACK_PATHS: Record<BGMTrack, string> = {
  overall: '/assets/music/Overall.mp3',
  in_game: '/assets/music/In_game_start.mp3',
};

class BGMManager {
  private currentTrack: BGMTrack | null = null;
  private currentAudio: HTMLAudioElement | null = null;
  private fadingAudio: HTMLAudioElement | null = null;
  private volume: number = 0.5;
  private isMuted: boolean = false;
  private fadeInterval: number | null = null;
  private unlocked: boolean = false;
  private pendingTrack: BGMTrack | null = null;

  constructor() {
    if (typeof window !== 'undefined') {
      try {
        const savedVolume = localStorage.getItem('game-bgm-volume');
        if (savedVolume !== null) {
          const parsed = parseFloat(savedVolume);
          if (!isNaN(parsed)) {
            this.volume = Math.max(0, Math.min(1, parsed));
          }
        }
        this.isMuted = localStorage.getItem('game-bgm-muted') === 'true';
      } catch {
        // Fallback to defaults
      }

      // Handle browser autoplay policy by unlocking on first user interaction
      this.setupAutoplayUnlocker();
    }
  }

  private setupAutoplayUnlocker(): void {
    if (typeof window === 'undefined') return;

    const unlock = () => {
      this.unlocked = true;
      window.removeEventListener('pointerdown', unlock);
      window.removeEventListener('keydown', unlock);
      window.removeEventListener('click', unlock);

      // If a track was requested before user interaction, start it now
      if (this.pendingTrack) {
        const track = this.pendingTrack;
        this.pendingTrack = null;
        this.playTrack(track, 800).catch(() => {});
      } else if (this.currentAudio && this.currentAudio.paused) {
        this.currentAudio.play().catch(() => {});
      }
    };

    window.addEventListener('pointerdown', unlock, { passive: true });
    window.addEventListener('keydown', unlock, { passive: true });
    window.addEventListener('click', unlock, { passive: true });
  }

  public getVolume(): number {
    return this.volume;
  }

  public setVolume(vol: number): void {
    this.volume = Math.max(0, Math.min(1, vol));
    if (typeof window !== 'undefined') {
      try {
        localStorage.setItem('game-bgm-volume', this.volume.toString());
      } catch {}
    }

    // Apply immediately to current audio if not fading
    if (this.currentAudio && !this.fadeInterval) {
      this.currentAudio.volume = this.effectiveVolume;
    }
  }

  public getMuted(): boolean {
    return this.isMuted;
  }

  public setMuted(muted: boolean): void {
    this.isMuted = muted;
    if (typeof window !== 'undefined') {
      try {
        localStorage.setItem('game-bgm-muted', muted ? 'true' : 'false');
      } catch {}
    }

    if (this.currentAudio && !this.fadeInterval) {
      this.currentAudio.volume = this.effectiveVolume;
    }
  }

  private get effectiveVolume(): number {
    return this.isMuted ? 0 : this.volume;
  }

  public getCurrentTrack(): BGMTrack | null {
    return this.currentTrack;
  }

  public isUnlocked(): boolean {
    return this.unlocked;
  }

  /**
   * Play a specific track with smooth fade transition.
   */
  public async playTrack(track: BGMTrack, fadeDurationMs: number = 600): Promise<void> {
    if (typeof window === 'undefined') return;

    // If the requested track is already playing
    if (this.currentTrack === track && this.currentAudio && !this.currentAudio.paused) {
      if (this.currentAudio.volume < this.effectiveVolume) {
        this.fadeIn(fadeDurationMs);
      }
      return;
    }

    this.pendingTrack = track;

    const newAudio = new Audio(TRACK_PATHS[track]);
    newAudio.loop = true;
    newAudio.volume = 0;

    const oldAudio = this.currentAudio;
    this.fadingAudio = oldAudio;
    this.currentAudio = newAudio;
    this.currentTrack = track;

    try {
      const playPromise = newAudio.play();
      if (playPromise !== undefined) {
        await playPromise;
        this.unlocked = true;
      }
    } catch {
      // Browser autoplay policy prevented instant playback.
      // It will automatically resume once the user taps or clicks.
      return;
    }

    // Cross-fade old audio out and new audio in
    const targetVolume = this.effectiveVolume;
    const startTime = performance.now();
    const startOldVol = oldAudio ? oldAudio.volume : 0;

    if (this.fadeInterval !== null) {
      cancelAnimationFrame(this.fadeInterval);
      this.fadeInterval = null;
    }

    const step = (now: number) => {
      const elapsed = now - startTime;
      const progress = Math.min(1, elapsed / Math.max(50, fadeDurationMs));

      // Ease in-out
      const factor = progress * progress * (3 - 2 * progress);

      newAudio.volume = targetVolume * factor;

      if (oldAudio) {
        oldAudio.volume = Math.max(0, startOldVol * (1 - factor));
      }

      if (progress < 1) {
        this.fadeInterval = requestAnimationFrame(step);
      } else {
        newAudio.volume = targetVolume;
        if (oldAudio) {
          oldAudio.pause();
          oldAudio.currentTime = 0;
        }
        this.fadingAudio = null;
        this.fadeInterval = null;
      }
    };

    this.fadeInterval = requestAnimationFrame(step);
  }

  /**
   * Fades out current music to 0 over specified duration.
   */
  public fadeOut(durationMs: number = 300): Promise<void> {
    return new Promise((resolve) => {
      if (!this.currentAudio || this.currentAudio.paused) {
        resolve();
        return;
      }

      if (this.fadeInterval !== null) {
        cancelAnimationFrame(this.fadeInterval);
        this.fadeInterval = null;
      }

      const audio = this.currentAudio;
      const startVol = audio.volume;
      const startTime = performance.now();

      const step = (now: number) => {
        const elapsed = now - startTime;
        const progress = Math.min(1, elapsed / Math.max(50, durationMs));
        audio.volume = Math.max(0, startVol * (1 - progress));

        if (progress < 1) {
          this.fadeInterval = requestAnimationFrame(step);
        } else {
          audio.volume = 0;
          this.fadeInterval = null;
          resolve();
        }
      };

      this.fadeInterval = requestAnimationFrame(step);
    });
  }

  /**
   * Fades in current music from its current volume to target volume.
   */
  public fadeIn(durationMs: number = 400): Promise<void> {
    return new Promise((resolve) => {
      if (!this.currentAudio) {
        resolve();
        return;
      }

      if (this.currentAudio.paused) {
        this.currentAudio.play().catch(() => {});
      }

      if (this.fadeInterval !== null) {
        cancelAnimationFrame(this.fadeInterval);
        this.fadeInterval = null;
      }

      const audio = this.currentAudio;
      const startVol = audio.volume;
      const targetVol = this.effectiveVolume;
      const startTime = performance.now();

      const step = (now: number) => {
        const elapsed = now - startTime;
        const progress = Math.min(1, elapsed / Math.max(50, durationMs));
        audio.volume = startVol + (targetVol - startVol) * progress;

        if (progress < 1) {
          this.fadeInterval = requestAnimationFrame(step);
        } else {
          audio.volume = targetVol;
          this.fadeInterval = null;
          resolve();
        }
      };

      this.fadeInterval = requestAnimationFrame(step);
    });
  }

  /**
   * Smoothly dips the volume down and back up (useful for page transitions).
   */
  public async fadeTransition(onMidpoint?: () => void, durationMs: number = 500): Promise<void> {
    const half = Math.floor(durationMs / 2);
    await this.fadeOut(half);
    if (onMidpoint) {
      onMidpoint();
    }
    await this.fadeIn(half);
  }

  /**
   * Fades out and pauses playback entirely.
   */
  public async stop(fadeDurationMs: number = 300): Promise<void> {
    await this.fadeOut(fadeDurationMs);
    if (this.currentAudio) {
      this.currentAudio.pause();
      this.currentAudio.currentTime = 0;
      this.currentAudio = null;
    }
    if (this.fadingAudio) {
      this.fadingAudio.pause();
      this.fadingAudio.currentTime = 0;
      this.fadingAudio = null;
    }
    this.currentTrack = null;
    this.pendingTrack = null;
  }
}

export const bgmManager = new BGMManager();
