import { Mesh, Vector3, Matrix } from 'babylonjs'
import type { Boundary, ConnectionPoint } from '../types/types'

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

// ============================================
// Collision-specific boundary utilities
// ============================================

/**
 * Computes the world-space AABB for a mesh, which is needed for collision detection.
 * Unlike computeMeshBoundary, this returns vectors in world space.
 */
export const computeWorldBoundary = (mesh: Mesh): Boundary => {
  mesh.computeWorldMatrix(true)
  const boundingInfo = mesh.getBoundingInfo()
  const bbox = boundingInfo.boundingBox
  
  const min = bbox.minimumWorld.clone()
  const max = bbox.maximumWorld.clone()
  const size = max.subtract(min)
  const center = min.add(size.scale(0.5))
  
  return {
    aabb: { min, max, size, center }
  }
}

/**
 * Expands or contracts a boundary by a given margin.
 * Positive margin expands, negative margin contracts.
 * Useful for creating safety margins in collision detection.
 */
export const expandBoundary = (boundary: Boundary, margin: number): Boundary => {
  const marginVector = new Vector3(margin, margin, margin)
  const min = boundary.aabb.min.subtract(marginVector)
  const max = boundary.aabb.max.add(marginVector)
  const size = max.subtract(min)
  const center = min.add(size.scale(0.5))
  
  return {
    aabb: { min, max, size, center }
  }
}

/**
 * Merges multiple boundaries into a single encompassing boundary.
 * Useful for group collision detection or composite objects.
 */
export const mergeBoundaries = (boundaries: Boundary[]): Boundary | null => {
  if (boundaries.length === 0) return null
  if (boundaries.length === 1) return boundaries[0]
  
  let minPoint = boundaries[0].aabb.min.clone()
  let maxPoint = boundaries[0].aabb.max.clone()
  
  for (let i = 1; i < boundaries.length; i++) {
    const b = boundaries[i]
    minPoint = Vector3.Minimize(minPoint, b.aabb.min)
    maxPoint = Vector3.Maximize(maxPoint, b.aabb.max)
  }
  
  const size = maxPoint.subtract(minPoint)
  const center = minPoint.add(size.scale(0.5))
  
  return {
    aabb: { min: minPoint, max: maxPoint, size, center }
  }
}

/**
 * Checks if two boundaries overlap in 3D space.
 * Returns true if there is any intersection.
 */
export const boundariesOverlap = (a: Boundary, b: Boundary): boolean => {
  const aMin = a.aabb.min
  const aMax = a.aabb.max
  const bMin = b.aabb.min
  const bMax = b.aabb.max
  
  return (
    aMin.x <= bMax.x && aMax.x >= bMin.x &&
    aMin.y <= bMax.y && aMax.y >= bMin.y &&
    aMin.z <= bMax.z && aMax.z >= bMin.z
  )
}

/**
 * Computes the overlap volume between two boundaries.
 * Returns 0 if boundaries don't overlap.
 */
export const computeOverlapVolume = (a: Boundary, b: Boundary): number => {
  if (!boundariesOverlap(a, b)) return 0
  
  const overlapMin = Vector3.Maximize(a.aabb.min, b.aabb.min)
  const overlapMax = Vector3.Minimize(a.aabb.max, b.aabb.max)
  const overlapSize = overlapMax.subtract(overlapMin)
  
  return overlapSize.x * overlapSize.y * overlapSize.z
}

/**
 * Computes the minimum separation vector to resolve overlap between two boundaries.
 * Returns null if boundaries don't overlap.
 * The vector points from boundary A to boundary B.
 */
export const computeSeparationVector = (a: Boundary, b: Boundary): Vector3 | null => {
  if (!boundariesOverlap(a, b)) return null
  
  const aCenter = a.aabb.center
  const bCenter = b.aabb.center
  
  // Calculate overlap on each axis
  const overlapX = Math.min(a.aabb.max.x - b.aabb.min.x, b.aabb.max.x - a.aabb.min.x)
  const overlapY = Math.min(a.aabb.max.y - b.aabb.min.y, b.aabb.max.y - a.aabb.min.y)
  const overlapZ = Math.min(a.aabb.max.z - b.aabb.min.z, b.aabb.max.z - a.aabb.min.z)
  
  // Find the axis with minimum overlap (easiest to separate)
  let separationVector = Vector3.Zero()
  const minOverlap = Math.min(overlapX, overlapY, overlapZ)
  
  if (minOverlap === overlapX) {
    separationVector.x = (aCenter.x < bCenter.x) ? -overlapX : overlapX
  } else if (minOverlap === overlapY) {
    separationVector.y = (aCenter.y < bCenter.y) ? -overlapY : overlapY
  } else {
    separationVector.z = (aCenter.z < bCenter.z) ? -overlapZ : overlapZ
  }
  
  return separationVector
}

/**
 * Projects a boundary onto a 2D plane (XZ by default, for top-down view).
 * Useful for 2D collision checks in floor-planning scenarios.
 */
export const projectBoundaryTo2D = (
  boundary: Boundary, 
  plane: 'xy' | 'xz' | 'yz' = 'xz'
): { min: Vector3; max: Vector3; size: Vector3; center: Vector3 } => {
  const min = boundary.aabb.min.clone()
  const max = boundary.aabb.max.clone()
  
  // Zero out the perpendicular axis
  switch (plane) {
    case 'xy':
      min.z = 0
      max.z = 0
      break
    case 'xz':
      min.y = 0
      max.y = 0
      break
    case 'yz':
      min.x = 0
      max.x = 0
      break
  }
  
  const size = max.subtract(min)
  const center = min.add(size.scale(0.5))
  
  return { min, max, size, center }
}

/**
 * Computes the closest point on a boundary to a given point.
 * Useful for finding the nearest valid position during collision resolution.
 */
export const closestPointOnBoundary = (boundary: Boundary, point: Vector3): Vector3 => {
  const min = boundary.aabb.min
  const max = boundary.aabb.max
  
  return new Vector3(
    Math.max(min.x, Math.min(point.x, max.x)),
    Math.max(min.y, Math.min(point.y, max.y)),
    Math.max(min.z, Math.min(point.z, max.z))
  )
}

/**
 * Checks if a point is inside a boundary.
 */
export const isPointInBoundary = (boundary: Boundary, point: Vector3): boolean => {
  const min = boundary.aabb.min
  const max = boundary.aabb.max
  
  return (
    point.x >= min.x && point.x <= max.x &&
    point.y >= min.y && point.y <= max.y &&
    point.z >= min.z && point.z <= max.z
  )
} 