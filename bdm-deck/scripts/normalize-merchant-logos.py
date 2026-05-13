#!/usr/bin/env python3
"""
Normalize merchant-logo PNGs so every logo renders at roughly Disney's
visual height or larger when placed in a fixed container with
`object-fit: contain`.

Approach: trim transparent padding from every logo whose effective
rendered height would be smaller than Disney's. Logos already at
Disney-size or larger are left untouched.

Run: python3 scripts/normalize-merchant-logos.py
"""
import sys
from pathlib import Path
from PIL import Image

ROOT = Path(__file__).resolve().parent.parent
LOGOS_DIR = ROOT / "public" / "merchants"

# Same container dims SlideCover.jsx uses for merchantLogo.
CONTAINER_H = 92
CONTAINER_W = 440

def measure(path: Path):
    with Image.open(path) as im:
        w, h = im.size
        rgba = im.convert("RGBA")
        alpha = rgba.split()[-1]
        bbox = alpha.getbbox()
    if not bbox:
        return None
    l, t, r, b = bbox
    tw, th = r - l, b - t
    scale = min(CONTAINER_H / h, CONTAINER_W / w)
    eff_h = th * scale
    return {"w": w, "h": h, "bbox": bbox, "tw": tw, "th": th, "eff_h": eff_h}

def trim(path: Path, bbox):
    with Image.open(path) as im:
        rgba = im.convert("RGBA")
        trimmed = rgba.crop(bbox)
    trimmed.save(path, optimize=True)

def main():
    disney = measure(LOGOS_DIR / "disney.png")
    if not disney:
        print("Could not measure disney.png", file=sys.stderr)
        sys.exit(1)
    target = disney["eff_h"]
    print(f"Disney baseline eff_h = {target:.2f}px")

    files = sorted(LOGOS_DIR.glob("*.png"))
    trimmed = []
    skipped = []
    for f in files:
        m = measure(f)
        if not m:
            continue
        if m["eff_h"] >= target - 0.5:
            skipped.append(f.stem)
            continue
        # Content fits loosely — trim transparent padding.
        if (m["bbox"] == (0, 0, m["w"], m["h"])):
            # Already edge-to-edge but still short; nothing to trim.
            skipped.append(f.stem)
            continue
        trim(f, m["bbox"])
        after = measure(f)
        trimmed.append((f.stem, m["eff_h"], after["eff_h"] if after else 0))

    print(f"\nTrimmed {len(trimmed)} logos, left {len(skipped)} untouched.\n")
    trimmed.sort(key=lambda x: x[1])
    for slug, before, after in trimmed[:30]:
        print(f"  {slug:<28} {before:6.2f}px  ->  {after:6.2f}px")
    if len(trimmed) > 30:
        print(f"  ... and {len(trimmed) - 30} more")

if __name__ == "__main__":
    main()
