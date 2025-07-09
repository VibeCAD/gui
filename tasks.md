# VibeCAD CSG Implementation Plan

This plan outlines the steps required to implement the CSG (Constructive Solid Geometry) workflow for creating dynamic geometry, such as cutting a hole for a door in a wall.

- [x] **1. Setup Initial Scene**: 
  - Create a simple test environment within the existing scene structure.
  - Add two distinct box meshes: one representing a "wall" (e.g., wide and thin) and another representing a "door" (standard door dimensions).
  - Position them to intersect, simulating where the door would be placed in the wall.

- [x] **2. Implement CSG Conversion**:
  - Create a new service or utility module (e.g., `csgService.ts`).
  - Add a function that takes a BabylonJS mesh as input and converts it to a `BABYLON.CSG2` object using `BABYLON.CSG2.FromMesh()`.

- [x] **3. Perform Subtraction**:
  - In the new service, create a function that takes two CSG2 objects as input (e.g., `wallCSG` and `doorCSG`).
  - Perform the subtraction operation: `wallCSG.subtract(doorCSG)`.
  - This function will return the new CSG2 object representing the wall with the hole.

- [x] **4. Convert Back to Mesh**:
  - Add a function to the service that takes a CSG2 object and converts it back into a renderable BabylonJS mesh using `.toMesh()`.
  - Ensure the new mesh is given a unique name and appropriate material.

- [x] **5. Scene State Management**:
  - Develop a workflow to manage the scene state after a CSG operation.
  - The original "wall" and "door" meshes should be disposed of.
  - The new, modified "wall" mesh (with the cutout) should be added to the scene.
  - Investigate using the `sceneStore` or other state management to track these changes.

- [x] **6. Create Reusable Service**:
  - Refactor the functions from steps 2-4 into a clean, reusable service.
  - The final service should expose a simple API, e.g., `createCutout(wallMesh, doorMesh)`.
  - This function will handle the entire process: mesh-to-CSG2, subtraction, CSG2-to-mesh, and returning the final mesh.
