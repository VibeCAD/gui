import React, { useState, useRef, useEffect } from 'react'

interface Point {
  x: number
  y: number
}

interface RoomData {
  points: Point[]
  openings?: { start: Point; end: Point }[]  // Line segments that are openings
  name?: string  // Optional room name/tag
  allSegments?: { start: Point; end: Point; isOpening?: boolean }[]  // All line segments for interior walls
  gridSize?: number  // Grid size used during drawing (in pixels)
  drawingBounds?: { width: number; height: number }  // SVG canvas dimensions
}

interface GridPoint {
  x: number
  y: number
}

interface LineSegment {
  start: GridPoint
  end: GridPoint
  id: string
  isOpening?: boolean  // true for openings/doorways, false/undefined for walls
}

interface CustomRoomModalProps {
  isOpen: boolean
  onCancel: () => void
  onCreate: (roomData: RoomData) => void
  onCreateMultiple?: (roomsData: RoomData[]) => void  // For creating multiple named rooms at once
}

/**
 * A grid-based room drawing tool that lets users draw lines along a grid
 * to create room shapes. Users can only draw horizontal and vertical lines
 * along the grid intersections.
 */
export const CustomRoomModal: React.FC<CustomRoomModalProps> = ({ isOpen, onCancel, onCreate, onCreateMultiple }) => {
  const [lineSegments, setLineSegments] = useState<LineSegment[]>([])
  const [isDrawing, setIsDrawing] = useState(false)
  const [currentLine, setCurrentLine] = useState<LineSegment | null>(null)
  const [hoveredGridPoint, setHoveredGridPoint] = useState<GridPoint | null>(null)
  const [gridSize, setGridSize] = useState(20)
  const [drawingMode, setDrawingMode] = useState<'wall' | 'opening'>('wall')
  const [roomNames, setRoomNames] = useState<{ [key: number]: string }>({})
  const [showNamingStep, setShowNamingStep] = useState(false)
  const svgRef = useRef<SVGSVGElement | null>(null)

  // Grid settings
  const GRID_SIZE = gridSize
  const SVG_WIDTH = 400
  const SVG_HEIGHT = 400
  const GRID_COLS = Math.floor(SVG_WIDTH / GRID_SIZE)
  const GRID_ROWS = Math.floor(SVG_HEIGHT / GRID_SIZE)

  // Reset state whenever the modal (re)opens
  useEffect(() => {
    if (isOpen) {
      setLineSegments([])
      setIsDrawing(false)
      setCurrentLine(null)
      setHoveredGridPoint(null)
      setRoomNames({})
      setShowNamingStep(false)
    }
  }, [isOpen])

  if (!isOpen) return null

  const snapToGrid = (x: number, y: number): GridPoint => {
    const gridX = Math.round(x / GRID_SIZE)
    const gridY = Math.round(y / GRID_SIZE)
    return {
      x: Math.max(0, Math.min(GRID_COLS, gridX)),
      y: Math.max(0, Math.min(GRID_ROWS, gridY))
    }
  }

  const gridToPixel = (gridPoint: GridPoint): Point => {
    return {
      x: gridPoint.x * GRID_SIZE,
      y: gridPoint.y * GRID_SIZE
    }
  }

  const getMouseGridPoint = (e: React.MouseEvent<SVGSVGElement>): GridPoint | null => {
    if (!svgRef.current) return null
    const rect = svgRef.current.getBoundingClientRect()
    const x = e.clientX - rect.left
    const y = e.clientY - rect.top
    return snapToGrid(x, y)
  }

  const handleMouseDown = (e: React.MouseEvent<SVGSVGElement>) => {
    const gridPoint = getMouseGridPoint(e)
    if (!gridPoint) return

    setIsDrawing(true)
    setCurrentLine({
      start: gridPoint,
      end: gridPoint,
      id: `line-${Date.now()}`,
      isOpening: drawingMode === 'opening'
    })
  }

  const handleMouseMove = (e: React.MouseEvent<SVGSVGElement>) => {
    const gridPoint = getMouseGridPoint(e)
    if (!gridPoint) return

    setHoveredGridPoint(gridPoint)

    if (isDrawing && currentLine) {
      // Constrain to horizontal or vertical lines only
      const dx = Math.abs(gridPoint.x - currentLine.start.x)
      const dy = Math.abs(gridPoint.y - currentLine.start.y)
      
      let endPoint: GridPoint
      if (dx > dy) {
        // Horizontal line
        endPoint = { x: gridPoint.x, y: currentLine.start.y }
      } else {
        // Vertical line
        endPoint = { x: currentLine.start.x, y: gridPoint.y }
      }

      setCurrentLine({
        ...currentLine,
        end: endPoint
      })
    }
  }

  const handleMouseUp = () => {
    if (isDrawing && currentLine) {
      // Only add line if it has length > 0
      if (currentLine.start.x !== currentLine.end.x || currentLine.start.y !== currentLine.end.y) {
        setLineSegments(prev => [...prev, currentLine])
      }
      setIsDrawing(false)
      setCurrentLine(null)
    }
  }

  const handleClear = () => {
    setLineSegments([])
    setIsDrawing(false)
    setCurrentLine(null)
  }

  const handleUndo = () => {
    setLineSegments(prev => prev.slice(0, -1))
  }

  // Find enclosed areas (rooms) from the line segments using grid-based region detection
  const findRooms = (): Point[][] => {
    if (lineSegments.length < 3) return []

    // Create a 2D grid to track walls and regions
    const gridWidth = GRID_COLS + 1
    const gridHeight = GRID_ROWS + 1
    
    // Create wall maps for horizontal and vertical walls
    const horizontalWalls = Array(gridHeight).fill(null).map(() => Array(gridWidth).fill(false))
    const verticalWalls = Array(gridHeight).fill(null).map(() => Array(gridWidth).fill(false))
    
    // Create separate maps for walls and all boundaries (including openings)
    const horizontalBoundaries = Array(gridHeight).fill(null).map(() => Array(gridWidth).fill(false))
    const verticalBoundaries = Array(gridHeight).fill(null).map(() => Array(gridWidth).fill(false))
    
    // Mark all boundaries (walls and openings) for region detection
    lineSegments.forEach(line => {
      if (line.start.y === line.end.y) {
        // Horizontal boundary
        const y = line.start.y
        const minX = Math.min(line.start.x, line.end.x)
        const maxX = Math.max(line.start.x, line.end.x)
        for (let x = minX; x < maxX; x++) {
          if (y > 0) {
            horizontalBoundaries[y][x] = true
            // Only mark as wall if not an opening
            if (!line.isOpening) {
              horizontalWalls[y][x] = true
            }
          }
        }
      } else if (line.start.x === line.end.x) {
        // Vertical boundary
        const x = line.start.x
        const minY = Math.min(line.start.y, line.end.y)
        const maxY = Math.max(line.start.y, line.end.y)
        for (let y = minY; y < maxY; y++) {
          if (x > 0) {
            verticalBoundaries[y][x] = true
            // Only mark as wall if not an opening
            if (!line.isOpening) {
              verticalWalls[y][x] = true
            }
          }
        }
      }
    })
    
    // Find enclosed regions using flood fill from edges
    const cellGrid = Array(gridHeight - 1).fill(null).map(() => Array(gridWidth - 1).fill(-1))
    let regionId = 0
    
    // Flood fill to find connected regions
    const floodFill = (startX: number, startY: number, id: number) => {
      const stack: [number, number][] = [[startX, startY]]
      const region: [number, number][] = []
      
      while (stack.length > 0) {
        const [x, y] = stack.pop()!
        
        if (x < 0 || x >= gridWidth - 1 || y < 0 || y >= gridHeight - 1) continue
        if (cellGrid[y][x] !== -1) continue
        
        cellGrid[y][x] = id
        region.push([x, y])
        
        // Check all four neighbors (use boundaries for region detection)
        if (x > 0 && !verticalBoundaries[y][x]) stack.push([x - 1, y])
        if (x < gridWidth - 2 && !verticalBoundaries[y][x + 1]) stack.push([x + 1, y])
        if (y > 0 && !horizontalBoundaries[y][x]) stack.push([x, y - 1])
        if (y < gridHeight - 2 && !horizontalBoundaries[y + 1][x]) stack.push([x, y + 1])
      }
      
      return region
    }
    
    // Start flood fill from edges to mark exterior region
    for (let x = 0; x < gridWidth - 1; x++) {
      if (cellGrid[0][x] === -1 && !horizontalBoundaries[0][x]) {
        floodFill(x, 0, 0) // Mark as exterior (id = 0)
      }
      if (cellGrid[gridHeight - 2][x] === -1 && !horizontalBoundaries[gridHeight - 1][x]) {
        floodFill(x, gridHeight - 2, 0)
      }
    }
    
    for (let y = 0; y < gridHeight - 1; y++) {
      if (cellGrid[y][0] === -1 && !verticalBoundaries[y][0]) {
        floodFill(0, y, 0)
      }
      if (cellGrid[y][gridWidth - 2] === -1 && !verticalBoundaries[y][gridWidth - 1]) {
        floodFill(gridWidth - 2, y, 0)
      }
    }
    
    // Find all interior regions (rooms)
    const rooms: Point[][] = []
    const processedRegions = new Set<number>()
    
    for (let y = 0; y < gridHeight - 1; y++) {
      for (let x = 0; x < gridWidth - 1; x++) {
        if (cellGrid[y][x] === -1) {
          // Found an unprocessed interior cell
          regionId++
          const region = floodFill(x, y, regionId)
          
          if (region.length > 0) {
            // Extract boundary points of this region
            const boundaryPoints = extractRegionBoundary(region, horizontalBoundaries, verticalBoundaries, horizontalWalls, verticalWalls)
            if (boundaryPoints.length >= 4) {
              rooms.push(boundaryPoints)
            }
          }
        }
      }
    }
    
    return rooms
  }
  
  // Extract the boundary points of a region by tracing the perimeter
  const extractRegionBoundary = (
    region: [number, number][],
    horizontalBoundaries: boolean[][],
    verticalBoundaries: boolean[][],
    horizontalWalls: boolean[][],
    verticalWalls: boolean[][]
  ): Point[] => {
    if (region.length === 0) return []
    
    const cellSet = new Set(region.map(([x, y]) => `${x},${y}`))
    
    // Find all boundary edges of the region
    const boundaryEdges: { from: GridPoint; to: GridPoint }[] = []
    
    for (const [cellX, cellY] of region) {
      // Check all four edges of this cell (use boundaries for edge detection)
      // Top edge
      if (cellY === 0 || !cellSet.has(`${cellX},${cellY - 1}`) || horizontalBoundaries[cellY][cellX]) {
        boundaryEdges.push({
          from: { x: cellX, y: cellY },
          to: { x: cellX + 1, y: cellY }
        })
      }
      // Bottom edge
      if (cellY === GRID_ROWS - 2 || !cellSet.has(`${cellX},${cellY + 1}`) || horizontalBoundaries[cellY + 1][cellX]) {
        boundaryEdges.push({
          from: { x: cellX + 1, y: cellY + 1 },
          to: { x: cellX, y: cellY + 1 }
        })
      }
      // Left edge
      if (cellX === 0 || !cellSet.has(`${cellX - 1},${cellY}`) || verticalBoundaries[cellY][cellX]) {
        boundaryEdges.push({
          from: { x: cellX, y: cellY + 1 },
          to: { x: cellX, y: cellY }
        })
      }
      // Right edge
      if (cellX === GRID_COLS - 2 || !cellSet.has(`${cellX + 1},${cellY}`) || verticalBoundaries[cellY][cellX + 1]) {
        boundaryEdges.push({
          from: { x: cellX + 1, y: cellY },
          to: { x: cellX + 1, y: cellY + 1 }
        })
      }
    }
    
    if (boundaryEdges.length === 0) return []
    
    // Connect edges to form a continuous polygon
    const polygon: GridPoint[] = []
    const edgeMap = new Map<string, { from: GridPoint; to: GridPoint }>()
    
    // Build edge lookup map
    boundaryEdges.forEach(edge => {
      const key = `${edge.from.x},${edge.from.y}`
      edgeMap.set(key, edge)
    })
    
    // Start with the first edge
    let currentEdge = boundaryEdges[0]
    const startPoint = currentEdge.from
    polygon.push(startPoint)
    
    const visitedEdges = new Set<string>()
    let iterations = 0
    const maxIterations = boundaryEdges.length * 2
    
    // Trace the boundary
    while (iterations < maxIterations) {
      iterations++
      
      const edgeKey = `${currentEdge.from.x},${currentEdge.from.y}-${currentEdge.to.x},${currentEdge.to.y}`
      if (visitedEdges.has(edgeKey)) break
      visitedEdges.add(edgeKey)
      
      const nextPoint = currentEdge.to
      
      // Check if we've completed the loop
      if (nextPoint.x === startPoint.x && nextPoint.y === startPoint.y) {
        break
      }
      
      polygon.push(nextPoint)
      
      // Find the next edge that starts where this one ends
      const nextEdgeKey = `${nextPoint.x},${nextPoint.y}`
      const nextEdge = edgeMap.get(nextEdgeKey)
      
      if (!nextEdge) {
        // Try to find any edge that connects
        let found = false
        for (const edge of boundaryEdges) {
          if (edge.from.x === nextPoint.x && edge.from.y === nextPoint.y) {
            currentEdge = edge
            found = true
            break
          }
        }
        if (!found) break
      } else {
        currentEdge = nextEdge
      }
    }
    
    // Convert to pixel coordinates and simplify
    const pixelPoints = polygon.map(p => ({ x: p.x * GRID_SIZE, y: p.y * GRID_SIZE }))
    
    // Remove collinear points to simplify the polygon
    const simplified: Point[] = []
    for (let i = 0; i < pixelPoints.length; i++) {
      const prev = pixelPoints[(i - 1 + pixelPoints.length) % pixelPoints.length]
      const curr = pixelPoints[i]
      const next = pixelPoints[(i + 1) % pixelPoints.length]
      
      // Check if current point is collinear with prev and next
      const dx1 = curr.x - prev.x
      const dy1 = curr.y - prev.y
      const dx2 = next.x - curr.x
      const dy2 = next.y - curr.y
      
      // Cross product to check collinearity
      const cross = dx1 * dy2 - dy1 * dx2
      
      if (Math.abs(cross) > 0.01) {
        simplified.push(curr)
      }
    }
    
    return simplified.length >= 3 ? simplified : pixelPoints
  }
  
  // Order corners counter-clockwise
  const orderCornersCCW = (corners: GridPoint[]): GridPoint[] => {
    if (corners.length === 0) return []
    
    // Find centroid
    const centroid = corners.reduce(
      (acc, c) => ({ x: acc.x + c.x, y: acc.y + c.y }),
      { x: 0, y: 0 }
    )
    centroid.x /= corners.length
    centroid.y /= corners.length
    
    // Sort by angle from centroid
    return corners.slice().sort((a, b) => {
      const angleA = Math.atan2(a.y - centroid.y, a.x - centroid.x)
      const angleB = Math.atan2(b.y - centroid.y, b.x - centroid.x)
      return angleA - angleB
    })
  }

  const handleProceedToNaming = () => {
    const rooms = findRooms()
    if (rooms.length === 0) return
    
    // Initialize room names with defaults
    const defaultNames: { [key: number]: string } = {}
    rooms.forEach((_, index) => {
      defaultNames[index] = `Room ${index + 1}`
    })
    setRoomNames(defaultNames)
    setShowNamingStep(true)
  }

  const handleCreateRooms = () => {
    const rooms = findRooms()
    if (rooms.length === 0) return

    // Find openings (line segments marked as openings)
    const openingSegments = lineSegments.filter(line => line.isOpening)
    const openings = openingSegments.map(line => ({
      start: { x: line.start.x * GRID_SIZE, y: line.start.y * GRID_SIZE },
      end: { x: line.end.x * GRID_SIZE, y: line.end.y * GRID_SIZE }
    }))

    // Convert all line segments to pixel coordinates
    const allSegments = lineSegments.map(line => ({
      start: { x: line.start.x * GRID_SIZE, y: line.start.y * GRID_SIZE },
      end: { x: line.end.x * GRID_SIZE, y: line.end.y * GRID_SIZE },
      isOpening: line.isOpening
    }))

    if (onCreateMultiple) {
      // Create all rooms at once with their names
      const roomsData: RoomData[] = rooms.map((room, index) => ({
        points: room,
        openings: openings.length > 0 ? openings : undefined,
        name: roomNames[index] || `Room ${index + 1}`,
        allSegments: allSegments.length > 0 ? allSegments : undefined,
        gridSize: GRID_SIZE,  // Pass the current grid size
        drawingBounds: { width: SVG_WIDTH, height: SVG_HEIGHT }  // Pass drawing bounds
      }))
      onCreateMultiple(roomsData)
    } else {
      // Fallback to creating rooms one by one
      rooms.forEach((room, index) => {
        setTimeout(() => {
          const roomData: RoomData = {
            points: room,
            openings: openings.length > 0 ? openings : undefined,
            name: roomNames[index] || `Room ${index + 1}`,
            allSegments: allSegments.length > 0 ? allSegments : undefined,
            gridSize: GRID_SIZE,  // Pass the current grid size
            drawingBounds: { width: SVG_WIDTH, height: SVG_HEIGHT }  // Pass drawing bounds
          }
          onCreate(roomData)
        }, index * 100)
      })
    }
  }

  // Generate grid points for visualization
  const generateGridPoints = () => {
    const points: GridPoint[] = []
    for (let x = 0; x <= GRID_COLS; x++) {
      for (let y = 0; y <= GRID_ROWS; y++) {
        points.push({ x, y })
      }
    }
    return points
  }

  const gridPoints = generateGridPoints()
  const detectedRooms = findRooms()

  // Render naming step if we're in that phase
  if (showNamingStep) {
    const rooms = findRooms()
    
    return (
      <div className="modal-overlay" style={overlayStyle}>
        <div className="modal-container" style={namingContainerStyle}>
          <h2 style={{ marginTop: 0 }}>Name Your Rooms</h2>
          <p style={{ fontSize: '14px', color: '#666', marginBottom: '16px' }}>
            Assign names to the {rooms.length} detected room{rooms.length !== 1 ? 's' : ''}:
          </p>
          
          <div style={{ maxHeight: '400px', overflowY: 'auto', marginBottom: '16px' }}>
            {rooms.map((room, index) => (
              <div key={index} style={{ marginBottom: '12px', display: 'flex', alignItems: 'center', gap: '12px' }}>
                <div style={{ 
                  width: '60px', 
                  height: '60px', 
                  border: '1px solid #ddd',
                  position: 'relative',
                  flexShrink: 0
                }}>
                  <svg width="60" height="60" style={{ position: 'absolute', top: 0, left: 0 }}>
                    <polygon
                      points={room.map(p => {
                        // Scale room to fit in preview
                        const minX = Math.min(...room.map(pt => pt.x))
                        const maxX = Math.max(...room.map(pt => pt.x))
                        const minY = Math.min(...room.map(pt => pt.y))
                        const maxY = Math.max(...room.map(pt => pt.y))
                        const scale = 50 / Math.max(maxX - minX, maxY - minY)
                        return `${5 + (p.x - minX) * scale},${5 + (p.y - minY) * scale}`
                      }).join(' ')}
                      fill="rgba(46, 204, 113, 0.2)"
                      stroke="#2ecc71"
                      strokeWidth={1}
                    />
                  </svg>
                </div>
                <input
                  type="text"
                  value={roomNames[index] || ''}
                  onChange={(e) => setRoomNames(prev => ({ ...prev, [index]: e.target.value }))}
                  placeholder={`Room ${index + 1}`}
                  style={{
                    flex: 1,
                    padding: '8px 12px',
                    border: '1px solid #ddd',
                    borderRadius: '4px',
                    fontSize: '14px'
                  }}
                />
              </div>
            ))}
          </div>
          
          <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end' }}>
            <button onClick={() => setShowNamingStep(false)}>
              Back to Drawing
            </button>
            <button onClick={onCancel}>
              Cancel
            </button>
            <button
              onClick={handleCreateRooms}
              style={{ background: '#3498db', color: '#fff' }}
            >
              Create Named Rooms
            </button>
          </div>
        </div>
      </div>
    )
  }

  // Regular drawing interface
  return (
    <div className="modal-overlay" style={overlayStyle}>
      <div className="modal-container" style={containerStyle}>
        <h2 style={{ marginTop: 0 }}>Draw Room Layout</h2>
        <p style={{ fontSize: '14px', color: '#666', marginBottom: '8px' }}>
          Draw lines along the grid to create room shapes. Lines can only be horizontal or vertical.
        </p>
        
        <div style={{ marginBottom: '12px', display: 'flex', alignItems: 'center', gap: '12px' }}>
          <label style={{ fontSize: '14px', color: '#666' }}>Grid Size:</label>
          <input
            type="range"
            min="10"
            max="40"
            value={gridSize}
            onChange={(e) => {
              const newSize = parseInt(e.target.value)
              setGridSize(newSize)
              // Clear drawing when changing grid size to avoid confusion
              setLineSegments([])
              setCurrentLine(null)
              setIsDrawing(false)
            }}
            style={{ flex: 1 }}
          />
          <span style={{ fontSize: '14px', color: '#666', minWidth: '30px' }}>{gridSize}px</span>
        </div>
        
        <div style={{ marginBottom: '16px', display: 'flex', alignItems: 'center', gap: '8px' }}>
          <label style={{ fontSize: '14px', color: '#666', marginRight: '8px' }}>Drawing Mode:</label>
          <button
            style={{
              padding: '6px 12px',
              backgroundColor: drawingMode === 'wall' ? '#2c3e50' : '#ecf0f1',
              color: drawingMode === 'wall' ? '#fff' : '#2c3e50',
              border: '1px solid #2c3e50',
              borderRadius: '4px 0 0 4px',
              cursor: 'pointer',
              fontSize: '14px'
            }}
            onClick={() => setDrawingMode('wall')}
          >
            🧱 Wall
          </button>
          <button
            style={{
              padding: '6px 12px',
              backgroundColor: drawingMode === 'opening' ? '#e74c3c' : '#ecf0f1',
              color: drawingMode === 'opening' ? '#fff' : '#e74c3c',
              border: '1px solid #e74c3c',
              borderRadius: '0 4px 4px 0',
              borderLeft: 'none',
              cursor: 'pointer',
              fontSize: '14px'
            }}
            onClick={() => setDrawingMode('opening')}
          >
            🚪 Opening
          </button>
          <small style={{ marginLeft: '12px', color: '#666', fontSize: '12px' }}>
            {drawingMode === 'wall' ? 'Drawing walls (solid lines)' : 'Drawing openings (dashed lines)'}
          </small>
        </div>
        
        <svg
          ref={svgRef}
          width={SVG_WIDTH}
          height={SVG_HEIGHT}
          style={{ border: '1px solid #ccc', background: '#fff', cursor: 'crosshair' }}
          onMouseDown={handleMouseDown}
          onMouseMove={handleMouseMove}
          onMouseUp={handleMouseUp}
          onMouseLeave={() => {
            setHoveredGridPoint(null)
            if (isDrawing) {
              setIsDrawing(false)
              setCurrentLine(null)
            }
          }}
        >
          {/* Grid lines */}
          <defs>
            <pattern id="grid" width={GRID_SIZE} height={GRID_SIZE} patternUnits="userSpaceOnUse">
              <path d={`M ${GRID_SIZE} 0 L 0 0 0 ${GRID_SIZE}`} fill="none" stroke="#e0e0e0" strokeWidth="1"/>
            </pattern>
          </defs>
          <rect width="100%" height="100%" fill="url(#grid)" />
          
          {/* Grid points */}
          {gridPoints.map((point, idx) => {
            const pixelPoint = gridToPixel(point)
            const isHovered = hoveredGridPoint && 
              hoveredGridPoint.x === point.x && hoveredGridPoint.y === point.y
            return (
              <circle
                key={idx}
                cx={pixelPoint.x}
                cy={pixelPoint.y}
                r={isHovered ? 3 : 1.5}
                fill={isHovered ? "#3498db" : "#bbb"}
                pointerEvents="none"
              />
            )
          })}
          
          {/* Drawn line segments */}
          {lineSegments.map((line) => {
            const startPixel = gridToPixel(line.start)
            const endPixel = gridToPixel(line.end)
            return (
              <line
                key={line.id}
                x1={startPixel.x}
                y1={startPixel.y}
                x2={endPixel.x}
                y2={endPixel.y}
                stroke={line.isOpening ? "#e74c3c" : "#2c3e50"}
                strokeWidth={3}
                strokeDasharray={line.isOpening ? "8,4" : undefined}
                pointerEvents="none"
              />
            )
          })}
          
          {/* Current line being drawn */}
          {currentLine && (
            <line
              x1={gridToPixel(currentLine.start).x}
              y1={gridToPixel(currentLine.start).y}
              x2={gridToPixel(currentLine.end).x}
              y2={gridToPixel(currentLine.end).y}
              stroke={currentLine.isOpening ? "#e74c3c" : "#3498db"}
              strokeWidth={2}
              strokeDasharray={currentLine.isOpening ? "8,4" : "5,5"}
              pointerEvents="none"
            />
          )}
          
          {/* Detected rooms preview */}
          {detectedRooms.map((room, idx) => (
            <polygon
              key={`room-${idx}`}
              points={room.map(p => `${p.x},${p.y}`).join(' ')}
              fill="rgba(46, 204, 113, 0.2)"
              stroke="#2ecc71"
              strokeWidth={2}
              pointerEvents="none"
            />
          ))}
        </svg>
        
        <div style={{ marginTop: 12, display: 'flex', gap: 8, justifyContent: 'space-between' }}>
          <div>
            <small style={{ color: '#666' }}>
              Detected rooms: {detectedRooms.length}
            </small>
          </div>
          <div style={{ display: 'flex', gap: 8 }}>
            <button onClick={handleUndo} disabled={lineSegments.length === 0}>
              Undo
            </button>
            <button onClick={handleClear} disabled={lineSegments.length === 0}>
              Clear
            </button>
            <button onClick={onCancel}>Cancel</button>
            <button
              onClick={handleProceedToNaming}
              disabled={detectedRooms.length === 0}
              style={{ background: '#3498db', color: '#fff' }}
            >
              Next: Name Rooms
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}

// Inline styles to avoid new CSS file for initial implementation
const overlayStyle: React.CSSProperties = {
  position: 'fixed',
  top: 0,
  left: 0,
  width: '100vw',
  height: '100vh',
  background: 'rgba(0,0,0,0.4)',
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center',
  zIndex: 1000,
}

const containerStyle: React.CSSProperties = {
  background: '#fefefe',
  padding: 20,
  borderRadius: 8,
  boxShadow: '0 2px 10px rgba(0,0,0,0.2)',
  maxWidth: '500px',
}

const namingContainerStyle: React.CSSProperties = {
  ...containerStyle,
  maxWidth: '600px',
} 