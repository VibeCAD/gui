import { DynamicTexture, Scene, Texture } from 'babylonjs'

/**
 * Creates a grid texture using DynamicTexture that matches the drawing tool grid
 * @param scene The Babylon.js scene
 * @param gridSize The size of each grid cell in drawing units (pixels from the drawing tool)
 * @param textureSize The size of the texture in pixels (should be power of 2)
 * @param worldScale The scale factor from drawing units to world units
 * @param options Additional options for customizing the grid appearance
 * @returns A DynamicTexture with the grid pattern
 */
export function createGridTexture(
  scene: Scene,
  gridSize: number,
  textureSize: number = 512,
  worldScale: number = 0.05,
  options?: {
    lineColor?: string
    backgroundColor?: string
    lineWidth?: number
    opacity?: number
    showSubGrid?: boolean
    subGridDivisions?: number
  }
): DynamicTexture {
  const {
    lineColor = '#cccccc',
    backgroundColor = '#A0522D',
    lineWidth = 2,
    opacity = 0.8,
    showSubGrid = false,
    subGridDivisions = 4
  } = options || {}

  // Create dynamic texture
  const texture = new DynamicTexture(`gridTexture-${Date.now()}`, textureSize, scene, false)
  const ctx = texture.getContext()

  // Clear with background color
  ctx.fillStyle = backgroundColor
  ctx.fillRect(0, 0, textureSize, textureSize)

  // The texture represents one grid cell, so we draw the grid lines at the edges
  ctx.strokeStyle = lineColor
  ctx.lineWidth = lineWidth

  // Draw grid lines at edges
  ctx.beginPath()
  // Top edge
  ctx.moveTo(0, 0)
  ctx.lineTo(textureSize, 0)
  // Left edge
  ctx.moveTo(0, 0)
  ctx.lineTo(0, textureSize)
  ctx.stroke()

  // Draw sub-grid if enabled
  if (showSubGrid) {
    ctx.strokeStyle = lineColor + '40' // 25% opacity
    ctx.lineWidth = lineWidth * 0.5
    const subGridSpacing = textureSize / subGridDivisions

    for (let i = 1; i < subGridDivisions; i++) {
      const pos = i * subGridSpacing
      
      // Vertical sub-grid lines
      ctx.beginPath()
      ctx.moveTo(pos, 0)
      ctx.lineTo(pos, textureSize)
      ctx.stroke()

      // Horizontal sub-grid lines
      ctx.beginPath()
      ctx.moveTo(0, pos)
      ctx.lineTo(textureSize, pos)
      ctx.stroke()
    }
  }

  // Update the texture
  texture.update()

  // Set texture properties for proper tiling
  texture.wrapU = Texture.WRAP_ADDRESSMODE
  texture.wrapV = Texture.WRAP_ADDRESSMODE

  return texture
}

/**
 * Calculates UV scale for a floor mesh to properly display the grid
 * The grid should match exactly the number of cells from the drawing tool
 * @param floorWidth Width of the floor in world units
 * @param floorHeight Height (depth) of the floor in world units
 * @param gridSize Size of each grid cell in drawing units (pixels)
 * @param worldScale Scale factor from drawing units to world units
 * @returns UV scale factors for U and V coordinates
 */
export function calculateGridUVScale(
  floorWidth: number,
  floorHeight: number,
  gridSize: number,
  worldScale: number
): { u: number; v: number } {
  // Calculate the size of one grid cell in world units
  const gridWorldSize = gridSize * worldScale
  
  // Calculate how many grid cells fit in the floor dimensions
  const cellsX = floorWidth / gridWorldSize
  const cellsZ = floorHeight / gridWorldSize

  // UV scale represents how many times the texture repeats
  // Since each texture represents one grid cell, the UV scale equals the number of cells
  return {
    u: cellsX,
    v: cellsZ
  }
}

/**
 * Creates a grid texture that represents the entire drawing area
 * This alternative approach creates a texture matching the full 400x400 drawing space
 */
export function createFullGridTexture(
  scene: Scene,
  gridSize: number,
  drawingWidth: number = 400,
  drawingHeight: number = 400,
  textureSize: number = 1024,
  options?: {
    lineColor?: string
    backgroundColor?: string
    lineWidth?: number
    opacity?: number
    showSubGrid?: boolean
    subGridDivisions?: number
  }
): DynamicTexture {
  const {
    lineColor = '#cccccc',
    backgroundColor = '#A0522D',
    lineWidth = 2,
    opacity = 0.8,
    showSubGrid = false,
    subGridDivisions = 4
  } = options || {}

  // Create dynamic texture
  const texture = new DynamicTexture(`gridTexture-${Date.now()}`, textureSize, scene, false)
  const ctx = texture.getContext()

  // Clear with background color
  ctx.fillStyle = backgroundColor
  ctx.fillRect(0, 0, textureSize, textureSize)

  // Calculate scale from drawing space to texture space
  const scaleX = textureSize / drawingWidth
  const scaleY = textureSize / drawingHeight
  
  // Grid spacing in texture pixels
  const gridSpacingX = gridSize * scaleX
  const gridSpacingY = gridSize * scaleY

  // Draw sub-grid if enabled
  if (showSubGrid) {
    ctx.strokeStyle = lineColor + '40' // 25% opacity
    ctx.lineWidth = lineWidth * 0.5
    const subGridSpacingX = gridSpacingX / subGridDivisions
    const subGridSpacingY = gridSpacingY / subGridDivisions

    for (let x = 0; x <= textureSize; x += subGridSpacingX) {
      ctx.beginPath()
      ctx.moveTo(x, 0)
      ctx.lineTo(x, textureSize)
      ctx.stroke()
    }

    for (let y = 0; y <= textureSize; y += subGridSpacingY) {
      ctx.beginPath()
      ctx.moveTo(0, y)
      ctx.lineTo(textureSize, y)
      ctx.stroke()
    }
  }

  // Draw main grid
  ctx.strokeStyle = lineColor
  ctx.lineWidth = lineWidth

  // Vertical lines
  for (let x = 0; x <= textureSize; x += gridSpacingX) {
    ctx.beginPath()
    ctx.moveTo(x, 0)
    ctx.lineTo(x, textureSize)
    ctx.stroke()
  }

  // Horizontal lines
  for (let y = 0; y <= textureSize; y += gridSpacingY) {
    ctx.beginPath()
    ctx.moveTo(0, y)
    ctx.lineTo(textureSize, y)
    ctx.stroke()
  }

  // Update the texture
  texture.update()

  // Set texture properties for proper tiling
  texture.wrapU = Texture.WRAP_ADDRESSMODE
  texture.wrapV = Texture.WRAP_ADDRESSMODE

  return texture
}

