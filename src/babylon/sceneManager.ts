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
  PickingInfo,
  Matrix,
  Quaternion,
  Texture,
  SceneLoader
} from 'babylonjs'
import type { SceneObject, PrimitiveType, TransformMode, ConnectionPoint, TextureAsset, TextureType } from '../types/types'
import { createHousingMesh } from './housingFactory'
import { TextureManager } from './textureManager'
import { createFullGridTexture, calculateFullGridUVScale } from './gridTextureUtils'
import { MovementController } from './movementController'
import { useSceneStore } from '../state/sceneStore'
import { findClosestPointOnPolygon } from './roomPhysicsUtils'


export class SceneManager {
  private engine: Engine | null = null
  private scene: Scene | null = null
  private camera: ArcRotateCamera | null = null
  private gizmoManager: GizmoManager | null = null
  private meshMap: Map<string, Mesh> = new Map()
  private gridMesh: Mesh | null = null
  private multiSelectPivot: Mesh | null = null
  private pointerDownPosition: { x: number, y: number } | null = null
  private collisionDetectionEnabled: boolean = false
  private textureManager: TextureManager | null = null
  private movementController: MovementController | null = null
  
  // Event callbacks
  private onObjectClickCallback?: (pickInfo: PickingInfo, isCtrlHeld: boolean) => void
  private onObjectHoverCallback?: (pickInfo: PickingInfo) => void
  private onMoveToCallback?: (position: Vector3) => void
  private getTextureAssetCallback?: (textureId: string) => TextureAsset | undefined

  private isMoveToMode: boolean = false
  private moveTargetLine: Mesh | null = null

  constructor() {
    // Initialize empty - call initialize() after construction
  }

