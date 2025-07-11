import { Vector3, Mesh, BoundingInfo } from 'babylonjs'

interface RoomInfo {
  mesh: Mesh
  floorHeight: number
  wallHeight: number
  bounds: BoundingInfo
  gridInfo?: any
}

/**
 * Find which custom room contains a given position
 */
export function findContainingRoom(position: Vector3, scene: any): RoomInfo | null {
  if (!scene) return null
  
  // Find all custom room meshes
  const customRooms = scene.meshes.filter((mesh: Mesh) => 
    mesh.name.includes('custom-room') && 
    mesh instanceof Mesh
  ) as Mesh[]
  
  // Check if position is within any room's bounds
  for (const room of customRooms) {
    const floorPolygon = room.metadata?.floorPolygon
    
    // Use point-in-polygon check if floor polygon data is available
    if (floorPolygon && isPointInPolygon({ x: position.x, z: position.z }, floorPolygon)) {
      const bounds = room.getBoundingInfo()
      const floorMesh = room.getChildMeshes().find(child => child.name.includes('-floor'))
      const floorHeight = floorMesh ? floorMesh.getBoundingInfo().boundingBox.maximumWorld.y : 0
      const wallHeight = 2.0 // Standard wall height
      
      return {
        mesh: room,
        floorHeight,
        wallHeight,
        bounds: bounds,
        gridInfo: room.metadata?.gridInfo
      }
    }
  }
  
  return null
}

/**
 * Get the mesh's bounding box at a given position
 */
export function getMeshBoundsAtPosition(mesh: Mesh, position: Vector3): { min: Vector3, max: Vector3 } {
  // Store original position
  const originalPosition = mesh.position.clone()
  
  // Temporarily move mesh
  mesh.position.copyFrom(position)
  mesh.computeWorldMatrix(true)
  
  // Get bounds
  const bounds = mesh.getBoundingInfo().boundingBox
  const min = bounds.minimumWorld.clone()
  const max = bounds.maximumWorld.clone()
  
  // Restore original position
  mesh.position.copyFrom(originalPosition)
  mesh.computeWorldMatrix(true)
  
  return { min, max }
}

/**
 * Check if the mesh's bounding box would collide with room walls at the given position
 */
export function checkWallCollision(
  mesh: Mesh, 
  newPosition: Vector3, 
  roomInfo: RoomInfo
): boolean {
  const floorPolygon = roomInfo.mesh.metadata?.floorPolygon
  if (!floorPolygon || floorPolygon.length < 2) {
    return false // Not a valid room shape for collision
  }

  // Get the 2D footprint of the mesh's bounding box
  const meshBounds = getMeshBoundsAtPosition(mesh, newPosition)
  const meshFootprint = [
    { x: meshBounds.min.x, z: meshBounds.min.z },
    { x: meshBounds.max.x, z: meshBounds.min.z },
    { x: meshBounds.max.x, z: meshBounds.max.z },
    { x: meshBounds.min.x, z: meshBounds.max.z }
  ]

  // Check if any edge of the mesh's footprint intersects with any wall segment
  for (let i = 0; i < floorPolygon.length; i++) {
    const wallP1 = floorPolygon[i]
    const wallP2 = floorPolygon[(i + 1) % floorPolygon.length]

    for (let j = 0; j < meshFootprint.length; j++) {
      const meshP1 = meshFootprint[j]
      const meshP2 = meshFootprint[(j + 1) % meshFootprint.length]
      
      if (lineSegmentsIntersect(wallP1, wallP2, meshP1, meshP2)) {
        return true // Collision detected
      }
    }
  }
  
  return false
}

/**
 * Get the lowest point of the mesh's bounding box
 */
export function getLowestPoint(mesh: Mesh, position: Vector3): number {
  const bounds = getMeshBoundsAtPosition(mesh, position)
  return bounds.min.y
}

/**
 * Snap object to floor if it should be floor-locked
 */
export function snapToFloor(
  mesh: Mesh,
  position: Vector3,
  roomInfo: RoomInfo
): Vector3 {
  // Get the lowest point of the mesh at the desired position
  const lowestPoint = getLowestPoint(mesh, position)
  
  // Calculate how much we need to move up to place the object on the floor
  const yOffset = roomInfo.floorHeight - lowestPoint
  
  return new Vector3(
    position.x,
    position.y + yOffset,
    position.z
  )
}

/**
 * Check if an object should be floor-locked based on its position and the room
 */
export function shouldBeFloorLocked(
  mesh: Mesh,
  position: Vector3,
  roomInfo: RoomInfo
): boolean {
  // Get mesh bounds at the position
  const bounds = getMeshBoundsAtPosition(mesh, position)
  
  // Check if any part of the object is below the wall top
  const hasPartBelowWallTop = bounds.min.y < roomInfo.floorHeight + roomInfo.wallHeight
  
  return hasPartBelowWallTop
}

/**
 * Constrain movement to floor plane and check wall collisions
 */
