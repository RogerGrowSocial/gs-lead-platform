/**
 * ArcadeEngine - Isometric Office Scene with Kenney Asset Support
 * 
 * PATTERNS USED:
 * - Router: Express.js (routes/admin.js)
 * - User dropdown: views/layouts/admin.ejs (line ~1321)
 * - Role guards: middleware/auth.js (isManagerOrAdmin)
 * - API protection: routes/api.js (isManagerOrAdmin middleware)
 * - Modals: public/js/admin/lead-engine.js (createConfirmModal pattern)
 * - Toasts: public/js/admin/lead-engine.js (showNotification pattern)
 * 
 * FILES UPDATED:
 * - views/admin/arcade.ejs (main scene)
 * - public/js/arcade/ArcadeEngine.js (this file)
 * - public/js/arcade/iso.js (isometric math utilities)
 * - package.json (added arcade:pack script)
 */

// Import iso utilities (will be loaded as module or fallback to window)
let isoUtils = null;

class ArcadeEngine {
  constructor(containerId, arcadeState, options = {}) {
    this.containerId = containerId;
    this.arcadeState = arcadeState;
    this.game = null;
    this.Phaser = null;
    this.scene = null;
    
    // Load iso utilities
    if (typeof window !== 'undefined' && window.isoUtils) {
      isoUtils = window.isoUtils;
    } else if (typeof module !== 'undefined' && module.exports) {
      isoUtils = require('./iso.js');
    }
    
    // Use Kenney tile constants from iso.js
    this.TILE_W = isoUtils ? isoUtils.TILE_W : 128;
    this.TILE_H = isoUtils ? isoUtils.TILE_H : 64;
    this.ROOM_WIDTH = arcadeState?.room?.width || 50;
    this.ROOM_HEIGHT = arcadeState?.room?.height || 40;
    
    // Camera origin (will be calculated in create())
    this.originX = 0;
    this.originY = 0;
    
    // Game state
    this.player = null;
    this.cursors = null;
    this.wasd = null;
    this.interactables = [];
    this.furniture = [];
    this.collisionGrid = null;
    this.hoverHighlight = null;
    this.hoveredInteractable = null;
    this.debugMode = false;
    this.debugGraphics = null;
    this.occupancyGrid = null;
  }

  /**
   * Convert isometric tile coordinates to screen coordinates
   * Uses iso.js utility for consistency
   */
  isoToScreen(tileX, tileY, originX = null, originY = null) {
    const ox = originX !== null ? originX : (this.originX || 0);
    const oy = originY !== null ? originY : (this.originY || 0);
    if (isoUtils && isoUtils.isoToScreen) {
      return isoUtils.isoToScreen(tileX, tileY, ox, oy);
    }
    // Fallback if iso.js not loaded - use Kenney tile math
    const screenX = (tileX - tileY) * (this.TILE_W / 2) + ox;
    const screenY = (tileX + tileY) * (this.TILE_H / 2) + oy;
    return { x: screenX, y: screenY };
  }

  /**
   * Convert screen coordinates to isometric tile coordinates
   * Uses iso.js utility for consistency
   */
  screenToIso(screenX, screenY, originX = null, originY = null) {
    const ox = originX !== null ? originX : this.originX;
    const oy = originY !== null ? originY : this.originY;
    if (isoUtils && isoUtils.screenToIso) {
      return isoUtils.screenToIso(screenX, screenY, ox, oy);
    }
    // Fallback if iso.js not loaded
    const dx = screenX - ox;
    const dy = screenY - oy;
    const tileX = (dy / (this.TILE_H / 2) + dx / (this.TILE_W / 2)) / 2;
    const tileY = (dy / (this.TILE_H / 2) - dx / (this.TILE_W / 2)) / 2;
    return { x: Math.round(tileX), y: Math.round(tileY), fx: tileX, fy: tileY };
  }

  /**
   * Place entity sprite on grid correctly using Kenney offsets
   * @param {Phaser.Scene} scene - Phaser scene instance
   * @param {Object} entity - arcade_entities record
   * @param {Object} placement - arcade_placements record
   * @param {number} originX - Screen origin X
   * @param {number} originY - Screen origin Y
   * @returns {Phaser.GameObjects.Image} The created sprite
   */
  placeEntitySprite(scene, entity, placement, originX, originY) {
    try {
      // 1) Get base tile position in screen coordinates
      const base = this.isoToScreen(placement.x, placement.y, originX, originY);
      
      // 2) Apply entity draw offsets (Kenney default: -192, 170)
      // For temporary sprites, use 0 offsets since they're already sized for tiles
      const drawOffsetX = entity.draw_offset_x !== undefined ? entity.draw_offset_x : 0;
      const drawOffsetY = entity.draw_offset_y !== undefined ? entity.draw_offset_y : 0;
      const spriteX = base.x + drawOffsetX;
      const spriteY = base.y + drawOffsetY;
      
      // 3) Get sprite key (fallback to temporary sprites if not found)
      const spriteKey = entity.sprite_key || 'desk';
      
      // 4) Check if texture exists, fallback to temporary sprites
      let finalSpriteKey = spriteKey;
      if (!scene.textures.exists(spriteKey)) {
        // Fallback to temporary sprites based on category/key
        if (entity.category === 'desk') {
          finalSpriteKey = 'desk';
        } else if (entity.key && (entity.key.includes('pc_') || entity.key.includes('terminal'))) {
          finalSpriteKey = 'pc';
        } else if (entity.key && entity.key.includes('door')) {
          finalSpriteKey = 'door';
        } else if (entity.key && entity.key.includes('plant')) {
          finalSpriteKey = 'plant';
        } else {
          finalSpriteKey = 'desk'; // Default fallback
        }
      }
      
      // 5) Verify texture exists before creating sprite
      if (!scene.textures.exists(finalSpriteKey)) {
        console.warn(`Texture ${finalSpriteKey} does not exist, skipping placement`, placement);
        return null;
      }
      
      // 6) Create sprite
      const sprite = scene.add.image(spriteX, spriteY, finalSpriteKey);
    
      // 7) Set origin (default: 0.5, 1.0 = bottom center)
      const originX_val = entity.origin_x !== undefined ? parseFloat(entity.origin_x) : 0.5;
      const originY_val = entity.origin_y !== undefined ? parseFloat(entity.origin_y) : 1.0;
      sprite.setOrigin(originX_val, originY_val);
      
      // 8) Apply optional render size override
      if (entity.render_w && entity.render_h) {
        sprite.setDisplaySize(entity.render_w, entity.render_h);
      }
      
      // 9) Depth sorting by base Y (lower Y = further back = lower depth)
      sprite.setDepth(base.y + placement.z_index);
      
      // 10) Store placement reference for interaction
      sprite.setData('placement', placement);
      sprite.setData('entity', entity);
      
      // 11) Add interactivity if needed
      if (entity.is_interactable) {
        sprite.setInteractive();
        
        sprite.on('pointerover', () => {
          this.hoveredInteractable = sprite;
          this.showHoverHighlight(sprite);
        });
        
        sprite.on('pointerout', () => {
          this.hoveredInteractable = null;
          this.hideHoverHighlight();
        });
        
        sprite.on('pointerdown', () => {
          this.handleInteractableClick(placement);
        });
        
        this.interactables.push(sprite);
      }
      
      return sprite;
    } catch (error) {
      console.error('Error placing entity sprite:', error, { entity, placement });
      return null;
    }
  }

