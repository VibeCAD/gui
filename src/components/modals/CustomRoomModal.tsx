import React, { useState, useRef, useEffect } from 'react'

interface Point {
  x: number
  y: number
}

interface GridPoint {
  x: number
  y: number
}

interface LineSegment {
  start: GridPoint
  end: GridPoint
  id: string
}

interface CustomRoomModalProps {
  isOpen: boolean
  onCancel: () => void
  onCreate: (points: Point[]) => void
}

/**
 * A grid-based room drawing tool that lets users draw lines along a grid
 * to create room shapes. Users can only draw horizontal and vertical lines
 * along the grid intersections.
 */
export const CustomRoomModal: React.FC<CustomRoomModalProps> = ({ isOpen, onCancel, onCreate }) => {
  const [lineSegments, setLineSegments] = useState<LineSegment[]>([])
  const [isDrawing, setIsDrawing] = useState(false)
  const [currentLine, setCurrentLine] = useState<LineSegment | null>(null)
  const [hoveredGridPoint, setHoveredGridPoint] = useState<GridPoint | null>(null)
  const svgRef = useRef<SVGSVGElement | null>(null)

  // Grid settings
  const GRID_SIZE = 20
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
      id: `line-${Date.now()}`
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

  // Find enclosed areas (rooms) from the line segments
  const findRooms = (): Point[][] => {
    if (lineSegments.length < 3) return []

    // Build a graph of connected line segments
    const graph = new Map<string, GridPoint[]>()
    
    // Add all line segments to the graph
    lineSegments.forEach(line => {
      const startKey = `${line.start.x},${line.start.y}`
      const endKey = `${line.end.x},${line.end.y}`
      
      if (!graph.has(startKey)) graph.set(startKey, [])
      if (!graph.has(endKey)) graph.set(endKey, [])
      
      graph.get(startKey)!.push(line.end)
      graph.get(endKey)!.push(line.start)
    })
    
    // Find all closed polygons using cycle detection
    const rooms: Point[][] = []
    const visited = new Set<string>()
    
    const findCycle = (start: GridPoint, current: GridPoint, path: GridPoint[], pathSet: Set<string>): boolean => {
      const currentKey = `${current.x},${current.y}`
      
      if (path.length > 2 && current.x === start.x && current.y === start.y) {
        // Found a cycle! Convert to room polygon
        const roomPoints = path.map(p => ({
          x: p.x * GRID_SIZE,
          y: p.y * GRID_SIZE
        }))
        
        // Check if this room is already found (avoid duplicates)
        const isDuplicate = rooms.some(room => {
          if (room.length !== roomPoints.length) return false
          
          // Check if rooms have the same points (allowing for different starting points)
          for (let offset = 0; offset < room.length; offset++) {
            let matches = true
            for (let i = 0; i < room.length; i++) {
              const roomIdx = (i + offset) % room.length
              if (room[roomIdx].x !== roomPoints[i].x || room[roomIdx].y !== roomPoints[i].y) {
                matches = false
                break
              }
            }
            if (matches) return true
          }
          return false
        })
        
        if (!isDuplicate && roomPoints.length >= 3) {
          // Ensure the polygon is properly ordered (counter-clockwise)
          const orderedPoints = orderPointsCounterClockwise(roomPoints)
          rooms.push(orderedPoints)
        }
        return true
      }
      
      if (pathSet.has(currentKey)) return false
      
      const neighbors = graph.get(currentKey) || []
      let foundCycle = false
      
      for (const neighbor of neighbors) {
        const neighborKey = `${neighbor.x},${neighbor.y}`
        
        // Don't go back to the previous point (unless it's the start and we have a valid path)
        if (path.length > 1 && neighbor.x === path[path.length - 2].x && neighbor.y === path[path.length - 2].y) {
          continue
        }
        
        if (neighbor.x === start.x && neighbor.y === start.y && path.length > 2) {
          // Found cycle back to start
          foundCycle = findCycle(start, neighbor, [...path, current], new Set([...pathSet, currentKey])) || foundCycle
        } else if (!pathSet.has(neighborKey)) {
          // Continue exploring
          foundCycle = findCycle(start, neighbor, [...path, current], new Set([...pathSet, currentKey])) || foundCycle
        }
      }
      
      return foundCycle
    }
    
    // Try to find cycles starting from each point
    for (const [pointKey, neighbors] of graph) {
      if (visited.has(pointKey)) continue
      
      const [x, y] = pointKey.split(',').map(Number)
      const startPoint = { x, y }
      
      findCycle(startPoint, startPoint, [], new Set())
      visited.add(pointKey)
    }
    
    return rooms
  }
  
  // Helper function to order points counter-clockwise
  const orderPointsCounterClockwise = (points: Point[]): Point[] => {
    // Find the centroid
    const centroid = points.reduce(
      (acc, point) => ({ x: acc.x + point.x, y: acc.y + point.y }),
      { x: 0, y: 0 }
    )
    centroid.x /= points.length
    centroid.y /= points.length
    
    // Sort points by angle from centroid
    const sortedPoints = points.slice().sort((a, b) => {
      const angleA = Math.atan2(a.y - centroid.y, a.x - centroid.x)
      const angleB = Math.atan2(b.y - centroid.y, b.x - centroid.x)
      return angleA - angleB
    })
    
    return sortedPoints
  }

  const handleCreateRooms = () => {
    const rooms = findRooms()
    if (rooms.length === 0) return

    // For now, create the first detected room
    // In the future, you might want to let users select which room to create
    onCreate(rooms[0])
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

  return (
    <div className="modal-overlay" style={overlayStyle}>
      <div className="modal-container" style={containerStyle}>
        <h2 style={{ marginTop: 0 }}>Draw Room Layout</h2>
        <p style={{ fontSize: '14px', color: '#666', marginBottom: '16px' }}>
          Draw lines along the grid to create room shapes. Lines can only be horizontal or vertical.
        </p>
        
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
                stroke="#2c3e50"
                strokeWidth={3}
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
              stroke="#3498db"
              strokeWidth={2}
              strokeDasharray="5,5"
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
              onClick={handleCreateRooms}
              disabled={detectedRooms.length === 0}
              style={{ background: '#3498db', color: '#fff' }}
            >
              Create Room{detectedRooms.length > 1 ? 's' : ''}
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