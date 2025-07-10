import { Vector3, Color3, Camera, Scene, AbstractMesh } from 'babylonjs'

export interface MinimapObject {
  id: string
  position: Vector3
  rotation: number
  size: Vector3
  color: Color3
  type: string
  selected: boolean
  locked: boolean
  visible: boolean
}

export interface MinimapCamera {
  position: Vector3
  direction: Vector3
  fov: number
  type: 'arc' | 'free' | 'universal'
}

export interface MinimapBounds {
  minX: number
  maxX: number
  minZ: number
  maxZ: number
  width: number
  height: number
}

export interface MinimapViewport {
  x: number
  y: number
  width: number
  height: number
  scale: number
  offsetX: number
  offsetY: number
}

export interface MinimapRenderOptions {
  showGrid: boolean
  showLabels: boolean
  showCompass: boolean
  showScale: boolean
  showGroundPlane: boolean
  backgroundColor: string
  gridColor: string
  cameraColor: string
  selectionColor: string
  objectFilter?: (object: MinimapObject) => boolean
}

export class MinimapRenderer {
  private canvas: HTMLCanvasElement
  private context: CanvasRenderingContext2D
  private objects: MinimapObject[] = []
  private camera: MinimapCamera | null = null
  private bounds: MinimapBounds = { minX: 0, maxX: 0, minZ: 0, maxZ: 0, width: 0, height: 0 }
  private viewport: MinimapViewport = { x: 0, y: 0, width: 0, height: 0, scale: 1, offsetX: 0, offsetY: 0 }
  private options: MinimapRenderOptions
  private lastRenderTime = 0
  private frameCount = 0
  private averageFrameTime = 0

  constructor(canvas: HTMLCanvasElement, options: Partial<MinimapRenderOptions> = {}) {
    this.canvas = canvas
    const context = canvas.getContext('2d')
    if (!context) {
      throw new Error('Failed to get 2D context from canvas')
    }
    this.context = context
    
    this.options = {
      showGrid: false,
      showLabels: false,
      showCompass: true,
      showScale: true,
      showGroundPlane: true,
      backgroundColor: 'rgba(20, 20, 20, 0.8)',
      gridColor: 'rgba(255, 255, 255, 0.1)',
      cameraColor: '#00ff00',
      selectionColor: '#007acc',
      ...options
    }

    this.initializeViewport()
    console.log('🗺️ MinimapRenderer initialized')
  }

  private initializeViewport(): void {
    this.viewport = {
      x: 0,
      y: 0,
      width: this.canvas.width,
      height: this.canvas.height,
      scale: 1,
      offsetX: 0,
      offsetY: 0
    }
  }

  public updateObjects(objects: MinimapObject[]): void {
    this.objects = objects
    this.updateBounds()
    this.updateViewport()
  }

  public updateCamera(camera: MinimapCamera): void {
    this.camera = camera
  }

  public updateOptions(options: Partial<MinimapRenderOptions>): void {
    this.options = { ...this.options, ...options }
  }

  private updateBounds(): void {
    if (this.objects.length === 0) {
      this.bounds = { minX: -10, maxX: 10, minZ: -10, maxZ: 10, width: 20, height: 20 }
      return
    }

    let minX = Infinity
    let maxX = -Infinity
    let minZ = Infinity
    let maxZ = -Infinity

    for (const obj of this.objects) {
      if (!obj.visible) continue
      
      const halfSizeX = obj.size.x / 2
      const halfSizeZ = obj.size.z / 2
      
      minX = Math.min(minX, obj.position.x - halfSizeX)
      maxX = Math.max(maxX, obj.position.x + halfSizeX)
      minZ = Math.min(minZ, obj.position.z - halfSizeZ)
      maxZ = Math.max(maxZ, obj.position.z + halfSizeZ)
    }

    // Add padding
    const padding = Math.max((maxX - minX) * 0.1, (maxZ - minZ) * 0.1, 2)
    minX -= padding
    maxX += padding
    minZ -= padding
    maxZ += padding

    this.bounds = {
      minX,
      maxX,
      minZ,
      maxZ,
      width: maxX - minX,
      height: maxZ - minZ
    }
  }

