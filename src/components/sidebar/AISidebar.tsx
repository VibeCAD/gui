import React from 'react';
import { Vector3 } from 'babylonjs';
import { useSceneStore } from '../../state/sceneStore';
import { createAIService, type SceneCommand } from '../../ai/ai.service';
import type { SceneObject } from '../../types/types';
import { SceneGraph } from './SceneGraph';
import { PropertiesPanel } from './PropertiesPanel';
import { ImportButton } from './ImportButton';
import { ExportButton } from './ExportButton';
import { createGLBImporter } from '../../babylon/glbImporter';
import { createSTLExporter } from '../../babylon/stlExporter';

interface AISidebarProps {
  apiKey: string;
  sceneInitialized: boolean;
  sceneAPI?: {
    getSceneManager: () => any;
  };
  onOpenCustomRoomModal?: () => void;
}

const SceneDescriptionPanel = ({ description, onClose }: { description: string, onClose: () => void }) => {
  if (!description) return null;

  return (
    <div className="scene-description-panel">
      <div className="scene-description-header">
        <h3>Scene Description</h3>
        <button onClick={onClose} className="close-button">×</button>
      </div>
      <p className="scene-description-text">{description}</p>
    </div>
  );
};

export const AISidebar: React.FC<AISidebarProps> = ({ 
  apiKey, 
  sceneInitialized,
  sceneAPI,
  onOpenCustomRoomModal
}) => {
  const {
    sidebarCollapsed,
    isLoading,
    textInput,
    responseLog,
    sceneObjects,
    importError,
    setSidebarCollapsed,
    setTextInput,
    setIsLoading,
    addToResponseLog,
    updateObject,
    addObject,
    removeObject,
    renameObject,
    startImport,
    importSuccess,
    setImportError,
    clearImportError,
    undo,
    redo,
  } = useSceneStore();

  const [showDescriptionPanel, setShowDescriptionPanel] = React.useState(false);
  const [sceneDescription, setSceneDescription] = React.useState('');

  /**
   * Synchronize object positions from the actual 3D meshes to the store
   * This ensures we have the most current positions before AI analysis
   */
  const syncPositionsFromMeshes = () => {
    if (!sceneAPI || !sceneInitialized) return;

    const sceneManager = sceneAPI.getSceneManager();
    if (!sceneManager) return;

    console.log('🔄 Syncing positions from 3D meshes to store...');
    
    sceneObjects.forEach(obj => {
      if (obj.type === 'ground') return; // Skip ground
      
      const mesh = sceneManager.getMeshById(obj.id);
      if (mesh) {
        const meshPosition = mesh.position;
        const meshRotation = mesh.rotation;
        const meshScale = mesh.scaling;
        
        // Check if the mesh position differs from store position
        const positionDiff = !obj.position.equals(meshPosition);
        const rotationDiff = !obj.rotation.equals(meshRotation);
        const scaleDiff = !obj.scale.equals(meshScale);
        
        if (positionDiff || rotationDiff || scaleDiff) {
          console.log(`  - Updating ${obj.id}: mesh pos (${meshPosition.x.toFixed(2)}, ${meshPosition.y.toFixed(2)}, ${meshPosition.z.toFixed(2)}) vs store pos (${obj.position.x.toFixed(2)}, ${obj.position.y.toFixed(2)}, ${obj.position.z.toFixed(2)})`);
          
          updateObject(obj.id, {
            position: meshPosition.clone(),
            rotation: meshRotation.clone(),
            scale: meshScale.clone()
          });
        }
      }
    });
  };

  const performAlignment = (command: SceneCommand, sceneManager: any) => {
    if (!command.objectId || !command.relativeToObject || !command.edge) return;

    // Get both meshes
    const movingMesh = sceneManager.getMeshById(command.objectId);
    const referenceMesh = sceneManager.getMeshById(command.relativeToObject);
    
    if (!movingMesh || !referenceMesh) {
      console.error('Could not find meshes for alignment:', command.objectId, command.relativeToObject);
      return;
    }

    // Get bounding info for both objects
    const movingBounds = movingMesh.getBoundingInfo();
    const referenceBounds = referenceMesh.getBoundingInfo();
    
    if (!movingBounds || !referenceBounds) {
      console.error('Could not get bounding info for alignment');
      return;
    }

    console.log(`🔧 Starting alignment: ${command.objectId} to ${command.edge} edge of ${command.relativeToObject}`);

    // Ensure world matrices are up to date
    referenceMesh.computeWorldMatrix(true);
    movingMesh.computeWorldMatrix(true);

    // Calculate reference object dimensions and position in world space
    const refMin = referenceBounds.boundingBox.minimumWorld;
    const refMax = referenceBounds.boundingBox.maximumWorld;
    const refCenter = referenceBounds.boundingBox.center;
    
    console.log(`📐 Reference bounds: min(${refMin.x.toFixed(2)}, ${refMin.y.toFixed(2)}, ${refMin.z.toFixed(2)}) max(${refMax.x.toFixed(2)}, ${refMax.y.toFixed(2)}, ${refMax.z.toFixed(2)})`);
    
    // Get the original (unrotated) dimensions of the moving object
    // We need these to calculate proper flush positioning after rotation
    const movingLocalBounds = movingBounds.boundingBox;
    const movingLocalSize = movingLocalBounds.maximum.subtract(movingLocalBounds.minimum);
    const originalWidth = movingLocalSize.x;   // 4.0 for wall
    const originalHeight = movingLocalSize.y;  // 1.5 for wall  
    const originalDepth = movingLocalSize.z;   // 0.2 for wall
    
    console.log(`📐 Moving object original dimensions: ${originalWidth.toFixed(2)} x ${originalHeight.toFixed(2)} x ${originalDepth.toFixed(2)}`);

    const targetPosition = new Vector3();
    const targetRotation = new Vector3(0, 0, 0); // Start with zero rotation
    const offset = command.offset || 0;

    // Calculate position and rotation based on edge
    // For walls, we want them to sit ON the floor, not float above it
    const wallBottomY = refMax.y; // Floor top surface
    const wallCenterY = wallBottomY + (originalHeight / 2); // Wall center Y position
    
    switch (command.edge) {
      case 'north': // +Z direction - wall faces north, extends in X direction
        targetPosition.x = refCenter.x;
        targetPosition.y = wallCenterY;
        targetPosition.z = refMax.z + (originalDepth / 2) + offset; // Wall thickness/2 for flush contact
        targetRotation.x = 0;
        targetRotation.y = 0; // No rotation - wall naturally extends in X direction
        targetRotation.z = 0;
        console.log(`🧭 North alignment: placing at Z=${refMax.z.toFixed(2)} + ${(originalDepth/2).toFixed(2)} + ${offset} = ${targetPosition.z.toFixed(2)}, Y=${wallCenterY.toFixed(2)}`);
        break;
        
      case 'south': // -Z direction - wall faces south, extends in X direction
        targetPosition.x = refCenter.x;
        targetPosition.y = wallCenterY;
        targetPosition.z = refMin.z - (originalDepth / 2) - offset; // Wall thickness/2 for flush contact
        targetRotation.x = 0;
        targetRotation.y = Math.PI; // 180° rotation to face south
        targetRotation.z = 0;
        console.log(`🧭 South alignment: placing at Z=${refMin.z.toFixed(2)} - ${(originalDepth/2).toFixed(2)} - ${offset} = ${targetPosition.z.toFixed(2)}, Y=${wallCenterY.toFixed(2)}`);
        break;
        
      case 'east': // +X direction - wall faces east, extends in Z direction
        targetPosition.x = refMax.x + (originalDepth / 2) + offset; // Wall thickness/2 for flush contact
        targetPosition.y = wallCenterY;
        targetPosition.z = refCenter.z;
        targetRotation.x = 0;
        targetRotation.y = -Math.PI / 2; // -90° rotation to face east
        targetRotation.z = 0;
        console.log(`🧭 East alignment: placing at X=${refMax.x.toFixed(2)} + ${(originalDepth/2).toFixed(2)} + ${offset} = ${targetPosition.x.toFixed(2)}, Y=${wallCenterY.toFixed(2)}`);
        break;
        
      case 'west': // -X direction - wall faces west, extends in Z direction
        targetPosition.x = refMin.x - (originalDepth / 2) - offset; // Wall thickness/2 for flush contact
        targetPosition.y = wallCenterY;
        targetPosition.z = refCenter.z;
        targetRotation.x = 0;
        targetRotation.y = Math.PI / 2; // +90° rotation to face west
        targetRotation.z = 0;
        console.log(`🧭 West alignment: placing at X=${refMin.x.toFixed(2)} - ${(originalDepth/2).toFixed(2)} - ${offset} = ${targetPosition.x.toFixed(2)}, Y=${wallCenterY.toFixed(2)}`);
        break;
    }

    console.log(`🎯 Target position: (${targetPosition.x.toFixed(2)}, ${targetPosition.y.toFixed(2)}, ${targetPosition.z.toFixed(2)})`);
    console.log(`🎯 Target rotation: (${targetRotation.x.toFixed(2)}, ${targetRotation.y.toFixed(2)}, ${targetRotation.z.toFixed(2)})`);

    // Apply the transformation directly without snap correction
    // (snap correction was interfering with precise alignment)
    updateObject(command.objectId, {
      position: targetPosition,
      rotation: targetRotation
    });

    console.log(`✅ Aligned ${command.objectId} to ${command.edge} edge of ${command.relativeToObject}`);
  };

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
            // Handle both old format (x, y, z) and new format (scaleX, scaleY, scaleZ)
            const scaleX = command.scaleX || command.x || 1;
            const scaleY = command.scaleY || command.y || 1;
            const scaleZ = command.scaleZ || command.z || 1;
            
            updateObject(command.objectId, { 
              scale: new Vector3(scaleX, scaleY, scaleZ) 
            });
          }
          break;

        case 'rotate':
          if (command.objectId) {
            // Rotation values are in radians
            const rotationX = command.rotationX || 0;
            const rotationY = command.rotationY || 0;
            const rotationZ = command.rotationZ || 0;
            
            updateObject(command.objectId, { 
              rotation: new Vector3(rotationX, rotationY, rotationZ) 
            });
            
            console.log(`🔄 Rotated object ${command.objectId} to (${rotationX.toFixed(3)}, ${rotationY.toFixed(3)}, ${rotationZ.toFixed(3)}) radians`);
          }
          break;

        case 'create':
          if (command.type) {
            // Use provided name or generate a robust unique ID
            let newId = command.name;
            if (newId) {
                // Check for uniqueness
                if (sceneObjects.some(obj => obj.id === newId)) {
                    // Append a suffix to make it unique
                    const uniqueSuffix = Math.random().toString(36).substring(2, 7);
                    const oldId = newId;
                    newId = `${newId}-${uniqueSuffix}`;
                    addToResponseLog(`Warning: Object name "${oldId}" already exists. Renaming to "${newId}".`);
                }
            } else {
                newId = `${command.type}-${typeof crypto !== 'undefined' && crypto.randomUUID ? crypto.randomUUID() : Date.now()}`;
            }
            
            const newObj: SceneObject = {
              id: newId,
              type: command.type,
              position: new Vector3(command.x || 0, command.y || 1, command.z || 0),
              scale: new Vector3(1, 1, 1),
              rotation: new Vector3(0, 0, 0),
              color: command.color || (command.type.startsWith('house-') ? '#8B4513' : '#3498db'),
              isNurbs: false
            };
            
            addObject(newObj);
            
            // If the command includes scaling information, apply it immediately
            if (command.scaleX || command.scaleY || command.scaleZ) {
              const scaleX = command.scaleX || 1;
              const scaleY = command.scaleY || 1;
              const scaleZ = command.scaleZ || 1;
              
              // Update with scale - use a small timeout to ensure object is created first
              setTimeout(() => {
                updateObject(newId, { 
                  scale: new Vector3(scaleX, scaleY, scaleZ) 
                });
              }, 10);
            }
            
            // Log creation with enhanced details
            console.log(`✅ Created object: ${newId} at (${command.x}, ${command.y}, ${command.z})`, {
              matchDimensions: command.matchDimensions,
              contactType: command.contactType,
              relativeToObject: command.relativeToObject,
              spatialRelation: command.spatialRelation
            });
          }
          break;

        case 'delete':
          if (command.objectId) {
            console.log('Deleting object with ID:', command.objectId);
            removeObject(command.objectId);
          }
          break;

        case 'rename':
          if (command.objectId && command.name) {
            if (sceneObjects.some(obj => obj.id === command.name)) {
              addToResponseLog(`Error: An object with the name "${command.name}" already exists.`);
            } else {
              renameObject(command.objectId, command.name);
            }
          }
          break;

        case 'align':
          if (command.objectId && command.relativeToObject && command.edge && sceneAPI) {
            const sceneManager = sceneAPI.getSceneManager();
            if (sceneManager) {
              performAlignment(command, sceneManager);
            }
          }
          break;

        case 'describe':
          if (command.description) {
            // Use the AI's natural language description
            setSceneDescription(command.description);
            setShowDescriptionPanel(true);
          } else {
            // Fallback to simple description if AI didn't provide one
            const aiService = createAIService(apiKey, []);
            const simpleDescription = aiService.describeSceneSimple(sceneObjects);
            setSceneDescription(simpleDescription);
            setShowDescriptionPanel(true);
          }
          break;

        case 'undo':
          // Call the undo function from the store
          undo();
          console.log('🔄 AI Command: Undo action executed');
          break;

        case 'redo':
          // Call the redo function from the store
          redo();
          console.log('🔄 AI Command: Redo action executed');
          break;

        case 'texture':
          if (command.objectId && command.textureId) {
            // Get the function from the store
            const { applyTextureToObject } = useSceneStore.getState();
            
            // Apply texture to the object
            applyTextureToObject(
              command.objectId, 
              command.textureId, 
              command.textureType || 'diffuse'
            );
            
            console.log(`🎨 Applied texture ${command.textureId} to object ${command.objectId} as ${command.textureType || 'diffuse'}`);
          } else if (!command.objectId) {
            console.warn('❌ Texture command missing objectId');
          } else if (!command.textureId) {
            console.warn('❌ Texture command missing textureId');
          }
          break;
      }
    } catch (error) {
      console.error('Error executing scene command:', error);
    }
  };

  const handleImportGLB = async (file: File) => {
    if (!sceneInitialized || !sceneAPI) {
      console.error('Scene not initialized');
      return;
    }

    const sceneManager = sceneAPI.getSceneManager();
    if (!sceneManager || !sceneManager.scene) {
      console.error('Scene manager not available');
      return;
    }

    // Clear any previous import error
    clearImportError();
    
    // Start the import process
    startImport();

    try {
      // Create model importer with scene and sceneManager
      const importer = createGLBImporter(sceneManager.scene, sceneManager);
      
      // Import the file
      const sceneObject = await importer.importModel(file);
      
      // Add the imported object to the scene
      addObject(sceneObject);
      
      // Success!
      importSuccess();
      addToResponseLog(`Success: Imported 3D model "${file.name}"`);
      
    } catch (error: any) {
      console.error('Import failed:', error);
      
      // Set the import error based on the error message
      let errorType: 'FILE_TOO_LARGE' | 'INVALID_FORMAT' | 'LOADING_FAILED' = 'LOADING_FAILED';
      
      if (error instanceof Error) {
        if (error.message === 'FILE_TOO_LARGE') {
          errorType = 'FILE_TOO_LARGE';
        } else if (error.message === 'INVALID_FORMAT') {
          errorType = 'INVALID_FORMAT';
        }
      }
      
      setImportError({
        type: errorType,
        message: 'IMPORT FAILED'
      });
      
      addToResponseLog('Error: IMPORT FAILED');
    }
  };

  const handleExportSTL = async () => {
    if (!sceneInitialized || !sceneAPI) {
      console.error('Scene not initialized');
      return;
    }

    const sceneManager = sceneAPI.getSceneManager();
    if (!sceneManager || !sceneManager.scene) {
      console.error('Scene manager not available');
      return;
    }

    try {
      // Create STL exporter
      const exporter = createSTLExporter(sceneManager.scene);
      
      // Generate filename with timestamp
      const timestamp = new Date().toISOString().replace(/[:.]/g, '-').slice(0, -5);
      const filename = `vibecad-export-${timestamp}.stl`;
      
      // Export the scene
      await exporter.exportSceneToSTL(sceneObjects, filename);
      
      // Success!
      addToResponseLog(`Success: Exported scene to "${filename}"`);
      
    } catch (error: any) {
      console.error('Export failed:', error);
      addToResponseLog(`Error: Export failed - ${error.message || 'Unknown error'}`);
    }
  };

  const handleSubmitPrompt = async () => {
    if (!apiKey || !textInput.trim()) return;

    // Check for special keywords
    const lowerInput = textInput.trim().toLowerCase();
    if (lowerInput.includes('draw room panel')) {
      console.log('🎨 Detected "draw room panel" command');
      
      // Open the custom room modal
      if (onOpenCustomRoomModal) {
        onOpenCustomRoomModal();
        setTextInput(''); // Clear the input
        addToResponseLog('User: draw room panel');
        addToResponseLog('AI: Opening custom room drawing panel...');
      } else {
        console.warn('⚠️ onOpenCustomRoomModal callback not provided');
        addToResponseLog('Error: Custom room panel feature not available');
      }
      return;
    }

    setIsLoading(true);
    
    try {
      // Ensure we have the most current positions from the 3D meshes
      syncPositionsFromMeshes();
      
      // Give a brief moment for the store to update
      await new Promise(resolve => setTimeout(resolve, 50));
      
      // Get the updated scene objects
      const currentSceneObjects = useSceneStore.getState().sceneObjects;
      
      // Get current selection
      const { selectedObjectId: currentSelectedId, selectedObjectIds: currentSelectedIds } = useSceneStore.getState();
      
      // Debug: Log current scene objects before AI call
      console.log('🔍 Current scene objects at AI call time:');
      currentSceneObjects.forEach(obj => {
        console.log(`  - ${obj.id} (${obj.type}): position (${obj.position.x.toFixed(2)}, ${obj.position.y.toFixed(2)}, ${obj.position.z.toFixed(2)})`);
      });
      
      // Debug: Log current selection
      if (currentSelectedId) {
        console.log(`🎯 Currently selected object: ${currentSelectedId}`);
      } else if (currentSelectedIds.length > 0) {
        console.log(`🎯 Currently selected objects: ${currentSelectedIds.join(', ')}`);
      }

      // In a real application, this list would ideally be fetched dynamically
      // or generated at build time to avoid maintaining a static list here.
      const glbObjectNames = [
        'Adjustable Desk', 'Bed Double', 'Bed Single', 'Bookcase', 'Chair', 
        'Couch Small', 'Desk', 'Simple table', 'Sofa', 'Standing Desk', 
        'Table', 'TV', 'wooden bookshelf'
      ];

      const aiService = createAIService(apiKey, glbObjectNames);
      const result = await aiService.getSceneCommands(textInput, currentSceneObjects, currentSelectedId, currentSelectedIds);
      
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

  const handleKeyDown = (event: React.KeyboardEvent<HTMLTextAreaElement>) => {
    // Check for Cmd+Enter on macOS or Ctrl+Enter on other systems
    if ((event.metaKey || event.ctrlKey) && event.key === 'Enter') {
      // Prevent the default action of adding a new line
      event.preventDefault();
      
      // Check if the submit button would be active, and if so, submit the prompt
      if (!isLoading && textInput.trim() && sceneInitialized) {
        handleSubmitPrompt();
      }
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
          {showDescriptionPanel && <SceneDescriptionPanel description={sceneDescription} onClose={() => setShowDescriptionPanel(false)} />}
          
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
              onKeyDown={handleKeyDown}
              placeholder="Try: 'Draw Room Panel', 'move the cube to the right', 'make the cube blue', 'create a red sphere above the cube', 'apply wood texture', 'make it brick'"
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

          {/* Import GLB Control */}
          <div className="ai-control-group">
            <label>Import 3D Model:</label>
            <ImportButton 
              onImport={handleImportGLB}
              disabled={!sceneInitialized}
            />
            {importError && (
              <div className="import-error-message">
                {importError.message}
              </div>
            )}
          </div>

          {/* Export STL Control */}
          <div className="ai-control-group">
            <label>Export Scene:</label>
            <ExportButton
              onExport={handleExportSTL}
              disabled={!sceneInitialized}
              objectCount={sceneObjects.filter(obj => obj.type !== 'ground').length}
            />
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
