/**
 * FactoryEngine - 3D Factory Command Center using Three.js (orthographic isometric vibe)
 * Patterns reused:
 * - Route guards & menu: /routes/admin.js, /views/layouts/admin.ejs
 * - Supabase state: /api/admin/arcade/state (placements, metrics)
 * - Toasts/modals: existing notification container + window.showNotification fallback
 *
 * Assets:
 * - Expects extracted Kenney Conveyor Kit under /public/arcade/kenney/conveyor-kit/
 * - If missing, shows overlay with instructions to run: npm run arcade:assets
 */

class FactoryEngine {
  constructor(containerId, arcadeState, options = {}) {
    this.containerId = containerId;
    this.arcadeState = arcadeState || {};
    this.container = document.getElementById(containerId);
    this.scene = null;
    this.camera = null;
    this.renderer = null;
    this.clock = null;
    this.mixers = [];
    this.items = [];
    this.stations = [];
    this.isEditMode = false;
    this.editTool = 'place'; // 'place' or 'delete'
    this.draggedStation = null;
    this.raycaster = null;
    this.pointer = null;
    this.assetsAvailable = options.assetsAvailable !== false; // default true
    this.hudUpdater = options.hudUpdater || (() => {});
    this.onNavigate = options.onNavigate || (() => {});
    this.savePlacement = options.savePlacement || (() => {});
    this.patchPlacement = options.patchPlacement || (() => {});
    this.deletePlacement = options.deletePlacement || (() => {});
    this.entityIdMap = this._buildEntityIdMap(arcadeState);
    this.roomId = arcadeState?.room?.id || null;
    this.selectedAssetKey = 'station_intake';
    this.selectedModelName = null; // Set dynamically from drag
    this.ground = null;
    this.gridStep = 10; // world units per grid step (matches GridHelper: 200/20 = 10)
    this.modelCache = {}; // Cache loaded GLB models
    this.hoverIndicator = null; // Visual indicator for hover position
    this.assetModelMap = {
      'station_intake': 'structure-high',
      'station_leadflow': 'structure-medium',
      'station_sales': 'structure-tall',
      'station_delivery': 'structure-short',
      'station_services': 'structure-yellow-high',
      'station_billing': 'structure-yellow-medium',
      'station_payroll': 'structure-yellow-tall',
      'conveyor': 'conveyor',
      'conveyor_long': 'conveyor-long',
      'box_small': 'box-small',
      'box_large': 'box-large',
      'robot_arm_a': 'robot-arm-a',
      'scanner_high': 'scanner-high',
      'door': 'door',
      'cover': 'cover'
    };
  }

  _buildEntityIdMap(state) {
    const map = {};
    // Extract entity IDs from placements
    (state.placements || []).forEach((p) => {
      const key = p.arcade_entities?.key;
      if (key && p.entity_id) {
        map[key] = p.entity_id;
      }
    });
    // Also extract from entities if they're in state
    if (state.entities) {
      state.entities.forEach((e) => {
        if (e.key && e.id) {
          map[e.key] = e.id;
        }
      });
    }
    return map;
  }

  async init() {
    const { Scene, AmbientLight, DirectionalLight, WebGLRenderer, OrthographicCamera, Clock, Raycaster, Vector2 } = await this._loadThree();

    this.scene = new Scene();
    this.clock = new Clock();
    this.raycaster = new Raycaster();
    this.pointer = new Vector2();

    // Camera setup - orthographic isometric
    const width = this.container.clientWidth;
    const height = this.container.clientHeight;
    const aspect = width / height;
    const viewSize = 60; // controls zoom level
    this.camera = new OrthographicCamera(
      (-viewSize * aspect) / 2,
      (viewSize * aspect) / 2,
      viewSize / 2,
      -viewSize / 2,
      0.1,
      1000
    );
    this.camera.position.set(50, 80, 50); // isometric angle
    this.camera.lookAt(0, 0, 0);

    // Lights
    const ambient = new AmbientLight(0xffffff, 0.6);
    this.scene.add(ambient);
    const dir = new DirectionalLight(0xffffff, 0.7);
    dir.position.set(50, 100, 50);
    this.scene.add(dir);

    // Renderer
    this.renderer = new WebGLRenderer({ antialias: true, alpha: true });
    this.renderer.setSize(width, height);
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    this.container.innerHTML = '';
    this.container.appendChild(this.renderer.domElement);

    // Build world
    await this._buildWorld();

    // Events
    window.addEventListener('resize', () => this._onResize());
    this.renderer.domElement.addEventListener('pointermove', (e) => this._onPointerMove(e));
    this.renderer.domElement.addEventListener('pointerdown', (e) => { this._onPointerDown(e).catch(console.error); });
    this.renderer.domElement.addEventListener('pointerup', (e) => this._onPointerUp(e));
    // Drag and drop
    this.renderer.domElement.addEventListener('dragover', (e) => this._onDragOver(e));
    this.renderer.domElement.addEventListener('drop', (e) => { this._onDrop(e).catch(console.error); });

    // Start loop
    this._animate();
  }

