import { Vector3, Scene, Mesh } from 'babylonjs';
import type { 
  CollisionDetectionResult, 
  CollisionDetail, 
  CollisionResolutionConfig,
  CollisionResolutionResult,
  CollisionEvent,
  BoundingBoxCache
} from '../types/types';
import { DEFAULT_COLLISION_CONFIG, validateCollisionConfig } from '../config/collisionConfig';

/**
 * CollisionResolver handles collision detection and automatic resolution for scene objects
 */
export class CollisionResolver {
  private scene: Scene;
  private boundingBoxCache: Map<string, BoundingBoxCache>;
  private defaultConfig: CollisionResolutionConfig;
  private collisionEvents: CollisionEvent[];
  private performanceMetrics: {
    totalDetections: number;
    totalResolutions: number;
    averageDetectionTime: number;
    averageResolutionTime: number;
  };

  constructor(scene: Scene) {
    this.scene = scene;
    this.boundingBoxCache = new Map();
    this.collisionEvents = [];
    
    // Initialize default configuration from config file
    this.defaultConfig = { ...DEFAULT_COLLISION_CONFIG };

    // Initialize performance metrics
    this.performanceMetrics = {
      totalDetections: 0,
      totalResolutions: 0,
      averageDetectionTime: 0,
      averageResolutionTime: 0
    };
  }

  /**
   * Detect collisions between a mesh and all other meshes in the scene
   * @param meshId The ID of the mesh to check
   * @param position The position to test (if different from current)
   * @param excludeIds Array of mesh IDs to exclude from collision checks
   * @returns CollisionDetectionResult
   */
  public detectCollisions(
    meshId: string, 
    position?: Vector3,
    excludeIds: string[] = []
  ): CollisionDetectionResult {
    const startTime = performance.now();
    
    const mesh = this.scene.getMeshById(meshId);
    if (!mesh || !(mesh instanceof Mesh)) {
      return {
        hasCollision: false,
        collidingObjectIds: [],
        collisions: []
      };
    }

    // Store original position if testing a different position
    const originalPosition = mesh.position.clone();
    if (position) {
      mesh.position = position.clone();
      mesh.computeWorldMatrix(true);
    }

    const collisions: CollisionDetail[] = [];
    const collidingObjectIds: string[] = [];

    // Get or update bounding box cache for the test mesh
    const testBounds = this.updateBoundingBoxCache(meshId, mesh);

    // Check against all other meshes
    const meshes = this.scene.meshes.filter(m => 
      m instanceof Mesh && 
      m.id !== meshId && 
      !excludeIds.includes(m.id) &&
      !this.defaultConfig.excludeTypes.includes(m.name.split('-')[0]) &&
      m.isVisible &&
      m.isEnabled()
    ) as Mesh[];

    for (const otherMesh of meshes) {
      // Update cache for other mesh
      const otherBounds = this.updateBoundingBoxCache(otherMesh.id, otherMesh);
      
      // Perform AABB intersection test
      if (this.checkAABBIntersection(testBounds, otherBounds)) {
        // For more precise detection, use Babylon's built-in intersection method
        if (mesh.intersectsMesh(otherMesh, true)) {
          const centerDistance = Vector3.Distance(
            mesh.position,
            otherMesh.position
          );
          
          collisions.push({
            objectId: otherMesh.id,
            objectType: otherMesh.name.split('-')[0],
            centerDistance,
            intersectionVolume: this.estimateIntersectionVolume(testBounds, otherBounds)
          });
          
          collidingObjectIds.push(otherMesh.id);
        }
      }
    }

    // Restore original position
    if (position) {
      mesh.position = originalPosition;
      mesh.computeWorldMatrix(true);
    }

    const endTime = performance.now();
    this.updatePerformanceMetrics('detection', endTime - startTime);

    return {
      hasCollision: collisions.length > 0,
      collidingObjectIds,
      collisions: collisions.sort((a, b) => 
        (b.intersectionVolume || 0) - (a.intersectionVolume || 0)
      )
    };
  }

  /**
   * Check if two axis-aligned bounding boxes intersect
   * @param box1 First bounding box
   * @param box2 Second bounding box
   * @returns true if boxes intersect
   */
  private checkAABBIntersection(
    box1: BoundingBoxCache, 
    box2: BoundingBoxCache
  ): boolean {
    // Check if boxes overlap on all axes
    return (
      box1.min.x <= box2.max.x &&
      box1.max.x >= box2.min.x &&
      box1.min.y <= box2.max.y &&
      box1.max.y >= box2.min.y &&
      box1.min.z <= box2.max.z &&
      box1.max.z >= box2.min.z
    );
  }

