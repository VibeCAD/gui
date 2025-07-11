import type {ReactNode} from 'react';
import clsx from 'clsx';
import Heading from '@theme/Heading';
import styles from './styles.module.css';

type FeatureCardProps = {
  icon: string;
  title: string;
  description: ReactNode;
  features: string[];
  href?: string;
};

function FeatureCard({icon, title, description, features, href}: FeatureCardProps) {
  const CardContent = (
    <div className={clsx(styles.card, href && styles.cardClickable)}>
      <div className={styles.cardIcon}>{icon}</div>
      <div className={styles.cardContent}>
        <Heading as="h3" className={styles.cardTitle}>{title}</Heading>
        <p className={styles.cardDescription}>{description}</p>
        <ul className={styles.featureList}>
          {features.map((feature, idx) => (
            <li key={idx} className={styles.featureItem}>
              {feature}
            </li>
          ))}
        </ul>
      </div>
    </div>
  );

  if (href) {
    return (
      <a href={href} className={styles.cardLink}>
        {CardContent}
      </a>
    );
  }

  return CardContent;
}

export default FeatureCard; 