  async _loadThree() {
    if (window.THREE) return window.THREE;
    const mod = await import('https://cdn.jsdelivr.net/npm/three@0.165.0/build/three.module.js');
    window.THREE = mod;
    // Load GLTFLoader - use importmap or direct import with full URL
    if (!window.GLTFLoader) {
      try {
        // Create import map if it doesn't exist
        if (!document.querySelector('script[type="importmap"]')) {
          const importMap = document.createElement('script');
          importMap.type = 'importmap';
          importMap.textContent = JSON.stringify({
            imports: {
              'three': 'https://cdn.jsdelivr.net/npm/three@0.165.0/build/three.module.js'
            }
          });
          document.head.appendChild(importMap);
          // Wait a bit for importmap to be processed
          await new Promise(resolve => setTimeout(resolve, 100));
        }
        const { GLTFLoader } = await import('https://cdn.jsdelivr.net/npm/three@0.165.0/examples/jsm/loaders/GLTFLoader.js');
        window.GLTFLoader = GLTFLoader;
      } catch (err) {
        console.warn('GLTFLoader failed to load, models will use fallback:', err);
        // Continue without GLTFLoader - fallback to boxes
      }
    }
    return mod;
  }

  async _buildWorld() {
    const THREE = await this._loadThree();
    const { BoxGeometry, MeshStandardMaterial, Mesh, PlaneGeometry, Vector3, RepeatWrapping, TextureLoader, GridHelper } = THREE;

    // Ground - make it more visible
    const groundGeo = new PlaneGeometry(200, 200);
    const groundMat = new MeshStandardMaterial({ color: 0x1a1f2e, roughness: 0.9, metalness: 0.1 });
    const ground = new Mesh(groundGeo, groundMat);
    ground.rotation.x = -Math.PI / 2;
    ground.userData.isGround = true;
    this.scene.add(ground);
    this.ground = ground;
    
    // Add grid pattern to ground for visibility
    // Grid: 200 units total, 20 divisions = 10 units per cell (matches gridStep)
    const gridHelper = new GridHelper(200, 20, 0x374151, 0x1f2937);
    gridHelper.position.y = 0.01; // Slightly above ground
    this.scene.add(gridHelper);

    // Glow strips (simple emissive planes)
    const stripGeo = new PlaneGeometry(200, 2);
    const stripMat = new MeshStandardMaterial({ color: 0x1f2937, emissive: 0x111827, emissiveIntensity: 1 });
    for (let i = -80; i <= 80; i += 20) {
      const strip = new Mesh(stripGeo, stripMat);
      strip.rotation.x = -Math.PI / 2;
      strip.position.z = i;
      this.scene.add(strip);
    }

    // Load conveyor texture if available
    let conveyorMat = new MeshStandardMaterial({ color: 0x2f3746, roughness: 0.6, metalness: 0.4 });
    if (this.assetsAvailable) {
      // Use available preview conveyor texture
      const texture = await this._loadTexture('/arcade/kenney/conveyor-kit/Previews/conveyor.png');
      if (texture) {
        texture.wrapS = texture.wrapT = RepeatWrapping;
        texture.repeat.set(4, 1);
        conveyorMat = new MeshStandardMaterial({ map: texture, roughness: 0.5, metalness: 0.3 });
      }
    }

    // Conveyors - try to load Kenney models, fallback to boxes
    this.conveyors = [];
    const conveyorModel = await this._loadModel('/arcade/kenney/conveyor-kit/Models/GLB format/conveyor-long.glb');
    if (conveyorModel) {
      for (let i = -2; i <= 2; i++) {
        const conveyor = conveyorModel.clone();
        conveyor.position.set(i * 20, 0.5, 0);
        this.scene.add(conveyor);
        this.conveyors.push(conveyor);
      }
    } else {
      // Fallback to simple box
      const conveyorGeo = new BoxGeometry(80, 1, 6);
      const conveyor = new Mesh(conveyorGeo, conveyorMat);
      conveyor.position.set(0, 0.5, 0);
      this.scene.add(conveyor);
      this.conveyors.push(conveyor);
    }

    // Stations from placements - load Kenney models
    const placements = this.arcadeState.placements || [];
    for (const p of placements) {
      const entityKey = p.arcade_entities?.key || 'station_intake';
      const modelName = this.assetModelMap[entityKey] || 'structure-medium';
      // Convert database coords (0-based grid) to world coords
      // Database: x=0..50, y=0..40 (example range)
      // World: x=-50..50, z=-40..40
      // Formula: world = (db * 2) - offset
      // Reverse: db = (world + offset) / 2
      const worldX = (p.x * 2) - 50;
      const worldZ = (p.y * 2) - 40;
      // Snap to grid for visual alignment
      const snappedX = Math.round(worldX / this.gridStep) * this.gridStep;
      const snappedZ = Math.round(worldZ / this.gridStep) * this.gridStep;
      const station = await this._createStationFromModel(modelName, snappedX, 3, snappedZ);
      if (station) {
        station.userData = { placement: p };
        this.scene.add(station);
        this.stations.push(station);
      }
    }

    // If no placements, add default stations with labels and routes
    if (!placements.length) {
      const defaults = [
        { key: 'station_intake', name: 'Intake', route: '/admin/leads', pos: new Vector3(-40, 3, 20) },
        { key: 'station_leadflow', name: 'Leadflow', route: '/admin/leads/engine', pos: new Vector3(-20, 3, 20) },
        { key: 'station_sales', name: 'Sales', route: '/admin/opportunities', pos: new Vector3(0, 3, 20) },
        { key: 'station_delivery', name: 'Delivery', route: '/admin/tickets', pos: new Vector3(20, 3, 20) },
        { key: 'station_services', name: 'Services', route: '/admin/services', pos: new Vector3(40, 3, 20) },
        { key: 'station_billing', name: 'Billing', route: '/admin/payments/invoices', pos: new Vector3(-20, 3, -10) },
        { key: 'station_payroll', name: 'Payroll', route: '/admin/employees', pos: new Vector3(20, 3, -10) }
      ];
      for (const d of defaults) {
        const modelName = this.assetModelMap[d.key] || 'structure-medium';
        const s = await this._createStationFromModel(modelName, d.pos.x, d.pos.y, d.pos.z);
        if (s) {
          s.userData = { entity: { key: d.key, interaction_payload: { route: d.route } } };
          this.scene.add(s);
          this.stations.push(s);
        }
      }
    }

    // Moving items (crates) - try to load Kenney box models
    const crateModel = await this._loadModel('/arcade/kenney/conveyor-kit/Models/GLB format/box-small.glb');
    for (let i = 0; i < 10; i++) {
      let crate;
      if (crateModel) {
        crate = crateModel.clone();
        crate.scale.set(0.5, 0.5, 0.5);
      } else {
        // Fallback to simple box
        const THREE = await this._loadThree();
        const crateGeo = new THREE.BoxGeometry(2, 2, 2);
        const crateMat = new THREE.MeshStandardMaterial({ color: 0x38bdf8, emissive: 0x0ea5e9, emissiveIntensity: 0.6 });
        crate = new THREE.Mesh(crateGeo, crateMat);
      }
      crate.position.set(-40 + i * 8, 2, 0);
      crate.userData = { speed: 4 + Math.random() * 2 };
      this.scene.add(crate);
      this.items.push(crate);
    }

    // HUD updater hook
    this.hudUpdater();
  }

