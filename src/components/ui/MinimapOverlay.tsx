import React, { useRef, useEffect, useState, useCallback } from 'react'
import './MinimapOverlay.css'
import { MinimapRenderer } from '../../babylon/minimapRenderer'
import { SceneDataAdapter } from '../../babylon/sceneDataAdapter'
import { SceneManager } from '../../babylon/sceneManager'
import { useSceneStore } from '../../state/sceneStore'

export type MinimapPosition = 'top-left' | 'top-right' | 'bottom-left' | 'bottom-right'
export type MinimapSize = 'small' | 'medium' | 'large'

export interface MinimapProps {
  position?: MinimapPosition
  size?: MinimapSize
  opacity?: number
  visible?: boolean
  showGrid?: boolean
  showLabels?: boolean
  sceneManager?: SceneManager
  onPositionChange?: (position: MinimapPosition) => void
  onSizeChange?: (size: MinimapSize) => void
  onOpacityChange?: (opacity: number) => void
  onVisibilityChange?: (visible: boolean) => void
  onCameraMove?: (worldX: number, worldZ: number) => void
  onObjectSelect?: (objectId: string) => void
}

interface MinimapDimensions {
  width: number
  height: number
}

const SIZE_PRESETS: Record<MinimapSize, MinimapDimensions> = {
  small: { width: 150, height: 150 },
  medium: { width: 250, height: 250 },
  large: { width: 350, height: 350 }
}

