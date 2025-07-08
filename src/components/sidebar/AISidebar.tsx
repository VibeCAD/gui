import React from 'react';
import OpenAI from 'openai';
import { Vector3 } from 'babylonjs';
import { useSceneStore } from '../../state/sceneStore';
import type { SceneObject } from '../../types/types';
import { SceneGraph } from './SceneGraph';
import { PropertiesPanel } from './PropertiesPanel';

interface AISidebarProps {
  onSubmitPrompt: () => Promise<void>;
  openai: OpenAI | null;
  sceneInitialized: boolean;
}

export const AISidebar: React.FC<AISidebarProps> = ({ 
  onSubmitPrompt, 
  openai, 
  sceneInitialized 
}) => {
  const {
    sidebarCollapsed,
    isLoading,
    textInput,
    responseLog,
    multiSelectMode,
    setSidebarCollapsed,
    setTextInput,
  } = useSceneStore();

  return (
    <div className={`ai-sidebar ${sidebarCollapsed ? 'collapsed' : ''}`}>
      <div className="ai-sidebar-header">
        <h3>AI Assistant</h3>
        <button 
          className="sidebar-toggle"
          onClick={() => setSidebarCollapsed(!sidebarCollapsed)}
          title={sidebarCollapsed ? 'Expand sidebar' : 'Collapse sidebar'}
        >
          {sidebarCollapsed ? '◀' : '▶'}
        </button>
      </div>
      
      {!sidebarCollapsed && (
        <div className="ai-sidebar-content">
          {!sceneInitialized && (
            <div className="loading-indicator">
              <p>Initializing 3D scene...</p>
            </div>
          )}
          
          {/* AI Control Group */}
          <div className="ai-control-group">
            <label htmlFor="ai-prompt">Natural Language Commands:</label>
            <textarea
              id="ai-prompt"
              value={textInput}
              onChange={(e) => setTextInput(e.target.value)}
              placeholder="Try: 'move the cube to the right', 'make the cube blue', 'create a red sphere above the cube'"
              className="ai-text-input"
              disabled={isLoading || !sceneInitialized}
            />
            <button 
              onClick={onSubmitPrompt}
              disabled={isLoading || !textInput.trim() || !sceneInitialized}
              className="ai-submit-button"
            >
              {isLoading ? 'Processing...' : 'Execute AI Command'}
            </button>
          </div>

          {/* Scene Graph Component */}
          <SceneGraph />

          {/* Properties Panel Component */}
          <PropertiesPanel />

          {/* Keyboard Shortcuts */}
          <div className="ai-control-group">
            <label>Keyboard Shortcuts:</label>
            <div className="keyboard-shortcuts">
              <div className="shortcut-item">
                <span className="shortcut-key">Ctrl+A</span>
                <span className="shortcut-desc">Select All</span>
              </div>
              <div className="shortcut-item">
                <span className="shortcut-key">Ctrl+I</span>
                <span className="shortcut-desc">Invert Selection</span>
              </div>
              <div className="shortcut-item">
                <span className="shortcut-key">Ctrl+D</span>
                <span className="shortcut-desc">Duplicate</span>
              </div>
              <div className="shortcut-item">
                <span className="shortcut-key">Ctrl+T</span>
                <span className="shortcut-desc">Reset Transform</span>
              </div>
              <div className="shortcut-item">
                <span className="shortcut-key">Ctrl+G</span>
                <span className="shortcut-desc">Toggle Snap to Grid</span>
              </div>
              <div className="shortcut-item">
                <span className="shortcut-key">M</span>
                <span className="shortcut-desc">Move Mode</span>
              </div>
              <div className="shortcut-item">
                <span className="shortcut-key">R</span>
                <span className="shortcut-desc">Rotate Mode</span>
              </div>
              <div className="shortcut-item">
                <span className="shortcut-key">S</span>
                <span className="shortcut-desc">Scale Mode</span>
              </div>
              <div className="shortcut-item">
                <span className="shortcut-key">Delete</span>
                <span className="shortcut-desc">Delete Selected</span>
              </div>
              <div className="shortcut-item">
                <span className="shortcut-key">Esc</span>
                <span className="shortcut-desc">Deselect All</span>
              </div>
            </div>
          </div>

          {/* AI Response Log */}
          <div className="ai-control-group">
            <label>AI Response Log:</label>
            <div className="ai-response-log">
              {responseLog.slice(-8).map((log, index) => (
                <div key={index} className={`ai-log-entry ${log.startsWith('User:') ? 'user' : log.startsWith('AI:') ? 'ai' : 'error'}`}>
                  {log}
                </div>
              ))}
              {responseLog.length === 0 && (
                <div className="ai-log-entry ai-log-empty">
                  No AI responses yet. Try entering a command above.
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
