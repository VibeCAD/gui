import React, { useState, useRef, useEffect } from 'react'

interface Point {
  x: number
  y: number
}

interface CustomRoomModalProps {
  isOpen: boolean
  onCancel: () => void
  onCreate: (points: Point[]) => void
}

/**
 * A simple modal that lets the user click points to outline a room shape.
 * Users click to add vertices; the polygon is closed automatically when
 * they click "Create Room".  The coordinate system is screen-space; callers
 * must map to world units.
 */
export const CustomRoomModal: React.FC<CustomRoomModalProps> = ({ isOpen, onCancel, onCreate }) => {
  const [points, setPoints] = useState<Point[]>([])
  const svgRef = useRef<SVGSVGElement | null>(null)

  // Reset points whenever the modal (re)opens
  useEffect(() => {
    if (isOpen) {
      setPoints([])
    }
  }, [isOpen])

  if (!isOpen) return null

  const handleSvgClick = (e: React.MouseEvent<SVGSVGElement, MouseEvent>) => {
    if (!svgRef.current) return
    const rect = svgRef.current.getBoundingClientRect()
    const x = e.clientX - rect.left
    const y = e.clientY - rect.top
    setPoints(prev => [...prev, { x, y }])
  }

  const handleUndo = () => {
    setPoints(prev => prev.slice(0, -1))
  }

  const handleClear = () => {
    setPoints([])
  }

  const handleCreate = () => {
    if (points.length < 3) return // need at least triangle
    onCreate(points)
  }

  // Build polyline string for SVG <polyline>
  const polyPoints = points.map(p => `${p.x},${p.y}`).join(' ')

  return (
    <div className="modal-overlay" style={overlayStyle}>
      <div className="modal-container" style={containerStyle}>
        <h2 style={{ marginTop: 0 }}>Draw Custom Room Shape</h2>
        <svg
          ref={svgRef}
          width={400}
          height={400}
          style={{ border: '1px solid #ccc', background: '#fff', cursor: 'crosshair' }}
          onClick={handleSvgClick}
        >
          {points.length > 0 && (
            <polyline
              points={polyPoints}
              fill="none"
              stroke="#3498db"
              strokeWidth={2}
            />
          )}
          {points.length > 2 && (
            // show closing line to first point for preview
            <line
              x1={points[points.length - 1].x}
              y1={points[points.length - 1].y}
              x2={points[0].x}
              y2={points[0].y}
              stroke="#3498db"
              strokeWidth={2}
            />
          )}
          {/* Draw points */}
          {points.map((p, idx) => (
            <circle key={idx} cx={p.x} cy={p.y} r={4} fill="#e74c3c" />
          ))}
        </svg>
        <div style={{ marginTop: 12, display: 'flex', gap: 8, justifyContent: 'flex-end' }}>
          <button onClick={handleUndo} disabled={points.length === 0}>Undo</button>
          <button onClick={handleClear} disabled={points.length === 0}>Clear</button>
          <button onClick={onCancel}>Cancel</button>
          <button
            onClick={handleCreate}
            disabled={points.length < 3}
            style={{ background: '#3498db', color: '#fff' }}
          >
            Create Room
          </button>
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
} 