  /**
   * Build occupancy grid from placements
   * @param {Array} placements - Array of placement records
   * @param {Object} entityMap - Map of entity_id -> entity
   * @returns {Object} 2D grid object {[y]: {[x]: placement_id}}
   */
  buildOccupancy(placements, entityMap) {
    const grid = {};
    
    placements.forEach(placement => {
      const entity = entityMap[placement.entity_id] || placement.arcade_entities;
      if (!entity) return;
      
      const footprintW = entity.footprint_w || 1;
      const footprintH = entity.footprint_h || 1;
      
      // Mark all tiles in footprint
      for (let dy = 0; dy < footprintH; dy++) {
        for (let dx = 0; dx < footprintW; dx++) {
          const tx = placement.x + dx;
          const ty = placement.y + dy;
          
          if (!grid[ty]) grid[ty] = {};
          grid[ty][tx] = placement.id;
        }
      }
    });
    
    return grid;
  }

  /**
   * Check if tiles are available for placement
   * @param {number} tileX - Base tile X
   * @param {number} tileY - Base tile Y
   * @param {number} footprintW - Footprint width
   * @param {number} footprintH - Footprint height
   * @param {string} excludePlacementId - Placement ID to exclude (for updates)
   * @returns {boolean} True if all tiles are available
   */
  isTilesAvailable(tileX, tileY, footprintW, footprintH, excludePlacementId = null) {
    if (!this.occupancyGrid) return true;
    
    for (let dy = 0; dy < footprintH; dy++) {
      for (let dx = 0; dx < footprintW; dx++) {
        const tx = tileX + dx;
        const ty = tileY + dy;
        
        if (this.occupancyGrid[ty] && this.occupancyGrid[ty][tx]) {
          const occupiedId = this.occupancyGrid[ty][tx];
          if (excludePlacementId && occupiedId === excludePlacementId) {
            continue; // Same placement, allow
          }
          return false; // Occupied by different placement
        }
      }
    }
    
    return true;
  }

  /**
   * Generate deterministic seeded random (for floor tile variation)
   */
  seededRandom(seed) {
    const x = Math.sin(seed) * 10000;
    return x - Math.floor(x);
  }

