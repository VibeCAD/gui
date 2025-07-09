import { 
  Engine, 
  Scene, 
  ArcRotateCamera, 
  Vector3, 
  HemisphericLight, 
  MeshBuilder, 
  StandardMaterial, 
  Color3, 
  Mesh, 
  GizmoManager,
  PointerEventTypes,
  PickingInfo
} from 'babylonjs'
import type { SceneObject, PrimitiveType, TransformMode } from '../types/types'
import { createHousingMesh } from './housingFactory'


export class SceneManager {
  private engine: Engine | null = null
  private scene: Scene | null = null
  private camera: ArcRotateCamera | null = null
  private gizmoManager: GizmoManager | null = null
  private meshMap: Map<string, Mesh> = new Map()
  private gridMesh: Mesh | null = null
  private multiSelectPivot: Mesh | null = null
  private pointerDownPosition: { x: number, y: number } | null = null
  private collisionDetectionEnabled: boolean = true
  
  // Event callbacks
  private onObjectClickCallback?: (pickInfo: PickingInfo, isCtrlHeld: boolean) => void
  private onObjectHoverCallback?: (pickInfo: PickingInfo) => void

  constructor() {
    // Initialize empty - call initialize() after construction
  }

  public initialize(canvas: HTMLCanvasElement): boolean {
    try {
      console.log('🚀 Initializing Babylon.js scene...')
      
      // Create engine and scene
      this.engine = new Engine(canvas, true)
      this.scene = new Scene(this.engine)
      
      // Enable collision detection by default
      this.scene.collisionsEnabled = this.collisionDetectionEnabled
      
      // Create camera
      this.camera = new ArcRotateCamera('camera', -Math.PI / 2, Math.PI / 2.5, 10, Vector3.Zero(), this.scene)
      this.camera.attachControl(canvas, true)
      
      // Create gizmo manager
      this.gizmoManager = new GizmoManager(this.scene)
      this.gizmoManager.positionGizmoEnabled = false
      this.gizmoManager.rotationGizmoEnabled = false
      this.gizmoManager.scaleGizmoEnabled = false
      this.gizmoManager.boundingBoxGizmoEnabled = false
      this.gizmoManager.usePointerToAttachGizmos = false
      
      // Create light
      const light = new HemisphericLight('light', new Vector3(0, 1, 0), this.scene)
      light.intensity = 0.7
      
      // Create ground
      this.createGround()
      
      // Set up pointer events
      this.setupPointerEvents()
      
      // Start render loop
      this.engine.runRenderLoop(() => {
        this.scene?.render()
      })
      
      // Handle resize
      const handleResize = () => {
        this.engine?.resize()
      }
      window.addEventListener('resize', handleResize)
      
      console.log('✅ Scene initialized successfully')
      return true
    } catch (error) {
      console.error('❌ Error initializing Babylon.js scene:', error)
      return false
    }
  }

  private createGround(): void {
    if (!this.scene) return
    
    const ground = MeshBuilder.CreateGround('ground', { width: 10, height: 10 }, this.scene)
    const groundMaterial = new StandardMaterial('groundMaterial', this.scene)
    groundMaterial.diffuseColor = new Color3(0.5, 0.5, 0.5)
    ground.material = groundMaterial
    ground.isPickable = true
    
    this.meshMap.set('ground', ground)
  }

