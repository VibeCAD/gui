import { Mesh, Vector3, Matrix } from 'babylonjs'
import type { Boundary, ConnectionPoint, SceneObject } from '../types/types'

/**
 * Computes an axis-aligned bounding box for the given mesh in world space
 * and derives size & center information. This is cheap and works for most
 * primitives whose pivot is centred. For rotated/parented meshes callers should
 * pass the root or call after reset of rotation.
 */
export const computeMeshBoundary = (mesh: Mesh): Boundary => {
  // Ensure world matrix up-to-date
  mesh.computeWorldMatrix(true)
  const boundingInfo = mesh.getBoundingInfo()
  const bbox = boundingInfo.boundingBox

  const wMin = bbox.minimumWorld
  const wMax = bbox.maximumWorld

  const worldToLocal = new Matrix()
  mesh.getWorldMatrix().invertToRef(worldToLocal)
  const min = Vector3.TransformCoordinates(wMin, worldToLocal)
  const max = Vector3.TransformCoordinates(wMax, worldToLocal)

  const size = max.subtract(min)
  const center = min.add(size.scale(0.5))

  return {
    aabb: { min, max, size, center }
  }
}

/**
 * Computes a bounding box that encloses the given mesh **and all of its children**.
 * All returned vectors are expressed in the root mesh's local-space so that
 * connection-points can be attached directly to the root.
 */
export const computeCompositeBoundary = (root: Mesh): Boundary => {
  root.computeWorldMatrix(true)

  const childMeshes = root.getChildMeshes(false)
  if (childMeshes.length === 0) {
    return computeMeshBoundary(root)
  }

  const worldToLocal = new Matrix()
  root.getWorldMatrix().invertToRef(worldToLocal)

  let minLocal = new Vector3(Number.POSITIVE_INFINITY, Number.POSITIVE_INFINITY, Number.POSITIVE_INFINITY)
  let maxLocal = new Vector3(Number.NEGATIVE_INFINITY, Number.NEGATIVE_INFINITY, Number.NEGATIVE_INFINITY)

  childMeshes.forEach((m) => {
    m.computeWorldMatrix(true)
    const bbox = m.getBoundingInfo().boundingBox
    const wMin = bbox.minimumWorld
    const wMax = bbox.maximumWorld

    // Transform both extremes into root local space
    const lMin = Vector3.TransformCoordinates(wMin, worldToLocal)
    const lMax = Vector3.TransformCoordinates(wMax, worldToLocal)

    minLocal = Vector3.Minimize(minLocal, lMin)
    minLocal = Vector3.Minimize(minLocal, lMax)
    maxLocal = Vector3.Maximize(maxLocal, lMin)
    maxLocal = Vector3.Maximize(maxLocal, lMax)
  })

  const size = maxLocal.subtract(minLocal)
  const center = minLocal.add(size.scale(0.5))

  return {
    aabb: { min: minLocal, max: maxLocal, size, center }
  }
}

/**
 * Generates a pragmatic set of connection-points based purely on the AABB.
 * Resulting positions are expressed in the mesh's LOCAL space so that
 * SceneManager.computeSnapTransform can transform them correctly.
 */
export const generateDefaultConnectionPoints = (mesh: Mesh, boundary?: Boundary): ConnectionPoint[] => {
  const b = boundary ?? computeMeshBoundary(mesh)
  const { size, center } = b.aabb

  const halfX = size.x / 2
  const halfY = size.y / 2
  const halfZ = size.z / 2

  const cps: ConnectionPoint[] = [
    // ±X faces
    { id: 'px', position: new Vector3(center.x + halfX, center.y, center.z), normal: new Vector3( 1, 0, 0), kind: 'face' },
    { id: 'nx', position: new Vector3(center.x - halfX, center.y, center.z), normal: new Vector3(-1, 0, 0), kind: 'face' },
    // ±Y faces (top / bottom)
    { id: 'py', position: new Vector3(center.x, center.y + halfY, center.z), normal: new Vector3(0,  1, 0), kind: 'face' },
    { id: 'ny', position: new Vector3(center.x, center.y - halfY, center.z), normal: new Vector3(0, -1, 0), kind: 'face' },
    // ±Z faces
    { id: 'pz', position: new Vector3(center.x, center.y, center.z + halfZ), normal: new Vector3(0, 0,  1), kind: 'face' },
    { id: 'nz', position: new Vector3(center.x, center.y, center.z - halfZ), normal: new Vector3(0, 0, -1), kind: 'face' }
  ]

  return cps
}