  /**
   * Generate temporary sprites if atlas is missing
   */
  generateTemporarySprites(scene) {
    // Floor tiles (5 variants) - using Kenney tile size (128x64)
    for (let i = 1; i <= 5; i++) {
      try {
        const g = scene.add.graphics();
        const baseColor = 0x444444;
        const variation = Math.floor(this.seededRandom(i * 100) * 30);
        g.fillStyle(baseColor + variation);
        g.fillRect(0, 0, this.TILE_W, this.TILE_H);
        // Add subtle pattern
        g.fillStyle(0x555555);
        g.fillRect(0, 0, this.TILE_W, 2);
        g.fillRect(0, this.TILE_H - 2, this.TILE_W, 2);
        g.generateTexture(`floor_${i}`, this.TILE_W, this.TILE_H);
        g.destroy();
      } catch (err) {
        console.error(`Error generating floor tile ${i}:`, err);
      }
    }

    // Wall north
    const wallN = scene.add.graphics();
    wallN.fillStyle(0x2b2b2b);
    wallN.fillRect(0, 0, this.TILE_W, this.TILE_H);
    wallN.fillStyle(0x1a1a1a);
    wallN.fillRect(0, 0, this.TILE_W, 4);
    wallN.generateTexture('wall_n', this.TILE_W, this.TILE_H);
    wallN.destroy();

    // Wall east
    const wallE = scene.add.graphics();
    wallE.fillStyle(0x2b2b2b);
    wallE.fillRect(0, 0, this.TILE_W, this.TILE_H);
    wallE.fillStyle(0x1a1a1a);
    wallE.fillRect(this.TILE_W - 4, 0, 4, this.TILE_H);
    wallE.generateTexture('wall_e', this.TILE_W, this.TILE_H);
    wallE.destroy();

    // Desk
    const desk = scene.add.graphics();
    desk.fillStyle(0x4b5563);
    desk.fillRect(0, 0, this.TILE_W * 2, this.TILE_H * 2);
    desk.fillStyle(0x374151);
    desk.fillRect(2, 2, this.TILE_W * 2 - 4, 4);
    desk.generateTexture('desk', this.TILE_W * 2, this.TILE_H * 2);
    desk.destroy();

    // PC/Computer
    const pc = scene.add.graphics();
    pc.fillStyle(0x1f2937);
    pc.fillRect(0, 0, this.TILE_W, this.TILE_H);
    pc.fillStyle(0x3b82f6);
    pc.fillRect(8, 8, this.TILE_W - 16, this.TILE_H - 16);
    pc.fillStyle(0x60a5fa);
    pc.fillRect(12, 12, 8, 4);
    pc.generateTexture('pc', this.TILE_W, this.TILE_H);
    pc.destroy();

    // Plant
    const plant = scene.add.graphics();
    plant.fillStyle(0x065f46);
    plant.fillCircle(this.TILE_W / 2, this.TILE_H, this.TILE_W / 2);
    plant.fillStyle(0x10b981);
    plant.fillCircle(this.TILE_W / 2, this.TILE_H - 4, this.TILE_W / 3);
    plant.generateTexture('plant', this.TILE_W, this.TILE_H);
    plant.destroy();

    // Door
    const door = scene.add.graphics();
    door.fillStyle(0x78350f);
    door.fillRect(0, 0, this.TILE_W, this.TILE_H * 2);
    door.fillStyle(0x92400e);
    door.fillRect(4, 4, this.TILE_W - 8, this.TILE_H * 2 - 8);
    door.fillStyle(0xfbbf24);
    door.fillCircle(this.TILE_W - 8, this.TILE_H, 4);
    door.generateTexture('door', this.TILE_W, this.TILE_H * 2);
    door.destroy();

    // Player idle (simple character)
    const playerIdle = scene.add.graphics();
    playerIdle.fillStyle(0xea5d0d);
    playerIdle.fillCircle(12, 12, 10);
    playerIdle.fillStyle(0xffffff);
    playerIdle.fillCircle(10, 10, 2);
    playerIdle.fillCircle(14, 10, 2);
    playerIdle.generateTexture('avatar_idle', 24, 24);
    playerIdle.destroy();

    // Player walk frame 1
    const playerWalk1 = scene.add.graphics();
    playerWalk1.fillStyle(0xea5d0d);
    playerWalk1.fillCircle(12, 13, 10);
    playerWalk1.fillStyle(0xffffff);
    playerWalk1.fillCircle(10, 11, 2);
    playerWalk1.fillCircle(14, 11, 2);
    playerWalk1.generateTexture('avatar_walk_1', 24, 24);
    playerWalk1.destroy();

    // Player walk frame 2
    const playerWalk2 = scene.add.graphics();
    playerWalk2.fillStyle(0xea5d0d);
    playerWalk2.fillCircle(12, 11, 10);
    playerWalk2.fillStyle(0xffffff);
    playerWalk2.fillCircle(10, 9, 2);
    playerWalk2.fillCircle(14, 9, 2);
    playerWalk2.generateTexture('avatar_walk_2', 24, 24);
    playerWalk2.destroy();

    // Shadow sprite
    const shadow = scene.add.graphics();
    shadow.fillStyle(0x000000, 0.3);
    shadow.fillEllipse(0, 0, 20, 10);
    shadow.generateTexture('shadow', 20, 10);
    shadow.destroy();
  }

  /**
   * Initialize collision grid
   */
  initCollisionGrid(scene) {
    this.collisionGrid = [];
    for (let y = 0; y < this.ROOM_HEIGHT; y++) {
      this.collisionGrid[y] = [];
      for (let x = 0; x < this.ROOM_WIDTH; x++) {
        this.collisionGrid[y][x] = false;
      }
    }

    // Mark furniture positions as blocked
    if (this.arcadeState?.placements) {
      this.arcadeState.placements.forEach(placement => {
        const entity = placement.arcade_entities;
        if (entity && entity.category !== 'decor') {
          const w = entity.footprint_w || 1;
          const h = entity.footprint_h || 1;
          for (let dy = 0; dy < h; dy++) {
            for (let dx = 0; dx < w; dx++) {
              const tx = placement.x + dx;
              const ty = placement.y + dy;
              if (tx >= 0 && tx < this.ROOM_WIDTH && ty >= 0 && ty < this.ROOM_HEIGHT) {
                this.collisionGrid[ty][tx] = true;
              }
            }
          }
        }
      });
    }
  }

  /**
   * Check if tile is walkable
   */
  isWalkable(tileX, tileY) {
    if (tileX < 0 || tileX >= this.ROOM_WIDTH || tileY < 0 || tileY >= this.ROOM_HEIGHT) {
      return false;
    }
    return !this.collisionGrid[tileY][tileX];
  }

  /**
   * Load Phaser and initialize game
   */
  async init() {
    try {
      // Load Phaser dynamically
      this.Phaser = await this.loadPhaser();

      // Game config
      const config = {
        type: this.Phaser.AUTO,
        width: window.innerWidth,
        height: window.innerHeight,
        parent: this.containerId,
        backgroundColor: '#000000',
        pixelArt: true,
        physics: {
          default: 'arcade',
          arcade: {
            gravity: { y: 0 },
            debug: false
          }
        },
        scene: (function(engine) {
          return {
            preload: function() {
              this.data.set('engine', engine);
              engine.preload.call(this);
            },
            create: function() {
              engine.create.call(this);
            },
            update: function() {
              engine.update.call(this);
            }
          };
        })(this)
      };

      this.game = new this.Phaser.Game(config);
    } catch (error) {
      console.error('Error initializing ArcadeEngine:', error);
      throw error;
    }
  }