  private updateViewport(): void {
    const canvasAspect = this.canvas.width / this.canvas.height
    const boundsAspect = this.bounds.width / this.bounds.height

    if (boundsAspect > canvasAspect) {
      // Bounds are wider than canvas
      this.viewport.scale = this.canvas.width / this.bounds.width
      this.viewport.width = this.canvas.width
      this.viewport.height = this.canvas.width / boundsAspect
      this.viewport.x = 0
      this.viewport.y = (this.canvas.height - this.viewport.height) / 2
    } else {
      // Bounds are taller than canvas
      this.viewport.scale = this.canvas.height / this.bounds.height
      this.viewport.width = this.canvas.height * boundsAspect
      this.viewport.height = this.canvas.height
      this.viewport.x = (this.canvas.width - this.viewport.width) / 2
      this.viewport.y = 0
    }
  }

  public render(): void {
    const startTime = performance.now()
    
    this.clearCanvas()
    
    if (this.options.showGroundPlane) {
      this.renderGroundPlane()
    }
    
    if (this.options.showGrid) {
      this.renderGrid()
    }
    
    this.renderObjects()
    
    if (this.camera) {
      this.renderCamera()
    }
    
    if (this.options.showCompass) {
      this.renderCompass()
    }
    
    if (this.options.showScale) {
      this.renderScale()
    }
    
    // Performance tracking
    const endTime = performance.now()
    const frameTime = endTime - startTime
    this.frameCount++
    this.averageFrameTime = (this.averageFrameTime * (this.frameCount - 1) + frameTime) / this.frameCount
    
    if (frameTime > 5) {
      console.warn('⚠️ Minimap frame took too long:', frameTime.toFixed(2) + 'ms')
    }
  }

  private clearCanvas(): void {
    this.context.fillStyle = this.options.backgroundColor
    this.context.fillRect(0, 0, this.canvas.width, this.canvas.height)
  }

  private renderGroundPlane(): void {
    this.context.fillStyle = 'rgba(40, 40, 40, 0.3)'
    this.context.fillRect(
      this.viewport.x,
      this.viewport.y,
      this.viewport.width,
      this.viewport.height
    )
  }

  private renderGrid(): void {
    this.context.strokeStyle = this.options.gridColor
    this.context.lineWidth = 1
    
    const gridSize = 5 // World units
    const gridSpacing = gridSize * this.viewport.scale
    
    // Don't draw grid if it would be too dense
    if (gridSpacing < 10) return
    
    this.context.beginPath()
    
    // Vertical lines
    for (let x = this.bounds.minX; x <= this.bounds.maxX; x += gridSize) {
      const canvasX = this.worldToCanvasX(x)
      this.context.moveTo(canvasX, this.viewport.y)
      this.context.lineTo(canvasX, this.viewport.y + this.viewport.height)
    }
    
    // Horizontal lines
    for (let z = this.bounds.minZ; z <= this.bounds.maxZ; z += gridSize) {
      const canvasY = this.worldToCanvasY(z)
      this.context.moveTo(this.viewport.x, canvasY)
      this.context.lineTo(this.viewport.x + this.viewport.width, canvasY)
    }
    
    this.context.stroke()
  }

  private renderObjects(): void {
    // Sort objects by selection state (selected objects on top)
    const sortedObjects = [...this.objects].sort((a, b) => {
      if (a.selected && !b.selected) return 1
      if (!a.selected && b.selected) return -1
      return 0
    })

    for (const obj of sortedObjects) {
      if (!obj.visible) continue
      if (this.options.objectFilter && !this.options.objectFilter(obj)) continue
      
      this.renderObject(obj)
    }
  }

