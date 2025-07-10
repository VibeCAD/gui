# Product Requirements Document: Minimap Navigation Display

## 1. Overview

### 1.1 Feature Name
3D Scene Minimap

### 1.2 Feature Description
A real-time, top-down minimap display positioned in the top-left corner of the VibeCad interface, providing users with spatial awareness of object positions and camera orientation within the 3D scene.

### 1.3 Document Information
- **Author**: VibeCad Development Team
- **Date**: December 2024
- **Version**: 1.0
- **Status**: Proposed

## 2. Background & Context

### 2.1 Problem Statement
Users working with complex 3D scenes face several navigation challenges:
- **Spatial Disorientation**: Losing track of position in large scenes
- **Object Location**: Difficulty finding specific objects when zoomed in
- **Scene Overview**: No quick way to understand overall scene layout
- **Camera Context**: Unclear which direction camera is facing
- **Relative Positioning**: Hard to judge distances between objects

### 2.2 Market Research
Industry standard 3D applications with minimap features:
- **Game Engines**: Unity, Unreal Engine (scene overview widgets)
- **CAD Software**: AutoCAD (ViewCube + Navigation tools)
- **3D Modeling**: Blender (viewport navigation aids)
- **Games**: Minecraft, SimCity (minimap for orientation)

### 2.3 Strategic Alignment
This feature supports VibeCad's mission to:
- Improve spatial navigation in complex scenes
- Reduce time spent searching for objects
- Enhance professional workflow efficiency
- Provide familiar navigation patterns from gaming

## 3. Objectives & Success Metrics

### 3.1 Primary Objectives
1. Provide constant spatial awareness of scene layout
2. Enable quick object location and identification
3. Show real-time camera position and orientation
4. Improve navigation efficiency in large scenes

### 3.2 Success Metrics
- **Navigation Time**: 40% reduction in time to locate objects
- **User Adoption**: 75% of users with 10+ objects use minimap
- **Performance Impact**: < 5% FPS reduction when enabled
- **Error Reduction**: 30% fewer "lost in scene" support tickets
- **Satisfaction**: 4.2+ star rating for navigation features

## 4. User Personas & Use Cases

### 4.1 Primary Personas

**1. Architectural Designer (David)**
- Works with large building models
- Needs to navigate between rooms quickly
- Requires overview while focusing on details
- Values efficient spatial navigation

**2. Product Designer (Emma)**
- Creates complex mechanical assemblies
- Needs to track multiple components
- Switches between detail and overview frequently
- Requires precise object location

**3. Educational User (Prof. Zhang)**
- Demonstrates 3D concepts to students
- Needs clear visualization aids
- Values intuitive navigation tools
- Requires easy-to-explain features

### 4.2 Use Cases

**UC1: Large Scene Navigation**
```
Given: User has imported a multi-story building with 100+ objects
When: User enables minimap
Then: Can see all floors/rooms from top view
And: Can click minimap to jump to specific areas
```

**UC2: Object Search & Location**
```
Given: User needs to find specific door component
When: User looks at minimap
Then: Sees highlighted object indicator
And: Can identify object by color/icon
And: Understands object's position relative to camera
```

**UC3: Collaborative Design Review**
```
Given: Designer presenting to client via screen share
When: Navigating through 3D model
Then: Client can follow along using minimap
And: Understands current location in overall design
```

**UC4: Multi-Object Assembly**
```
Given: User assembling multiple components
When: Placing objects precisely
Then: Uses minimap to verify spacing
And: Confirms alignment from top view
```

## 5. Functional Requirements

### 5.1 Core Display Requirements

**FR1: Minimap Rendering**
- **FR1.1**: Display top-down orthographic view of scene
- **FR1.2**: Update in real-time (30+ FPS minimum)
- **FR1.3**: Show all non-hidden objects
- **FR1.4**: Maintain aspect ratio of scene bounds
- **FR1.5**: Auto-scale to fit all objects

**FR2: Object Representation**
- **FR2.1**: Display objects as simplified 2D shapes
- **FR2.2**: Use object colors from main scene
- **FR2.3**: Show object selection state
- **FR2.4**: Indicate locked objects differently
- **FR2.5**: Group overlapping objects intelligently

**FR3: Camera Visualization**
- **FR3.1**: Show camera position as distinct icon
- **FR3.2**: Display camera viewing direction (cone/arrow)
- **FR3.3**: Indicate camera field of view
- **FR3.4**: Update smoothly during movement
- **FR3.5**: Different icon when in WASD mode

**FR4: Interactive Features**
- **FR4.1**: Click to center camera on location
- **FR4.2**: Click objects to select them
- **FR4.3**: Drag to pan camera to area
- **FR4.4**: Scroll to zoom minimap view
- **FR4.5**: Right-click for context menu

### 5.2 Configuration Requirements

**FR5: Display Options**
- **FR5.1**: Toggle minimap on/off
- **FR5.2**: Resize minimap (S/M/L presets)
- **FR5.3**: Adjust transparency (50-100%)
- **FR5.4**: Choose corner position (TL/TR/BL/BR)
- **FR5.5**: Set update frequency

