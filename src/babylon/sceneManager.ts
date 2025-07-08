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
    if (!this.scene) return
    
    console.log('🖱️ SceneManager: Setting up pointer events')
    
    this.scene.onPointerObservable.add((pointerInfo) => {
      switch (pointerInfo.type) {
        case PointerEventTypes.POINTERDOWN:
          this.pointerDownPosition = { x: this.scene!.pointerX, y: this.scene!.pointerY }
          console.log('🖱️ POINTERDOWN at:', this.pointerDownPosition)
          break
        
        case PointerEventTypes.POINTERUP:
          if (this.pointerDownPosition) {
            const deltaX = Math.abs(this.pointerDownPosition.x - this.scene!.pointerX)
            const deltaY = Math.abs(this.pointerDownPosition.y - this.scene!.pointerY)
            const clickThreshold = 5
            
            console.log('🖱️ POINTERUP delta:', { deltaX, deltaY, threshold: clickThreshold })
            
            if (deltaX < clickThreshold && deltaY < clickThreshold) {
              // It's a click, not a drag. Use the pick info from the pointer event.
              const pickInfo = pointerInfo.pickInfo
              const isGizmoClick = pickInfo?.pickedMesh?.name?.toLowerCase().includes('gizmo')
              
              console.log('🖱️ Click detected:', {
                hit: pickInfo?.hit,
                pickedMesh: pickInfo?.pickedMesh?.name,
                isGizmoClick,
                hasCallback: !!this.onObjectClickCallback
              })
              
              if (!isGizmoClick && pickInfo && this.onObjectClickCallback) {
                const isCtrlHeld = (pointerInfo.event as PointerEvent).ctrlKey || (pointerInfo.event as PointerEvent).metaKey;
                console.log('🖱️ Calling click callback with:', {
                  meshName: pickInfo.pickedMesh?.name,
                  isCtrlHeld
                })
                this.onObjectClickCallback(pickInfo, isCtrlHeld)
              }
            }
          }
          this.pointerDownPosition = null
          break
          
        case PointerEventTypes.POINTERMOVE:
          const pickInfo = pointerInfo.pickInfo
          if (pickInfo && this.onObjectHoverCallback) {
            // Don't log hover events as they're too frequent
            this.onObjectHoverCallback(pickInfo)
          }
          break
      }
    })
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
          position: sceneObject.position,
          scale: sceneObject.scale,
          rotation: sceneObject.rotation,
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
      
      // Set initial properties (only for non-housing types, as housing meshes set their own properties)
      if (!sceneObject.type.startsWith('house-')) {
        mesh.position = sceneObject.position.clone()
        mesh.rotation = sceneObject.rotation.clone()
        mesh.scaling = sceneObject.scale.clone()
        
        // Create material
        const material = new StandardMaterial(`${sceneObject.id}-material`, this.scene)
        material.diffuseColor = Color3.FromHexString(sceneObject.color)
        mesh.material = material
      }
      
      // Ensure the mesh ID is set to our object ID for reliable picking
      mesh.id = sceneObject.id
      
      mesh.isPickable = true
      mesh.checkCollisions = false
      
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
    return this.meshMap.get(id) || null
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

  public setObjectClickCallback(callback: (pickInfo: PickingInfo, isCtrlHeld: boolean) => void): void {
    console.log('🔗 SceneManager: Setting object click callback')
    this.onObjectClickCallback = callback
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