  private setupPointerEvents(): void {
    if (!this.scene) return;

    // Use POINTERPICK for reliable click-selection events (fires when a mesh is picked)
    // and fall back to computing a fresh pick result if the provided pickInfo is undefined.
    this.scene.onPointerObservable.add((pointerInfo) => {
      switch (pointerInfo.type) {
        case PointerEventTypes.POINTERDOWN: {
          // Record initial pointer location for click-vs-drag test
          this.pointerDownPosition = { x: this.scene!.pointerX, y: this.scene!.pointerY }
          break
        }

        case PointerEventTypes.POINTERUP: {
          // Treat as a click only if pointer hasn’t moved too far
          const clickThreshold = 5 // pixels
          if (this.pointerDownPosition) {
            const deltaX = Math.abs(this.pointerDownPosition.x - this.scene!.pointerX)
            const deltaY = Math.abs(this.pointerDownPosition.y - this.scene!.pointerY)

            if (deltaX < clickThreshold && deltaY < clickThreshold) {
              const pickInfo = pointerInfo.pickInfo ?? this.scene?.pick(this.scene.pointerX, this.scene.pointerY)
              const isGizmoClick = pickInfo?.pickedMesh?.name?.toLowerCase().includes('gizmo')

              if (pickInfo && pickInfo.hit && !isGizmoClick) {
                const isCtrlHeld = (pointerInfo.event as PointerEvent).ctrlKey || (pointerInfo.event as PointerEvent).metaKey
                this.onObjectClickCallback?.(pickInfo, isCtrlHeld)
              } else if (!pickInfo?.hit) {
                // Clicked empty space – still notify for deselection logic
                this.onObjectClickCallback?.(pickInfo as any, false)
              }
            }
          }
          // reset tracker
          this.pointerDownPosition = null
          break
        }
        
        case PointerEventTypes.POINTERMOVE:
          // For hover events, we can use POINTERMOVE.
          if (this.onObjectHoverCallback) {
            const pickInfo = this.scene?.pick(this.scene.pointerX, this.scene.pointerY);
            if (pickInfo) {
              this.onObjectHoverCallback(pickInfo);
            }
          }
          break;
      }
    });
  }

  public addMesh(sceneObject: SceneObject): boolean {
    if (!this.scene) return false
    
    console.log(`🔧 SceneManager.addMesh called for: ${sceneObject.id} (${sceneObject.type})`)
    
    try {
      let mesh: Mesh
      
      // Check if it's a housing type
      if (sceneObject.type.startsWith('house-')) {
        mesh = createHousingMesh(sceneObject.type, this.scene, {
          name: sceneObject.id,
          color: sceneObject.color
        })
      } else {
        switch (sceneObject.type) {
          case 'cube':
            mesh = MeshBuilder.CreateBox(sceneObject.id, { size: 2 }, this.scene)
            break
          case 'sphere':
            mesh = MeshBuilder.CreateSphere(sceneObject.id, { diameter: 2 }, this.scene)
            break
          case 'cylinder':
            mesh = MeshBuilder.CreateCylinder(sceneObject.id, { diameter: 2, height: 2 }, this.scene)
            break
          case 'plane':
            mesh = MeshBuilder.CreatePlane(sceneObject.id, { size: 2 }, this.scene)
            break
          case 'torus':
            mesh = MeshBuilder.CreateTorus(sceneObject.id, { diameter: 2, thickness: 0.5 }, this.scene)
            break
          case 'cone':
            mesh = MeshBuilder.CreateCylinder(sceneObject.id, { diameterTop: 0, diameterBottom: 2, height: 2 }, this.scene)
            break
          case 'ground':
            // Ground already exists, just update properties and ensure it's stored with the correct ID
            const existingGround = this.meshMap.get('ground')
            if (existingGround) {
              // Update the ground mesh's name to match the scene object ID
              existingGround.name = sceneObject.id
              // If the ID is different, also store it with the new key
              if (sceneObject.id !== 'ground') {
                this.meshMap.set(sceneObject.id, existingGround)
              }
              this.updateMeshProperties(sceneObject.id, sceneObject)
            }
            return true
          default:
            console.warn(`Unknown primitive type: ${sceneObject.type}`)
            return false
        }
      }
      
      // Set initial properties
      mesh.position = sceneObject.position.clone()
      mesh.rotation = sceneObject.rotation.clone()
      mesh.scaling = sceneObject.scale.clone()
      
      // Ensure the mesh ID and name are set to our object ID for reliable picking
      mesh.id = sceneObject.id
      mesh.name = sceneObject.id
      
      // Create material (for non-housing types or if housing mesh doesn't have material)
      if (!sceneObject.type.startsWith('house-') || !mesh.material) {
        const material = new StandardMaterial(`${sceneObject.id}-material`, this.scene)
        material.diffuseColor = Color3.FromHexString(sceneObject.color)
        mesh.material = material
      }
      
      mesh.isPickable = true
      mesh.checkCollisions = this.collisionDetectionEnabled
      
      // Store mesh reference
      this.meshMap.set(sceneObject.id, mesh)
      
      console.log(`✅ Added mesh: ${sceneObject.id}`, {
        meshName: mesh.name,
        meshId: mesh.id,
        isPickable: mesh.isPickable,
        position: mesh.position,
        hasMap: this.meshMap.has(sceneObject.id)
      })
      return true
    } catch (error) {
      console.error(`❌ Error adding mesh ${sceneObject.id}:`, error)
      return false
    }
  }

