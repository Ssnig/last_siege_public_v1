---
name: add-mob
description: "Add a new attacker mob/unit to the game. When the user says /add-mob with a brief description and has placed a mob sprite sheet/assets in the asset folder (or will do so), this skill guides end-to-end integration: adding stats to shared data, wiring animation/manifest in client, placing assets, and ensuring proper loading. If details are missing, it asks targeted questions until all required info is collected."
---

# Add Mob/Unit Skill

This skill is for adding a new attacker unit/mob. Follow these steps precisely.

## Prerequisites & Understanding
Before making changes, understand the unit system:
- **Shared stats**: `packages/shared/src/data/mobs.json` (typed as `MobType` in `packages/shared/src/game/balance.ts`)
- **Client animation/rendering**: `app/client/src/game/animation/UnitAnimationManager.ts` 
  - `UNIT_MANIFESTS`: per-unit render config (frames, frameSize, scale, origin, frameRate, animations)
  - `UNIT_FOLDER_MAP`: maps unit id to asset folder name under `app/client/public/assets/units/`
  - `UNITS_WITH_SPRITESHEET`: set of units that use spritesheets (vs fallbacks)
  - `preload()` loads spritesheet and face icon; `createAnimations()` creates run animation; `spawnMobSprite()` spawns animated sprite
- **Assets**: `app/client/public/assets/units/<folder>/` typically with `spritesheet.png`, `face.png` (or `face.jpg`), optionally `unit_manifest.json`. Some units use fallbacks (grunt uses `/assets/sprites/unit_warrior.png`).
- **Units referenced by id** in shared data and throughout game logic.

## Workflow

### 1) Gather info (ask if missing)
If brief description insufficient, ask until you have:
- **Mob/unit id** (short, lowercase, e.g. `shaman`) - unique key for `mobs.json` and used by client
- **Display name** (e.g. "Tribal Shaman")
- **Stats**: `maxHp`, `speed` (px/s), `bounty` (gold on kill), `leakDamage` (core HP lost if leaks), `cost` (attacker deploy cost), `armor` (0 default), `mentalStrength` (0-1, default 0.5)
- **Asset folder name** under `app/client/public/assets/units/` (e.g. `shaman` or follow existing pattern). Ask if user will place assets there.
- **Sprite sheet info** (if using spritesheet): 
  - Does a spritesheet exist? (`spritesheet.png`)
  - Frame layout: `frames`, `cols`, `rows`, `frameWidth`, `frameHeight`
  - Animation: usually just `run` loop; confirm frame range
  - Render: `scale`, `origin` `{x,y}` (normalized), `frameRate`
- **Face icon**: `face.png` (or confirm fallback). Needed for UI/draft
- **Does it need a spritesheet or can use fallback?** Check existing patterns - most custom units use spritesheets
- **Any special behavior?** (usually just stats; mention if different)

Ask targeted questions - don't guess.

### 2) Add shared stats
Edit `packages/shared/src/data/mobs.json`:
- Add top-level key = mob `id` with full `MobType` fields as shown in existing entries.
- This makes it available via `MOB_TYPES` in shared (used by server/clients).

### 3) Wire client animation/rendering & UI
Edit `app/client/src/game/animation/UnitAnimationManager.ts`:
- **Add to `UNIT_FOLDER_MAP`**: map `id` -> asset folder name (if different from id)
- **Add to `UNITS_WITH_SPRITESHEET`** if using spritesheet: add the id
- **Add entry to `UNIT_MANIFESTS`** with complete manifest (frames/cols/rows/frameWidth/frameHeight/frameRate/scale/origin)
- Follow style of similar units

Edit `app/client/src/componenets/game/unitIcons.ts`:
- Add to `MOB_ICONS` for draft/deploy UI (use face.png if present; copy placeholder if missing)

### 4) Add/place assets
- Create folder `app/client/public/assets/units/<folder>/` if needed
- Place `spritesheet.png` (if using spritesheet), `face.png` (and/or `face.jpg`). If no face yet, copy spritesheet as placeholder.
- Ensure grid dimensions match manifest

### 5) Verify integration (gameplay)
- Attacker draft pulls from `MOB_TYPES` (shared) - works once added to mobs.json
- Attacker deploy/UI uses icons - add mapping
- Animation system loads/spawns via UnitAnimationManager config
- Server uses shared data - rebuild shared
- Rebuild shared package after changes: `npm run build:shared`

## Checklist
- [ ] Mob id added to `packages/shared/src/data/mobs.json` with all required stats
- [ ] Added to `UNIT_FOLDER_MAP` and `UNIT_MANIFESTS` in `UnitAnimationManager.ts`
- [ ] Added to `UNITS_WITH_SPRITESHEET` if using spritesheet
- [ ] Assets placed with correct paths and dimensions matching manifest
- [ ] Shared rebuilt (`npm run build:shared`)
- [ ] Consistent with existing naming/style

## Notes
- Follow existing patterns for similar unit types
- If brief description vague, ask questions before editing. Do not guess stat values.
- Grunt is special (uses different fallback) - most new units should have proper spritesheets
- Keep origin/scale reasonable to match visual style of other units on map


## Cleanup/notes about placeholders
- The project currently treats `shade`, `spider`, `orc`, `gargoyle`, `sapper`, `necromancer`, `ogre` as placeholders - when adding new units, these should be removed if they exist (clean from `packages/shared/src/data/mobs.json`, `UnitAnimationManager.ts` maps/manifests, and `unitIcons.ts`).
- New mobs must be added to shared data (`MOB_TYPES`) so they appear in attacker draft/deploy; add icon in `app/client/src/componenets/game/unitIcons.ts` and wire animation/manifest in `UnitAnimationManager.ts`.
- If the total mob count in the pool goes above 10, the attacker draft UI must have a proper scrollbar to include all mobs (the skill should ensure this behavior holds).