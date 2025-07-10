import { useEffect } from 'react'
import { useSceneStore } from '../state/sceneStore'

export const useKeyboardShortcuts = () => {
  const {
    // State
    snapToGrid,
    selectedObjectId,
    selectedObjectIds,
    activeDropdown,
    sceneObjects,
    objectLocked,
    
    // Actions
    setSnapToGrid,
    setTransformMode,
    clearSelection,
    removeObject,
    setActiveDropdown,
    hasSelection,
    setSelectedObjectIds,
    getSelectableObjects
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

        case 'a':
          if (isCtrlOrCmd) {
            event.preventDefault()
            if (event.shiftKey) {
              // Ctrl+Shift+A: Invert selection
              const currentlySelected = new Set(selectedObjectIds)
              const allSelectableObjects = getSelectableObjects()
              const invertedSelection = allSelectableObjects
                .filter(obj => !currentlySelected.has(obj.id))
                .map(obj => obj.id)
              setSelectedObjectIds(invertedSelection)
              console.log('⚡ Keyboard: Inverted selection', invertedSelection.length, 'objects')
            } else {
              // Ctrl+A: Select all selectable objects
              const allSelectableObjects = getSelectableObjects()
              const allIds = allSelectableObjects.map(obj => obj.id)
              setSelectedObjectIds(allIds)
              console.log('⚡ Keyboard: Selected all objects', allIds.length, 'objects')
            }
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
    hasSelection,
    setSelectedObjectIds,
    getSelectableObjects
  ])

  // This hook doesn't return anything, it just sets up the event listeners
  return null
}
