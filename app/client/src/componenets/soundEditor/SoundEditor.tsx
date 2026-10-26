import React, { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { soundEffects } from '../../audio/soundEffects';
import { bgmManager, type BGMTrack } from '../../audio/bgmManager';
import { AudioWaveform } from './AudioWaveform';

interface TowerSoundMeta {
  id: string;
  name: string;
  damageType: 'physical' | 'mental';
  cadence: string;
  cadenceSec: number;
  icon: string;
  description: string;
}

const TOWERS: TowerSoundMeta[] = [
  {
    id: 'archer',
    name: 'Archer Tower',
    damageType: 'physical',
    cadence: '1 shot / 0.5s (2.0/s)',
    cadenceSec: 0.5,
    icon: '/assets/towers/01_archer_tower/icon.png',
    description: 'High-speed rapid anti-swarm sentry firing volleys of piercing arrows.',
  },
  {
    id: 'cannon',
    name: 'Cannon Tower',
    damageType: 'physical',
    cadence: '1 shot / 3.0s (0.33/s)',
    cadenceSec: 3.0,
    icon: '/assets/towers/02_cannon/icon.png',
    description: 'Heavy artillery firing explosive iron cannonballs with a 25% on-hit slow.',
  },
  {
    id: 'bomb',
    name: 'Bomb Throwing Tower',
    damageType: 'physical',
    cadence: '1 shot / 2.0s (0.5/s)',
    cadenceSec: 2.0,
    icon: '/assets/towers/03_bomb_throwing_tower/icon.png',
    description: 'Wide-radius siege mortar hurling high-explosive incendiary canisters.',
  },
  {
    id: 'bell',
    name: 'Bell Tower',
    damageType: 'mental',
    cadence: '1 pulse / 1.5s (0.67/s)',
    cadenceSec: 1.5,
    icon: '/assets/towers/04_bell_tower/icon.jpg',
    description: 'Sacred bronze temple chime emitting harmonic sonic pulses that crack mob resolve.',
  },
  {
    id: 'spear',
    name: 'Spear Tower',
    damageType: 'physical',
    cadence: '1 shot / 1.0s (1.0/s)',
    cadenceSec: 1.0,
    icon: '/assets/towers/05_spear_tower/icon.png',
    description: 'High-tension ballista launching armor-piercing heavy ballista bolts.',
  },
  {
    id: 'gun',
    name: 'Gun Tower',
    damageType: 'physical',
    cadence: '1 shot / 1.0s (1.0/s)',
    cadenceSec: 1.0,
    icon: '/assets/towers/06_gun_tower/icon.png',
    description: 'Precision flintlock barricade firing rapid high-velocity lead shot.',
  },
  {
    id: 'water_cannon',
    name: 'Water Cannon',
    damageType: 'physical',
    cadence: '1 burst / 1.8s (0.56/s)',
    cadenceSec: 1.8,
    icon: '/assets/towers/07_water_cannon/icon.jpg',
    description: 'High-pressure hydraulic torrent drenching attackers with heavy knockback.',
  },
  {
    id: 'chinthe',
    name: 'Chinthe Guardian',
    damageType: 'mental',
    cadence: '1 strike / 2.2s (0.45/s)',
    cadenceSec: 2.2,
    icon: '/assets/towers/08_chinthe_statue/icon.jpg',
    description: 'Mythical stone lion monolith shattering enemy resolve with celestial roar.',
  },
  {
    id: 'dragon',
    name: 'Dragon Tower',
    damageType: 'physical',
    cadence: '1 breath / 1.2s (0.83/s)',
    cadenceSec: 1.2,
    icon: '/assets/towers/09_dragon_tower/icon.jpg',
    description: 'Mythical pyromancer spire incinerating infantry lines with continuous flame.',
  },
  {
    id: 'sein_pyaung',
    name: 'Sein Pyaung Sniper',
    damageType: 'physical',
    cadence: '1 shot / 3.5s (0.29/s)',
    cadenceSec: 3.5,
    icon: '/assets/towers/10_sein_pyaung/icon.jpg',
    description: 'Long-range imperial siege sniper inflicting cataclysmic kinetic crater damage.',
  },
];

export const SoundEditor: React.FC = () => {
  const navigate = useNavigate();

  // Active Tab: towers | ambient | music
  const [activeTab, setActiveTab] = useState<'towers' | 'ambient' | 'music'>('towers');
  const [selectedTower, setSelectedTower] = useState<TowerSoundMeta>(TOWERS[0]);

  // Master Volume & Audio settings
  const [sfxVolume, setSfxVolume] = useState<number>(() => Math.round(soundEffects.getVolume() * 100));
  const [sfxMuted, setSfxMuted] = useState<boolean>(() => soundEffects.getMuted());

  // Waveform trigger flags
  const [shootWaveActive, setShootWaveActive] = useState(false);
  const [impactWaveActive, setImpactWaveActive] = useState(false);

  // Pitch modifier sliders (0.8 to 1.2)
  const [shootPitch, setShootPitch] = useState<number>(1.0);
  const [impactPitch, setImpactPitch] = useState<number>(1.0);

  // Rapid volley / sequence states
  const [isVolleyRunning, setIsVolleyRunning] = useState<boolean>(false);
  const [isComboRunning, setIsComboRunning] = useState<boolean>(false);
  const volleyTimeoutsRef = useRef<number[]>([]);

  // Custom audio files on disk (from /api/dev/list-sounds)
  const [diskAudioFiles, setDiskAudioFiles] = useState<string[]>([]);
  const [statusMessage, setStatusMessage] = useState<{ text: string; isError?: boolean } | null>(null);

  // File upload staging state
  const [shootFilePreview, setShootFilePreview] = useState<{ file: File; base64: string; url: string } | null>(null);
  const [impactFilePreview, setImpactFilePreview] = useState<{ file: File; base64: string; url: string } | null>(null);

  // Music testing state
  const [currentBgmTrack, setCurrentBgmTrack] = useState<BGMTrack | null>(null);

  // Fetch list of custom audio files on mount
  const refreshDiskAudioFiles = async () => {
    try {
      const res = await fetch('/api/dev/list-sounds');
      if (res.ok) {
        const data = await res.json();
        if (data && Array.isArray(data.files)) {
          setDiskAudioFiles(data.files);
          soundEffects.reloadSoundCache();
        }
      }
    } catch {
      // In production or outside Vite dev server
    }
  };

  useEffect(() => {
    refreshDiskAudioFiles();
    return () => {
      volleyTimeoutsRef.current.forEach(clearTimeout);
    };
  }, []);

  // Show status banner temporarily
  const showToast = (text: string, isError = false) => {
    setStatusMessage({ text, isError });
    setTimeout(() => setStatusMessage(null), 3500);
  };

  // Check if selected tower has custom file on disk
  const hasCustomFile = (type: 'shoot' | 'impact') => {
    const prefix = `${selectedTower.id}_${type}.`;
    return diskAudioFiles.some((f) => f.startsWith(prefix));
  };

  const getCustomFileName = (type: 'shoot' | 'impact') => {
    const prefix = `${selectedTower.id}_${type}.`;
    return diskAudioFiles.find((f) => f.startsWith(prefix)) || null;
  };

  // Audition single shot
  const handlePlayShoot = () => {
    soundEffects.playTowerShootAudition(selectedTower.id, shootPitch);
    setShootWaveActive(true);
    setTimeout(() => setShootWaveActive(false), 200);
  };

  // Audition single impact
  const handlePlayImpact = () => {
    soundEffects.playTowerImpactAudition(selectedTower.id, impactPitch);
    setImpactWaveActive(true);
    setTimeout(() => setImpactWaveActive(false), 200);
  };

  // Rapid volley test (5 consecutive shots at the tower's exact fire rate)
  const handleRapidVolley = () => {
    if (isVolleyRunning) return;
    setIsVolleyRunning(true);
    volleyTimeoutsRef.current.forEach(clearTimeout);
    volleyTimeoutsRef.current = [];

    const shots = 5;
    // Cadence in ms
    const intervalMs = Math.max(120, Math.min(selectedTower.cadenceSec * 1000, 1000));

    for (let i = 0; i < shots; i++) {
      const t = window.setTimeout(() => {
        handlePlayShoot();
        if (i === shots - 1) {
          setIsVolleyRunning(false);
        }
      }, i * intervalMs);
      volleyTimeoutsRef.current.push(t);
    }
  };

  // Combat combo test: Shoot -> projectile flight -> impact
  const handleCombatCombo = () => {
    if (isComboRunning) return;
    setIsComboRunning(true);

    handlePlayShoot();

    // Flight delay ~ 320ms
    setTimeout(() => {
      handlePlayImpact();
      setIsComboRunning(false);
    }, 320);
  };

  // File Upload Handlers (Base64 conversion)
  const handleFileSelect = (
    e: React.ChangeEvent<HTMLInputElement>,
    type: 'shoot' | 'impact',
  ) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = () => {
      const base64 = (reader.result as string).split(',')[1];
      const previewUrl = URL.createObjectURL(file);
      if (type === 'shoot') {
        setShootFilePreview({ file, base64, url: previewUrl });
      } else {
        setImpactFilePreview({ file, base64, url: previewUrl });
      }
    };
    reader.readAsDataURL(file);
  };

  // Save custom audio file to disk via Vite dev API
  const handleSaveFileToDisk = async (type: 'shoot' | 'impact') => {
    const preview = type === 'shoot' ? shootFilePreview : impactFilePreview;
    if (!preview) return;

    const ext = preview.file.name.split('.').pop()?.toLowerCase() || 'mp3';
    const fileName = `${selectedTower.id}_${type}.${ext}`;

    try {
      const res = await fetch('/api/dev/save-sound', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          towerId: selectedTower.id,
          soundType: type,
          fileName,
          fileDataBase64: preview.base64,
        }),
      });

      if (res.ok) {
        showToast(`Saved ${fileName} to public/assets/sfx/towers/!`);
        if (type === 'shoot') setShootFilePreview(null);
        else setImpactFilePreview(null);
        await refreshDiskAudioFiles();
      } else {
        const data = await res.json();
        showToast(data.error || 'Failed to save file', true);
      }
    } catch (err: any) {
      showToast(err.message || 'Error saving file', true);
    }
  };

  // Reset custom file back to procedural synthesis
  const handleResetToProcedural = async (type: 'shoot' | 'impact') => {
    const customName = getCustomFileName(type);
    if (!customName) return;

    try {
      const res = await fetch('/api/dev/delete-sound', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ fileName: customName }),
      });

      if (res.ok) {
        showToast(`Removed ${customName}. Reverted to procedural synthesis!`);
        await refreshDiskAudioFiles();
      } else {
        showToast('Failed to reset audio file', true);
      }
    } catch (err: any) {
      showToast(err.message || 'Error resetting audio', true);
    }
  };

  // Full Battery Battle Simulation
  const handleFullBatterySalvo = () => {
    TOWERS.forEach((tower, idx) => {
      setTimeout(() => {
        soundEffects.playTowerShootAudition(tower.id);
        setTimeout(() => {
          soundEffects.playTowerImpactAudition(tower.id);
        }, 280);
      }, idx * 140);
    });
  };

  return (
    <div className="w-full h-full bg-slate-950 text-slate-100 flex flex-col font-sans select-none overflow-hidden">
      {/* 1. TOP HEADER BAR */}
      <header className="h-16 px-6 bg-slate-900/90 border-b border-amber-500/20 flex items-center justify-between shrink-0 shadow-xl backdrop-blur-md z-30">
        <div className="flex items-center gap-4">
          <button
            onClick={() => navigate('/lobby')}
            className="flex items-center gap-2 px-3 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 border border-slate-700 text-amber-300 font-semibold text-xs tracking-wider transition-all cursor-pointer shadow-md"
          >
            ← Exit to Lobby
          </button>
          <div className="h-6 w-[1px] bg-slate-800" />
          <div>
            <h1 className="text-base font-black tracking-wide text-amber-200 flex items-center gap-2 font-serif">
              <span>🔊</span>
              <span>BURMESE TD SOUND & ACOUSTIC STUDIO</span>
            </h1>
            <p className="text-[11px] text-slate-400">
              Interactive audio workbench for defense towers, projectiles, and combat SFX
            </p>
          </div>
        </div>

        {/* Status Toast */}
        {statusMessage && (
          <div
            className={`px-4 py-1.5 rounded-lg text-xs font-semibold shadow-lg border animate-fadeSlide ${
              statusMessage.isError
                ? 'bg-rose-950/80 border-rose-500 text-rose-200'
                : 'bg-emerald-950/80 border-emerald-500 text-emerald-200'
            }`}
          >
            {statusMessage.text}
          </div>
        )}

        {/* Master Controls */}
        <div className="flex items-center gap-6">
          {/* SFX Volume slider */}
          <div className="flex items-center gap-3 bg-slate-950/60 px-3.5 py-1.5 rounded-xl border border-slate-800">
            <button
              onClick={() => {
                const next = !sfxMuted;
                setSfxMuted(next);
                soundEffects.setMuted(next);
              }}
              className="text-sm cursor-pointer hover:scale-110 transition-transform"
              title={sfxMuted ? 'Unmute SFX' : 'Mute SFX'}
            >
              {sfxMuted ? '🔇' : '🔊'}
            </button>
            <div className="flex flex-col">
              <div className="flex justify-between text-[10px] text-slate-400">
                <span>SFX Volume</span>
                <span className="text-amber-400 font-mono">{sfxMuted ? 'Muted' : `${sfxVolume}%`}</span>
              </div>
              <input
                type="range"
                min="0"
                max="100"
                value={sfxMuted ? 0 : sfxVolume}
                onChange={(e) => {
                  const val = Number(e.target.value);
                  setSfxVolume(val);
                  soundEffects.setVolume(val / 100);
                  if (sfxMuted && val > 0) {
                    setSfxMuted(false);
                    soundEffects.setMuted(false);
                  }
                }}
                className="w-28 h-1.5 bg-slate-800 rounded-lg appearance-none cursor-pointer accent-amber-500"
              />
            </div>
          </div>

          {/* Tab Navigation */}
          <div className="flex bg-slate-950/80 p-1 rounded-xl border border-slate-800">
            <button
              onClick={() => setActiveTab('towers')}
              className={`px-3 py-1 rounded-lg text-xs font-bold transition-all cursor-pointer ${
                activeTab === 'towers'
                  ? 'bg-gradient-to-r from-amber-600 to-amber-500 text-slate-950 shadow-md'
                  : 'text-slate-400 hover:text-slate-200'
              }`}
            >
              🏰 Towers (10)
            </button>
            <button
              onClick={() => setActiveTab('ambient')}
              className={`px-3 py-1 rounded-lg text-xs font-bold transition-all cursor-pointer ${
                activeTab === 'ambient'
                  ? 'bg-gradient-to-r from-amber-600 to-amber-500 text-slate-950 shadow-md'
                  : 'text-slate-400 hover:text-slate-200'
              }`}
            >
              🥁 War Drums & Fanfares
            </button>
            <button
              onClick={() => setActiveTab('music')}
              className={`px-3 py-1 rounded-lg text-xs font-bold transition-all cursor-pointer ${
                activeTab === 'music'
                  ? 'bg-gradient-to-r from-amber-600 to-amber-500 text-slate-950 shadow-md'
                  : 'text-slate-400 hover:text-slate-200'
              }`}
            >
              🎵 Soundtracks
            </button>
          </div>
        </div>
      </header>

      {/* 2. MAIN BODY */}
      <div className="flex-1 flex overflow-hidden">
        {activeTab === 'towers' && (
          <>
            {/* LEFT TOWER SELECTOR LIST */}
            <aside className="w-80 border-r border-slate-800/80 bg-slate-900/40 flex flex-col shrink-0">
              <div className="p-3 border-b border-slate-800/60 bg-slate-900/60 flex items-center justify-between">
                <span className="text-xs font-bold text-slate-300 uppercase tracking-wider">
                  Select Tower ({TOWERS.length})
                </span>
                <button
                  onClick={handleFullBatterySalvo}
                  className="px-2.5 py-1 rounded bg-amber-500/20 hover:bg-amber-500/30 border border-amber-500/40 text-[11px] font-bold text-amber-300 transition-all cursor-pointer"
                  title="Fires all 10 towers in succession"
                >
                  ⚡ Salvo Test
                </button>
              </div>

              <div className="flex-1 overflow-y-auto p-2.5 space-y-1.5 custom-scrollbar">
                {TOWERS.map((tower) => {
                  const isSelected = selectedTower.id === tower.id;
                  const hasShootCustom = diskAudioFiles.some((f) => f.startsWith(`${tower.id}_shoot.`));
                  const hasImpactCustom = diskAudioFiles.some((f) => f.startsWith(`${tower.id}_impact.`));

                  return (
                    <div
                      key={tower.id}
                      onClick={() => {
                        setSelectedTower(tower);
                        setShootFilePreview(null);
                        setImpactFilePreview(null);
                      }}
                      className={`p-2.5 rounded-xl border transition-all cursor-pointer flex items-center gap-3 ${
                        isSelected
                          ? 'bg-amber-950/40 border-amber-500/70 shadow-lg shadow-amber-950/30'
                          : 'bg-slate-900/50 border-slate-800/80 hover:bg-slate-850 hover:border-slate-700'
                      }`}
                    >
                      <img
                        src={tower.icon}
                        alt={tower.name}
                        className="w-11 h-11 rounded-lg border border-slate-700 object-cover shrink-0 bg-slate-950"
                        onError={(e) => {
                          (e.target as HTMLImageElement).src = '/assets/towers/01_archer_tower/icon.png';
                        }}
                      />
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center justify-between">
                          <h4
                            className={`text-xs font-bold truncate ${
                              isSelected ? 'text-amber-200' : 'text-slate-200'
                            }`}
                          >
                            {tower.name}
                          </h4>
                          <span
                            className={`text-[9px] px-1.5 py-0.5 rounded font-mono font-bold uppercase ${
                              tower.damageType === 'mental'
                                ? 'bg-purple-950 text-purple-300 border border-purple-700'
                                : 'bg-slate-800 text-slate-300'
                            }`}
                          >
                            {tower.damageType}
                          </span>
                        </div>
                        <p className="text-[10px] text-slate-400 truncate">{tower.cadence}</p>
                        <div className="flex items-center gap-1.5 mt-1">
                          <span
                            className={`text-[9px] px-1 rounded ${
                              hasShootCustom
                                ? 'bg-emerald-950 text-emerald-300 border border-emerald-600'
                                : 'bg-slate-800 text-slate-400'
                            }`}
                          >
                            Shoot: {hasShootCustom ? 'Custom' : 'Synth'}
                          </span>
                          <span
                            className={`text-[9px] px-1 rounded ${
                              hasImpactCustom
                                ? 'bg-emerald-950 text-emerald-300 border border-emerald-600'
                                : 'bg-slate-800 text-slate-400'
                            }`}
                          >
                            Hit: {hasImpactCustom ? 'Custom' : 'Synth'}
                          </span>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            </aside>

            {/* MAIN WORKBENCH FOR SELECTED TOWER */}
            <main className="flex-1 flex flex-col p-6 overflow-y-auto space-y-6">
              {/* TOWER SUMMARY CARD */}
              <div className="p-4 rounded-2xl bg-gradient-to-r from-slate-900 to-slate-900/60 border border-amber-500/30 flex items-center justify-between shadow-xl">
                <div className="flex items-center gap-4">
                  <img
                    src={selectedTower.icon}
                    alt={selectedTower.name}
                    className="w-16 h-16 rounded-xl border-2 border-amber-500/50 shadow-md object-cover bg-slate-950"
                  />
                  <div>
                    <div className="flex items-center gap-2">
                      <h2 className="text-xl font-black text-amber-200 font-serif">{selectedTower.name}</h2>
                      <span className="text-xs px-2 py-0.5 rounded-full font-mono font-bold bg-amber-950 text-amber-300 border border-amber-600">
                        {selectedTower.cadence}
                      </span>
                    </div>
                    <p className="text-xs text-slate-300 max-w-xl mt-1">{selectedTower.description}</p>
                  </div>
                </div>

                <div className="flex gap-2">
                  <button
                    onClick={handleCombatCombo}
                    disabled={isComboRunning}
                    className="px-4 py-2.5 rounded-xl bg-gradient-to-r from-amber-600 to-amber-500 hover:from-amber-500 hover:to-amber-400 text-slate-950 font-bold text-xs tracking-wider shadow-lg transition-all cursor-pointer flex items-center gap-2 disabled:opacity-50"
                  >
                    <span>⚔️</span>
                    <span>Combat Sequence (Shoot → Hit)</span>
                  </button>
                </div>
              </div>

              {/* DUAL SOUND WORKSTATIONS: SHOOTING & IMPACT */}
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                {/* 1. SHOOTING SOUND WORKSTATION */}
                <div className="p-5 rounded-2xl bg-slate-900/60 border border-slate-800 flex flex-col space-y-4 shadow-xl">
                  <div className="flex items-center justify-between border-b border-slate-800 pb-3">
                    <div className="flex items-center gap-2">
                      <span className="text-lg">🏹</span>
                      <h3 className="text-sm font-bold text-amber-100 uppercase tracking-wide">
                        Shooting Sound (Muzzle / Release)
                      </h3>
                    </div>
                    <span
                      className={`text-[10px] px-2 py-0.5 rounded font-mono font-bold ${
                        hasCustomFile('shoot')
                          ? 'bg-emerald-950 text-emerald-300 border border-emerald-600'
                          : 'bg-amber-950/60 text-amber-300 border border-amber-700/60'
                      }`}
                    >
                      {hasCustomFile('shoot') ? `🎵 ${getCustomFileName('shoot')}` : '⚡ Procedural Synthesizer'}
                    </span>
                  </div>

                  {/* Waveform visualizer */}
                  <div className="space-y-1">
                    <div className="flex justify-between text-[11px] text-slate-400">
                      <span>Real-time Waveform</span>
                      <span>Canvas Audio Oscillogram</span>
                    </div>
                    <AudioWaveform active={shootWaveActive} color="#f59e0b" />
                  </div>

                  {/* Pitch Control */}
                  <div className="space-y-1.5 bg-slate-950/40 p-3 rounded-xl border border-slate-850">
                    <div className="flex justify-between text-xs text-slate-300">
                      <span>Pitch Tuning</span>
                      <span className="font-mono text-amber-400">{shootPitch.toFixed(2)}x</span>
                    </div>
                    <input
                      type="range"
                      min="0.8"
                      max="1.2"
                      step="0.02"
                      value={shootPitch}
                      onChange={(e) => setShootPitch(Number(e.target.value))}
                      className="w-full h-1.5 bg-slate-800 rounded-lg appearance-none cursor-pointer accent-amber-500"
                    />
                  </div>

                  {/* Action Buttons */}
                  <div className="grid grid-cols-2 gap-3">
                    <button
                      onClick={handlePlayShoot}
                      className="py-2.5 px-3 rounded-xl bg-slate-800 hover:bg-slate-700 border border-slate-700 text-amber-200 font-bold text-xs tracking-wider transition-all cursor-pointer flex items-center justify-center gap-2"
                    >
                      <span>▶</span>
                      <span>Play Single Shot</span>
                    </button>
                    <button
                      onClick={handleRapidVolley}
                      disabled={isVolleyRunning}
                      className="py-2.5 px-3 rounded-xl bg-amber-600/30 hover:bg-amber-600/40 border border-amber-500/50 text-amber-300 font-bold text-xs tracking-wider transition-all cursor-pointer flex items-center justify-center gap-2 disabled:opacity-50"
                    >
                      <span>⚡</span>
                      <span>{isVolleyRunning ? 'Firing...' : 'Rapid Volley (5x)'}</span>
                    </button>
                  </div>

                  {/* File Replacement Dropzone */}
                  <div className="pt-2 border-t border-slate-800/80 space-y-3">
                    <span className="text-[11px] font-bold text-slate-400 uppercase tracking-wider block">
                      Replace with Custom Sound (.mp3 / .wav)
                    </span>

                    <input
                      type="file"
                      id={`file_shoot_${selectedTower.id}`}
                      accept=".mp3,.wav,.ogg,.m4a"
                      onChange={(e) => handleFileSelect(e, 'shoot')}
                      className="hidden"
                    />

                    {shootFilePreview ? (
                      <div className="p-3 bg-slate-950 rounded-xl border border-amber-500/40 space-y-2">
                        <div className="flex items-center justify-between text-xs">
                          <span className="font-mono text-amber-300 truncate max-w-[200px]">
                            {shootFilePreview.file.name}
                          </span>
                          <span className="text-[10px] text-slate-400">
                            {(shootFilePreview.file.size / 1024).toFixed(1)} KB
                          </span>
                        </div>
                        <audio src={shootFilePreview.url} controls className="w-full h-8" />
                        <div className="flex gap-2 pt-1">
                          <button
                            onClick={() => handleSaveFileToDisk('shoot')}
                            className="flex-1 py-1.5 bg-emerald-600 hover:bg-emerald-500 text-white rounded-lg text-xs font-bold transition-all cursor-pointer shadow-md"
                          >
                            💾 Save & Apply to Game
                          </button>
                          <button
                            onClick={() => setShootFilePreview(null)}
                            className="px-3 py-1.5 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded-lg text-xs transition-all cursor-pointer"
                          >
                            Cancel
                          </button>
                        </div>
                      </div>
                    ) : (
                      <div className="flex gap-2">
                        <label
                          htmlFor={`file_shoot_${selectedTower.id}`}
                          className="flex-1 py-2 px-3 bg-slate-800/80 hover:bg-slate-700/80 border border-dashed border-slate-700 hover:border-amber-500/50 rounded-xl text-center text-xs text-slate-300 cursor-pointer transition-all flex items-center justify-center gap-2"
                        >
                          <span>📁</span>
                          <span>Upload Shoot Sound</span>
                        </label>
                        {hasCustomFile('shoot') && (
                          <button
                            onClick={() => handleResetToProcedural('shoot')}
                            className="px-3 py-2 bg-rose-950/50 hover:bg-rose-900/60 border border-rose-700 text-rose-300 rounded-xl text-xs font-bold transition-all cursor-pointer"
                            title="Delete custom file and revert to procedural synthesizer"
                          >
                            🔄 Reset
                          </button>
                        )}
                      </div>
                    )}
                  </div>
                </div>

                {/* 2. IMPACT SOUND WORKSTATION */}
                <div className="p-5 rounded-2xl bg-slate-900/60 border border-slate-800 flex flex-col space-y-4 shadow-xl">
                  <div className="flex items-center justify-between border-b border-slate-800 pb-3">
                    <div className="flex items-center gap-2">
                      <span className="text-lg">💥</span>
                      <h3 className="text-sm font-bold text-amber-100 uppercase tracking-wide">
                        Impact Sound (Collision / Detonation)
                      </h3>
                    </div>
                    <span
                      className={`text-[10px] px-2 py-0.5 rounded font-mono font-bold ${
                        hasCustomFile('impact')
                          ? 'bg-emerald-950 text-emerald-300 border border-emerald-600'
                          : 'bg-amber-950/60 text-amber-300 border border-amber-700/60'
                      }`}
                    >
                      {hasCustomFile('impact') ? `🎵 ${getCustomFileName('impact')}` : '⚡ Procedural Synthesizer'}
                    </span>
                  </div>

                  {/* Waveform visualizer */}
                  <div className="space-y-1">
                    <div className="flex justify-between text-[11px] text-slate-400">
                      <span>Real-time Waveform</span>
                      <span>Canvas Audio Oscillogram</span>
                    </div>
                    <AudioWaveform active={impactWaveActive} color="#38bdf8" />
                  </div>

                  {/* Pitch Control */}
                  <div className="space-y-1.5 bg-slate-950/40 p-3 rounded-xl border border-slate-850">
                    <div className="flex justify-between text-xs text-slate-300">
                      <span>Pitch Tuning</span>
                      <span className="font-mono text-sky-400">{impactPitch.toFixed(2)}x</span>
                    </div>
                    <input
                      type="range"
                      min="0.8"
                      max="1.2"
                      step="0.02"
                      value={impactPitch}
                      onChange={(e) => setImpactPitch(Number(e.target.value))}
                      className="w-full h-1.5 bg-slate-800 rounded-lg appearance-none cursor-pointer accent-sky-500"
                    />
                  </div>

                  {/* Action Buttons */}
                  <div className="grid grid-cols-2 gap-3">
                    <button
                      onClick={handlePlayImpact}
                      className="py-2.5 px-3 rounded-xl bg-slate-800 hover:bg-slate-700 border border-slate-700 text-sky-200 font-bold text-xs tracking-wider transition-all cursor-pointer flex items-center justify-center gap-2"
                    >
                      <span>▶</span>
                      <span>Play Impact</span>
                    </button>
                    <button
                      onClick={handleCombatCombo}
                      disabled={isComboRunning}
                      className="py-2.5 px-3 rounded-xl bg-sky-600/30 hover:bg-sky-600/40 border border-sky-500/50 text-sky-300 font-bold text-xs tracking-wider transition-all cursor-pointer flex items-center justify-center gap-2 disabled:opacity-50"
                    >
                      <span>🎯</span>
                      <span>Test Combo</span>
                    </button>
                  </div>

                  {/* File Replacement Dropzone */}
                  <div className="pt-2 border-t border-slate-800/80 space-y-3">
                    <span className="text-[11px] font-bold text-slate-400 uppercase tracking-wider block">
                      Replace with Custom Sound (.mp3 / .wav)
                    </span>

                    <input
                      type="file"
                      id={`file_impact_${selectedTower.id}`}
                      accept=".mp3,.wav,.ogg,.m4a"
                      onChange={(e) => handleFileSelect(e, 'impact')}
                      className="hidden"
                    />

                    {impactFilePreview ? (
                      <div className="p-3 bg-slate-950 rounded-xl border border-sky-500/40 space-y-2">
                        <div className="flex items-center justify-between text-xs">
                          <span className="font-mono text-sky-300 truncate max-w-[200px]">
                            {impactFilePreview.file.name}
                          </span>
                          <span className="text-[10px] text-slate-400">
                            {(impactFilePreview.file.size / 1024).toFixed(1)} KB
                          </span>
                        </div>
                        <audio src={impactFilePreview.url} controls className="w-full h-8" />
                        <div className="flex gap-2 pt-1">
                          <button
                            onClick={() => handleSaveFileToDisk('impact')}
                            className="flex-1 py-1.5 bg-emerald-600 hover:bg-emerald-500 text-white rounded-lg text-xs font-bold transition-all cursor-pointer shadow-md"
                          >
                            💾 Save & Apply to Game
                          </button>
                          <button
                            onClick={() => setImpactFilePreview(null)}
                            className="px-3 py-1.5 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded-lg text-xs transition-all cursor-pointer"
                          >
                            Cancel
                          </button>
                        </div>
                      </div>
                    ) : (
                      <div className="flex gap-2">
                        <label
                          htmlFor={`file_impact_${selectedTower.id}`}
                          className="flex-1 py-2 px-3 bg-slate-800/80 hover:bg-slate-700/80 border border-dashed border-slate-700 hover:border-sky-500/50 rounded-xl text-center text-xs text-slate-300 cursor-pointer transition-all flex items-center justify-center gap-2"
                        >
                          <span>📁</span>
                          <span>Upload Impact Sound</span>
                        </label>
                        {hasCustomFile('impact') && (
                          <button
                            onClick={() => handleResetToProcedural('impact')}
                            className="px-3 py-2 bg-rose-950/50 hover:bg-rose-900/60 border border-rose-700 text-rose-300 rounded-xl text-xs font-bold transition-all cursor-pointer"
                            title="Delete custom file and revert to procedural synthesizer"
                          >
                            🔄 Reset
                          </button>
                        )}
                      </div>
                    )}
                  </div>
                </div>
              </div>
            </main>
          </>
        )}

        {/* TAB 2: AMBIENT & COMBAT SFX */}
        {activeTab === 'ambient' && (
          <div className="flex-1 p-8 overflow-y-auto space-y-6">
            <h2 className="text-xl font-black text-amber-200 font-serif">
              Combat & Ceremonial Audio Library
            </h2>

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              {/* War Drums */}
              <div className="p-5 rounded-2xl bg-slate-900 border border-slate-800 space-y-3">
                <h3 className="text-sm font-bold text-amber-300">🥁 Royal War Drums (Sidaw)</h3>
                <p className="text-xs text-slate-400">Resonant Burmese traditional skin war drum hits.</p>
                <div className="space-y-2 pt-2">
                  <button
                    onClick={() => soundEffects.playWarDrum('light')}
                    className="w-full py-2 bg-slate-800 hover:bg-slate-700 rounded-lg text-xs font-bold text-slate-200"
                  >
                    ▶ Light Drum Strike (Countdown)
                  </button>
                  <button
                    onClick={() => soundEffects.playWarDrum('heavy')}
                    className="w-full py-2 bg-slate-800 hover:bg-slate-700 rounded-lg text-xs font-bold text-slate-200"
                  >
                    ▶ Heavy War Drum Thud
                  </button>
                  <button
                    onClick={() => soundEffects.playWarDrum('battleStart')}
                    className="w-full py-2 bg-amber-600 hover:bg-amber-500 text-slate-950 rounded-lg text-xs font-bold shadow-md"
                  >
                    ▶ Battle Start Flam & Gong
                  </button>
                </div>
              </div>

              {/* Match Endings */}
              <div className="p-5 rounded-2xl bg-slate-900 border border-slate-800 space-y-3">
                <h3 className="text-sm font-bold text-amber-300">🎺 Match Endings</h3>
                <p className="text-xs text-slate-400">Triumphant victory fanfare and defeat dirge.</p>
                <div className="space-y-2 pt-2">
                  <button
                    onClick={() => soundEffects.playVictory()}
                    className="w-full py-2 bg-emerald-950/70 hover:bg-emerald-900/70 border border-emerald-600 text-emerald-300 rounded-lg text-xs font-bold"
                  >
                    ▶ Royal Victory Fanfare & Gong
                  </button>
                  <button
                    onClick={() => soundEffects.playDefeat()}
                    className="w-full py-2 bg-rose-950/70 hover:bg-rose-900/70 border border-rose-600 text-rose-300 rounded-lg text-xs font-bold"
                  >
                    ▶ Somber Defeat Dirge & Collapse
                  </button>
                </div>
              </div>

              {/* UI Sounds */}
              <div className="p-5 rounded-2xl bg-slate-900 border border-slate-800 space-y-3">
                <h3 className="text-sm font-bold text-amber-300">🖱️ UI Interface SFX</h3>
                <p className="text-xs text-slate-400">Procedural tactile feedback clicks and modals.</p>
                <div className="space-y-2 pt-2">
                  <button
                    onClick={() => soundEffects.playHover()}
                    className="w-full py-2 bg-slate-800 hover:bg-slate-700 rounded-lg text-xs font-bold text-slate-200"
                  >
                    ▶ Play Hover Tick
                  </button>
                  <button
                    onClick={() => soundEffects.playClick()}
                    className="w-full py-2 bg-slate-800 hover:bg-slate-700 rounded-lg text-xs font-bold text-slate-200"
                  >
                    ▶ Play Click Drum
                  </button>
                  <button
                    onClick={() => soundEffects.playModal()}
                    className="w-full py-2 bg-slate-800 hover:bg-slate-700 rounded-lg text-xs font-bold text-slate-200"
                  >
                    ▶ Play Modal Swell
                  </button>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* TAB 3: MUSIC SOUNDTRACKS */}
        {activeTab === 'music' && (
          <div className="flex-1 p-8 overflow-y-auto space-y-6">
            <h2 className="text-xl font-black text-amber-200 font-serif">
              Game Soundtrack Station
            </h2>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              {[
                { track: 'lobby' as BGMTrack, title: 'Lobby.mp3 (Menu & Lobby)', desc: 'Lush imperial orchestration for navigation and matchmaking.' },
                { track: 'draft' as BGMTrack, title: 'DraftPhase.mp3 (Pre-Draft & Drafting)', desc: 'Tense tactical anticipation track for card selection.' },
                { track: 'in_game' as BGMTrack, title: 'InGameMusic.mp3 (Building & Combat)', desc: 'High-energy siege combat battle soundtrack.' },
                { track: 'soundtrack_1' as BGMTrack, title: 'Soundtrack1.mp3 (Auxiliary Soundtrack)', desc: 'Secondary historical battle arrangement.' },
              ].map((item) => (
                <div key={item.track} className="p-5 rounded-2xl bg-slate-900 border border-slate-800 space-y-3">
                  <div className="flex items-center justify-between">
                    <h3 className="text-sm font-bold text-amber-300">{item.title}</h3>
                    {currentBgmTrack === item.track && (
                      <span className="text-[10px] px-2 py-0.5 rounded-full bg-emerald-950 text-emerald-300 border border-emerald-600 animate-pulse font-bold">
                        Playing
                      </span>
                    )}
                  </div>
                  <p className="text-xs text-slate-400">{item.desc}</p>
                  <div className="flex gap-2 pt-2">
                    <button
                      onClick={() => {
                        bgmManager.playTrack(item.track, 400);
                        setCurrentBgmTrack(item.track);
                      }}
                      className="flex-1 py-2 bg-amber-600 hover:bg-amber-500 text-slate-950 font-bold rounded-lg text-xs cursor-pointer shadow-md"
                    >
                      ▶ Play Soundtrack
                    </button>
                    {currentBgmTrack === item.track && (
                      <button
                        onClick={() => {
                          bgmManager.stop(300);
                          setCurrentBgmTrack(null);
                        }}
                        className="px-4 py-2 bg-rose-950 hover:bg-rose-900 border border-rose-700 text-rose-300 font-bold rounded-lg text-xs cursor-pointer"
                      >
                        ⏹ Stop
                      </button>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
};
