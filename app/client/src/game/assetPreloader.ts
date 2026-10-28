import { useState, useEffect } from 'react';
import {
  type AssetManifestEntry,
  CORE_ASSETS,
  DEFAULT_MAP_ID,
  EXTRA_MAPS,
} from './assetManifest';

export interface AssetProgressState {
  loaded: number;
  total: number;
  percentage: number;
  isBattleReady: boolean;
  statusLabel: string;
}

type ProgressCallback = (loaded: number, total: number, pct: number, label: string) => void;
type StateListener = (state: AssetProgressState) => void;

const SESSION_STORAGE_KEY = 'td_core_assets_preloaded_v2';
const CONCURRENT_DOWNLOAD_LIMIT = 6;

/**
 * Singleton Asset Preloader for progressive client-side preloading.
 * Streams all core game assets in the background while players explore the Lobby.
 */
class AssetPreloaderService {
  private loadedMapIds = new Set<string>([DEFAULT_MAP_ID]);
  private coreLoaded = false;
  private preloadPromise: Promise<void> | null = null;
  private listeners = new Set<StateListener>();
  private currentState: AssetProgressState = {
    loaded: 0,
    total: CORE_ASSETS.length + 1,
    percentage: 0,
    isBattleReady: false,
    statusLabel: 'Preparing Battlefield...',
  };

  constructor() {
    try {
      if (typeof window !== 'undefined' && window.sessionStorage) {
        this.coreLoaded = window.sessionStorage.getItem(SESSION_STORAGE_KEY) === 'true';
        if (this.coreLoaded) {
          this.currentState = {
            loaded: CORE_ASSETS.length + 1,
            total: CORE_ASSETS.length + 1,
            percentage: 100,
            isBattleReady: true,
            statusLabel: 'Battlefield Ready',
          };
        }
      }
    } catch {
      // sessionStorage might be restricted
    }
  }

  public getState(): AssetProgressState {
    return this.currentState;
  }

  public subscribe(listener: StateListener): () => void {
    this.listeners.add(listener);
    listener(this.currentState);
    return () => {
      this.listeners.delete(listener);
    };
  }

  private notify(newState: Partial<AssetProgressState>): void {
    this.currentState = { ...this.currentState, ...newState };
    for (const listener of this.listeners) {
      listener(this.currentState);
    }
  }

  public isCoreLoaded(): boolean {
    return this.coreLoaded;
  }

  public isMapLoaded(mapId: string): boolean {
    if (mapId === DEFAULT_MAP_ID) return true;
    return this.loadedMapIds.has(mapId);
  }

  /**
   * Preload a single asset into the browser's HTTP cache.
   */
  private async loadAsset(entry: AssetManifestEntry): Promise<void> {
    try {
      if (entry.type === 'image') {
        await new Promise<void>((resolve) => {
          const img = new Image();
          img.onload = () => resolve();
          img.onerror = () => resolve(); // Non-blocking on individual failures
          img.src = entry.url;
        });
      } else if (entry.type === 'json' || entry.type === 'audio') {
        const response = await fetch(entry.url, { cache: 'force-cache' });
        await response.blob();
      }
    } catch {
      // Non-blocking on individual hiccups
    }
  }

  /**
   * Run an array of tasks with a maximum concurrency limit.
   */
  private async runConcurrentPool<T>(
    items: T[],
    limit: number,
    fn: (item: T, index: number) => Promise<void>
  ): Promise<void> {
    let index = 0;
    const executing = new Set<Promise<void>>();

    for (const item of items) {
      const currentIndex = index++;
      const p: Promise<void> = fn(item, currentIndex).then(() => {
        executing.delete(p);
      });
      executing.add(p);
      if (executing.size >= limit) {
        await Promise.race(executing);
      }
    }

    await Promise.all(executing);
  }

  /**
   * Preloads all core assets (all units, towers, core UI, audio, and default map).
   */
  public preloadCoreAssets(onProgress?: ProgressCallback): Promise<void> {
    if (this.coreLoaded) {
      this.notify({
        loaded: CORE_ASSETS.length + 1,
        total: CORE_ASSETS.length + 1,
        percentage: 100,
        isBattleReady: true,
        statusLabel: 'Battlefield Ready',
      });
      onProgress?.(CORE_ASSETS.length + 1, CORE_ASSETS.length + 1, 100, 'Battlefield Ready');
      return Promise.resolve();
    }

    if (this.preloadPromise) {
      return this.preloadPromise;
    }

    this.preloadPromise = (async () => {
      const total = CORE_ASSETS.length + 1; // +1 for font readiness
      let completed = 0;

      const report = (label: string) => {
        completed++;
        const pct = Math.min(100, Math.round((completed / total) * 100));
        this.notify({
          loaded: completed,
          total,
          percentage: pct,
          isBattleReady: pct >= 100,
          statusLabel: label,
        });
        onProgress?.(completed, total, pct, label);
      };

      // 1. Ensure fonts are ready
      try {
        if (typeof document !== 'undefined' && 'fonts' in document) {
          await document.fonts.ready;
        }
      } catch {
        // Font loading failed or unsupported
      }
      report('Imperial Fonts Ready');

      // 2. Preload all core assets with concurrency limit
      await this.runConcurrentPool(
        CORE_ASSETS,
        CONCURRENT_DOWNLOAD_LIMIT,
        async (asset) => {
          await this.loadAsset(asset);
          report(`Loading ${asset.label}`);
        }
      );

      this.coreLoaded = true;
      this.notify({
        loaded: total,
        total,
        percentage: 100,
        isBattleReady: true,
        statusLabel: 'Battlefield Ready',
      });

      try {
        if (typeof window !== 'undefined' && window.sessionStorage) {
          window.sessionStorage.setItem(SESSION_STORAGE_KEY, 'true');
        }
      } catch {
        // sessionStorage restricted
      }
    })();

    return this.preloadPromise;
  }

  /**
   * Preloads an extra battlefield map on-demand if not already loaded.
   */
  public async preloadMap(mapId: string): Promise<void> {
    if (this.isMapLoaded(mapId)) return;

    const entries = EXTRA_MAPS[mapId];
    if (!entries || entries.length === 0) return;

    await Promise.all(entries.map((entry) => this.loadAsset(entry)));
    this.loadedMapIds.add(mapId);
  }
}

export const AssetPreloader = new AssetPreloaderService();

/**
 * React hook to observe live asset preloading progress across the application.
 */
export function useAssetDownloadProgress(): AssetProgressState {
  const [state, setState] = useState<AssetProgressState>(() => AssetPreloader.getState());

  useEffect(() => {
    return AssetPreloader.subscribe(setState);
  }, []);

  return state;
}
