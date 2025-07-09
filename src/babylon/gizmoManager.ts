import React from 'react'
import { 
  GizmoManager, 
  Scene, 
  Mesh, 
  Vector3, 
  Matrix,
  Quaternion
} from 'babylonjs'
import { useSceneStore } from '../state/sceneStore'
import { SceneManager } from './sceneManager'
import type { TransformMode, MultiSelectInitialState } from '../types/types'

export class GizmoController {
  private gizmoManager: GizmoManager | null = null
  private scene: Scene | null = null
  private sceneManager: SceneManager | null = null
  private gizmoObservers: { observable: any, observer: any }[] = []
  private currentTargetMesh: Mesh | null = null
  private onDragEndCallback?: (position: Vector3, rotation: Vector3, scale: Vector3) => void
  private originalTransform: { position: Vector3, rotation: Vector3, scale: Vector3 } | null = null

  constructor(scene: Scene, sceneManager: SceneManager) {
    this.scene = scene
    this.sceneManager = sceneManager
    this.initializeGizmoManager()
  }

  private initializeGizmoManager(): void {
    if (!this.scene) return
    
    this.gizmoManager = new GizmoManager(this.scene)
    this.gizmoManager.positionGizmoEnabled = false
    this.gizmoManager.rotationGizmoEnabled = false
    this.gizmoManager.scaleGizmoEnabled = false
    this.gizmoManager.boundingBoxGizmoEnabled = false
    this.gizmoManager.usePointerToAttachGizmos = false
    
    console.log('🎯 GizmoController initialized')
  }

  public updateGizmos(
    transformMode: TransformMode,
    targetMesh: Mesh | null,
    onDragEnd: (position: Vector3, rotation: Vector3, scale: Vector3) => void
  ): void {
    if (!this.gizmoManager) return

    console.log('🔧 Updating gizmos:', { transformMode, targetMesh: targetMesh?.name })
    
    // Clean up existing observers
    this.cleanupGizmoObservers()
    
    // Update callback
    this.onDragEndCallback = onDragEnd
    
    // Disable all gizmos first
    this.gizmoManager.positionGizmoEnabled = false
    this.gizmoManager.rotationGizmoEnabled = false
    this.gizmoManager.scaleGizmoEnabled = false
    this.gizmoManager.boundingBoxGizmoEnabled = false
    
    // Attach to target mesh or detach
    if (targetMesh) {
      this.gizmoManager.attachToMesh(targetMesh)
      this.currentTargetMesh = targetMesh
      
      // Enable appropriate gizmo based on transform mode
      switch (transformMode) {
        case 'move':
          this.gizmoManager.positionGizmoEnabled = true
          break
        case 'rotate':
          this.gizmoManager.rotationGizmoEnabled = true
          break
        case 'scale':
          this.gizmoManager.scaleGizmoEnabled = true
          break
        case 'select':
          this.gizmoManager.boundingBoxGizmoEnabled = true
          break
      }
      
      // Set up observers for the active gizmo, including bounding-box gizmo when in "select" mode
      this.setupGizmoObservers()
    } else {
      this.gizmoManager.attachToMesh(null)
      this.currentTargetMesh = null
    }
  }