  async _loadTexture(url) {
    const THREE = await this._loadThree();
    return new Promise((resolve) => {
      const loader = new THREE.TextureLoader();
      loader.load(
        url,
        (tex) => resolve(tex),
        undefined,
        () => resolve(null) // fail silently
      );
    });
  }

  async _loadModel(url) {
    if (this.modelCache[url]) {
      return this.modelCache[url];
    }
    const THREE = await this._loadThree();
    const GLTFLoader = window.GLTFLoader;
    if (!GLTFLoader) return null;
    
    return new Promise((resolve) => {
      const loader = new GLTFLoader();
      loader.load(
        url,
        (gltf) => {
          const model = gltf.scene;
          this.modelCache[url] = model;
          resolve(model);
        },
        undefined,
        () => resolve(null) // fail silently
      );
    });
  }

  async _createStationFromModel(modelName, x, y, z) {
    const model = await this._loadModel(`/arcade/kenney/conveyor-kit/Models/GLB format/${modelName}.glb`);
    if (model) {
      const station = model.clone();
      station.position.set(x, y, z);
      station.scale.set(2, 2, 2); // Scale to fit grid
      return station;
    }
    // Fallback to simple box
    const THREE = await this._loadThree();
    const stationGeo = new THREE.BoxGeometry(8, 6, 8);
    const stationMat = new THREE.MeshStandardMaterial({ color: 0x1f6feb, emissive: 0x0a1f44, emissiveIntensity: 0.8 });
    const station = new THREE.Mesh(stationGeo, stationMat);
    station.position.set(x, y, z);
    return station;
  }

