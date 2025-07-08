import { useEffect } from 'react'
import { useSceneStore } from '../state/sceneStore'

export const useKeyboardShortcuts = () => {
  const {
    // State
    snapToGrid,
    selectedObjectId,
    selectedObjectIds,
    activeDropdown,
    
    // Actions
    setSnapToGrid,
    setTransformMode,
    clearSelection,
    removeObject,
    setActiveDropdown,
    hasSelection
  } = useSceneStore()

  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      // Skip if user is typing in an input or textarea
      if (event.target instanceof HTMLInputElement || event.target instanceof HTMLTextAreaElement) {
        return
      }

      const key = event.key.toLowerCase()
      const isCtrlOrCmd = event.ctrlKey || event.metaKey

      switch (key) {
        case 'g':
          if (isCtrlOrCmd) {
            event.preventDefault()
            setSnapToGrid(!snapToGrid)
            console.log('⚡ Keyboard: Snap to grid toggled:', !snapToGrid)
          }
          break

        case 'delete':
        case 'backspace':
          if (hasSelection()) {
            event.preventDefault()
            const objectsToDelete = selectedObjectId ? [selectedObjectId] : selectedObjectIds
            objectsToDelete.forEach(id => removeObject(id))
            clearSelection()
            console.log('⚡ Keyboard: Deleted selected objects:', objectsToDelete)
          }
          break

        case 'r':
          if (!isCtrlOrCmd) {
            event.preventDefault()
            setTransformMode('rotate')
            console.log('⚡ Keyboard: Transform mode set to rotate')
          }
          break

        case 's':
          if (!isCtrlOrCmd) {
            event.preventDefault()
            setTransformMode('scale')
            console.log('⚡ Keyboard: Transform mode set to scale')
          }
          break

        case 'm':
          if (!isCtrlOrCmd) {
            event.preventDefault()
            setTransformMode('move')
            console.log('⚡ Keyboard: Transform mode set to move')
          }
          break

        case 'escape':
          event.preventDefault()
          clearSelection()
          setActiveDropdown(null)
          console.log('⚡ Keyboard: Cleared selection and closed dropdowns')
          break

        default:
          // No action for other keys
          break
      }
    }

    // Add event listener
    window.addEventListener('keydown', handleKeyDown)
    
    // Cleanup event listener on unmount
    return () => {
      window.removeEventListener('keydown', handleKeyDown)
    }
  }, [
    snapToGrid,
    selectedObjectId,
    selectedObjectIds,
    activeDropdown,
    setSnapToGrid,
    setTransformMode,
    clearSelection,
    removeObject,
    setActiveDropdown,
    hasSelection
  ])

  // This hook doesn't return anything, it just sets up the event listeners
  return null
}