  /**
   * Load Phaser from CDN
   */
  async loadPhaser() {
    return new Promise((resolve, reject) => {
      if (window.Phaser) {
        return resolve(window.Phaser);
      }
      const script = document.createElement('script');
      script.src = 'https://cdn.jsdelivr.net/npm/phaser@3.70.0/dist/phaser.min.js';
      script.onload = () => resolve(window.Phaser);
      script.onerror = reject;
      document.head.appendChild(script);
    });
  }

  /**
   * Preload assets
   * Note: 'this' is the Phaser Scene instance when called
   */
  preload() {
    const scene = this; // 'this' is the Phaser Scene
    const engine = scene.data.get('engine'); // Get ArcadeEngine instance
    
    // Generate sprites immediately (before trying to load atlas)
    // This ensures sprites are available even if atlas fails
    console.log('Generating temporary sprites...');
    engine.generateTemporarySprites(scene);
    console.log('Temporary sprites generated');
    
    // Try to load atlas (optional - will override generated sprites if successful)
    scene.load.atlas('office', '/arcade/atlas/office.png', '/arcade/atlas/office.json')
      .on('filecomplete-atlasjson-office', () => {
        console.log('Atlas loaded successfully - will use atlas sprites');
      })
      .on('loaderror', () => {
        console.log('Atlas not found - using generated temporary sprites');
      });
  }

