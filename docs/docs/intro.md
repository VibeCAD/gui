---
title: Project Overview
sidebar_position: 1
---

# Moorph - 3D Design and Modeling Application

Moorph is a powerful web-based 3D design and modeling application built with React, TypeScript, and Babylon.js. It provides an intuitive interface for creating, manipulating, and visualizing 3D objects and scenes.

## Features

import FeatureCards from '@site/src/components/FeatureCards';

<FeatureCards />

## Quick Start

import QuickStartCards from '@site/src/components/QuickStartCards';

<QuickStartCards />

## Usage

import UsageCards from '@site/src/components/UsageCards';

<UsageCards />

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

import PerformanceCards from '@site/src/components/PerformanceCards';

<PerformanceCards />

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
