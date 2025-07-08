// Firestore collection schemas for VibeCAD

export interface User {
  email: string;
  displayName?: string;
  photoURL?: string;
  createdAt: Date;
  plan: 'free' | 'pro';
}

export interface Generation {
  userId: string;
  status: 'pending' | 'processing' | 'completed' | 'failed';
  prompt: string;
  negativePrompt?: string;
  generationParams: {
    seed?: number;
    quality?: string;
    [key: string]: any;
  };
  modelURL?: string;
  thumbnailURL?: string;
  error?: string;
  createdAt: Date;
}

// Collection names
export const COLLECTIONS = {
  USERS: 'users',
  GENERATIONS: 'generations'
} as const;