  /**
   * Create scene
   * Note: 'this' is the Phaser Scene instance when called
   */
  create() {
    const scene = this; // 'this' is the Phaser Scene
    const engine = scene.data.get('engine'); // Get ArcadeEngine instance
    
    console.log('Creating scene...', {
      roomWidth: engine.ROOM_WIDTH,
      roomHeight: engine.ROOM_HEIGHT,
      tileW: engine.TILE_W,
      tileH: engine.TILE_H,
      screenWidth: scene.scale.width,
      screenHeight: scene.scale.height
    });
    
    // Calculate isometric room bounds
    // Find the screen coordinates of all four corners (without offsets first)
    const topLeft = engine.isoToScreen(0, 0, 0, 0);
    const topRight = engine.isoToScreen(engine.ROOM_WIDTH - 1, 0, 0, 0);
    const bottomLeft = engine.isoToScreen(0, engine.ROOM_HEIGHT - 1, 0, 0);
    const bottomRight = engine.isoToScreen(engine.ROOM_WIDTH - 1, engine.ROOM_HEIGHT - 1, 0, 0);
    
    // Find min/max bounds
    const minX = Math.min(topLeft.x, topRight.x, bottomLeft.x, bottomRight.x);
    const maxX = Math.max(topLeft.x, topRight.x, bottomLeft.x, bottomRight.x);
    const minY = Math.min(topLeft.y, topRight.y, bottomLeft.y, bottomRight.y);
    const maxY = Math.max(topLeft.y, topRight.y, bottomLeft.y, bottomRight.y);
    
    const roomScreenWidth = maxX - minX;
    const roomScreenHeight = maxY - minY;

    // No zoom (keep pixel art crisp). Center the room in the viewport.
    scene.cameras.main.setZoom(1);
    
    const offsetX = (scene.scale.width - roomScreenWidth) / 2 - minX;
    const offsetY = (scene.scale.height - roomScreenHeight) / 2 - minY;

    console.log('Room bounds:', { minX, maxX, minY, maxY, roomScreenWidth, roomScreenHeight });
    console.log('Room offsets:', { offsetX, offsetY });
    console.log('Screen size:', { width: scene.scale.width, height: scene.scale.height });
    
    // Calculate world bounds (where content will be rendered)
    const worldLeft = offsetX + minX;
    const worldTop = offsetY + minY;
    const worldRight = offsetX + maxX;
    const worldBottom = offsetY + maxY;
    
    // Set camera bounds FIRST (before scrolling)
    const padding = 200;
    const boundsLeft = worldLeft - padding;
    const boundsTop = worldTop - padding;
    const boundsWidth = roomScreenWidth + (padding * 2);
    const boundsHeight = roomScreenHeight + (padding * 2);
    
    scene.cameras.main.setBounds(boundsLeft, boundsTop, boundsWidth, boundsHeight);
    
    // Center camera on the room
    const centerX = (worldLeft + worldRight) / 2;
    const centerY = (worldTop + worldBottom) / 2;
    
    // Calculate scroll position to center the room on screen
    // In Phaser, scrollX/Y is the top-left corner of the camera view
    // We want the center of the room to be in the center of the viewport
    const scrollX = centerX - scene.scale.width / 2;
    const scrollY = centerY - scene.scale.height / 2;
    
    // Clamp scroll to bounds (ensure camera doesn't go outside bounds)
    const maxScrollX = boundsLeft + boundsWidth - scene.scale.width;
    const maxScrollY = boundsTop + boundsHeight - scene.scale.height;
    const clampedScrollX = Math.max(boundsLeft, Math.min(maxScrollX, scrollX));
    const clampedScrollY = Math.max(boundsTop, Math.min(maxScrollY, scrollY));
    
    console.log('Camera setup:', {
      bounds: { left: boundsLeft, top: boundsTop, width: boundsWidth, height: boundsHeight },
      worldCenter: { x: centerX, y: centerY },
      calculatedScroll: { x: scrollX, y: scrollY },
      clampedScroll: { x: clampedScrollX, y: clampedScrollY },
      screenSize: { width: scene.scale.width, height: scene.scale.height }
    });
    console.log('Camera setup (expanded):', JSON.stringify({
      boundsLeft, boundsTop, boundsWidth, boundsHeight,
      centerX, centerY,
      scrollX, scrollY,
      clampedScrollX, clampedScrollY,
      screenWidth: scene.scale.width,
      screenHeight: scene.scale.height
    }, null, 2));
    
    // Set camera scroll - use delayedCall to ensure it happens after Phaser's internal setup
    // Phaser may reset camera position during scene creation, so we set it after a frame
    scene.time.delayedCall(100, () => {
      // Try centerOn first
      scene.cameras.main.centerOn(centerX, centerY);
      
      // Verify and fallback to setScroll if needed
      const actualX = scene.cameras.main.scrollX;
      const actualY = scene.cameras.main.scrollY;
      
      if (Math.abs(actualX - clampedScrollX) > 1 || Math.abs(actualY - clampedScrollY) > 1) {
        console.warn('centerOn did not position correctly, using setScroll');
        scene.cameras.main.setScroll(clampedScrollX, clampedScrollY);
        scene.cameras.main.update();
      }
      
      // Final verification
      const finalX = scene.cameras.main.scrollX;
      const finalY = scene.cameras.main.scrollY;
      const viewportCenterX = finalX + scene.scale.width / 2;
      const viewportCenterY = finalY + scene.scale.height / 2;
      console.log('Camera position after delayed call:', { 
        scrollX: finalX, 
        scrollY: finalY,
        viewportCenter: { x: viewportCenterX, y: viewportCenterY },
        targetCenter: { x: centerX, y: centerY },
        difference: { x: Math.abs(viewportCenterX - centerX), y: Math.abs(viewportCenterY - centerY) }
      });
      console.log('Camera position (expanded):', JSON.stringify({
        scrollX: finalX,
        scrollY: finalY,
        viewportCenterX,
        viewportCenterY,
        targetCenterX: centerX,
        targetCenterY: centerY,
        diffX: Math.abs(viewportCenterX - centerX),
        diffY: Math.abs(viewportCenterY - centerY)
      }, null, 2));
    });
    
    // Also set immediately (in case delayed call isn't needed)
    scene.cameras.main.setScroll(clampedScrollX, clampedScrollY);
    scene.cameras.main.update();
    
    // Add a second delayed call to ensure camera position is set
    scene.time.delayedCall(200, () => {
      const checkX = scene.cameras.main.scrollX;
      const checkY = scene.cameras.main.scrollY;
      if (Math.abs(checkX - clampedScrollX) > 1 || Math.abs(checkY - clampedScrollY) > 1) {
        console.warn('Camera still not positioned correctly, forcing setScroll again');
        scene.cameras.main.setScroll(clampedScrollX, clampedScrollY);
        scene.cameras.main.update();
        console.log('Camera forced to:', { scrollX: scene.cameras.main.scrollX, scrollY: scene.cameras.main.scrollY });
      }
    });
    
    // Verify camera position
    const actualScrollX = scene.cameras.main.scrollX;
    const actualScrollY = scene.cameras.main.scrollY;
    
    console.log('Camera positioned:', { 
      scrollX: actualScrollX, 
      scrollY: actualScrollY,
      viewportCenter: { 
        x: actualScrollX + scene.scale.width / 2, 
        y: actualScrollY + scene.scale.height / 2 
      },
      targetCenter: { x: centerX, y: centerY }
    });

    // Store offsets for later use
    scene.offsetX = offsetX;
    scene.offsetY = offsetY;

    // Render floor with variation
    console.log('Rendering floor tiles...');
    let floorTileCount = 0;
    for (let y = 0; y < engine.ROOM_HEIGHT; y++) {
      for (let x = 0; x < engine.ROOM_WIDTH; x++) {
        const seed = x * 1000 + y;
        const variant = Math.floor(engine.seededRandom(seed) * 5) + 1;
        const screenPos = engine.isoToScreen(x, y, 0, 0); // Calculate without offsets first
        
        // Check if texture exists
        if (!scene.textures.exists(`floor_${variant}`)) {
          console.warn(`Texture floor_${variant} does not exist!`);
          continue;
        }
        
        try {
          const floorTile = scene.add.image(
            offsetX + screenPos.x,
            offsetY + screenPos.y,
            `floor_${variant}`
          );
          floorTile.setOrigin(0, 0);
          floorTile.setDepth(screenPos.y);
          floorTileCount++;
        } catch (err) {
          console.warn(`Error creating floor tile at ${x},${y}:`, err);
        }
      }
    }
    console.log(`Rendered ${floorTileCount} floor tiles`);

    // Render walls
    console.log('Rendering walls...');
    // North wall
    for (let x = 0; x < engine.ROOM_WIDTH; x++) {
      const screenPos = engine.isoToScreen(x, -1, 0, 0);
      if (scene.textures.exists('wall_n')) {
        try {
          const wall = scene.add.image(
            offsetX + screenPos.x,
            offsetY + screenPos.y,
            'wall_n'
          );
          wall.setOrigin(0, 0);
          wall.setDepth(screenPos.y);
        } catch (err) {
          console.warn(`Error creating north wall at ${x}:`, err);
        }
      }
    }

    // East wall
    for (let y = 0; y < engine.ROOM_HEIGHT; y++) {
      const screenPos = engine.isoToScreen(engine.ROOM_WIDTH, y, 0, 0);
      if (scene.textures.exists('wall_e')) {
        try {
          const wall = scene.add.image(
            offsetX + screenPos.x,
            offsetY + screenPos.y,
            'wall_e'
          );
          wall.setOrigin(0, 0);
          wall.setDepth(screenPos.y);
        } catch (err) {
          console.warn(`Error creating east wall at ${y}:`, err);
        }
      }
    }

    // Store origin for iso calculations
    engine.originX = offsetX;
    engine.originY = offsetY;

    // Initialize collision grid
    engine.initCollisionGrid(scene);
    console.log('Collision grid initialized');

    // Build occupancy grid
    const entityMap = {};
    if (engine.arcadeState?.placements) {
      engine.arcadeState.placements.forEach(p => {
        if (p.arcade_entities) {
          entityMap[p.entity_id] = p.arcade_entities;
        }
      });
    }
    engine.occupancyGrid = engine.buildOccupancy(engine.arcadeState?.placements || [], entityMap);
    console.log('Occupancy grid built');

    // Render furniture from placements using placeEntitySprite
    if (engine.arcadeState?.placements) {
      console.log(`Rendering ${engine.arcadeState.placements.length} placements...`);
      let renderedCount = 0;
      engine.arcadeState.placements.forEach(placement => {
        const entity = placement.arcade_entities;
        if (!entity) {
          console.warn('Placement missing entity:', placement);
          return;
        }

        // Use the new placeEntitySprite function
        const furnitureSprite = engine.placeEntitySprite(scene, entity, placement, offsetX, offsetY);
        
        if (!furnitureSprite) {
          console.warn('Failed to create sprite for placement:', placement.id, entity.sprite_key);
          return;
        }
        
        // Debug: Log placement position
        const base = engine.isoToScreen(placement.x, placement.y, offsetX, offsetY);
        if (renderedCount < 5) { // Log first 5 for debugging
          console.log(`Placement ${renderedCount + 1}:`, {
            tile: { x: placement.x, y: placement.y },
            screen: { x: base.x, y: base.y },
            sprite: { x: furnitureSprite.x, y: furnitureSprite.y },
            entity: entity.key || entity.sprite_key
          });
          console.log(`Placement ${renderedCount + 1} (expanded):`, JSON.stringify({
            tileX: placement.x,
            tileY: placement.y,
            screenX: base.x,
            screenY: base.y,
            spriteX: furnitureSprite.x,
            spriteY: furnitureSprite.y,
            spriteDepth: furnitureSprite.depth,
            entityKey: entity.key,
            spriteKey: entity.sprite_key
          }, null, 2));
        }
        
        // Add shadow (optional, can be part of sprite or separate)
        if (scene.textures.exists('shadow')) {
          try {
            const base = engine.isoToScreen(placement.x, placement.y, offsetX, offsetY);
            const shadow = scene.add.image(
              furnitureSprite.x,
              furnitureSprite.y + (furnitureSprite.height * (1 - (entity.origin_y || 1.0))) - 4,
              'shadow'
            );
            shadow.setDepth(furnitureSprite.depth - 1);
            shadow.setAlpha(0.4);
            furnitureSprite.shadow = shadow;
          } catch (err) {
            console.warn('Error adding shadow:', err);
          }
        }

        engine.furniture.push(furnitureSprite);
        renderedCount++;
      });
      console.log(`Rendered ${renderedCount} of ${engine.arcadeState.placements.length} furniture sprites`);
    } else {
      console.log('No placements to render');
    }

    // Create player - start near center of room (only if texture exists)
    if (scene.textures.exists('avatar_idle')) {
      console.log('Creating player...');
      const startTileX = Math.floor(engine.ROOM_WIDTH / 2);
      const startTileY = Math.floor(engine.ROOM_HEIGHT / 2);
      const startPos = engine.isoToScreen(startTileX, startTileY, offsetX, offsetY);
      
      const playerX = startPos.x + engine.TILE_W / 2;
      const playerY = startPos.y + engine.TILE_H / 2;
      
      try {
        engine.player = scene.physics.add.sprite(playerX, playerY, 'avatar_idle');
        engine.player.setDepth(1000); // Will be updated in update loop
        engine.player.setCollideWorldBounds(true);
        engine.player.currentTile = { x: startTileX, y: startTileY };
        engine.player.targetTile = { x: startTileX, y: startTileY };
        engine.player.isMoving = false;
        console.log('Player created at tile:', startTileX, startTileY, 'screen:', playerX, playerY);
      } catch (err) {
        console.warn('Failed to create player:', err);
        engine.player = null;
      }
    } else {
      console.log('Skipping player creation - avatar_idle texture not found');
      engine.player = null;
    }

    // Add player shadow
    const playerShadow = scene.add.image(
      engine.player.x,
      engine.player.y + 12,
      'shadow'
    );
    playerShadow.setDepth(999);
    playerShadow.setAlpha(0.5);
    engine.player.shadow = playerShadow;

    // Input
    engine.cursors = scene.input.keyboard.createCursorKeys();
    engine.wasd = scene.input.keyboard.addKeys('W,S,A,D');

    // Hover highlight (initially hidden)
    engine.hoverHighlight = scene.add.graphics();
    engine.hoverHighlight.setDepth(2000);
    engine.hoverHighlight.setVisible(false);

    // Debug graphics (initially hidden)
    engine.debugGraphics = scene.add.graphics();
    engine.debugGraphics.setDepth(3000);
    engine.debugGraphics.setVisible(false);

    // Store scene reference
    engine.scene = scene;

    // Add vignette overlay
    engine.addVignette();

    // Add noise overlay
    engine.addNoise();
    
    console.log('Scene creation complete!');
    console.log('Available textures:', Object.keys(scene.textures.list));
  }