/**
 * Calculates UV scale for full grid texture approach
 */
export function calculateFullGridUVScale(
  floorWidth: number,
  floorHeight: number,
  drawingWidth: number = 400,
  drawingHeight: number = 400,
  worldScale: number = 0.05
): { u: number; v: number } {
  // Calculate the drawing dimensions in world units
  const drawingWorldWidth = drawingWidth * worldScale
  const drawingWorldHeight = drawingHeight * worldScale
  
  // UV scale is the ratio of floor size to drawing size
  return {
    u: floorWidth / drawingWorldWidth,
    v: floorHeight / drawingWorldHeight
  }
}

/**
 * Snaps a world position to the nearest grid point within a room
 * @param position The world position to snap
 * @param roomMesh The room mesh containing grid information
 * @returns The snapped position
 */
export function snapToRoomGrid(
  position: { x: number; z: number },
  roomMesh: any // Mesh type
): { x: number; z: number } {
  const gridInfo = roomMesh.metadata?.gridInfo
  if (!gridInfo) return position

  const { gridSize, worldScale } = gridInfo
  const gridWorldSize = gridSize * worldScale

  // Get room position offset
  const roomX = roomMesh.position.x
  const roomZ = roomMesh.position.z

  // Convert to local coordinates
  const localX = position.x - roomX
  const localZ = position.z - roomZ

  // Snap to grid
  const snappedLocalX = Math.round(localX / gridWorldSize) * gridWorldSize
  const snappedLocalZ = Math.round(localZ / gridWorldSize) * gridWorldSize

  // Convert back to world coordinates
  return {
    x: snappedLocalX + roomX,
    z: snappedLocalZ + roomZ
  }
}

/**
 * Converts grid coordinates to world coordinates within a room
 * @param gridX Grid X coordinate
 * @param gridZ Grid Z coordinate  
 * @param roomMesh The room mesh containing grid information
 * @returns World position
 */
export function gridToWorld(
  gridX: number,
  gridZ: number,
  roomMesh: any // Mesh type
): { x: number; y: number; z: number } | null {
  const gridInfo = roomMesh.metadata?.gridInfo
  if (!gridInfo) return null

  const { gridSize, worldScale, drawingBounds } = gridInfo
  const gridWorldSize = gridSize * worldScale

  // Get room position
  const roomX = roomMesh.position.x
  const roomY = roomMesh.position.y
  const roomZ = roomMesh.position.z

  // Calculate world position
  // Account for the centered coordinate system
  const centerOffsetX = (drawingBounds?.width || 400) * worldScale / 2
  const centerOffsetZ = (drawingBounds?.height || 400) * worldScale / 2

  return {
    x: roomX + (gridX * gridWorldSize) - centerOffsetX,
    y: roomY,
    z: roomZ + (gridZ * gridWorldSize) - centerOffsetZ
  }
}

/**
 * Convert world coordinates to grid coordinates for a specific room
 * @param worldPos World position with x and z coordinates
 * @param roomMesh The custom room mesh containing grid information
 * @returns Grid coordinates or null if not within a valid room
 */
export function worldToGrid(
  worldPos: { x: number; z: number },
  roomMesh: any
): { x: number; z: number } | null {
  if (!roomMesh.metadata?.gridInfo) return null
  
  const { gridSize, worldScale, drawingBounds } = roomMesh.metadata.gridInfo
  
  // Get room bounds
  const bounds = roomMesh.getBoundingInfo().boundingBox
  const minX = bounds.minimumWorld.x
  const minZ = bounds.minimumWorld.z
  
  // Convert world position to local room coordinates
  const localX = worldPos.x - minX
  const localZ = worldPos.z - minZ
  
  // Convert to drawing units
  const drawingX = localX / worldScale
  const drawingZ = localZ / worldScale
  
  // Convert to grid coordinates
  const gridX = Math.floor(drawingX / gridSize)
  const gridZ = Math.floor(drawingZ / gridSize)
  
  return { x: gridX, z: gridZ }
} 