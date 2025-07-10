# Multi-Selection and Group Locking System Documentation

## Overview
VibeCAD implements a sophisticated multi-selection and group locking system that allows users to efficiently manage multiple 3D objects through intuitive interactions. The system combines state management, visual feedback, and input handling to provide a seamless user experience.

## 1. Multi-Selection System Architecture

### 1.1 Core State Management
The multi-selection system is built on Zustand state management with the following key state properties:

```typescript
interface SceneState {
  // Selection state
  selectedObjectId: string | null;           // Single selected object
  selectedObjectIds: string[];              // Array of multi-selected objects
  hoveredObjectId: string | null;           // Currently hovered object
  
  // Multi-select specific
  multiSelectMode: boolean;                 // Explicit multi-select mode flag
  multiSelectPivot: Mesh | null;           // Center pivot for group transforms
  multiSelectInitialStates: {              // Initial states for group transforms
    [objectId: string]: MultiSelectInitialState;
  };
  
  // Object properties
  objectLocked: {[key: string]: boolean};   // Per-object lock state
  objectVisibility: {[key: string]: boolean}; // Per-object visibility
}
```

### 1.2 Selection Logic Flow
The selection system operates through a centralized `handleObjectClick` function in `useBabylonScene.ts`:

```typescript
const handleObjectClick = (pickInfo: PickingInfo, isCtrlHeld: boolean = false) => {
  // 1. Validation: Check if click hit a valid object
  if (!pickInfo.hit || !pickInfo.pickedMesh) {
    if (!isCtrlHeld) clearSelection();
    return;
  }

  // 2. Object Resolution: Walk up mesh hierarchy to find scene object
  let pickedMesh = pickInfo.pickedMesh;
  const sceneIds = new Set(sceneObjects.map(o => o.id));
  while (pickedMesh && !sceneIds.has(pickedMesh.name) && pickedMesh.parent) {
    pickedMesh = pickedMesh.parent as any;
  }

  // 3. Security Check: Validate object exists and is selectable
  const clickedObject = sceneObjects.find(obj => obj.id === objectId);
  if (!clickedObject || clickedObject.type === 'ground' || isObjectLocked(objectId)) {
    if (!isCtrlHeld) clearSelection();
    return;
  }

  // 4. Selection Mode Decision
  if (multiSelectMode || isCtrlHeld) {
    // Multi-select: Toggle object in selection
    const isAlreadySelected = selectedObjectIds.includes(objectId);
    const newSelection = isAlreadySelected
      ? selectedObjectIds.filter(id => id !== objectId)  // Remove
      : [...selectedObjectIds, objectId];               // Add
    setSelectedObjectIds(newSelection);
  } else {
    // Single-select: Replace current selection
    setSelectedObjectIds([]);
    setSelectedObjectId(objectId);
  }
};
```

## 2. Visual Feedback System

### 2.1 Color-Coded Selection States
The system provides distinct visual feedback for different selection states:

```typescript
enum SelectionVisualStates {
  UNSELECTED = "Color3(0.1, 0.1, 0.1)",    // Subtle interactive glow
  HOVERED = "Color3(0.3, 0.6, 0.9)",       // Blue hover effect
  SINGLE_SELECTED = "Color3(0.6, 1.0, 1.0)", // Bright cyan
  MULTI_SELECTED = "Color3(1.0, 0.8, 0.2)",  // Orange for multi-selection
  LOCKED = "Color3(0.8, 0.4, 0.4)"         // Red tint for locked objects
}
```

### 2.2 Real-Time Visual Updates
Visual feedback is managed through a React effect that responds to state changes:

