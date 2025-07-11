import type {ReactNode} from 'react';
import styles from './styles.module.css';

type QuickStartStep = {
  step: number;
  title: string;
  description: ReactNode;
  code?: string;
  language?: string;
};

const QuickStartSteps: QuickStartStep[] = [
  {
    step: 1,
    title: 'Clone the repository',
    description: 'Get the latest version of Moorph from our GitHub repository.',
    code: `git clone https://github.com/VibeCAD/gui.git
cd gui`,
    language: 'bash'
  },
  {
    step: 2,
    title: 'Install dependencies',
    description: 'Install all required packages and dependencies.',
    code: 'npm install',
    language: 'bash'
  },
  {
    step: 3,
    title: 'Start development server',
    description: 'Launch the development server to start building.',
    code: 'npm run dev',
    language: 'bash'
  },
  {
    step: 4,
    title: 'Open your browser',
    description: 'Navigate to the local development server to see Moorph in action.',
    code: 'http://localhost:5173'
  }
];

function QuickStartCard({step, title, description, code, language}: QuickStartStep) {
  return (
    <div className={styles.card}>
      <div className={styles.stepNumber}>{step}</div>
      <div className={styles.cardContent}>
        <h3 className={styles.cardTitle}>{title}</h3>
        <p className={styles.cardDescription}>{description}</p>
        {code && (
          <div className={styles.codeBlock}>
            <code className={styles.code}>{code}</code>
          </div>
        )}
      </div>
    </div>
  );
}

export default function QuickStartCards(): ReactNode {
  return (
    <section className={styles.quickStart}>
      <div className="container">
        <div className={styles.stepsGrid}>
          {QuickStartSteps.map((step, idx) => (
            <QuickStartCard key={idx} {...step} />
          ))}
        </div>
      </div>
    </section>
  );
} 