  public initialize(canvas: HTMLCanvasElement): boolean {
    try {
      console.log('🚀 Initializing Babylon.js scene...')
      
      // Create engine and scene
      this.engine = new Engine(canvas, true)
      this.scene = new Scene(this.engine)
      
      // Initialize texture manager
      this.textureManager = new TextureManager(this.scene)
      
      // Enable collision detection by default
      this.scene.collisionsEnabled = this.collisionDetectionEnabled
      
      // Create camera
      this.camera = new ArcRotateCamera('camera', -Math.PI / 2, Math.PI / 2.5, 10, Vector3.Zero(), this.scene)
      this.camera.attachControl(canvas, true)
      
      // Create movement controller
      this.movementController = new MovementController(this.scene, this.camera, this.engine)
      
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
      const ground = MeshBuilder.CreateGround('ground', {width: 20, height: 20}, this.scene);
      ground.isPickable = true;
      const groundMaterial = new StandardMaterial('groundMaterial', this.scene);
      groundMaterial.diffuseColor = Color3.FromHexString('#808080'); // Gray
      groundMaterial.alpha = 0; // Make ground invisible
      ground.material = groundMaterial;
      this.meshMap.set('ground', ground);
      
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



  private setupPointerEvents(): void {
    if (!this.scene) return;

    this.scene.onPointerObservable.add((pointerInfo) => {
      switch (pointerInfo.type) {
        case PointerEventTypes.POINTERDOWN: {
          // Record initial pointer location for click-vs-drag test
          this.pointerDownPosition = { x: this.scene!.pointerX, y: this.scene!.pointerY };
          if (this.isMoveToMode) {
            // Prevent camera attachment while in move-to mode drag
            this.camera?.detachControl();
          }
          break;
        }
        case PointerEventTypes.POINTERUP: {
          if (this.isMoveToMode) {
            const pickInfo = this.scene?.pick(this.scene.pointerX, this.scene.pointerY, (mesh) => mesh.id === 'ground' || mesh.id.endsWith('-floor'));
            if (pickInfo?.hit && pickInfo.pickedPoint) {
              this.onMoveToCallback?.(pickInfo.pickedPoint);
            }
            // Re-attach camera control
            if (this.engine) {
              this.camera?.attachControl(this.engine.getRenderingCanvas() as HTMLCanvasElement, true);
            }
            if (this.moveTargetLine) {
              this.moveTargetLine.dispose();
              this.moveTargetLine = null;
            }
          } else {
            // Treat as a click only if pointer hasn't moved too far
            const clickThreshold = 5; // pixels
            if (this.pointerDownPosition) {
              const deltaX = Math.abs(this.pointerDownPosition.x - this.scene!.pointerX);
              const deltaY = Math.abs(this.pointerDownPosition.y - this.scene!.pointerY);

              if (deltaX < clickThreshold && deltaY < clickThreshold) {
                const pickInfo = pointerInfo.pickInfo ?? this.scene?.pick(this.scene.pointerX, this.scene.pointerY);
                const isGizmoClick = pickInfo?.pickedMesh?.name?.toLowerCase().includes('gizmo');

                if (pickInfo && pickInfo.hit && !isGizmoClick) {
                  const isCtrlHeld = (pointerInfo.event as PointerEvent).ctrlKey || (pointerInfo.event as PointerEvent).metaKey;
                  this.onObjectClickCallback?.(pickInfo, isCtrlHeld);
                } else if (!pickInfo?.hit) {
                  // Clicked empty space – still notify for deselection logic
                  this.onObjectClickCallback?.(pickInfo as any, false);
                }
              }
            }
          }
          // reset tracker
          this.pointerDownPosition = null;
          break;
        }
        case PointerEventTypes.POINTERMOVE: {
          if (this.isMoveToMode && this.pointerDownPosition) {
            if (!this.scene) break;
            const pickInfo = this.scene.pick(this.scene.pointerX, this.scene.pointerY, (mesh) => mesh.id === 'ground' || mesh.id.endsWith('-floor'));
            if (pickInfo?.hit && pickInfo.pickedPoint) {
              const selectedObjectId = useSceneStore.getState().selectedObjectId;
              const selectedObject = selectedObjectId ? this.meshMap.get(selectedObjectId) : null;
              
              if (selectedObject) {
                if (this.moveTargetLine) {
                  this.moveTargetLine.dispose();
                }
                const lineMaterial = new StandardMaterial("move-target-line-material", this.scene);
                lineMaterial.diffuseColor = Color3.Green();

                this.moveTargetLine = MeshBuilder.CreateLines("move-target-line", {
                  points: [selectedObject.position, pickInfo.pickedPoint],
                  updatable: true
                });
                this.moveTargetLine.material = lineMaterial;
              }
            }
          } else if (this.onObjectHoverCallback) {
            // Object hover logic should not run during a move-to drag
            const pickInfo = this.scene?.pick(this.scene.pointerX, this.scene.pointerY);
            if (pickInfo) {
              this.onObjectHoverCallback(pickInfo);
            }
          }
          break;
        }
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
          case 'ground': {
            const groundMesh = this.meshMap.get('ground');
            if (groundMesh) {
              // Ground mesh already exists from initialization, just update it
              groundMesh.name = sceneObject.id; // ensure name is consistent
              this.meshMap.set(sceneObject.id, groundMesh); // ensure it's in the map with the correct ID
              this.updateMeshProperties(sceneObject.id, sceneObject);
            } else {
              // This case should not happen if initialize is called correctly
              console.error("Ground mesh not found during addMesh. It should be created on initialization.");
            }
            return true;
          }
          case 'imported-glb':
          case 'imported-stl':
          case 'imported-obj':
            // For imported models, we need to retrieve the mesh from scene by ID
            // The mesh should already be in the scene from the import process
            const importedMesh = this.scene.getMeshById(sceneObject.id)
            if (!importedMesh || !(importedMesh instanceof Mesh)) {
              console.error(`❌ Imported mesh ${sceneObject.id} not found in scene`)
              return false
            }
            mesh = importedMesh
            break
          case 'custom-room':
            // Custom rooms are generated procedurally outside the factory (e.g., via cloning)
            // Simply look up an existing mesh with the same ID that should have been
            // added via addPreExistingMesh. If it exists, register it; otherwise warn.
            const roomMesh = this.scene.getMeshById(sceneObject.id)
            if (!roomMesh || !(roomMesh instanceof Mesh)) {
              console.error(`❌ Custom room mesh ${sceneObject.id} not found in scene`)
              return false
            }
            mesh = roomMesh
            break
          default:
            // Fallback for unknown types: try to load as a GLB model
            console.log(`[SceneManager] Type "${sceneObject.type}" not a primitive, attempting to load as GLB model...`)
            
            // Construct the URL to the GLB file.
            // This assumes a flat structure in the HOUSE_ITEMS directory for now.
            const modelUrl = `/objectLib/HOUSE_ITEMS/${sceneObject.type}.glb`;

            SceneLoader.ImportMesh(
              "", // Load all meshes from the file
              modelUrl,
              "",
              this.scene,
              (meshes) => {
                if (meshes.length > 0) {
                  const rootMesh = meshes[0] as Mesh;
                  
                  // Assign the object's ID and name to the root mesh for consistency
                  rootMesh.id = sceneObject.id;
                  rootMesh.name = sceneObject.id;

                  // Apply initial transformations from the sceneObject
                  rootMesh.position = sceneObject.position.clone();
                  rootMesh.rotation = sceneObject.rotation.clone();
                  rootMesh.scaling = sceneObject.scale.clone();
                  
                  // Make it pickable and handle collisions
                  rootMesh.isPickable = true;
                  rootMesh.checkCollisions = this.collisionDetectionEnabled;

                  // Add all child meshes to be pickable as well
                  rootMesh.getChildMeshes().forEach(child => {
                    child.isPickable = true;
                  });

                  // Store the root mesh in the map
                  this.meshMap.set(sceneObject.id, rootMesh);
                  
                  console.log(`✅ Successfully loaded and added GLB model: ${sceneObject.id}`);
                }
              },
              null,
              (scene, message, exception) => {
                console.error(`❌ Failed to load GLB model ${sceneObject.type} from ${modelUrl}:`, message, exception);
              }
            );
            
            // Return true to indicate we've started the loading process
            return true;
        }
      }
      
      // Generate default connection points (face centers) for box-like meshes
      const bounding = mesh.getBoundingInfo()
      if (bounding) {
        const min = bounding.minimum.clone()
        const max = bounding.maximum.clone()
        const halfX = (max.x - min.x) / 2
        const halfY = (max.y - min.y) / 2
        const halfZ = (max.z - min.z) / 2
        const cps: ConnectionPoint[] = [
          { id: 'px', position: new Vector3(halfX, 0, 0), normal: new Vector3(1, 0, 0) },
          { id: 'nx', position: new Vector3(-halfX, 0, 0), normal: new Vector3(-1, 0, 0) },
          { id: 'py', position: new Vector3(0, halfY, 0), normal: new Vector3(0, 1, 0) },
          { id: 'ny', position: new Vector3(0, -halfY, 0), normal: new Vector3(0, -1, 0) },
          { id: 'pz', position: new Vector3(0, 0, halfZ), normal: new Vector3(0, 0, 1) },
          { id: 'nz', position: new Vector3(0, 0, -halfZ), normal: new Vector3(0, 0, -1) },
        ]
        if (!mesh.metadata) mesh.metadata = {}
        ;(mesh.metadata as any).connectionPoints = cps
      }

      // Set initial properties
      mesh.position = sceneObject.position.clone()
      mesh.rotation = sceneObject.rotation.clone()
      mesh.scaling = sceneObject.scale.clone()
      
      // Ensure the mesh ID and name are set to our object ID for reliable picking
      mesh.id = sceneObject.id
      mesh.name = sceneObject.id
      
      // Create material (for non-housing types or if housing mesh doesn't have material)
      if (!sceneObject.type.startsWith('house-') && !sceneObject.type.startsWith('imported-') || !mesh.material) {
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
        if (mesh.rotationQuaternion) {
          // Keep quaternion in sync with requested Euler to satisfy gizmo / bounding-box expectations
          const newQuat = Quaternion.RotationYawPitchRoll(
            sceneObject.rotation.y,
            sceneObject.rotation.x,
            sceneObject.rotation.z
          )
          mesh.rotationQuaternion.copyFrom(newQuat)
          // Also store Euler (helps when gizmos are detached later)
          mesh.rotation.copyFrom(sceneObject.rotation)
          console.log(`🔄 SceneManager: Updated rotationQuaternion for mesh ${id}`)
        } else {
          mesh.rotation.copyFrom(sceneObject.rotation)
        }
        console.log(`🔄 SceneManager: Applied rotation to mesh ${id}: (${sceneObject.rotation.x.toFixed(3)}, ${sceneObject.rotation.y.toFixed(3)}, ${sceneObject.rotation.z.toFixed(3)})`)
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
      
      // Handle texture updates
      if ('textureIds' in sceneObject && this.textureManager && mesh.material) {
        console.log('🎨 Texture update detected:', {
          meshId: id,
          textureIds: sceneObject.textureIds,
          hasMaterial: !!mesh.material,
          materialType: mesh.material.constructor.name
        });
        
        // If textureIds is empty, null, or undefined, remove all textures
        if (!sceneObject.textureIds || Object.keys(sceneObject.textureIds).length === 0) {
          const material = mesh.material as StandardMaterial;
          console.log('🗑️ Removing all textures from mesh:', id);
          // Remove all textures
          material.diffuseTexture = null;
          material.bumpTexture = null;
          material.specularTexture = null;
          material.emissiveTexture = null;
          
          // Restore the original diffuse color from the scene object
          // The color should be passed in the update when textures are removed
          if (sceneObject.color) {
            console.log('🎨 Restoring original color:', sceneObject.color);
            material.diffuseColor = Color3.FromHexString(sceneObject.color);
          }
        } else {
          // Apply each texture type
          for (const [textureType, textureId] of Object.entries(sceneObject.textureIds)) {
            console.log(`🖼️ Applying ${textureType} texture:`, textureId);
            const textureAsset = this.getTextureAssetCallback?.(textureId);
            console.log('📦 Texture asset retrieved:', textureAsset);
            
            if (textureAsset) {
              // Create or get cached texture
              const texture = this.textureManager.createBabylonTexture(textureAsset);
              console.log('✨ Babylon texture created:', {
                name: texture.name,
                url: texture.url,
                hasTexture: !!texture
              });
              
              // Apply texture based on type
              const material = mesh.material as StandardMaterial;
              switch (textureType) {
                case 'diffuse':
                  console.log('🎨 Applying diffuse texture');
                  this.textureManager.applyDiffuseTexture(material, texture);
                  // Ensure the texture is visible by setting diffuse color to white
                  // This allows the texture to show properly without color tinting
                  material.diffuseColor = new Color3(1, 1, 1);
                  break;
                case 'normal':
                  console.log('🏔️ Applying normal/bump texture');
                  this.textureManager.applyNormalTexture(material, texture);
                  break;
                case 'specular':
                  console.log('✨ Applying specular texture');
                  this.textureManager.applySpecularTexture(material, texture);
                  break;
                case 'emissive':
                  console.log('💡 Applying emissive texture');
                  this.textureManager.applyEmissiveTexture(material, texture);
                  break;
              }
              
              // Apply scale and offset if they exist
              if (sceneObject.textureScale) {
                this.textureManager.setTextureScale(texture, sceneObject.textureScale);
              }
              if (sceneObject.textureOffset) {
                this.textureManager.setTextureOffset(texture, sceneObject.textureOffset);
              }
              
              console.log('✅ Texture applied successfully');
            } else {
              console.error('❌ Failed to retrieve texture asset for:', textureId);
            }
          }
        }
      }
      
      // Handle texture scale for existing textures
      if (sceneObject.textureScale && mesh.material instanceof StandardMaterial && this.textureManager) {
        const material = mesh.material;
        if (material.diffuseTexture) {
          this.textureManager.setTextureScale(material.diffuseTexture as Texture, sceneObject.textureScale);
        }
        if (material.bumpTexture) {
          this.textureManager.setTextureScale(material.bumpTexture as Texture, sceneObject.textureScale);
        }
        if (material.specularTexture) {
          this.textureManager.setTextureScale(material.specularTexture as Texture, sceneObject.textureScale);
        }
        if (material.emissiveTexture) {
          this.textureManager.setTextureScale(material.emissiveTexture as Texture, sceneObject.textureScale);
        }
      }
      
      // Handle texture offset for existing textures
      if (sceneObject.textureOffset && mesh.material instanceof StandardMaterial && this.textureManager) {
        const material = mesh.material;
        if (material.diffuseTexture) {
          this.textureManager.setTextureOffset(material.diffuseTexture as Texture, sceneObject.textureOffset);
        }
        if (material.bumpTexture) {
          this.textureManager.setTextureOffset(material.bumpTexture as Texture, sceneObject.textureOffset);
        }
        if (material.specularTexture) {
          this.textureManager.setTextureOffset(material.specularTexture as Texture, sceneObject.textureOffset);
        }
        if (material.emissiveTexture) {
          this.textureManager.setTextureOffset(material.emissiveTexture as Texture, sceneObject.textureOffset);
        }
      }
      
      // Handle grid info updates for custom rooms
      if ('gridInfo' in sceneObject && sceneObject.gridInfo && mesh.metadata) {
        // Update metadata
        (mesh.metadata as any).gridInfo = sceneObject.gridInfo
        
        // If this is a custom room, update the floor texture
        if (mesh.id.includes('custom-room')) {
          console.log('🔲 Updating grid texture for custom room:', id)
          
          // Find the floor mesh (it's a child of the root mesh)
          const floorMesh = mesh.getChildMeshes().find(child => child.name.includes('-floor'))
          if (floorMesh && floorMesh.material && floorMesh.material instanceof StandardMaterial && this.scene) {
            const floorBounds = floorMesh.getBoundingInfo()
            if (floorBounds) {
              const floorWidth = floorBounds.maximum.x - floorBounds.minimum.x
              const floorDepth = floorBounds.maximum.z - floorBounds.minimum.z
              
              // Create new grid texture with updated settings
              const gridTexture = createFullGridTexture(
                this.scene,
                sceneObject.gridInfo.gridSize,
                sceneObject.gridInfo.drawingBounds?.width || 400,
                sceneObject.gridInfo.drawingBounds?.height || 400,
                1024,
                {
                  lineColor: sceneObject.gridInfo.lineColor || '#e0e0e0',
                  backgroundColor: '#A0522D',
                  lineWidth: 2,
                  opacity: 1,
                  showSubGrid: sceneObject.gridInfo.showSubGrid !== false,
                  subGridDivisions: 4
                }
              )
              
              // Calculate UV scale
              const uvScale = calculateFullGridUVScale(
                floorWidth,
                floorDepth,
                sceneObject.gridInfo.drawingBounds?.width || 400,
                sceneObject.gridInfo.drawingBounds?.height || 400,
                sceneObject.gridInfo.worldScale
              )
              
              gridTexture.uScale = uvScale.u
              gridTexture.vScale = uvScale.v
              
              // Apply the texture
              const material = floorMesh.material as StandardMaterial
              if (material.diffuseTexture) {
                material.diffuseTexture.dispose()
              }
              
              if (sceneObject.gridInfo.visible !== false) {
                material.diffuseTexture = gridTexture
                material.specularColor = new Color3(0.1, 0.1, 0.1)
              } else {
                // If grid is hidden, just show solid color
                material.diffuseTexture = null
                material.diffuseColor = Color3.FromHexString('#A0522D')
              }
              
              console.log('✅ Grid texture updated successfully')
            }
          }
        }
      }
      
      // Update position if provided
      if (sceneObject.position) {
        mesh.position = sceneObject.position.clone()
        
        // Safety check: ensure object doesn't sink below floor
        mesh.computeWorldMatrix(true)
        const boundingInfo = mesh.getBoundingInfo()
        const lowestY = boundingInfo.boundingBox.minimumWorld.y
        
        if (lowestY < 0) {
          // Adjust position to keep object on floor
          mesh.position.y -= lowestY
          console.log(`⚠️ Adjusted ${id} position to prevent sinking below floor by ${-lowestY.toFixed(3)} units`)
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

  /**
   * Adds a pre-existing mesh to the scene manager
   * Used for imported meshes that are already created (like from GLB import)
   */
  public addPreExistingMesh(mesh: Mesh, id: string): boolean {
    if (!this.scene || !mesh) return false
    
    try {
      // Ensure the mesh is part of this scene
      if (mesh.getScene() !== this.scene) {
        console.error(`❌ Mesh ${id} is not part of the current scene`)
        return false
      }
      
      // Set mesh properties for proper management
      mesh.id = id
      mesh.name = id
      mesh.isPickable = true
      mesh.checkCollisions = this.collisionDetectionEnabled
      
      // Store mesh reference
      this.meshMap.set(id, mesh)
      
      console.log(`✅ Added pre-existing mesh: ${id}`, {
        meshName: mesh.name,
        meshId: mesh.id,
        isPickable: mesh.isPickable,
        hasMap: this.meshMap.has(id)
      })
      
      return true
    } catch (error) {
      console.error(`❌ Error adding pre-existing mesh ${id}:`, error)
      return false
    }
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

  public setTextureAssetCallback(callback: (textureId: string) => TextureAsset | undefined): void {
    console.log('🔗 SceneManager: Setting texture asset callback')
    this.getTextureAssetCallback = callback
  }

  public snapToGrid(position: Vector3, gridSize: number): Vector3 {
    return new Vector3(
      Math.round(position.x / gridSize) * gridSize,
      Math.round(position.y / gridSize) * gridSize,
      Math.round(position.z / gridSize) * gridSize
    )
  }

  /**
   * Aligns the closest compatible connection-point pair and returns adjusted position & rotation.
   */
  public computeSnapTransform(
    meshId: string,
    desiredPosition: Vector3,
    desiredRotation: Vector3
  ): { position: Vector3; rotation: Vector3 } {
    const movingMesh = this.meshMap.get(meshId)
    if (!movingMesh) return { position: desiredPosition.clone(), rotation: desiredRotation.clone() }

    const movingCPs = ((movingMesh.metadata as any)?.connectionPoints || []) as ConnectionPoint[]
    if (!movingCPs.length) return { position: desiredPosition.clone(), rotation: desiredRotation.clone() }

    // Convert desiredRotation Euler -> Quaternion and matrix
    const desiredQuat = Quaternion.RotationYawPitchRoll(
      desiredRotation.y,
      desiredRotation.x,
      desiredRotation.z
    )
    const rotMatrixMoving = Matrix.Identity()
    desiredQuat.toRotationMatrix(rotMatrixMoving)

    const scaled = (v: Vector3, s: Vector3) => new Vector3(v.x * s.x, v.y * s.y, v.z * s.z)

    const SNAP_DISTANCE = 0.3
    let best: {
      delta: Vector3
      newQuat: Quaternion
      dist: number
    } | null = null

    const quatFromUnitVectors = (vFrom: Vector3, vTo: Vector3): Quaternion => {
      const EPS = 1e-6
      let r = vFrom.dot(vTo) + 1
      let q: Quaternion
      if (r < EPS) {
        // 180° rotation, pick orthogonal axis
        let axis = Math.abs(vFrom.x) > Math.abs(vFrom.z)
          ? new Vector3(-vFrom.y, vFrom.x, 0)
          : new Vector3(0, -vFrom.z, vFrom.y)
        axis.normalize()
        q = new Quaternion(axis.x, axis.y, axis.z, 0)
      } else {
        const axis = vFrom.cross(vTo)
        q = new Quaternion(axis.x, axis.y, axis.z, r)
        q.normalize()
      }
      return q
    }

    for (const [otherId, otherMesh] of this.meshMap.entries()) {
      if (otherId === meshId) continue
      const otherCPs = ((otherMesh.metadata as any)?.connectionPoints || []) as ConnectionPoint[]
      if (!otherCPs.length) continue

      const otherQuat = otherMesh.rotationQuaternion ?? Quaternion.RotationYawPitchRoll(
        otherMesh.rotation.y,
        otherMesh.rotation.x,
        otherMesh.rotation.z
      )
      const rotMatrixOther = Matrix.Identity()
      otherQuat.toRotationMatrix(rotMatrixOther)

      for (const cpMoving of movingCPs) {
        // moving point/normal in world after desired transform
        const worldPosMoving = Vector3.TransformCoordinates(
          scaled(cpMoving.position, movingMesh.scaling),
          rotMatrixMoving
        ).add(desiredPosition)
        const worldNormalMoving = Vector3.TransformNormal(cpMoving.normal, rotMatrixMoving).normalize()

        for (const cpOther of otherCPs) {
          const worldPosOther = Vector3.TransformCoordinates(
            scaled(cpOther.position, otherMesh.scaling),
            rotMatrixOther
          ).add(otherMesh.position)
          const worldNormalOther = Vector3.TransformNormal(cpOther.normal, rotMatrixOther).normalize()

          const dist = Vector3.Distance(worldPosMoving, worldPosOther)
          if (dist > SNAP_DISTANCE) continue

          const dot = worldNormalMoving.dot(worldNormalOther)
          const isOpposite = dot < -0.95
          const isPerp = Math.abs(dot) < 0.05
          if (!isOpposite && !isPerp) continue

          // Alignment quaternion: rotate moving normal to -otherNormal
          const alignQuat = quatFromUnitVectors(worldNormalMoving, worldNormalOther.scale(-1))
          const newQuat = alignQuat.multiply(desiredQuat)

          // Recompute moving connection point world position after rotation
          const newRotMatrix = Matrix.Identity()
          newQuat.toRotationMatrix(newRotMatrix)
          const newWorldPosMoving = Vector3.TransformCoordinates(
            scaled(cpMoving.position, movingMesh.scaling),
            newRotMatrix
          ).add(desiredPosition)

          const delta = worldPosOther.subtract(newWorldPosMoving)

          const score = dist // simple; could combine angle
          if (!best || score < best.dist) {
            best = { delta, newQuat, dist: score }
          }
        }
      }
    }

    if (best) {
      const finalPos = desiredPosition.add(best.delta)
      const finalRot = best.newQuat.toEulerAngles()
      return { position: finalPos, rotation: finalRot }
    }

    return { position: desiredPosition.clone(), rotation: desiredRotation.clone() }
  }
  // (OPTIONAL) keep old method for backward compatibility
  public computeSnapPosition(meshId: string, pos: Vector3, rot: Vector3): Vector3 {
    return this.computeSnapTransform(meshId, pos, rot).position
  }

  public getScene(): Scene | null {
    return this.scene
  }

  private connectionPointDebugMeshes: Mesh[] = []

  public visualizeConnectionPoints(enabled: boolean): void {
    if (!this.scene) return

    // Clear previous
    this.connectionPointDebugMeshes.forEach(m => m.dispose())
    this.connectionPointDebugMeshes = []

    if (!enabled) return

    const sphereMat = new StandardMaterial('cp-debug-mat', this.scene)
    sphereMat.diffuseColor = new Color3(1, 0, 1) // magenta

    this.meshMap.forEach(mesh => {
      const cps = ((mesh.metadata as any)?.connectionPoints || []) as ConnectionPoint[]
      if (!cps.length) return
      const rotMatrix = Matrix.RotationYawPitchRoll(mesh.rotation.y, mesh.rotation.x, mesh.rotation.z)
      cps.forEach(cp => {
        const s = MeshBuilder.CreateSphere('cp-debug', { diameter: 0.1 }, this.scene!)
        s.material = sphereMat
        s.isPickable = false
        // Position sphere in local space and parent to mesh so it tracks movement/rotation/scale
        s.position = cp.position.clone()
        s.parent = mesh
        this.connectionPointDebugMeshes.push(s)
      })
    })
  }

  // Movement controller methods
  public setMovementEnabled(enabled: boolean): void {
    if (this.movementController) {
      this.movementController.setEnabled(enabled)
    }
  }

  public setMovementSpeed(speed: number): void {
    if (this.movementController) {
      this.movementController.setMoveSpeed(speed)
    }
  }

  public getMovementSpeed(): number {
    return this.movementController?.getMoveSpeed() || 0.1
  }

  public getMovementEnabled(): boolean {
    return this.movementController?.getEnabled() || false
  }

  public setMoveToMode(enabled: boolean): void {
    this.isMoveToMode = enabled
    if (this.isMoveToMode) {
      // Enter move-to mode: disable gizmos
      if (this.gizmoManager) {
        this.gizmoManager.attachToMesh(null)
        this.gizmoManager.positionGizmoEnabled = false
        this.gizmoManager.rotationGizmoEnabled = false
        this.gizmoManager.scaleGizmoEnabled = false
        this.gizmoManager.boundingBoxGizmoEnabled = false
      }
    } else {
      // Exit move-to mode
      if (this.moveTargetLine) {
        this.moveTargetLine.dispose()
        this.moveTargetLine = null
      }
      if (this.engine && this.camera) {
        this.camera.attachControl(this.engine.getRenderingCanvas() as HTMLCanvasElement, true)
      }
    }
  }

  /**
   * Sets the callback function for when an object is moved via 'move to'
   */
  public setMoveToCallback(callback: (position: Vector3) => void): void {
    this.onMoveToCallback = callback
  }

  /**
   * Aligns a mesh to a specific edge or wall of another mesh/room
   */
  public alignMesh(movingMeshId: string, relativeToId: string, edge: 'north' | 'south' | 'east' | 'west' | 'nearest-wall', offset?: number): void {
    const movingMesh = this.meshMap.get(movingMeshId)
    if (!movingMesh) return

    let newPosition = movingMesh.position.clone()
    let newRotation = movingMesh.rotation.clone()

    if (edge === 'nearest-wall') {
      const room = this.meshMap.get(relativeToId)
      if (room && room.metadata?.floorPolygon) {
        const result = findClosestPointOnPolygon(
          { x: movingMesh.position.x, z: movingMesh.position.z }, 
          room.metadata.floorPolygon
        )
        if (result) {
          // Ensure mesh world matrix is up to date
          movingMesh.computeWorldMatrix(true)
          
          // Get object's bounding box in world space
          const boundingInfo = movingMesh.getBoundingInfo()
          const worldMin = boundingInfo.boundingBox.minimumWorld
          const worldMax = boundingInfo.boundingBox.maximumWorld
          
          // Calculate object dimensions
          const objectWidth = worldMax.x - worldMin.x
          const objectDepth = worldMax.z - worldMin.z
          
          // The distance from object center to its edge depends on wall normal direction
          let distanceToEdge: number
          if (Math.abs(result.normal.x) > Math.abs(result.normal.z)) {
            // Wall is primarily along X axis, use half width
            distanceToEdge = objectWidth / 2
          } else {
            // Wall is primarily along Z axis, use half depth
            distanceToEdge = objectDepth / 2
          }
          
          // Add wall thickness offset
          const wallThickness = 0.5 // Increased from 0.2 for better clearance
          const totalOffset = distanceToEdge + wallThickness + (offset || 0)
          
          // Position object away from wall by the calculated offset
          newPosition = result.position.clone()
          newPosition.y = movingMesh.position.y // Maintain current Y position
          newPosition.addInPlace(result.normal.scale(totalOffset))
          
          // Rotate object to face away from the wall (back against wall)
          const angle = Math.atan2(result.normal.x, result.normal.z)
          newRotation = new Vector3(0, angle + Math.PI, 0)
        }
      }
    } else {
      const relativeToMesh = this.meshMap.get(relativeToId)
      if (!relativeToMesh) return

      const movingBounds = movingMesh.getBoundingInfo().boundingBox
      const movingHalfX = (movingBounds.maximumWorld.x - movingBounds.minimumWorld.x) / 2
      const movingHalfY = (movingBounds.maximumWorld.y - movingBounds.minimumWorld.y) / 2
      const movingHalfZ = (movingBounds.maximumWorld.z - movingBounds.minimumWorld.z) / 2

      const relativeBounds = relativeToMesh.getBoundingInfo().boundingBox

      switch (edge) {
        case 'north':
          newPosition.z = relativeBounds.maximumWorld.z + movingHalfZ + (offset || 0)
          newRotation.y = 0
          break
        case 'south':
          newPosition.z = relativeBounds.minimumWorld.z - movingHalfZ - (offset || 0)
          newRotation.y = Math.PI
          break
        case 'east':
          newPosition.x = relativeBounds.maximumWorld.x + movingHalfX + (offset || 0)
          newRotation.y = Math.PI / 2
          break
        case 'west':
          newPosition.x = relativeBounds.minimumWorld.x - movingHalfX - (offset || 0)
          newRotation.y = -Math.PI / 2
          break
      }
    }

    this.updateMeshProperties(movingMesh.id, { position: newPosition, rotation: newRotation })
  }

  public dispose(): void {
    this.cleanupGizmoObservers()
    // dispose debug spheres
    this.connectionPointDebugMeshes.forEach(m => m.dispose())
    this.connectionPointDebugMeshes = []
    
    if (this.gridMesh) {
      this.gridMesh.dispose()
      this.gridMesh = null
    }
    
    if (this.multiSelectPivot) {
      this.multiSelectPivot.dispose()
      this.multiSelectPivot = null
    }
    
    // Dispose movement controller
    if (this.movementController) {
      this.movementController.dispose()
      this.movementController = null
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
