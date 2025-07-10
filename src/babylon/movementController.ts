import { Scene, ArcRotateCamera, Vector3, Engine } from 'babylonjs'

export class MovementController {
  private scene: Scene
  private camera: ArcRotateCamera
  private engine: Engine
  private moveSpeed: number = 0.1
  private sprintMultiplier: number = 2.0
  private keysPressed: Map<string, boolean> = new Map()
  private isEnabled: boolean = false
  private keyDownHandler: (event: KeyboardEvent) => void
  private keyUpHandler: (event: KeyboardEvent) => void
  private renderObserver: any = null
  private lastUpdateTime: number = 0
  private lastFocusCheckTime: number = 0
  private readonly MOVEMENT_UPDATE_INTERVAL = 16 // ~60fps (16.67ms), but capped for consistency
  private readonly FOCUS_CHECK_INTERVAL = 100 // Check input focus every 100ms for performance
  private cachedInputFocused: boolean = false

  constructor(scene: Scene, camera: ArcRotateCamera, engine: Engine) {
    this.scene = scene
    this.camera = camera
    this.engine = engine
    
    // Check browser compatibility
    if (!this.checkBrowserCompatibility()) {
      console.warn('⚠️ Some movement control features may not work in this browser')
    }
    
    // Bind event handlers
    this.keyDownHandler = this.onKeyDown.bind(this)
    this.keyUpHandler = this.onKeyUp.bind(this)
    
    // Set up render loop observer for frame-rate independent movement
    this.renderObserver = this.scene.onBeforeRenderObservable.add(() => {
      if (this.isEnabled) {
        this.updateMovement()
      }
    })
  }

  private checkBrowserCompatibility(): boolean {
    const issues: string[] = []
    
    // Check for Map support (IE11+)
    if (typeof Map === 'undefined') {
      issues.push('Map not supported')
    }
    
    // Check for performance.now support (IE10+)
    if (!window.performance || typeof window.performance.now !== 'function') {
      issues.push('performance.now not supported')
    }
    
    // Check for addEventListener support (IE9+)
    if (!document.addEventListener) {
      issues.push('addEventListener not supported')
    }
    
    // Check for arrow function support would be handled by build process
    
    if (issues.length > 0) {
      console.warn('Browser compatibility issues detected:', issues)
      return false
    }
    
    return true
  }

  private onKeyDown(event: KeyboardEvent): void {
    // Only handle movement keys when enabled
    if (!this.isEnabled) return
    
    // Check if user is typing in an input field (cached for performance)
    if (this.shouldCheckInputFocus() && this.isInputFocused()) {
      this.cachedInputFocused = true
      return
    }
    if (this.cachedInputFocused) return
    
    const key = event.key.toLowerCase()
    
    // Handle WASD + QE movement keys
    if (['w', 'a', 's', 'd', 'q', 'e', 'shift'].includes(key)) {
      this.keysPressed.set(key, true)
      event.preventDefault() // Prevent default browser behavior
    }
  }

  private shouldCheckInputFocus(): boolean {
    const now = this.getHighResolutionTime()
    if (now - this.lastFocusCheckTime > this.FOCUS_CHECK_INTERVAL) {
      this.lastFocusCheckTime = now
      this.cachedInputFocused = false // Reset cache
      return true
    }
    return false
  }

  private getHighResolutionTime(): number {
    // Use performance.now() if available, fallback to Date.now()
    if (window.performance && window.performance.now) {
      return window.performance.now()
    }
    return Date.now()
  }

  private onKeyUp(event: KeyboardEvent): void {
    if (!this.isEnabled) return
    
    const key = event.key.toLowerCase()
    
    if (['w', 'a', 's', 'd', 'q', 'e', 'shift'].includes(key)) {
      this.keysPressed.set(key, false)
      event.preventDefault()
    }
  }

