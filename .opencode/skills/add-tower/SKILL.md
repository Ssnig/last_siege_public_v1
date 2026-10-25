---
name: add-tower
description: "Add a new tower to the game. When the user says /add-tower with a brief description and has placed a tower sprite sheet/image(s) in the appropriate asset folder (or will do so), this skill guides end-to-end integration: adding stats to shared data, creating tower design config, placing assets, and ensuring client/server loading. If details are missing, it asks targeted questions until all required info is collected."
---

# Add Tower Skill

This skill is for adding a new defender tower. Follow these steps precisely to avoid missing any integration points.

## Prerequisites & Understanding
Before making changes, understand the tower system:
- **Shared stats**: `packages/shared/src/data/towers.json` (and typed via `packages/shared/src/game/balance.ts` as `TowerType`/`TowerTier`)
- **Design/render config**: `packages/shared/src/game/towerDesigns.ts` (`TOWER_DESIGNS`, `ACTIVE_TOWER_IDS`, `getTowerDesign`)
- **Client assets**: `app/client/public/assets/towers/<NN_name>/` with at least `tower.png`, `projectile.png`, `icon.png`. Some also have `tower_spec.json` (optional metadata). 
- **Client loading**: `app/client/src/game/GameScene.ts` auto-loads all entries from `TOWER_DESIGNS` (textureKey/projectileKey). `app/client/src/game/towers/TowerHolder.ts` uses `getTowerDesign()` to render.
- **Towers are referenced by `typeId`** throughout (server/client). Stats must exist in `packages/shared/src/data/towers.json` keyed by the tower's `id`.

## Workflow

### 1) Gather info (ask if missing)
If the user's brief description doesn't include enough info, ask a focused set of questions until you have:
- **Tower id** (short, lowercase, e.g. `ballista`) - must be unique and match key in `towers.json`
- **Display name** (e.g. "Ballista Tower")
- **Damage type** (`physical` or `mental`) - see balance rules (mental ignores armor/cracks resolve)
- **Splash?** (`true/false`, and `splashRadius` if true)
- **3 tiers of stats**: for each tier need `cost`, `damage`, `range`, `fireRate`, `projectileSpeed`, and optionally `damageMax` (if damage range). 
- **Asset folder name** (e.g. `07_ballista`) - follow existing numbering/pattern (`01_archer_tower`, `02_cannon`, ...). If user hasn't created it, ask where assets will go or create structure.
- **Asset files**: confirm `tower.png`, `projectile.png`, `icon.png` exist in that folder (user says "put the tower or mob sprite sheet in the asset folder" - for towers usually separate images; follow existing pattern). If sprite sheet provided instead, clarify how to split/use.
- **Display/render details**: `displaySize` (width/height), `origin` (x,y normalized), `shortName` (2-4 chars), `tactical` info (`title`, `weakness`, `stacks`) - use sensible defaults if not specified but must be filled.
- **Aliases** (optional) for backwards compatibility
- **Projectile metadata** (optional) like in `tower_spec.json`

Do **not** guess wildly - ask targeted questions. Collect all necessary info before editing.

### 2) Add shared stats
Edit `packages/shared/src/data/towers.json`:
- Add a new top-level key = tower `id` with structure matching others (include `damageType`, optional `splashRadius`, and `tiers` array of 3 objects with required fields).

### 3) Add tower design config & activate for gameplay
Edit `packages/shared/src/game/towerDesigns.ts`:
- Add entry to `TOWER_DESIGNS` with full `TowerDesignConfig`:
  - `id`, `folder` (asset subfolder name under `app/client/public/assets/towers/`), `name`, `shortName`, `aliases` (array), `textureKey`, `texturePath` (pointing to tower image), `projectileKey`, `projectilePath`, `iconPath`, `displaySize`, `origin`, `tactical`
- **Add the tower `id` to `ACTIVE_TOWER_IDS`** (controls defender draft/deck/tray availability). Usually append or place in desired order; ask if unsure.
- Ensure `getTowerDesign` resolves by id/alias (existing logic already does this)

### 4) Add/place assets
- Create folder `app/client/public/assets/towers/<folder>/` if not exists
- Place `tower.png`, `projectile.png`, `icon.png` there (match paths in design config). If user gives a sprite sheet, you need to extract/split appropriately to match existing style.
- Optionally add `tower_spec.json` matching the pattern (id, dir_name, name, description, projectile info)

### 5) Verify integration (gameplay)
- `app/client/src/game/GameScene.ts` auto-loads from `TOWER_DESIGNS` - no change needed if design added correctly
- `app/client/src/game/towers/TowerHolder.ts` uses `getTowerDesign()` - works if design correct
- `ACTIVE_TOWER_IDS` gates availability in defender draft/UI - **must be updated** for the tower to appear and be draftable/deployable
- Server uses shared tower data from rebuilt `packages/shared` - rebuild required
- Rebuild shared package after changes: `npm run build:shared`

### 6) Test/validate
- Check for syntax errors by building shared
- Optionally look up how tower is used in UI/deck - should just work if added to `ACTIVE_TOWER_IDS` and data correct

## Checklist
- [ ] Tower id unique, added to `packages/shared/src/data/towers.json` with valid tiers
- [ ] Design added to `packages/shared/src/game/towerDesigns.ts` and id in `ACTIVE_TOWER_IDS` (if intended playable)
- [ ] Assets placed in `app/client/public/assets/towers/<folder>/` with correct paths
- [ ] Shared rebuilt (`npm run build:shared`)
- [ ] No missing fields that would break types

## Notes
- Follow existing naming conventions (numbered folders, lowercase ids)
- If brief description is vague, ask questions before editing files. Do not assume values - confirm.
- Keep changes minimal and consistent with surrounding style.


## Cleanup/notes about placeholders
- The project currently treats `arcanist`, `tesla`, `archmage`, `bertha`, `sniper` as placeholders in the legacy data/UI - do not add them back. If removing old placeholders, also clean tower data/designs and any UI references.
- When adding a new tower, ensure it gets added to `ACTIVE_TOWER_IDS` in `packages/shared/src/game/towerDesigns.ts` so it appears in defender draft/deploy.
- If the total tower count in the pool goes above 10, the defender draft UI must have a proper scrollbar to include all towers (the skill should ensure this behavior holds).