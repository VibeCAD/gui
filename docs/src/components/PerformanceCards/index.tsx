import type {ReactNode} from 'react';
import styles from './styles.module.css';

type PerformanceFeature = {
  icon: string;
  title: string;
  description: string;
  metric: string;
};

const PerformanceFeatures: PerformanceFeature[] = [
  {
    icon: '⚡',
    title: '60+ FPS',
    description: 'Smooth camera movement and scene rendering',
    metric: 'High Performance'
  },
  {
    icon: '🎯',
    title: 'Sub-16ms Input Latency',
    description: 'Responsive WASD controls',
    metric: 'Ultra-Low Latency'
  },
  {
    icon: '🏗️',
    title: 'Large Scenes',
    description: 'Efficient handling of complex 3D models',
    metric: 'Scalable Arch'
  },
  {
    icon: '🌐',
    title: 'Cross-Browser',
    description: 'Compatible with modern browsers',
    metric: 'Universal Support'
  }
];

function PerformanceCard({icon, title, description, metric}: PerformanceFeature) {
  return (
    <div className={styles.card}>
      <div className={styles.cardIcon}>{icon}</div>
      <div className={styles.cardContent}>
        <h3 className={styles.cardTitle}>{title}</h3>
        <p className={styles.cardDescription}>{description}</p>
        <div className={styles.cardMetric}>{metric}</div>
      </div>
    </div>
  );
}

export default function PerformanceCards(): ReactNode {
  return (
    <section className={styles.performance}>
      <div className="container">
        <div className={styles.performanceGrid}>
          {PerformanceFeatures.map((feature, idx) => (
            <PerformanceCard key={idx} {...feature} />
          ))}
        </div>
      </div>
    </section>
  );
} 