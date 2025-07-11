// Simple undo system for VibeCAD
export interface UndoAction {
  type: string
  timestamp: number
  payload: any
  inverse: any // The action needed to undo this action
}

// Helper functions to create undo actions
export const createAddObjectAction = (object: any): UndoAction => ({
  type: 'ADD_OBJECT',
  timestamp: Date.now(),
  payload: { object },
  inverse: { 
    type: 'REMOVE_OBJECT', 
    payload: { objectId: object.id } 
  }
})

export const createRemoveObjectAction = (object: any): UndoAction => ({
  type: 'REMOVE_OBJECT',
  timestamp: Date.now(),
  payload: { objectId: object.id },
  inverse: { 
    type: 'ADD_OBJECT', 
    payload: { object } 
  }
})

export const createRenameAction = (newId: string, oldId: string, object: any): UndoAction => ({
    type: 'RENAME',
    timestamp: Date.now(),
    payload: { newId, oldId, object },
    inverse: {
        type: 'RENAME',
        payload: { newId: oldId, oldId: newId, object }
    }
})

export const createUpdateObjectAction = (objectId: string, newValues: any, previousValues: any): UndoAction => ({
  type: 'UPDATE_OBJECT',
  timestamp: Date.now(),
  payload: { objectId, updates: newValues },
  inverse: { 
    type: 'UPDATE_OBJECT', 
    payload: { objectId, updates: previousValues } 
  }
})

export const createSetObjectLockedAction = (objectId: string, locked: boolean, previousLocked: boolean): UndoAction => ({
  type: 'SET_OBJECT_LOCKED',
  timestamp: Date.now(),
  payload: { objectId, locked },
  inverse: { 
    type: 'SET_OBJECT_LOCKED', 
    payload: { objectId, locked: previousLocked } 
  }
})

export const createSetObjectVisibilityAction = (objectId: string, visible: boolean, previousVisible: boolean): UndoAction => ({
  type: 'SET_OBJECT_VISIBILITY',
  timestamp: Date.now(),
  payload: { objectId, visible },
  inverse: { 
    type: 'SET_OBJECT_VISIBILITY', 
    payload: { objectId, visible: previousVisible } 
  }
})

export const createSelectionAction = (
  newSelectedObjectId: string | null,
  newSelectedObjectIds: string[],
  oldSelectedObjectId: string | null,
  oldSelectedObjectIds: string[]
): UndoAction => ({
  type: 'SET_SELECTION',
  timestamp: Date.now(),
  payload: { selectedObjectId: newSelectedObjectId, selectedObjectIds: newSelectedObjectIds },
  inverse: { 
    type: 'SET_SELECTION', 
    payload: { selectedObjectId: oldSelectedObjectId, selectedObjectIds: oldSelectedObjectIds } 
  }
})

export const createBatchDeleteAction = (objects: any[]): UndoAction => ({
  type: 'BATCH_DELETE',
  timestamp: Date.now(),
  payload: { objectIds: objects.map(obj => obj.id) },
  inverse: { 
    type: 'BATCH_ADD', 
    payload: { objects } 
  }
}) 