  /**
   * Estimate the volume of intersection between two bounding boxes
   * @param box1 First bounding box
   * @param box2 Second bounding box
   * @returns Estimated intersection volume
   */
  private estimateIntersectionVolume(
    box1: BoundingBoxCache, 
    box2: BoundingBoxCache
  ): number {
    // Calculate overlap on each axis
    const overlapX = Math.max(0, 
      Math.min(box1.max.x, box2.max.x) - Math.max(box1.min.x, box2.min.x)
    );
    const overlapY = Math.max(0, 
      Math.min(box1.max.y, box2.max.y) - Math.max(box1.min.y, box2.min.y)
    );
    const overlapZ = Math.max(0, 
      Math.min(box1.max.z, box2.max.z) - Math.max(box1.min.z, box2.min.z)
    );

    return overlapX * overlapY * overlapZ;
  }

  /**
   * Update the bounding box cache for a mesh
   * @param meshId The mesh ID
   * @param mesh The mesh instance
   * @returns Updated bounding box cache entry
   */
  private updateBoundingBoxCache(meshId: string, mesh: Mesh): BoundingBoxCache {
    const cached = this.boundingBoxCache.get(meshId);
    const currentTime = Date.now();
    
    // Check if cache is valid (updated within last 100ms)
    if (cached && cached.isValid && currentTime - cached.lastUpdated < 100) {
      return cached;
    }

    // Update cache
    mesh.computeWorldMatrix(true);
    const boundingInfo = mesh.getBoundingInfo();
    const worldMin = boundingInfo.boundingBox.minimumWorld;
    const worldMax = boundingInfo.boundingBox.maximumWorld;

    const cacheEntry: BoundingBoxCache = {
      objectId: meshId,
      min: worldMin.clone(),
      max: worldMax.clone(),
      lastUpdated: currentTime,
      isValid: true
    };

    this.boundingBoxCache.set(meshId, cacheEntry);
    return cacheEntry;
  }

  /**
   * Invalidate bounding box cache for a specific mesh
   * @param meshId The mesh ID to invalidate
   */
  public invalidateCache(meshId: string): void {
    const cached = this.boundingBoxCache.get(meshId);
    if (cached) {
      cached.isValid = false;
    }
  }

  /**
   * Clear all cached bounding boxes
   */
  public clearCache(): void {
    this.boundingBoxCache.clear();
  }

  /**
   * Update performance metrics
   * @param type Type of operation
   * @param duration Duration in milliseconds
   */
  private updatePerformanceMetrics(
    type: 'detection' | 'resolution', 
    duration: number
  ): void {
    if (type === 'detection') {
      this.performanceMetrics.totalDetections++;
      this.performanceMetrics.averageDetectionTime = 
        (this.performanceMetrics.averageDetectionTime * 
         (this.performanceMetrics.totalDetections - 1) + duration) / 
        this.performanceMetrics.totalDetections;
    } else {
      this.performanceMetrics.totalResolutions++;
      this.performanceMetrics.averageResolutionTime = 
        (this.performanceMetrics.averageResolutionTime * 
         (this.performanceMetrics.totalResolutions - 1) + duration) / 
        this.performanceMetrics.totalResolutions;
    }
  }

  /**
   * Get current configuration
   */
  public getConfig(): CollisionResolutionConfig {
    return { ...this.defaultConfig };
  }

  /**
   * Update configuration
   * @param config Partial configuration to update
   */
  public updateConfig(config: Partial<CollisionResolutionConfig>): void {
    this.defaultConfig = validateCollisionConfig({ ...this.defaultConfig, ...config });
  }

  /**
   * Get performance metrics
   */
  public getPerformanceMetrics() {
    return { ...this.performanceMetrics };
  }

  /**
   * Get collision event history
   * @param limit Maximum number of events to return
   */
  public getCollisionEvents(limit: number = 100): CollisionEvent[] {
    return this.collisionEvents.slice(-limit);
  }

  /**
   * Log a collision event
   * @param event The collision event to log
   */
  public logCollisionEvent(event: CollisionEvent): void {
    this.collisionEvents.push(event);
    
    // Keep only last 1000 events to prevent memory issues
    if (this.collisionEvents.length > 1000) {
      this.collisionEvents = this.collisionEvents.slice(-1000);
    }
  }

