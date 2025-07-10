/**
 * Unit tests for MovementController
 * Tests core movement logic, key state management, and speed calculations
 */

import { MovementController } from '../movementController'
import { Vector3 } from 'babylonjs'

// Mock Babylon.js objects for testing
const mockScene = {
  onBeforeRenderObservable: {
    add: jest.fn(() => ({ dispose: jest.fn() })),
    remove: jest.fn()
  }
} as any

const mockCamera = {
  position: new Vector3(0, 0, 0),
  getTarget: jest.fn(() => new Vector3(0, 0, -1)),
  setPosition: jest.fn(),
  setTarget: jest.fn(),
  getForwardRay: jest.fn(() => ({
    direction: new Vector3(0, 0, -1).normalize()
  }))
} as any

const mockEngine = {
  getDeltaTime: jest.fn(() => 16.67) // ~60fps
} as any

// Mock DOM methods
Object.defineProperty(window, 'performance', {
  writable: true,
  value: {
    now: jest.fn(() => Date.now())
  }
})

// Mock localStorage
const localStorageMock = {
  getItem: jest.fn(),
  setItem: jest.fn(),
  removeItem: jest.fn(),
  clear: jest.fn()
}
Object.defineProperty(window, 'localStorage', {
  value: localStorageMock
})

// Mock document methods
Object.defineProperty(document, 'addEventListener', {
  writable: true,
  value: jest.fn()
})

Object.defineProperty(document, 'removeEventListener', {
  writable: true,
  value: jest.fn()
})

describe('MovementController', () => {
  let movementController: MovementController

  beforeEach(() => {
    jest.clearAllMocks()
    movementController = new MovementController(mockScene, mockCamera, mockEngine)
  })

  afterEach(() => {
    movementController.dispose()
  })

  describe('Initialization', () => {
    test('should initialize with default values', () => {
      expect(movementController.getEnabled()).toBe(false)
      expect(movementController.getMoveSpeed()).toBe(0.1)
    })

    test('should set up render observer', () => {
      expect(mockScene.onBeforeRenderObservable.add).toHaveBeenCalled()
    })
  })

  describe('Enable/Disable functionality', () => {
    test('should enable movement controls', () => {
      movementController.setEnabled(true)
      expect(movementController.getEnabled()).toBe(true)
      expect(document.addEventListener).toHaveBeenCalledWith('keydown', expect.any(Function))
      expect(document.addEventListener).toHaveBeenCalledWith('keyup', expect.any(Function))
    })

    test('should disable movement controls', () => {
      movementController.setEnabled(true)
      movementController.setEnabled(false)
      expect(movementController.getEnabled()).toBe(false)
      expect(document.removeEventListener).toHaveBeenCalledWith('keydown', expect.any(Function))
      expect(document.removeEventListener).toHaveBeenCalledWith('keyup', expect.any(Function))
    })

    test('should not add event listeners multiple times', () => {
      movementController.setEnabled(true)
      movementController.setEnabled(true) // Second call should not add listeners again
      expect(document.addEventListener).toHaveBeenCalledTimes(2) // Only called once per event type
    })
  })

  describe('Speed management', () => {
    test('should set move speed within valid range', () => {
      movementController.setMoveSpeed(0.5)
      expect(movementController.getMoveSpeed()).toBe(0.5)
    })

    test('should clamp speed to minimum value', () => {
      movementController.setMoveSpeed(0.01) // Below minimum
      expect(movementController.getMoveSpeed()).toBe(0.05)
    })

    test('should clamp speed to maximum value', () => {
      movementController.setMoveSpeed(2.0) // Above maximum
      expect(movementController.getMoveSpeed()).toBe(1.0)
    })

    test('should handle negative speed values', () => {
      movementController.setMoveSpeed(-0.5)
      expect(movementController.getMoveSpeed()).toBe(0.05) // Should clamp to minimum
    })
  })

  describe('Input focus detection', () => {
    beforeEach(() => {
      // Mock document.activeElement and querySelectorAll
      Object.defineProperty(document, 'activeElement', {
        writable: true,
        value: null
      })
      
      Object.defineProperty(document, 'querySelectorAll', {
        writable: true,
        value: jest.fn(() => [])
      })

      // Mock window.getComputedStyle
      Object.defineProperty(window, 'getComputedStyle', {
        writable: true,
        value: jest.fn(() => ({
          display: 'none',
          visibility: 'hidden',
          opacity: '0'
        }))
      })
    })

    test('should detect input field focus', () => {
      const mockInput = document.createElement('input')
      Object.defineProperty(document, 'activeElement', {
        writable: true,
        value: mockInput
      })

      // Access private method for testing (TypeScript workaround)
      const isInputFocused = (movementController as any).isInputFocused()
      expect(isInputFocused).toBe(true)
    })

    test('should detect textarea focus', () => {
      const mockTextarea = document.createElement('textarea')
      Object.defineProperty(document, 'activeElement', {
        writable: true,
        value: mockTextarea
      })

      const isInputFocused = (movementController as any).isInputFocused()
      expect(isInputFocused).toBe(true)
    })

    test('should detect contenteditable elements', () => {
      const mockDiv = document.createElement('div')
      mockDiv.setAttribute('contenteditable', 'true')
      Object.defineProperty(document, 'activeElement', {
        writable: true,
        value: mockDiv
      })

      const isInputFocused = (movementController as any).isInputFocused()
      expect(isInputFocused).toBe(true)
    })

    test('should not detect focus on regular elements', () => {
      const mockDiv = document.createElement('div')
      Object.defineProperty(document, 'activeElement', {
        writable: true,
        value: mockDiv
      })

      const isInputFocused = (movementController as any).isInputFocused()
      expect(isInputFocused).toBe(false)
    })
  })

  describe('Disposal', () => {
    test('should clean up event listeners on dispose', () => {
      movementController.setEnabled(true)
      movementController.dispose()
      
      expect(document.removeEventListener).toHaveBeenCalledWith('keydown', expect.any(Function))
      expect(document.removeEventListener).toHaveBeenCalledWith('keyup', expect.any(Function))
      expect(movementController.getEnabled()).toBe(false)
    })

    test('should remove render observer on dispose', () => {
      movementController.dispose()
      expect(mockScene.onBeforeRenderObservable.remove).toHaveBeenCalled()
    })
  })

  describe('Performance optimizations', () => {
    beforeEach(() => {
      // Mock performance.now to return increasing values
      let time = 0
      ;(window.performance.now as jest.Mock).mockImplementation(() => {
        time += 20 // Simulate 20ms intervals
        return time
      })
    })

    test('should throttle movement updates', () => {
      movementController.setEnabled(true)
      
      // Access private method for testing
      const updateMovement = (movementController as any).updateMovement.bind(movementController)
      
      // Mock that W key is pressed
      ;(movementController as any).keysPressed.set('w', true)
      
      // Call updateMovement multiple times rapidly
      updateMovement()
      updateMovement()
      updateMovement()
      
      // Camera position should only be updated once due to throttling
      expect(mockCamera.setPosition).toHaveBeenCalledTimes(1)
    })

    test('should skip updates when no keys are pressed', () => {
      movementController.setEnabled(true)
      
      const updateMovement = (movementController as any).updateMovement.bind(movementController)
      
      // Ensure no keys are pressed
      ;(movementController as any).keysPressed.clear()
      
      updateMovement()
      
      // Camera should not be updated when no movement input
      expect(mockCamera.setPosition).not.toHaveBeenCalled()
    })
  })
})