  private setupGizmoObservers(): void {
    if (!this.gizmoManager || !this.onDragEndCallback) return

    const onDragEnd = this.onDragEndCallback
    const { positionGizmo, rotationGizmo, scaleGizmo } = this.gizmoManager.gizmos
    const boundingBoxGizmo = (this.gizmoManager as any).boundingBoxGizmo

    // Position gizmo observer with collision detection
    if (positionGizmo) {
      // Store initial position when drag starts
      const dragStartObservable = positionGizmo.onDragStartObservable
      const dragStartObserver = dragStartObservable.add(() => {
        const attachedMesh = this.gizmoManager?.attachedMesh
        if (attachedMesh) {
          this.originalTransform = {
            position: attachedMesh.position.clone(),
            rotation: attachedMesh.rotation.clone(),
            scale: attachedMesh.scaling.clone()
          }
        }
      })
      this.gizmoObservers.push({ observable: dragStartObservable, observer: dragStartObserver })

      // Check collision during drag
      const dragObservable = positionGizmo.onDragObservable
      const dragObserver = dragObservable.add(() => {
        const attachedMesh = this.gizmoManager?.attachedMesh
        if (attachedMesh && this.sceneManager && this.originalTransform) {
          const meshId = attachedMesh.name || attachedMesh.id
          if (this.sceneManager.checkCollisionAtPosition(meshId, attachedMesh.position)) {
            // Revert to original position if collision detected
            attachedMesh.position.copyFrom(this.originalTransform.position)
            console.log(`🚫 Movement blocked due to collision for ${meshId}`)
          }
        }
      })
      this.gizmoObservers.push({ observable: dragObservable, observer: dragObserver })

      const observable = positionGizmo.onDragEndObservable
      const observer = observable.add(() => {
        const attachedMesh = this.gizmoManager?.attachedMesh
        if (attachedMesh) {
          onDragEnd(attachedMesh.position, attachedMesh.rotation, attachedMesh.scaling)
        }
      })
      this.gizmoObservers.push({ observable, observer })
    }

    // Rotation gizmo observer (less collision checking needed for rotation)
    if (rotationGizmo) {
      const observable = rotationGizmo.onDragEndObservable
      const observer = observable.add(() => {
        const attachedMesh = this.gizmoManager?.attachedMesh
        if (attachedMesh) {
          onDragEnd(attachedMesh.position, attachedMesh.rotation, attachedMesh.scaling)
        }
      })
      this.gizmoObservers.push({ observable, observer })
    }

    // Scale gizmo observer with collision detection
    if (scaleGizmo) {
      // Store initial scale when drag starts
      const dragStartObservable = scaleGizmo.onDragStartObservable
      const dragStartObserver = dragStartObservable.add(() => {
        const attachedMesh = this.gizmoManager?.attachedMesh
        if (attachedMesh) {
          this.originalTransform = {
            position: attachedMesh.position.clone(),
            rotation: attachedMesh.rotation.clone(),
            scale: attachedMesh.scaling.clone()
          }
        }
      })
      this.gizmoObservers.push({ observable: dragStartObservable, observer: dragStartObserver })

      // Check collision during scale
      const dragObservable = scaleGizmo.onDragObservable
      const dragObserver = dragObservable.add(() => {
        const attachedMesh = this.gizmoManager?.attachedMesh
        if (attachedMesh && this.sceneManager && this.originalTransform) {
          const meshId = attachedMesh.name || attachedMesh.id
          if (this.sceneManager.checkCollisionAtTransform(meshId, attachedMesh.position, attachedMesh.rotation, attachedMesh.scaling)) {
            // Revert to original scale if collision detected
            attachedMesh.scaling.copyFrom(this.originalTransform.scale)
            console.log(`🚫 Scaling blocked due to collision for ${meshId}`)
          }
        }
      })
      this.gizmoObservers.push({ observable: dragObservable, observer: dragObserver })

      const observable = scaleGizmo.onDragEndObservable
      const observer = observable.add(() => {
        const attachedMesh = this.gizmoManager?.attachedMesh
        if (attachedMesh) {
          onDragEnd(attachedMesh.position, attachedMesh.rotation, attachedMesh.scaling)
        }
      })
      this.gizmoObservers.push({ observable, observer })
    }

    // Bounding box gizmo has multiple interactions that can end a drag
    if (boundingBoxGizmo) {
      const handleBoundingBoxDragEnd = () => {
        const attachedMesh = this.gizmoManager?.attachedMesh
        if (attachedMesh) {
          // BoundingBoxGizmo manipulates the matrix directly. To get the final
          // transform, we must decompose the world matrix.
          const newScale = new Vector3()
          const newRotation = new Quaternion()
          const newPosition = new Vector3()
          
          attachedMesh.computeWorldMatrix(true)
          if (attachedMesh.getWorldMatrix().decompose(newScale, newRotation, newPosition)) {
            onDragEnd(newPosition, newRotation.toEulerAngles(), newScale)
          }
        }
      }

      const dragObs = boundingBoxGizmo.onDragEndObservable.add(handleBoundingBoxDragEnd)
      this.gizmoObservers.push({ observable: boundingBoxGizmo.onDragEndObservable, observer: dragObs })

      const rotObs = boundingBoxGizmo.onRotationSphereDragEndObservable.add(handleBoundingBoxDragEnd)
      this.gizmoObservers.push({ observable: boundingBoxGizmo.onRotationSphereDragEndObservable, observer: rotObs })
      
      const scaleObs = boundingBoxGizmo.onScaleBoxDragEndObservable.add(handleBoundingBoxDragEnd)
      this.gizmoObservers.push({ observable: boundingBoxGizmo.onScaleBoxDragEndObservable, observer: scaleObs })
    }
  }

  private cleanupGizmoObservers(): void {
    this.gizmoObservers.forEach(({ observable, observer }) => {
      try {
        observable.remove(observer)
      } catch (error) {
        console.warn('Error removing gizmo observer:', error)
      }
    })
    this.gizmoObservers = []
  }

  public dispose(): void {
    this.cleanupGizmoObservers()
    if (this.gizmoManager) {
      this.gizmoManager.dispose()
      this.gizmoManager = null
    }
    this.currentTargetMesh = null
    this.onDragEndCallback = undefined
  }
}

/**
 * Hook to manage gizmos for object transformation
 * Observes the store for changes in selection and transform mode
 */
