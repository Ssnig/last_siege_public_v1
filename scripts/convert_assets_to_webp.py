import os
import sys
from concurrent.futures import ProcessPoolExecutor
from PIL import Image

REPO_ROOT = "/home/htetoowai/Coding/Projects/GameDev/the-td"
PUBLIC_ASSETS = os.path.join(REPO_ROOT, "app/client/public/assets")

# Categories to convert
TARGET_DIRS = [
    os.path.join(PUBLIC_ASSETS, "towers"),
    os.path.join(PUBLIC_ASSETS, "units"),
    os.path.join(PUBLIC_ASSETS, "maps"),
    os.path.join(PUBLIC_ASSETS, "props"),
    os.path.join(PUBLIC_ASSETS, "vfx"),
    os.path.join(PUBLIC_ASSETS, "ranks"),
]

# Specific large files in ui and logo
SPECIFIC_FILES = [
    os.path.join(PUBLIC_ASSETS, "ui/bg.jpg"),
    os.path.join(PUBLIC_ASSETS, "ui/bg2.jpg"),
    os.path.join(PUBLIC_ASSETS, "logo/start_btn_tight.png"),
    os.path.join(PUBLIC_ASSETS, "logo/landing_logo_tight.png"),
    os.path.join(PUBLIC_ASSETS, "logo/Victory.png"),
    os.path.join(PUBLIC_ASSETS, "logo/Defeat.png"),
    os.path.join(PUBLIC_ASSETS, "tower_placeholder/tower_placeholder_1.png"),
]

def collect_images_to_convert():
    images = []
    for d in TARGET_DIRS:
        if not os.path.exists(d):
            continue
        for root, dirs, files in os.walk(d):
            for f in files:
                ext = os.path.splitext(f)[1].lower()
                if ext in ['.png', '.jpg', '.jpeg']:
                    images.append(os.path.join(root, f))
    for f in SPECIFIC_FILES:
        if os.path.exists(f) and f not in images:
            images.append(f)
    return images

def convert_single_image(file_path):
    try:
        ext = os.path.splitext(file_path)[1].lower()
        webp_path = os.path.splitext(file_path)[0] + '.webp'
        
        orig_size = os.path.getsize(file_path)
        im = Image.open(file_path)
        
        # Save as WebP with method=4 (fast & high compression)
        if ext == '.png':
            if im.mode not in ('RGB', 'RGBA'):
                im = im.convert('RGBA')
            im.save(webp_path, 'WEBP', quality=90, method=4)
        else:
            if im.mode != 'RGB':
                im = im.convert('RGB')
            im.save(webp_path, 'WEBP', quality=88, method=4)
            
        webp_size = os.path.getsize(webp_path)
        return (file_path, orig_size, webp_size, None)
    except Exception as e:
        return (file_path, 0, 0, str(e))

def main():
    images = collect_images_to_convert()
    print(f"Converting {len(images)} images using {os.cpu_count() or 4} CPU processes...")
    
    total_orig = 0
    total_webp = 0
    success_count = 0
    
    with ProcessPoolExecutor(max_workers=os.cpu_count()) as executor:
        for i, (fp, o_sz, w_sz, err) in enumerate(executor.map(convert_single_image, images)):
            if err:
                print(f"Error {fp}: {err}")
            else:
                total_orig += o_sz
                total_webp += w_sz
                success_count += 1
                if (i + 1) % 25 == 0 or (i + 1) == len(images):
                    rel = os.path.relpath(fp, REPO_ROOT)
                    print(f"[{i+1}/{len(images)}] Done: {rel} ({w_sz/1024:.0f}KB)")
                    
    print("\n--- Modernization Summary ---")
    print(f"Successfully converted: {success_count}/{len(images)} assets")
    print(f"Total Original: {total_orig / (1024*1024):.2f} MB")
    print(f"Total WebP:     {total_webp / (1024*1024):.2f} MB")
    print(f"Saved:          {(total_orig - total_webp) / (1024*1024):.2f} MB ({((total_orig - total_webp)/total_orig)*100:.1f}% reduction)")

if __name__ == "__main__":
    main()