  private isInputFocused(): boolean {
    const activeElement = document.activeElement
    
    // Check for input fields and content editable elements
    if (activeElement instanceof HTMLInputElement || 
        activeElement instanceof HTMLTextAreaElement ||
        activeElement?.getAttribute('contenteditable') === 'true') {
      return true
    }
    
    // Check for modal dialogs
    const modals = document.querySelectorAll('[role="dialog"], .modal, .modal-overlay, .api-key-setup')
    if (modals.length > 0) {
      // Check if any modal is visible
      for (const modal of modals) {
        const style = window.getComputedStyle(modal as Element)
        if (style.display !== 'none' && style.visibility !== 'hidden' && style.opacity !== '0') {
          return true
        }
      }
    }
    
    // Check for dropdown menus that might be open
    const dropdowns = document.querySelectorAll('.dropdown-menu.show')
    if (dropdowns.length > 0) {
      return true
    }
    
    return false
  }

  private updateMovement(): void {
    try {
      if (!this.isEnabled || !this.camera) return

      // Validate dependencies during movement
      if (!this.validateDependencies()) {
        console.warn('⚠️ Movement dependencies invalid, disabling controls')
        this.setEnabled(false)
        return
      }

      // Performance optimization: Limit update frequency to maintain 60+ FPS
      const now = this.getHighResolutionTime()
      if (now - this.lastUpdateTime < this.MOVEMENT_UPDATE_INTERVAL) {
        return
      }
      this.lastUpdateTime = now

      // Quick check: if no keys are pressed, skip expensive calculations
      const hasMovementInput = this.keysPressed.get('w') || this.keysPressed.get('a') || 
                               this.keysPressed.get('s') || this.keysPressed.get('d') || 
                               this.keysPressed.get('q') || this.keysPressed.get('e')
      
      if (!hasMovementInput) return

      // Calculate movement vector based on pressed keys
      const moveVector = new Vector3(0, 0, 0)
      
      // Get camera's forward and right vectors (cached for performance)
      const forwardRay = this.camera.getForwardRay()
      if (!forwardRay || !forwardRay.direction) {
        console.warn('⚠️ Invalid camera forward ray')
        return
      }
      
      const forward = forwardRay.direction.normalize()
      const right = Vector3.Cross(forward, Vector3.Up()).normalize()
      
      // Validate vectors
      if (isNaN(forward.x) || isNaN(forward.y) || isNaN(forward.z) ||
          isNaN(right.x) || isNaN(right.y) || isNaN(right.z)) {
        console.warn('⚠️ Invalid movement vectors detected')
        return
      }
      
      // Calculate movement based on pressed keys
      if (this.keysPressed.get('w')) {
        moveVector.addInPlace(forward)
      }
      if (this.keysPressed.get('s')) {
        moveVector.subtractInPlace(forward)
      }
      if (this.keysPressed.get('a')) {
        moveVector.subtractInPlace(right)
      }
      if (this.keysPressed.get('d')) {
        moveVector.addInPlace(right)
      }
      
      // Vertical movement (independent of camera pitch)
      if (this.keysPressed.get('q')) {
        moveVector.y -= 1
      }
      if (this.keysPressed.get('e')) {
        moveVector.y += 1
      }

      // Apply movement if there's any input
      if (moveVector.length() > 0) {
        // Normalize to prevent faster diagonal movement
        moveVector.normalize()
        
        // Apply speed and sprint modifier
        let currentSpeed = this.moveSpeed
        if (this.keysPressed.get('shift')) {
          currentSpeed *= this.sprintMultiplier
        }
        
        // Make movement frame-rate independent but smooth
        const deltaTime = Math.min(this.engine.getDeltaTime() / 1000, 0.033) // Cap at 30fps for stability
        if (isNaN(deltaTime) || deltaTime <= 0) {
          console.warn('⚠️ Invalid deltaTime:', deltaTime)
          return
        }
        
        const scaledMovement = moveVector.scale(currentSpeed * deltaTime * 60) // 60 for 60fps baseline
        
        // Validate scaled movement
        if (isNaN(scaledMovement.x) || isNaN(scaledMovement.y) || isNaN(scaledMovement.z)) {
          console.warn('⚠️ Invalid scaled movement detected')
          return
        }
        
        // FREE-FLYING MOVEMENT: Move camera through space like Minecraft
        // Apply the full scaled movement vector directly (including Y component)
        const currentPosition = this.camera.position.clone()
        const newPosition = currentPosition.add(scaledMovement)
        
        // Validate new position
        if (isNaN(newPosition.x) || isNaN(newPosition.y) || isNaN(newPosition.z)) {
          console.warn('⚠️ Invalid new camera position calculated')
          return
        }
        
        // For true free-flying movement, we need to maintain the camera's current view direction
        // rather than maintaining a fixed target offset. This allows us to fly through space
        // while keeping the same looking direction.
        
        // Get current view direction (normalized forward vector)
        const currentViewDirection = forward.clone()
        
        // Calculate new target position by projecting the view direction from new camera position
        // Use the current radius (distance to target) to maintain the same "look distance"
        const currentRadius = Vector3.Distance(currentPosition, this.camera.getTarget())
        const newTarget = newPosition.add(currentViewDirection.scale(currentRadius))
        
        // Update camera position and target simultaneously for smooth free-flying movement
        this.camera.setPosition(newPosition)
        this.camera.setTarget(newTarget)
      }
    } catch (error) {
      console.error('❌ Error during movement update:', error)
      // Don't disable controls here as it might be a temporary issue
      // Just skip this frame and try again next frame
    }
  }