**FR6: Filtering Options**
- **FR6.1**: Filter by object type
- **FR6.2**: Show/hide ground plane
- **FR6.3**: Show/hide selection only
- **FR6.4**: Toggle label display
- **FR6.5**: Set minimum object size

### 5.3 Visual Design Requirements

**FR7: Appearance**
- **FR7.1**: Semi-transparent background
- **FR7.2**: Subtle border with resize handle
- **FR7.3**: Compass rose indicating North
- **FR7.4**: Scale indicator
- **FR7.5**: Optional grid overlay

**FR8: Information Display**
- **FR8.1**: Object count indicator
- **FR8.2**: Current zoom level
- **FR8.3**: Coordinates on hover
- **FR8.4**: Distance measurements
- **FR8.5**: Selection information

## 6. Non-Functional Requirements

### 6.1 Performance
- **NFR1**: < 5ms render time per frame
- **NFR2**: < 50MB memory footprint
- **NFR3**: GPU-accelerated rendering
- **NFR4**: Level-of-detail for 1000+ objects
- **NFR5**: Efficient culling algorithm

### 6.2 Usability
- **NFR6**: Learnable in < 1 minute
- **NFR7**: Intuitive iconography
- **NFR8**: Consistent with gaming minimaps
- **NFR9**: Clear visual hierarchy
- **NFR10**: Accessible color choices

### 6.3 Responsiveness
- **NFR11**: Resize with viewport
- **NFR12**: Maintain readability at all sizes
- **NFR13**: Touch-friendly on tablets
- **NFR14**: Smooth animations
- **NFR15**: No lag during interaction

## 7. Technical Specifications

### 7.1 Architecture

```
┌─────────────────────┐
│   MinimapOverlay    │
│   (React Component) │
└──────────┬──────────┘
           │
┌──────────▼──────────┐
│  MinimapRenderer    │
│  (Canvas/WebGL)     │
└──────────┬──────────┘
           │
┌──────────▼──────────┐
│  SceneDataAdapter   │
│ (Object Positions)  │
└──────────┬──────────┘
           │
┌──────────▼──────────┐
│    SceneManager     │
│  (Source of Truth)  │
└─────────────────────┘
```

### 7.2 Implementation Components

**Component: MinimapOverlay**
```typescript
interface MinimapProps {
  position: 'top-left' | 'top-right' | 'bottom-left' | 'bottom-right'
  size: 'small' | 'medium' | 'large'
  opacity: number
  showGrid: boolean
  showLabels: boolean
  filterTypes: string[]
}

class MinimapOverlay extends React.Component<MinimapProps> {
  - canvas: HTMLCanvasElement
  - renderer: MinimapRenderer
  - isInteracting: boolean
  
  + handleClick(x: number, y: number): void
  + handleDrag(dx: number, dy: number): void
  + handleZoom(delta: number): void
  + updateDisplay(): void
}
```

**Component: MinimapRenderer**
```typescript
class MinimapRenderer {
  - ctx: CanvasRenderingContext2D
  - viewBounds: BoundingBox
  - zoom: number
  - offset: Vector2
  
  + renderFrame(objects: MinimapObject[]): void
  + projectToMinimap(worldPos: Vector3): Vector2
  + unprojectFromMinimap(screenPos: Vector2): Vector3
  + drawObject(obj: MinimapObject): void
  + drawCamera(pos: Vector3, dir: Vector3): void
}
```

### 7.3 Data Flow
1. Scene objects update in main view
2. SceneDataAdapter extracts positions
3. MinimapRenderer projects to 2D
4. Canvas renders simplified shapes
5. User interactions converted to 3D commands

### 7.4 Rendering Pipeline
```
World Space → View Projection → Screen Space → Canvas Draw
     ↓              ↓                ↓              ↓
  3D Coords    Orthographic    2D Coords     Shapes/Icons
```

## 8. User Experience Design

### 8.1 Visual Hierarchy
```
┌─────────────────┐
│ ┌─┐ North      │ ← Compass
│ │C│    ↑       │ ← Camera Icon
│ └─┘    │       │
│        │       │
│ ▪ ▪ ▪  │  ▪ ▪  │ ← Object Dots
│ ▪ ▪ ▪ ─┴─ ▪ ▪  │
│                │
│ 10m ├────┤     │ ← Scale
└─────────────────┘
```

### 8.2 Interaction States
- **Default**: Semi-transparent, minimal info
- **Hover**: Show coordinates, highlight objects
- **Active**: Full opacity, detailed information
- **Dragging**: Pan indicator, distance display
- **Minimized**: Icon only, click to expand

### 8.3 Responsive Behavior
- **Small (150x150px)**: Icons only, no labels
- **Medium (250x250px)**: Icons + selection info
- **Large (350x350px)**: Full details + labels

## 9. Testing Requirements

### 9.1 Functional Tests
- Object position accuracy (< 1px deviation)
- Camera orientation correctness
- Click targeting precision
- Zoom level calculations
- Filter functionality

