import { useState } from 'react';
import { storage, auth } from '../lib/firebase';
import { ref, uploadBytes, getDownloadURL } from 'firebase/storage';

export function StorageTest() {
  const [uploading, setUploading] = useState(false);
  const [downloadUrl, setDownloadUrl] = useState('');
  const [error, setError] = useState('');

  const testUpload = async () => {
    if (!auth.currentUser) {
      setError('Not authenticated');
      return;
    }

    setUploading(true);
    setError('');
    setDownloadUrl('');

    try {
      // Create a test .glb file content (just a text file for testing)
      const testContent = new Blob(['Test GLB file content'], { type: 'model/gltf-binary' });
      
      // Create a reference to the file location
      const fileName = `test-model-${Date.now()}.glb`;
      const storageRef = ref(storage, `test/${fileName}`);
      
      // Upload the file
      const snapshot = await uploadBytes(storageRef, testContent, {
        contentType: 'model/gltf-binary',
        customMetadata: {
          userId: auth.currentUser.uid,
          uploadedAt: new Date().toISOString()
        }
      });
      
      // Get the download URL
      const url = await getDownloadURL(snapshot.ref);
      setDownloadUrl(url);
      
      console.log('Upload successful:', url);
    } catch (err) {
      console.error('Upload error:', err);
      setError(err instanceof Error ? err.message : 'Unknown error');
    } finally {
      setUploading(false);
    }
  };

  return (
    <div style={{ 
      margin: '10px',
      padding: '15px',
      background: error ? '#f8d7da' : downloadUrl ? '#d4edda' : '#f0f0f0',
      borderRadius: '5px',
      border: `1px solid ${error ? '#f5c6cb' : downloadUrl ? '#c3e6cb' : '#dee2e6'}`
    }}>
      <strong>Cloud Storage Test</strong>
      <div style={{ marginTop: '10px' }}>
        <button 
          onClick={testUpload}
          disabled={uploading}
          style={{
            padding: '8px 16px',
            background: '#007bff',
            color: 'white',
            border: 'none',
            borderRadius: '4px',
            cursor: uploading ? 'not-allowed' : 'pointer',
            opacity: uploading ? 0.6 : 1
          }}
        >
          {uploading ? 'Uploading...' : 'Test Upload'}
        </button>
      </div>
      {error && (
        <div style={{ color: '#721c24', marginTop: '10px' }}>
          Error: {error}
        </div>
      )}
      {downloadUrl && (
        <div style={{ marginTop: '10px' }}>
          <div style={{ color: '#155724' }}>✅ Upload successful!</div>
          <div style={{ 
            marginTop: '5px', 
            fontSize: '12px',
            wordBreak: 'break-all',
            background: 'rgba(0,0,0,0.05)',
            padding: '5px',
            borderRadius: '3px'
          }}>
            URL: {downloadUrl}
          </div>
        </div>
      )}
    </div>
  );
}