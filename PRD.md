# Product Requirements Document (PRD): Parametric Openings in Browser-Based CAD Application

## Document Metadata
- **Version**: 1.0
- **Date**: July 10, 2025
- **Author**: AI Assistant (Synthesized from Research)
- **Stakeholders**: Product Manager, Senior Engineering Team, UX/UI Designers
- **Tech Stack**: Vite + React + TypeScript + Babylon.js + CSG2
- **References**:
  - Babylon.js Documentation: [CSG2 Class](https://doc.babylonjs.com/typedoc/classes/BABYLON.CSG2)
  - Revit Best Practices: [12 Tips to Master Revit Door Families](https://www.bimpure.com/blog/12-tips-to-master-revit-door-families)
  - ArchiCAD Documentation: [Creating Custom Components for Doors and Windows](https://help.graphisoft.com/AC/27/INT/index.htm#t=50-Configuration%2F50_Object_Editing%2F50_Custom_Components_Doors_Windows_Curtain_Walls.htm)
  - BIM Parametric Modeling: [Parametric Object Modeling in BIM Applications](https://paacademy.com/blog/parametric-object-modeling-in-bim)
  - Industry Standards: ISO 19650 (BIM Processes), OpenBIM Standards from buildingSMART International

This PRD outlines the implementation of parametric openings (e.g., doors, windows) in walls for a modern browser-based CAD application. It draws from industry best practices in BIM tools like Revit, ArchiCAD, and AutoCAD to ensure robustness, while adapting to web constraints.

## Overview

### Purpose and Benefits of Parametric Openings in Architectural Modeling
Parametric openings refer to dynamically configurable elements like doors and windows embedded in host structures (e.g., walls). Unlike static geometry, parametric models use parameters (e.g., dimensions, position, material) and rules to define relationships, enabling automatic updates when changes occur. This approach is core to BIM (Building Information Modeling), where objects carry intelligent data for simulation, analysis, and collaboration.

Benefits include:
- **Efficiency**: Rapid iteration on designs without manual redrawing. For example, resizing a door automatically adjusts the wall cutout.
- **Accuracy and Consistency**: Reduces errors by enforcing rules (e.g., doors cannot exceed wall height). Integrates non-graphical data like cost or energy ratings.
- **Collaboration**: Supports interdisciplinary workflows, e.g., exporting to structural analysis tools.
- **User Value**: Architects and designers gain real-time feedback, non-destructive editing, and scalability for complex models.
- **Browser-Specific Advantages**: Enables cloud-based collaboration without heavy desktop software, though limited by client-side performance.

In tools like Revit, parametric families allow "if-then" logic for behaviors (e.g., automatic frame adjustment based on wall thickness). ArchiCAD uses GDL (Geometric Description Language) for scriptable parametrics. AutoCAD's Architectural extensions support dynamic blocks for 2D parametrics, extendable to 3D.

### Core Objectives and User Value
- **Objectives**: Implement parametric doors/windows that integrate seamlessly with walls, supporting addition, editing, movement, and removal with real-time mesh updates. Ensure scalability for large models while maintaining 60 FPS in browsers.
- **User Value**: Empower users to model realistic architecture intuitively, with undo/redo, parametric controls, and exportable data models. Target users: Architects, interior designers, hobbyists using web CAD for quick prototypes.

## Functional Requirements

### Parameterization of Walls and Openings
- **Wall Parameters**: Length, height, thickness, material, position (x, y, z), profile (straight/curved). Walls act as "hosts" with a list of hosted openings.
- **Opening Parameters**:
  - **Type**: Door (single/double, sliding/swinging), Window (fixed, casement, bay).
  - **Dimensions**: Width, height, sill height (for windows), frame thickness. Instance parameters (e.g., position) vs. type parameters (e.g., material).
  - **Position**: Offset from wall edges (e.g., distance from left end, elevation from floor). Relative to wall's local coordinates.
  - **Additional**: Swing angle, hardware (handles), trim, material. Support formulas, e.g., `frame_width = wall_thickness / 2`.
- **Constraints**: Openings cannot overlap or exceed wall bounds. Automatic snapping to grid or alignments.

### Adding, Moving, Editing, and Removing Openings
- **Adding**: Select wall, activate tool, click placement point, set initial parameters via modal or sidebar.
- **Moving**: Drag via gizmo; update position parameter and regenerate mesh.
- **Editing**: Select opening, expose parameters in properties panel; changes trigger real-time updates.
- **Removing**: Delete action; wall mesh regenerates without the opening.
- **Batch Operations**: Multi-select for bulk edits (e.g., align all doors).

### Data Model for Storing Parameters
- Use TypeScript interfaces for type safety:
  ```typescript
  interface Wall {
    id: string;
    parameters: {
      length: number;
      height: number;
      thickness: number;
      position: Vector3; // Babylon.js Vector3
      // ...
    };
    openings: Opening[];
  }

  interface Opening {
    id: string;
    type: 'door' | 'window';
    parameters: {
      width: number;
      height: number;
      position: { offsetX: number; elevation: number; };
      frameThickness: number;
      // Formulas as functions or strings for evaluation
    };
  }
  ```
- Store in a centralized state (e.g., Redux or Zustand) for reactivity.
- Serialize to JSON for persistence/export, compatible with IFC (Industry Foundation Classes) for BIM interoperability.

### Geometry Generation and Updates
- **Generation**: Extrude 2D wall profile to 3D mesh. For openings, create subtraction volumes (e.g., box for door) and apply CSG2 boolean subtract.
- **Updates**: On parameter change, recompute mesh asynchronously. Use debouncing for real-time feedback.
- **Non-Destructive Editing**: Maintain parametric history; changes re-apply operations without losing data.
- **Undo/Redo**: Integrate with a command pattern or state history (e.g., Redux-Undo).
- **Real-Time Feedback**: Highlight changes (e.g., wireframe preview) during drags/edits.

## User Flows

### Adding a Door Opening to a Wall
1. User selects wall object in 3D viewport.
2. Activates "Add Opening" tool from toolbar (icon: door silhouette).
3. Clicks on wall face; system snaps to valid position, displays preview mesh.
4. Opens properties sidebar/modal to set type (door), dimensions, position.
5. Confirms; system generates CSG subtraction, updates scene.
UI/UX: Gizmo for placement, tooltip for constraints, error toast if invalid (e.g., "Opening exceeds wall bounds").

### Moving a Door Opening Within a Wall
1. Selects existing door.
2. Activates move tool or drags gizmo axis.
3. Drags along wall plane; real-time preview shows new position.
4. Releases; system updates position parameter, regenerates mesh.
UI/UX: Snapping to increments (e.g., 10cm), collision detection to prevent overlaps.

### Editing or Removing an Existing Opening
1. Selects opening.
2. Edits parameters in sidebar (e.g., increase width).
3. System validates, updates mesh.
4. For removal: Right-click > Delete; confirm dialog, regenerate wall mesh.
UI/UX: Live preview on hover, undo button, selection highlights (e.g., blue outline).

## Technical Architecture

### Scalable File and Folder Structure (Vite + React + TypeScript)
```
src/
├── components/          # UI elements
│   ├── PropertiesPanel.tsx  # Parametric editor
│   ├── Toolbar.tsx      # Add/Move/Edit tools
│   └── Viewport.tsx     # Babylon.js canvas integration
├── models/              # Data models
│   ├── Wall.ts          # Interfaces and classes
│   └── Opening.ts
├── services/            # Business logic
│   ├── GeometryService.ts  # Mesh generation with CSG2
│   └── StateService.ts  # Undo/redo logic
├── stores/              # State management (e.g., Zustand)
│   └── appStore.ts
├── utils/               # Helpers
│   └── csgUtils.ts      # CSG2 wrappers
├── App.tsx              # Root component
└── index.ts             # Entry point
```
Use Vite for bundling, React for UI, TypeScript for safety.

### State Management, Geometry Generation, and Babylon.js Orchestration
- **State**: Use Zustand for lightweight reactivity. Store walls/openings; subscribe to changes for scene updates.
- **Geometry**: In GeometryService, extrude wall (Babylon.js ExtrudeShape), create opening mesh (e.g., Box), apply `CSG2.subtract(wallMesh, openingMesh)`.
- **Scene Updates**: On state change, dispose old mesh, create new, add to Babylon.js scene. Use observers for efficiency.
- **Orchestration**: React component mounts Babylon.js engine; use hooks (e.g., useBabylonScene) for integration.

### Use of CSG2 and 2D Extrusion
- **CSG2**: Ideal for 3D booleans (e.g., subtract complex openings). Use for non-rectangular shapes or when precision is needed (faster than legacy CSG per Babylon.js docs).
- **2D Extrusion**: For simple walls, extrude 2D polygon (subtract openings in 2D first), then extrude to 3D. Use when CSG2 is overkill (e.g., thin walls) to save performance.
- **When Appropriate**: CSG2 for production; 2D for prototypes or low-poly models.

### Performance Considerations
- **Browser Limits**: Offload heavy CSG to Web Workers. Limit scene complexity (e.g., <10k vertices per wall).
- **Server-Side Generation**: For models >100 elements, send params to server (e.g., Node.js with Babylon.js), return serialized mesh. Use when client FPS drops below 30.

## Industry Comparisons

### Comparison to Leading BIM/CAD Tools
- **Revit**: Uses families for parametric doors/windows, hosted in walls with automatic cuts. Best practices: Nest components (e.g., hardware), use formulas for rough dimensions, hide 3D in plans (per BIM Pure tips). Our approach mirrors this with CSG subtraction but in browser (no native hosting).
- **ArchiCAD**: GDL scripts for parametrics; openings auto-adjust wall closures. We adopt relational rules but use JS instead of GDL.
- **AutoCAD**: Dynamic blocks for 2D; 3D via AEC objects. Less parametric than BIM; we exceed with real-time 3D.

### Best Practices for Parametric Modeling
- Instance vs. Type Parameters: Per Revit, use instance for position, type for shared (e.g., material).
- Mesh Regeneration: Lazy updates, like ArchiCAD's on-demand rebuilds.
- From PAACADEMY: Define rules for behaviors, integrate data for analyses.

## Summary Table

| User Action | System Response | UI Components | Mesh Updates |
|-------------|-----------------|----------------|--------------|
| Add Opening | Validate position, create data object, generate subtraction volume | Toolbar button, properties modal, preview gizmo | Extrude wall, CSG2 subtract, add to scene |
| Move Opening | Update position param, check constraints | Drag gizmo, snapping feedback | Recompute CSG on debounce (500ms) |
| Edit Params | Validate formulas, propagate changes | Sidebar inputs, live preview | Partial regen (only affected openings) |
| Remove Opening | Delete data, restore wall | Confirm dialog, undo toast | CSG union or full regen without subtraction |
| Undo/Redo | Restore state snapshot | Keyboard shortcut (Ctrl+Z) | Dispose/recreate meshes from state |

## Best Practices & Key Takeaways

### Most Effective Approaches
- **Scalable Parametrics**: Use reactive state with formulas (e.g., math.js for evaluation) for auto-updates.
- **Performance Optimization**: Web Workers for CSG, level-of-detail (LOD) meshes for distant views.
- **UX Focus**: Intuitive gizmos (Babylon.js GUI), inspired by Revit's drag handles.
- **Interoperability**: Export to glTF/IFC, aligning with OpenBIM.

### Pitfalls to Avoid
- **Over-Parametrization**: Too many params lead to complexity; limit to essentials (anti-pattern from Revit "super-families").
- **Synchronous Heavy Ops**: Avoid blocking UI; always async/debounce.
- **Ignoring Constraints**: Without validation, models break (e.g., overlapping openings).
- **Key Takeaway**: Prioritize non-destructive, rule-based modeling for flexibility, drawing from BIM standards to future-proof the app.

This PRD is actionable; engineers can prototype GeometryService first, then integrate with UI. For questions, reference linked resources.