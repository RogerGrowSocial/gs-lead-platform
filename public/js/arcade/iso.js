/**
 * Isometric Grid Math - Single Source of Truth
 * 
 * Kenney Conveyor Kit specifications:
 * - Base tile size: 128x64
 * - Tileset drawing offset: X:-192, Y:170
 * 
 * This module provides deterministic conversion between tile coordinates
 * and screen coordinates for isometric rendering.
 */

// Kenney tile constants
export const TILE_W = 128;
export const TILE_H = 64;

// Kenney default drawing offset (from Tiled documentation)
export const KENNEY_DRAW_OFFSET_X = -192;
export const KENNEY_DRAW_OFFSET_Y = 170;

/**
 * Convert isometric tile coordinates to screen coordinates
 * @param {number} tileX - Tile X coordinate
 * @param {number} tileY - Tile Y coordinate
 * @param {number} originX - Screen origin X (camera offset)
 * @param {number} originY - Screen origin Y (camera offset)
 * @returns {{x: number, y: number}} Screen coordinates
 */
export function isoToScreen(tileX, tileY, originX = 0, originY = 0) {
  const screenX = (tileX - tileY) * (TILE_W / 2) + originX;
  const screenY = (tileX + tileY) * (TILE_H / 2) + originY;
  return { x: screenX, y: screenY };
}

/**
 * Convert screen coordinates to isometric tile coordinates
 * @param {number} screenX - Screen X coordinate
 * @param {number} screenY - Screen Y coordinate
 * @param {number} originX - Screen origin X (camera offset)
 * @param {number} originY - Screen origin Y (camera offset)
 * @returns {{x: number, y: number, fx: number, fy: number}} Tile coordinates (x, y are rounded, fx, fy are fractional)
 */
export function screenToIso(screenX, screenY, originX = 0, originY = 0) {
  const dx = screenX - originX;
  const dy = screenY - originY;
  const tileX = (dy / (TILE_H / 2) + dx / (TILE_W / 2)) / 2;
  const tileY = (dy / (TILE_H / 2) - dx / (TILE_W / 2)) / 2;
  return {
    x: Math.round(tileX),
    y: Math.round(tileY),
    fx: tileX, // fractional for smooth movement
    fy: tileY
  };
}

/**
 * Get the footprint tiles occupied by an entity
 * @param {number} baseTileX - Base tile X (south-most anchor)
 * @param {number} baseTileY - Base tile Y (south-most anchor)
 * @param {number} footprintW - Footprint width in tiles
 * @param {number} footprintH - Footprint height in tiles
 * @returns {Array<{x: number, y: number}>} Array of occupied tile coordinates
 */
export function getFootprintTiles(baseTileX, baseTileY, footprintW, footprintH) {
  const tiles = [];
  for (let dy = 0; dy < footprintH; dy++) {
    for (let dx = 0; dx < footprintW; dx++) {
      tiles.push({ x: baseTileX + dx, y: baseTileY + dy });
    }
  }
  return tiles;
}

// Export for Node.js compatibility
if (typeof module !== 'undefined' && module.exports) {
  module.exports = { TILE_W, TILE_H, KENNEY_DRAW_OFFSET_X, KENNEY_DRAW_OFFSET_Y, isoToScreen, screenToIso, getFootprintTiles };
}

