import os
import re

REPO_ROOT = "/home/htetoowai/Coding/Projects/GameDev/the-td"
PUBLIC_DIR = os.path.join(REPO_ROOT, "app/client/public")

FILES_TO_UPDATE = [
    "packages/shared/src/game/towers/definitions.ts",
    "packages/shared/src/game/maps.ts",
    "packages/shared/src/game/props.ts",
    "packages/shared/src/game/rankingConfig.ts",
    "app/client/src/game/assetManifest.ts",
    "app/client/src/game/GameScene.ts",
    "app/client/src/game/animation/UnitAnimationManager.ts",
    "app/client/src/game/animation/TowerAnimationManager.ts",
    "app/client/src/game/stages/GameplayStage.ts",
    "app/client/src/components/match/MatchLoadingScreen.tsx",
    "app/client/src/components/game/GameOverOverlay.tsx",
    "app/client/src/components/game/MatchResultModal.tsx",
]

def update_file(rel_path):
    abs_path = os.path.join(REPO_ROOT, rel_path)
    if not os.path.exists(abs_path):
        print(f"Skipping missing file: {rel_path}")
        return
        
    with open(abs_path, "r", encoding="utf-8") as f:
        content = f.read()

    def replace_asset_path(match):
        url = match.group(1)
        ext = os.path.splitext(url)[1].lower()
        if ext in ['.png', '.jpg', '.jpeg']:
            # Check if webp version exists on disk
            clean_url = url.lstrip('/')
            base_no_ext = os.path.splitext(clean_url)[0]
            webp_disk = os.path.join(PUBLIC_DIR, base_no_ext + '.webp')
            if os.path.exists(webp_disk):
                quote = match.group(0)[0]
                return f"{quote}/{base_no_ext}.webp{quote}"
        return match.group(0)

    # Match strings starting with /assets/
    updated = re.sub(r'[\'"](/assets/[^\'"]+)[\'"]', replace_asset_path, content)
    
    # Also handle UnitAnimationManager defaults like "spritesheet.png" -> "spritesheet.webp"
    if "UnitAnimationManager.ts" in rel_path:
        updated = updated.replace('"spritesheet.png"', '"spritesheet.webp"')
        updated = updated.replace('"face.png"', '"face.webp"')
        updated = updated.replace('"face.jpg"', '"face.webp"')

    if updated != content:
        with open(abs_path, "w", encoding="utf-8") as f:
            f.write(updated)
        print(f"Updated references in: {rel_path}")
    else:
        print(f"No changes needed in: {rel_path}")

def main():
    for f in FILES_TO_UPDATE:
        update_file(f)

if __name__ == "__main__":
    main()