  public removeMeshById(id: string): boolean {
    const mesh = this.meshMap.get(id)
    if (!mesh) return false
    
    try {
      mesh.dispose()
      this.meshMap.delete(id)
      console.log(`✅ Removed mesh: ${id}`)
      return true
    } catch (error) {
      console.error(`❌ Error removing mesh ${id}:`, error)
      return false
    }
  }

  public updateMeshProperties(id: string, sceneObject: Partial<SceneObject>): boolean {
    const mesh = this.meshMap.get(id)
    if (!mesh) return false
    
    try {
      // Update transform properties only if they've been provided
      if (sceneObject.position && !mesh.position.equals(sceneObject.position)) {
        mesh.position.copyFrom(sceneObject.position)
      }
      if (sceneObject.rotation && !mesh.rotation.equals(sceneObject.rotation)) {
        mesh.rotation.copyFrom(sceneObject.rotation)
      }
      if (sceneObject.scale && !mesh.scaling.equals(sceneObject.scale)) {
        mesh.scaling.copyFrom(sceneObject.scale)
      }
      
      // Update material color if it has been provided and changed
      if (sceneObject.color && mesh.material && mesh.material instanceof StandardMaterial) {
        if (mesh.material.diffuseColor.toHexString() !== sceneObject.color) {
          mesh.material.diffuseColor = Color3.FromHexString(sceneObject.color)
        }
      }
      
      return true
    } catch (error) {
      console.error(`❌ Error updating mesh ${id}:`, error)
      return false
    }
  }

  public getMeshById(id: string): Mesh | null {
    // Direct lookup
    const direct = this.meshMap.get(id)
    if (direct) return direct

    // Fallback: the id may belong to a child mesh: climb each stored mesh’s parent tree
    for (const root of this.meshMap.values()) {
      if (!root) continue
      let current: Mesh | null = root
      while (current) {
        if (current.name === id || current.id === id) {
          return root // return the top-level mesh we manage
        }
        current = current.parent as Mesh | null
      }
    }
    return null
  }

  public setWireframeMode(enabled: boolean): void {
    this.meshMap.forEach((mesh, id) => {
      if (id !== 'ground' && mesh.material instanceof StandardMaterial) {
        mesh.material.wireframe = enabled
      }
    })
  }

  public setMeshVisibility(id: string, visible: boolean): void {
    const mesh = this.meshMap.get(id)
    if (mesh) {
      mesh.isVisible = visible
    }
  }

  public setMeshEmissive(id: string, color: Color3): void {
    const mesh = this.meshMap.get(id)
    if (mesh && mesh.material instanceof StandardMaterial) {
      mesh.material.emissiveColor = color
    }
  }

  public setCollisionDetectionEnabled(enabled: boolean): void {
    this.collisionDetectionEnabled = enabled
    console.log(`🔧 Collision detection ${enabled ? 'enabled' : 'disabled'}`)
    
    // Update all existing meshes
    this.meshMap.forEach((mesh, id) => {
      if (id !== 'ground') { // Ground should always have collision
        mesh.checkCollisions = enabled
        if (this.scene) {
          // Enable/disable collision detection for the scene
          this.scene.collisionsEnabled = enabled
        }
      }
    })
  }

  public isCollisionDetectionEnabled(): boolean {
    return this.collisionDetectionEnabled
  }

  public checkCollisionAtPosition(meshId: string, newPosition: Vector3): boolean {
    if (!this.collisionDetectionEnabled || !this.scene) return false
    
    const mesh = this.meshMap.get(meshId)
    if (!mesh) return false
    
    // Store original position
    const originalPosition = mesh.position.clone()
    
    // Temporarily move mesh to new position for collision testing
    mesh.position = newPosition
    mesh.computeWorldMatrix(true)
    
    let hasCollision = false
    
    // Check collision with all other meshes (except ground and itself)
    this.meshMap.forEach((otherMesh, otherId) => {
      if (otherId !== meshId && otherId !== 'ground' && !hasCollision) {
        if (mesh.intersectsMesh(otherMesh, true)) {
          hasCollision = true
          console.log(`🚫 Collision detected between ${meshId} and ${otherId}`)
        }
      }
    })
    
    // Restore original position
    mesh.position = originalPosition
    mesh.computeWorldMatrix(true)
    
    return hasCollision
  }