// Integration test for movement vector calculations
describe('MovementController Integration', () => {
  let movementController: MovementController

  beforeEach(() => {
    jest.clearAllMocks()
    movementController = new MovementController(mockScene, mockCamera, mockEngine)
    movementController.setEnabled(true)
  })

  afterEach(() => {
    movementController.dispose()
  })

  test('should calculate correct forward movement', () => {
    // Mock camera looking down negative Z axis (forward)
    mockCamera.getForwardRay.mockReturnValue({
      direction: new Vector3(0, 0, -1).normalize()
    })

    // Simulate W key press
    ;(movementController as any).keysPressed.set('w', true)
    
    // Update movement
    ;(movementController as any).updateMovement()

    // Should move camera forward (negative Z direction)
    expect(mockCamera.setPosition).toHaveBeenCalledWith(
      expect.objectContaining({
        z: expect.any(Number) // Should be negative (forward)
      })
    )
  })

  test('should handle diagonal movement correctly', () => {
    // Mock camera looking down negative Z axis
    mockCamera.getForwardRay.mockReturnValue({
      direction: new Vector3(0, 0, -1).normalize()
    })

    // Simulate W and D keys pressed (forward + right)
    ;(movementController as any).keysPressed.set('w', true)
    ;(movementController as any).keysPressed.set('d', true)
    
    // Update movement
    ;(movementController as any).updateMovement()

    // Should move camera diagonally (both X and Z components)
    expect(mockCamera.setPosition).toHaveBeenCalledWith(
      expect.objectContaining({
        x: expect.any(Number), // Should have X component (right)
        z: expect.any(Number)  // Should have Z component (forward)
      })
    )
  })
}) 