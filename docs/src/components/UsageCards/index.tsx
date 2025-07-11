import type {ReactNode} from 'react';
import styles from './styles.module.css';

type UsageCard = {
  icon: string;
  title: string;
  description: ReactNode;
  steps: string[];
};

const UsageList: UsageCard[] = [
  {
    icon: '🖱️',
    title: 'Navigation',
    description: 'Master the camera controls to navigate your 3D scene with ease.',
    steps: [
      'Mouse: Click and drag to orbit, right-click to pan, scroll to zoom',
      'WASD: Enable in Tools menu for keyboard navigation',
      'Camera Views: Use View menu for preset camera positions (Front, Top, etc.)'
    ]
  },
  {
    icon: '🎯',
    title: 'Creating Objects',
    description: 'Add and customize 3D objects in your scene.',
    steps: [
      'Open the Create menu in the toolbar',
      'Select from Primitives, Housing, or Custom options',
      'Objects appear at random positions in the scene',
      'Use transform tools to position and modify'
    ]
  },
  {
    icon: '⌨️',
    title: 'WASD Movement Controls',
    description: 'Configure professional FPS-style camera movement.',
    steps: [
      'Enable: Go to Tools > Movement Controls > Enable WASD Movement',
      'Configure Speed: Adjust the Movement Speed slider (0.05 - 1.0)',
      'Navigate: Use WASD keys to move, Q/E for vertical movement, Shift to sprint',
      'Status: Check the toolbar status indicator to see current movement state'
    ]
  },
  {
    icon: '🎨',
    title: 'Material Assignment',
    description: 'Apply colors and textures to your 3D objects.',
    steps: [
      'Select an object in the 3D scene',
      'Open the Material menu',
      'Choose colors or upload textures',
      'Apply to selected objects'
    ]
  },
  {
    icon: '🤖',
    title: 'AI Features',
    description: 'Use natural language to modify your scene with AI assistance.',
    steps: [
      'Enter your OpenAI API key when prompted',
      'Use the AI sidebar to describe desired changes',
      'The AI will interpret and execute scene modifications'
    ]
  }
];

function UsageCard({icon, title, description, steps}: UsageCard) {
  return (
    <div className={styles.card}>
      <div className={styles.cardIcon}>{icon}</div>
      <div className={styles.cardContent}>
        <h3 className={styles.cardTitle}>{title}</h3>
        <p className={styles.cardDescription}>{description}</p>
        <ol className={styles.stepsList}>
          {steps.map((step, idx) => (
            <li key={idx} className={styles.stepItem}>
              {step}
            </li>
          ))}
        </ol>
      </div>
    </div>
  );
}

export default function UsageCards(): ReactNode {
  return (
    <section className={styles.usage}>
      <div className="container">
        <div className={styles.usageGrid}>
          {UsageList.map((usage, idx) => (
            <UsageCard key={idx} {...usage} />
          ))}
        </div>
      </div>
    </section>
  );
} 