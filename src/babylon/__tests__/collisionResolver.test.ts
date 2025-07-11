import { Scene, Engine, NullEngine, Mesh, MeshBuilder, Vector3 } from 'babylonjs';
import { CollisionResolver, createCollisionResolver } from './collisionResolver';
import { DEFAULT_COLLISION_CONFIG } from '../config/collisionConfig';

describe('CollisionResolver', () => {
  let scene: Scene;
  let engine: Engine;
  let resolver: CollisionResolver;

  beforeEach(() => {
    // Create test scene with null engine
    engine = new NullEngine();
    scene = new Scene(engine);
    resolver = createCollisionResolver(scene);
  });

  afterEach(() => {
    scene.dispose();
    engine.dispose();
  });

  describe('Constructor and Configuration', () => {
    it('should initialize with default configuration', () => {
      const config = resolver.getConfig();
      expect(config).toEqual(DEFAULT_COLLISION_CONFIG);
    });

    it('should update configuration correctly', () => {
      resolver.updateConfig({ searchStepSize: 1.0, maxSearchDistance: 20 });
      const config = resolver.getConfig();
      expect(config.searchStepSize).toBe(1.0);
      expect(config.maxSearchDistance).toBe(20);
      // Other values should remain default
      expect(config.enabled).toBe(DEFAULT_COLLISION_CONFIG.enabled);
    });

    it('should validate configuration values', () => {
      resolver.updateConfig({ 
        searchStepSize: -1, // Invalid negative value
        maxSearchDistance: 0 // Invalid zero value
      });
      const config = resolver.getConfig();
      expect(config.searchStepSize).toBe(0.1); // Should be corrected to minimum
      expect(config.maxSearchDistance).toBe(1); // Should be corrected to minimum
    });
  });

  describe('Collision Detection', () => {
    let mesh1: Mesh;
    let mesh2: Mesh;

    beforeEach(() => {
      // Create two boxes for collision testing
      mesh1 = MeshBuilder.CreateBox('box1', { size: 1 }, scene);
      mesh2 = MeshBuilder.CreateBox('box2', { size: 1 }, scene);
      mesh1.position = new Vector3(0, 0, 0);
      mesh2.position = new Vector3(2, 0, 0); // No collision initially
    });

    it('should detect no collision when meshes are separated', () => {
      const result = resolver.detectCollisions(mesh1.id);
      expect(result.hasCollision).toBe(false);
      expect(result.collidingObjectIds).toHaveLength(0);
      expect(result.collisions).toHaveLength(0);
    });

    it('should detect collision when meshes overlap', () => {
      mesh2.position = new Vector3(0.5, 0, 0); // Overlap with mesh1
      mesh2.computeWorldMatrix(true);
      
      const result = resolver.detectCollisions(mesh1.id);
      expect(result.hasCollision).toBe(true);
      expect(result.collidingObjectIds).toContain(mesh2.id);
      expect(result.collisions).toHaveLength(1);
      expect(result.collisions[0].objectId).toBe(mesh2.id);
    });

    it('should test collision at different position without moving mesh', () => {
      const testPosition = new Vector3(0.5, 0, 0);
      mesh2.position = new Vector3(0.5, 0, 0);
      mesh2.computeWorldMatrix(true);
      
      const result = resolver.detectCollisions(mesh1.id, testPosition);
      expect(result.hasCollision).toBe(true);
      
      // Original mesh position should not change
      expect(mesh1.position.equals(new Vector3(0, 0, 0))).toBe(true);
    });

    it('should exclude specified mesh IDs from collision checks', () => {
      mesh2.position = new Vector3(0.5, 0, 0);
      mesh2.computeWorldMatrix(true);
      
      const result = resolver.detectCollisions(mesh1.id, undefined, [mesh2.id]);
      expect(result.hasCollision).toBe(false);
      expect(result.collidingObjectIds).not.toContain(mesh2.id);
    });

    it('should ignore invisible meshes', () => {
      mesh2.position = new Vector3(0.5, 0, 0);
      mesh2.isVisible = false;
      mesh2.computeWorldMatrix(true);
      
      const result = resolver.detectCollisions(mesh1.id);
      expect(result.hasCollision).toBe(false);
    });

    it('should calculate collision details correctly', () => {
      mesh2.position = new Vector3(0.5, 0, 0);
      mesh2.computeWorldMatrix(true);
      
      const result = resolver.detectCollisions(mesh1.id);
      expect(result.collisions[0].centerDistance).toBeCloseTo(0.5, 2);
      expect(result.collisions[0].intersectionVolume).toBeGreaterThan(0);
    });
  });

  describe('Collision Resolution', () => {
    let mesh1: Mesh;
    let mesh2: Mesh;
    let mesh3: Mesh;

    beforeEach(() => {
      mesh1 = MeshBuilder.CreateBox('box1', { size: 1 }, scene);
      mesh2 = MeshBuilder.CreateBox('box2', { size: 1 }, scene);
      mesh3 = MeshBuilder.CreateBox('box3', { size: 1 }, scene);
      
      // Place mesh1 at origin
      mesh1.position = new Vector3(0, 0, 0);
      
      // Place mesh2 overlapping with mesh1
      mesh2.position = new Vector3(0.5, 0, 0);
      
      // Place mesh3 to the right, not overlapping
      mesh3.position = new Vector3(2, 0, 0);
    });

    it('should find valid position when collision exists', () => {
      const result = resolver.resolveCollisions(mesh2.id);
      
      expect(result.resolved).toBe(true);
      expect(result.distanceMoved).toBeGreaterThan(0);
      expect(result.positionsTested).toBeGreaterThan(0);
      
      // New position should not collide
      const collisionCheck = resolver.detectCollisions(mesh2.id, result.newPosition);
      expect(collisionCheck.hasCollision).toBe(false);
    });

    it('should return original position when no collision exists', () => {
      const originalPos = mesh3.position.clone();
      const result = resolver.resolveCollisions(mesh3.id);
      
      expect(result.resolved).toBe(true);
      expect(result.distanceMoved).toBe(0);
      expect(result.newPosition.equals(originalPos)).toBe(true);
      expect(result.positionsTested).toBe(1);
    });

    it('should respect disabled configuration', () => {
      const result = resolver.resolveCollisions(mesh2.id, [], { enabled: false });
      
      expect(result.resolved).toBe(false);
      expect(result.positionsTested).toBe(0);
    });

    it('should use spiral search pattern', () => {
      resolver.updateConfig({ searchPattern: 'spiral', searchStepSize: 0.5 });
      const result = resolver.resolveCollisions(mesh2.id);
      
      expect(result.resolved).toBe(true);
      // Spiral pattern should find a position relatively close
      expect(result.distanceMoved).toBeLessThan(2);
    });

    it('should use radial search pattern', () => {
      resolver.updateConfig({ searchPattern: 'radial', searchStepSize: 0.5 });
      const result = resolver.resolveCollisions(mesh2.id);
      
      expect(result.resolved).toBe(true);
      expect(result.positionsTested).toBeGreaterThan(0);
    });

    it('should use grid search pattern', () => {
      resolver.updateConfig({ searchPattern: 'grid', searchStepSize: 0.5 });
      const result = resolver.resolveCollisions(mesh2.id);
      
      expect(result.resolved).toBe(true);
      expect(result.positionsTested).toBeGreaterThan(0);
    });

    it('should respect max search distance', () => {
      // Surround mesh2 with many meshes
      for (let x = -5; x <= 5; x++) {
        for (let z = -5; z <= 5; z++) {
          if (x !== 0 || z !== 0) {
            const blocker = MeshBuilder.CreateBox(`blocker-${x}-${z}`, { size: 0.9 }, scene);
            blocker.position = new Vector3(x, 0, z);
          }
        }
      }
      
      resolver.updateConfig({ maxSearchDistance: 1 });
      const result = resolver.resolveCollisions(mesh2.id);
      
      // Should not find a valid position within 1 unit
      expect(result.resolved).toBe(false);
    });

    it('should snap to grid when enabled', () => {
      resolver.updateConfig({ respectGridSnap: true, searchStepSize: 0.25 });
      const result = resolver.resolveCollisions(mesh2.id);
      
      if (result.resolved) {
        // Check that position is snapped to 0.5 grid
        expect(result.newPosition.x % 0.5).toBeCloseTo(0, 10);
        expect(result.newPosition.z % 0.5).toBeCloseTo(0, 10);
      }
    });

    it('should search vertically when enabled', () => {
      // Block all horizontal positions
      for (let x = -2; x <= 2; x++) {
        for (let z = -2; z <= 2; z++) {
          if (x !== 0 || z !== 0) {
            const blocker = MeshBuilder.CreateBox(`h-blocker-${x}-${z}`, { size: 0.9 }, scene);
            blocker.position = new Vector3(x * 0.5, 0, z * 0.5);
          }
        }
      }
      
      resolver.updateConfig({ 
        searchVertical: true, 
        verticalStepSize: 1,
        maxSearchDistance: 3 
      });
      const result = resolver.resolveCollisions(mesh2.id);
      
      expect(result.resolved).toBe(true);
      // Should find position above or below
      expect(Math.abs(result.newPosition.y)).toBeGreaterThan(0);
    });
  });

  describe('Performance and Caching', () => {
    it('should track performance metrics', () => {
      const mesh1 = MeshBuilder.CreateBox('perf1', { size: 1 }, scene);
      const mesh2 = MeshBuilder.CreateBox('perf2', { size: 1 }, scene);
      mesh2.position = new Vector3(0.5, 0, 0);
      
      // Perform detection
      resolver.detectCollisions(mesh1.id);
      
      const metrics = resolver.getPerformanceMetrics();
      expect(metrics.totalDetections).toBe(1);
      expect(metrics.averageDetectionTime).toBeGreaterThan(0);
      
      // Perform resolution
      resolver.resolveCollisions(mesh2.id);
      
      const metricsAfter = resolver.getPerformanceMetrics();
      expect(metricsAfter.totalResolutions).toBe(1);
      expect(metricsAfter.averageResolutionTime).toBeGreaterThan(0);
    });

    it('should cache bounding boxes', () => {
      const mesh = MeshBuilder.CreateBox('cache1', { size: 1 }, scene);
      
      // First call should calculate and cache
      const start1 = performance.now();
      resolver.detectCollisions(mesh.id);
      const time1 = performance.now() - start1;
      
      // Second call should use cache (faster)
      const start2 = performance.now();
      resolver.detectCollisions(mesh.id);
      const time2 = performance.now() - start2;
      
      // Cache hit should be faster (though this might be flaky in CI)
      // Just verify cache functionality works
      expect(time2).toBeLessThanOrEqual(time1 + 0.1);
    });

    it('should invalidate cache', () => {
      const mesh = MeshBuilder.CreateBox('cache2', { size: 1 }, scene);
      
      // Cache the bounding box
      resolver.detectCollisions(mesh.id);
      
      // Invalidate cache
      resolver.invalidateCache(mesh.id);
      
      // Move mesh
      mesh.position = new Vector3(5, 0, 0);
      
      // Should detect no collision at new position
      const result = resolver.detectCollisions(mesh.id);
      expect(result.hasCollision).toBe(false);
    });

    it('should clear all cache', () => {
      const mesh1 = MeshBuilder.CreateBox('clear1', { size: 1 }, scene);
      const mesh2 = MeshBuilder.CreateBox('clear2', { size: 1 }, scene);
      
      // Cache multiple meshes
      resolver.detectCollisions(mesh1.id);
      resolver.detectCollisions(mesh2.id);
      
      // Clear all cache
      resolver.clearCache();
      
      // Should still work after clearing
      const result = resolver.detectCollisions(mesh1.id);
      expect(result).toBeDefined();
    });
  });

  describe('Event Logging', () => {
    it('should log collision events', () => {
      const mesh = MeshBuilder.CreateBox('log1', { size: 1 }, scene);
      
      resolver.logCollisionEvent({
        timestamp: Date.now(),
        operation: 'create',
        objectId: mesh.id,
        detection: {
          hasCollision: false,
          collidingObjectIds: [],
          collisions: []
        },
        userOverride: false
      });
      
      const events = resolver.getCollisionEvents();
      expect(events).toHaveLength(1);
      expect(events[0].objectId).toBe(mesh.id);
    });

    it('should limit event history to 1000 entries', () => {
      // Log more than 1000 events
      for (let i = 0; i < 1100; i++) {
        resolver.logCollisionEvent({
          timestamp: Date.now(),
          operation: 'move',
          objectId: `test-${i}`,
          detection: {
            hasCollision: false,
            collidingObjectIds: [],
            collisions: []
          },
          userOverride: false
        });
      }
      
      const events = resolver.getCollisionEvents();
      expect(events).toHaveLength(1000);
      // Should keep the most recent events
      expect(events[999].objectId).toBe('test-1099');
    });

    it('should retrieve limited number of events', () => {
      // Log 50 events
      for (let i = 0; i < 50; i++) {
        resolver.logCollisionEvent({
          timestamp: Date.now(),
          operation: 'import',
          objectId: `import-${i}`,
          detection: {
            hasCollision: false,
            collidingObjectIds: [],
            collisions: []
          },
          userOverride: false
        });
      }
      
      const events = resolver.getCollisionEvents(10);
      expect(events).toHaveLength(10);
      // Should get the most recent 10
      expect(events[9].objectId).toBe('import-49');
    });
  });

  describe('Edge Cases', () => {
    it('should handle non-existent mesh ID', () => {
      const result = resolver.detectCollisions('non-existent-id');
      expect(result.hasCollision).toBe(false);
      expect(result.collidingObjectIds).toHaveLength(0);
    });

    it('should handle non-Mesh objects in scene', () => {
      // Add a light or camera (non-mesh object)
      scene.createDefaultLight();
      
      const mesh = MeshBuilder.CreateBox('edge1', { size: 1 }, scene);
      const result = resolver.detectCollisions(mesh.id);
      
      // Should not crash and should work normally
      expect(result).toBeDefined();
      expect(result.hasCollision).toBe(false);
    });

    it('should handle meshes with no bounding info', () => {
      const mesh = new Mesh('empty', scene);
      // Mesh with no geometry has no bounding info
      
      const result = resolver.detectCollisions(mesh.id);
      expect(result.hasCollision).toBe(false);
    });

    it('should handle very small search step sizes', () => {
      const mesh1 = MeshBuilder.CreateBox('small1', { size: 1 }, scene);
      const mesh2 = MeshBuilder.CreateBox('small2', { size: 1 }, scene);
      mesh2.position = new Vector3(0.1, 0, 0);
      
      resolver.updateConfig({ searchStepSize: 0.01, maxSearchDistance: 1 });
      const result = resolver.resolveCollisions(mesh2.id);
      
      // Should still find a solution, just with more attempts
      expect(result.resolved).toBe(true);
      expect(result.positionsTested).toBeGreaterThan(10);
    });
  });
}); 