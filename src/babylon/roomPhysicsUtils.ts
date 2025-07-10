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
    const bounds = room.getBoundingInfo()
    
    // Check XZ bounds (ignore Y for initial check)
    const min = bounds.boundingBox.minimumWorld
    const max = bounds.boundingBox.maximumWorld
    
    if (position.x >= min.x && position.x <= max.x &&
        position.z >= min.z && position.z <= max.z) {
      
      // Get floor height from the room's floor mesh
      const floorMesh = room.getChildMeshes().find(child => child.name.includes('-floor'))
      const floorHeight = floorMesh ? floorMesh.getBoundingInfo().boundingBox.maximumWorld.y : 0
      
      // Standard wall height (from custom room creation)
      const wallHeight = 2.0
      
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
  // Get mesh bounds at new position
  const meshBounds = getMeshBoundsAtPosition(mesh, newPosition)
  
  // Get room walls (children that contain 'wall' in name)
  const walls = roomInfo.mesh.getChildMeshes().filter(child => 
    child.name.includes('-wall-') || child.name.includes('-interior-wall-')
  )
  
  // Add small margin to prevent clipping
  const COLLISION_MARGIN = 0.01
  
  // Check collision with each wall
  for (const wall of walls) {
    const wallBounds = wall.getBoundingInfo().boundingBox
    
    // Check if bounding boxes overlap in all three dimensions
    const overlapX = meshBounds.max.x + COLLISION_MARGIN > wallBounds.minimumWorld.x && 
                     meshBounds.min.x - COLLISION_MARGIN < wallBounds.maximumWorld.x
    
    const overlapY = meshBounds.max.y > wallBounds.minimumWorld.y && 
                     meshBounds.min.y < wallBounds.maximumWorld.y
    
    const overlapZ = meshBounds.max.z + COLLISION_MARGIN > wallBounds.minimumWorld.z && 
                     meshBounds.min.z - COLLISION_MARGIN < wallBounds.maximumWorld.z
    
    if (overlapX && overlapY && overlapZ) {
      return true // Collision detected
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