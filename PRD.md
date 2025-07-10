# Product Requirements Document: Group Selection with Ctrl+Click

## 1. Overview

### 1.1 Purpose
Implement intuitive group selection functionality in VibeCad Pro that allows users to select multiple 3D objects using ctrl+click (or cmd+click on Mac), enabling efficient batch operations on multiple scene elements.

### 1.2 Current State
- Basic multi-select mode exists with `multiSelectMode` flag
- `selectedObjectIds` array tracks multiple selections
- Some ctrl+click handling exists in `handleObjectClick`
- Multi-select pivot visualization is implemented

## 2. Functional Requirements

### 2.1 Selection Behavior

#### Single Click (No Modifier)
- **Current Selection Cleared**: Any existing selection (single or multiple) is cleared
- **New Selection**: The clicked object becomes the only selected object
- **Visual Feedback**: Object shows selection highlight (cyan glow)

#### Ctrl+Click (Cmd+Click on Mac)
- **Toggle Selection**: 
  - If object is not selected → Add to selection group
  - If object is already selected → Remove from selection group
- **Preserve Existing Selection**: Other selected objects remain selected
- **Visual Feedback**: Multi-selected objects show distinct highlight (orange glow)

#### Click on Empty Space
- **Without Ctrl**: Clear all selections
- **With Ctrl**: Maintain current selection (no change)

### 2.2 Selection Modes

#### Implicit Multi-Select Mode
- Activated automatically when ctrl+clicking
- No need to manually toggle multi-select mode
- Seamless transition between single and multi-select

#### Explicit Multi-Select Mode (Optional Enhancement)
- Toggle button in UI to lock multi-select mode
- When active, all clicks act as ctrl+clicks
- Useful for selecting many objects without holding ctrl

### 2.3 Visual Feedback System

```typescript
// Selection State Visual Indicators
interface SelectionVisuals {
  unselected: {
    emissive: Color3(0.1, 0.1, 0.1),  // Subtle interactive glow
    cursor: 'pointer'
  },
  hovered: {
    emissive: Color3(0.3, 0.6, 0.9),  // Blue hover
    cursor: 'pointer'
  },
  singleSelected: {
    emissive: Color3(0.6, 1.0, 1.0),  // Bright cyan
    cursor: 'move'
  },
  multiSelected: {
    emissive: Color3(1.0, 0.8, 0.2),  // Orange for multi-selection
    cursor: 'move'
  },
  locked: {
    emissive: Color3(0.8, 0.4, 0.4),  // Red tint
    cursor: 'not-allowed'
  }
}
```

### 2.4 Group Operations

Once multiple objects are selected:

#### Transform Operations
- **Move**: All objects move together maintaining relative positions
- **Rotate**: Objects rotate around group center pivot
- **Scale**: Objects scale from group center maintaining proportions

#### Property Operations
- **Color Change**: Apply to all selected objects
- **Material Assignment**: Apply to all selected objects
- **Visibility Toggle**: Show/hide all selected
- **Lock/Unlock**: Lock/unlock all selected
- **Delete**: Remove all selected objects

### 2.5 Selection Helpers

#### Select All (Ctrl+A)
```typescript
// Select all non-ground, unlocked objects
const selectableObjects = sceneObjects.filter(obj => 
  obj.type !== 'ground' && !objectLocked[obj.id]
);
```

#### Invert Selection (Ctrl+Shift+A)
```typescript
// Invert current selection
const currentlySelected = new Set(selectedObjectIds);
const newSelection = selectableObjects.filter(obj => 
  !currentlySelected.has(obj.id)
);
```

#### Select Similar
- By type (all cubes, all walls, etc.)
- By color
- By size (within threshold)

### 2.6 UI Components

#### Selection Info Panel
```typescript
interface SelectionInfoDisplay {
  selectionCount: number;
  selectionTypes: Map<string, number>; // type -> count
  commonProperties: {
    color?: string;  // Only if all have same color
    scale?: Vector3; // Only if all have same scale
  };
  boundingBox: {
    min: Vector3;
    max: Vector3;
    center: Vector3;
    size: Vector3;
  };
}
```

