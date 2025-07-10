import { Vector3, Color3, ArcRotateCamera, Mesh, StandardMaterial, Scene } from 'babylonjs'
import { SceneManager } from './sceneManager'
import type { SceneObject } from '../types/types'
import type { MinimapObject, MinimapCamera } from './minimapRenderer'

export interface SceneDataSnapshot {
  objects: MinimapObject[]
  camera: MinimapCamera
  timestamp: number
}

export class SceneDataAdapter {
  private sceneManager: SceneManager
  private lastSnapshot: SceneDataSnapshot | null = null
  private cachedObjects: Map<string, MinimapObject> = new Map()
  private frameCount = 0
  private objectChangeCount = 0
  private selectedObjectId: string | null = null
  private selectedObjectIds: string[] = []
  private objectLocked: {[key: string]: boolean} = {}

  constructor(sceneManager: SceneManager) {
    this.sceneManager = sceneManager
    console.log('🗂️ SceneDataAdapter initialized')
  }

  public extractSceneData(): SceneDataSnapshot {
    const startTime = performance.now()
    
    try {
      const scene = this.sceneManager.getScene()
      if (!scene) {
        console.warn('⚠️ No scene available for minimap data extraction')
        return this.createEmptySnapshot()
      }

      const objects = this.extractObjects(scene)
      const camera = this.extractCamera(scene)
      
      const snapshot: SceneDataSnapshot = {
        objects,
        camera,
        timestamp: Date.now()
      }

      this.lastSnapshot = snapshot
      this.frameCount++
      
      const endTime = performance.now()
      if (endTime - startTime > 2) {
        console.warn('⚠️ Scene data extraction took too long:', (endTime - startTime).toFixed(2) + 'ms')
      }

      return snapshot
    } catch (error) {
      console.error('❌ Error extracting scene data:', error)
      return this.lastSnapshot || this.createEmptySnapshot()
    }
  }

  private extractObjects(scene: Scene): MinimapObject[] {
    const objects: MinimapObject[] = []
    let changedObjects = 0

    try {
      // Get all meshes from the scene
      const meshes = scene.meshes

      for (const mesh of meshes) {
        if (!(mesh instanceof Mesh)) continue
        if (!mesh.isPickable) continue
        if (mesh.name.toLowerCase().includes('gizmo')) continue
        if (mesh.name.toLowerCase().includes('grid')) continue
        if (mesh.name.toLowerCase().includes('debug')) continue
        
        // Check if this object has changed since last extraction
        const cachedObject = this.cachedObjects.get(mesh.id)
        const currentObject = this.meshToMinimapObject(mesh)
        
        if (!cachedObject || this.hasObjectChanged(cachedObject, currentObject)) {
          this.cachedObjects.set(mesh.id, currentObject)
          changedObjects++
        }
        
        objects.push(currentObject)
      }

      if (changedObjects > 0) {
        this.objectChangeCount += changedObjects
        console.log(`🔄 Scene data: ${changedObjects} objects changed, ${objects.length} total`)
      }

      return objects
    } catch (error) {
      console.error('❌ Error extracting objects:', error)
      return []
    }
  }

  private meshToMinimapObject(mesh: Mesh): MinimapObject {
    try {
      // Get bounding box for size calculation
      const boundingInfo = mesh.getBoundingInfo()
      const boundingBox = boundingInfo.boundingBox
      const size = boundingBox.maximum.subtract(boundingBox.minimum)
      
      // Get color from material
      let color = new Color3(0.5, 0.5, 0.5) // Default gray
      if (mesh.material && mesh.material instanceof StandardMaterial) {
        if (mesh.material.diffuseColor) {
          color = mesh.material.diffuseColor.clone()
        }
      }

      // Determine object type
      let objectType = 'unknown'
      if (mesh.name.includes('cube') || mesh.name.includes('box')) {
        objectType = 'cube'
      } else if (mesh.name.includes('sphere')) {
        objectType = 'sphere'
      } else if (mesh.name.includes('cylinder')) {
        objectType = 'cylinder'
      } else if (mesh.name.includes('plane')) {
        objectType = 'plane'
      } else if (mesh.name.includes('house')) {
        objectType = 'house'
      } else if (mesh.name.includes('ground')) {
        objectType = 'ground'
      } else if (mesh.name.includes('imported')) {
        objectType = 'imported'
      } else if (mesh.name.includes('room')) {
        objectType = 'room'
      } else {
        // Try to infer from mesh geometry
        const vertexCount = mesh.getTotalVertices()
        if (vertexCount === 8) {
          objectType = 'cube'
        } else if (vertexCount > 100) {
          objectType = 'complex'
        } else {
          objectType = 'primitive'
        }
      }

      // Check if object is selected (this would need to be passed from the scene store)
      const selected = this.isObjectSelected(mesh.id)
      
      // Check if object is locked (this would need to be passed from the scene store)
      const locked = this.isObjectLocked(mesh.id)

      return {
        id: mesh.id,
        position: mesh.position.clone(),
        rotation: mesh.rotation.y, // Only Y rotation for top-down view
        size: size,
        color: color,
        type: objectType,
        selected: selected,
        locked: locked,
        visible: mesh.isVisible && mesh.isEnabled()
      }
    } catch (error) {
      console.error('❌ Error converting mesh to minimap object:', error)
      return this.createFallbackObject(mesh)
    }
  }

