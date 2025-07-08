import { useEffect, useRef, useState } from 'react'
import { Engine, Scene, ArcRotateCamera, Vector3, HemisphericLight, MeshBuilder, StandardMaterial, Color3, Mesh, PickingInfo, GizmoManager, PointerEventTypes } from 'babylonjs'
import OpenAI from 'openai'
import './App.css'
import { Login } from './components/Login'
import { Profile } from './components/Profile'
import { auth, db } from './lib/firebase'
import { onAuthStateChanged, signOut } from 'firebase/auth'
import { doc, getDoc } from 'firebase/firestore'
import type { User } from 'firebase/auth'

interface SceneObject {
  id: string
  type: string
  position: Vector3
  scale: Vector3
  rotation: Vector3
  color: string
  mesh?: Mesh
}

type TransformMode = 'select' | 'move' | 'rotate' | 'scale'
type PrimitiveType = 'cube' | 'sphere' | 'cylinder' | 'plane' | 'torus' | 'cone'

const materialPresets = [
  { name: 'Red', color: '#ff6b6b' },
  { name: 'Blue', color: '#4ecdc4' },
  { name: 'Green', color: '#95e1d3' },
  { name: 'Yellow', color: '#fce38a' },
  { name: 'Purple', color: '#a8e6cf' },
  { name: 'Orange', color: '#ffb347' },
  { name: 'Pink', color: '#ff8fab' },
  { name: 'Cyan', color: '#87ceeb' },
]

