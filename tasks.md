# Task Plan: Parametric Door Openings in Walls

This plan outlines the implementation steps for parametric door openings, designed to integrate seamlessly with the existing VibeCAD architecture without breaking production.

## Phase 1: Type Definitions and Data Models

- [ ] **1. Define Wall and Opening Interfaces**:
  - In `src/types/types.ts`, add `ParametricWallParams` interface extending existing patterns
  - Define `DoorOpening` interface with: id, type, width, height, offset
  - Extend `SceneObjectMetadata` to include wall parameters
  - Follow existing type patterns from housing components

- [ ] **2. Extend Scene Store Types**:
  - Add wall-specific state interfaces to `sceneStore.ts`
  - Define actions: `addDoorToWall`, `updateDoorPosition`, `removeDoor`
  - Ensure compatibility with existing selection and transform state

## Phase 2: Core Geometry Implementation

- [ ] **3. Extend Housing Factory**:
  - In `src/babylon/housingFactory.ts`, create `createParametricWall` function
  - Build on existing CSG patterns from `createWallWithDoorCutout`
  - Store parameters in mesh metadata following current conventions
  - Implement multi-door support using CSG subtraction loops

- [ ] **4. Implement Wall Regeneration**:
  - Create `regenerateWallFromParams` function in `housingFactory.ts`
  - Use existing mesh disposal patterns from `sceneManager.ts`
  - Maintain selection state during regeneration
  - Handle edge cases (doors overlapping, out of bounds)

- [ ] **5. Integrate with Gizmo System**:
  - Extend `gizmoManager.ts` to recognize parametric walls
  - Add door handle visualization when wall is selected
  - Implement constrained dragging along wall axis
  - Use existing composite object patterns for scaling

## Phase 3: UI Components

- [ ] **6. Extend Properties Panel**:
  - In `src/components/sidebar/PropertiesPanel.tsx`, add wall property section
  - Display wall dimensions and door list
  - Add "Add Door" button following existing UI patterns
  - Implement door parameter inputs (width, height, offset)

- [ ] **7. Create Door Management UI**:
  - Add door list component within properties panel
  - Include offset slider with live preview
  - Add remove door button for each opening
  - Follow existing housing component UI patterns

- [ ] **8. Implement Visual Feedback**:
  - Add door preview during parameter adjustment
  - Highlight selected doors in 3D view
  - Show dimension overlays following existing patterns
  - Use existing preview functionality from housing components

## Phase 4: State Management Integration

- [ ] **9. Extend Scene Store**:
  - In `src/state/sceneStore.ts`, add wall parameter management
  - Implement door CRUD operations
  - Ensure proper state updates trigger mesh regeneration
  - Maintain compatibility with existing undo/redo structure

- [ ] **10. Connect UI to State**:
  - Wire properties panel to wall state
  - Implement parameter change handlers
  - Ensure real-time updates during editing
  - Follow existing state update patterns

## Phase 5: AI and Scene Integration

- [ ] **11. Extend AI Service**:
  - In `src/ai/ai.service.ts`, add door-related commands
  - Recognize: "add door to wall", "move door left/right", "make door wider"
  - Map commands to state actions
  - Follow existing command parsing patterns

- [ ] **12. Update Scene Graph**:
  - Ensure walls with doors display correctly in `SceneGraph.tsx`
  - Show door count or indicator
  - Maintain existing interaction patterns
  - Support multi-select with walls

## Phase 6: Testing and Polish

- [ ] **13. Performance Optimization**:
  - Profile CSG operations with multiple doors
  - Implement debouncing for slider updates
  - Cache intermediate CSG results if needed
  - Monitor memory usage during regeneration

- [ ] **14. Edge Case Handling**:
  - Prevent doors from overlapping
  - Constrain doors within wall bounds
  - Handle very small/large door sizes
  - Graceful degradation for CSG failures

- [ ] **15. Integration Testing**:
  - Test with existing transform operations
  - Verify compatibility with housing components
  - Ensure scene save/load works correctly
  - Test AI commands with various phrasings

## Implementation Notes

### File Changes Summary
- **Modified files**:
  - `types.ts` (new interfaces)
  - `housingFactory.ts` (new functions)
  - `sceneStore.ts` (new state)
  - `PropertiesPanel.tsx` (new UI)
  - `gizmoManager.ts` (door handles)
  - `ai.service.ts` (new commands)

- **No new files created** - all functionality integrated into existing structure
- **No breaking changes** - additions only, existing code unchanged

### Key Integration Points
1. Use existing CSG patterns from `createWallWithDoorCutout`
2. Follow metadata storage conventions from composite objects
3. Extend properties panel using existing component patterns
4. Leverage housing component preview functionality
5. Use established gizmo system for transformations

### Success Metrics
- Walls with doors behave consistently with other objects
- No regression in existing functionality
- Performance similar to current CSG operations
- Intuitive UI following established patterns
- AI commands work naturally
