import type {ReactNode} from 'react';
import FeatureCard from '../FeatureCard';
import styles from './styles.module.css';

type FeatureData = {
  icon: string;
  title: string;
  description: ReactNode;
  features: string[];
};

const FeatureList: FeatureData[] = [
  {
    icon: '🎮',
    title: 'Movement Controls',
    description: 'Professional FPS-style camera navigation with full keyboard and mouse support.',
    features: [
      'W/A/S/D - Move forward/left/backward/right',
      'Q/E - Move up/down',
      'Shift - Sprint mode (2x speed)',
      'Automatically disabled during text input',
      'Configurable speed settings (0.05 - 1.0)',
      'Settings persist across sessions'
    ]
  },
  {
    icon: '🎨',
    title: '3D Modeling',
    description: 'Comprehensive 3D modeling tools for creating and manipulating objects.',
    features: [
      'Primitive shapes (cube, sphere, cylinder, plane, torus, cone)',
      'Housing components (walls, doors, windows, roofs)',
      'Custom room designer with polygon drawing',
      'Advanced transform tools (move, rotate, scale)',
      'Multi-object selection and manipulation'
    ]
  },
  {
    icon: '🏗️',
    title: 'Building System',
    description: 'Advanced building tools with intelligent snapping and alignment.',
    features: [
      'Modular housing components',
      'Snapping and alignment tools',
      'Connection point visualization',
      'Collision detection',
      'Grid-based positioning'
    ]
  },
  {
    icon: '🖼️',
    title: 'Materials & Textures',
    description: 'Powerful material system with comprehensive texture support.',
    features: [
      'Color picker with RGB/Hex input',
      'Material presets',
      'Texture upload and management',
      'Texture scaling and offset controls',
      'Support for diffuse, normal, specular, and emissive maps'
    ]
  },
  {
    icon: '🤖',
    title: 'AI Integration',
    description: 'Natural language scene manipulation powered by OpenAI.',
    features: [
      'Scene manipulation via natural language',
      'OpenAI-powered object generation and modification',
      'Intelligent suggestions and automation'
    ]
  }
];

export default function FeatureCards(): ReactNode {
  return (
    <section className={styles.features}>
      <div className="container">
        <div className={styles.featuresGrid}>
          {FeatureList.map((feature, idx) => (
            <FeatureCard key={idx} {...feature} />
          ))}
        </div>
      </div>
    </section>
  );
} 