# Task List: GLB File Import Implementation

## Relevant Files

- `src/types/types.ts` - Add new type definitions for imported GLB objects
- `src/state/sceneStore.ts` - Add state and actions for GLB import functionality
- `src/babylon/glbImporter.ts` - New file for GLB import logic and mesh processing
- `src/babylon/glbImporter.test.ts` - Unit tests for GLB import functionality
- `src/components/sidebar/ImportButton.tsx` - New component for import button UI
- `src/components/sidebar/ImportButton.test.tsx` - Unit tests for import button component
- `src/components/sidebar/AISidebar.tsx` - Modify to include the import button
- `src/App.css` - Add styles for import button and error messages
- `src/babylon/sceneManager.ts` - Extend to handle imported GLB meshes
- `src/babylon/objectFactory.ts` - Update to support imported mesh type

### Notes

- Unit tests should be placed alongside the code files they are testing
- Use `npx jest [optional/path/to/test/file]` to run tests
- Babylon.js SceneLoader will be used for GLB file loading
- File size validation should happen before attempting to load the file

## Tasks

- [x] 1.0 Set up type definitions and state management for GLB import
  - [x] 1.1 Add 'imported-glb' to PrimitiveType in types.ts
  - [x] 1.2 Create ImportError type for error handling
  - [x] 1.3 Add import-related state properties to SceneState interface (isImporting, importError)
  - [x] 1.4 Add import action methods to SceneActions interface (startImport, importSuccess, importError, clearImportError)
  - [x] 1.5 Implement the import action methods in the store

- [ ] 2.0 Implement GLB file import and processing logic
  - [x] 2.1 Create glbImporter.ts with GLBImporter class
  - [x] 2.2 Implement file size validation method (100 MB limit)
  - [x] 2.3 Implement GLB loading using Babylon.js SceneLoader
  - [x] 2.4 Implement mesh merging logic to combine all meshes into single mesh
  - [x] 2.5 Implement material stripping and default material application
  - [x] 2.6 Create method to convert loaded mesh to SceneObject format
  - [ ] 2.7 Write unit tests for GLBImporter class

- [ ] 3.0 Create import button UI component
  - [x] 3.1 Create ImportButton.tsx component with file input handling
  - [x] 3.2 Implement file picker dialog trigger on button click
  - [x] 3.3 Add file type filtering for .glb files only
  - [x] 3.4 Connect button to store actions (trigger import process)
  - [x] 3.5 Add loading state visual feedback during import
  - [ ] 3.6 Style the button to match existing sidebar UI
  - [ ] 3.7 Write unit tests for ImportButton component

- [ ] 4.0 Integrate import functionality with existing scene management
  - [ ] 4.1 Update objectFactory.ts to handle 'imported-glb' type
  - [ ] 4.2 Modify sceneManager.ts to support imported mesh addition
  - [ ] 4.3 Update useBabylonScene hook to handle imported objects
  - [ ] 4.4 Ensure imported objects work with existing gizmo controls
  - [ ] 4.5 Add ImportButton to AISidebar component
  - [ ] 4.6 Verify imported objects appear correctly in SceneGraph component
  - [ ] 4.7 Verify PropertiesPanel works with imported objects

- [ ] 5.0 Add error handling and user feedback
  - [ ] 5.1 Implement error display for "IMPORT FAILED" message
  - [ ] 5.2 Add error handling for file too large scenario
  - [ ] 5.3 Add error handling for invalid GLB format
  - [ ] 5.4 Add error handling for network/loading failures
  - [ ] 5.5 Implement error message display in UI (brief, non-technical)
  - [ ] 5.6 Add automatic error message dismissal or manual clear option
  - [ ] 5.7 Add CSS styles for error message display 