  private extractCamera(scene: Scene): MinimapCamera {
    try {
      const camera = scene.activeCamera
      if (!camera) {
        console.warn('⚠️ No active camera found')
        return this.createDefaultCamera()
      }

      let cameraType: 'arc' | 'free' | 'universal' = 'universal'
      if (camera.getClassName() === 'ArcRotateCamera') {
        cameraType = 'arc'
      } else if (camera.getClassName() === 'FreeCamera') {
        cameraType = 'free'
      }

      // Get camera direction
      const direction = camera.getDirection(Vector3.Forward())
      
      // Get field of view
      let fov = 45 // Default FOV
      if ('fov' in camera) {
        fov = (camera as any).fov * 180 / Math.PI // Convert radians to degrees
      }

      return {
        position: camera.position.clone(),
        direction: direction,
        fov: fov,
        type: cameraType
      }
    } catch (error) {
      console.error('❌ Error extracting camera:', error)
      return this.createDefaultCamera()
    }
  }

  private hasObjectChanged(cached: MinimapObject, current: MinimapObject): boolean {
    // Check if any significant properties have changed
    const positionChanged = !cached.position.equals(current.position)
    const rotationChanged = Math.abs(cached.rotation - current.rotation) > 0.01
    const sizeChanged = !cached.size.equals(current.size)
    const colorChanged = !cached.color.equals(current.color)
    const stateChanged = cached.selected !== current.selected || 
                        cached.locked !== current.locked || 
                        cached.visible !== current.visible

    return positionChanged || rotationChanged || sizeChanged || colorChanged || stateChanged
  }

  private isObjectSelected(objectId: string): boolean {
    return this.selectedObjectId === objectId || this.selectedObjectIds.includes(objectId)
  }

  private isObjectLocked(objectId: string): boolean {
    return this.objectLocked[objectId] || false
  }

  private createFallbackObject(mesh: Mesh): MinimapObject {
    return {
      id: mesh.id,
      position: mesh.position.clone(),
      rotation: 0,
      size: new Vector3(1, 1, 1),
      color: new Color3(0.5, 0.5, 0.5),
      type: 'unknown',
      selected: false,
      locked: false,
      visible: true
    }
  }

  private createDefaultCamera(): MinimapCamera {
    return {
      position: new Vector3(0, 10, 0),
      direction: new Vector3(0, -1, 0),
      fov: 45,
      type: 'universal'
    }
  }

  private createEmptySnapshot(): SceneDataSnapshot {
    return {
      objects: [],
      camera: this.createDefaultCamera(),
      timestamp: Date.now()
    }
  }

  // Public methods for updating state from scene store
  public updateSelectionState(selectedObjectId: string | null, selectedObjectIds: string[]): void {
    this.selectedObjectId = selectedObjectId
    this.selectedObjectIds = selectedObjectIds
  }

  public updateLockState(objectLocked: {[key: string]: boolean}): void {
    this.objectLocked = objectLocked
  }

  public setObjectSelectionState(objectId: string, selected: boolean): void {
    const cachedObject = this.cachedObjects.get(objectId)
    if (cachedObject) {
      cachedObject.selected = selected
      this.objectChangeCount++
    }
  }

  public setObjectLockState(objectId: string, locked: boolean): void {
    const cachedObject = this.cachedObjects.get(objectId)
    if (cachedObject) {
      cachedObject.locked = locked
      this.objectChangeCount++
    }
  }

  public setObjectVisibility(objectId: string, visible: boolean): void {
    const cachedObject = this.cachedObjects.get(objectId)
    if (cachedObject) {
      cachedObject.visible = visible
      this.objectChangeCount++
    }
  }

  public getLastSnapshot(): SceneDataSnapshot | null {
    return this.lastSnapshot
  }

  public getPerformanceInfo(): { frameCount: number; objectChangeCount: number; cacheSize: number } {
    return {
      frameCount: this.frameCount,
      objectChangeCount: this.objectChangeCount,
      cacheSize: this.cachedObjects.size
    }
  }

  public clearCache(): void {
    this.cachedObjects.clear()
    this.objectChangeCount = 0
    console.log('🗑️ Scene data cache cleared')
  }

  public dispose(): void {
    this.clearCache()
    this.lastSnapshot = null
    console.log('🗑️ SceneDataAdapter disposed')
  }
} 