import { useEffect, useRef, useState } from 'react'
import { Engine, Scene, ArcRotateCamera, Vector3, HemisphericLight, MeshBuilder, StandardMaterial, Color3, Mesh, PickingInfo, GizmoManager, PointerEventTypes, Matrix, VertexData } from 'babylonjs'
import OpenAI from 'openai'
import './App.css'

interface SceneObject {
  id: string
  type: string
  position: Vector3
  scale: Vector3
  rotation: Vector3
  color: string
  mesh?: Mesh
  isNurbs: boolean
  verbData?: {
    controlPoints: number[][][]
    knotsU: number[]
    knotsV: number[]
    degreeU: number
    degreeV: number
    weights?: number[][]
  }
}

type TransformMode = 'select' | 'move' | 'rotate' | 'scale'
type PrimitiveType = 'cube' | 'sphere' | 'cylinder' | 'plane' | 'torus' | 'cone' | 'nurbs'

// NURBS control point visualization data
interface ControlPointVisualization {
  objectId: string
  controlPointMeshes: Mesh[]
  selectedControlPointIndex: number | null
}

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
  const pointerDownPosition = useRef<{ x: number, y: number } | null>(null);
  const sceneObjectsRef = useRef<SceneObject[]>([]);
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
  const [multiSelectMode, setMultiSelectMode] = useState(false)
  const [selectedObjectIds, setSelectedObjectIds] = useState<string[]>([])
  const [snapToGrid, setSnapToGrid] = useState(false)
  const [gridSize, setGridSize] = useState(1)
  const [objectVisibility, setObjectVisibility] = useState<{[key: string]: boolean}>({})
  const [objectLocked, setObjectLocked] = useState<{[key: string]: boolean}>({})
  const [multiSelectPivot, setMultiSelectPivot] = useState<Mesh | null>(null)
  const [gridMesh, setGridMesh] = useState<Mesh | null>(null)
  const [multiSelectInitialStates, setMultiSelectInitialStates] = useState<{
    [objectId: string]: {
      position: Vector3,
      rotation: Vector3,
      scale: Vector3,
      relativePosition: Vector3
    }
  }>({})
  
  // Dropdown state management
  const [activeDropdown, setActiveDropdown] = useState<string | null>(null)
  
  // Sidebar collapse state
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false)

  // NURBS-specific state
  const [controlPointVisualizations, setControlPointVisualizations] = useState<ControlPointVisualization[]>([])
  const [selectedControlPointIndex, setSelectedControlPointIndex] = useState<number | null>(null)
  const [selectedControlPointMesh, setSelectedControlPointMesh] = useState<Mesh | null>(null)
  const [tessellationQuality, setTessellationQuality] = useState<{[objectId: string]: number}>({})

  // Initialize OpenAI client
  const openai = apiKey ? new OpenAI({ apiKey, dangerouslyAllowBrowser: true }) : null

  const selectedObject = sceneObjects.find(obj => obj.id === selectedObjectId)
  const selectedObjects = sceneObjects.filter(obj => selectedObjectIds.includes(obj.id))
  const hasSelection = selectedObjectId || selectedObjectIds.length > 0

  // NURBS utility functions
  const tessellateNurbsSurface = (verbData: any, quality: number = 10) => {
    console.log('🟡 tessellateNurbsSurface called with quality:', quality)
    console.log('🟡 Input verbData control points:', verbData.controlPoints)
    
    // Validate input data
    if (!verbData || !verbData.controlPoints || !verbData.knotsU || !verbData.knotsV) {
      console.error('❌ Invalid verbData structure:', verbData)
      return null
    }
    
    if (!Array.isArray(verbData.controlPoints) || verbData.controlPoints.length === 0) {
      console.error('❌ Invalid control points array:', verbData.controlPoints)
      return null
    }
    
    // Validate control points structure
    const expectedUCount = verbData.controlPoints.length
    const expectedVCount = verbData.controlPoints[0]?.length || 0
    
    for (let u = 0; u < verbData.controlPoints.length; u++) {
      if (!Array.isArray(verbData.controlPoints[u]) || verbData.controlPoints[u].length !== expectedVCount) {
        console.error(`❌ Invalid control point row ${u}, expected ${expectedVCount} points but got:`, verbData.controlPoints[u])
        return null
      }
      for (let v = 0; v < verbData.controlPoints[u].length; v++) {
        const point = verbData.controlPoints[u][v]
        if (!Array.isArray(point) || point.length < 3) {
          console.error(`❌ Invalid control point [${u}][${v}]:`, point)
          return null
        }
      }
    }
    
    console.log(`✅ Control points validation passed: ${expectedUCount}x${expectedVCount} grid`)
    
    if (quality < 1 || quality > 50) {
      console.warn('⚠️ Quality parameter out of range, clamping to 1-50:', quality)
      quality = Math.max(1, Math.min(50, quality))
    }
    
    try {
      console.log('🟡 Creating NurbsSurface with control points...')
      
      // Create surface using the current control points
      const surface = new (window as any).verb.geom.NurbsSurface(verbData)
      console.log('✅ NurbsSurface created successfully')
      
      console.log('🟡 Tessellating with options...')
      const tessellationOptions = {
        minDivsU: Math.max(5, quality),
        minDivsV: Math.max(5, quality),
        refine: true
      }
      console.log('🟡 Tessellation options:', tessellationOptions)
      
      const tessellation = surface.tessellate(tessellationOptions)
      console.log('✅ Tessellation completed. Raw result:', {
        points: tessellation.points?.length || 0,
        faces: tessellation.faces?.length || 0,
        normals: tessellation.normals?.length || 0,
        uvs: tessellation.uvs?.length || 0
      })
      
      // Validate tessellation result
      if (!tessellation || !tessellation.points || !tessellation.faces) {
        console.error('❌ Invalid tessellation result:', tessellation)
        return null
      }
      
      if (tessellation.points.length === 0 || tessellation.faces.length === 0) {
        console.error('❌ Empty tessellation result - no points or faces')
        return null
      }
      
      const positions: number[] = []
      const normals: number[] = []
      const indices: number[] = []
      const uvs: number[] = []
      
      // Convert points to flat array with validation
      tessellation.points.forEach((point: number[], index: number) => {
        if (!Array.isArray(point) || point.length < 3) {
          console.warn(`⚠️ Invalid point at index ${index}:`, point)
          return
        }
        positions.push(point[0], point[1], point[2])
      })
      
      // Convert normals to flat array - ensure they're properly oriented
      if (tessellation.normals && tessellation.normals.length > 0) {
        tessellation.normals.forEach((normal: number[], index: number) => {
          if (!Array.isArray(normal) || normal.length < 3) {
            console.warn(`⚠️ Invalid normal at index ${index}:`, normal)
            normals.push(0, 1, 0) // Default normal
            return
          }
          
          // Normalize the normal vector
          const length = Math.sqrt(normal[0] * normal[0] + normal[1] * normal[1] + normal[2] * normal[2])
          if (length > 0) {
            normals.push(normal[0] / length, normal[1] / length, normal[2] / length)
          } else {
            // Default normal pointing up if calculation fails
            normals.push(0, 1, 0)
          }
        })
      }
      
      // Convert uvs to flat array
      if (tessellation.uvs && tessellation.uvs.length > 0) {
        tessellation.uvs.forEach((uv: number[], index: number) => {
          if (!Array.isArray(uv) || uv.length < 2) {
            console.warn(`⚠️ Invalid UV at index ${index}:`, uv)
            uvs.push(0, 0) // Default UV
            return
          }
          uvs.push(uv[0], uv[1])
        })
      }
      
      // Convert faces to flat array with proper winding order
      tessellation.faces.forEach((face: number[], index: number) => {
        if (!Array.isArray(face) || face.length < 3) {
          console.warn(`⚠️ Invalid face at index ${index}:`, face)
          return
        }
        
        // Validate face indices
        if (face[0] < 0 || face[1] < 0 || face[2] < 0 || 
            face[0] >= tessellation.points.length || 
            face[1] >= tessellation.points.length || 
            face[2] >= tessellation.points.length) {
          console.warn(`⚠️ Face indices out of range at index ${index}:`, face)
          return
        }
        
        // Ensure counter-clockwise winding order for front-facing triangles
        indices.push(face[0], face[1], face[2])
      })
      
      // Final validation
      if (positions.length === 0 || indices.length === 0) {
        console.error('❌ No valid positions or indices after processing')
        return null
      }
      
      if (positions.length % 3 !== 0) {
        console.error('❌ Position array length not divisible by 3:', positions.length)
        return null
      }
      
      if (indices.length % 3 !== 0) {
        console.error('❌ Index array length not divisible by 3:', indices.length)
        return null
      }
      
      // If we don't have enough normals, recompute them
      if (normals.length !== positions.length) {
        console.log('🟡 Recomputing normals...')
        const computedNormals = new Array(positions.length).fill(0)
        
        // Compute face normals and accumulate vertex normals
        for (let i = 0; i < indices.length; i += 3) {
          const i0 = indices[i] * 3
          const i1 = indices[i + 1] * 3
          const i2 = indices[i + 2] * 3
          
          // Validate indices
          if (i0 >= positions.length || i1 >= positions.length || i2 >= positions.length) {
            console.warn(`⚠️ Invalid face indices: ${indices[i]}, ${indices[i+1]}, ${indices[i+2]}`)
            continue
          }
          
          // Get triangle vertices
          const v0 = [positions[i0], positions[i0 + 1], positions[i0 + 2]]
          const v1 = [positions[i1], positions[i1 + 1], positions[i1 + 2]]
          const v2 = [positions[i2], positions[i2 + 1], positions[i2 + 2]]
          
          // Compute face normal using cross product
          const edge1 = [v1[0] - v0[0], v1[1] - v0[1], v1[2] - v0[2]]
          const edge2 = [v2[0] - v0[0], v2[1] - v0[1], v2[2] - v0[2]]
          
          const faceNormal = [
            edge1[1] * edge2[2] - edge1[2] * edge2[1],
            edge1[2] * edge2[0] - edge1[0] * edge2[2],
            edge1[0] * edge2[1] - edge1[1] * edge2[0]
          ]
          
          // Normalize face normal
          const length = Math.sqrt(faceNormal[0] * faceNormal[0] + faceNormal[1] * faceNormal[1] + faceNormal[2] * faceNormal[2])
          if (length > 0) {
            faceNormal[0] /= length
            faceNormal[1] /= length
            faceNormal[2] /= length
          }
          
          // Accumulate normal for each vertex of the face
          for (let j = 0; j < 3; j++) {
            const vertexIndex = indices[i + j] * 3
            computedNormals[vertexIndex] += faceNormal[0]
            computedNormals[vertexIndex + 1] += faceNormal[1]
            computedNormals[vertexIndex + 2] += faceNormal[2]
          }
        }
        
        // Normalize accumulated vertex normals
        for (let i = 0; i < computedNormals.length; i += 3) {
          const length = Math.sqrt(computedNormals[i] * computedNormals[i] + computedNormals[i + 1] * computedNormals[i + 1] + computedNormals[i + 2] * computedNormals[i + 2])
          if (length > 0) {
            computedNormals[i] /= length
            computedNormals[i + 1] /= length
            computedNormals[i + 2] /= length
          } else {
            computedNormals[i] = 0
            computedNormals[i + 1] = 1
            computedNormals[i + 2] = 0
          }
        }
        
        console.log('✅ Recomputed normals')
        return { positions, normals: computedNormals, indices, uvs }
      }
      
      console.log('✅ Tessellation successful with all data validated:', {
        vertices: positions.length / 3,
        triangles: indices.length / 3,
        normals: normals.length / 3,
        uvs: uvs.length / 2
      })
      
      return { positions, normals, indices, uvs }
    } catch (error) {
      console.error('❌ Error tessellating NURBS surface:', error)
      console.error('❌ VerbData that caused the error:', verbData)
      console.error('❌ Quality that caused the error:', quality)
      return null
    }
  }

  const createNurbsSurface = () => {
    console.log('🟡 createNurbsSurface called')
    
    if (!sceneRef.current) {
      console.error('❌ Scene not available')
      return
    }

    // Check if verb library is loaded
    if (!(window as any).verb) {
      console.error('❌ Verb library not loaded. Please check the CDN script tag.')
      alert('NURBS library not loaded. Please refresh the page.')
      return
    }

    console.log('✅ Verb library available:', !!(window as any).verb)

    const scene = sceneRef.current
    const newId = `nurbs-${Date.now()}`
    
    console.log('🟡 Creating NURBS surface:', newId)

    try {
      // Create a simple 3x3 NURBS surface
      const degreeU = 2
      const degreeV = 2
      const knotsU = [0, 0, 0, 1, 1, 1]
      const knotsV = [0, 0, 0, 1, 1, 1]
      
      // Create control points for a slightly curved surface
      const controlPoints = [
        [
          [-2, 0, -2],
          [-2, 0.5, 0],
          [-2, 0, 2]
        ],
        [
          [0, 1, -2],
          [0, 2, 0],
          [0, 1, 2]
        ],
        [
          [2, 0, -2],
          [2, 0.5, 0],
          [2, 0, 2]
        ]
      ]
      
      // Create the verb data object
      const verbData = {
        controlPoints,
        knotsU,
        knotsV,
        degreeU,
        degreeV,
        weights: undefined
      }
      
      // Create NURBS surface using verb
      const surface = (window as any).verb.geom.NurbsSurface.byKnotsControlPointsWeights(
        degreeU,
        degreeV,
        knotsU,
        knotsV,
        controlPoints
      )
      
      // Set initial tessellation quality
      const initialQuality = 10
      
      // Tessellate the surface directly
      console.log('🟡 Tessellating surface...')
      const tessellation = surface.tessellate({
        minDivsU: initialQuality,
        minDivsV: initialQuality,
        refine: true
      })
      
      console.log('✅ Direct tessellation result:', tessellation)
      
      const positions: number[] = []
      const normals: number[] = []
      const indices: number[] = []
      const uvs: number[] = []
      
      // Convert points to flat array
      tessellation.points.forEach((point: number[]) => {
        positions.push(point[0], point[1], point[2])
      })
      
      // Convert normals to flat array
      tessellation.normals.forEach((normal: number[]) => {
        normals.push(normal[0], normal[1], normal[2])
      })
      
      // Convert uvs to flat array
      tessellation.uvs.forEach((uv: number[]) => {
        uvs.push(uv[0], uv[1])
      })
      
      // Convert faces to flat array
      tessellation.faces.forEach((face: number[]) => {
        indices.push(face[0], face[1], face[2])
      })
      
      const tessellationData = { positions, normals, indices, uvs }
      
      if (!tessellationData) {
        console.error('❌ Failed to tessellate NURBS surface')
        alert('Failed to create NURBS surface. Check console for details.')
        return
      }
      
      console.log('✅ Tessellation successful:', {
        positions: tessellationData.positions.length,
        indices: tessellationData.indices.length,
        normals: tessellationData.normals.length,
        uvs: tessellationData.uvs.length
      })
      
      // Create Babylon.js mesh from tessellation
      console.log('🟡 Creating Babylon.js mesh...')
      const newMesh = new Mesh(newId, scene)
      const vertexData = new VertexData()
      
      vertexData.positions = tessellationData.positions
      vertexData.normals = tessellationData.normals
      vertexData.indices = tessellationData.indices
      vertexData.uvs = tessellationData.uvs
      
      vertexData.applyToMesh(newMesh)
      console.log('✅ Mesh created successfully')
      
      // Position the mesh
      newMesh.position = new Vector3(0, 2, 0)
      
      // Apply material
      const material = new StandardMaterial(`${newId}-material`, scene)
      material.diffuseColor = Color3.FromHexString(currentColor)
      material.backFaceCulling = false // Show both sides of the surface
      material.twoSidedLighting = true // Light both sides properly
      material.specularColor = new Color3(0.2, 0.2, 0.2) // Subtle specular
      material.specularPower = 16
      newMesh.material = material
      
      // Make the mesh pickable
      newMesh.isPickable = true
      newMesh.checkCollisions = false
      
      // Create scene object
      const newObj: SceneObject = {
        id: newId,
        type: 'nurbs',
        position: newMesh.position.clone(),
        scale: new Vector3(1, 1, 1),
        rotation: new Vector3(0, 0, 0),
        color: currentColor,
        mesh: newMesh,
        isNurbs: true,
        verbData: {
          controlPoints,
          knotsU,
          knotsV,
          degreeU,
          degreeV,
          weights: undefined
        }
      }
      
      // Set initial tessellation quality
      setTessellationQuality(prev => ({
        ...prev,
        [newId]: initialQuality
      }))
      
      console.log('🟡 Adding object to scene state...')
      setSceneObjects(prev => {
        const newSceneObjects = [...prev, newObj]
        console.log('✅ Updated scene objects:', newSceneObjects.map(obj => obj.id))
        return newSceneObjects
      })
      setSelectedObjectId(newId)
      setActiveDropdown(null)
      console.log('✅ Created NURBS surface:', newId)
      
    } catch (error) {
      console.error('Error creating NURBS surface:', error)
    }
  }

  const updateNurbsMesh = (objectId: string, newVerbData: any) => {
    if (!sceneRef.current) return

    const scene = sceneRef.current
    const sceneObject = sceneObjects.find(obj => obj.id === objectId)
    
    if (!sceneObject || !sceneObject.mesh || !sceneObject.isNurbs) {
      console.error('Object not found or not a NURBS surface')
      return
    }
    
    try {
      console.log('🔄 Starting NURBS mesh update for:', objectId)
      console.log('🔍 New control points:', newVerbData.controlPoints)
      
      // Get tessellation quality for this object
      const quality = tessellationQuality[objectId] || 10
      console.log('🔍 Using tessellation quality:', quality)
      
      // Tessellate the updated surface
      const tessellationData = tessellateNurbsSurface(newVerbData, quality)
      
      if (!tessellationData) {
        console.error('❌ Failed to tessellate updated NURBS surface')
        return
      }
      
      console.log('✅ Tessellation successful with new data:', {
        positions: tessellationData.positions.length,
        indices: tessellationData.indices.length,
        normals: tessellationData.normals.length,
        uvs: tessellationData.uvs.length
      })
      
      // Store current properties before updating
      const currentMaterial = sceneObject.mesh.material
      const isVisible = sceneObject.mesh.isVisible
      const isPickable = sceneObject.mesh.isPickable
      
      // Update mesh vertices data instead of completely replacing the mesh
      // This preserves parent-child relationships and other mesh properties
      try {
        console.log('🔄 Updating mesh vertex data...')
        sceneObject.mesh.updateVerticesData("position", tessellationData.positions)
        sceneObject.mesh.updateVerticesData("normal", tessellationData.normals)
        sceneObject.mesh.updateVerticesData("uv", tessellationData.uvs)
        sceneObject.mesh.updateIndices(tessellationData.indices)
        
        console.log('✅ Successfully updated vertices data')
      } catch (updateError) {
        console.warn('⚠️ updateVerticesData failed, falling back to applyToMesh:', updateError)
        
        // Fallback: Store control point children before mesh rebuild
        const controlPointChildren: Mesh[] = []
        if (sceneObject.mesh.getChildren) {
          sceneObject.mesh.getChildren().forEach(child => {
            if (child instanceof Mesh && child.metadata?.isControlPoint) {
              controlPointChildren.push(child)
            }
          })
        }
        
        // Apply new vertex data (this will break parent-child relationships)
        const vertexData = new VertexData()
        vertexData.positions = tessellationData.positions
        vertexData.normals = tessellationData.normals
        vertexData.indices = tessellationData.indices
        vertexData.uvs = tessellationData.uvs
        
        vertexData.applyToMesh(sceneObject.mesh)
        
        // Re-parent control points after mesh rebuild
        controlPointChildren.forEach(controlPoint => {
          if (sceneObject.mesh) {
            controlPoint.parent = sceneObject.mesh
            console.log('🔧 Re-parented control point after mesh rebuild')
          }
        })
      }
      
      // Restore mesh properties
      sceneObject.mesh.material = currentMaterial
      sceneObject.mesh.isVisible = isVisible
      sceneObject.mesh.isPickable = isPickable
      sceneObject.mesh.checkCollisions = false
      
      // Ensure material properties are correct
      if (currentMaterial && currentMaterial instanceof StandardMaterial) {
        currentMaterial.backFaceCulling = false // Show both sides of the surface
        currentMaterial.twoSidedLighting = true // Light both sides
      }
      
      // Update the state with new verbData
      setSceneObjects(prev => prev.map(obj => 
        obj.id === objectId ? { 
          ...obj, 
          verbData: newVerbData
        } : obj
      ))
      
      // Update control point visualizations to match the new surface
      updateControlPointVisualizations(objectId, newVerbData)
      
      console.log('✅ NURBS mesh update completed successfully for:', objectId)
      
    } catch (error) {
      console.error('❌ Error updating NURBS mesh:', error)
      console.error('❌ Failed verbData:', newVerbData)
      console.error('❌ Tessellation quality:', tessellationQuality[objectId])
      
      // Try to restore a working state by re-creating the surface
      console.log('🔄 Attempting to restore NURBS surface...')
      try {
        const originalVerbData = sceneObjects.find(obj => obj.id === objectId)?.verbData
        if (originalVerbData) {
          const fallbackTessellation = tessellateNurbsSurface(originalVerbData, 10)
          if (fallbackTessellation && sceneObject.mesh) {
            sceneObject.mesh.updateVerticesData("position", fallbackTessellation.positions)
            sceneObject.mesh.updateVerticesData("normal", fallbackTessellation.normals)
            sceneObject.mesh.updateVerticesData("uv", fallbackTessellation.uvs)
            sceneObject.mesh.updateIndices(fallbackTessellation.indices)
            console.log('✅ Restored NURBS surface with original data')
          }
        }
      } catch (restoreError) {
        console.error('❌ Failed to restore NURBS surface:', restoreError)
      }
    }
  }

  // Create control point visualization spheres
  const createControlPointVisualizations = (objectId: string, verbData: any) => {
    if (!sceneRef.current) return

    const scene = sceneRef.current
    const controlPointMeshes: Mesh[] = []
    
    // Remove existing visualizations for this object
    removeControlPointVisualizations(objectId)
    
    // Get the parent NURBS mesh to inherit its transform
    const parentObject = sceneObjects.find(obj => obj.id === objectId)
    if (!parentObject || !parentObject.mesh) {
      console.error('Parent NURBS mesh not found')
      return
    }
    
    // Create sphere for each control point
    const controlPoints = verbData.controlPoints
    let index = 0
    
    for (let u = 0; u < controlPoints.length; u++) {
      for (let v = 0; v < controlPoints[u].length; v++) {
        const point = controlPoints[u][v]
        
        // Create larger, more visible control point sphere
        const sphere = MeshBuilder.CreateSphere(`${objectId}-cp-${index}`, { diameter: 0.5 }, scene)
        
        // Position the control point in local space first
        const localPosition = new Vector3(point[0], point[1], point[2])
        sphere.position = localPosition
        
        // Set the parent to the NURBS mesh so it inherits transforms
        sphere.parent = parentObject.mesh
        
        // Create special material for control points
        const cpMaterial = new StandardMaterial(`${objectId}-cp-${index}-material`, scene)
        cpMaterial.diffuseColor = new Color3(1, 0.5, 0) // Orange
        cpMaterial.emissiveColor = new Color3(0.4, 0.2, 0) // Brighter emissive
        cpMaterial.specularColor = new Color3(0.8, 0.4, 0) // Specular highlight
        cpMaterial.specularPower = 32
        
        // Make control points always visible (no depth test issues)
        cpMaterial.disableDepthWrite = false
        cpMaterial.backFaceCulling = false
        
        sphere.material = cpMaterial
        
        sphere.isPickable = true
        sphere.checkCollisions = false
        
        // Store control point index for later reference
        sphere.metadata = {
          isControlPoint: true,
          objectId: objectId,
          controlPointIndex: index,
          uIndex: u,
          vIndex: v,
          localPosition: localPosition.clone() // Store original local position
        }
        
        controlPointMeshes.push(sphere)
        index++
      }
    }
    
    // Store visualization data
    setControlPointVisualizations(prev => [
      ...prev.filter(viz => viz.objectId !== objectId),
      {
        objectId,
        controlPointMeshes,
        selectedControlPointIndex: null
      }
    ])
    
    console.log(`✅ Created ${controlPointMeshes.length} control point visualizations for ${objectId}`)
  }

  // Remove control point visualizations
  const removeControlPointVisualizations = (objectId: string) => {
    setControlPointVisualizations(prev => {
      const existing = prev.find(viz => viz.objectId === objectId)
      if (existing) {
        // Dispose all control point meshes
        existing.controlPointMeshes.forEach(mesh => {
          if (mesh.material) {
            mesh.material.dispose()
          }
          mesh.dispose()
        })
        return prev.filter(viz => viz.objectId !== objectId)
      }
      return prev
    })
  }

  // Update control point visualizations
  const updateControlPointVisualizations = (objectId: string, verbData: any) => {
    if (!sceneRef.current) return

    const existing = controlPointVisualizations.find(viz => viz.objectId === objectId)
    if (!existing) {
      // If no existing visualization, create new one
      createControlPointVisualizations(objectId, verbData)
      return
    }

    const controlPoints = verbData.controlPoints
    let index = 0
    
    for (let u = 0; u < controlPoints.length; u++) {
      for (let v = 0; v < controlPoints[u].length; v++) {
        const point = controlPoints[u][v]
        if (existing.controlPointMeshes[index]) {
          // Update the local position of the control point
          const localPosition = new Vector3(point[0], point[1], point[2])
          existing.controlPointMeshes[index].position = localPosition
          
          // Update metadata
          if (existing.controlPointMeshes[index].metadata) {
            existing.controlPointMeshes[index].metadata.localPosition = localPosition.clone()
          }
        }
        index++
      }
    }
    
    console.log(`✅ Updated ${existing.controlPointMeshes.length} control point positions for ${objectId}`)
  }

  // Handle control point selection
  const handleControlPointClick = (controlPointMesh: Mesh) => {
    if (!controlPointMesh.metadata?.isControlPoint) return
    
    const { objectId, controlPointIndex, uIndex, vIndex } = controlPointMesh.metadata
    
    console.log(`🎯 Selected control point ${controlPointIndex} (${uIndex}, ${vIndex}) for object ${objectId}`)
    
    setSelectedControlPointIndex(controlPointIndex)
    setSelectedControlPointMesh(controlPointMesh)
    
    // Update visualization to show selected control point
    setControlPointVisualizations(prev => prev.map(viz => {
      if (viz.objectId === objectId) {
        // Update material for all control points
        viz.controlPointMeshes.forEach((mesh, idx) => {
          const material = mesh.material as StandardMaterial
          if (idx === controlPointIndex) {
            // Selected control point - bright green
            material.diffuseColor = new Color3(0, 1, 0)
            material.emissiveColor = new Color3(0, 0.3, 0)
          } else {
            // Normal control point - orange
            material.diffuseColor = new Color3(1, 0.5, 0)
            material.emissiveColor = new Color3(0.2, 0.1, 0)
          }
        })
        return { ...viz, selectedControlPointIndex: controlPointIndex }
      }
      return viz
    }))
  }

  // Update control point position and rebuild NURBS
  const updateControlPointPosition = (objectId: string, controlPointIndex: number, newPosition: Vector3) => {
    const sceneObject = sceneObjects.find(obj => obj.id === objectId)
    if (!sceneObject || !sceneObject.verbData || !sceneObject.mesh) return

    const verbData = { ...sceneObject.verbData }
    const controlPoints = verbData.controlPoints.map(uRow => uRow.map(point => [...point])) // Deep copy
    
    // Get the control point mesh to get its current local position
    const controlPointViz = controlPointVisualizations.find(viz => viz.objectId === objectId)
    if (!controlPointViz || !controlPointViz.controlPointMeshes[controlPointIndex]) {
      console.error('Control point mesh not found for update')
      return
    }
    
    const controlPointMesh = controlPointViz.controlPointMeshes[controlPointIndex]
    
    // Since control points are children of the NURBS mesh, controlPointMesh.position 
    // is already in local space relative to the NURBS mesh - use it directly
    const localPosition = controlPointMesh.position
    
    console.log(`🎯 Updating control point ${controlPointIndex} to local position:`, localPosition.toString())
    
    // Find the control point by index and update it
    let currentIndex = 0
    let found = false
    
    for (let u = 0; u < controlPoints.length && !found; u++) {
      for (let v = 0; v < controlPoints[u].length && !found; v++) {
        if (currentIndex === controlPointIndex) {
          const oldPosition = controlPoints[u][v]
          controlPoints[u][v] = [localPosition.x, localPosition.y, localPosition.z]
          console.log(`🎯 Updated control point [${u}][${v}] from [${oldPosition.join(', ')}] to [${localPosition.x.toFixed(2)}, ${localPosition.y.toFixed(2)}, ${localPosition.z.toFixed(2)}]`)
          found = true
        }
        currentIndex++
      }
    }
    
    if (found) {
      // Update the verbData with new control points
      const updatedVerbData = { ...verbData, controlPoints }
      
      console.log('🔄 Updating NURBS surface with new control points...')
      
      // Update the state first to ensure UI reflects the change immediately
      setSceneObjects(prev => prev.map(obj => 
        obj.id === objectId ? { 
          ...obj, 
          verbData: updatedVerbData
        } : obj
      ))
      
      // Then update the mesh geometry
      updateNurbsMesh(objectId, updatedVerbData)
    } else {
      console.error('❌ Failed to find control point with index:', controlPointIndex)
    }
  }

  // Update control point from input fields
  const updateControlPointFromInput = (objectId: string, controlPointIndex: number, coordinate: 'x' | 'y' | 'z', value: number) => {
    console.log(`🎯 Updating control point ${controlPointIndex} ${coordinate} to:`, value)
    
    const sceneObject = sceneObjects.find(obj => obj.id === objectId)
    if (!sceneObject || !sceneObject.verbData) return

    const verbData = { ...sceneObject.verbData }
    const controlPoints = verbData.controlPoints.map(uRow => uRow.map(point => [...point])) // Deep copy
    
    // Find the control point by index and update the specified coordinate
    let currentIndex = 0
    let found = false
    
    for (let u = 0; u < controlPoints.length && !found; u++) {
      for (let v = 0; v < controlPoints[u].length && !found; v++) {
        if (currentIndex === controlPointIndex) {
          const coordIndex = coordinate === 'x' ? 0 : coordinate === 'y' ? 1 : 2
          controlPoints[u][v][coordIndex] = value
          found = true
          console.log(`🎯 Updated control point ${controlPointIndex} ${coordinate} to:`, value)
        }
        currentIndex++
      }
    }
    
    if (found) {
      // Update the verbData with new control points
      const updatedVerbData = { ...verbData, controlPoints }
      
      // Update the state first to ensure UI reflects the change immediately
      setSceneObjects(prev => prev.map(obj => 
        obj.id === objectId ? { 
          ...obj, 
          verbData: updatedVerbData
        } : obj
      ))
      
      // Then update the mesh geometry
      updateNurbsMesh(objectId, updatedVerbData)
    }
  }

  // Update tessellation quality
  const updateTessellationQuality = (objectId: string, quality: number) => {
    setTessellationQuality(prev => ({
      ...prev,
      [objectId]: quality
    }))
    
    // Re-tessellate the surface with the new quality
    const sceneObject = sceneObjects.find(obj => obj.id === objectId)
    if (sceneObject && sceneObject.verbData && sceneObject.isNurbs) {
      console.log(`🟡 Updating tessellation quality for ${objectId} to ${quality}`)
      updateNurbsMesh(objectId, sceneObject.verbData)
    }
  }

  // Export NURBS as OBJ
  const exportNurbsAsOBJ = (objectId: string) => {
    const sceneObject = sceneObjects.find(obj => obj.id === objectId)
    if (!sceneObject || !sceneObject.mesh || !sceneObject.isNurbs) {
      console.error('Object not found or not a NURBS surface')
      return
    }

    // Get tessellation data
    const quality = tessellationQuality[objectId] || 10
    const tessellationData = tessellateNurbsSurface(sceneObject.verbData, quality)
    
    if (!tessellationData) {
      console.error('Failed to tessellate NURBS surface for export')
      return
    }

    // Create OBJ content
    let objContent = `# NURBS Surface Export: ${objectId}\n`
    objContent += `# Tessellation Quality: ${quality}\n\n`
    
    // Write vertices
    for (let i = 0; i < tessellationData.positions.length; i += 3) {
      objContent += `v ${tessellationData.positions[i]} ${tessellationData.positions[i + 1]} ${tessellationData.positions[i + 2]}\n`
    }
    
    // Write normals
    for (let i = 0; i < tessellationData.normals.length; i += 3) {
      objContent += `vn ${tessellationData.normals[i]} ${tessellationData.normals[i + 1]} ${tessellationData.normals[i + 2]}\n`
    }
    
    // Write faces
    for (let i = 0; i < tessellationData.indices.length; i += 3) {
      const v1 = tessellationData.indices[i] + 1
      const v2 = tessellationData.indices[i + 1] + 1
      const v3 = tessellationData.indices[i + 2] + 1
      objContent += `f ${v1}//${v1} ${v2}//${v2} ${v3}//${v3}\n`
    }
    
    // Create and download file
    const blob = new Blob([objContent], { type: 'text/plain' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `${objectId}.obj`
    document.body.appendChild(a)
    a.click()
    document.body.removeChild(a)
    URL.revokeObjectURL(url)
    
    console.log(`✅ Exported NURBS surface as OBJ: ${objectId}`)
  }

  // Keep sceneObjectsRef synchronized with sceneObjects state
  useEffect(() => {
    sceneObjectsRef.current = sceneObjects
  }, [sceneObjects])

  // Add keyboard shortcuts
  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      // Don't trigger shortcuts when typing in input fields
      if (event.target instanceof HTMLInputElement || event.target instanceof HTMLTextAreaElement) {
        return
      }

      switch (event.key.toLowerCase()) {
        case 'g':
          if (event.ctrlKey || event.metaKey) {
            event.preventDefault()
            setSnapToGrid(!snapToGrid)
          }
          break
        case 'a':
          if (event.ctrlKey || event.metaKey) {
            event.preventDefault()
            selectAllObjects()
          }
          break
        case 'i':
          if (event.ctrlKey || event.metaKey) {
            event.preventDefault()
            invertSelection()
          }
          break
        case 'delete':
        case 'backspace':
          if (hasSelection) {
            event.preventDefault()
            const objectsToDelete = selectedObjectId ? [selectedObjectId] : selectedObjectIds
            
            // Detach gizmo first
            if (gizmoManagerRef.current) {
              gizmoManagerRef.current.attachToMesh(null)
            }
            
            setSceneObjects(prev => {
              const remainingObjects = prev.filter(obj => !objectsToDelete.includes(obj.id))
              // Dispose meshes
              prev.filter(obj => objectsToDelete.includes(obj.id)).forEach(obj => {
                if (obj.mesh) obj.mesh.dispose()
              })
              return remainingObjects
            })
            
            setSelectedObjectId(null)
            setSelectedObjectIds([])
          }
          break
        case 'd':
          if (event.ctrlKey || event.metaKey) {
            event.preventDefault()
            if (hasSelection) {
              duplicateSelectedObjects()
            }
          }
          break
        case 't':
          if (event.ctrlKey || event.metaKey) {
            event.preventDefault()
            if (hasSelection) {
              resetTransforms()
            }
          }
          break
        case 'r':
          if (!event.ctrlKey && !event.metaKey) {
            event.preventDefault()
            setTransformMode('rotate')
          }
          break
        case 's':
          if (!event.ctrlKey && !event.metaKey) {
            event.preventDefault()
            setTransformMode('scale')
          }
          break
        case 'm':
          if (!event.ctrlKey && !event.metaKey) {
            event.preventDefault()
            setTransformMode('move')
          }
          break
        case 'escape':
          setSelectedObjectId(null)
          setSelectedObjectIds([])
          setActiveDropdown(null)
          break
      }
    }

    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [snapToGrid, hasSelection, selectedObjectId, selectedObjectIds])

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

  // Gizmo and selection management
  useEffect(() => {
    const gizmoManager = gizmoManagerRef.current
    const selectedMesh = selectedObject?.mesh
    const isMultiSelect = selectedObjectIds.length > 0
    
    console.log('Gizmo useEffect triggered:', {
      hasGizmoManager: !!gizmoManager,
      selectedObjectId,
      selectedObjectIds,
      isMultiSelect,
      hasMultiSelectPivot: !!multiSelectPivot,
      hasSelectedControlPoint: !!selectedControlPointMesh,
      transformMode
    })
    
    if (!gizmoManager) return

    // Observers need to be cleaned up
    let positionObserver: any = null
    let rotationObserver: any = null
    let scaleObserver: any = null

    // Detach from any previous mesh and disable all gizmos
    gizmoManager.attachToMesh(null)
    gizmoManager.positionGizmoEnabled = false
    gizmoManager.rotationGizmoEnabled = false
    gizmoManager.scaleGizmoEnabled = false
    gizmoManager.boundingBoxGizmoEnabled = false

    // Choose which mesh to attach gizmo to (priority order)
    let targetMesh: Mesh | null = null
    if (selectedControlPointMesh) {
      // Highest priority: Selected control point
      targetMesh = selectedControlPointMesh
      console.log('Attaching gizmo to selected control point')
    } else if (isMultiSelect && multiSelectPivot) {
      targetMesh = multiSelectPivot
      console.log('Attaching gizmo to multi-select pivot')
    } else if (selectedMesh) {
      targetMesh = selectedMesh
      console.log('Attaching gizmo to single selected mesh:', selectedObject?.id)
    } else {
      console.log('No target mesh for gizmo attachment')
    }

    if (targetMesh) {
      // A mesh is selected, so attach gizmos and add observers
      gizmoManager.attachToMesh(targetMesh)
      console.log('Gizmo attached to mesh, enabling mode:', transformMode)

      // Enable the correct gizmo based on transform mode
      // For control points, only allow position gizmo
      if (selectedControlPointMesh) {
        gizmoManager.positionGizmoEnabled = true
      } else {
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
      }

      // Add observers to update state after a gizmo drag
      const { positionGizmo, rotationGizmo, scaleGizmo } = gizmoManager.gizmos

      if (positionGizmo) {
        positionObserver = positionGizmo.onDragEndObservable.add(() => {
          if (selectedControlPointMesh) {
            // Handle control point movement
            const { objectId, controlPointIndex } = selectedControlPointMesh.metadata
            updateControlPointPosition(objectId, controlPointIndex, selectedControlPointMesh.position)
          } else if (isMultiSelect && multiSelectPivot) {
            // Apply transform to all selected objects
            applyTransformToMultipleObjects(
              multiSelectPivot.position,
              multiSelectPivot.rotation,
              multiSelectPivot.scaling
            )
          } else if (selectedMesh) {
            // Single object transform
            const newPosition = snapToGridPosition(selectedMesh.position.clone())
            selectedMesh.position = newPosition
            setSceneObjects(prev => prev.map(obj => 
              obj.id === selectedObject?.id ? { ...obj, position: newPosition } : obj
            ))
          }
        })
      }
      if (rotationGizmo) {
        rotationObserver = rotationGizmo.onDragEndObservable.add(() => {
          if (isMultiSelect && multiSelectPivot) {
            // Apply transform to all selected objects
            applyTransformToMultipleObjects(
              multiSelectPivot.position,
              multiSelectPivot.rotation,
              multiSelectPivot.scaling
            )
          } else if (selectedMesh) {
            setSceneObjects(prev => prev.map(obj => 
              obj.id === selectedObject?.id ? { ...obj, rotation: selectedMesh.rotation.clone() } : obj
            ))
          }
        })
      }
      if (scaleGizmo) {
        scaleObserver = scaleGizmo.onDragEndObservable.add(() => {
          if (isMultiSelect && multiSelectPivot) {
            // Apply transform to all selected objects
            applyTransformToMultipleObjects(
              multiSelectPivot.position,
              multiSelectPivot.rotation,
              multiSelectPivot.scaling
            )
          } else if (selectedMesh) {
            setSceneObjects(prev => prev.map(obj => 
              obj.id === selectedObject?.id ? { ...obj, scale: selectedMesh.scaling.clone() } : obj
            ))
          }
        })
      }
    }
    
    // Cleanup function to remove observers
    return () => {
      const { positionGizmo, rotationGizmo, scaleGizmo } = gizmoManager.gizmos
      if (positionGizmo && positionObserver) {
        positionGizmo.onDragEndObservable.remove(positionObserver)
      }
      if (rotationGizmo && rotationObserver) {
        rotationGizmo.onDragEndObservable.remove(rotationObserver)
      }
      if (scaleGizmo && scaleObserver) {
        scaleGizmo.onDragEndObservable.remove(scaleObserver)
      }
    }
  }, [selectedObject, selectedObjectIds, transformMode, multiSelectPivot, multiSelectInitialStates, selectedControlPointMesh])

  // Create/update visual grid when snap settings change
  useEffect(() => {
    createVisualGrid()
  }, [snapToGrid, gridSize])

  // Create/update multi-select pivot when selection changes
  useEffect(() => {
    createMultiSelectPivot()
  }, [selectedObjectIds, sceneObjects])

  // Handle object selection visual feedback
  useEffect(() => {
    if (!sceneRef.current) return

    // Reset all non-ground objects to a default state
    sceneObjects.forEach(obj => {
      if (obj.mesh?.material && obj.type !== 'ground') {
        const material = obj.mesh.material as StandardMaterial
        
        // Check if object is locked
        if (objectLocked[obj.id]) {
          material.emissiveColor = new Color3(0.8, 0.4, 0.4) // Red tint for locked objects
        } else {
          // Subtle glow to indicate all objects are interactive
          material.emissiveColor = new Color3(0.1, 0.1, 0.1)
        }
      }
    })

    // Add hover effect
    if (hoveredObjectId && hoveredObjectId !== selectedObjectId && !selectedObjectIds.includes(hoveredObjectId)) {
      const hoveredObject = sceneObjects.find(obj => obj.id === hoveredObjectId)
      if (hoveredObject?.mesh?.material && !objectLocked[hoveredObjectId]) {
        const material = hoveredObject.mesh.material as StandardMaterial
        material.emissiveColor = new Color3(0.3, 0.6, 0.9) // Blue hover
      }
    }

    // Add strong highlight to the single selected object
    if (selectedObject?.mesh?.material) {
      const material = selectedObject.mesh.material as StandardMaterial
      material.emissiveColor = new Color3(0.6, 1.0, 1.0) // Bright cyan selection
    }

    // Add highlight to multi-selected objects
    selectedObjectIds.forEach(objectId => {
      const selectedObj = sceneObjects.find(obj => obj.id === objectId)
      if (selectedObj?.mesh?.material) {
        const material = selectedObj.mesh.material as StandardMaterial
        material.emissiveColor = new Color3(1.0, 0.8, 0.2) // Orange for multi-selection
      }
    })
  }, [selectedObjectId, selectedObjectIds, hoveredObjectId, sceneObjects, objectLocked])

  // Handle NURBS control point visualizations when selection changes
  useEffect(() => {
    if (selectedObject && selectedObject.isNurbs && selectedObject.verbData) {
      // Create control point visualizations for selected NURBS object
      createControlPointVisualizations(selectedObject.id, selectedObject.verbData)
    } else {
      // Remove all control point visualizations when no NURBS object is selected
      controlPointVisualizations.forEach(viz => {
        removeControlPointVisualizations(viz.objectId)
      })
      setSelectedControlPointIndex(null)
      setSelectedControlPointMesh(null)
    }
  }, [selectedObjectId, selectedObject?.isNurbs])

  const toggleDropdown = (dropdownName: string) => {
    setActiveDropdown(activeDropdown === dropdownName ? null : dropdownName)
  }

  const handleObjectClick = (pickInfo: PickingInfo, isCtrlHeld: boolean = false) => {
    console.log('[handleObjectClick] Received pick info:', pickInfo);

    if (pickInfo.hit && pickInfo.pickedMesh) {
      console.log(`[handleObjectClick] Hit registered on mesh: ${pickInfo.pickedMesh.name}`);
      
      // Check if this is a control point
      if (pickInfo.pickedMesh.metadata?.isControlPoint) {
        handleControlPointClick(pickInfo.pickedMesh as Mesh)
        return
      }
      
      // Clear control point selection when clicking on something else
      setSelectedControlPointIndex(null)
      setSelectedControlPointMesh(null)
      
      // Find the object by comparing the mesh name (which we use as an ID)
      // Use the ref to get the current sceneObjects array
      const clickedObject = sceneObjectsRef.current.find(obj => obj.id === pickInfo.pickedMesh?.name)

      if (clickedObject) {
        console.log(`[handleObjectClick] Found corresponding scene object:`, clickedObject);
      } else {
        console.log(`[handleObjectClick] No corresponding scene object found for mesh: ${pickInfo.pickedMesh.name}`);
        console.log(`[handleObjectClick] Current scene objects:`, sceneObjectsRef.current.map(obj => obj.id));
      }

      if (clickedObject && clickedObject.type !== 'ground') {
        // Check if object is locked
        if (objectLocked[clickedObject.id]) {
          console.log(`[handleObjectClick] Object is locked: ${clickedObject.id}`);
          return;
        }

        if (multiSelectMode || isCtrlHeld) {
          // Multi-select mode
          setSelectedObjectIds(prev => {
            if (prev.includes(clickedObject.id)) {
              // Deselect if already selected
              return prev.filter(id => id !== clickedObject.id);
            } else {
              // Add to selection
              return [...prev, clickedObject.id];
            }
          });
          // Clear single selection when using multi-select
          setSelectedObjectId(null);
        } else {
          // Single select mode
          console.log(`[handleObjectClick] Selecting object: ${clickedObject.id}`);
          setSelectedObjectId(clickedObject.id);
          setSelectedObjectIds([]); // Clear multi-selection
        }
        
        // Close any open dropdowns when selecting an object
        setActiveDropdown(null)
      } else {
        // If the ground or an unmanaged mesh is clicked, deselect everything.
        console.log(`[handleObjectClick] Clicked ground or unmanaged mesh. Deselecting.`);
        setSelectedObjectId(null)
        setSelectedObjectIds([]);
      }
    } else {
      // If empty space is clicked, deselect everything.
      console.log('[handleObjectClick] Clicked empty space. Deselecting.');
      setSelectedObjectId(null)
      setSelectedObjectIds([]);
      setSelectedControlPointIndex(null)
      setSelectedControlPointMesh(null)
    }
  }

  const handleObjectHover = (pickInfo: PickingInfo) => {
    if (pickInfo.hit && pickInfo.pickedMesh) {
      const hoveredObject = sceneObjectsRef.current.find(obj => obj.mesh === pickInfo.pickedMesh)
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
      case 'nurbs':
        createNurbsSurface()
        return
      default:
        return
    }

    // Position the new object
    const randomPosition = new Vector3(
      Math.random() * 4 - 2, // Random x between -2 and 2
      type === 'plane' ? 1 : 2, // Planes slightly above ground, others elevated
      Math.random() * 4 - 2  // Random z between -2 and 2
    )
    newMesh.position = snapToGridPosition(randomPosition)

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
      mesh: newMesh,
      isNurbs: false
    }

    setSceneObjects(prev => [...prev, newObj])
    setSelectedObjectId(newId)
    setActiveDropdown(null)
    console.log('✅ Created and selected:', newId)
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
      case 'nurbs':
        if (selectedObject.isNurbs && selectedObject.verbData) {
          // Create a new NURBS surface from the selected object's verbData
          const tessellationData = tessellateNurbsSurface(selectedObject.verbData)
          
          if (!tessellationData) {
            console.error('Failed to tessellate NURBS surface for duplication')
            return
          }
          
          newMesh = new Mesh(newId, scene)
          const vertexData = new VertexData()
          
          vertexData.positions = tessellationData.positions
          vertexData.normals = tessellationData.normals
          vertexData.indices = tessellationData.indices
          vertexData.uvs = tessellationData.uvs
          
          vertexData.applyToMesh(newMesh)
        } else {
          return
        }
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
      mesh: newMesh,
      isNurbs: selectedObject.isNurbs,
      verbData: selectedObject.isNurbs ? selectedObject.verbData : undefined
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
    const objectsToColor = selectedObjectId ? [selectedObjectId] : selectedObjectIds
    
    if (objectsToColor.length === 0) {
      console.log('❌ No objects selected')
      return
    }

    console.log('🎨 Changing color of', objectsToColor.length, 'objects to', color)
    
    // Update state and apply color to meshes
    setSceneObjects(prev => prev.map(obj => {
      if (objectsToColor.includes(obj.id) && obj.mesh?.material) {
        const material = obj.mesh.material as StandardMaterial
        material.diffuseColor = Color3.FromHexString(color)
        
        // Maintain appropriate highlight based on selection state
        if (selectedObjectId === obj.id) {
          material.emissiveColor = new Color3(0.6, 1.0, 1.0) // Cyan for single selection
        } else if (selectedObjectIds.includes(obj.id)) {
          material.emissiveColor = new Color3(1.0, 0.8, 0.2) // Orange for multi-selection
        }
        
        return { ...obj, color: color }
      }
      return obj
    }))
    
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
      setSelectedObjectIds([]) // Clear multi-selection
      console.log('📋 Selected from sidebar:', objectId)
      
      // Close any open dropdowns
      setActiveDropdown(null)
    }
  }

  // Snap position to grid
  const snapToGridPosition = (position: Vector3): Vector3 => {
    if (!snapToGrid) return position
    return new Vector3(
      Math.round(position.x / gridSize) * gridSize,
      Math.round(position.y / gridSize) * gridSize,
      Math.round(position.z / gridSize) * gridSize
    )
  }

  // Create visual grid
  const createVisualGrid = () => {
    if (!sceneRef.current) return

    const scene = sceneRef.current
    
    // Remove existing grid
    if (gridMesh) {
      gridMesh.dispose()
      setGridMesh(null)
    }

    if (!snapToGrid) return

    // Create grid lines
    const gridExtent = 20 // Grid extends from -20 to 20
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
    const lineSystem = MeshBuilder.CreateLineSystem('grid', { lines }, scene)
    lineSystem.color = new Color3(0.5, 0.5, 0.5)
    lineSystem.alpha = 0.3
    lineSystem.isPickable = false
    
    setGridMesh(lineSystem)
  }

  // Create multi-select pivot point
  const createMultiSelectPivot = () => {
    console.log('Creating multi-select pivot, selectedObjectIds:', selectedObjectIds)
    
    if (!sceneRef.current || selectedObjectIds.length === 0) {
      console.log('Removing multi-select pivot: no scene or no selected objects')
      // Remove existing pivot
      if (multiSelectPivot) {
        multiSelectPivot.dispose()
        setMultiSelectPivot(null)
      }
      setMultiSelectInitialStates({})
      return
    }

    const scene = sceneRef.current
    const selectedObjs = sceneObjects.filter(obj => selectedObjectIds.includes(obj.id))
    
    if (selectedObjs.length === 0) {
      console.warn('No matching scene objects found for selected IDs')
      return
    }

    console.log(`Creating pivot for ${selectedObjs.length} objects:`, selectedObjs.map(obj => obj.id))

    // Calculate center point of selected objects
    const center = selectedObjs.reduce((acc, obj) => {
      return acc.add(obj.position)
    }, new Vector3(0, 0, 0)).scale(1 / selectedObjs.length)

    console.log('Calculated pivot center:', center.toString())

    // Remove existing pivot
    if (multiSelectPivot) {
      console.log('Disposing existing pivot')
      multiSelectPivot.dispose()
    }

    // Create invisible pivot mesh
    const pivot = MeshBuilder.CreateSphere('multi-select-pivot', { diameter: 0.1 }, scene)
    pivot.position = center
    pivot.rotation = new Vector3(0, 0, 0)
    pivot.scaling = new Vector3(1, 1, 1)
    pivot.isVisible = false
    pivot.isPickable = false
    
    // Store initial states of all selected objects
    const initialStates: typeof multiSelectInitialStates = {}
    selectedObjs.forEach(obj => {
      const relativePos = obj.position.subtract(center)
      initialStates[obj.id] = {
        position: obj.position.clone(),
        rotation: obj.rotation.clone(),
        scale: obj.scale.clone(),
        relativePosition: relativePos
      }
      console.log(`Object ${obj.id} relative position:`, relativePos.toString())
    })
    
    setMultiSelectPivot(pivot)
    setMultiSelectInitialStates(initialStates)
    console.log('Multi-select pivot created successfully')
  }

  // Apply transform to multiple objects
  const applyTransformToMultipleObjects = (pivotPosition: Vector3, pivotRotation: Vector3, pivotScale: Vector3) => {
    if (!multiSelectPivot || Object.keys(multiSelectInitialStates).length === 0) {
      console.warn('Multi-select pivot or initial states not available')
      return
    }

    if (selectedObjectIds.length === 0) {
      console.warn('No objects selected for multi-transform')
      return
    }

    console.log('Applying multi-object transform:', { 
      pivotPosition: pivotPosition.toString(), 
      pivotRotation: pivotRotation.toString(), 
      pivotScale: pivotScale.toString(),
      selectedCount: selectedObjectIds.length
    })

    setSceneObjects(prev => prev.map(obj => {
      if (selectedObjectIds.includes(obj.id) && obj.mesh && multiSelectInitialStates[obj.id]) {
        const initialState = multiSelectInitialStates[obj.id]
        
        // Start with the initial relative position from the pivot center
        let newPosition = initialState.relativePosition.clone()
        
        // Apply scale to the relative position
        newPosition = newPosition.multiply(pivotScale)
        
        // Apply rotation to the relative position around the pivot
        if (pivotRotation.length() > 0) {
          // Create rotation matrix from Euler angles
          const rotationMatrix = new Matrix()
          Matrix.RotationYawPitchRollToRef(pivotRotation.y, pivotRotation.x, pivotRotation.z, rotationMatrix)
          
          // Apply rotation to relative position
          newPosition = Vector3.TransformCoordinates(newPosition, rotationMatrix)
        }
        
        // Add the pivot's current position to get world position
        newPosition = newPosition.add(pivotPosition)
        
        // Apply snap to grid if enabled
        newPosition = snapToGridPosition(newPosition)
        
        // Apply transforms to the mesh
        obj.mesh.position = newPosition
        obj.mesh.rotation = initialState.rotation.add(pivotRotation)
        obj.mesh.scaling = initialState.scale.multiply(pivotScale)
        
        return {
          ...obj,
          position: obj.mesh.position.clone(),
          rotation: obj.mesh.rotation.clone(),
          scale: obj.mesh.scaling.clone()
        }
      }
      return obj
    }))
  }

  // Select all objects
  const selectAllObjects = () => {
    const selectableObjects = sceneObjects.filter(obj => obj.type !== 'ground' && !objectLocked[obj.id])
    setSelectedObjectIds(selectableObjects.map(obj => obj.id))
    setSelectedObjectId(null)
    setActiveDropdown(null)
    console.log('🔍 Selected all objects')
  }

  // Deselect all objects
  const deselectAllObjects = () => {
    setSelectedObjectId(null)
    setSelectedObjectIds([])
    setActiveDropdown(null)
    console.log('🔍 Deselected all objects')
  }

  // Invert selection
  const invertSelection = () => {
    const selectableObjects = sceneObjects.filter(obj => obj.type !== 'ground' && !objectLocked[obj.id])
    const currentlySelected = selectedObjectIds
    const newSelection = selectableObjects.filter(obj => !currentlySelected.includes(obj.id)).map(obj => obj.id)
    setSelectedObjectIds(newSelection)
    setSelectedObjectId(null)
    setActiveDropdown(null)
    console.log('🔍 Inverted selection')
  }

  // Toggle object visibility
  const toggleObjectVisibility = (objectId: string) => {
    const object = sceneObjects.find(obj => obj.id === objectId)
    if (!object || !object.mesh) return

    const isVisible = objectVisibility[objectId] !== false // Default to visible
    object.mesh.isVisible = !isVisible
    
    setObjectVisibility(prev => ({
      ...prev,
      [objectId]: !isVisible
    }))
    
    console.log(`👁️ ${!isVisible ? 'Showed' : 'Hidden'} object: ${objectId}`)
  }

  // Toggle object lock
  const toggleObjectLock = (objectId: string) => {
    const isLocked = objectLocked[objectId] || false
    
    setObjectLocked(prev => ({
      ...prev,
      [objectId]: !isLocked
    }))
    
    // If locking the currently selected object, deselect it
    if (!isLocked && selectedObjectId === objectId) {
      setSelectedObjectId(null)
    }
    if (!isLocked && selectedObjectIds.includes(objectId)) {
      setSelectedObjectIds(prev => prev.filter(id => id !== objectId))
    }
    
    console.log(`🔒 ${!isLocked ? 'Locked' : 'Unlocked'} object: ${objectId}`)
  }

  // Reset transform for selected objects
  const resetTransforms = () => {
    const objectsToReset = selectedObjectId ? [selectedObjectId] : selectedObjectIds
    
    setSceneObjects(prev => prev.map(obj => {
      if (objectsToReset.includes(obj.id) && obj.mesh) {
        obj.mesh.position = new Vector3(0, 1, 0)
        obj.mesh.rotation = new Vector3(0, 0, 0)
        obj.mesh.scaling = new Vector3(1, 1, 1)
        return {
          ...obj,
          position: new Vector3(0, 1, 0),
          rotation: new Vector3(0, 0, 0),
          scale: new Vector3(1, 1, 1)
        }
      }
      return obj
    }))
    
    setActiveDropdown(null)
    console.log('🔄 Reset transforms for selected objects')
  }

  // Duplicate selected objects
  const duplicateSelectedObjects = () => {
    if (!sceneRef.current) return
    
    const objectsToDuplicate = selectedObjectId ? [selectedObjectId] : selectedObjectIds
    const scene = sceneRef.current
    const newObjects: SceneObject[] = []
    
    objectsToDuplicate.forEach(objectId => {
      const originalObject = sceneObjects.find(obj => obj.id === objectId)
      if (!originalObject) return
      
      const newId = `${originalObject.type}-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`
      let newMesh: Mesh
      
      switch (originalObject.type) {
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
      case 'nurbs':
        if (originalObject.isNurbs && originalObject.verbData) {
          // Create a new NURBS surface from the original object's verbData
          const tessellationData = tessellateNurbsSurface(originalObject.verbData)
          
          if (!tessellationData) {
            console.error('Failed to tessellate NURBS surface for duplication')
            return
          }
          
          newMesh = new Mesh(newId, scene)
          const vertexData = new VertexData()
          
          vertexData.positions = tessellationData.positions
          vertexData.normals = tessellationData.normals
          vertexData.indices = tessellationData.indices
          vertexData.uvs = tessellationData.uvs
          
          vertexData.applyToMesh(newMesh)
        } else {
          return
        }
        break
      default:
        return
    }
      
      // Copy properties and offset position
      const offsetPosition = originalObject.position.clone().add(new Vector3(2, 0, 0))
      newMesh.position = snapToGridPosition(offsetPosition)
      newMesh.scaling = originalObject.scale.clone()
      newMesh.rotation = originalObject.rotation.clone()
      
      const material = new StandardMaterial(`${newId}-material`, scene)
      material.diffuseColor = Color3.FromHexString(originalObject.color)
      newMesh.material = material
      newMesh.isPickable = true
      newMesh.checkCollisions = false
      
      const newObj: SceneObject = {
        id: newId,
        type: originalObject.type,
        position: newMesh.position.clone(),
        scale: newMesh.scaling.clone(),
        rotation: newMesh.rotation.clone(),
        color: originalObject.color,
        mesh: newMesh,
        isNurbs: originalObject.isNurbs,
        verbData: originalObject.isNurbs ? originalObject.verbData : undefined
      }
      
      newObjects.push(newObj)
    })
    
    setSceneObjects(prev => [...prev, ...newObjects])
    
    // Select the new objects
    if (newObjects.length === 1) {
      setSelectedObjectId(newObjects[0].id)
      setSelectedObjectIds([])
    } else {
      setSelectedObjectIds(newObjects.map(obj => obj.id))
      setSelectedObjectId(null)
    }
    
    setActiveDropdown(null)
    console.log('📋 Duplicated selected objects')
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
        switch (pointerInfo.type) {
          case PointerEventTypes.POINTERDOWN:
            console.log('[Pointer Down] Event registered.');
            // Store the starting position of the pointer
            pointerDownPosition.current = { x: scene.pointerX, y: scene.pointerY };
            break;
          
          case PointerEventTypes.POINTERUP:
            console.log('[Pointer Up] Event registered.');
            if (pointerDownPosition.current) {
                const deltaX = Math.abs(pointerDownPosition.current.x - scene.pointerX);
                const deltaY = Math.abs(pointerDownPosition.current.y - scene.pointerY);
                const clickThreshold = 5; // max pixels moved to be considered a click

                console.log(`[Pointer Up] Pointer moved by (${deltaX}, ${deltaY})`);

                if (deltaX < clickThreshold && deltaY < clickThreshold) {
                    // It's a click, not a drag
                    console.log('[Pointer Up] Movement within threshold. Processing as click.');
                    const pickInfo = pointerInfo.pickInfo;

                    if (pickInfo?.pickedMesh) {
                        console.log(`[Pointer Up] Picked mesh: ${pickInfo.pickedMesh.name}`);
                    } else {
                        console.log('[Pointer Up] No mesh picked.');
                    }
                    
                    const isGizmoClick = pickInfo?.pickedMesh?.name?.toLowerCase().includes('gizmo');
                    console.log(`[Pointer Up] Is gizmo click? ${isGizmoClick}`);

                    if (!isGizmoClick && pickInfo) {
                        // Check if Ctrl key is held for multi-select
                        const isCtrlHeld = pointerInfo.event?.ctrlKey || false;
                        handleObjectClick(pickInfo, isCtrlHeld);
                    }
                } else {
                    console.log('[Pointer Up] Movement exceeded threshold. Ignoring as drag.');
                }
            }
            // Reset for the next click
            pointerDownPosition.current = null;
            break;

          case PointerEventTypes.POINTERMOVE:
            const pickInfo = pointerInfo.pickInfo;
            if (pickInfo) {
                handleObjectHover(pickInfo);
            }
            break;
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
          mesh: cube,
          isNurbs: false
        },
        {
          id: 'ground-1',
          type: 'ground',
          position: new Vector3(0, 0, 0),
          scale: new Vector3(10, 1, 10),
          rotation: new Vector3(0, 0, 0),
          color: '#808080',
          mesh: ground,
          isNurbs: false
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
        
        <div className="toolbar-status">
          <span className="status-item">
            <span className="status-label">Mode:</span>
            <span className={`status-value ${transformMode}`}>{transformMode.toUpperCase()}</span>
          </span>
          <span className="status-item">
            <span className="status-label">Grid:</span>
            <span className={`status-value ${snapToGrid ? 'on' : 'off'}`}>
              {snapToGrid ? `ON (${gridSize})` : 'OFF'}
            </span>
          </span>
          <span className="status-item">
            <span className="status-label">Selected:</span>
            <span className="status-value">
              {selectedObjectId ? '1' : selectedObjectIds.length}
            </span>
          </span>
        </div>
        
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
                <button className="dropdown-button" onClick={() => createPrimitive('nurbs')}>
                  <span className="dropdown-icon">🏞️</span>
                  NURBS Surface
                </button>
              </div>
            </div>
          </div>
        </div>

        {/* Material Menu */}
        <div className="toolbar-item">
          <button 
            className={`toolbar-button ${hasSelection ? 'active' : ''}`}
            onClick={() => toggleDropdown('material')}
          >
            Material <span className="dropdown-arrow">▼</span>
          </button>
          <div className={`dropdown-menu ${activeDropdown === 'material' ? 'show' : ''}`}>
            <div className="dropdown-section">
              <div className="dropdown-section-title">RGB Color Picker</div>
              <div className="dropdown-controls">
                <div className="control-row">
                  <span className="control-label">Color:</span>
                  <input
                    type="color"
                    value={currentColor}
                    onChange={(e) => {
                      setCurrentColor(e.target.value)
                      if (hasSelection) {
                        changeSelectedObjectColor(e.target.value)
                      }
                    }}
                    className="color-picker-large"
                  />
                </div>
                <div className="control-row">
                  <span className="control-label">Hex:</span>
                  <input
                    type="text"
                    value={currentColor}
                    onChange={(e) => {
                      const hexValue = e.target.value
                      if (/^#[0-9A-F]{6}$/i.test(hexValue)) {
                        setCurrentColor(hexValue)
                        if (hasSelection) {
                          changeSelectedObjectColor(hexValue)
                        }
                      }
                    }}
                    className="hex-input"
                    placeholder="#FFFFFF"
                  />
                </div>
                <div className="control-row">
                  <span className="control-label">RGB:</span>
                  <div className="rgb-inputs">
                    <input
                      type="number"
                      min="0"
                      max="255"
                      value={parseInt(currentColor.substr(1, 2), 16)}
                      onChange={(e) => {
                        const r = Math.max(0, Math.min(255, parseInt(e.target.value) || 0))
                        const g = parseInt(currentColor.substr(3, 2), 16)
                        const b = parseInt(currentColor.substr(5, 2), 16)
                        const newColor = `#${r.toString(16).padStart(2, '0')}${g.toString(16).padStart(2, '0')}${b.toString(16).padStart(2, '0')}`
                        setCurrentColor(newColor)
                        if (hasSelection) {
                          changeSelectedObjectColor(newColor)
                        }
                      }}
                      className="rgb-input"
                      placeholder="R"
                    />
                    <input
                      type="number"
                      min="0"
                      max="255"
                      value={parseInt(currentColor.substr(3, 2), 16)}
                      onChange={(e) => {
                        const r = parseInt(currentColor.substr(1, 2), 16)
                        const g = Math.max(0, Math.min(255, parseInt(e.target.value) || 0))
                        const b = parseInt(currentColor.substr(5, 2), 16)
                        const newColor = `#${r.toString(16).padStart(2, '0')}${g.toString(16).padStart(2, '0')}${b.toString(16).padStart(2, '0')}`
                        setCurrentColor(newColor)
                        if (hasSelection) {
                          changeSelectedObjectColor(newColor)
                        }
                      }}
                      className="rgb-input"
                      placeholder="G"
                    />
                    <input
                      type="number"
                      min="0"
                      max="255"
                      value={parseInt(currentColor.substr(5, 2), 16)}
                      onChange={(e) => {
                        const r = parseInt(currentColor.substr(1, 2), 16)
                        const g = parseInt(currentColor.substr(3, 2), 16)
                        const b = Math.max(0, Math.min(255, parseInt(e.target.value) || 0))
                        const newColor = `#${r.toString(16).padStart(2, '0')}${g.toString(16).padStart(2, '0')}${b.toString(16).padStart(2, '0')}`
                        setCurrentColor(newColor)
                        if (hasSelection) {
                          changeSelectedObjectColor(newColor)
                        }
                      }}
                      className="rgb-input"
                      placeholder="B"
                    />
                  </div>
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
            {hasSelection && (
              <div className="dropdown-section">
                <div className="dropdown-section-title">
                  Apply to: {selectedObject ? selectedObject.type.toUpperCase() : `${selectedObjectIds.length} OBJECTS`}
                </div>
                <div className="dropdown-actions">
                  <button 
                    className="dropdown-action"
                    onClick={applyCurrentColorToSelection}
                  >
                    Apply Current Color
                  </button>
                  <button 
                    className="dropdown-action"
                    onClick={() => {
                      // Random color generator
                      const randomColor = `#${Math.floor(Math.random()*16777215).toString(16).padStart(6, '0')}`
                      setCurrentColor(randomColor)
                      changeSelectedObjectColor(randomColor)
                    }}
                  >
                    Random Color
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>

        {/* Edit Menu */}
        <div className="toolbar-item">
          <button 
            className={`toolbar-button ${hasSelection ? 'active' : ''}`}
            onClick={() => toggleDropdown('edit')}
          >
            Edit <span className="dropdown-arrow">▼</span>
          </button>
          <div className={`dropdown-menu ${activeDropdown === 'edit' ? 'show' : ''}`}>
            <div className="dropdown-section">
              <div className="dropdown-section-title">Selection Mode</div>
              <div className="dropdown-actions">
                <button 
                  className={`dropdown-action ${!multiSelectMode ? 'active' : ''}`}
                  onClick={() => {
                    setMultiSelectMode(false)
                    setSelectedObjectIds([])
                    setActiveDropdown(null)
                  }}
                >
                  Single Select
                </button>
                <button 
                  className={`dropdown-action ${multiSelectMode ? 'active' : ''}`}
                  onClick={() => {
                    setMultiSelectMode(true)
                    setSelectedObjectId(null)
                    setActiveDropdown(null)
                  }}
                >
                  Multi Select
                </button>
              </div>
            </div>
            <div className="dropdown-section">
              <div className="dropdown-section-title">Selection Tools</div>
              <div className="dropdown-actions">
                <button 
                  className="dropdown-action"
                  onClick={selectAllObjects}
                >
                  Select All
                </button>
                <button 
                  className="dropdown-action"
                  onClick={deselectAllObjects}
                >
                  Deselect All
                </button>
                <button 
                  className="dropdown-action"
                  onClick={invertSelection}
                >
                  Invert Selection
                </button>
              </div>
            </div>
            <div className="dropdown-section">
              <div className="dropdown-section-title">Current Selection</div>
              <div className={`selection-info ${hasSelection ? 'has-selection' : ''}`}>
                {selectedObject ? (
                  <>
                    <div className="selected-object-name">{selectedObject.type.toUpperCase()}</div>
                    <div className="selected-object-details">
                      ID: {selectedObject.id}<br/>
                      Position: ({selectedObject.position.x.toFixed(1)}, {selectedObject.position.y.toFixed(1)}, {selectedObject.position.z.toFixed(1)})
                    </div>
                  </>
                ) : selectedObjectIds.length > 0 ? (
                  <>
                    <div className="selected-object-name">MULTIPLE OBJECTS</div>
                    <div className="selected-object-details">
                      {selectedObjectIds.length} objects selected<br/>
                      {selectedObjectIds.slice(0, 3).join(', ')}
                      {selectedObjectIds.length > 3 ? '...' : ''}
                    </div>
                  </>
                ) : (
                  <div className="no-selection-text">
                    {multiSelectMode ? 'Ctrl+Click objects to select multiple' : 'Click an object in the 3D scene to select it'}
                  </div>
                )}
              </div>
            </div>
            {hasSelection && (
              <div className="dropdown-section">
                <div className="dropdown-section-title">Actions</div>
                <div className="dropdown-actions">
                  <button 
                    className="dropdown-action"
                    onClick={duplicateSelectedObjects}
                  >
                    Duplicate
                  </button>
                  <button 
                    className="dropdown-action"
                    onClick={resetTransforms}
                  >
                    Reset Transform
                  </button>
                  <button 
                    className="dropdown-action danger"
                    onClick={() => {
                      const objectsToDelete = selectedObjectId ? [selectedObjectId] : selectedObjectIds
                      
                      // Detach gizmo first
                      if (gizmoManagerRef.current) {
                        gizmoManagerRef.current.attachToMesh(null)
                      }
                      
                      setSceneObjects(prev => {
                        const remainingObjects = prev.filter(obj => !objectsToDelete.includes(obj.id))
                        // Dispose meshes
                        prev.filter(obj => objectsToDelete.includes(obj.id)).forEach(obj => {
                          if (obj.mesh) obj.mesh.dispose()
                        })
                        return remainingObjects
                      })
                      
                      setSelectedObjectId(null)
                      setSelectedObjectIds([])
                      setActiveDropdown(null)
                      console.log('🗑️ Deleted selected objects')
                    }}
                  >
                    Delete
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>

        {/* Tools Menu */}
        <div className="toolbar-item">
          <button 
            className="toolbar-button"
            onClick={() => toggleDropdown('tools')}
          >
            Tools <span className="dropdown-arrow">▼</span>
          </button>
          <div className={`dropdown-menu ${activeDropdown === 'tools' ? 'show' : ''}`}>
            <div className="dropdown-section">
              <div className="dropdown-section-title">Snap Settings</div>
              <div className="dropdown-controls">
                <div className="control-row">
                  <label className="control-checkbox">
                    <input
                      type="checkbox"
                      checked={snapToGrid}
                      onChange={(e) => setSnapToGrid(e.target.checked)}
                    />
                    <span>Snap to Grid</span>
                  </label>
                </div>
                <div className="control-row">
                  <span className="control-label">Grid Size:</span>
                  <input
                    type="number"
                    value={gridSize}
                    onChange={(e) => setGridSize(parseFloat(e.target.value) || 1)}
                    min="0.1"
                    max="5"
                    step="0.1"
                    className="control-input"
                  />
                </div>
              </div>
            </div>
            <div className="dropdown-section">
              <div className="dropdown-section-title">Precision Tools</div>
              <div className="dropdown-actions">
                <button 
                  className="dropdown-action"
                  onClick={() => {
                    // Focus on selected object
                    if (selectedObject?.mesh) {
                      cameraRef.current?.setTarget(selectedObject.mesh.position)
                    } else if (selectedObjects.length > 0) {
                      // Focus on center of multi-selection
                      const center = selectedObjects.reduce((acc, obj) => {
                        return acc.add(obj.position)
                      }, new Vector3(0, 0, 0)).scale(1 / selectedObjects.length)
                      cameraRef.current?.setTarget(center)
                    }
                    setActiveDropdown(null)
                  }}
                  disabled={!hasSelection}
                >
                  Focus Selected
                </button>
                <button 
                  className="dropdown-action"
                  onClick={() => {
                    // Align selected objects to grid
                    const objectsToAlign = selectedObjectId ? [selectedObjectId] : selectedObjectIds
                    setSceneObjects(prev => prev.map(obj => {
                      if (objectsToAlign.includes(obj.id) && obj.mesh) {
                        const snappedPos = snapToGridPosition(obj.position)
                        obj.mesh.position = snappedPos
                        return { ...obj, position: snappedPos }
                      }
                      return obj
                    }))
                    setActiveDropdown(null)
                  }}
                  disabled={!hasSelection}
                >
                  Align to Grid
                </button>
              </div>
            </div>
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
                <button 
                  className={`dropdown-action ${snapToGrid ? 'active' : ''}`}
                  onClick={() => setSnapToGrid(!snapToGrid)}
                >
                  {snapToGrid ? '✓' : ''} Snap to Grid
                </button>
              </div>
            </div>
            <div className="dropdown-section">
              <div className="dropdown-section-title">Visibility</div>
              <div className="dropdown-actions">
                <button 
                  className="dropdown-action"
                  onClick={() => {
                    // Show all objects
                    setObjectVisibility({})
                    sceneObjects.forEach(obj => {
                      if (obj.mesh) {
                        obj.mesh.isVisible = true
                      }
                    })
                    setActiveDropdown(null)
                  }}
                >
                  Show All
                </button>
                <button 
                  className="dropdown-action"
                  onClick={() => {
                    // Hide unselected objects
                    const visibleIds = selectedObjectId ? [selectedObjectId] : selectedObjectIds
                    const newVisibility: {[key: string]: boolean} = {}
                    
                    sceneObjects.forEach(obj => {
                      if (obj.type !== 'ground') {
                        const shouldBeVisible = visibleIds.includes(obj.id)
                        if (obj.mesh) {
                          obj.mesh.isVisible = shouldBeVisible
                        }
                        newVisibility[obj.id] = shouldBeVisible
                      }
                    })
                    
                    setObjectVisibility(newVisibility)
                    setActiveDropdown(null)
                  }}
                  disabled={!hasSelection}
                >
                  Isolate Selected
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
    <div className={`ai-sidebar ${sidebarCollapsed ? 'collapsed' : ''}`}>
      <div className="ai-sidebar-header">
        <h3>AI Assistant</h3>
        <button 
          className="sidebar-toggle"
          onClick={() => setSidebarCollapsed(!sidebarCollapsed)}
          title={sidebarCollapsed ? 'Expand sidebar' : 'Collapse sidebar'}
        >
          {sidebarCollapsed ? '◀' : '▶'}
        </button>
      </div>
      
      {!sidebarCollapsed && (
        <div className="ai-sidebar-content">
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
            <div className="selection-mode-hint">
              💡 {multiSelectMode ? 'Multi-select mode: Ctrl+Click to select multiple' : 'Click objects to select them'}
            </div>
            <div className="scene-objects">
              {sceneObjects.filter(obj => obj.type !== 'ground').map(obj => {
                const isSelected = selectedObjectId === obj.id || selectedObjectIds.includes(obj.id)
                const isVisible = objectVisibility[obj.id] !== false
                const isLocked = objectLocked[obj.id] || false
                
                return (
                  <div 
                    key={obj.id} 
                    className={`scene-object ${isSelected ? 'selected' : ''} ${isLocked ? 'locked' : ''} ${!isVisible ? 'hidden' : ''}`}
                    onClick={() => selectObjectById(obj.id)}
                    title={`${isLocked ? '[LOCKED] ' : ''}${!isVisible ? '[HIDDEN] ' : ''}Click to select this object`}
                  >
                    <span className="object-type">{obj.type}</span>
                    <span className="object-id">{obj.id}</span>
                    <div className="object-controls">
                      <button
                        className={`object-control-btn ${isVisible ? 'visible' : 'hidden'}`}
                        onClick={(e) => {
                          e.stopPropagation()
                          toggleObjectVisibility(obj.id)
                        }}
                        title={isVisible ? 'Hide object' : 'Show object'}
                      >
                        {isVisible ? '👁️' : '🚫'}
                      </button>
                      <button
                        className={`object-control-btn ${isLocked ? 'locked' : 'unlocked'}`}
                        onClick={(e) => {
                          e.stopPropagation()
                          toggleObjectLock(obj.id)
                        }}
                        title={isLocked ? 'Unlock object' : 'Lock object'}
                      >
                        {isLocked ? '🔒' : '🔓'}
                      </button>
                    </div>
                    <div className="object-color" style={{ backgroundColor: obj.color }}></div>
                  </div>
                )
              })}
              {sceneObjects.filter(obj => obj.type !== 'ground').length === 0 && (
                <div className="no-objects">
                  No objects in scene<br/>
                  <small>Use the Create menu to add objects</small>
                </div>
              )}
            </div>
            <div className="object-stats">
              <small>
                Selected: {selectedObjectId ? 1 : selectedObjectIds.length} | 
                Hidden: {Object.values(objectVisibility).filter(v => v === false).length} | 
                Locked: {Object.values(objectLocked).filter(v => v === true).length}
              </small>
            </div>
            <button 
              onClick={clearAllObjects}
              className="clear-all-button"
              disabled={sceneObjects.filter(obj => obj.type !== 'ground').length === 0}
            >
              Clear All Objects
            </button>
          </div>

          {/* NURBS Properties Panel */}
          {selectedObject && selectedObject.isNurbs && selectedObject.verbData && (
            <div className="ai-control-group">
              <label>NURBS Properties</label>
              <div className="nurbs-properties">
                <div className="nurbs-info">
                  <div className="nurbs-info-item">
                    <span className="nurbs-label">Degree U:</span>
                    <span className="nurbs-value">{selectedObject.verbData.degreeU}</span>
                  </div>
                  <div className="nurbs-info-item">
                    <span className="nurbs-label">Degree V:</span>
                    <span className="nurbs-value">{selectedObject.verbData.degreeV}</span>
                  </div>
                  <div className="nurbs-info-item">
                    <span className="nurbs-label">Control Points:</span>
                    <span className="nurbs-value">
                      {selectedObject.verbData.controlPoints.length} × {selectedObject.verbData.controlPoints[0]?.length || 0}
                    </span>
                  </div>
                </div>

                <div className="nurbs-control-section">
                  <div className="nurbs-section-title">Tessellation Quality</div>
                  <div className="nurbs-quality-control">
                    <input
                      type="range"
                      min="5"
                      max="30"
                      value={tessellationQuality[selectedObject.id] || 10}
                      onChange={(e) => updateTessellationQuality(selectedObject.id, parseInt(e.target.value))}
                      className="nurbs-quality-slider"
                    />
                    <span className="nurbs-quality-value">
                      {tessellationQuality[selectedObject.id] || 10}
                    </span>
                  </div>
                </div>

                <div className="nurbs-control-section">
                  <div className="nurbs-section-title">Control Points</div>
                  <div className="control-points-list">
                    {selectedObject.verbData.controlPoints.map((uRow, uIndex) =>
                      uRow.map((point, vIndex) => {
                        const pointIndex = uIndex * uRow.length + vIndex
                        const isSelected = selectedControlPointIndex === pointIndex
                        return (
                          <div 
                            key={`${uIndex}-${vIndex}`} 
                            className={`control-point-item ${isSelected ? 'selected' : ''}`}
                          >
                            <div className="control-point-header">
                              <span className="control-point-label">CP[{uIndex},{vIndex}]</span>
                              {isSelected && <span className="control-point-selected-indicator">●</span>}
                            </div>
                            <div className="control-point-coords">
                              <div className="control-point-coord">
                                <label>X:</label>
                                <input
                                  type="number"
                                  step="0.1"
                                  value={point[0].toFixed(2)}
                                  onChange={(e) => 
                                    updateControlPointFromInput(
                                      selectedObject.id, 
                                      pointIndex, 
                                      'x', 
                                      parseFloat(e.target.value) || 0
                                    )
                                  }
                                  className="control-point-input"
                                />
                              </div>
                              <div className="control-point-coord">
                                <label>Y:</label>
                                <input
                                  type="number"
                                  step="0.1"
                                  value={point[1].toFixed(2)}
                                  onChange={(e) => 
                                    updateControlPointFromInput(
                                      selectedObject.id, 
                                      pointIndex, 
                                      'y', 
                                      parseFloat(e.target.value) || 0
                                    )
                                  }
                                  className="control-point-input"
                                />
                              </div>
                              <div className="control-point-coord">
                                <label>Z:</label>
                                <input
                                  type="number"
                                  step="0.1"
                                  value={point[2].toFixed(2)}
                                  onChange={(e) => 
                                    updateControlPointFromInput(
                                      selectedObject.id, 
                                      pointIndex, 
                                      'z', 
                                      parseFloat(e.target.value) || 0
                                    )
                                  }
                                  className="control-point-input"
                                />
                              </div>
                            </div>
                          </div>
                        )
                      })
                    )}
                  </div>
                </div>

                <div className="nurbs-control-section">
                  <div className="nurbs-section-title">Export</div>
                  <div className="nurbs-export-controls">
                    <button 
                      onClick={() => exportNurbsAsOBJ(selectedObject.id)}
                      className="nurbs-export-button"
                    >
                      Export as OBJ
                    </button>
                  </div>
                </div>

                <div className="nurbs-help">
                  <small>
                    💡 Click on orange control point spheres in the 3D view to select them, then use the move gizmo to adjust the surface shape.
                  </small>
                </div>
              </div>
            </div>
          )}

          <div className="ai-control-group">
            <label>Keyboard Shortcuts:</label>
            <div className="keyboard-shortcuts">
              <div className="shortcut-item">
                <span className="shortcut-key">Ctrl+A</span>
                <span className="shortcut-desc">Select All</span>
              </div>
              <div className="shortcut-item">
                <span className="shortcut-key">Ctrl+I</span>
                <span className="shortcut-desc">Invert Selection</span>
              </div>
              <div className="shortcut-item">
                <span className="shortcut-key">Ctrl+D</span>
                <span className="shortcut-desc">Duplicate</span>
              </div>
              <div className="shortcut-item">
                <span className="shortcut-key">Ctrl+T</span>
                <span className="shortcut-desc">Reset Transform</span>
              </div>
              <div className="shortcut-item">
                <span className="shortcut-key">Ctrl+G</span>
                <span className="shortcut-desc">Toggle Snap to Grid</span>
              </div>
              <div className="shortcut-item">
                <span className="shortcut-key">M</span>
                <span className="shortcut-desc">Move Mode</span>
              </div>
              <div className="shortcut-item">
                <span className="shortcut-key">R</span>
                <span className="shortcut-desc">Rotate Mode</span>
              </div>
              <div className="shortcut-item">
                <span className="shortcut-key">S</span>
                <span className="shortcut-desc">Scale Mode</span>
              </div>
              <div className="shortcut-item">
                <span className="shortcut-key">Delete</span>
                <span className="shortcut-desc">Delete Selected</span>
              </div>
              <div className="shortcut-item">
                <span className="shortcut-key">Esc</span>
                <span className="shortcut-desc">Deselect All</span>
              </div>
            </div>
          </div>

          <div className="ai-control-group">
            <label>AI Response Log:</label>
            <div className="ai-response-log">
              {responseLog.slice(-8).map((log, index) => (
                <div key={index} className={`ai-log-entry ${log.startsWith('User:') ? 'user' : log.startsWith('AI:') ? 'ai' : 'error'}`}>
                  {log}
                </div>
              ))}
              {responseLog.length === 0 && (
                <div className="ai-log-entry ai-log-empty">
                  No AI responses yet. Try entering a command above.
                </div>
              )}
            </div>
          </div>
        </div>
      )}
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
            mesh: newMesh,
            isNurbs: false
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

  const handleContinue = () => {
    if (apiKey.trim()) {
      setShowApiKeyInput(false)
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
        // Check if verb is available when initializing
        if ((window as any).verb) {
          console.log('✅ Verb library loaded successfully')
        } else {
          console.warn('⚠️ Verb library not found - NURBS functionality may not work')
        }
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

  if (showApiKeyInput) {
    return (
      <div className="api-key-setup">
        <div className="api-key-container">
          <h2>VibeCad - AI Scene Manipulation</h2>
          <p>Enter your OpenAI API Key to enable AI-powered 3D scene manipulation:</p>
          <input
            type="password"
            value={apiKey}
            onChange={(e) => setApiKey(e.target.value)}
            placeholder="sk-..."
            className="api-key-input"
            onKeyPress={(e) => {
              if (e.key === 'Enter') {
                handleContinue()
              }
            }}
          />
          <button 
            onClick={handleContinue}
            disabled={!apiKey.trim()}
            className="api-key-submit"
          >
            Continue
          </button>
          <p className="api-key-note">
            Your API key is stored locally and never sent to our servers.
          </p>
        </div>
      </div>
    )
  }

  return (
    <div className="app-container">
      {renderTopToolbar()}
      <div className="main-content">
        <div className="canvas-container">
          <canvas ref={canvasRef} className="babylon-canvas" />
        </div>
        {renderAISidebar()}
      </div>
    </div>
  )
}

export default App
