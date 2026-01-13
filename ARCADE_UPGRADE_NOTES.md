# Arcade Mode Upgrade - Implementation Notes

## Patterns Found & Reused

### Router System
- **Location**: Express.js router in `routes/admin.js`
- **Pattern**: Routes use `requireAuth` + `isManagerOrAdmin` middleware
- **Updated**: `/admin/arcade` route already exists with proper guards

### User Dropdown Menu
- **Location**: `views/layouts/admin.ejs` (line ~1321)
- **Pattern**: Conditional rendering based on `userIsAdminOrManager`
- **Updated**: "Arcade Mode" item already added (line ~1327)

### Role Guards
- **Location**: `middleware/auth.js`
- **Pattern**: `isManagerOrAdmin` function checks `is_admin` flag and manager role
- **Usage**: Applied to both route and API endpoints

### API Protection
- **Location**: `routes/api.js`
- **Pattern**: All `/api/admin/arcade/*` endpoints use `isManagerOrAdmin` middleware
- **Status**: Already implemented

### Modal System
- **Location**: `public/js/admin/lead-engine.js` (line ~59)
- **Pattern**: `createConfirmModal` function creates modal with header/body/footer
- **Integration**: ArcadeEngine uses this pattern for unlocks modal

### Toast/Notification System
- **Location**: `public/js/admin/lead-engine.js` (line ~6)
- **Pattern**: `showNotification(message, type)` function
- **Integration**: Arcade view uses this for wallet sync feedback

## Files Created/Modified

### Created
1. `public/js/arcade/ArcadeEngine.js` - Main game engine with isometric rendering
2. `public/arcade/README.md` - Asset pipeline documentation
3. `ARCADE_UPGRADE_NOTES.md` - This file

### Modified
1. `views/admin/arcade.ejs` - Upgraded to use ArcadeEngine module
2. `package.json` - Added `arcade:pack` script and `free-tex-packer-cli` dev dependency

## Key Features Implemented

### Isometric Rendering
- Custom isometric projection: `isoToScreen()` and `screenToIso()` functions
- Tile-based floor rendering with seeded random variation
- Wall rendering (north and east walls)
- Depth sorting based on isometric Y position

### Asset Pipeline
- Atlas packer setup with `free-tex-packer-cli`
- Automatic sprite generation if atlas missing
- Runtime texture generation for all required sprites

### Game Features
- Player movement with WASD/Arrow keys
- Tile-based collision detection
- Interactable hover highlights (blue outline)
- Click handlers for computers (navigate to routes) and doors (open modal)
- Shadows under furniture and player
- Vignette and noise overlays for atmosphere

### Integration
- Reuses existing notification system
- Reuses existing modal patterns
- Maintains existing HUD overlay design
- Proper cleanup on page unload

## Testing Checklist

- [ ] Arcade Mode loads without errors
- [ ] Isometric floor renders with variation
- [ ] Player can move with WASD/Arrows
- [ ] Player collides with furniture
- [ ] Hover highlight appears on interactables
- [ ] Clicking PC navigates to admin route
- [ ] Clicking door opens modal
- [ ] Shadows render correctly
- [ ] Depth sorting works (player behind/in front of furniture)
- [ ] Vignette and noise overlays visible
- [ ] Wallet sync works
- [ ] Exit button works
- [ ] No memory leaks (game destroys on unmount)

## Next Steps (Optional Enhancements)

1. Add real sprite assets to `public/arcade/raw/` and run `npm run arcade:pack`
2. Implement player walk animation (currently uses idle sprite)
3. Add more furniture types
4. Implement click-to-move
5. Add employee avatars at desks
6. Add sound effects
7. Implement unlock system UI

