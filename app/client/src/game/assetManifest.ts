export interface AssetManifestEntry {
  id: string;
  url: string;
  type: 'image' | 'json' | 'audio';
  category: 'ui' | 'map' | 'tower' | 'unit' | 'prop' | 'audio';
  label: string;
}

export const DEFAULT_MAP_ID = 'konbaung';

export const MAP_IMAGE_URLS: Record<string, { map: string; base: string }> = {
  konbaung: {
    map: '/assets/maps/map_1_konbaung/map.webp',
    base: '/assets/maps/map_1_konbaung/base.webp',
  },
  bagan: {
    map: '/assets/maps/map_2_bagan/map.webp',
    base: '/assets/maps/map_2_bagan/base.webp',
  },
  inle: {
    map: '/assets/maps/map_3_inle/map.webp',
    base: '/assets/maps/map_3_inle/base.webp',
  },
  mandalay: {
    map: '/assets/maps/map_4_mandalay/map.webp',
    base: '/assets/maps/map_4_mandalay/base.webp',
  },
  innwa: {
    map: '/assets/maps/map_5_innwa/map.webp',
    base: '/assets/maps/map_5_innwa/base.webp',
  },
  bago: {
    map: '/assets/maps/map_6_bago/map.webp',
    base: '/assets/maps/map_6_bago/base.webp',
  },
  deserted: {
    map: '/assets/maps/map_7_deserted/map.webp',
    base: '/assets/maps/map_7_deserted/base.webp',
  },
  twister: {
    map: '/assets/maps/map_8_twister/map.webp',
    base: '/assets/maps/map_8_twister/base.webp',
  },
  river: {
    map: '/assets/maps/map_9_river/map.webp',
    base: '/assets/maps/map_9_river/base.webp',
  },
};

/**
 * Core assets preloaded on initial site entry.
 * Includes all units, all towers, core UI, and the default map (Konbaung).
 */