  _animate() {
    requestAnimationFrame(() => this._animate());
    const delta = this.clock.getDelta();

    // Move crates along X
    this.items.forEach((c) => {
      c.position.x += c.userData.speed * delta;
      if (c.position.x > 40) c.position.x = -40;
    });

    this.renderer.render(this.scene, this.camera);
  }

  _onResize() {
    if (!this.renderer || !this.camera) return;
    const width = this.container.clientWidth;
    const height = this.container.clientHeight;
    const aspect = width / height;
    const viewSize = 60;
    this.camera.left = (-viewSize * aspect) / 2;
    this.camera.right = (viewSize * aspect) / 2;
    this.camera.top = viewSize / 2;
    this.camera.bottom = -viewSize / 2;
    this.camera.updateProjectionMatrix();
    this.renderer.setSize(width, height);
  }

  _onPointerMove(event) {
    if (!this.renderer || !this.camera || !this.raycaster) return;
    const rect = this.renderer.domElement.getBoundingClientRect();
    this.pointer.x = ((event.clientX - rect.left) / rect.width) * 2 - 1;
    this.pointer.y = -((event.clientY - rect.top) / rect.height) * 2 + 1;

    // Dragging an existing station in edit mode
    if (this.isEditMode && this.draggedStation) {
      this.raycaster.setFromCamera(this.pointer, this.camera);
      const hits = this.raycaster.intersectObjects([this.ground]);
      if (hits.length > 0) {
        const snapped = this._snapToGrid(hits[0].point);
        this.draggedStation.position.set(snapped.x, this.draggedStation.position.y, snapped.z);
      }
      return;
    }
    
    // Update hover indicator in edit mode
    if (this.isEditMode && this.ground) {
      this.raycaster.setFromCamera(this.pointer, this.camera);
      
      if (this.editTool === 'delete') {
        // In delete mode, show indicator on stations
        const stationHits = this.raycaster.intersectObjects(this.stations);
        if (stationHits.length > 0) {
          const target = stationHits[0].object;
          const pos = target.position;
          this._updateHoverIndicator({ x: pos.x, z: pos.z });
        } else {
          this._hideHoverIndicator();
        }
      } else {
        // In place mode, show indicator on ground
        const hits = this.raycaster.intersectObjects([this.ground]);
        if (hits.length > 0) {
          const snapped = this._snapToGrid(hits[0].point);
          this._updateHoverIndicator(snapped);
        } else {
          this._hideHoverIndicator();
        }
      }
    } else {
      this._hideHoverIndicator();
    }
  }