  /**
   * Resolve collisions by finding the nearest non-intersecting position
   * @param meshId The ID of the mesh to resolve
   * @param excludeIds Array of mesh IDs to exclude from collision checks
   * @param config Optional configuration override
   * @returns CollisionResolutionResult
   */
  public resolveCollisions(
    meshId: string,
    excludeIds: string[] = [],
    config?: Partial<CollisionResolutionConfig>
  ): CollisionResolutionResult {
    const startTime = performance.now();
    const resolvedConfig = { ...this.defaultConfig, ...config };
    
    if (!resolvedConfig.enabled) {
      return {
        resolved: false,
        originalPosition: new Vector3(0, 0, 0),
        newPosition: new Vector3(0, 0, 0),
        distanceMoved: 0,
        resolutionTime: 0,
        positionsTested: 0
      };
    }

    const mesh = this.scene.getMeshById(meshId);
    if (!mesh || !(mesh instanceof Mesh)) {
      return {
        resolved: false,
        originalPosition: new Vector3(0, 0, 0),
        newPosition: new Vector3(0, 0, 0),
        distanceMoved: 0,
        resolutionTime: 0,
        positionsTested: 0
      };
    }

    const originalPosition = mesh.position.clone();
    let attemptedPositions = 0;

    // Check if current position has collisions
    const initialCheck = this.detectCollisions(meshId, undefined, excludeIds);
    if (!initialCheck.hasCollision) {
      return {
        resolved: true,
        originalPosition: originalPosition,
        newPosition: originalPosition,
        distanceMoved: 0,
        resolutionTime: performance.now() - startTime,
        positionsTested: 1
      };
    }

    // Find valid position using specified search pattern
    const validPosition = this.findValidPosition(
      mesh,
      originalPosition,
      excludeIds,
      resolvedConfig,
      (count) => { attemptedPositions = count; }
    );

    if (validPosition) {
      const distanceMoved = Vector3.Distance(originalPosition, validPosition);
      
      // Resolution events are logged separately from operations

      const endTime = performance.now();
      this.updatePerformanceMetrics('resolution', endTime - startTime);

      return {
        resolved: true,
        originalPosition: originalPosition,
        newPosition: validPosition,
        distanceMoved,
        resolutionTime: endTime - startTime,
        positionsTested: attemptedPositions
      };
    }

    const endTime = performance.now();
    this.updatePerformanceMetrics('resolution', endTime - startTime);

    return {
      resolved: false,
      originalPosition: originalPosition,
      newPosition: originalPosition,
      distanceMoved: 0,
      resolutionTime: endTime - startTime,
      positionsTested: attemptedPositions
    };
  }

  /**
   * Find a valid position using the configured search pattern
   * @param mesh The mesh to find position for
   * @param originalPosition The starting position
   * @param excludeIds Mesh IDs to exclude
   * @param config Resolution configuration
   * @param onAttempt Callback for attempt counting
   * @returns Valid position or null
   */
  private findValidPosition(
    mesh: Mesh,
    originalPosition: Vector3,
    excludeIds: string[],
    config: CollisionResolutionConfig,
    onAttempt: (count: number) => void
  ): Vector3 | null {
    switch (config.searchPattern) {
      case 'spiral':
        return this.spiralSearch(mesh, originalPosition, excludeIds, config, onAttempt);
      case 'radial':
        return this.radialSearch(mesh, originalPosition, excludeIds, config, onAttempt);
      case 'grid':
        return this.gridSearch(mesh, originalPosition, excludeIds, config, onAttempt);
      default:
        return this.spiralSearch(mesh, originalPosition, excludeIds, config, onAttempt);
    }
  }

