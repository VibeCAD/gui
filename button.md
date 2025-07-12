//Button for creating a test room
<button 
  className="test-button"
  onClick={() => createTestRoom()}
  disabled={!sceneInitialized}
  style={{
    marginLeft: '5px',
    padding: '4px 8px',
    backgroundColor: '#e74c3c',
    color: 'white',
    border: 'none',
    borderRadius: '4px',
    cursor: 'pointer'
  }}
>
  🏠 Add Test Room
</button>

// Helper function to create a test room automatically
const createTestRoom = () => {
  if (!sceneInitialized) return;
  
  console.log('🏠 Creating test room - 13x13 units');
  
  // Calculate SVG coordinates for a 13x13 unit room
  // 13 units / 0.05 scale = 260 SVG units
  // Center in 400x400 SVG space: (200, 200)
  // Square from (70, 70) to (330, 330)
  const testRoomData = {
    points: [
      { x: 70, y: 70 },    // Top-left
      { x: 330, y: 70 },   // Top-right
      { x: 330, y: 330 },  // Bottom-right
      { x: 70, y: 330 }    // Bottom-left
    ],
    name: 'Test Room 13x13',
    gridSize: 20,
    drawingBounds: { width: 400, height: 400 }
  };
  
  handleCreateCustomRoom(testRoomData);
  console.log('✅ Test room created successfully');
}


//Room creation system

const handleCreateCustomRoom = (roomData: { points: { x: number; y: number }[]; openings?: { start: { x: number; y: number }; end: { x: number; y: number } }[]; name?: string; allSegments?: { start: { x: number; y: number }; end: { x: number; y: number }; isOpening?: boolean }[]; gridSize?: number; drawingBounds?: { width: number; height: number } }) => {
  if (!sceneInitialized) return

  const sceneManager = sceneAPI.getSceneManager()
  const scene = sceneManager?.getScene()
  if (!scene || !sceneManager) return

  const SVG_SIZE = 400 // matches modal SVG dimension
  const SCALE = 0.05 // px -> world units (adjust as desired)
  const WALL_HEIGHT = 2.0
  const WALL_THICKNESS = 0.15

  const { points, openings, name, allSegments } = roomData

  // [Large function that creates 3D room geometry from 2D points]
  // Creates floor, walls, handles openings, adds textures, etc.
  
  // Store SceneObject with metadata
  const newObj: SceneObject = {
    id: newId,
    type: 'custom-room',
    position: rootMesh.position.clone(),
    scale: rootMesh.scaling.clone(),
    rotation: rootMesh.rotation.clone(),
    color: '#DEB887',
    isNurbs: false,
    roomName: name,
    gridInfo: {
      gridSize: roomData.gridSize || 20,
      worldScale: SCALE,
      drawingBounds: roomData.drawingBounds || { width: 400, height: 400 }
    }
  }

  addObject(newObj)
  setSelectedObjectId(newId)
  setShowCustomRoomModal(false)
  setActiveDropdown(null)
}