  private renderObject(obj: MinimapObject): void {
    const canvasX = this.worldToCanvasX(obj.position.x)
    const canvasY = this.worldToCanvasY(obj.position.z)
    const sizeX = obj.size.x * this.viewport.scale
    const sizeZ = obj.size.z * this.viewport.scale
    
    // Don't render very small objects
    if (sizeX < 2 && sizeZ < 2) return

    this.context.save()
    this.context.translate(canvasX, canvasY)
    this.context.rotate(-obj.rotation) // Negative for proper orientation
    
    // Object fill
    if (obj.selected) {
      this.context.fillStyle = this.options.selectionColor
    } else {
      this.context.fillStyle = `rgb(${obj.color.r * 255}, ${obj.color.g * 255}, ${obj.color.b * 255})`
    }
    
    this.context.fillRect(-sizeX / 2, -sizeZ / 2, sizeX, sizeZ)
    
    // Object outline
    this.context.strokeStyle = obj.locked ? 'rgba(255, 255, 0, 0.8)' : 'rgba(255, 255, 255, 0.3)'
    this.context.lineWidth = obj.selected ? 2 : 1
    this.context.strokeRect(-sizeX / 2, -sizeZ / 2, sizeX, sizeZ)
    
    this.context.restore()
    
    // Object label
    if (this.options.showLabels && sizeX > 20 && sizeZ > 20) {
      this.context.fillStyle = 'rgba(255, 255, 255, 0.8)'
      this.context.font = '10px Arial'
      this.context.textAlign = 'center'
      this.context.fillText(obj.type, canvasX, canvasY + 3)
    }
  }

  private renderCamera(): void {
    if (!this.camera) return

    const canvasX = this.worldToCanvasX(this.camera.position.x)
    const canvasY = this.worldToCanvasY(this.camera.position.z)
    
    // Camera position dot
    this.context.fillStyle = this.options.cameraColor
    this.context.beginPath()
    this.context.arc(canvasX, canvasY, 4, 0, 2 * Math.PI)
    this.context.fill()
    
    // Camera direction and FOV
    const dirLength = 20
    const fovRadians = this.camera.fov * Math.PI / 180
    const dirX = Math.sin(-this.camera.direction.y) * dirLength
    const dirY = Math.cos(-this.camera.direction.y) * dirLength
    
    this.context.strokeStyle = this.options.cameraColor
    this.context.lineWidth = 2
    
    // Direction line
    this.context.beginPath()
    this.context.moveTo(canvasX, canvasY)
    this.context.lineTo(canvasX + dirX, canvasY + dirY)
    this.context.stroke()
    
    // FOV cone
    this.context.lineWidth = 1
    this.context.strokeStyle = `${this.options.cameraColor}80`
    this.context.beginPath()
    this.context.moveTo(canvasX, canvasY)
    this.context.lineTo(
      canvasX + Math.cos(-this.camera.direction.y + fovRadians / 2) * dirLength,
      canvasY + Math.sin(-this.camera.direction.y + fovRadians / 2) * dirLength
    )
    this.context.moveTo(canvasX, canvasY)
    this.context.lineTo(
      canvasX + Math.cos(-this.camera.direction.y - fovRadians / 2) * dirLength,
      canvasY + Math.sin(-this.camera.direction.y - fovRadians / 2) * dirLength
    )
    this.context.stroke()
  }