  public setEnabled(enabled: boolean): void {
    if (this.isEnabled === enabled) return
    
    try {
      this.isEnabled = enabled
      
      if (enabled) {
        // Validate dependencies before enabling
        if (!this.validateDependencies()) {
          console.error('❌ Cannot enable movement controls: missing dependencies')
          this.isEnabled = false
          return
        }
        
        // Add keyboard event listeners
        document.addEventListener('keydown', this.keyDownHandler)
        document.addEventListener('keyup', this.keyUpHandler)
        console.log('✅ WASD movement controls enabled')
      } else {
        // Remove keyboard event listeners
        document.removeEventListener('keydown', this.keyDownHandler)
        document.removeEventListener('keyup', this.keyUpHandler)
        
        // Clear any pressed keys
        this.keysPressed.clear()
        console.log('❌ WASD movement controls disabled')
      }
    } catch (error) {
      console.error('❌ Error toggling movement controls:', error)
      this.isEnabled = false
      this.recoverFromError()
    }
  }

  private validateDependencies(): boolean {
    if (!this.scene || this.scene.isDisposed) {
      console.error('Scene is null or disposed')
      return false
    }
    
    if (!this.camera) {
      console.error('Camera is null')
      return false
    }
    
    if (!this.engine || this.engine.isDisposed) {
      console.error('Engine is null or disposed')
      return false
    }
    
    return true
  }

  private recoverFromError(): void {
    try {
      // Clear all state
      this.keysPressed.clear()
      this.cachedInputFocused = false
      this.lastUpdateTime = 0
      this.lastFocusCheckTime = 0
      
      // Remove any lingering event listeners
      document.removeEventListener('keydown', this.keyDownHandler)
      document.removeEventListener('keyup', this.keyUpHandler)
      
      console.log('🔄 Movement controller state reset')
    } catch (recoveryError) {
      console.error('❌ Failed to recover from movement controller error:', recoveryError)
    }
  }

  public setMoveSpeed(speed: number): void {
    // Clamp speed to reasonable range (0.05 - 1.0 as per PRD)
    this.moveSpeed = Math.max(0.05, Math.min(1.0, speed))
  }

  public getMoveSpeed(): number {
    return this.moveSpeed
  }

  public getEnabled(): boolean {
    return this.isEnabled
  }

  public dispose(): void {
    // Clean up event listeners
    this.setEnabled(false)
    
    // Remove render observer
    if (this.renderObserver) {
      this.scene.onBeforeRenderObservable.remove(this.renderObserver)
      this.renderObserver = null
    }
    
    // Clear key state
    this.keysPressed.clear()
    
    console.log('🧹 MovementController disposed')
  }
} 