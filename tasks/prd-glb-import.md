# Product Requirements Document: GLB File Import

## Introduction/Overview

This feature enables users to import externally created 3D models in GLB format into the vibeCAD application. Users will be able to import models created in external 3D software (Blender, Maya, etc.) and manipulate them within the scene just like primitive objects. The imported models will be treated as single objects without texture/material preservation, focusing on geometry import for scene composition.

## Goals

1. Enable users to import GLB format 3D models up to 100 MB in size
2. Provide seamless integration of imported models with existing scene manipulation tools
3. Treat imported models as single unified objects for simplified interaction
4. Maintain application performance with file size limitations
5. Provide clear feedback on import success or failure

## User Stories

1. **As a 3D artist**, I want to import models I've created in Blender so that I can compose complex scenes in vibeCAD.
2. **As a designer**, I want to import pre-made 3D assets so that I can quickly build scenes without modeling everything from scratch.
3. **As a user**, I want to position and scale imported models so that they fit properly within my scene composition.
4. **As a user**, I want clear feedback when an import fails so that I understand something went wrong.

## Functional Requirements

1. **Import Button**
   - The system must add an import button to the sidebar UI
   - The button must be clearly labeled (e.g., "Import GLB" or with an import icon)
   - The button must trigger a file picker dialog when clicked

2. **File Selection**
   - The system must open a native file picker dialog
   - The file picker must filter for GLB files (*.glb)
   - The system must validate file size before processing (max 100 MB)

3. **GLB Processing**
   - The system must load the GLB file using Babylon.js GLB loader
   - The system must merge all meshes into a single unified mesh
   - The system must discard texture/material information
   - The system must apply a default material/color to the imported model

4. **Scene Integration**
   - The system must add the imported model to the scene as a new SceneObject
   - The model must be positioned at the scene origin (0, 0, 0) by default
   - The model must have a unique ID following existing naming conventions
   - The model must be immediately selectable after import

5. **Property Editing**
   - The imported model must support all standard transformations (position, rotation, scale)
   - The model must appear in the scene graph with type "imported-glb" or similar
   - The properties panel must display and allow editing of transform properties
   - The model must work with existing gizmo controls

6. **Error Handling**
   - The system must display "IMPORT FAILED" message for any import errors
   - Error cases must include: file too large, invalid GLB format, loading failures
   - The error message must be brief and non-technical

## Non-Goals (Out of Scope)

1. Preserving GLB material/texture information
2. Supporting GLB animations
3. Maintaining mesh hierarchy (all meshes merged into one)
4. AI integration or natural language commands for imported models
5. Drag-and-drop import functionality
6. URL-based import
7. Support for other 3D file formats (FBX, OBJ, etc.)
8. Batch import of multiple files
9. Import progress indicators
10. Detailed error messages or debugging information

## Design Considerations

- The import button should follow the existing sidebar UI patterns
- The button should be placed logically within the sidebar (e.g., near scene controls)
- Consider using an icon (📁 or ⬆️) with text for clarity
- The imported model should use the existing object selection highlight
- Error messages should appear as temporary notifications or in the existing response log area

## Technical Considerations

- Babylon.js has built-in GLB loader support via SceneLoader
- File size validation should occur before attempting to load
- Memory management: large models should be properly disposed if import fails
- The mesh merging process should preserve the overall geometry while creating a single mesh
- Default material should match the application's visual style

## Success Metrics

1. Users can successfully import GLB files up to 100 MB
2. Imported models can be manipulated like any other scene object
3. Import process completes within reasonable time (< 5 seconds for typical models)
4. No memory leaks or performance degradation after multiple imports
5. Clear error feedback prevents user confusion on failed imports

## Open Questions

1. Should imported models have a specific default color, or use the current color selection?
2. Should there be a way to delete imported models differently from primitives?
3. Should the system auto-scale very large or very small models to a reasonable size?
4. Should successfully imported models be automatically selected?
5. Should there be any visual indication in the scene graph that an object is imported vs. created? 