```typescript
useEffect(() => {
  // Reset all objects to default state
  state.sceneObjects.forEach(obj => {
    if (obj.type !== 'ground') {
      if (state.objectLocked[obj.id]) {
        sceneManager.setMeshEmissive(obj.id, LOCKED_COLOR);
      } else {
        sceneManager.setMeshEmissive(obj.id, UNSELECTED_COLOR);
      }
    }
  });

  // Apply hover effects
  if (state.hoveredObjectId && !isSelected && !isLocked) {
    sceneManager.setMeshEmissive(state.hoveredObjectId, HOVERED_COLOR);
  }

  // Apply selection highlights
  if (state.selectedObjectId) {
    sceneManager.setMeshEmissive(state.selectedObjectId, SINGLE_SELECTED_COLOR);
  }
  
  state.selectedObjectIds.forEach(objectId => {
    sceneManager.setMeshEmissive(objectId, MULTI_SELECTED_COLOR);
  });
}, [selectedObjectId, selectedObjectIds, hoveredObjectId, objectLocked]);
```

## 3. Object Locking System

### 3.1 Lock State Management
Objects can be individually locked to prevent selection and modification:

```typescript
// Lock state is stored per object
objectLocked: {[key: string]: boolean}

// Lock operations
setObjectLocked: (objectId: string, locked: boolean) => void;
isObjectLocked: (objectId: string) => boolean;
```

### 3.2 Lock Interaction with Selection
Locked objects have special interaction rules:

1. **Cannot be selected** - Clicking locked objects clears selection (unless Ctrl is held)
2. **Visual distinction** - Locked objects show red tint
3. **Excluded from group operations** - `getSelectableObjects()` filters out locked objects
4. **Auto-deselection** - When an object is locked, it's automatically removed from selection

```typescript
// Selection filtering considers lock state
getSelectableObjects: () => {
  const state = get();
  return state.sceneObjects.filter(obj => 
    obj.type !== 'ground' && !state.objectLocked[obj.id]
  );
}

// Locking an object clears selection
toggleObjectLock: (objectId: string) => {
  const isCurrentlyLocked = isObjectLocked(objectId);
  setObjectLocked(objectId, !isCurrentlyLocked);
  if (!isCurrentlyLocked) {
    clearSelection(); // Clear selection when locking
  }
}
```

## 4. Group Operations System

### 4.1 Multi-Select Pivot Creation
When multiple objects are selected, the system creates a central pivot for group transformations:

```typescript
useEffect(() => {
  if (selectedObjectIds.length === 0) {
    sceneManager.removeMultiSelectPivot();
    return;
  }

  const selectedObjs = sceneObjects.filter(obj => selectedObjectIds.includes(obj.id));
  
  // Calculate center point of selected objects
  const center = selectedObjs.reduce((acc, obj) => {
    return acc.add(obj.position);
  }, new Vector3(0, 0, 0)).scale(1 / selectedObjs.length);

  // Create pivot and store initial states
  const pivot = sceneManager.createMultiSelectPivot(center);
  setMultiSelectPivot(pivot);
  
  const initialStates = {};
  selectedObjs.forEach(obj => {
    initialStates[obj.id] = {
      position: obj.position.clone(),
      rotation: obj.rotation.clone(),
      scale: obj.scale.clone(),
      relativePosition: obj.position.subtract(center)
    };
  });
  setMultiSelectInitialStates(initialStates);
}, [selectedObjectIds, sceneObjects]);
```

### 4.2 Group Transform Operations
Group transformations maintain relative positions and scales:

```typescript
// Group move operation
selectedObjectIds.forEach(id => {
  const initialState = multiSelectInitialStates[id];
  const newPosition = pivot.position.add(initialState.relativePosition);
  updateObject(id, { position: newPosition });
});

// Group rotate operation
selectedObjectIds.forEach(id => {
  const initialState = multiSelectInitialStates[id];
  const rotatedRelative = initialState.relativePosition.rotateByQuaternion(pivot.rotation);
  const newPosition = pivot.position.add(rotatedRelative);
  const newRotation = initialState.rotation.add(pivot.rotation);
  updateObject(id, { position: newPosition, rotation: newRotation });
});
```

### 4.3 Batch Property Operations
The system supports batch operations on selected objects:

```typescript
// Batch color change
const updateSelectedObjectsProperty = (property: string, value: any) => {
  selectedObjects.forEach(obj => {
    updateObject(obj.id, { [property]: value });
  });
};

// Batch visibility toggle
const toggleVisibilityAll = () => {
  selectedObjects.forEach(obj => {
    const currentVisibility = isObjectVisible(obj.id);
    setObjectVisibility(obj.id, !currentVisibility);
  });
};

// Batch lock/unlock
const lockAllSelected = () => {
  selectedObjects.forEach(obj => {
    setObjectLocked(obj.id, true);
  });
  clearSelection(); // Clear selection since locked objects can't be selected
};
```

## 5. Keyboard Shortcuts Integration

### 5.1 Selection Shortcuts
The system provides keyboard shortcuts for efficient selection management:

```typescript
const handleKeyDown = (event: KeyboardEvent) => {
  const isCtrlOrCmd = event.ctrlKey || event.metaKey;
  
  switch (event.key.toLowerCase()) {
    case 'a':
      if (isCtrlOrCmd) {
        event.preventDefault();
        if (event.shiftKey) {
          // Ctrl+Shift+A: Invert selection
          const currentlySelected = new Set(selectedObjectIds);
          const allSelectableObjects = getSelectableObjects();
          const invertedSelection = allSelectableObjects
            .filter(obj => !currentlySelected.has(obj.id))
            .map(obj => obj.id);
          setSelectedObjectIds(invertedSelection);
        } else {
          // Ctrl+A: Select all selectable objects
          const allSelectableObjects = getSelectableObjects();
          const allIds = allSelectableObjects.map(obj => obj.id);
          setSelectedObjectIds(allIds);
        }
      }
      break;
      
    case 'escape':
      event.preventDefault();
      clearSelection();
      setActiveDropdown(null);
      break;
  }
};
```

### 5.2 Transform Mode Shortcuts
Additional shortcuts for transform operations:

```typescript
// Transform mode shortcuts
case 'g': setTransformMode('move'); break;
case 'r': setTransformMode('rotate'); break;
case 's': setTransformMode('scale'); break;
case 'delete': 
  selectedObjectIds.forEach(id => removeObject(id));
  clearSelection();
  break;
```

## 6. UI Components

### 6.1 Selection Mode Indicator
A visual indicator shows when Ctrl is held for multi-select mode:

```typescript
const SelectionModeIndicator = ({ isVisible }) => {
  const [isCtrlHeld, setIsCtrlHeld] = useState(false);

  useEffect(() => {
    const handleKeyDown = (event) => {
      if (event.ctrlKey || event.metaKey) {
        setIsCtrlHeld(true);
      }
    };
    
    const handleKeyUp = (event) => {
      if (!event.ctrlKey && !event.metaKey) {
        setIsCtrlHeld(false);
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    window.addEventListener('keyup', handleKeyUp);
    
    return () => {
      window.removeEventListener('keydown', handleKeyDown);
      window.removeEventListener('keyup', handleKeyUp);
    };
  }, []);

  if (!isVisible || !isCtrlHeld) return null;

  return (
    <div className="selection-mode-indicator">
      <span>⚡ Multi-Select Mode</span>
      <span>Click objects to add to selection</span>
    </div>
  );
};
```

### 6.2 Selection Info Display
A comprehensive info panel shows selection statistics:

```typescript
const SelectionInfoDisplay = () => {
  const selectionInfo = useMemo(() => {
    if (selectedObjectIds.length === 0) return null;
    
    const selectedObjs = sceneObjects.filter(obj => selectedObjectIds.includes(obj.id));
    const selectionTypes = new Map();
    
    selectedObjs.forEach(obj => {
      selectionTypes.set(obj.type, (selectionTypes.get(obj.type) || 0) + 1);
    });

    // Calculate bounding box
    const positions = selectedObjs.map(obj => obj.position);
    const min = positions.reduce((acc, pos) => Vector3.Minimize(acc, pos));
    const max = positions.reduce((acc, pos) => Vector3.Maximize(acc, pos));
    
    return {
      selectionCount: selectedObjs.length,
      selectionTypes,
      boundingBox: { min, max, center: min.add(max).scale(0.5) }
    };
  }, [selectedObjectIds, sceneObjects]);

  return (
    <div className="selection-info-display">
      <div className="selection-count">{selectionInfo.selectionCount} Objects Selected</div>
      <div className="selection-types">
        {Array.from(selectionInfo.selectionTypes.entries()).map(([type, count]) => (
          <span key={type}>{type} ({count})</span>
        ))}
      </div>
    </div>
  );
};
```

### 6.3 Scene Graph Integration
The scene graph shows object states and provides lock/visibility controls:

```typescript
const SceneGraph = () => {
  const { sceneObjects, selectedObjectIds, objectLocked, objectVisibility } = useSceneStore();

  return (
    <div className="scene-objects">
      {sceneObjects.map(obj => {
        const isSelected = selectedObjectIds.includes(obj.id);
        const isLocked = objectLocked[obj.id];
        const isVisible = objectVisibility[obj.id] !== false;
        
        return (
          <div 
            key={obj.id}
            className={`scene-object ${isSelected ? 'selected' : ''} ${isLocked ? 'locked' : ''}`}
            onClick={() => setSelectedObjectId(obj.id)}
          >
            <span className="object-type">{obj.type}</span>
            <span className="object-id">{obj.id}</span>
            <div className="object-controls">
              <button onClick={() => toggleObjectVisibility(obj.id)}>
                {isVisible ? '👁️' : '🚫'}
              </button>
              <button onClick={() => toggleObjectLock(obj.id)}>
                {isLocked ? '🔒' : '🔓'}
              </button>
            </div>
          </div>
        );
      })}
    </div>
  );
};
```

## 7. Properties Panel Multi-Select

### 7.1 Bulk Operations Interface
The properties panel provides bulk operations for multi-selected objects:

```typescript
const renderMultiSelectProperties = () => (
  <div className="multi-select-properties">
    <h4>Multiple Objects Selected ({selectedObjects.length})</h4>
    
    {/* Bulk Color Change */}
    <div className="property-group">
      <label>Bulk Color Change:</label>
      <input 
        type="color" 
        onChange={(e) => updateSelectedObjectsProperty('color', e.target.value)}
      />
      <button onClick={applyRandomColor}>Random Color</button>
    </div>

    {/* Bulk Visibility */}
    <div className="property-group">
      <label>Bulk Visibility:</label>
      <button onClick={showAllSelected}>👁️ Show All</button>
      <button onClick={hideAllSelected}>🚫 Hide All</button>
      <button onClick={toggleVisibilityAll}>🔄 Toggle</button>
    </div>

    {/* Bulk Lock Operations */}
    <div className="property-group">
      <label>Bulk Lock/Unlock:</label>
      <button onClick={lockAllSelected}>🔒 Lock All</button>
      <button onClick={unlockAllSelected}>🔓 Unlock All</button>
      <button onClick={toggleLockAll}>🔄 Toggle Lock</button>
    </div>

    {/* Object List */}
    <div className="selected-objects-list">
      {selectedObjects.map(obj => (
        <div key={obj.id} className="selected-object-item">
          <span className="object-type">{obj.type}</span>
          <span className="object-id">{obj.id}</span>
          <div className="object-color" style={{ backgroundColor: obj.color }}></div>
          <span className="object-status">
            {!isObjectVisible(obj.id) && '🚫'}
            {isObjectLocked(obj.id) && '🔒'}
          </span>
        </div>
      ))}
    </div>
  </div>
);
```

## 8. Technical Implementation Details

### 8.1 State Synchronization
The system maintains consistency between different state representations:

