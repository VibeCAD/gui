import { useEffect, useState } from 'react';
import { db } from '../lib/firebase';
import { collection, doc, setDoc, serverTimestamp } from 'firebase/firestore';

export function FirestoreTest() {
  const [status, setStatus] = useState<'idle' | 'testing' | 'success' | 'error'>('idle');
  const [error, setError] = useState<string>('');

  const testFirestore = async () => {
    setStatus('testing');
    setError('');
    
    try {
      // Try to write a test document
      const testDoc = doc(collection(db, 'test'), 'test-connection');
      await setDoc(testDoc, {
        message: 'Firestore is working!',
        timestamp: serverTimestamp(),
        test: true
      });
      
      setStatus('success');
    } catch (err) {
      setStatus('error');
      if (err instanceof Error) {
        console.error('Firestore test error:', err);
        setError(err.message);
      } else {
        setError('Unknown error');
      }
    }
  };

  useEffect(() => {
    // Auto-test on mount
    testFirestore();
  }, []);

  return (
    <div style={{ 
      margin: '10px 0',
      padding: '10px',
      background: status === 'success' ? '#d4edda' : status === 'error' ? '#f8d7da' : '#f0f0f0',
      borderRadius: '5px'
    }}>
      <strong>Firestore Status:</strong> {status}
      {error && <div style={{ color: 'red', marginTop: '5px' }}>{error}</div>}
      <button 
        onClick={testFirestore} 
        style={{ marginTop: '5px' }}
        disabled={status === 'testing'}
      >
        Test Again
      </button>
    </div>
  );
}