export const useGizmoManager = (
  scene: Scene | null,
  getMeshById: (id: string) => Mesh | null,
  multiSelectPivot: Mesh | null,
  snapToGrid: boolean,
  gridSize: number,
  sceneManager: SceneManager | null
) => {
  const store = useSceneStore()
  const {
    selectedObjectId,
    selectedObjectIds,
    transformMode,
    multiSelectInitialStates,
    updateObject
  } = store

  const gizmoControllerRef = React.useRef<GizmoController | null>(null)

  // Initialize gizmo controller when scene is ready
  React.useEffect(() => {
    if (!scene || !sceneManager) return

    console.log('🎯 Initializing GizmoController')
    gizmoControllerRef.current = new GizmoController(scene, sceneManager)

    return () => {
      if (gizmoControllerRef.current) {
        gizmoControllerRef.current.dispose()
        gizmoControllerRef.current = null
      }
    }
  }, [scene, sceneManager])

  // Update gizmos when selection or transform mode changes
  React.useEffect(() => {
    console.log('🎯 [GizmoManager] useEffect triggered with:', {
      selectedObjectId,
      selectedObjectIds,
      transformMode,
      hasController: !!gizmoControllerRef.current,
      hasScene: !!scene
    })
    
    if (!gizmoControllerRef.current || !scene) return

    const isMultiSelect = selectedObjectIds.length > 0
    let targetMesh: Mesh | null = null

    // Choose which mesh to attach gizmo to
    if (isMultiSelect && multiSelectPivot) {
      targetMesh = multiSelectPivot
      console.log('🎯 [GizmoManager] Using multiSelectPivot as target')
    } else if (selectedObjectId) {
      console.log('🎯 [GizmoManager] Calling getMeshById with:', selectedObjectId)
      targetMesh = getMeshById(selectedObjectId)
      console.log('🎯 [GizmoManager] getMeshById returned:', targetMesh?.name || 'null')
    } else {
      console.log('🎯 [GizmoManager] No selection, targetMesh will be null')
    }

    // Handle gizmo drag end
    const handleGizmoDragEnd = (position: Vector3, rotation: Vector3, scale: Vector3) => {
      if (isMultiSelect && multiSelectPivot) {
        // Apply transform to all selected objects with collision checking
        selectedObjectIds.forEach(id => {
          const initialState = multiSelectInitialStates[id]
          if (!initialState) return

          let newPosition = initialState.relativePosition.clone().multiply(scale)
          const rotationMatrix = new Matrix()
          Matrix.RotationYawPitchRollToRef(rotation.y, rotation.x, rotation.z, rotationMatrix)
          newPosition = Vector3.TransformCoordinates(newPosition, rotationMatrix).add(position)
          
          if (snapToGrid) {
            newPosition = new Vector3(
              Math.round(newPosition.x / gridSize) * gridSize,
              Math.round(newPosition.y / gridSize) * gridSize,
              Math.round(newPosition.z / gridSize) * gridSize
            )
          }

          const newRotation = initialState.rotation.add(rotation)
          const newScale = initialState.scale.multiply(scale)

          // Check for collision before applying transform (for multi-select)
          const storeState = useSceneStore.getState()
          const sceneManager = storeState.collisionDetectionEnabled && gizmoControllerRef.current ? 
            (gizmoControllerRef.current as any).sceneManager : null
          
          if (sceneManager && sceneManager.checkCollisionAtTransform) {
            if (!sceneManager.checkCollisionAtTransform(id, newPosition, newRotation, newScale)) {
              updateObject(id, { position: newPosition, rotation: newRotation, scale: newScale })
            } else {
              console.log(`🚫 Multi-select transform blocked for ${id} due to collision`)
            }
          } else {
            updateObject(id, { position: newPosition, rotation: newRotation, scale: newScale })
          }
        })
      } else if (selectedObjectId) {
        // Single object transform with collision checking
        let newPosition = position.clone()
        if (snapToGrid) {
          newPosition = new Vector3(
            Math.round(newPosition.x / gridSize) * gridSize,
            Math.round(newPosition.y / gridSize) * gridSize,
            Math.round(newPosition.z / gridSize) * gridSize
          )
        }

        // Check for collision before applying transform (for single object)
        const storeState = useSceneStore.getState()
        const sceneManager = storeState.collisionDetectionEnabled && gizmoControllerRef.current ? 
          (gizmoControllerRef.current as any).sceneManager : null

        if (sceneManager && sceneManager.checkCollisionAtTransform) {
          if (!sceneManager.checkCollisionAtTransform(selectedObjectId, newPosition, rotation.clone(), scale.clone())) {
            updateObject(selectedObjectId, { 
              position: newPosition, 
              rotation: rotation.clone(), 
              scale: scale.clone() 
            })
          } else {
            console.log(`🚫 Transform blocked for ${selectedObjectId} due to collision`)
          }
        } else {
          updateObject(selectedObjectId, { 
            position: newPosition, 
            rotation: rotation.clone(), 
            scale: scale.clone() 
          })
        }
      }
    }

    gizmoControllerRef.current.updateGizmos(transformMode, targetMesh, handleGizmoDragEnd)
  }, [
    selectedObjectId, 
    selectedObjectIds, 
    transformMode, 
    multiSelectPivot, 
    multiSelectInitialStates, 
    snapToGrid, 
    gridSize,
    scene
  ])

  return gizmoControllerRef.current
}
