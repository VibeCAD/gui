import { useEffect, useState } from 'react';
import { auth, db, storage, functions } from '../lib/firebase';
import { onAuthStateChanged } from 'firebase/auth';

export function FirebaseTest() {
  const [status, setStatus] = useState<{
    auth: boolean;
    firestore: boolean;
    storage: boolean;
    functions: boolean;
    user: string | null;
  }>({
    auth: false,
    firestore: false,
    storage: false,
    functions: false,
    user: null
  });

  useEffect(() => {
    // Test Auth
    try {
      onAuthStateChanged(auth, (user) => {
        setStatus(prev => ({
          ...prev,
          auth: true,
          user: user?.email || 'Not logged in'
        }));
      });
    } catch (error) {
      console.error('Auth initialization failed:', error);
    }

    // Test Firestore
    try {
      if (db) {
        setStatus(prev => ({ ...prev, firestore: true }));
      }
    } catch (error) {
      console.error('Firestore initialization failed:', error);
    }

    // Test Storage
    try {
      if (storage) {
        setStatus(prev => ({ ...prev, storage: true }));
      }
    } catch (error) {
      console.error('Storage initialization failed:', error);
    }

    // Test Functions
    try {
      if (functions) {
        setStatus(prev => ({ ...prev, functions: true }));
      }
    } catch (error) {
      console.error('Functions initialization failed:', error);
    }
  }, []);

  return (
    <div style={{ 
      position: 'fixed', 
      top: 10, 
      right: 10, 
      background: 'rgba(0,0,0,0.8)', 
      color: 'white', 
      padding: '10px',
      borderRadius: '5px',
      fontSize: '12px',
      zIndex: 1000
    }}>
      <h3 style={{ margin: '0 0 10px 0' }}>Firebase Status</h3>
      <div>Auth: {status.auth ? '✅' : '❌'}</div>
      <div>Firestore: {status.firestore ? '✅' : '❌'}</div>
      <div>Storage: {status.storage ? '✅' : '❌'}</div>
      <div>Functions: {status.functions ? '✅' : '❌'}</div>
      <div>User: {status.user}</div>
    </div>
  );
}