### 9.2 Performance Tests
- 1000 object scene at 60 FPS
- Continuous movement tracking
- Memory leak detection
- GPU utilization monitoring
- Battery impact on mobile

### 9.3 Usability Tests
- Time to locate specific object
- Accuracy of spatial understanding
- Learning curve measurement
- Accessibility compliance
- Color blind compatibility

### 9.4 Integration Tests
- WASD movement synchronization
- Selection state consistency
- Multi-viewport support
- Save/load state persistence
- Real-time collaboration sync

## 10. Release & Rollout Plan

### 10.1 Development Phases

**Phase 1: MVP (Week 1-2)**
- Basic top-down view
- Camera position indicator
- Object dots with colors
- Click to navigate

**Phase 2: Enhanced (Week 3-4)**
- Interactive features
- Filtering options
- Performance optimization
- Polish animations

**Phase 3: Advanced (Week 5-6)**
- Labels and measurements
- Multi-floor support
- Heatmap modes
- API for plugins

### 10.2 Feature Flags
```javascript
{
  "minimap": {
    "enabled": true,
    "maxObjects": 1000,
    "updateRate": 30,
    "features": {
      "interaction": true,
      "filtering": true,
      "labels": false,
      "measurements": false
    }
  }
}
```

## 11. Future Enhancements

### 11.1 Version 2.0 Features
1. **3D Minimap Mode**: Isometric view option
2. **Path Planning**: Show movement routes
3. **Heatmaps**: Object density visualization
4. **Time Scrubbing**: Historical position playback
5. **AR Mode**: Project onto physical surface

### 11.2 Advanced Capabilities
- **AI Assistant**: "Show me all doors" highlighting
- **Collaboration**: Multi-user position tracking
- **Analytics**: Movement pattern analysis
- **Export**: Minimap as separate image/video
- **Customization**: User-defined minimap styles

### 11.3 Integration Opportunities
- Building Information Modeling (BIM) data
- IoT sensor visualization
- Real-time simulation data
- Version control visualization
- Project timeline overview

## 12. Risks & Mitigations

| Risk | Impact | Probability | Mitigation |
|------|--------|-------------|------------|
| Performance degradation | High | Medium | Canvas optimization, WebGL fallback |
| Visual clutter | Medium | High | Smart filtering, LOD system |
| Mobile usability | High | Medium | Responsive design, gesture support |
| Color accessibility | Medium | Medium | High contrast mode, patterns |
| Scene complexity | High | Low | Intelligent clustering, sampling |

## 13. Dependencies

### 13.1 Technical Dependencies
- HTML5 Canvas API
- WebGL 2.0 (optional acceleration)
- React 18+ (portal rendering)
- Babylon.js scene graph
- Browser ResizeObserver API

### 13.2 Design System Dependencies
- Consistent iconography
- Color palette adherence
- Animation timing standards
- Tooltip components
- Accessibility framework

## 14. API Specification

### 14.1 Public API
```typescript
interface MinimapAPI {
  // Control
  show(): void
  hide(): void
  toggle(): void
  
  // Navigation
  centerOn(position: Vector3): void
  zoomToFit(objects?: string[]): void
  
  // Configuration
  setSize(size: 'small' | 'medium' | 'large'): void
  setPosition(corner: Corner): void
  setFilters(filters: FilterOptions): void
  
  // Events
  on(event: 'click', handler: (pos: Vector3) => void): void
  on(event: 'hover', handler: (obj: string | null) => void): void
}
```

### 14.2 Events
- `minimap:click` - User clicked location
- `minimap:objectSelect` - Object selected via minimap
- `minimap:zoom` - Zoom level changed
- `minimap:pan` - View panned
- `minimap:toggle` - Visibility changed

## 15. Appendices

### A. Competitive Analysis
| Software | Minimap Type | Features | Interaction |
|----------|--------------|----------|-------------|
| Unity | 2D Overlay | Objects, camera, gizmos | Click to focus |
| AutoCAD | ViewCube+ | 3D navigation, views | Full navigation |
| Blender | Outliner | Tree view, no spatial | Selection only |
| Minecraft | 2D Map | Terrain, entities | Zoom levels |
| SimCity | 2D Overview | Zones, buildings | Click to jump |

### B. Size Specifications
```
Small:  150x150px (mobile friendly)
Medium: 250x250px (default desktop)
Large:  350x350px (detailed work)

Border: 2px
Padding: 8px
Corner Radius: 8px
Opacity: 0.85 (default)
```

### C. Icon Library
- **Camera**: Triangle with view cone
- **Selected Object**: Highlight ring
- **Locked Object**: Lock symbol overlay
- **Hidden Object**: Dashed outline
- **Ground Plane**: Grid pattern
- **North Indicator**: Compass arrow
- **Scale Bar**: Graduated line

### D. Performance Benchmarks
| Objects | Target FPS | Max Memory | Update Rate |
|---------|------------|-------------|-------------|
| 100 | 60 | 10MB | 60Hz |
| 1000 | 60 | 25MB | 30Hz |
| 10000 | 30 | 50MB | 15Hz |
| 100000 | 15 | 100MB | 5Hz |