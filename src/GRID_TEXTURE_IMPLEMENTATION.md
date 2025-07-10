# Grid Texture Implementation for Custom Rooms

## Overview

This implementation persists the grid from the custom room drawing tool onto the floor of created rooms. The grid serves multiple purposes:

1. **Visual Reference**: Provides a persistent grid pattern on the floor matching the drawing grid
2. **Object Movement**: Enables grid-based snapping within rooms
3. **Measurement**: Facilitates distance calculations using grid units

## Implementation Details

### 1. Data Flow

```
CustomRoomModal → RoomData (with gridSize & bounds) → handleCreateCustomRoom → Floor with Grid Texture
```

### 2. Key Components

#### CustomRoomModal Updates
- Added `gridSize` and `drawingBounds` to RoomData interface
- Passes current grid size (adjustable 10-40px) when creating rooms
- Passes SVG canvas dimensions (400x400) for proper scaling

#### Grid Texture Generation
- `createGridTexture()` in `gridTextureUtils.ts` creates a DynamicTexture
- Renders grid pattern matching the drawing tool's grid
- Supports main grid lines and optional sub-grid divisions
- Configurable colors, line widths, and opacity

#### Floor Material Updates
- Floor now uses a grid texture instead of solid color
- Proper UV scaling ensures grid aligns with room geometry
- Grid information stored in mesh metadata for later use

### 3. Grid Utilities

#### Coordinate Conversion
- `gridToWorld()`: Convert grid coordinates to world position
- `worldToGrid()`: Convert world position to grid coordinates
- `snapToRoomGrid()`: Snap positions to nearest grid point

#### UV Scaling
- `calculateGridUVScale()`: Calculates proper texture tiling
- Ensures grid cells maintain correct size regardless of room dimensions

### 4. Usage Examples

#### Snapping Objects to Room Grid
```typescript
// Get room mesh
const roomMesh = sceneManager.getMeshById('custom-room-123')

// Snap object position to room's grid
const snappedPos = snapToRoomGrid(
  { x: object.position.x, z: object.position.z },
  roomMesh
)
object.position.x = snappedPos.x
object.position.z = snappedPos.z
```

#### Converting Grid to World Coordinates
```typescript
// Place object at specific grid position
const worldPos = gridToWorld(5, 3, roomMesh)
if (worldPos) {
  object.position = new Vector3(worldPos.x, 1, worldPos.z)
}
```

### 5. Customization Options

The grid appearance can be customized:

```typescript
const gridTexture = createGridTexture(scene, gridSize, 1024, scale, {
  lineColor: '#e0e0e0',        // Grid line color
  backgroundColor: '#A0522D',    // Floor base color
  lineWidth: 2,                  // Grid line thickness
  opacity: 1,                    // Grid opacity
  showSubGrid: true,             // Enable sub-grid
  subGridDivisions: 4            // Sub-grid divisions per cell
})
```

### 6. Future Enhancements

1. **Toggle Grid Visibility**: Add option to show/hide grid per room
2. **Grid Snap Strength**: Variable snap strength based on zoom level
3. **Measurement Tools**: Display distances in grid units
4. **Grid Customization UI**: Allow users to change grid appearance
5. **Multi-floor Support**: Extend grid system to multiple levels

## Technical Notes

- Grid texture size is 1024x1024 for good quality at various scales
- Texture uses wrapping mode for proper tiling on large floors
- Grid info stored in both mesh metadata and SceneObject for persistence
- UV scaling accounts for room size to maintain consistent grid spacing

## Grid Sizing Fix (Latest Update)

### Issue
The original implementation had incorrect scaling calculations that caused the grid to not match the drawing tool's grid size.

### Solution
1. **Fixed Texture Generation**: Updated `createFullGridTexture` to properly render the grid based on the 400x400 drawing space
2. **Corrected UV Scaling**: Fixed `calculateFullGridUVScale` to ensure proper texture tiling
3. **Exact Grid Matching**: The grid now displays the exact same number of grid cells as shown in the drawing tool

### UI Controls Added

#### Properties Panel Grid Controls
- **Grid Size Slider**: Adjust grid size from 10-40px (matching drawing tool range)
- **Show Grid Toggle**: Turn grid visibility on/off
- **Grid Line Color Picker**: Customize grid line color
- **Show Sub-grid Toggle**: Enable/disable sub-grid divisions
- **Grid Information Display**: Shows drawing size, world scale, and grid cell size
- **Apply to All Rooms**: Button to apply current grid settings to all custom rooms

#### Dynamic Grid Updates
- Grid texture regenerates when any grid property changes
- Real-time preview of grid changes
- Metadata updates ensure persistence across save/load operations

### Implementation Architecture

```
PropertiesPanel → gridInfo update → SceneStore → useBabylonScene → SceneManager → Floor Texture Update
```

The system now properly:
1. Detects gridInfo changes through state diffing
2. Regenerates the floor texture with new settings
3. Maintains exact grid cell count from drawing tool
4. Provides intuitive UI controls for customization

## Grid-Based Object Snapping (Latest Feature)

### Overview
Objects automatically snap to the room's grid when being moved, providing precise placement aligned with the grid pattern.

### Implementation
1. **Room Detection**: The gizmo manager detects when an object is within a custom room's bounding box
2. **Smart Snapping**: Uses room-specific grid settings instead of global grid when inside a room
3. **Seamless Integration**: Works with all transform modes (move, rotate, scale)

### Code Flow
```
GizmoManager → findContainingRoom() → snapToRoomGrid() → Update Position
```

### Features
- Automatic room boundary detection
- Per-room grid size respect
- Works with multi-select operations
- Overrides global snap settings when in rooms

## Measurement Tools (Latest Feature)

### Overview
Comprehensive measurement system that displays grid coordinates and measures distances in both world units and grid cells.

### Components

#### 1. Grid Coordinate Display
- Shows current grid position when hovering over custom room floors
- Displays room name for context
- Real-time coordinate updates

#### 2. Distance Measurement Tool
- Click-to-measure functionality
- Visual measurement line with start/end markers
- Distance display in:
  - World units (meters)
  - Grid cells (X and Z separately)
  - Total grid distance (diagonal)

#### 3. Visual Feedback
- Green sphere for start point
- Red sphere for end point
- Blue measurement line
- On-screen overlay with measurements

### Usage
1. Enable grid display (View → Grid)
2. Click 📏 Measure button
3. Click to set start point
4. Click to set end point
5. View measurements in overlay

### Technical Implementation
- `MeasurementOverlay` component handles UI and interaction
- `worldToGrid()` converts world coordinates to grid coordinates
- 3D visualization using Babylon.js meshes
- Automatic cleanup when measurement mode disabled 