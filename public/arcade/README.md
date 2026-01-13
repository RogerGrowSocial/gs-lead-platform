# Arcade Asset Pipeline

## Overview

The Arcade Mode uses a texture atlas system for efficient sprite rendering. Assets are packed into a single atlas file for optimal performance.

## Directory Structure

```
public/arcade/
├── raw/          # Drop your raw PNG sprites here
└── atlas/        # Generated atlas files (office.png + office.json)
```

## Adding Assets

1. **Prepare your sprites**: Create PNG files for each sprite (e.g., `floor_1.png`, `desk.png`, `pc.png`, etc.)
2. **Place in raw folder**: Drop all PNG files into `public/arcade/raw/`
3. **Run pack script**: Execute `npm run arcade:pack`
4. **Atlas generated**: The script will create `public/arcade/atlas/office.png` and `office.json`

## Required Sprite Keys

The engine expects these texture keys (case-sensitive):

### Floor Tiles
- `floor_1` through `floor_5` (64x32px recommended)

### Walls
- `wall_n` (north wall, 64x32px)
- `wall_e` (east wall, 64x32px)

### Furniture
- `desk` (128x64px - 2x2 tiles)
- `pc` (64x32px - computer terminal)
- `plant` (64x32px)
- `door` (64x64px - 1x2 tiles)

### Player
- `avatar_idle` (24x24px)
- `avatar_walk_1` (24x24px - walk animation frame 1)
- `avatar_walk_2` (24x24px - walk animation frame 2)

### Effects
- `shadow` (20x10px - ellipse shadow sprite)

## Fallback Behavior

If the atlas is not found, the engine will automatically generate temporary pixel-art sprites at runtime. This ensures the scene always renders, even without assets.

## Atlas Packer

The project uses `free-tex-packer-cli` as a dev dependency. If you prefer a different packer:

1. Install your preferred CLI tool
2. Update the `arcade:pack` script in `package.json`
3. Ensure output format is Phaser-compatible (JSON + PNG)

## Notes

- Sprites should use pixel-art style for best results
- Keep sprite dimensions power-of-2 when possible
- The engine uses `pixelArt: true` mode, so scaling will be crisp
- All sprites are depth-sorted based on isometric Y position