export function constrainRoomMovement(
  mesh: Mesh,
  desiredPosition: Vector3,
  roomInfo: RoomInfo,
  isFloorLocked: boolean,
  originalPosition?: Vector3
): { position: Vector3, blocked: boolean } {
  let constrainedPosition = desiredPosition.clone()
  
  // If floor-locked, maintain the object's height relative to the floor
  if (isFloorLocked) {
    // Calculate the current height offset from floor
    const currentBounds = getMeshBoundsAtPosition(mesh, originalPosition || mesh.position)
    const currentFloorOffset = currentBounds.min.y - roomInfo.floorHeight
    
    // Maintain the same offset (should be ~0 for floor-locked objects)
    const desiredBounds = getMeshBoundsAtPosition(mesh, desiredPosition)
    const desiredLowest = desiredBounds.min.y
    const requiredY = desiredPosition.y + (roomInfo.floorHeight - desiredLowest) + currentFloorOffset
    
    constrainedPosition.y = requiredY
  }
  
  // Check wall collision at the constrained position
  const wouldCollide = checkWallCollision(mesh, constrainedPosition, roomInfo)
  
  if (wouldCollide) {
    // Try to find a valid position by checking intermediate positions
    if (originalPosition) {
      // Check if we can move partially towards the desired position
      const steps = 10
      for (let i = steps - 1; i > 0; i--) {
        const t = i / steps
        const testPos = Vector3.Lerp(originalPosition, constrainedPosition, t)
        
        if (!checkWallCollision(mesh, testPos, roomInfo)) {
          // Found a valid partial movement
          constrainedPosition = testPos
          return { position: constrainedPosition, blocked: false }
        }
      }
    }
    
    // No valid movement found - block entirely
    return { position: originalPosition || mesh.position.clone(), blocked: true }
  }
  
  // Ensure object doesn't go below floor
  const lowestPoint = getLowestPoint(mesh, constrainedPosition)
  if (lowestPoint < roomInfo.floorHeight - 0.001) { // Small tolerance
    // Adjust Y to keep object on floor
    const adjustment = roomInfo.floorHeight - lowestPoint
    constrainedPosition.y += adjustment
  }
  
  return { position: constrainedPosition, blocked: false }
}

/**
 * Get floor-locked status from mesh metadata
 */
export function isFloorLocked(mesh: Mesh): boolean {
  return mesh.metadata?.isFloorLocked || false
}

/**
 * Set floor-locked status in mesh metadata
 */
export function setFloorLocked(mesh: Mesh, locked: boolean): void {
  if (!mesh.metadata) mesh.metadata = {}
  mesh.metadata.isFloorLocked = locked
}

/**
 * Checks if a 2D point is inside a 2D polygon using the ray-casting algorithm.
 */
function isPointInPolygon(point: { x: number; z: number }, polygon: { x: number; z: number }[]): boolean {
  let isInside = false
  for (let i = 0, j = polygon.length - 1; i < polygon.length; j = i++) {
    const xi = polygon[i].x, zi = polygon[i].z
    const xj = polygon[j].x, zj = polygon[j].z

    const intersect = ((zi > point.z) !== (zj > point.z))
        && (point.x < (xj - xi) * (point.z - zi) / (zj - zi) + xi)
    
    if (intersect) {
      isInside = !isInside
    }
  }
  return isInside
}

/**
 * Checks for intersection between two 2D line segments.
 */
function lineSegmentsIntersect(
  p1: { x: number; z: number }, q1: { x: number; z: number },
  p2: { x: number; z: number }, q2: { x: number; z: number }
): boolean {
  const orientation = (p: any, q: any, r: any) => {
    const val = (q.z - p.z) * (r.x - q.x) - (q.x - p.x) * (r.z - q.z)
    if (val === 0) return 0
    return (val > 0) ? 1 : 2
  }

  const onSegment = (p: any, q: any, r: any) => {
    return (q.x <= Math.max(p.x, r.x) && q.x >= Math.min(p.x, r.x) &&
            q.z <= Math.max(p.z, r.z) && q.z >= Math.min(p.z, r.z))
  }

  const o1 = orientation(p1, q1, p2)
  const o2 = orientation(p1, q1, q2)
  const o3 = orientation(p2, q2, p1)
  const o4 = orientation(p2, q2, q1)

  if (o1 !== o2 && o3 !== o4) return true
  if (o1 === 0 && onSegment(p1, p2, q1)) return true
  if (o2 === 0 && onSegment(p1, q2, q1)) return true
  if (o3 === 0 && onSegment(p2, p1, q2)) return true
  if (o4 === 0 && onSegment(p2, q1, q2)) return true

  return false
}

/**
 * Finds the closest point on a polygon's perimeter to a given point.
 * Also returns the normal of the wall segment that the closest point lies on.
 */
export function findClosestPointOnPolygon(
  point: { x: number; z: number },
  polygon: { x: number; z: number }[]
): { position: Vector3; normal: Vector3 } | null {
  if (!polygon || polygon.length < 2) return null

  let closestPoint: Vector3 | null = null
  let wallNormal: Vector3 | null = null
  let minDistance = Infinity

  for (let i = 0; i < polygon.length; i++) {
    const p1 = polygon[i]
    const p2 = polygon[(i + 1) % polygon.length]

    const dx = p2.x - p1.x
    const dz = p2.z - p1.z

    if (dx === 0 && dz === 0) continue

    const t = ((point.x - p1.x) * dx + (point.z - p1.z) * dz) / (dx * dx + dz * dz)
    const clampedT = Math.max(0, Math.min(1, t))

    const currentClosestX = p1.x + clampedT * dx
    const currentClosestZ = p1.z + clampedT * dz

    const distance = Math.sqrt(Math.pow(point.x - currentClosestX, 2) + Math.pow(point.z - currentClosestZ, 2))

    if (distance < minDistance) {
      minDistance = distance
      closestPoint = new Vector3(currentClosestX, 0, currentClosestZ)
      // Calculate the outward-facing normal of the wall segment
      const normal = new Vector3(dz, 0, -dx).normalize()
      wallNormal = normal
    }
  }

  if (closestPoint && wallNormal) {
    return { position: closestPoint, normal: wallNormal }
  }
  return null
} 