/**
 * Convenience helper that computes + attaches default CPs to the provided mesh.
 * Returns the generated list for reference.
 */
export const attachBoundingConnectionPoints = (mesh: Mesh): ConnectionPoint[] => {
  const cps = generateDefaultConnectionPoints(mesh)
  if (!mesh.metadata) mesh.metadata = {}
  ;(mesh.metadata as any).connectionPoints = cps
  return cps
}

/**
 * Check if a world position is inside a custom room's boundaries
 * @param position World position to check
 * @param room Custom room SceneObject
 * @returns True if position is inside the room
 */
export const isPositionInRoom = (position: Vector3, room: SceneObject): boolean => {
  if (room.type !== 'custom-room' || !room.mesh?.metadata?.roomData) {
    return false;
  }

  const roomData = room.mesh.metadata.roomData;
  const gridInfo = room.gridInfo;
  
  if (!roomData.points || !gridInfo) {
    return false;
  }

  // Convert world position to drawing coordinates
  const drawingPos = worldToDrawingCoordinates(position, room);
  if (!drawingPos) {
    return false;
  }

  // Use point-in-polygon algorithm
  return isPointInPolygon(drawingPos, roomData.points);
};

/**
 * Find which room contains a given world position
 * @param position World position to check
 * @param rooms Array of custom room SceneObjects
 * @returns The containing room or null if not found
 */
export const findContainingRoom = (position: Vector3, rooms: SceneObject[]): SceneObject | null => {
  const customRooms = rooms.filter(obj => obj.type === 'custom-room');
  
  for (const room of customRooms) {
    if (isPositionInRoom(position, room)) {
      return room;
    }
  }
  
  return null;
};

/**
 * Get the floor Y position for a custom room
 * @param room Custom room SceneObject
 * @returns Floor Y coordinate in world space
 */
export const getRoomFloorY = (room: SceneObject): number => {
  if (room.type !== 'custom-room') {
    return 0;
  }

  // For custom rooms, the floor is at the bottom of the room
  // Account for the room's scale and position
  const roomDimensions = getRoomDimensions(room);
  const roomBottom = room.position.y - (roomDimensions.height / 2);
  
  // Adjust floor position down by 1 grid square as requested
  if (room.gridInfo) {
    const gridWorldSize = room.gridInfo.gridSize * room.gridInfo.worldScale;
    return roomBottom - gridWorldSize;
  }
  
  return roomBottom;
};

/**
 * Get the dimensions of a custom room
 * @param room Custom room SceneObject
 * @returns Room dimensions
 */
const getRoomDimensions = (room: SceneObject): { width: number; height: number; depth: number } => {
  // Default custom room dimensions
  const baseDimensions = { width: 4, height: 2.5, depth: 4 };
  
  // Apply scale factors
  return {
    width: baseDimensions.width * room.scale.x,
    height: baseDimensions.height * room.scale.y,
    depth: baseDimensions.depth * room.scale.z
  };
};

/**
 * Calculate the center point of a custom room
 * @param room Custom room SceneObject
 * @returns Center position in world coordinates
 */
export const getRoomCenter = (room: SceneObject): Vector3 => {
  if (room.type !== 'custom-room') {
    return new Vector3(0, 0, 0);
  }

  // For custom rooms, the center is simply the room's position
  // The room drawing system centers the room at its position
  return room.position.clone();
};

/**
 * Generate a random valid position within a custom room
 * @param room Custom room SceneObject
 * @returns Random position inside the room at floor level
 */