#### Quick Actions Bar
When multiple objects are selected, show:
- Group/Ungroup
- Align (Left, Center, Right, Top, Middle, Bottom)
- Distribute (Horizontal, Vertical)
- Match Properties (Size, Color, Rotation)

## 3. Technical Implementation

### 3.1 State Management Updates

```typescript
// Enhanced store state
interface EnhancedSceneState {
  // Existing...
  selectedObjectIds: string[];
  selectionBox: {
    start: Vector2;
    end: Vector2;
    active: boolean;
  };
  selectionPivotMode: 'center' | 'first' | 'last' | 'custom';
  groupedObjects: Map<string, string[]>; // groupId -> objectIds
}
```

### 3.2 Event Handling Enhancement

```typescript
// In SceneManager
private handlePointerDown = (evt: PointerEvent) => {
  const isMultiSelectKey = evt.ctrlKey || evt.metaKey;
  const isShiftKey = evt.shiftKey;
  
  // Store modifier state for click handling
  this.modifierKeys = {
    ctrl: isMultiSelectKey,
    shift: isShiftKey,
    alt: evt.altKey
  };
  
  // Handle box selection start if shift is held
  if (isShiftKey && !this.boxSelection.active) {
    this.startBoxSelection(evt);
  }
};
```

### 3.3 Performance Optimizations

#### Batch Updates
```typescript
// When updating multiple objects, batch the updates
const batchUpdateObjects = (updates: Map<string, Partial<SceneObject>>) => {
  set((state) => ({
    sceneObjects: state.sceneObjects.map(obj => {
      const update = updates.get(obj.id);
      return update ? { ...obj, ...update } : obj;
    })
  }));
};
```

#### Selection Caching
```typescript
// Cache expensive computations
const selectionCache = {
  boundingBox: null,
  center: null,
  lastUpdateFrame: -1
};
```

## 4. User Experience Enhancements

### 4.1 Selection Rectangle (Box Selection)
- **Shift+Drag**: Draw selection rectangle
- **Additive**: Shift+Ctrl+Drag adds to selection
- **Subtractive**: Shift+Alt+Drag removes from selection

### 4.2 Smart Selection
- **Double-click**: Select all connected objects (for housing components)
- **Triple-click**: Select all objects of same type

### 4.3 Keyboard Navigation
- **Tab**: Cycle through objects
- **Shift+Tab**: Cycle backwards
- **Arrow Keys**: Nudge selected objects (when not in movement mode)

## 5. Implementation Phases

### Phase 1: Core Ctrl+Click (Current Sprint)
- [x] Basic ctrl+click toggle selection
- [ ] Visual feedback improvements
- [ ] Selection info display
- [ ] Batch property updates

### Phase 2: Selection Helpers (Next Sprint)
- [ ] Box selection with shift+drag
- [ ] Select all/none/invert
- [ ] Select similar functionality
- [ ] Selection filtering

### Phase 3: Advanced Features (Future)
- [ ] Object grouping/ungrouping
- [ ] Alignment tools
- [ ] Distribution tools
- [ ] Selection sets (save/load selections)

## 6. Testing Requirements

### 6.1 Functional Tests
- Ctrl+click adds/removes from selection
- Selection persists during transforms
- All group operations work correctly
- Performance with 100+ selected objects

### 6.2 Cross-platform Tests
- Windows: Ctrl+click
- Mac: Cmd+click
- Touch devices: Long press for multi-select

### 6.3 Edge Cases
- Selecting locked objects
- Selecting invisible objects
- Mixed object types in selection
- Nested/grouped objects

## 7. Success Metrics

- **Efficiency**: 50% reduction in time for batch operations
- **Intuitiveness**: 90% of users discover ctrl+click without instruction
- **Performance**: No lag with up to 200 selected objects
- **Reliability**: Zero selection state bugs in production

## 8. Migration Notes

Your current implementation already has:
1. `isCtrlHeld` parameter in `handleObjectClick`
2. Multi-select state management
3. Visual feedback system

Recommended immediate enhancements:
1. Add selection count to status bar
2. Improve visual distinction between single/multi selection
3. Add "Selection Mode" indicator when ctrl is held
4. Implement batch color change for selected objects