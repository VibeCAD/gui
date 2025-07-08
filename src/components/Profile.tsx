import { useState, useEffect } from 'react';
import { auth, db } from '../lib/firebase';
import { doc, setDoc, getDoc } from 'firebase/firestore';
import './Profile.css';

interface ProfileProps {
  onClose: () => void;
}

export function Profile({ onClose }: ProfileProps) {
  const [apiKey, setApiKey] = useState('');
  const [savedApiKey, setSavedApiKey] = useState('');
  const [saving, setSaving] = useState(false);
  const [loading, setLoading] = useState(true);
  const [message, setMessage] = useState('');

  const user = auth.currentUser;

  useEffect(() => {
    // Load saved API key from Firestore
    const loadApiKey = async () => {
      if (!user) return;
      
      try {
        const userDoc = await getDoc(doc(db, 'users', user.uid));
        if (userDoc.exists() && userDoc.data().openaiApiKey) {
          const key = userDoc.data().openaiApiKey;
          setSavedApiKey(key);
          setApiKey(key);
        }
      } catch (error) {
        console.error('Error loading API key:', error);
      } finally {
        setLoading(false);
      }
    };

    loadApiKey();
  }, [user]);

  const handleSaveApiKey = async () => {
    if (!user) return;
    
    setSaving(true);
    setMessage('');

    try {
      // Save to Firestore
      await setDoc(doc(db, 'users', user.uid), {
        email: user.email,
        openaiApiKey: apiKey,
        updatedAt: new Date()
      }, { merge: true });

      setSavedApiKey(apiKey);
      setMessage('API key saved successfully!');
      
      // Store in localStorage for immediate use
      localStorage.setItem('openai_api_key', apiKey);
      
      // Trigger a custom event to notify the app
      window.dispatchEvent(new CustomEvent('apiKeyUpdated', { detail: { apiKey } }));
    } catch (error) {
      console.error('Error saving API key:', error);
      setMessage('Error saving API key. Please try again.');
    } finally {
      setSaving(false);
    }
  };

  const maskApiKey = (key: string) => {
    if (!key) return '';
    return `${key.substring(0, 7)}...${key.substring(key.length - 4)}`;
  };

  return (
    <div className="profile-overlay" onClick={onClose}>
      <div className="profile-container" onClick={(e) => e.stopPropagation()}>
        <div className="profile-header">
          <h2>Profile Settings</h2>
          <button className="profile-close" onClick={onClose}>×</button>
        </div>

        <div className="profile-content">
          <div className="profile-section">
            <h3>Account Information</h3>
            <div className="profile-info">
              <div className="info-row">
                <span className="info-label">Email:</span>
                <span className="info-value">{user?.email}</span>
              </div>
              <div className="info-row">
                <span className="info-label">User ID:</span>
                <span className="info-value">{user?.uid}</span>
              </div>
            </div>
          </div>

          <div className="profile-section">
            <h3>OpenAI API Configuration</h3>
            <p className="section-description">
              Your API key is stored securely and used for AI-powered scene manipulation.
            </p>
            
            {loading ? (
              <div className="loading-text">Loading...</div>
            ) : (
              <>
                {savedApiKey && (
                  <div className="current-key">
                    <span className="info-label">Current API Key:</span>
                    <span className="key-display">{maskApiKey(savedApiKey)}</span>
                  </div>
                )}

                <div className="api-key-input-group">
                  <input
                    type="password"
                    value={apiKey}
                    onChange={(e) => setApiKey(e.target.value)}
                    placeholder="sk-..."
                    className="api-key-input"
                  />
                  <button 
                    onClick={handleSaveApiKey}
                    disabled={saving || !apiKey.trim() || apiKey === savedApiKey}
                    className="save-button"
                  >
                    {saving ? 'Saving...' : 'Save API Key'}
                  </button>
                </div>

                {message && (
                  <div className={`message ${message.includes('Error') ? 'error' : 'success'}`}>
                    {message}
                  </div>
                )}

                <div className="api-key-help">
                  <p>Get your API key from <a href="https://platform.openai.com/api-keys" target="_blank" rel="noopener noreferrer">OpenAI Platform</a></p>
                </div>
              </>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}