export const getRandomPositionInRoom = (room: SceneObject): Vector3 => {
  if (room.type !== 'custom-room' || !room.mesh?.metadata?.roomData || !room.gridInfo) {
    return getRoomCenter(room);
  }

  const roomData = room.mesh.metadata.roomData;
  const gridInfo = room.gridInfo;
  
  if (!roomData.points || roomData.points.length < 3) {
    return getRoomCenter(room);
  }

  // Calculate bounding box of the room polygon in drawing coordinates
  const points = roomData.points;
  const minX = Math.min(...points.map((p: { x: number; y: number }) => p.x));
  const maxX = Math.max(...points.map((p: { x: number; y: number }) => p.x));
  const minY = Math.min(...points.map((p: { x: number; y: number }) => p.y));
  const maxY = Math.max(...points.map((p: { x: number; y: number }) => p.y));

  // Try to find a random point inside the polygon (with retry limit)
  let attempts = 0;
  const maxAttempts = 50;
  
  while (attempts < maxAttempts) {
    const randomDrawingX = minX + Math.random() * (maxX - minX);
    const randomDrawingY = minY + Math.random() * (maxY - minY);
    const randomDrawingPos = { x: randomDrawingX, y: randomDrawingY };
    
    if (isPointInPolygon(randomDrawingPos, points)) {
      // Convert back to world coordinates
      const worldPos = drawingToWorldCoordinates(randomDrawingPos, room);
      if (worldPos) {
        // Return position at floor level - object placement logic will handle centering
        const floorY = getRoomFloorY(room);
        return new Vector3(worldPos.x, floorY, worldPos.z);
      }
    }
    
    attempts++;
  }

  // Fallback to room center if no valid random position found
  const center = getRoomCenter(room);
  const floorY = getRoomFloorY(room);
  return new Vector3(center.x, floorY, center.z);
};

/**
 * Convert world coordinates to drawing coordinates for a custom room
 * @param worldPos World position
 * @param room Custom room SceneObject
 * @returns Drawing coordinates or null if conversion fails
 */
const worldToDrawingCoordinates = (worldPos: Vector3, room: SceneObject): { x: number; y: number } | null => {
  if (!room.gridInfo) {
    return null;
  }

  const { worldScale, drawingBounds } = room.gridInfo;
  const bounds = drawingBounds || { width: 400, height: 400 };

  // Convert world position to room-local coordinates
  const localX = worldPos.x - room.position.x;
  const localZ = worldPos.z - room.position.z;

  // Convert to drawing coordinates
  // Drawing coordinates are centered, so we need to account for the offset
  const centerOffsetX = bounds.width / 2;
  const centerOffsetY = bounds.height / 2;
  
  const drawingX = (localX / worldScale) + centerOffsetX;
  const drawingY = (localZ / worldScale) + centerOffsetY;

  return { x: drawingX, y: drawingY };
};

/**
 * Convert drawing coordinates to world coordinates for a custom room
 * @param drawingPos Drawing position
 * @param room Custom room SceneObject
 * @returns World coordinates or null if conversion fails
 */
const drawingToWorldCoordinates = (drawingPos: { x: number; y: number }, room: SceneObject): { x: number; z: number } | null => {
  if (!room.gridInfo) {
    return null;
  }

  const { worldScale, drawingBounds } = room.gridInfo;
  const bounds = drawingBounds || { width: 400, height: 400 };

  // Convert from drawing coordinates to room-local coordinates
  const centerOffsetX = bounds.width / 2;
  const centerOffsetY = bounds.height / 2;
  
  const localX = (drawingPos.x - centerOffsetX) * worldScale;
  const localZ = (drawingPos.y - centerOffsetY) * worldScale;

  // Convert to world coordinates
  const worldX = localX + room.position.x;
  const worldZ = localZ + room.position.z;

  return { x: worldX, z: worldZ };
};

/**
 * Point-in-polygon algorithm using ray casting
 * @param point Point to check
 * @param polygon Array of polygon vertices
 * @returns True if point is inside polygon
 */
const isPointInPolygon = (point: { x: number; y: number }, polygon: { x: number; y: number }[]): boolean => {
  if (polygon.length < 3) {
    return false;
  }

  let inside = false;
  const x = point.x;
  const y = point.y;

  for (let i = 0, j = polygon.length - 1; i < polygon.length; j = i++) {
    const xi = polygon[i].x;
    const yi = polygon[i].y;
    const xj = polygon[j].x;
    const yj = polygon[j].y;

    if (((yi > y) !== (yj > y)) && (x < (xj - xi) * (y - yi) / (yj - yi) + xi)) {
      inside = !inside;
    }
  }

  return inside;
};