function App() {
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const sceneRef = useRef<Scene | null>(null)
  const engineRef = useRef<Engine | null>(null)
  const cameraRef = useRef<ArcRotateCamera | null>(null)
  const gizmoManagerRef = useRef<GizmoManager | null>(null)
  const [textInput, setTextInput] = useState('')
  const [sceneObjects, setSceneObjects] = useState<SceneObject[]>([])
  const [selectedObjectId, setSelectedObjectId] = useState<string | null>(null)
  const [transformMode, setTransformMode] = useState<TransformMode>('select')
  const [currentColor, setCurrentColor] = useState('#3498db')
  const [isLoading, setIsLoading] = useState(false)
  const [apiKey, setApiKey] = useState('')
  const [showApiKeyInput, setShowApiKeyInput] = useState(true)
  const [responseLog, setResponseLog] = useState<string[]>([])
  const [sceneInitialized, setSceneInitialized] = useState(false)
  const [wireframeMode, setWireframeMode] = useState(false)
  const [showGrid, setShowGrid] = useState(true)
  const [hoveredObjectId, setHoveredObjectId] = useState<string | null>(null)
  const [user, setUser] = useState<User | null>(null)
  const [authLoading, setAuthLoading] = useState(true)
  const [showProfile, setShowProfile] = useState(false)
  
  // Dropdown state management
  const [activeDropdown, setActiveDropdown] = useState<string | null>(null)

  // Initialize OpenAI client
  const openai = apiKey ? new OpenAI({ apiKey, dangerouslyAllowBrowser: true }) : null

  const selectedObject = sceneObjects.find(obj => obj.id === selectedObjectId)

  // Close dropdown when clicking outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (activeDropdown && !(event.target as Element).closest('.toolbar-item')) {
        setActiveDropdown(null)
      }
    }

    document.addEventListener('mousedown', handleClickOutside)
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [activeDropdown])

  // Listen for authentication state changes
  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (user) => {
      setUser(user)
      setAuthLoading(false)
      if (user) {
        // Try to load API key from Firestore
        try {
          const userDoc = await getDoc(doc(db, 'users', user.uid))
          if (userDoc.exists() && userDoc.data().openaiApiKey) {
            setApiKey(userDoc.data().openaiApiKey)
            setShowApiKeyInput(false)
          } else {
            // Check localStorage as fallback
            const storedKey = localStorage.getItem('openai_api_key')
            if (storedKey) {
              setApiKey(storedKey)
              setShowApiKeyInput(false)
            }
          }
        } catch (error) {
          console.error('Error loading user data:', error)
        }
      }
    })

    return unsubscribe
  }, [])

  // Listen for API key updates
  useEffect(() => {
    const handleApiKeyUpdate = (event: CustomEvent) => {
      setApiKey(event.detail.apiKey)
      setShowApiKeyInput(false)
    }

    window.addEventListener('apiKeyUpdated', handleApiKeyUpdate as EventListener)
    return () => {
      window.removeEventListener('apiKeyUpdated', handleApiKeyUpdate as EventListener)
    }
  }, [])

  // Update object positions from gizmo interactions
  useEffect(() => {
    if (!selectedObject?.mesh || !gizmoManagerRef.current) return

    const mesh = selectedObject.mesh
    const gizmoManager = gizmoManagerRef.current

    // Update position when position gizmo is used
    if (gizmoManager.positionGizmoEnabled) {
      const onPositionChanged = () => {
        setSceneObjects(prev => prev.map(obj => 
          obj.id === selectedObjectId 
            ? { ...obj, position: mesh.position.clone() }
            : obj
        ))
      }
      
      if (gizmoManager.gizmos.positionGizmo) {
        gizmoManager.gizmos.positionGizmo.onDragEndObservable.add(onPositionChanged)
      }
    }

    // Update rotation when rotation gizmo is used
    if (gizmoManager.rotationGizmoEnabled) {
      const onRotationChanged = () => {
        setSceneObjects(prev => prev.map(obj => 
          obj.id === selectedObjectId 
            ? { ...obj, rotation: mesh.rotation.clone() }
            : obj
        ))
      }
      
      if (gizmoManager.gizmos.rotationGizmo) {
        gizmoManager.gizmos.rotationGizmo.onDragEndObservable.add(onRotationChanged)
      }
    }

    // Update scale when scale gizmo is used
    if (gizmoManager.scaleGizmoEnabled) {
      const onScaleChanged = () => {
        setSceneObjects(prev => prev.map(obj => 
          obj.id === selectedObjectId 
            ? { ...obj, scale: mesh.scaling.clone() }
            : obj
        ))
      }
      
      if (gizmoManager.gizmos.scaleGizmo) {
        gizmoManager.gizmos.scaleGizmo.onDragEndObservable.add(onScaleChanged)
      }
    }
  }, [selectedObjectId, transformMode])

  // Handle transform mode changes and gizmo management
  useEffect(() => {
    if (!gizmoManagerRef.current) return

    const gizmoManager = gizmoManagerRef.current

    // Disable all gizmos first
    gizmoManager.positionGizmoEnabled = false
    gizmoManager.rotationGizmoEnabled = false
    gizmoManager.scaleGizmoEnabled = false
    gizmoManager.boundingBoxGizmoEnabled = false

    // If we have a selected object, enable the appropriate gizmo
    if (selectedObject?.mesh) {
      switch (transformMode) {
        case 'move':
          gizmoManager.positionGizmoEnabled = true
          break
        case 'rotate':
          gizmoManager.rotationGizmoEnabled = true
          break
        case 'scale':
          gizmoManager.scaleGizmoEnabled = true
          break
        case 'select':
          gizmoManager.boundingBoxGizmoEnabled = true
          break
      }
      
      // Attach to the selected mesh
      gizmoManager.attachToMesh(selectedObject.mesh)
      console.log(`Enabled ${transformMode} gizmo for ${selectedObject.id}`)
    } else {
      // No selection, detach gizmo
      gizmoManager.attachToMesh(null)
    }
  }, [transformMode, selectedObjectId, selectedObject])

  // Handle object selection visual feedback
  useEffect(() => {
    if (!sceneRef.current) return

    console.log('🎯 Updating visual feedback - Selected:', selectedObjectId, 'Hovered:', hoveredObjectId)

    // Reset all objects to default state
    sceneObjects.forEach(obj => {
      if (obj.mesh?.material && obj.type !== 'ground') {
        const material = obj.mesh.material as StandardMaterial
        material.emissiveColor = Color3.Black()
        
        // Reset cursor
        if (obj.mesh) {
          obj.mesh.actionManager = null
        }
      }
    })

    // Add hover effect to hovered object (if not selected)
    if (hoveredObjectId && hoveredObjectId !== selectedObjectId) {
      const hoveredObject = sceneObjects.find(obj => obj.id === hoveredObjectId)
      if (hoveredObject?.mesh?.material) {
        const material = hoveredObject.mesh.material as StandardMaterial
        material.emissiveColor = new Color3(0.3, 0.6, 0.9) // More obvious blue hover
      }
    }

    // Add strong highlighting to selected object
    if (selectedObject?.mesh?.material) {
      const material = selectedObject.mesh.material as StandardMaterial
      material.emissiveColor = new Color3(0.6, 1.0, 1.0) // Very bright cyan selection
      console.log('✅ Applied strong selection highlight to:', selectedObject.id)
    }

    // Set up hover detection for all objects
    sceneObjects.forEach(obj => {
      if (obj.mesh && obj.type !== 'ground') {
        // Make cursor change on hover
        obj.mesh.isPickable = true
        
        // Add visual feedback that objects are interactive
        if (obj.mesh.material) {
          const material = obj.mesh.material as StandardMaterial
          // Objects that aren't selected or hovered get a subtle glow to indicate interactivity
          if (obj.id !== selectedObjectId && obj.id !== hoveredObjectId) {
            material.emissiveColor = new Color3(0.1, 0.1, 0.1) // Subtle glow to indicate clickability
          }
        }
      }
    })
  }, [selectedObjectId, hoveredObjectId, selectedObject, sceneObjects])

  const toggleDropdown = (dropdownName: string) => {
    setActiveDropdown(activeDropdown === dropdownName ? null : dropdownName)
  }

  const handleObjectClick = (pickInfo: PickingInfo) => {
    if (pickInfo.hit && pickInfo.pickedMesh) {
      const clickedObject = sceneObjects.find(obj => obj.mesh === pickInfo.pickedMesh)
      if (clickedObject && clickedObject.type !== 'ground') {
        // If clicking on an already selected object, keep it selected
        // If clicking on a different object, select the new one
        if (selectedObjectId !== clickedObject.id) {
          setSelectedObjectId(clickedObject.id)
          console.log('🎯 Clicked and selected object:', clickedObject.id, clickedObject.type)
        }
        
        // Close any open dropdowns when selecting an object
        setActiveDropdown(null)
      } else if (clickedObject && clickedObject.type === 'ground') {
        setSelectedObjectId(null)
        console.log('🎯 Clicked ground, deselecting all')
      }
    } else {
      setSelectedObjectId(null)
      console.log('🎯 Clicked empty space, deselecting all')
    }
  }

  const handleObjectHover = (pickInfo: PickingInfo) => {
    if (pickInfo.hit && pickInfo.pickedMesh) {
      const hoveredObject = sceneObjects.find(obj => obj.mesh === pickInfo.pickedMesh)
      if (hoveredObject && hoveredObject.type !== 'ground') {
        setHoveredObjectId(hoveredObject.id)
        // Change cursor to pointer to indicate clickable
        if (canvasRef.current) {
          canvasRef.current.style.cursor = 'pointer'
        }
      } else {
        setHoveredObjectId(null)
        if (canvasRef.current) {
          canvasRef.current.style.cursor = 'default'
        }
      }
    } else {
      setHoveredObjectId(null)
      if (canvasRef.current) {
        canvasRef.current.style.cursor = 'default'
      }
    }
  }

  const createPrimitive = (type: PrimitiveType) => {
    if (!sceneRef.current) return

    const scene = sceneRef.current
    const newId = `${type}-${Date.now()}`
    let newMesh: Mesh

    console.log('Creating primitive:', type, newId)

    // Create different primitive types
    switch (type) {
      case 'cube':
        newMesh = MeshBuilder.CreateBox(newId, { size: 2 }, scene)
        break
      case 'sphere':
        newMesh = MeshBuilder.CreateSphere(newId, { diameter: 2 }, scene)
        break
      case 'cylinder':
        newMesh = MeshBuilder.CreateCylinder(newId, { diameter: 2, height: 2 }, scene)
        break
      case 'plane':
        newMesh = MeshBuilder.CreatePlane(newId, { size: 2 }, scene)
        break
      case 'torus':
        newMesh = MeshBuilder.CreateTorus(newId, { diameter: 2, thickness: 0.5 }, scene)
        break
      case 'cone':
        newMesh = MeshBuilder.CreateCylinder(newId, { diameterTop: 0, diameterBottom: 2, height: 2 }, scene)
        break
      default:
        return
    }

    // Position the new object
    newMesh.position = new Vector3(
      Math.random() * 4 - 2, // Random x between -2 and 2
      type === 'plane' ? 1 : 2, // Planes slightly above ground, others elevated
      Math.random() * 4 - 2  // Random z between -2 and 2
    )

    // Apply material
    const material = new StandardMaterial(`${newId}-material`, scene)
    material.diffuseColor = Color3.FromHexString(currentColor)
    newMesh.material = material
    
    // Make the mesh pickable and ready for selection
    newMesh.isPickable = true
    newMesh.checkCollisions = false // Disable collisions for better performance

    // Create scene object
    const newObj: SceneObject = {
      id: newId,
      type: type,
      position: newMesh.position.clone(),
      scale: new Vector3(1, 1, 1),
      rotation: new Vector3(0, 0, 0),
      color: currentColor,
      mesh: newMesh
    }

    setSceneObjects(prev => [...prev, newObj])
    setSelectedObjectId(newId)
    setActiveDropdown(null)
    console.log('✅ Created and selected:', newId)
  }

  const handleLogout = async () => {
    try {
      await signOut(auth)
      setShowApiKeyInput(true)
    } catch (error) {
      console.error('Logout error:', error)
    }
  }

  const duplicateObject = () => {
    if (!selectedObject || !sceneRef.current) return

    const scene = sceneRef.current
    const newId = `${selectedObject.type}-${Date.now()}`
    
    console.log('Duplicating object:', selectedObject.id, 'as', newId)

    let newMesh: Mesh
    switch (selectedObject.type) {
      case 'cube':
        newMesh = MeshBuilder.CreateBox(newId, { size: 2 }, scene)
        break
      case 'sphere':
        newMesh = MeshBuilder.CreateSphere(newId, { diameter: 2 }, scene)
        break
      case 'cylinder':
        newMesh = MeshBuilder.CreateCylinder(newId, { diameter: 2, height: 2 }, scene)
        break
      case 'plane':
        newMesh = MeshBuilder.CreatePlane(newId, { size: 2 }, scene)
        break
      case 'torus':
        newMesh = MeshBuilder.CreateTorus(newId, { diameter: 2, thickness: 0.5 }, scene)
        break
      case 'cone':
        newMesh = MeshBuilder.CreateCylinder(newId, { diameterTop: 0, diameterBottom: 2, height: 2 }, scene)
        break
      default:
        return
    }

    // Copy properties from selected object
    newMesh.position = selectedObject.position.clone().add(new Vector3(2, 0, 0))
    newMesh.scaling = selectedObject.scale.clone()
    newMesh.rotation = selectedObject.rotation.clone()
    
    const material = new StandardMaterial(`${newId}-material`, scene)
    material.diffuseColor = Color3.FromHexString(selectedObject.color)
    newMesh.material = material
    
    // Make the mesh pickable and ready for selection
    newMesh.isPickable = true
    newMesh.checkCollisions = false

    const newObj: SceneObject = {
      id: newId,
      type: selectedObject.type,
      position: newMesh.position.clone(),
      scale: newMesh.scaling.clone(),
      rotation: newMesh.rotation.clone(),
      color: selectedObject.color,
      mesh: newMesh
    }

    setSceneObjects(prev => [...prev, newObj])
    setSelectedObjectId(newId)
    setActiveDropdown(null)
    console.log('✅ Duplicated and selected:', newId)
  }

  const deleteSelectedObject = () => {
    if (!selectedObject) return

    console.log('🗑️ Deleting object:', selectedObject.id)
    
    // Detach gizmo first
    if (gizmoManagerRef.current) {
      gizmoManagerRef.current.attachToMesh(null)
    }

    if (selectedObject.mesh) {
      selectedObject.mesh.dispose()
    }
    
    setSceneObjects(prev => prev.filter(obj => obj.id !== selectedObject.id))
    setSelectedObjectId(null)
    setActiveDropdown(null)
    console.log('✅ Deleted object')
  }

  const changeSelectedObjectColor = (color: string) => {
    if (!selectedObject?.mesh?.material) {
      console.log('❌ No object selected or no material')
      return
    }

    console.log('🎨 Changing color of', selectedObject.id, 'to', color)
    
    const material = selectedObject.mesh.material as StandardMaterial
    material.diffuseColor = Color3.FromHexString(color)
    // Maintain strong selection highlight
    material.emissiveColor = new Color3(0.6, 1.0, 1.0)
    
    // Update state
    setSceneObjects(prev => prev.map(obj => 
      obj.id === selectedObject.id 
        ? { ...obj, color: color }
        : obj
    ))
    
    console.log('✅ Color changed successfully')
  }

  const applyCurrentColorToSelection = () => {
    changeSelectedObjectColor(currentColor)
    setActiveDropdown(null)
  }

  const applyPresetColor = (color: string) => {
    setCurrentColor(color)
    changeSelectedObjectColor(color)
  }

  const setCameraView = (view: 'front' | 'back' | 'left' | 'right' | 'top' | 'bottom' | 'home') => {
    if (!cameraRef.current) return

    const camera = cameraRef.current
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
    setActiveDropdown(null)
    console.log('📷 Camera set to:', view)
  }

  const toggleWireframe = () => {
    const newWireframeMode = !wireframeMode
    setWireframeMode(newWireframeMode)

    sceneObjects.forEach(obj => {
      if (obj.mesh?.material && obj.type !== 'ground') {
        const material = obj.mesh.material as StandardMaterial
        material.wireframe = newWireframeMode
      }
    })
    
    console.log('🔲 Wireframe mode:', newWireframeMode ? 'ON' : 'OFF')
  }

  const selectObjectById = (objectId: string) => {
    const object = sceneObjects.find(obj => obj.id === objectId)
    if (object) {
      setSelectedObjectId(objectId)
      console.log('📋 Selected from sidebar:', objectId)
      
      // Close any open dropdowns
      setActiveDropdown(null)
    }
  }

  const initializeBabylonScene = () => {
    if (!canvasRef.current || sceneInitialized) return

    try {
      console.log('🚀 Initializing Babylon.js scene...')
      
      const canvas = canvasRef.current
      const engine = new Engine(canvas, true)
      const scene = new Scene(engine)
      
      engineRef.current = engine
      sceneRef.current = scene

      // Create camera
      const camera = new ArcRotateCamera('camera', -Math.PI / 2, Math.PI / 2.5, 10, Vector3.Zero(), scene)
      camera.attachControl(canvas, true)
      cameraRef.current = camera

      // Create gizmo manager for transform tools
      const gizmoManager = new GizmoManager(scene)
      gizmoManager.positionGizmoEnabled = false
      gizmoManager.rotationGizmoEnabled = false
      gizmoManager.scaleGizmoEnabled = false
      gizmoManager.boundingBoxGizmoEnabled = false
      gizmoManager.usePointerToAttachGizmos = false
      gizmoManagerRef.current = gizmoManager

      // Create light
      const light = new HemisphericLight('light', new Vector3(0, 1, 0), scene)
      light.intensity = 0.7

      // Create initial cube
      const cube = MeshBuilder.CreateBox('cube-initial', { size: 2 }, scene)
      cube.position.y = 1
      const cubeMaterial = new StandardMaterial('cubeMaterial', scene)
      cubeMaterial.diffuseColor = Color3.FromHexString('#ff6b6b')
      cube.material = cubeMaterial
      cube.isPickable = true
      cube.checkCollisions = false

      // Create ground
      const ground = MeshBuilder.CreateGround('ground', { width: 10, height: 10 }, scene)
      const groundMaterial = new StandardMaterial('groundMaterial', scene)
      groundMaterial.diffuseColor = new Color3(0.5, 0.5, 0.5)
      ground.material = groundMaterial
      ground.isPickable = true // Ground is pickable for deselection

      // Add click handling
      scene.onPointerObservable.add((pointerInfo) => {
        if (pointerInfo.type === PointerEventTypes.POINTERDOWN) {
          // Check if we clicked on a gizmo element (they usually have names starting with 'gizmo')
          const isGizmoClick = pointerInfo.pickInfo?.pickedMesh?.name?.toLowerCase().includes('gizmo')
          
          if (!isGizmoClick) {
            handleObjectClick(pointerInfo.pickInfo!)
          }
        } else if (pointerInfo.type === PointerEventTypes.POINTERMOVE) {
          handleObjectHover(pointerInfo.pickInfo!)
        }
      })

      // Initialize scene objects
      setSceneObjects([
        {
          id: 'cube-initial',
          type: 'cube',
          position: new Vector3(0, 1, 0),
          scale: new Vector3(1, 1, 1),
          rotation: new Vector3(0, 0, 0),
          color: '#ff6b6b',
          mesh: cube
        },
        {
          id: 'ground-1',
          type: 'ground',
          position: new Vector3(0, 0, 0),
          scale: new Vector3(10, 1, 10),
          rotation: new Vector3(0, 0, 0),
          color: '#808080',
          mesh: ground
        }
      ])

      // Animation loop
      engine.runRenderLoop(() => {
        scene.render()
      })

      // Handle resize
      const handleResize = () => {
        engine.resize()
      }
      window.addEventListener('resize', handleResize)

      setSceneInitialized(true)
      console.log('✅ Scene initialized successfully')

      // Cleanup function
      return () => {
        window.removeEventListener('resize', handleResize)
        engine.dispose()
      }
    } catch (error) {
      console.error('❌ Error initializing Babylon.js scene:', error)
    }
  }

  // Top Toolbar Component
  const renderTopToolbar = () => (
    <div className="top-toolbar">
      <div className="toolbar-menu">
        <div className="toolbar-brand">VibeCad Pro</div>
        
        {/* Transform Tools */}
        <div className="toolbar-item">
          <button 
            className={`toolbar-button ${transformMode !== 'select' ? 'active' : ''}`}
            onClick={() => toggleDropdown('transform')}
          >
            Transform <span className="dropdown-arrow">▼</span>
          </button>
          <div className={`dropdown-menu ${activeDropdown === 'transform' ? 'show' : ''}`}>
            <div className="dropdown-section">
              <div className="dropdown-section-title">Transform Mode</div>
              <div className="dropdown-grid">
                <button 
                  className={`dropdown-button ${transformMode === 'select' ? 'active' : ''}`}
                  onClick={() => {
                    setTransformMode('select')
                    setActiveDropdown(null)
                  }}
                >
                  <span className="dropdown-icon">🔍</span>
                  Select
                </button>
                <button 
                  className={`dropdown-button ${transformMode === 'move' ? 'active' : ''}`}
                  onClick={() => {
                    setTransformMode('move')
                    setActiveDropdown(null)
                  }}
                >
                  <span className="dropdown-icon">⬆️</span>
                  Move
                </button>
                <button 
                  className={`dropdown-button ${transformMode === 'rotate' ? 'active' : ''}`}
                  onClick={() => {
                    setTransformMode('rotate')
                    setActiveDropdown(null)
                  }}
                >
                  <span className="dropdown-icon">🔄</span>
                  Rotate
                </button>
                <button 
                  className={`dropdown-button ${transformMode === 'scale' ? 'active' : ''}`}
                  onClick={() => {
                    setTransformMode('scale')
                    setActiveDropdown(null)
                  }}
                >
                  <span className="dropdown-icon">📏</span>
                  Scale
                </button>
              </div>
            </div>
          </div>
        </div>

        {/* Create Menu */}
        <div className="toolbar-item">
          <button 
            className="toolbar-button"
            onClick={() => toggleDropdown('create')}
          >
            Create <span className="dropdown-arrow">▼</span>
          </button>
          <div className={`dropdown-menu ${activeDropdown === 'create' ? 'show' : ''}`}>
            <div className="dropdown-section">
              <div className="dropdown-section-title">Primitives</div>
              <div className="dropdown-grid">
                <button className="dropdown-button" onClick={() => createPrimitive('cube')}>
                  <span className="dropdown-icon">⬜</span>
                  Cube
                </button>
                <button className="dropdown-button" onClick={() => createPrimitive('sphere')}>
                  <span className="dropdown-icon">⚪</span>
                  Sphere
                </button>
                <button className="dropdown-button" onClick={() => createPrimitive('cylinder')}>
                  <span className="dropdown-icon">⚫</span>
                  Cylinder
                </button>
                <button className="dropdown-button" onClick={() => createPrimitive('plane')}>
                  <span className="dropdown-icon">▬</span>
                  Plane
                </button>
                <button className="dropdown-button" onClick={() => createPrimitive('torus')}>
                  <span className="dropdown-icon">🔘</span>
                  Torus
                </button>
                <button className="dropdown-button" onClick={() => createPrimitive('cone')}>
                  <span className="dropdown-icon">🔺</span>
                  Cone
                </button>
              </div>
            </div>
          </div>
        </div>

        {/* Material Menu */}
        <div className="toolbar-item">
          <button 
            className={`toolbar-button ${selectedObject ? 'active' : ''}`}
            onClick={() => toggleDropdown('material')}
          >
            Material <span className="dropdown-arrow">▼</span>
          </button>
          <div className={`dropdown-menu ${activeDropdown === 'material' ? 'show' : ''}`}>
            <div className="dropdown-section">
              <div className="dropdown-section-title">Color Picker</div>
              <div className="dropdown-controls">
                <div className="control-row">
                  <span className="control-label">Current:</span>
                  <input
                    type="color"
                    value={currentColor}
                    onChange={(e) => {
                      setCurrentColor(e.target.value)
                      if (selectedObject) {
                        changeSelectedObjectColor(e.target.value)
                      }
                    }}
                    className="color-picker"
                  />
                </div>
              </div>
            </div>
            <div className="dropdown-section">
              <div className="dropdown-section-title">Quick Colors</div>
              <div className="dropdown-controls">
                <div className="control-row">
                  <div className="material-chips">
                    {materialPresets.map((preset) => (
                      <button
                        key={preset.name}
                        className={`material-chip ${currentColor === preset.color ? 'active' : ''}`}
                        style={{ backgroundColor: preset.color }}
                        onClick={() => applyPresetColor(preset.color)}
                        title={preset.name}
                      />
                    ))}
                  </div>
                </div>
              </div>
            </div>
            {selectedObject && (
              <div className="dropdown-section">
                <div className="dropdown-section-title">Apply to: {selectedObject.type.toUpperCase()}</div>
                <div className="dropdown-actions">
                  <button 
                    className="dropdown-action"
                    onClick={applyCurrentColorToSelection}
                  >
                    Apply Current Color Here
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>

        {/* Edit Menu */}
        <div className="toolbar-item">
          <button 
            className={`toolbar-button ${selectedObject ? 'active' : ''}`}
            onClick={() => toggleDropdown('edit')}
          >
            Edit <span className="dropdown-arrow">▼</span>
          </button>
          <div className={`dropdown-menu ${activeDropdown === 'edit' ? 'show' : ''}`}>
            <div className="dropdown-section">
              <div className="dropdown-section-title">Selection</div>
              <div className={`selection-info ${selectedObject ? 'has-selection' : ''}`}>
                {selectedObject ? (
                  <>
                    <div className="selected-object-name">{selectedObject.type.toUpperCase()}</div>
                    <div className="selected-object-details">
                      ID: {selectedObject.id}<br/>
                      Position: ({selectedObject.position.x.toFixed(1)}, {selectedObject.position.y.toFixed(1)}, {selectedObject.position.z.toFixed(1)})
                    </div>
                  </>
                ) : (
                  <div className="no-selection-text">Click an object in the 3D scene to select it</div>
                )}
              </div>
            </div>
            {selectedObject && (
              <div className="dropdown-section">
                <div className="dropdown-section-title">Actions</div>
                <div className="dropdown-actions">
                  <button 
                    className="dropdown-action"
                    onClick={duplicateObject}
                  >
                    Duplicate
                  </button>
                  <button 
                    className="dropdown-action danger"
                    onClick={deleteSelectedObject}
                  >
                    Delete
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>

        {/* View Menu */}
        <div className="toolbar-item">
          <button 
            className="toolbar-button"
            onClick={() => toggleDropdown('view')}
          >
            View <span className="dropdown-arrow">▼</span>
          </button>
          <div className={`dropdown-menu ${activeDropdown === 'view' ? 'show' : ''}`}>
            <div className="dropdown-section">
              <div className="dropdown-section-title">Camera</div>
              <div className="camera-grid">
                <button className="camera-button" onClick={() => setCameraView('front')}>Front</button>
                <button className="camera-button" onClick={() => setCameraView('back')}>Back</button>
                <button className="camera-button" onClick={() => setCameraView('left')}>Left</button>
                <button className="camera-button" onClick={() => setCameraView('right')}>Right</button>
                <button className="camera-button" onClick={() => setCameraView('top')}>Top</button>
                <button className="camera-button" onClick={() => setCameraView('bottom')}>Bottom</button>
                <button className="camera-button" onClick={() => setCameraView('home')}>Home</button>
              </div>
            </div>
            <div className="dropdown-section">
              <div className="dropdown-section-title">Display</div>
              <div className="dropdown-actions">
                <button 
                  className={`dropdown-action ${wireframeMode ? 'active' : ''}`}
                  onClick={toggleWireframe}
                >
                  {wireframeMode ? '✓' : ''} Wireframe
                </button>
                <button 
                  className={`dropdown-action ${showGrid ? 'active' : ''}`}
                  onClick={() => setShowGrid(!showGrid)}
                >
                  {showGrid ? '✓' : ''} Grid
                </button>
              </div>
            </div>
          </div>
        </div>

        {/* User Profile */}
        <div className="toolbar-item toolbar-user">
          <button 
            className="toolbar-button"
            onClick={() => toggleDropdown('user')}
          >
            {user?.email} <span className="dropdown-arrow">▼</span>
          </button>
          <div className={`dropdown-menu ${activeDropdown === 'user' ? 'show' : ''}`}>
            <div className="dropdown-section">
              <div className="dropdown-section-title">Account</div>
              <div className="user-info">
                <div>{user?.email}</div>
                <div className="user-uid">{user?.uid}</div>
              </div>
              <div className="dropdown-actions">
                <button 
                  className="dropdown-action"
                  onClick={() => {
                    setShowProfile(true)
                    setActiveDropdown(null)
                  }}
                >
                  Profile Settings
                </button>
                <button 
                  className="dropdown-action danger"
                  onClick={handleLogout}
                >
                  Sign Out
                </button>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  )

  // AI Sidebar Component
  const renderAISidebar = () => (
    <div className="ai-sidebar">
      <div className="ai-sidebar-content">
        <h3>AI Assistant</h3>
        
        {!sceneInitialized && (
          <div className="loading-indicator">
            <p>Initializing 3D scene...</p>
          </div>
        )}
        
        <div className="ai-control-group">
          <label htmlFor="ai-prompt">Natural Language Commands:</label>
          <textarea
            id="ai-prompt"
            value={textInput}
            onChange={(e) => setTextInput(e.target.value)}
            placeholder="Try: 'move the cube to the right', 'make the cube blue', 'create a red sphere above the cube'"
            className="ai-text-input"
            disabled={isLoading || !sceneInitialized}
          />
          <button 
            onClick={handleSubmitPrompt}
            disabled={isLoading || !textInput.trim() || !sceneInitialized}
            className="ai-submit-button"
          >
            {isLoading ? 'Processing...' : 'Execute AI Command'}
          </button>
        </div>

        <div className="ai-control-group">
          <label>Scene Objects ({sceneObjects.filter(obj => obj.type !== 'ground').length}):</label>
          <div style={{ marginBottom: '8px', fontSize: '11px', color: '#666', fontStyle: 'italic' }}>
            💡 Click objects directly in the 3D scene to select them, or click here
          </div>
          <div className="scene-objects">
            {sceneObjects.filter(obj => obj.type !== 'ground').map(obj => (
              <div 
                key={obj.id} 
                className={`scene-object ${selectedObjectId === obj.id ? 'selected' : ''}`}
                onClick={() => selectObjectById(obj.id)}
                title={`Click to select this object (or click it directly in the 3D scene)`}
              >
                <span className="object-type">{obj.type}</span>
                <span className="object-id">{obj.id}</span>
                <div className="object-color" style={{ backgroundColor: obj.color }}></div>
              </div>
            ))}
            {sceneObjects.filter(obj => obj.type !== 'ground').length === 0 && (
              <div className="no-objects">
                No objects in scene<br/>
                <small>Use the Create menu to add objects</small>
              </div>
            )}
          </div>
          <button 
            onClick={clearAllObjects}
            className="clear-all-button"
            disabled={sceneObjects.filter(obj => obj.type !== 'ground').length === 0}
          >
            Clear All Objects
          </button>
        </div>

        <div className="ai-control-group">
          <label>AI Response Log:</label>
          <div className="ai-response-log">
            {responseLog.slice(-8).map((log, index) => (
              <div key={index} className={`ai-log-entry ${log.startsWith('User:') ? 'user' : log.startsWith('AI:') ? 'ai' : 'error'}`}>
                {log}
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  )

  const describeScene = (): string => {
    const description = sceneObjects.map(obj => {
      if (obj.type === 'ground') return null
      return `${obj.type} "${obj.id}" at position (${obj.position.x.toFixed(1)}, ${obj.position.y.toFixed(1)}, ${obj.position.z.toFixed(1)}) with color ${obj.color}`
    }).filter(Boolean).join(', ')
    
    return `Current scene contains: ${description || 'just a ground plane'}`
  }

  const executeSceneCommand = (command: any) => {
    if (!sceneRef.current) return

    const scene = sceneRef.current
    
    try {
      switch (command.action) {
        case 'move':
          setSceneObjects(prev => {
            const newObjects = [...prev]
            const moveObj = newObjects.find(obj => obj.id === command.objectId)
            if (moveObj && moveObj.mesh) {
              moveObj.mesh.position = new Vector3(command.x, command.y, command.z)
              moveObj.position = new Vector3(command.x, command.y, command.z)
            }
            return newObjects
          })
          break

        case 'color':
          setSceneObjects(prev => {
            const newObjects = [...prev]
            const colorObj = newObjects.find(obj => obj.id === command.objectId)
            if (colorObj && colorObj.mesh && colorObj.mesh.material) {
              const material = colorObj.mesh.material as StandardMaterial
              material.diffuseColor = Color3.FromHexString(command.color)
              colorObj.color = command.color
            }
            return newObjects
          })
          break

        case 'scale':
          setSceneObjects(prev => {
            const newObjects = [...prev]
            const scaleObj = newObjects.find(obj => obj.id === command.objectId)
            if (scaleObj && scaleObj.mesh) {
              scaleObj.mesh.scaling = new Vector3(command.x, command.y, command.z)
              scaleObj.scale = new Vector3(command.x, command.y, command.z)
            }
            return newObjects
          })
          break

        case 'create':
          const newId = `${command.type}-${Date.now()}`
          let newMesh: Mesh
          
          if (command.type === 'cube') {
            newMesh = MeshBuilder.CreateBox(newId, { size: command.size || 2 }, scene)
          } else if (command.type === 'sphere') {
            newMesh = MeshBuilder.CreateSphere(newId, { diameter: command.size || 2 }, scene)
          } else if (command.type === 'cylinder') {
            newMesh = MeshBuilder.CreateCylinder(newId, { diameter: command.size || 2, height: command.height || 2 }, scene)
          } else {
            return
          }

          newMesh.position = new Vector3(command.x || 0, command.y || 1, command.z || 0)
          const newMaterial = new StandardMaterial(`${newId}-material`, scene)
          newMaterial.diffuseColor = Color3.FromHexString(command.color || '#3498db')
          newMesh.material = newMaterial
          newMesh.isPickable = true
          newMesh.checkCollisions = false

          const newObj: SceneObject = {
            id: newId,
            type: command.type,
            position: new Vector3(command.x || 0, command.y || 1, command.z || 0),
            scale: new Vector3(1, 1, 1),
            rotation: new Vector3(0, 0, 0),
            color: command.color || '#3498db',
            mesh: newMesh
          }

          setSceneObjects(prev => [...prev, newObj])
          break

        case 'delete':
          console.log('Deleting object with ID:', command.objectId)
          setSceneObjects(prev => {
            const deleteObj = prev.find(obj => obj.id === command.objectId)
            console.log('Found object to delete:', deleteObj)
            if (deleteObj && deleteObj.mesh) {
              console.log('Disposing mesh:', deleteObj.mesh.name)
              deleteObj.mesh.dispose()
              const newObjects = prev.filter(obj => obj.id !== command.objectId)
              console.log('Objects after deletion:', newObjects.map(obj => obj.id))
              return newObjects
            } else {
              console.log('Object not found or no mesh to dispose')
              return prev
            }
          })
          break
      }
    } catch (error) {
      console.error('Error executing scene command:', error)
    }
  }

  const handleSubmitPrompt = async () => {
    if (!openai || !textInput.trim()) return

    setIsLoading(true)
    try {
      const sceneDescription = describeScene()
      const systemPrompt = `You are a 3D scene manipulation assistant. You can modify a Babylon.js scene based on natural language commands.

Current scene: ${sceneDescription}

Available actions:
1. move: Move an object to x,y,z coordinates
2. color: Change object color (use hex colors)
3. scale: Scale an object by x,y,z factors
4. create: Create new objects (cube, sphere, cylinder)
5. delete: Remove an object

Respond ONLY with valid JSON containing an array of commands. Example:
[{"action": "move", "objectId": "cube-1", "x": 2, "y": 1, "z": 0}]
[{"action": "color", "objectId": "cube-1", "color": "#00ff00"}]
[{"action": "create", "type": "sphere", "x": 3, "y": 2, "z": 1, "color": "#ff0000", "size": 1.5}]

Object IDs currently in scene: ${sceneObjects.map(obj => obj.id).join(', ')}`

      const response = await openai.chat.completions.create({
        model: 'gpt-3.5-turbo',
        messages: [
          { role: 'system', content: systemPrompt },
          { role: 'user', content: textInput }
        ],
        temperature: 0.1,
        max_tokens: 500
      })

      const aiResponse = response.choices[0]?.message?.content
      if (aiResponse) {
        setResponseLog(prev => [...prev, `User: ${textInput}`, `AI: ${aiResponse}`])
        
        try {
          // Clean the AI response by removing markdown code blocks
          let cleanedResponse = aiResponse.trim()
          
          // Remove markdown code blocks
          cleanedResponse = cleanedResponse.replace(/```json\s*/g, '')
          cleanedResponse = cleanedResponse.replace(/```\s*/g, '')
          cleanedResponse = cleanedResponse.trim()
          
          console.log('Cleaned AI response:', cleanedResponse)
          
          const commands = JSON.parse(cleanedResponse)
          if (Array.isArray(commands)) {
            console.log('Executing commands:', commands)
            commands.forEach(command => executeSceneCommand(command))
          } else {
            console.log('Executing single command:', commands)
            executeSceneCommand(commands)
          }
        } catch (parseError) {
          console.error('Error parsing AI response:', parseError)
          console.error('Original response:', aiResponse)
          const errorMessage = parseError instanceof Error ? parseError.message : 'Unknown parsing error'
          setResponseLog(prev => [...prev, `Error: Could not parse AI response - ${errorMessage}`])
        }
      }
    } catch (error) {
      console.error('Error calling OpenAI API:', error)
      setResponseLog(prev => [...prev, `Error: ${error instanceof Error ? error.message : 'Unknown error'}`])
    } finally {
      setIsLoading(false)
      setTextInput('')
    }
  }


  const clearAllObjects = () => {
    // Detach gizmo first
    if (gizmoManagerRef.current) {
      gizmoManagerRef.current.attachToMesh(null)
    }

    setSceneObjects(prev => {
      const objectsToDelete = prev.filter(obj => obj.type !== 'ground')
      console.log('🧹 Clearing all objects:', objectsToDelete.map(obj => obj.id))
      
      // Dispose all meshes
      objectsToDelete.forEach(obj => {
        if (obj.mesh) {
          obj.mesh.dispose()
        }
      })
      
      // Keep only the ground
      const remainingObjects = prev.filter(obj => obj.type === 'ground')
      return remainingObjects
    })
    setSelectedObjectId(null)
    console.log('✅ All objects cleared')
  }

  useEffect(() => {
    if (!showApiKeyInput && !sceneInitialized) {
      // Small delay to ensure canvas is rendered
      const timer = setTimeout(() => {
        initializeBabylonScene()
      }, 100)
      return () => clearTimeout(timer)
    }
  }, [showApiKeyInput, sceneInitialized])

  useEffect(() => {
    return () => {
      if (engineRef.current) {
        engineRef.current.dispose()
      }
    }
  }, [])

  if (authLoading) {
    return (
      <div className="api-key-setup">
        <div className="api-key-container">
          <h2>Loading...</h2>
        </div>
      </div>
    )
  }

  if (!user) {
    return <Login />
  }

  if (showApiKeyInput && !apiKey) {
    return (
      <div className="api-key-setup">
        <div className="api-key-container">
          <h2>Welcome to VibeCad!</h2>
          <p>To use AI-powered scene manipulation, please add your OpenAI API key in your profile.</p>
          <button 
            onClick={() => setShowProfile(true)}
            className="api-key-submit"
          >
            Open Profile Settings
          </button>
          <button 
            onClick={() => setShowApiKeyInput(false)}
            className="api-key-secondary"
            style={{ marginTop: '12px', background: 'transparent', border: '1px solid #666' }}
          >
            Continue without AI
          </button>
        </div>
      </div>
    )
  }

  return (
    <div className="app-container">
      {renderTopToolbar()}
      <div className="main-content">
        <canvas ref={canvasRef} className="babylon-canvas" />
        {renderAISidebar()}
      </div>
      {showProfile && <Profile onClose={() => setShowProfile(false)} />}
    </div>
  )
}

export default App