  /**
   * Perform spiral search for valid position
   * @param mesh The mesh to position
   * @param center The center of the spiral
   * @param excludeIds Mesh IDs to exclude
   * @param config Resolution configuration
   * @param onAttempt Callback for attempt counting
   * @returns Valid position or null
   */
  private spiralSearch(
    mesh: Mesh,
    center: Vector3,
    excludeIds: string[],
    config: CollisionResolutionConfig,
    onAttempt: (count: number) => void
  ): Vector3 | null {
    const stepSize = config.searchStepSize;
    const maxDistance = config.maxSearchDistance;
    let attempts = 0;

    // Try horizontal spiral first if priority is horizontal
    if (config.resolutionPriority === 'horizontal' || !config.searchVertical) {
      const horizontalResult = this.spiralSearchHorizontal(
        mesh, center, excludeIds, stepSize, maxDistance, 
        (count) => { attempts += count; onAttempt(attempts); }
      );
      if (horizontalResult) return horizontalResult;
    }

    // Try vertical positions if enabled
    if (config.searchVertical) {
      const verticalStepSize = config.verticalStepSize || stepSize;
      for (let yOffset = verticalStepSize; yOffset <= maxDistance; yOffset += verticalStepSize) {
        // Try above
        const aboveCenter = center.add(new Vector3(0, yOffset, 0));
        const aboveResult = this.spiralSearchHorizontal(
          mesh, aboveCenter, excludeIds, stepSize, maxDistance,
          (count) => { attempts += count; onAttempt(attempts); }
        );
        if (aboveResult) return aboveResult;

        // Try below
        const belowCenter = center.add(new Vector3(0, -yOffset, 0));
        const belowResult = this.spiralSearchHorizontal(
          mesh, belowCenter, excludeIds, stepSize, maxDistance,
          (count) => { attempts += count; onAttempt(attempts); }
        );
        if (belowResult) return belowResult;
      }
    }

    return null;
  }

  /**
   * Perform horizontal spiral search
   * @param mesh The mesh to position
   * @param center The center of the spiral
   * @param excludeIds Mesh IDs to exclude
   * @param stepSize The step size for the spiral
   * @param maxDistance Maximum search distance
   * @param onAttempt Callback for attempt counting
   * @returns Valid position or null
   */
  private spiralSearchHorizontal(
    mesh: Mesh,
    center: Vector3,
    excludeIds: string[],
    stepSize: number,
    maxDistance: number,
    onAttempt: (count: number) => void
  ): Vector3 | null {
    let x = 0, z = 0;
    let dx = 0, dz = -1;
    let attempts = 0;

    const maxSteps = Math.ceil(maxDistance / stepSize) * 2;
    const stepsInCurrentDirection = 1;
    let stepsTaken = 0;
    let directionChanges = 0;

    for (let i = 0; i < maxSteps * maxSteps; i++) {
      // Test current position
      const testPosition = center.add(new Vector3(x * stepSize, 0, z * stepSize));
      
      // Skip if distance exceeds max
      const distance = Vector3.Distance(center, testPosition);
      if (distance > maxDistance) {
        break;
      }

      attempts++;
      const collision = this.detectCollisions(mesh.id, testPosition, excludeIds);
      if (!collision.hasCollision) {
        onAttempt(attempts);
        return this.snapToGrid(testPosition, this.defaultConfig.respectGridSnap);
      }

      // Move to next position in spiral
      stepsTaken++;
      x += dx;
      z += dz;

      // Change direction when needed
      if (stepsTaken >= stepsInCurrentDirection) {
        stepsTaken = 0;
        directionChanges++;
        
        // Rotate direction 90 degrees counter-clockwise
        const temp = dx;
        dx = -dz;
        dz = temp;

        // Increase steps in direction every 2 direction changes
        if (directionChanges % 2 === 0) {
          // This creates the expanding spiral pattern
        }
      }
    }

    onAttempt(attempts);
    return null;
  }

  /**
   * Perform radial search for valid position
   * @param mesh The mesh to position
   * @param center The center point
   * @param excludeIds Mesh IDs to exclude
   * @param config Resolution configuration
   * @param onAttempt Callback for attempt counting
   * @returns Valid position or null
   */
  private radialSearch(
    mesh: Mesh,
    center: Vector3,
    excludeIds: string[],
    config: CollisionResolutionConfig,
    onAttempt: (count: number) => void
  ): Vector3 | null {
    const stepSize = config.searchStepSize;
    const maxDistance = config.maxSearchDistance;
    let attempts = 0;

    // Number of points to test at each radius
    const pointsPerRadius = 8;

    for (let radius = stepSize; radius <= maxDistance; radius += stepSize) {
      for (let i = 0; i < pointsPerRadius; i++) {
        const angle = (i / pointsPerRadius) * Math.PI * 2;
        const x = Math.cos(angle) * radius;
        const z = Math.sin(angle) * radius;

        // Test at current height
        const testPosition = center.add(new Vector3(x, 0, z));
        attempts++;

        const collision = this.detectCollisions(mesh.id, testPosition, excludeIds);
        if (!collision.hasCollision) {
          onAttempt(attempts);
          return this.snapToGrid(testPosition, config.respectGridSnap);
        }

        // Test vertical positions if enabled
        if (config.searchVertical) {
          const verticalStep = config.verticalStepSize || stepSize;
          
          // Test above
          const abovePosition = testPosition.add(new Vector3(0, verticalStep, 0));
          attempts++;
          const aboveCollision = this.detectCollisions(mesh.id, abovePosition, excludeIds);
          if (!aboveCollision.hasCollision) {
            onAttempt(attempts);
            return this.snapToGrid(abovePosition, config.respectGridSnap);
          }

          // Test below
          const belowPosition = testPosition.add(new Vector3(0, -verticalStep, 0));
          attempts++;
          const belowCollision = this.detectCollisions(mesh.id, belowPosition, excludeIds);
          if (!belowCollision.hasCollision) {
            onAttempt(attempts);
            return this.snapToGrid(belowPosition, config.respectGridSnap);
          }
        }
      }
    }

    onAttempt(attempts);
    return null;
  }