export const CORE_ASSETS: AssetManifestEntry[] = [
  // Default Map (Konbaung)
  { id: 'map_konbaung', url: '/assets/maps/map_1_konbaung/map.webp', type: 'image', category: 'map', label: 'Konbaung Battlefield' },
  { id: 'base_konbaung', url: '/assets/maps/map_1_konbaung/base.webp', type: 'image', category: 'map', label: 'Konbaung Citadel' },
  { id: 'base_castle', url: '/assets/sprites/base_castle.png', type: 'image', category: 'map', label: 'Royal Base Castle' },
  { id: 'spawn_1', url: '/assets/sprites/spawn1.png', type: 'image', category: 'map', label: 'Portal Gate 1' },
  { id: 'spawn_2', url: '/assets/sprites/spawn2.png', type: 'image', category: 'map', label: 'Portal Gate 2' },
  { id: 'spawn_3', url: '/assets/sprites/spawn3.png', type: 'image', category: 'map', label: 'Portal Gate 3' },
  { id: 'spawn_4', url: '/assets/sprites/spawn4.png', type: 'image', category: 'map', label: 'Portal Gate 4' },
  { id: 'spawn_5', url: '/assets/sprites/spawn5.png', type: 'image', category: 'map', label: 'Portal Gate 5' },
  { id: 'spawn_6', url: '/assets/sprites/spawn6.png', type: 'image', category: 'map', label: 'Portal Gate 6' },
  { id: 'arrow_proj', url: '/assets/sprites/arrow.png', type: 'image', category: 'tower', label: 'Arrow Projectile' },
  { id: 'tower_placeholder_1', url: '/assets/tower_placeholder/tower_placeholder_1.webp', type: 'image', category: 'tower', label: 'Tower Foundation' },

  // Core UI
  { id: 'ui_bg_main', url: '/assets/ui/bg.webp', type: 'image', category: 'ui', label: 'Imperial Background' },
  { id: 'ui_bg_alt', url: '/assets/ui/bg2.webp', type: 'image', category: 'ui', label: 'Royal Background' },
  { id: 'ui_left_panel', url: '/assets/ui/left_panel_tight.png', type: 'image', category: 'ui', label: 'Lobby Navigation Panel' },
  { id: 'ui_right_panel', url: '/assets/ui/right_panel_tight.png', type: 'image', category: 'ui', label: 'Matchmaking Panel' },
  { id: 'ui_play_btn', url: '/assets/ui/play_button_clean.png', type: 'image', category: 'ui', label: 'Play Button' },
  { id: 'ui_atlas_img', url: '/assets/ui/UI.png', type: 'image', category: 'ui', label: 'UI Texture Sheet' },
  { id: 'ui_bg_atlas_img', url: '/assets/ui/UI_bg.png', type: 'image', category: 'ui', label: 'UI Frame Atlas' },
  { id: 'ui_bg_atlas_json', url: '/assets/ui/UI_bg.json', type: 'json', category: 'ui', label: 'UI Frame Coordinates' },
  { id: 'hud_gold_badge', url: '/assets/ui/hud/hud_gold_badge.png', type: 'image', category: 'ui', label: 'HUD Gold Badge' },
  { id: 'hud_gold_badge_clean', url: '/assets/ui/hud/hud_gold_badge_clean.png', type: 'image', category: 'ui', label: 'HUD Clean Gold Badge' },
  { id: 'hud_settings_btn', url: '/assets/ui/hud/hud_settings_btn.png', type: 'image', category: 'ui', label: 'HUD Settings' },
  { id: 'hud_tray_bg', url: '/assets/ui/hud/hud_tray_bg.png', type: 'image', category: 'ui', label: 'HUD Deck Tray' },
  { id: 'hud_wave_banner', url: '/assets/ui/hud/hud_wave_banner.png', type: 'image', category: 'ui', label: 'HUD Wave Banner' },
  { id: 'slot_active_halo', url: '/assets/ui/hud/slot_active_halo.png', type: 'image', category: 'ui', label: 'Slot Active Halo' },

  // Towers
  { id: 't01_tower', url: '/assets/towers/01_archer_tower/sheet.webp', type: 'image', category: 'tower', label: 'Archer Tower' },
  { id: 't01_proj', url: '/assets/towers/01_archer_tower/projectile_vfx.webp', type: 'image', category: 'tower', label: 'Archer Arrow' },
  { id: 't01_icon', url: '/assets/towers/01_archer_tower/icon.webp', type: 'image', category: 'tower', label: 'Archer Icon' },

  { id: 't02_tower', url: '/assets/towers/02_crossbow_fort/sheet.webp', type: 'image', category: 'tower', label: 'Crossbow Fort' },
  { id: 't02_proj', url: '/assets/towers/02_crossbow_fort/projectile_vfx.webp', type: 'image', category: 'tower', label: 'Crossbow Bolt' },
  { id: 't02_icon', url: '/assets/towers/02_crossbow_fort/icon.webp', type: 'image', category: 'tower', label: 'Crossbow Fort Icon' },
  { id: 't02_stun_vfx', url: '/assets/towers/02_crossbow_fort/stun_vfx.webp', type: 'image', category: 'tower', label: 'Crossbow Stun VFX' },

  { id: 't03_tower', url: '/assets/towers/03_bomb_throwing_tower/sheet.webp', type: 'image', category: 'tower', label: 'Bomb Tower' },
  { id: 't03_proj', url: '/assets/towers/03_bomb_throwing_tower/projectile_vfx.webp', type: 'image', category: 'tower', label: 'Bomb Projectile' },
  { id: 't03_icon', url: '/assets/towers/03_bomb_throwing_tower/icon.webp', type: 'image', category: 'tower', label: 'Bomb Icon' },

  { id: 't04_tower', url: '/assets/towers/04_bell_tower/bell_tower.webp', type: 'image', category: 'tower', label: 'Bell Tower' },
  { id: 't04_vfx', url: '/assets/towers/04_bell_tower/attack_vfx.webp', type: 'image', category: 'tower', label: 'Bell Sound Pulse VFX' },
  { id: 't04_icon', url: '/assets/towers/04_bell_tower/icon.webp', type: 'image', category: 'tower', label: 'Bell Tower Icon' },

  { id: 't05_tower', url: '/assets/towers/05_spear_tower/sheet.webp', type: 'image', category: 'tower', label: 'Spear Tower' },
  { id: 't05_proj', url: '/assets/towers/05_spear_tower/projectile_vfx.webp', type: 'image', category: 'tower', label: 'Spear Projectile' },
  { id: 't05_icon', url: '/assets/towers/05_spear_tower/icon.webp', type: 'image', category: 'tower', label: 'Spear Icon' },

  { id: 't06_tower', url: '/assets/towers/06_gun_tower/sheet.webp', type: 'image', category: 'tower', label: 'Gun Tower' },
  { id: 't06_proj', url: '/assets/towers/06_gun_tower/shooting_vfx.webp', type: 'image', category: 'tower', label: 'Gunshot' },
  { id: 't06_icon', url: '/assets/towers/06_gun_tower/icon.webp', type: 'image', category: 'tower', label: 'Gun Tower Icon' },

  { id: 't07_tower', url: '/assets/towers/07_water_cannon/tower.webp', type: 'image', category: 'tower', label: 'Water Cannon Base' },
  { id: 't07_gun', url: '/assets/towers/07_water_cannon/water_gun.webp', type: 'image', category: 'tower', label: 'Water Cannon Gun' },
  { id: 't07_gun_mirr', url: '/assets/towers/07_water_cannon/water_gun_mirrored.webp', type: 'image', category: 'tower', label: 'Water Cannon Mirrored' },
  { id: 't07_proj', url: '/assets/towers/07_water_cannon/projectile.webp', type: 'image', category: 'tower', label: 'Water Splash' },
  { id: 't07_icon', url: '/assets/towers/07_water_cannon/icon.webp', type: 'image', category: 'tower', label: 'Water Cannon Icon' },

  { id: 't08_tower', url: '/assets/towers/08_chinthe_statue/tower.webp', type: 'image', category: 'tower', label: 'Chinthe Base' },
  { id: 't08_lion', url: '/assets/towers/08_chinthe_statue/lion_gurdian.webp', type: 'image', category: 'tower', label: 'Chinthe Guardian' },
  { id: 't08_lion_mirr', url: '/assets/towers/08_chinthe_statue/lion_gurdian_mirrored.webp', type: 'image', category: 'tower', label: 'Chinthe Mirrored' },
  { id: 't08_anim', url: '/assets/towers/08_chinthe_statue/new_projectile.webp', type: 'image', category: 'tower', label: 'Chinthe Blast' },
  { id: 't08_proj', url: '/assets/towers/08_chinthe_statue/new_projectile.webp', type: 'image', category: 'tower', label: 'Chinthe Projectile' },
  { id: 't08_empowered_proj', url: '/assets/towers/08_chinthe_statue/new_empowered_projectile.webp', type: 'image', category: 'tower', label: 'Chinthe Empowered Projectile' },
  { id: 't08_icon', url: '/assets/towers/08_chinthe_statue/icon.webp', type: 'image', category: 'tower', label: 'Chinthe Icon' },

  { id: 't09_tower', url: '/assets/towers/09_dragon_tower/tower.webp', type: 'image', category: 'tower', label: 'Dragon Base' },
  { id: 't09_dragon', url: '/assets/towers/09_dragon_tower/dragon_tower.webp', type: 'image', category: 'tower', label: 'Dragon Tower' },
  { id: 't09_dragon_mirr', url: '/assets/towers/09_dragon_tower/dragon_tower_mirrored.webp', type: 'image', category: 'tower', label: 'Dragon Mirrored' },
  { id: 't09_anim', url: '/assets/towers/09_dragon_tower/dragon_attack.webp', type: 'image', category: 'tower', label: 'Dragon Fire Attack' },
  { id: 't09_skill_vfx', url: '/assets/towers/09_dragon_tower/skill_vfx.webp', type: 'image', category: 'tower', label: 'Dragon Cataclysmic Detonation VFX' },
  { id: 't09_icon', url: '/assets/towers/09_dragon_tower/icon.webp', type: 'image', category: 'tower', label: 'Dragon Icon' },

  { id: 't10_tower', url: '/assets/towers/10_sein_pyaung/sein_pyaung.webp', type: 'image', category: 'tower', label: 'Sein Pyaung Sniper' },
  { id: 't10_tower_mirr', url: '/assets/towers/10_sein_pyaung/sein_pyaung_mirrored.webp', type: 'image', category: 'tower', label: 'Sein Pyaung Mirrored' },
  { id: 't10_vfx', url: '/assets/towers/10_sein_pyaung/vfx.webp', type: 'image', category: 'tower', label: 'Sein Pyaung Shot VFX' },
  { id: 't10_icon', url: '/assets/towers/10_sein_pyaung/icon.webp', type: 'image', category: 'tower', label: 'Sein Pyaung Icon' },

  // Units
  { id: 'u_horse_rider_sheet', url: '/assets/units/horse_rider/spritesheet.webp', type: 'image', category: 'unit', label: 'Konbaung Cavalry' },
  { id: 'u_horse_rider_face', url: '/assets/units/horse_rider/face.webp', type: 'image', category: 'unit', label: 'Cavalry Icon' },

  { id: 'u_sar_bal_gyi_sheet', url: '/assets/units/sar_bal_gyi/spritesheet.webp', type: 'image', category: 'unit', label: 'Sar Bal Gyi' },
  { id: 'u_sar_bal_gyi_face', url: '/assets/units/sar_bal_gyi/face.webp', type: 'image', category: 'unit', label: 'Sar Bal Gyi Icon' },

  { id: 'u_gya_pu_sheet', url: '/assets/units/gya_pu/spritesheet.webp', type: 'image', category: 'unit', label: 'Gya Pu' },
  { id: 'u_gya_pu_face', url: '/assets/units/gya_pu/face.webp', type: 'image', category: 'unit', label: 'Gya Pu Icon' },

  { id: 'u_a_ba_sheet', url: '/assets/units/a_ba/spritesheet.webp', type: 'image', category: 'unit', label: 'A Ba' },
  { id: 'u_a_ba_face', url: '/assets/units/a_ba/face.webp', type: 'image', category: 'unit', label: 'A Ba Icon' },

  { id: 'u_chon_toe_sheet', url: '/assets/units/chon_toe/spritesheet.webp', type: 'image', category: 'unit', label: 'Chon Toe' },
  { id: 'u_chon_toe_face', url: '/assets/units/chon_toe/face.webp', type: 'image', category: 'unit', label: 'Chon Toe Icon' },

  { id: 'u_elephant_rider_sheet', url: '/assets/units/elephant_rider/elephant_rider.webp', type: 'image', category: 'unit', label: 'Elephant Rider' },
  { id: 'u_elephant_rider_face', url: '/assets/units/elephant_rider/face.webp', type: 'image', category: 'unit', label: 'Elephant Rider Icon' },

  { id: 'u_monkey_sheet', url: '/assets/units/monkey/spritesheet.webp', type: 'image', category: 'unit', label: 'Monkey Warrior' },
  { id: 'u_monkey_face', url: '/assets/units/monkey/face.webp', type: 'image', category: 'unit', label: 'Monkey Warrior Icon' },

  { id: 'u_say_sayar_sheet', url: '/assets/units/say_sayar/say_sayar.webp', type: 'image', category: 'unit', label: 'Say Sayar' },
  { id: 'u_say_sayar_face', url: '/assets/units/say_sayar/face.webp', type: 'image', category: 'unit', label: 'Say Sayar Icon' },
  { id: 'u_say_sayar_heal_vfx', url: '/assets/units/say_sayar/heal_vfx.webp', type: 'image', category: 'unit', label: 'Heal Aura VFX' },

  { id: 'u_shield_guy_sheet', url: '/assets/units/shield_guy/shield_guy.webp', type: 'image', category: 'unit', label: 'Shield Guy' },
  { id: 'u_shield_guy_face', url: '/assets/units/shield_guy/face.webp', type: 'image', category: 'unit', label: 'Shield Guy Icon' },

  { id: 'u_doe_pat_sheet', url: '/assets/units/doe_pat/sheet.webp', type: 'image', category: 'unit', label: 'Doe Pat' },
  { id: 'u_doe_pat_face', url: '/assets/units/doe_pat/face.webp', type: 'image', category: 'unit', label: 'Doe Pat Icon' },
  { id: 'u_doe_pat_speed_vfx', url: '/assets/units/doe_pat/speed_boost_vfx.webp', type: 'image', category: 'unit', label: 'Speed Boost VFX' },

  { id: 'u_bandit_face', url: '/assets/units/Bandit/face.webp', type: 'image', category: 'unit', label: 'Bandit Icon' },
  { id: 'u_belu_face', url: '/assets/units/Belu/face.webp', type: 'image', category: 'unit', label: 'Belu Icon' },
  { id: 'u_belu_skill_vfx', url: '/assets/units/Belu/skill_vfx.webp', type: 'image', category: 'unit', label: 'Belu Skill VFX' },
  { id: 'u_brute_face', url: '/assets/units/Brute/face.webp', type: 'image', category: 'unit', label: 'Brute Icon' },
  { id: 'u_general_face', url: '/assets/units/General/face.webp', type: 'image', category: 'unit', label: 'Bo General Icon' },
  { id: 'u_sone_ma_face', url: '/assets/units/SoneMa/face.webp', type: 'image', category: 'unit', label: 'Sone Ma Icon' },
  { id: 'u_sone_ma_skill_vfx', url: '/assets/units/SoneMa/skill_vfx.webp', type: 'image', category: 'unit', label: 'Sone Ma Skill VFX' },
  { id: 'u_brute_heal_vfx', url: '/assets/units/say_sayar/heal_vfx.webp', type: 'image', category: 'unit', label: 'Brute Self-Heal VFX' },

  // Audio
  { id: 'music_lobby', url: '/assets/music/Lobby.mp3', type: 'audio', category: 'audio', label: 'Lobby & Menu Theme' },
  { id: 'music_draft', url: '/assets/music/DraftPhase.mp3', type: 'audio', category: 'audio', label: 'Draft Phase Theme' },
  { id: 'music_battle', url: '/assets/music/InGameMusic.mp3', type: 'audio', category: 'audio', label: 'In-Game Battle Theme' },
  { id: 'music_soundtrack1', url: '/assets/music/Soundtrack1.mp3', type: 'audio', category: 'audio', label: 'Soundtrack 1' },
];

