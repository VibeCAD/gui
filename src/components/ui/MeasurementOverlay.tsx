import React, { useEffect, useState, useRef } from 'react'
import { Scene, Vector3, PointerEventTypes, MeshBuilder, StandardMaterial, Color3, Mesh } from 'babylonjs'
import { useSceneStore } from '../../state/sceneStore'
import { worldToGrid } from '../../babylon/gridTextureUtils'
import './MeasurementOverlay.css'

interface MeasurementOverlayProps {
  scene: Scene | null
}

export const MeasurementOverlay: React.FC<MeasurementOverlayProps> = ({ scene }) => {
  const [mouseGridPosition, setMouseGridPosition] = useState<{ x: number; z: number } | null>(null)
  const [hoveredRoom, setHoveredRoom] = useState<string | null>(null)
  const [measurementMode, setMeasurementMode] = useState(false)
  const [measureStart, setMeasureStart] = useState<Vector3 | null>(null)
  const [measureEnd, setMeasureEnd] = useState<Vector3 | null>(null)
  const [distance, setDistance] = useState<number | null>(null)
  const [gridDistance, setGridDistance] = useState<{ x: number; z: number } | null>(null)
  
  const { showGrid } = useSceneStore()
  const measurementLineRef = useRef<Mesh | null>(null)
  const startPointRef = useRef<Mesh | null>(null)
  const endPointRef = useRef<Mesh | null>(null)

  // Create/update measurement visualization
  const updateMeasurementVisualization = () => {
    if (!scene || !measureStart) return
    
    // Create start point marker
    if (!startPointRef.current) {
      startPointRef.current = MeshBuilder.CreateSphere('measure-start', {
        diameter: 0.1
      }, scene)
      const mat = new StandardMaterial('measure-start-mat', scene)
      mat.diffuseColor = new Color3(0, 1, 0)
      mat.emissiveColor = new Color3(0, 0.5, 0)
      startPointRef.current.material = mat
    }
    startPointRef.current.position = measureStart
    
    // Create/update end point marker and line
    if (measureEnd) {
      // End point marker
      if (!endPointRef.current) {
        endPointRef.current = MeshBuilder.CreateSphere('measure-end', {
          diameter: 0.1
        }, scene)
        const mat = new StandardMaterial('measure-end-mat', scene)
        mat.diffuseColor = new Color3(1, 0, 0)
        mat.emissiveColor = new Color3(0.5, 0, 0)
        endPointRef.current.material = mat
      }
      endPointRef.current.position = measureEnd
      
      // Update line
      if (measurementLineRef.current) {
        measurementLineRef.current.dispose()
      }
      
      const points = [measureStart, measureEnd]
      measurementLineRef.current = MeshBuilder.CreateLines('measure-line', {
        points: points,
        updatable: false
      }, scene)
      
      const mat = new StandardMaterial('measure-line-mat', scene)
      mat.diffuseColor = new Color3(0.2, 0.6, 1)
      mat.emissiveColor = new Color3(0.1, 0.3, 0.5)
      measurementLineRef.current.material = mat
    }
  }

  const clearVisualization = () => {
    if (measurementLineRef.current) {
      measurementLineRef.current.dispose()
      measurementLineRef.current = null
    }
    if (startPointRef.current) {
      startPointRef.current.dispose()
      startPointRef.current = null
    }
    if (endPointRef.current) {
      endPointRef.current.dispose()
      endPointRef.current = null
    }
  }

  useEffect(() => {
    if (!scene || !showGrid) return

    const handlePointerMove = (pointerInfo: any) => {
      if (pointerInfo.type === PointerEventTypes.POINTERMOVE) {
        const pickInfo = scene.pick(scene.pointerX, scene.pointerY)
        
        if (pickInfo.hit && pickInfo.pickedPoint) {
          const point = pickInfo.pickedPoint
          
          // Find if we're hovering over a custom room floor
          let pickedMesh = pickInfo.pickedMesh
          while (pickedMesh && !pickedMesh.name.includes('custom-room')) {
            pickedMesh = pickedMesh.parent as any
          }
          
          if (pickedMesh && pickedMesh.metadata?.gridInfo) {
            // Convert world position to grid coordinates
            const gridPos = worldToGrid(
              { x: point.x, z: point.z },
              pickedMesh
            )
            
            if (gridPos) {
              setMouseGridPosition(gridPos)
              setHoveredRoom(pickedMesh.metadata.roomName || pickedMesh.name)
            }
          } else {
            setMouseGridPosition(null)
            setHoveredRoom(null)
          }
          
          // Update measurement end point if in measurement mode
          if (measurementMode && measureStart) {
            setMeasureEnd(point.clone())
            
            // Calculate distances
            const worldDist = Vector3.Distance(measureStart, point)
            setDistance(worldDist)
            
            // Calculate grid distance if in a room
            if (pickedMesh && pickedMesh.metadata?.gridInfo) {
              const startGrid = worldToGrid(
                { x: measureStart.x, z: measureStart.z },
                pickedMesh
              )
              const endGrid = worldToGrid(
                { x: point.x, z: point.z },
                pickedMesh
              )
              
              if (startGrid && endGrid) {
                setGridDistance({
                  x: Math.abs(endGrid.x - startGrid.x),
                  z: Math.abs(endGrid.z - startGrid.z)
                })
              }
            }
          }
        }
      }
    }

    const handlePointerDown = (pointerInfo: any) => {
      if (pointerInfo.type === PointerEventTypes.POINTERDOWN && measurementMode) {
        const pickInfo = scene.pick(scene.pointerX, scene.pointerY)
        
        if (pickInfo.hit && pickInfo.pickedPoint) {
          if (!measureStart) {
            // Start measurement
            setMeasureStart(pickInfo.pickedPoint.clone())
            setMeasureEnd(null)
            setDistance(null)
            setGridDistance(null)
          } else {
            // End measurement
            setMeasureEnd(pickInfo.pickedPoint.clone())
          }
        }
      }
    }

    scene.onPointerObservable.add(handlePointerMove)
    scene.onPointerObservable.add(handlePointerDown)

    return () => {
      scene.onPointerObservable.removeCallback(handlePointerMove)
      scene.onPointerObservable.removeCallback(handlePointerDown)
    }
  }, [scene, showGrid, measurementMode, measureStart])
  
  // Update visualization when measurement points change
  useEffect(() => {
    if (measurementMode) {
      updateMeasurementVisualization()
    }
  }, [measureStart, measureEnd, measurementMode])
  
  // Clean up visualization when component unmounts or measurement mode is disabled
  useEffect(() => {
    return () => {
      clearVisualization()
    }
  }, [])

  const toggleMeasurementMode = () => {
    setMeasurementMode(!measurementMode)
    if (!measurementMode) {
      // Reset measurement when enabling
      setMeasureStart(null)
      setMeasureEnd(null)
      setDistance(null)
      setGridDistance(null)
    } else {
      // Clear visualization when disabling
      clearVisualization()
    }
  }

  const clearMeasurement = () => {
    setMeasureStart(null)
    setMeasureEnd(null)
    setDistance(null)
    setGridDistance(null)
    clearVisualization()
  }

  if (!showGrid) return null

  return (
    <div className="measurement-overlay">
      {/* Grid Coordinates Display */}
      {mouseGridPosition && hoveredRoom && (
        <div className="grid-coordinates">
          <div className="room-name">{hoveredRoom}</div>
          <div className="coordinates">
            Grid: ({mouseGridPosition.x}, {mouseGridPosition.z})
          </div>
        </div>
      )}
      
      {/* Measurement Controls */}
      <div className="measurement-controls">
        <button 
          className={`measurement-button ${measurementMode ? 'active' : ''}`}
          onClick={toggleMeasurementMode}
          title={measurementMode ? 'Exit measurement mode' : 'Enter measurement mode'}
        >
          📏 {measurementMode ? 'Exit Measure' : 'Measure'}
        </button>
        
        {measurementMode && measureStart && (
          <button 
            className="measurement-button clear"
            onClick={clearMeasurement}
            title="Clear measurement"
          >
            ❌ Clear
          </button>
        )}
      </div>
      
      {/* Measurement Display */}
      {measurementMode && distance !== null && (
        <div className="measurement-display">
          <div className="measurement-title">Distance</div>
          <div className="measurement-value">
            {distance.toFixed(2)}m
          </div>
          {gridDistance && (
            <>
              <div className="grid-measurement">
                Grid X: {gridDistance.x} cells
              </div>
              <div className="grid-measurement">
                Grid Z: {gridDistance.z} cells
              </div>
              <div className="grid-measurement total">
                Total: {Math.sqrt(gridDistance.x ** 2 + gridDistance.z ** 2).toFixed(1)} cells
              </div>
            </>
          )}
        </div>
      )}
      
      {/* Measurement Instructions */}
      {measurementMode && (
        <div className="measurement-instructions">
          {!measureStart ? 
            'Click to set start point' : 
            measureEnd ? 
              'Click to start new measurement' : 
              'Click to set end point'
          }
        </div>
      )}
    </div>
  )
} 