  public checkCollisionAtTransform(meshId: string, newPosition: Vector3, newRotation?: Vector3, newScale?: Vector3): boolean {
    if (!this.collisionDetectionEnabled || !this.scene) return false
    
    const mesh = this.meshMap.get(meshId)
    if (!mesh) return false
    
    // Store original transform
    const originalPosition = mesh.position.clone()
    const originalRotation = mesh.rotation.clone()
    const originalScale = mesh.scaling.clone()
    
    // Apply new transform for collision testing
    mesh.position = newPosition
    if (newRotation) mesh.rotation = newRotation
    if (newScale) mesh.scaling = newScale
    mesh.computeWorldMatrix(true)
    
    let hasCollision = false
    
    // Check collision with all other meshes (except ground and itself)
    this.meshMap.forEach((otherMesh, otherId) => {
      if (otherId !== meshId && otherId !== 'ground' && !hasCollision) {
        if (mesh.intersectsMesh(otherMesh, true)) {
          hasCollision = true
          console.log(`🚫 Transform collision detected between ${meshId} and ${otherId}`)
        }
      }
    })
    
    // Restore original transform
    mesh.position = originalPosition
    mesh.rotation = originalRotation
    mesh.scaling = originalScale
    mesh.computeWorldMatrix(true)
    
    return hasCollision
  }

  public createVisualGrid(enabled: boolean, gridSize: number): void {
    // Remove existing grid
    if (this.gridMesh) {
      this.gridMesh.dispose()
      this.gridMesh = null
    }
    
    if (!enabled || !this.scene) return
    
    // Create grid lines
    const gridExtent = 20
    const lines = []
    
    // Vertical lines (along Z-axis)
    for (let i = -gridExtent; i <= gridExtent; i += gridSize) {
      lines.push([
        new Vector3(i, 0, -gridExtent),
        new Vector3(i, 0, gridExtent)
      ])
    }
    
    // Horizontal lines (along X-axis)
    for (let i = -gridExtent; i <= gridExtent; i += gridSize) {
      lines.push([
        new Vector3(-gridExtent, 0, i),
        new Vector3(gridExtent, 0, i)
      ])
    }
    
    // Create line system
    const lineSystem = MeshBuilder.CreateLineSystem('grid', { lines }, this.scene)
    lineSystem.color = new Color3(0.5, 0.5, 0.5)
    lineSystem.alpha = 0.3
    lineSystem.isPickable = false
    
    this.gridMesh = lineSystem
  }

  public createMultiSelectPivot(centerPosition: Vector3): Mesh | null {
    if (!this.scene) return null
    
    // Remove existing pivot
    if (this.multiSelectPivot) {
      this.multiSelectPivot.dispose()
      this.multiSelectPivot = null
    }
    
    // Create invisible pivot mesh
    const pivot = MeshBuilder.CreateSphere('multi-select-pivot', { diameter: 0.1 }, this.scene)
    pivot.position = centerPosition
    pivot.rotation = new Vector3(0, 0, 0)
    pivot.scaling = new Vector3(1, 1, 1)
    pivot.isVisible = false
    pivot.isPickable = false
    
    this.multiSelectPivot = pivot
    return pivot
  }

  public removeMultiSelectPivot(): void {
    if (this.multiSelectPivot) {
      this.multiSelectPivot.dispose()
      this.multiSelectPivot = null
    }
  }

  public setCameraView(view: 'front' | 'back' | 'left' | 'right' | 'top' | 'bottom' | 'home'): void {
    if (!this.camera) return
    
    const camera = this.camera
    const radius = camera.radius
    
    switch (view) {
      case 'front':
        camera.setTarget(Vector3.Zero())
        camera.setPosition(new Vector3(0, 0, radius))
        break
      case 'back':
        camera.setTarget(Vector3.Zero())
        camera.setPosition(new Vector3(0, 0, -radius))
        break
      case 'left':
        camera.setTarget(Vector3.Zero())
        camera.setPosition(new Vector3(-radius, 0, 0))
        break
      case 'right':
        camera.setTarget(Vector3.Zero())
        camera.setPosition(new Vector3(radius, 0, 0))
        break
      case 'top':
        camera.setTarget(Vector3.Zero())
        camera.setPosition(new Vector3(0, radius, 0))
        break
      case 'bottom':
        camera.setTarget(Vector3.Zero())
        camera.setPosition(new Vector3(0, -radius, 0))
        break
      case 'home':
        camera.setTarget(Vector3.Zero())
        camera.setPosition(new Vector3(10, 10, 10))
        break
    }
  }