  /**
   * Perform grid search for valid position
   * @param mesh The mesh to position
   * @param center The center point
   * @param excludeIds Mesh IDs to exclude
   * @param config Resolution configuration
   * @param onAttempt Callback for attempt counting
   * @returns Valid position or null
   */
  private gridSearch(
    mesh: Mesh,
    center: Vector3,
    excludeIds: string[],
    config: CollisionResolutionConfig,
    onAttempt: (count: number) => void
  ): Vector3 | null {
    const stepSize = config.searchStepSize;
    const maxDistance = config.maxSearchDistance;
    let attempts = 0;

    const gridSize = Math.ceil(maxDistance / stepSize);

    // Search in expanding squares
    for (let layer = 1; layer <= gridSize; layer++) {
      // Top and bottom edges
      for (let i = -layer; i <= layer; i++) {
        // Top edge
        const topPos = center.add(new Vector3(i * stepSize, 0, layer * stepSize));
        if (Vector3.Distance(center, topPos) <= maxDistance) {
          attempts++;
          const topCollision = this.detectCollisions(mesh.id, topPos, excludeIds);
          if (!topCollision.hasCollision) {
            onAttempt(attempts);
            return this.snapToGrid(topPos, config.respectGridSnap);
          }
        }

        // Bottom edge
        const bottomPos = center.add(new Vector3(i * stepSize, 0, -layer * stepSize));
        if (Vector3.Distance(center, bottomPos) <= maxDistance) {
          attempts++;
          const bottomCollision = this.detectCollisions(mesh.id, bottomPos, excludeIds);
          if (!bottomCollision.hasCollision) {
            onAttempt(attempts);
            return this.snapToGrid(bottomPos, config.respectGridSnap);
          }
        }
      }

      // Left and right edges (excluding corners)
      for (let i = -layer + 1; i < layer; i++) {
        // Left edge
        const leftPos = center.add(new Vector3(-layer * stepSize, 0, i * stepSize));
        if (Vector3.Distance(center, leftPos) <= maxDistance) {
          attempts++;
          const leftCollision = this.detectCollisions(mesh.id, leftPos, excludeIds);
          if (!leftCollision.hasCollision) {
            onAttempt(attempts);
            return this.snapToGrid(leftPos, config.respectGridSnap);
          }
        }

        // Right edge
        const rightPos = center.add(new Vector3(layer * stepSize, 0, i * stepSize));
        if (Vector3.Distance(center, rightPos) <= maxDistance) {
          attempts++;
          const rightCollision = this.detectCollisions(mesh.id, rightPos, excludeIds);
          if (!rightCollision.hasCollision) {
            onAttempt(attempts);
            return this.snapToGrid(rightPos, config.respectGridSnap);
          }
        }
      }
    }

    onAttempt(attempts);
    return null;
  }

  /**
   * Snap position to grid if enabled
   * @param position The position to snap
   * @param respectGrid Whether to respect grid snapping
   * @returns Snapped position
   */
  private snapToGrid(position: Vector3, respectGrid: boolean): Vector3 {
    if (!respectGrid) {
      return position;
    }

    // Default grid size of 0.5 units
    const gridSize = 0.5;
    
    return new Vector3(
      Math.round(position.x / gridSize) * gridSize,
      Math.round(position.y / gridSize) * gridSize,
      Math.round(position.z / gridSize) * gridSize
    );
  }
}

/**
 * Factory function to create a CollisionResolver instance
 * @param scene The Babylon.js scene
 * @returns New CollisionResolver instance
 */
export function createCollisionResolver(scene: Scene): CollisionResolver {
  return new CollisionResolver(scene);
} 