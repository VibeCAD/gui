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