  public focusOnPosition(position: Vector3): void {
    if (this.camera) {
      this.camera.setTarget(position)
    }
  }

  public setupGizmos(
    transformMode: TransformMode,
    targetMesh: Mesh | null,
    onDragEnd: (position: Vector3, rotation: Vector3, scale: Vector3) => void
  ): void {
    if (!this.gizmoManager) return
    
    // Clean up existing observers
    this.cleanupGizmoObservers()
    
    // Detach from any previous mesh and disable all gizmos
    this.gizmoManager.attachToMesh(null)
    this.gizmoManager.positionGizmoEnabled = false
    this.gizmoManager.rotationGizmoEnabled = false
    this.gizmoManager.scaleGizmoEnabled = false
    this.gizmoManager.boundingBoxGizmoEnabled = false
    
    if (!targetMesh) return
    
    // Attach to target mesh
    this.gizmoManager.attachToMesh(targetMesh)
    
    // Enable the correct gizmo based on transform mode
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
    
    // Set up observers
    this.setupGizmoObservers(onDragEnd)
  }

  private gizmoObservers: any[] = []

  private setupGizmoObservers(onDragEnd: (position: Vector3, rotation: Vector3, scale: Vector3) => void): void {
    if (!this.gizmoManager) return
    
    const { positionGizmo, rotationGizmo, scaleGizmo } = this.gizmoManager.gizmos
    
    if (positionGizmo) {
      const observer = positionGizmo.onDragEndObservable.add(() => {
        const attachedMesh = this.gizmoManager?.attachedMesh
        if (attachedMesh) {
          onDragEnd(attachedMesh.position, attachedMesh.rotation, attachedMesh.scaling)
        }
      })
      this.gizmoObservers.push({ gizmo: positionGizmo, observer })
    }
    
    if (rotationGizmo) {
      const observer = rotationGizmo.onDragEndObservable.add(() => {
        const attachedMesh = this.gizmoManager?.attachedMesh
        if (attachedMesh) {
          onDragEnd(attachedMesh.position, attachedMesh.rotation, attachedMesh.scaling)
        }
      })
      this.gizmoObservers.push({ gizmo: rotationGizmo, observer })
    }
    
    if (scaleGizmo) {
      const observer = scaleGizmo.onDragEndObservable.add(() => {
        const attachedMesh = this.gizmoManager?.attachedMesh
        if (attachedMesh) {
          onDragEnd(attachedMesh.position, attachedMesh.rotation, attachedMesh.scaling)
        }
      })
      this.gizmoObservers.push({ gizmo: scaleGizmo, observer })
    }
  }

  private cleanupGizmoObservers(): void {
    this.gizmoObservers.forEach(({ gizmo, observer }) => {
      gizmo.onDragEndObservable.remove(observer)
    })
    this.gizmoObservers = []
  }

  // Direct object selection handling (removed - now handled in React hooks)

  public setObjectClickCallback(callback: (pickInfo: PickingInfo, isCtrlHeld: boolean) => void): void {
    console.log('🔗 SceneManager: Setting object click callback')
    this.onObjectClickCallback = callback
    console.log('🔗 SceneManager: Callback set, type:', typeof callback)
  }

  public setObjectHoverCallback(callback: (pickInfo: PickingInfo) => void): void {
    console.log('🔗 SceneManager: Setting object hover callback')
    this.onObjectHoverCallback = callback
  }

  public snapToGrid(position: Vector3, gridSize: number): Vector3 {
    return new Vector3(
      Math.round(position.x / gridSize) * gridSize,
      Math.round(position.y / gridSize) * gridSize,
      Math.round(position.z / gridSize) * gridSize
    )
  }

  public getScene(): Scene | null {
    return this.scene
  }

  public dispose(): void {
    this.cleanupGizmoObservers()
    
    if (this.gridMesh) {
      this.gridMesh.dispose()
      this.gridMesh = null
    }
    
    if (this.multiSelectPivot) {
      this.multiSelectPivot.dispose()
      this.multiSelectPivot = null
    }
    
    this.meshMap.clear()
    
    if (this.engine) {
      this.engine.dispose()
      this.engine = null
    }
    
    this.scene = null
    this.camera = null
    this.gizmoManager = null
  }
}
