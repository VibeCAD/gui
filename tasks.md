# VibeCAD Parametric Openings Task List

This task list is derived from the **Product Requirements Document (PRD)** for implementing parametric openings. It's structured to guide development from foundational data models to advanced features.

---

## Phase 1: Foundation & Data Structures

- [ ] **1.1: Project Structure Setup**
  - [ ] Create the directory structure outlined in the PRD (`/models`, `/services`, `/stores`, `/utils`).
- [ ] **1.2: Data Models**
  - [ ] Create `src/models/Wall.ts` with the `Wall` TypeScript interface.
  - [ ] Create `src/models/Opening.ts` with the `Opening` TypeScript interface.
- [ ] **1.3: State Management**
  - [ ] Integrate Zustand for global state management.
  - [ ] Create `src/stores/appStore.ts` to manage walls and openings.
  - [ ] Implement actions for adding, updating, and removing walls and openings in the store.

---

## Phase 2: Core Geometry & Scene Logic

- [ ] **2.1: Geometry Service**
  - [ ] Create `src/services/GeometryService.ts`.
  - [ ] Implement a function to generate a 3D wall mesh from `Wall` parameters (e.g., using `ExtrudeShape`).
  - [ ] Implement a function to create a 3D subtraction volume from `Opening` parameters (e.g., using `CreateBox`).
- [ ] **2.2: CSG Integration**
  - [ ] Create `src/utils/csgUtils.ts` for wrapping Babylon.js `CSG2` operations.
  - [ ] Implement a function in `GeometryService` that subtracts openings from a wall mesh using `CSG2.subtract`.
- [ ] **2.3: Scene Orchestration**
  - [ ] Create a React hook or service to subscribe to the `appStore`.
  - [ ] On state change, regenerate and render the relevant wall mesh in the Babylon.js scene.
  - [ ] Implement logic to dispose of old meshes and add new ones efficiently.
- [ ] **2.4: Basic Interaction**
  - [ ] Implement mesh picking to select walls in the 3D viewport.

---

## Phase 3: UI/UX & User Flows

- [ ] **3.1: Toolbar**
  - [ ] Create a `Toolbar.tsx` component.
  - [ ] Add a button to the toolbar to activate the "Add Opening" tool.
- [ ] **3.2: Properties Panel**
  - [ ] Create a `PropertiesPanel.tsx` component.
  - [ ] When a wall or opening is selected, display its parameters in the panel.
  - [ ] Allow users to edit parameters, which updates the object in the `appStore`.
  - [ ] Implement debouncing on input changes to prevent excessive re-renders.
- [ ] **3.3: Add Opening Flow**
  - [ ] Implement the user flow: select wall, activate tool, click on the wall to place an opening.
  - [ ] On placement, open a modal or use the `PropertiesPanel` to set initial dimensions.
  - [ ] Implement preview geometry for the opening before it's confirmed.
- [ ] **3.4: Move Opening Flow**
  - [ ] Integrate the Babylon.js `GizmoManager` for moving selected openings.
  - [ ] Update the opening's position in the `appStore` as the gizmo is dragged.
  - [ ] Implement snapping to a grid or increments.
- [ ] **3.5: Edit & Remove Opening Flow**
  - [ ] Ensure editing parameters in the `PropertiesPanel` provides real-time updates.
  - [ ] Add a "Delete" button or context menu action to remove a selected opening.

---

## Phase 4: Advanced Features & Polish

- [ ] **4.1: Constraints & Validation**
  - [ ] Implement validation logic to prevent openings from being placed outside wall bounds.
  - [ ] Add logic to prevent openings from overlapping.
- [ ] **4.2: Undo/Redo**
  - [ ] Integrate a state history solution (e.g., `zustand/middleware/temporal`) to enable undo/redo for all major actions.
- [ ] **4.3: Performance Optimization**
  - [ ] (Research) Investigate offloading CSG calculations to a Web Worker to keep the main thread responsive.
- [ ] **4.4: Interoperability**
  - [ ] Implement a basic JSON export/import feature for the scene state.
- [ ] **4.5: Visual Feedback**
  - [ ] Implement selection highlights for walls and openings.
  - [ ] Show visual tooltips or error messages for invalid actions.
