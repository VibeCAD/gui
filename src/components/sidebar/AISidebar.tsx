import React from 'react';
import { Vector3 } from 'babylonjs';
import { useSceneStore } from '../../state/sceneStore';
import { createAIService, type SceneCommand } from '../../ai/ai.service';
import type { SceneObject } from '../../types/types';
import { SceneGraph } from './SceneGraph';
import { PropertiesPanel } from './PropertiesPanel';

interface AISidebarProps {
  apiKey: string;
  sceneInitialized: boolean;
}

export const AISidebar: React.FC<AISidebarProps> = ({ 
  apiKey, 
  sceneInitialized 
}) => {
  const {
    sidebarCollapsed,
    isLoading,
    textInput,
    responseLog,
    sceneObjects,
    setSidebarCollapsed,
    setTextInput,
    setIsLoading,
    addToResponseLog,
    updateObject,
    addObject,
    removeObject,
  } = useSceneStore();

  const executeSceneCommand = (command: SceneCommand) => {
    if (!sceneInitialized) return;
    
    try {
      switch (command.action) {
        case 'move':
          if (command.objectId) {
            updateObject(command.objectId, { 
              position: new Vector3(command.x || 0, command.y || 0, command.z || 0) 
            });
          }
          break;

        case 'color':
          if (command.objectId) {
            updateObject(command.objectId, { color: command.color || '#3498db' });
          }
          break;

        case 'scale':
          if (command.objectId) {
            updateObject(command.objectId, { 
              scale: new Vector3(command.x || 1, command.y || 1, command.z || 1) 
            });
          }
          break;

        case 'create':
          if (command.type) {
            const newId = `${command.type}-${Date.now()}`;
            const newObj: SceneObject = {
              id: newId,
              type: command.type,
              position: new Vector3(command.x || 0, command.y || 1, command.z || 0),
              scale: new Vector3(1, 1, 1),
              rotation: new Vector3(0, 0, 0),
              color: command.color || (command.type.startsWith('house-') ? '#8B4513' : '#3498db'), // Brown for housing objects
              isNurbs: false
            };
            addObject(newObj);
          }
          break;

        case 'delete':
          if (command.objectId) {
            console.log('Deleting object with ID:', command.objectId);
            removeObject(command.objectId);
          }
          break;
      }
    } catch (error) {
      console.error('Error executing scene command:', error);
    }
  };

  const handleSubmitPrompt = async () => {
    if (!apiKey || !textInput.trim()) return;

    setIsLoading(true);
    
    try {
      const aiService = createAIService(apiKey);
      const result = await aiService.getSceneCommands(textInput, sceneObjects);
      
      if (result.success && result.commands) {
        // Log the user prompt and AI response
        if (result.userPrompt) {
          addToResponseLog(`User: ${result.userPrompt}`);
        }
        if (result.aiResponse) {
          addToResponseLog(`AI: ${result.aiResponse}`);
        }
        
        // Execute all commands
        console.log('Executing commands:', result.commands);
        result.commands.forEach(command => executeSceneCommand(command));
      } else {
        // Log error
        const errorMessage = result.error || 'Unknown error occurred';
        console.error('AI service error:', errorMessage);
        addToResponseLog(`Error: ${errorMessage}`);
        
        if (result.userPrompt) {
          addToResponseLog(`User: ${result.userPrompt}`);
        }
        if (result.aiResponse) {
          addToResponseLog(`AI: ${result.aiResponse}`);
        }
      }
    } catch (error) {
      console.error('Error in AI service:', error);
      addToResponseLog(`Error: ${error instanceof Error ? error.message : 'Unknown error'}`);
    } finally {
      setIsLoading(false);
      setTextInput('');
    }
  };

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
              onClick={handleSubmitPrompt}
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