  /**
   * Show hover highlight
   */
  showHoverHighlight(sprite) {
    if (!this.hoverHighlight) return;
    this.hoverHighlight.clear();
    this.hoverHighlight.lineStyle(2, 0x60a5fa, 0.8);
    this.hoverHighlight.strokeRect(
      sprite.x - sprite.width / 2 - 4,
      sprite.y - sprite.height / 2 - 4,
      sprite.width + 8,
      sprite.height + 8
    );
    this.hoverHighlight.setVisible(true);
  }

  /**
   * Hide hover highlight
   */
  hideHoverHighlight() {
    this.hoverHighlight.setVisible(false);
  }

  /**
   * Handle interactable click
   */
  handleInteractableClick(placement) {
    try {
      const entity = placement.arcade_entities;
      if (!entity) {
        console.warn('No entity found for placement:', placement);
        return;
      }

      // Parse interaction_payload if it's a string
      let payload = entity.interaction_payload;
      if (typeof payload === 'string') {
        try {
          payload = JSON.parse(payload);
        } catch (e) {
          console.error('Failed to parse interaction_payload:', e);
          payload = null;
        }
      }

      if (entity.interaction_type === 'open_route' && payload && payload.route) {
        console.log('Navigating to route:', payload.route);
        window.location.href = payload.route;
      } else if (entity.interaction_type === 'open_modal') {
        // Use existing modal pattern
        if (window.createConfirmModal) {
          // For now, show a simple modal
          this.showUnlocksModal();
        } else {
          alert('Unlocks feature coming soon!');
        }
      } else {
        console.log('No interaction handler for:', {
          interaction_type: entity.interaction_type,
          payload: payload
        });
      }
    } catch (error) {
      console.error('Error handling interactable click:', error, { placement });
    }
  }