```typescript
// Store state automatically synchronizes single/multi selection
setSelectedObjectId: (objectId) => set({ 
  selectedObjectId: objectId,
  selectedObjectIds: []  // Clear multi-selection when single-selecting
}),

setSelectedObjectIds: (objectIds) => set({ 
  selectedObjectIds: objectIds,
  selectedObjectId: null  // Clear single selection when multi-selecting
}),
```

### 8.2 Performance Optimizations
- **Batched updates**: Multiple object updates are batched to prevent unnecessary re-renders
- **Memoized computations**: Selection info and bounding boxes are memoized
- **Selective effects**: Effects only run when relevant state changes

### 8.3 Event Handling
The system captures modifier keys during pointer events:

```typescript
const setupPointerEvents = () => {
  scene.onPointerObservable.add((pointerInfo) => {
    switch (pointerInfo.type) {
      case PointerEventTypes.POINTERUP:
        const isCtrlHeld = pointerInfo.event.ctrlKey || pointerInfo.event.metaKey;
        if (pickInfo && pickInfo.hit) {
          handleObjectClick(pickInfo, isCtrlHeld);
        }
        break;
    }
  });
};
```

## 9. Integration with Transform System

### 9.1 Gizmo Management
The gizmo system adapts to selection state:

```typescript
useEffect(() => {
  if (selectedObjectIds.length > 0) {
    // Multi-select: Use group pivot
    const pivot = multiSelectPivot;
    gizmoManager.setTarget(pivot);
  } else if (selectedObjectId) {
    // Single select: Use object directly
    const mesh = sceneManager.getMeshById(selectedObjectId);
    gizmoManager.setTarget(mesh);
  } else {
    // No selection: Clear gizmo
    gizmoManager.setTarget(null);
  }
}, [selectedObjectId, selectedObjectIds, multiSelectPivot]);
```

### 9.2 Collision Detection
Group operations respect collision detection:

```typescript
const handleGizmoDragEnd = (position, rotation, scale) => {
  if (selectedObjectIds.length > 0) {
    // Multi-select transform with collision checking
    selectedObjectIds.forEach(id => {
      const newPosition = calculateNewPosition(id, position);
      if (sceneManager.checkCollisionAtTransform(id, newPosition)) {
        console.log(`Collision detected for ${id}, transform rejected`);
      } else {
        updateObject(id, { position: newPosition });
      }
    });
  }
};
```

## 10. Best Practices and Patterns

### 10.1 State Management Patterns
- **Single source of truth**: All selection state is managed in Zustand store
- **Immutable updates**: State updates create new arrays/objects
- **Computed values**: Derived state is calculated in getters

### 10.2 User Experience Patterns
- **Progressive disclosure**: Advanced features appear only when relevant
- **Visual feedback**: Every action has immediate visual response
- **Error prevention**: Invalid operations are prevented rather than corrected

### 10.3 Performance Patterns
- **Lazy computation**: Expensive calculations only when needed
- **Debounced updates**: Rapid state changes are debounced
- **Selective rendering**: Only affected objects are re-rendered

## Conclusion

The multi-selection and group locking system in VibeCAD provides a robust foundation for managing complex 3D scenes. The architecture balances performance, usability, and maintainability through careful separation of concerns and efficient state management. The system's extensibility allows for future enhancements while maintaining backward compatibility.

## How It All Works

The multi-selection system operates through a centralized click handler that detects Ctrl/Cmd modifier keys and toggles objects in and out of selection, with locked objects being automatically excluded from selection operations. Visual feedback is provided through distinct emissive colors (cyan for single selection, orange for multi-selection, red for locked objects) that update in real-time as selection state changes. When multiple objects are selected, the system automatically creates a virtual pivot point at the center of the group and stores each object's initial transform state to enable coordinated group transformations while maintaining relative positions. All property changes (color, visibility, lock state, transforms) can be applied as batch operations across the entire selection through dedicated UI panels and keyboard shortcuts. The underlying Zustand state management ensures consistent synchronization between single and multi-selection modes, while React effects handle the visual updates and gizmo management seamlessly.