/**
 * On-demand optional map manifests.
 * Downloaded only when a user selects or plays on these specific battlefields.
 */
export const EXTRA_MAPS: Record<string, AssetManifestEntry[]> = {
  bagan: [
    { id: 'map_bagan', url: '/assets/maps/map_2_bagan/map.webp', type: 'image', category: 'map', label: 'Bagan Battlefield' },
    { id: 'base_bagan', url: '/assets/maps/map_2_bagan/base.webp', type: 'image', category: 'map', label: 'Bagan Citadel' },
  ],
  inle: [
    { id: 'map_inle', url: '/assets/maps/map_3_inle/map.webp', type: 'image', category: 'map', label: 'Inle Battlefield' },
    { id: 'base_inle', url: '/assets/maps/map_3_inle/base.webp', type: 'image', category: 'map', label: 'Inle Citadel' },
  ],
  mandalay: [
    { id: 'map_mandalay', url: '/assets/maps/map_4_mandalay/map.webp', type: 'image', category: 'map', label: 'Mandalay Battlefield' },
    { id: 'base_mandalay', url: '/assets/maps/map_4_mandalay/base.webp', type: 'image', category: 'map', label: 'Mandalay Citadel' },
  ],
  innwa: [
    { id: 'map_innwa', url: '/assets/maps/map_5_innwa/map.webp', type: 'image', category: 'map', label: 'Innwa Battlefield' },
    { id: 'base_innwa', url: '/assets/maps/map_5_innwa/base.webp', type: 'image', category: 'map', label: 'Innwa Citadel' },
  ],
  bago: [
    { id: 'map_bago', url: '/assets/maps/map_6_bago/map.webp', type: 'image', category: 'map', label: 'Bago Battlefield' },
    { id: 'base_bago', url: '/assets/maps/map_6_bago/base.webp', type: 'image', category: 'map', label: 'Bago Citadel' },
  ],
  deserted: [
    { id: 'map_deserted', url: '/assets/maps/map_7_deserted/map.webp', type: 'image', category: 'map', label: 'Deserted Plains' },
    { id: 'base_deserted', url: '/assets/maps/map_7_deserted/base.webp', type: 'image', category: 'map', label: 'Sri Ksetra Citadel' },
  ],
  twister: [
    { id: 'map_twister', url: '/assets/maps/map_8_twister/map.webp', type: 'image', category: 'map', label: 'Taungoo Pass' },
    { id: 'base_twister', url: '/assets/maps/map_8_twister/base.webp', type: 'image', category: 'map', label: 'Taungoo Citadel' },
  ],
  river: [
    { id: 'map_river', url: '/assets/maps/map_9_river/map.webp', type: 'image', category: 'map', label: 'Ayeyarwady River' },
    { id: 'base_river', url: '/assets/maps/map_9_river/base.webp', type: 'image', category: 'map', label: 'Ayeyarwady Citadel' },
  ],
};