  /**
   * Show unlocks modal (reusing existing modal pattern)
   */
  showUnlocksModal() {
    // This will be integrated with existing modal system
    const modal = document.createElement('div');
    modal.className = 'modal';
    modal.style.zIndex = '10002';
    modal.innerHTML = `
      <div class="modal-content modal-sm">
        <div class="modal-header">
          <h3>Office Expansions</h3>
          <button class="modal-close">&times;</button>
        </div>
        <div class="modal-body">
          <p>Unlock new rooms and features!</p>
          <div class="form-actions">
            <button type="button" class="btn btn-primary" onclick="this.closest('.modal').remove()">Close</button>
          </div>
        </div>
      </div>
    `;
    document.body.appendChild(modal);
    modal.querySelector('.modal-close').addEventListener('click', () => modal.remove());
  }

  /**
   * Add vignette overlay
   */
  addVignette() {
    const scene = this.scene;
    // Create radial gradient effect (simplified)
    const gradient = scene.add.graphics();
    for (let i = 0; i < 50; i++) {
      const alpha = (i / 50) * 0.2;
      gradient.fillStyle(0x000000, alpha);
      gradient.fillCircle(scene.scale.width / 2, scene.scale.height / 2, scene.scale.width * (i / 50));
    }
    gradient.setDepth(3000);
    gradient.setBlendMode(this.Phaser.BlendModes.MULTIPLY);
  }

  /**
   * Add noise overlay
   */
  addNoise() {
    const scene = this.scene;
    // Create a simple noise texture
    const noiseCanvas = document.createElement('canvas');
    noiseCanvas.width = 256;
    noiseCanvas.height = 256;
    const ctx = noiseCanvas.getContext('2d');
    const imageData = ctx.createImageData(256, 256);
    
    for (let i = 0; i < imageData.data.length; i += 4) {
      const value = Math.random() * 255;
      imageData.data[i] = value;
      imageData.data[i + 1] = value;
      imageData.data[i + 2] = value;
      imageData.data[i + 3] = 10; // Low opacity
    }
    
    ctx.putImageData(imageData, 0, 0);
    
    scene.textures.addCanvas('noise', noiseCanvas);
    const noise = scene.add.tileSprite(0, 0, scene.scale.width, scene.scale.height, 'noise');
    noise.setDepth(3001);
    noise.setAlpha(0.05);
    noise.setBlendMode(this.Phaser.BlendModes.OVERLAY);
  }

  /**
   * Update loop
   * Note: 'this' is the Phaser Scene instance when called
   */
  update() {
    const scene = this; // 'this' is the Phaser Scene
    const engine = scene.data.get('engine'); // Get ArcadeEngine instance
    
    if (!engine.player || !engine.scene) return;

    const speed = 200;
    let targetTileX = engine.player.currentTile.x;
    let targetTileY = engine.player.currentTile.y;
    let moved = false;

    // Only allow new movement if not currently moving
    if (!engine.player.isMoving) {
      if (engine.cursors.left.isDown || engine.wasd.A.isDown) {
        targetTileX -= 1;
        moved = true;
      } else if (engine.cursors.right.isDown || engine.wasd.D.isDown) {
        targetTileX += 1;
        moved = true;
      }

      if (engine.cursors.up.isDown || engine.wasd.W.isDown) {
        targetTileY -= 1;
        moved = true;
      } else if (engine.cursors.down.isDown || engine.wasd.S.isDown) {
        targetTileY += 1;
        moved = true;
      }

      // Check collision and move
      if (moved && engine.isWalkable(targetTileX, targetTileY)) {
        engine.player.targetTile = { x: targetTileX, y: targetTileY };
        engine.player.isMoving = true;
      }
    }

    // Move towards target tile
    if (engine.player.isMoving) {
      const screenPos = engine.isoToScreen(engine.player.targetTile.x, engine.player.targetTile.y);
      const targetX = engine.scene.offsetX + screenPos.x + engine.TILE_W / 2;
      const targetY = engine.scene.offsetY + screenPos.y + engine.TILE_H / 2;
      
      const dx = targetX - engine.player.x;
      const dy = targetY - engine.player.y;
      const distance = Math.sqrt(dx * dx + dy * dy);
      
      if (distance < 5) {
        // Reached target
        engine.player.currentTile = engine.player.targetTile;
        engine.player.isMoving = false;
        engine.player.setVelocity(0, 0);
      } else {
        // Move towards target
        engine.scene.physics.moveTo(engine.player, targetX, targetY, speed);
      }
    } else {
      engine.player.setVelocity(0, 0);
    }

    // Update depth based on position
    const screenPos = engine.isoToScreen(engine.player.currentTile.x, engine.player.currentTile.y);
    engine.player.setDepth(screenPos.y + 1000);
    if (engine.player.shadow) {
      engine.player.shadow.setDepth(screenPos.y + 999);
      engine.player.shadow.x = engine.player.x;
      engine.player.shadow.y = engine.player.y + 12;
    }

    // Update hover highlight position
    if (engine.hoveredInteractable && engine.hoverHighlight.visible) {
      engine.showHoverHighlight(engine.hoveredInteractable);
    }
    
    // Note: Debug overlay is only drawn once when toggled, not every frame
    // (Removed from update loop to prevent performance issues)
  }