  async _onPointerDown(event) {
    if (!this.scene || !this.camera || !this.raycaster) return;
    this.raycaster.setFromCamera(this.pointer, this.camera);
    const stationHits = this.raycaster.intersectObjects(this.stations);
    const groundHits = this.raycaster.intersectObjects([this.ground]);

    // Edit mode: place on ground, drag station, or delete
    if (this.isEditMode) {
      if (this.editTool === 'delete') {
        // Delete mode: click station to delete
        if (stationHits.length > 0) {
          const target = stationHits[0].object;
          const placement = target.userData.placement;
          // Check if station has a placement ID (from database)
          if (placement && placement.id) {
            await this._deleteStation(placement.id, target);
          } else {
            // Station without placement (default/unsaved) - just remove from scene
            const stationName = target.userData.entity?.name || target.userData.placement?.arcade_entities?.name || 'station';
            if (confirm(`Weet je zeker dat je "${stationName}" wilt verwijderen?\n\nDit station is nog niet opgeslagen.`)) {
              this.scene.remove(target);
              this.stations = this.stations.filter(s => s !== target);
              // Dispose resources
              if (target.geometry) target.geometry.dispose();
              if (target.material) {
                if (Array.isArray(target.material)) {
                  target.material.forEach(m => m.dispose());
                } else {
                  target.material.dispose();
                }
              }
              target.traverse((child) => {
                if (child.geometry) child.geometry.dispose();
                if (child.material) {
                  if (Array.isArray(child.material)) {
                    child.material.forEach(m => m.dispose());
                  } else {
                    child.material.dispose();
                  }
                }
              });
            }
          }
        }
        return;
      }
      
      // Place mode: drag station or place new
      if (stationHits.length > 0) {
        this.draggedStation = stationHits[0].object;
      } else if (groundHits.length > 0) {
        const point = groundHits[0].point;
        const snapped = this._snapToGrid(point);
        await this._placeNewStation(snapped);
      }
      return;
    }

    // Normal mode: navigate on station click
    if (stationHits.length > 0) {
      const target = stationHits[0].object;
      const placement = target.userData.placement;
      const entity = placement?.arcade_entities || target.userData.entity;
      if (entity && entity.interaction_payload?.route) {
        this.onNavigate(entity.interaction_payload.route);
      }
    }
  }

  _onPointerUp() {
    if (this.draggedStation) {
      // Snap dragged station to grid
      const snapped = this._snapToGrid(this.draggedStation.position);
      this.draggedStation.position.set(snapped.x, this.draggedStation.position.y, snapped.z);
      // TODO: Persist moved position via PATCH
    }
    this.draggedStation = null;
  }

  _onDragOver(event) {
    event.preventDefault();
  }

  async _onDrop(event) {
    event.preventDefault();
    if (!this.isEditMode) return;
    const asset = event.dataTransfer.getData('text/plain');
    if (asset) {
      this.selectedAssetKey = asset;
      // simulate click to place where cursor is
      await this._placeFromPointer();
    }
  }

  async _placeFromPointer() {
    if (!this.ground || !this.raycaster || !this.camera) return;
    this.raycaster.setFromCamera(this.pointer, this.camera);
    const hits = this.raycaster.intersectObjects([this.ground]);
    if (!hits.length) return;
    const point = hits[0].point;
    const snapped = this._snapToGrid(point);
    await this._placeNewStation(snapped);
  }

  _snapToGrid(point) {
    const x = Math.round(point.x / this.gridStep) * this.gridStep;
    const z = Math.round(point.z / this.gridStep) * this.gridStep;
    return { x, z };
  }

