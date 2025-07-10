# Product Requirements Document (PRD): Parametric Door Openings in Walls

## Overview

This document outlines the requirements for implementing parametric door openings within walls in the VibeCAD application. It leverages the existing architecture patterns, including the housing factory system, CSG operations, and metadata-driven regeneration.

## Objectives

- Enable users to add door openings to walls using a parametric, non-destructive workflow.
- Allow users to move door openings within a wall without altering the wall's overall dimensions.
- Integrate seamlessly with existing housing components and transformation systems.
- Ensure all geometry is generated from editable parameters for flexibility and scalability.

## Functional Requirements

### 1. Wall and Opening Parameterization

- Extend existing `housingFactory.ts` patterns for parametric walls
- Walls must be defined by parameters: width, height, depth, position, and an array of openings
- Each opening (door) must have parameters: type, width, height, offset (from wall edge), and unique id
- All parameters stored in mesh metadata following existing patterns

### 2. Geometry Generation

- Leverage existing CSG implementation in `housingFactory.ts`
- Wall meshes generated from parameters using Babylon.js and CSG2
- When an opening is added or moved, the wall mesh is regenerated
- Use existing mesh disposal patterns from `sceneManager.ts`

### 3. UI and Interaction

- Extend `PropertiesPanel.tsx` with wall-specific controls
- Users must be able to:
  - Add a door opening to a wall via properties panel
  - Select and move existing door openings
  - See immediate visual feedback during changes
- Integrate with existing scene graph and selection system

### 4. State Management

- Extend `sceneStore.ts` with wall parameter management
- Follow existing patterns for state updates and mesh regeneration
- Ensure compatibility with multi-select and transform operations

## Technical Integration

### Leveraging Existing Architecture

```
/src
  /babylon
    housingFactory.ts    # Extend with parametric wall functions
    sceneManager.ts      # Use existing mesh management
    gizmoManager.ts      # Integrate with transform system
  /components
    /sidebar
      PropertiesPanel.tsx  # Add wall/door UI controls
      SceneGraph.tsx       # Display wall structure
  /state
    sceneStore.ts        # Add wall state management
  /types
    types.ts             # Define wall/opening interfaces
```

### Key Integration Points

1. **Housing Factory Extension**
   - Build on existing `ModularHousingBuilder` patterns
   - Use established CSG workflow from `createWallWithDoorCutout`
   - Follow metadata storage patterns

2. **Properties Panel Integration**
   - Extend existing property editing UI
   - Use preview functionality for door placement
   - Follow housing component UI patterns

3. **Gizmo System Integration**
   - Support door movement via custom handles
   - Integrate with collision detection
   - Use existing composite object regeneration

4. **State Store Extension**
   - Add wall methods following existing patterns
   - Ensure proper mesh lifecycle management
   - Maintain compatibility with undo/redo considerations

## User Flows

### 1. Adding a Door to a Wall

**Using Properties Panel (Primary Flow):**

1. **User selects a wall** in the 3D scene or scene graph
2. **Properties panel shows wall controls** with existing parameters
3. **User clicks "Add Door"** button in properties panel
4. **Door parameters appear** with width, height, offset inputs
5. **User adjusts parameters** with real-time preview
6. **On confirmation:** State updates, mesh regenerates with CSG
7. **Scene updates** showing wall with door opening

### 2. Moving a Door Within a Wall

**Using Direct Manipulation:**

1. **User selects wall** containing doors
2. **Door handles appear** at door positions
3. **User drags door handle** along wall
4. **Preview shows new position** with constraints
5. **On release:** Parameters update, mesh regenerates
6. **Scene updates** with door at new position

**Using Properties Panel:**

1. **User selects wall** in scene
2. **Properties panel lists doors** with offset values
3. **User adjusts offset slider/input**
4. **Real-time preview** shows door movement
5. **Mesh regenerates** on value change

## Implementation Approach

### Phase 1: Foundation
- Define types in `types.ts`
- Extend `housingFactory.ts` with parametric wall creation
- Add wall state to `sceneStore.ts`

### Phase 2: Core Functionality
- Implement CSG operations for multiple openings
- Create regeneration system using existing patterns
- Integrate with gizmo system for transformations

### Phase 3: UI Integration
- Extend PropertiesPanel with wall controls
- Add door management UI
- Implement preview functionality

### Phase 4: AI Integration
- Extend AIService with door commands
- Map natural language to parameter updates
- Follow existing command patterns

## Success Criteria

- Seamless integration with existing architecture
- No breaking changes to current functionality
- Walls with doors behave like other composite objects
- Performance comparable to existing CSG operations
- Natural extension of current UI patterns