  /**
   * Toggle debug overlay
   */
  toggleDebug() {
    console.log('toggleDebug called, current mode:', this.debugMode);
    this.debugMode = !this.debugMode;
    console.log('New debug mode:', this.debugMode);
    
    if (!this.debugGraphics) {
      console.error('debugGraphics is null!');
      return;
    }
    
    if (!this.scene) {
      console.error('scene is null!');
      return;
    }
    
    this.debugGraphics.setVisible(this.debugMode);
    console.log('Debug graphics visibility set to:', this.debugMode);
    
    if (this.debugMode) {
      console.log('Updating debug overlay...');
      this.updateDebugOverlay();
    } else {
      this.debugGraphics.clear();
    }
  }

  /**
   * Update debug overlay with grid and entity info
   */
  updateDebugOverlay() {
    if (!this.debugGraphics || !this.scene) {
      console.warn('Debug graphics or scene not available');
      return;
    }
    
    const offsetX = this.scene.offsetX || this.originX || 0;
    const offsetY = this.scene.offsetY || this.originY || 0;
    const camera = this.scene.cameras.main;
    const cameraX = camera.scrollX || 0;
    const cameraY = camera.scrollY || 0;
    
    this.debugGraphics.clear();
    
    console.log('Drawing debug overlay:', { 
      offsetX, 
      offsetY, 
      cameraX, 
      cameraY,
      screenSize: { w: this.scene.scale.width, h: this.scene.scale.height },
      roomSize: { w: this.ROOM_WIDTH, h: this.ROOM_HEIGHT } 
    });
    
    // Draw diamond grid outlines (sample every 5th tile for performance)
    const tileStep = 5;
    this.debugGraphics.lineStyle(2, 0x00ff00, 0.6);
    let tilesDrawn = 0;
    for (let y = 0; y < this.ROOM_HEIGHT; y += tileStep) {
      for (let x = 0; x < this.ROOM_WIDTH; x += tileStep) {
        const screenPos = this.isoToScreen(x, y, 0, 0);
        
        // Draw diamond outline (world coordinates - Phaser handles camera scroll automatically)
        const centerX = offsetX + screenPos.x;
        const centerY = offsetY + screenPos.y;
        
        const points = [
          { x: centerX, y: centerY },
          { x: centerX + this.TILE_W / 2, y: centerY + this.TILE_H / 2 },
          { x: centerX, y: centerY + this.TILE_H },
          { x: centerX - this.TILE_W / 2, y: centerY + this.TILE_H / 2 }
        ];
        
        this.debugGraphics.strokePoints(points, true);
        
        // Draw base position dot (bottom center of tile)
        this.debugGraphics.fillStyle(0x00ff00, 0.8);
        this.debugGraphics.fillCircle(centerX, centerY + this.TILE_H, 3);
        tilesDrawn++;
      }
    }
    
    // Draw entity anchors and footprints (only visible entities)
    this.debugGraphics.lineStyle(2, 0xffff00, 0.8);
    this.furniture.forEach(sprite => {
      const placement = sprite.getData('placement');
      const entity = sprite.getData('entity');
      if (!placement || !entity) return;
      
      // Anchor dot (sprite position in world coordinates)
      this.debugGraphics.fillStyle(0xff0000, 1.0);
      this.debugGraphics.fillCircle(sprite.x, sprite.y, 4);
      
      // Footprint highlight
      const footprintW = entity.footprint_w || 1;
      const footprintH = entity.footprint_h || 1;
      
      for (let dy = 0; dy < footprintH; dy++) {
        for (let dx = 0; dx < footprintW; dx++) {
          const tx = placement.x + dx;
          const ty = placement.y + dy;
          const fpPos = this.isoToScreen(tx, ty, 0, 0);
          
          const fpCenterX = offsetX + fpPos.x;
          const fpCenterY = offsetY + fpPos.y;
          
          const fpPoints = [
            { x: fpCenterX, y: fpCenterY },
            { x: fpCenterX + this.TILE_W / 2, y: fpCenterY + this.TILE_H / 2 },
            { x: fpCenterX, y: fpCenterY + this.TILE_H },
            { x: fpCenterX - this.TILE_W / 2, y: fpCenterY + this.TILE_H / 2 }
          ];
          
          this.debugGraphics.strokePoints(fpPoints, true);
        }
      }
    });
    
    console.log(`Debug overlay drawn: ${tilesDrawn} grid tiles (sampled), ${this.furniture.length} entities`);
  }

  /**
   * Cleanup and destroy game
   */
  destroy() {
    if (this.game) {
      this.game.destroy(true);
      this.game = null;
    }
    this.Phaser = null;
    this.scene = null;
    this.player = null;
    this.interactables = [];
    this.furniture = [];
  }
}

// Export for use in arcade.ejs
if (typeof module !== 'undefined' && module.exports) {
  module.exports = ArcadeEngine;
} else {
  window.ArcadeEngine = ArcadeEngine;
}