  _updateHoverIndicator(pos) {
    const THREE = window.THREE;
    if (!THREE || !this.scene) return;
    
    if (!this.hoverIndicator) {
      const color = this.editTool === 'delete' ? 0xff0000 : 0x00ff00;
      // Hover indicator size matches grid cell (10 units)
      const geometry = new THREE.RingGeometry(4, 5, 32);
      const material = new THREE.MeshBasicMaterial({ 
        color, 
        transparent: true, 
        opacity: 0.6,
        side: THREE.DoubleSide
      });
      this.hoverIndicator = new THREE.Mesh(geometry, material);
      this.hoverIndicator.rotation.x = -Math.PI / 2;
      this.hoverIndicator.position.y = 0.1;
      this.scene.add(this.hoverIndicator);
    }
    
    const color = this.editTool === 'delete' ? 0xff0000 : 0x00ff00;
    this.hoverIndicator.material.color.setHex(color);
    this.hoverIndicator.position.set(pos.x, 0.1, pos.z);
    this.hoverIndicator.visible = true;
  }

  _hideHoverIndicator() {
    if (this.hoverIndicator) {
      this.hoverIndicator.visible = false;
    }
  }

  async _deleteStation(placementId, stationMesh) {
    const stationName = stationMesh.userData.placement?.arcade_entities?.name || 
                       stationMesh.userData.entity?.name || 
                       'station';
    
    if (!confirm(`Weet je zeker dat je "${stationName}" wilt verwijderen?\n\nDit kan niet ongedaan worden gemaakt.`)) {
      return;
    }
    
    try {
      if (this.deletePlacement) {
        await this.deletePlacement(placementId);
      }
      // Remove from scene
      this.scene.remove(stationMesh);
      this.stations = this.stations.filter(s => s !== stationMesh);
      // Dispose geometry and material
      if (stationMesh.geometry) stationMesh.geometry.dispose();
      if (stationMesh.material) {
        if (Array.isArray(stationMesh.material)) {
          stationMesh.material.forEach(m => m.dispose());
        } else {
          stationMesh.material.dispose();
        }
      }
      // Also dispose children if it's a GLTF model
      stationMesh.traverse((child) => {
        if (child.geometry) child.geometry.dispose();
        if (child.material) {
          if (Array.isArray(child.material)) {
            child.material.forEach(m => m.dispose());
          } else {
            child.material.dispose();
          }
        }
      });
    } catch (err) {
      console.error('Failed to delete station:', err);
      if (window.showNotification) {
        window.showNotification('Verwijderen mislukt', 'error');
      }
    }
  }

  async _placeNewStation(pos) {
    const key = this.selectedAssetKey || 'station_intake';
    if (!this.roomId) {
      console.warn('Room missing, cannot place station');
      return;
    }
    const entityId = this.entityIdMap[key] || null;
    // Use selectedModelName if set, otherwise fallback to assetModelMap
    const modelName = this.selectedModelName || this.assetModelMap[key] || 'structure-medium';
    const station = await this._createStationFromModel(modelName, pos.x, 3, pos.z);
    if (!station) return;
    station.userData = { entity: { key, interaction_payload: { route: this._routeForKey(key) } }, entity_id: entityId };
    this.scene.add(station);
    this.stations.push(station);
    // Convert world coords to database coords
    // World: x=-50..50, z=-40..40
    // Database: x=0..50, y=0..40
    // Formula: db = (world + offset) / 2
    const dbX = Math.round((pos.x + 50) / 2);
    const dbY = Math.round((pos.z + 40) / 2);
    
    // Persist placement (entity_id may be null if entity doesn't exist yet)
    this.savePlacement({
      room_id: this.roomId,
      entity_id: entityId,
      entity_key: key, // Pass key so backend can create entity if needed
      x: dbX,
      y: dbY,
      rotation: 0,
      z_index: 0,
      meta: {}
    });
  }

  _routeForKey(key) {
    const routes = {
      station_intake: '/admin/leads',
      station_leadflow: '/admin/leads/engine',
      station_sales: '/admin/opportunities',
      station_delivery: '/admin/tickets',
      station_services: '/admin/services',
      station_billing: '/admin/payments/invoices',
      station_payroll: '/admin/employees'
    };
    return routes[key] || '/admin';
  }

  destroy() {
    if (this.renderer) {
      this.renderer.dispose();
      this.renderer.forceContextLoss();
      this.renderer.domElement = null;
      this.renderer = null;
    }
    this.scene = null;
    this.camera = null;
  }
}

if (typeof module !== 'undefined' && module.exports) {
  module.exports = FactoryEngine;
} else {
  window.FactoryEngine = FactoryEngine;
}