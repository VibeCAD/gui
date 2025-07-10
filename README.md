# VibeCad Pro - 3D Design and Modeling Application

VibeCad Pro is a powerful web-based 3D design and modeling application built with React, TypeScript, and Babylon.js. It provides an intuitive interface for creating, manipulating, and visualizing 3D objects and scenes.

## Features

### 🎮 Movement Controls
- **WASD Movement**: Professional FPS-style camera navigation
  - `W/A/S/D` - Move forward/left/backward/right
  - `Q/E` - Move up/down
  - `Shift` - Sprint mode (2x speed)
  - Automatically disabled during text input or modal interactions
  - Configurable speed settings (0.05 - 1.0 units/frame)
  - Settings persist across sessions

### 🎨 3D Modeling
- Primitive shapes (cube, sphere, cylinder, plane, torus, cone)
- Housing components (walls, doors, windows, roofs)
- Custom room designer with polygon drawing
- Advanced transform tools (move, rotate, scale)
- Multi-object selection and manipulation

### 🏗️ Building System
- Modular housing components
- Snapping and alignment tools
- Connection point visualization
- Collision detection
- Grid-based positioning

### 🎨 Materials & Textures
- Color picker with RGB/Hex input
- Material presets
- Texture upload and management
- Texture scaling and offset controls
- Support for diffuse, normal, specular, and emissive maps

### 🤖 AI Integration
- Scene manipulation via natural language
- OpenAI-powered object generation and modification
- Intelligent suggestions and automation

## Quick Start

1. **Clone the repository**
   ```bash
   git clone <repository-url>
   cd vibecad-flagship
   ```

2. **Install dependencies**
   ```bash
   npm install
   ```

3. **Start development server**
   ```bash
   npm run dev
   ```

4. **Open your browser**
   Navigate to `http://localhost:5173`

## Usage

### Navigation
- **Mouse**: Click and drag to orbit, right-click to pan, scroll to zoom
- **WASD**: Enable in Tools menu for keyboard navigation
- **Camera Views**: Use View menu for preset camera positions (Front, Top, etc.)

### Creating Objects
1. Open the **Create** menu in the toolbar
2. Select from Primitives, Housing, or Custom options
3. Objects appear at random positions in the scene
4. Use transform tools to position and modify

### WASD Movement Controls
1. **Enable**: Go to Tools > Movement Controls > Enable WASD Movement
2. **Configure Speed**: Adjust the Movement Speed slider (0.05 - 1.0)
3. **Navigate**: Use WASD keys to move, Q/E for vertical movement, Shift to sprint
4. **Status**: Check the toolbar status indicator to see current movement state

### Material Assignment
1. Select an object in the 3D scene
2. Open the **Material** menu
3. Choose colors or upload textures
4. Apply to selected objects

### AI Features
1. Enter your OpenAI API key when prompted
2. Use the AI sidebar to describe desired changes
3. The AI will interpret and execute scene modifications

## Architecture

### Core Components
- **SceneManager**: Central Babylon.js scene management
- **MovementController**: WASD camera movement system
- **SceneStore**: Zustand-based state management
- **HousingFactory**: Procedural building component generation
- **TextureManager**: Texture loading and application

### Key Technologies
- **Frontend**: React 18, TypeScript, Vite
- **3D Engine**: Babylon.js 5.x
- **State Management**: Zustand
- **AI Integration**: OpenAI API
- **Build Tool**: Vite with ESLint

## Performance

The application is optimized for:
- **60+ FPS**: Smooth camera movement and scene rendering
- **Sub-16ms Input Latency**: Responsive WASD controls
- **Large Scenes**: Efficient handling of complex 3D models
- **Cross-Browser**: Compatible with modern browsers

## Development

### Project Structure
```
src/
├── babylon/           # Babylon.js integration
│   ├── movementController.ts  # WASD movement system
│   ├── sceneManager.ts       # Scene management
│   └── hooks/               # React hooks for 3D
├── components/        # React components
│   ├── toolbar/      # Top toolbar and menus
│   ├── sidebar/      # AI and properties panels
│   └── modals/       # Dialog components
├── state/            # State management
│   └── sceneStore.ts # Main application state
└── types/            # TypeScript definitions
```

### Key Features Implementation

#### WASD Movement System
The movement system provides FPS-style camera navigation:
- **Frame-rate independent**: Uses deltaTime for consistent movement
- **Performance optimized**: Throttled updates and cached calculations
- **Input filtering**: Automatically disabled during text input/modals
- **Browser compatible**: Fallbacks for older browsers
- **Error handling**: Graceful recovery from unexpected states

#### Building System
Advanced housing components with:
- **Connection points**: Automatic snapping between components
- **Collision detection**: Prevent object overlapping
- **Modular design**: Walls, doors, windows with relationships

#### AI Integration
Natural language scene manipulation:
- **OpenAI API**: GPT-powered interpretation
- **Scene understanding**: Context-aware modifications
- **Error handling**: Graceful fallbacks for API issues

## Contributing

1. **Fork the repository**
2. **Create a feature branch**
   ```bash
   git checkout -b feature/amazing-feature
   ```
3. **Make your changes**
4. **Add tests** (if applicable)
5. **Commit with descriptive messages**
   ```bash
   git commit -m "Add amazing feature"
   ```
6. **Push to your branch**
   ```bash
   git push origin feature/amazing-feature
   ```
7. **Open a Pull Request**

## Browser Support

- Chrome 80+
- Firefox 75+
- Safari 13+
- Edge 80+

## License

This project is licensed under the MIT License - see the LICENSE file for details.

## Acknowledgments

- **Babylon.js** - Powerful 3D engine
- **React** - Component-based UI
- **OpenAI** - AI-powered features
- **Vite** - Fast build tool