  private renderCompass(): void {
    const compassX = this.canvas.width - 30
    const compassY = 30
    const compassRadius = 15
    
    // Compass background
    this.context.fillStyle = 'rgba(0, 0, 0, 0.5)'
    this.context.beginPath()
    this.context.arc(compassX, compassY, compassRadius, 0, 2 * Math.PI)
    this.context.fill()
    
    // North arrow
    this.context.strokeStyle = 'rgba(255, 255, 255, 0.8)'
    this.context.fillStyle = 'rgba(255, 0, 0, 0.8)'
    this.context.lineWidth = 2
    
    this.context.beginPath()
    this.context.moveTo(compassX, compassY - compassRadius + 3)
    this.context.lineTo(compassX - 3, compassY - compassRadius + 8)
    this.context.lineTo(compassX + 3, compassY - compassRadius + 8)
    this.context.closePath()
    this.context.fill()
    this.context.stroke()
    
    // N label
    this.context.fillStyle = 'rgba(255, 255, 255, 0.8)'
    this.context.font = '8px Arial'
    this.context.textAlign = 'center'
    this.context.fillText('N', compassX, compassY - compassRadius + 15)
  }

  private renderScale(): void {
    const scaleX = 10
    const scaleY = this.canvas.height - 20
    const scaleLength = 50
    const worldLength = scaleLength / this.viewport.scale
    
    // Scale line
    this.context.strokeStyle = 'rgba(255, 255, 255, 0.8)'
    this.context.lineWidth = 2
    this.context.beginPath()
    this.context.moveTo(scaleX, scaleY)
    this.context.lineTo(scaleX + scaleLength, scaleY)
    this.context.stroke()
    
    // Scale ticks
    this.context.beginPath()
    this.context.moveTo(scaleX, scaleY - 3)
    this.context.lineTo(scaleX, scaleY + 3)
    this.context.moveTo(scaleX + scaleLength, scaleY - 3)
    this.context.lineTo(scaleX + scaleLength, scaleY + 3)
    this.context.stroke()
    
    // Scale label
    this.context.fillStyle = 'rgba(255, 255, 255, 0.8)'
    this.context.font = '10px Arial'
    this.context.textAlign = 'center'
    this.context.fillText(
      worldLength < 1 ? `${(worldLength * 100).toFixed(0)}cm` : `${worldLength.toFixed(1)}m`,
      scaleX + scaleLength / 2,
      scaleY - 8
    )
  }

  // Coordinate conversion methods
  private worldToCanvasX(worldX: number): number {
    return this.viewport.x + (worldX - this.bounds.minX) * this.viewport.scale
  }

  private worldToCanvasY(worldZ: number): number {
    return this.viewport.y + (worldZ - this.bounds.minZ) * this.viewport.scale
  }

  public canvasToWorldX(canvasX: number): number {
    return this.bounds.minX + (canvasX - this.viewport.x) / this.viewport.scale
  }

  public canvasToWorldZ(canvasY: number): number {
    return this.bounds.minZ + (canvasY - this.viewport.y) / this.viewport.scale
  }

  // Utility methods
  public getObjectAtPosition(canvasX: number, canvasY: number): MinimapObject | null {
    const worldX = this.canvasToWorldX(canvasX)
    const worldZ = this.canvasToWorldZ(canvasY)
    
    for (const obj of this.objects) {
      if (!obj.visible) continue
      
      const halfSizeX = obj.size.x / 2
      const halfSizeZ = obj.size.z / 2
      
      if (
        worldX >= obj.position.x - halfSizeX &&
        worldX <= obj.position.x + halfSizeX &&
        worldZ >= obj.position.z - halfSizeZ &&
        worldZ <= obj.position.z + halfSizeZ
      ) {
        return obj
      }
    }
    
    return null
  }

  public getPerformanceInfo(): { averageFrameTime: number; frameCount: number } {
    return {
      averageFrameTime: this.averageFrameTime,
      frameCount: this.frameCount
    }
  }

  public zoom(factor: number, centerX?: number, centerY?: number): void {
    // TODO: Implement zoom functionality
    console.log('🔍 Minimap zoom:', factor, { centerX, centerY })
  }

  public pan(deltaX: number, deltaY: number): void {
    // TODO: Implement pan functionality
    console.log('🖱️ Minimap pan:', { deltaX, deltaY })
  }

  public resetView(): void {
    this.updateBounds()
    this.updateViewport()
  }
} 