export const MinimapOverlay: React.FC<MinimapProps> = ({
  position = 'top-left',
  size = 'medium',
  opacity = 0.85,
  visible = true,
  showGrid = false,
  showLabels = false,
  sceneManager,
  onPositionChange,
  onSizeChange,
  onOpacityChange,
  onVisibilityChange,
  onCameraMove,
  onObjectSelect
}) => {
  console.log('🗺️ MinimapOverlay component render:', { position, size, opacity, visible })
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const containerRef = useRef<HTMLDivElement>(null)
  const rendererRef = useRef<MinimapRenderer | null>(null)
  const adapterRef = useRef<SceneDataAdapter | null>(null)
  const animationFrameRef = useRef<number | null>(null)
  const [isInteracting, setIsInteracting] = useState(false)
  const [isDragging, setIsDragging] = useState(false)
  const [isInitialized, setIsInitialized] = useState(false)

  // Get state from scene store
  const { selectedObjectId, selectedObjectIds, objectLocked } = useSceneStore()

  // Get dimensions based on size preset
  const dimensions = SIZE_PRESETS[size]

  // Handle canvas click events
  const handleCanvasClick = useCallback((event: React.MouseEvent<HTMLCanvasElement>) => {
    if (!canvasRef.current || isDragging || !rendererRef.current) return

    const canvas = canvasRef.current
    const rect = canvas.getBoundingClientRect()
    const x = event.clientX - rect.left
    const y = event.clientY - rect.top

    // Check if clicking on an object
    const clickedObject = rendererRef.current.getObjectAtPosition(x, y)
    if (clickedObject && onObjectSelect) {
      console.log('🗺️ Object selected:', clickedObject.id)
      onObjectSelect(clickedObject.id)
      return
    }

    // Convert canvas coordinates to world coordinates
    const worldX = rendererRef.current.canvasToWorldX(x)
    const worldZ = rendererRef.current.canvasToWorldZ(y)

    console.log('🗺️ Minimap clicked:', { worldX, worldZ })
    
    // Trigger camera movement
    if (onCameraMove) {
      onCameraMove(worldX, worldZ)
    }
  }, [isDragging, onObjectSelect, onCameraMove])

  // Handle mouse down for drag operations
  const handleMouseDown = useCallback((event: React.MouseEvent<HTMLCanvasElement>) => {
    setIsInteracting(true)
    setIsDragging(false)
    
    // Start drag detection
    const startX = event.clientX
    const startY = event.clientY

    const handleMouseMove = (e: MouseEvent) => {
      const deltaX = Math.abs(e.clientX - startX)
      const deltaY = Math.abs(e.clientY - startY)
      
      if (deltaX > 3 || deltaY > 3) {
        setIsDragging(true)
        // TODO: Handle pan/drag functionality
      }
    }

    const handleMouseUp = () => {
      setIsInteracting(false)
      setTimeout(() => setIsDragging(false), 50) // Prevent click after drag
      document.removeEventListener('mousemove', handleMouseMove)
      document.removeEventListener('mouseup', handleMouseUp)
    }

    document.addEventListener('mousemove', handleMouseMove)
    document.addEventListener('mouseup', handleMouseUp)
  }, [])

  // Handle mouse wheel for zoom
  const handleWheel = useCallback((event: React.WheelEvent<HTMLCanvasElement>) => {
    event.preventDefault()
    const delta = event.deltaY > 0 ? 1.1 : 0.9
    console.log('🔍 Minimap zoom:', delta)
    
    // TODO: Implement zoom functionality
  }, [])

  // Handle right-click context menu
  const handleContextMenu = useCallback((event: React.MouseEvent<HTMLCanvasElement>) => {
    event.preventDefault()
    console.log('🖱️ Minimap right-click')
    
    // TODO: Show context menu
  }, [])

    // Initialize minimap renderer and adapter
  useEffect(() => {
    console.log('🗺️ MinimapOverlay useEffect triggered:', {
      hasCanvas: !!canvasRef.current,
      hasSceneManager: !!sceneManager,
      dimensions,
      showGrid,
      showLabels
    })

    const canvas = canvasRef.current
    if (!canvas || !sceneManager) {
      console.log('🗺️ MinimapOverlay: Missing canvas or sceneManager')
      return
    }

    // Set canvas size
    canvas.width = dimensions.width
    canvas.height = dimensions.height
    console.log('🗺️ Canvas size set:', dimensions)

    try {
      console.log('🗺️ Initializing MinimapRenderer...')
      // Initialize renderer
      const renderer = new MinimapRenderer(canvas, {
        showGrid,
        showLabels,
        showCompass: true,
        showScale: true,
        showGroundPlane: true,
        backgroundColor: 'rgba(20, 20, 20, 0.8)',
        gridColor: 'rgba(255, 255, 255, 0.1)',
        cameraColor: '#00ff00',
        selectionColor: '#007acc'
      })
      rendererRef.current = renderer
      console.log('🗺️ MinimapRenderer created successfully')

      console.log('🗺️ Initializing SceneDataAdapter...')
      // Initialize adapter
      const adapter = new SceneDataAdapter(sceneManager)
      adapterRef.current = adapter
      console.log('🗺️ SceneDataAdapter created successfully')

      setIsInitialized(true)
      console.log('🗺️ Minimap initialized successfully')
    } catch (error) {
      console.error('❌ Failed to initialize minimap:', error)
      setIsInitialized(false)
    }

    // Cleanup on unmount
    return () => {
      console.log('🗺️ MinimapOverlay cleanup')
      if (animationFrameRef.current) {
        cancelAnimationFrame(animationFrameRef.current)
      }
      if (adapterRef.current) {
        adapterRef.current.dispose()
      }
      setIsInitialized(false)
    }
  }, [dimensions, sceneManager, showGrid, showLabels])

  // Render loop for real-time updates
  useEffect(() => {
    if (!isInitialized || !rendererRef.current || !adapterRef.current) return

    const render = () => {
      try {
        // Extract current scene data
        const sceneData = adapterRef.current!.extractSceneData()
        
        // Update renderer with new data
        rendererRef.current!.updateObjects(sceneData.objects)
        rendererRef.current!.updateCamera(sceneData.camera)
        
        // Render the frame
        rendererRef.current!.render()
        
        // Schedule next frame
        animationFrameRef.current = requestAnimationFrame(render)
      } catch (error) {
        console.error('❌ Minimap render error:', error)
        // Continue rendering despite errors
        animationFrameRef.current = requestAnimationFrame(render)
      }
    }

    // Start the render loop
    animationFrameRef.current = requestAnimationFrame(render)

    return () => {
      if (animationFrameRef.current) {
        cancelAnimationFrame(animationFrameRef.current)
      }
    }
  }, [isInitialized])

  // Update renderer options when props change
  useEffect(() => {
    if (!rendererRef.current) return

    rendererRef.current.updateOptions({
      showGrid,
      showLabels
    })
     }, [showGrid, showLabels])

  // Update adapter with current selection and lock state
  useEffect(() => {
    if (!adapterRef.current) return
    
    adapterRef.current.updateSelectionState(selectedObjectId, selectedObjectIds)
    adapterRef.current.updateLockState(objectLocked)
  }, [selectedObjectId, selectedObjectIds, objectLocked])

  // Don't render if not visible
  if (!visible) return null

  return (
    <div
      ref={containerRef}
      className={`minimap-overlay minimap-${position} minimap-${size} ${isInteracting ? 'interacting' : ''}`}
      style={{
        opacity,
        width: dimensions.width,
        height: dimensions.height
      }}
    >
      <canvas
        ref={canvasRef}
        className="minimap-canvas"
        onClick={handleCanvasClick}
        onMouseDown={handleMouseDown}
        onWheel={handleWheel}
        onContextMenu={handleContextMenu}
        style={{
          width: dimensions.width,
          height: dimensions.height
        }}
      />
      
      {/* Loading overlay */}
      {!isInitialized && (
        <div className="minimap-loading">
          <div className="minimap-loading-text">
            {sceneManager ? 'Loading...' : 'No Scene'}
          </div>
        </div>
      )}
      
      {/* Controls overlay */}
      <div className="minimap-controls">
        <button
          className="minimap-toggle-size"
          onClick={() => {
            const sizes: MinimapSize[] = ['small', 'medium', 'large']
            const currentIndex = sizes.indexOf(size)
            const nextSize = sizes[(currentIndex + 1) % sizes.length]
            onSizeChange?.(nextSize)
          }}
          title="Toggle size"
        >
          ⟲
        </button>
        
        <button
          className="minimap-toggle-position"
          onClick={() => {
            const positions: MinimapPosition[] = ['top-left', 'top-right', 'bottom-right', 'bottom-left']
            const currentIndex = positions.indexOf(position)
            const nextPosition = positions[(currentIndex + 1) % positions.length]
            onPositionChange?.(nextPosition)
          }}
          title="Move position"
        >
          ⤴
        </button>
        
        <button
          className="minimap-close"
          onClick={() => onVisibilityChange?.(false)}
          title="Hide minimap"
        >
          ✕
        </button>
      </div>
    </div>
  )
} 