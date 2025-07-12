import React, { useState, useCallback, useEffect } from 'react';
import { Vector3 } from 'babylonjs';
import { useSceneStore } from '../../state/sceneStore';
import { spaceAnalysisService } from '../../services/spaceAnalysisService';
import { layoutGenerationService } from '../../services/layoutGenerationService';
import { roomAnalysisService } from '../../services/roomAnalysisService';
import { SpaceVisualizationUtils, createDefaultVisualizationOptions, createAccessibilityVisualizationOptions } from '../../visualization/spaceVisualizationUtils';
import type { SpaceAnalysisResult } from '../../services/spaceAnalysisService';
import type { LayoutGenerationResult } from '../../services/layoutGenerationService';
import type { VisualizationOptions } from '../../visualization/spaceVisualizationUtils';

interface SpaceOptimizationPanelProps {
  sceneAPI?: {
    getSceneManager: () => any;
  };
}

export const SpaceOptimizationPanel: React.FC<SpaceOptimizationPanelProps> = ({ sceneAPI }) => {
  const {
    sceneObjects,
    selectedObjectId,
    selectedObjectIds,
    hasSelection,
    addToResponseLog,
    addObject,
    removeObject,
    getSelectedObjects
  } = useSceneStore();

  // Panel state
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [analysisResult, setAnalysisResult] = useState<SpaceAnalysisResult | null>(null);
  const [layoutResult, setLayoutResult] = useState<LayoutGenerationResult | null>(null);
  const [selectedFurnitureType, setSelectedFurnitureType] = useState('Desk');
  const [optimizationStrategy, setOptimizationStrategy] = useState<'maximize' | 'comfort' | 'ergonomic' | 'aesthetic'>('maximize');
  const [showVisualization, setShowVisualization] = useState(true);
  const [visualizationMode, setVisualizationMode] = useState<'default' | 'accessibility' | 'efficiency' | 'safety'>('default');
  
  // Visualization state
  const [visualizationUtils, setVisualizationUtils] = useState<SpaceVisualizationUtils | null>(null);
  const [activeVisualizationLayers, setActiveVisualizationLayers] = useState<string[]>([]);

  // Available furniture types
  const furnitureTypes = [
    'Desk', 'Chair', 'Table', 'Sofa', 'Bed Single', 'Bed Double', 
    'Bookcase', 'TV', 'Standing Desk', 'Adjustable Desk'
  ];

  // Initialize visualization utils when scene is available
  useEffect(() => {
    if (sceneAPI && !visualizationUtils) {
      const sceneManager = sceneAPI.getSceneManager();
      if (sceneManager?.scene) {
        const utils = new SpaceVisualizationUtils(sceneManager.scene);
        setVisualizationUtils(utils);
      }
    }
  }, [sceneAPI, visualizationUtils]);

  // Clean up visualization when component unmounts
  useEffect(() => {
    return () => {
      if (visualizationUtils && analysisResult) {
        visualizationUtils.clearVisualization(analysisResult.request.roomId);
      }
    };
  }, [visualizationUtils, analysisResult]);

  // Get mesh by ID function for services
  const getMeshById = useCallback((id: string) => {
    if (!sceneAPI) return null;
    const sceneManager = sceneAPI.getSceneManager();
    return sceneManager?.getMeshById(id) || null;
  }, [sceneAPI]);

  // Find rooms in the scene
  const roomObjects = sceneObjects.filter(obj => obj.type === 'custom-room');
  
  // Count optimized objects in the scene
  const optimizedObjectCount = sceneObjects.filter(obj => obj.id.startsWith('optimized-')).length;

  // Handle space analysis for furniture type
  const handleAnalyzeFurnitureType = async () => {
    if (roomObjects.length === 0) {
      addToResponseLog('Error: No custom rooms found. Please draw a room first.');
      return;
    }

    setIsAnalyzing(true);
    try {
      const roomId = roomObjects[0].id; // Use first room for now

      const request = {
        roomId,
        targetObjectType: selectedFurnitureType,
        strategy: {
          name: optimizationStrategy,
          priority: optimizationStrategy,
          description: `${optimizationStrategy} optimization strategy`
        }
      };

      const result = await spaceAnalysisService.analyzeSpace(request, sceneObjects, getMeshById);
      setAnalysisResult(result);

      // Update visualization
      if (showVisualization && visualizationUtils) {
        updateVisualization(result);
      }

             // Log results
       addToResponseLog(`Space Analysis: ${result.optimization.maxObjects} ${selectedFurnitureType}(s) can fit`);
       addToResponseLog(`Space Efficiency: ${(result.optimization.efficiency * 100).toFixed(1)}%`);
       
       if (result.recommendations.length > 0) {
         addToResponseLog(`Recommendations: ${result.recommendations.join(', ')}`);
       }

       // Place objects in the scene at optimal positions
       if (result.optimization.maxObjects > 0 && result.optimization.layouts.length > 0) {
         placeObjectsInScene(result.optimization.layouts, selectedFurnitureType);
       }

    } catch (error) {
      console.error('Space analysis failed:', error);
      addToResponseLog(`Error: ${error instanceof Error ? error.message : 'Space analysis failed'}`);
    } finally {
      setIsAnalyzing(false);
    }
  };

  // Handle analysis of selected objects
  const handleAnalyzeSelectedObjects = async () => {
    if (!hasSelection()) {
      addToResponseLog('Error: Please select objects to analyze');
      return;
    }

    if (roomObjects.length === 0) {
      addToResponseLog('Error: No custom rooms found. Please draw a room first.');
      return;
    }

    setIsAnalyzing(true);
    try {
      const selectedObjects = getSelectedObjects();
      const roomId = roomObjects[0].id;

      const result = await spaceAnalysisService.analyzeSelectedObjects(
        selectedObjects,
        roomId,
        sceneObjects,
        getMeshById
      );
      
      setAnalysisResult(result);

      // Update visualization
      if (showVisualization && visualizationUtils) {
        updateVisualization(result);
      }

             addToResponseLog(`Selected Object Analysis: ${result.optimization.maxObjects} similar objects can fit`);
       addToResponseLog(`Current object type: ${result.furnitureSpec.type}`);

       // Place objects in the scene at optimal positions
       if (result.optimization.maxObjects > 0 && result.optimization.layouts.length > 0) {
         placeObjectsInScene(result.optimization.layouts, result.furnitureSpec.type);
       }

    } catch (error) {
      console.error('Selected object analysis failed:', error);
      addToResponseLog(`Error: ${error instanceof Error ? error.message : 'Analysis failed'}`);
    } finally {
      setIsAnalyzing(false);
    }
  };

  // Generate optimized layouts
  const handleGenerateLayouts = async () => {
    if (roomObjects.length === 0) {
      addToResponseLog('Error: No custom rooms found. Please draw a room first.');
      return;
    }

    setIsAnalyzing(true);
    try {
      const roomMesh = getMeshById(roomObjects[0].id);
      if (!roomMesh) {
        throw new Error('Room mesh not found');
      }

      const request = {
        roomId: roomObjects[0].id,
        customRequirements: {
          furnitureTypes: [selectedFurnitureType]
        },
        strategies: [{
          name: optimizationStrategy,
          priority: optimizationStrategy,
          description: `${optimizationStrategy} layout strategy`
        }]
      };

      const result = await layoutGenerationService.generateLayouts(
        roomMesh,
        sceneObjects,
        request,
        getMeshById
      );

      setLayoutResult(result);

      addToResponseLog(`Layout Generation: ${result.layouts.length} layouts generated`);
      if (result.layouts.length > 0) {
        const bestLayout = result.layouts[0];
        addToResponseLog(`Best layout score: ${bestLayout.metrics.score}/100`);
        addToResponseLog(`Objects placed: ${bestLayout.objects.length}`);
      }

    } catch (error) {
      console.error('Layout generation failed:', error);
      addToResponseLog(`Error: ${error instanceof Error ? error.message : 'Layout generation failed'}`);
    } finally {
      setIsAnalyzing(false);
    }
  };

  // Apply selected layout to scene
  const handleApplyLayout = (layoutId: string) => {
    if (!layoutResult) return;

    const layout = layoutResult.layouts.find(l => l.id === layoutId);
    if (!layout) return;

    try {
      // Add furniture objects to scene
      layout.objects.forEach(layoutObj => {
        const sceneObject = {
          id: `${layoutObj.id}-${Date.now()}`, // Ensure unique ID
          type: layoutObj.type as any,
          position: layoutObj.position.clone(),
          rotation: layoutObj.rotation.clone(),
          scale: layoutObj.scale.clone(),
          color: '#8B4513', // Wood color for furniture
          isNurbs: false
        };

        addObject(sceneObject);
      });

      addToResponseLog(`Applied layout: ${layout.objects.length} objects placed`);

    } catch (error) {
      console.error('Failed to apply layout:', error);
      addToResponseLog(`Error: Failed to apply layout`);
    }
  };

  // Update visualization (placeholder - needs full room analysis)
  const updateVisualization = async (result: SpaceAnalysisResult) => {
    if (!visualizationUtils) return;

    try {
      // Get full room analysis for visualization
      const roomMesh = getMeshById(result.request.roomId);
      if (!roomMesh) return;

      const roomAnalysis = roomAnalysisService.analyzeRoom(roomMesh, sceneObjects, result.request.roomId);
      
      const options: VisualizationOptions = visualizationMode === 'accessibility' 
        ? createAccessibilityVisualizationOptions()
        : createDefaultVisualizationOptions();
      
      options.colorScheme = visualizationMode;

      const visualizationData = {
        roomId: result.request.roomId,
        roomAnalysis: roomAnalysis,
        options
      };

      const layers = visualizationUtils.createSpaceVisualization(visualizationData);
      setActiveVisualizationLayers(layers.map(l => l.id));
    } catch (error) {
      console.warn('Failed to update visualization:', error);
    }
  };

  // Toggle visualization layer
  const toggleVisualizationLayer = (layerType: string) => {
    if (!visualizationUtils || !analysisResult) return;

    const layerId = `${layerType}-${analysisResult.request.roomId}`;
    const layer = visualizationUtils.getLayer(layerId);
    
    if (layer) {
      visualizationUtils.toggleLayer(layerId, !layer.visible);
    }
  };

  // Clear visualization
  const clearVisualization = () => {
    if (visualizationUtils && analysisResult) {
      visualizationUtils.clearVisualization(analysisResult.request.roomId);
      setActiveVisualizationLayers([]);
    }
  };

  // Clear all optimized objects from the scene
  const clearOptimizedObjects = () => {
    const optimizedObjects = sceneObjects.filter(obj => 
      obj.id.startsWith('optimized-')
    );
    
    optimizedObjects.forEach(obj => {
      removeObject(obj.id);
    });
    
    addToResponseLog(`Cleared ${optimizedObjects.length} optimized objects from scene`);
  };

  // Place objects in the scene at optimal positions
  const placeObjectsInScene = (layouts: any[], furnitureType: string) => {
    if (!layouts || layouts.length === 0) {
      console.warn('No layouts available for placement');
      return;
    }

    try {
      // Clear existing optimized objects of the same type to avoid duplicates
      const existingObjects = sceneObjects.filter(obj => 
        obj.type === furnitureType && obj.id.startsWith(`optimized-${furnitureType.toLowerCase()}`)
      );
      
             // Remove existing optimized objects
       existingObjects.forEach(obj => {
         console.log(`Removing existing optimized object: ${obj.id}`);
         removeObject(obj.id);
       });

      // Place new objects at optimal positions
      layouts.forEach((layout: any, index: number) => {
        const objectId = `optimized-${furnitureType.toLowerCase()}-${index + 1}`;
        
        const sceneObject = {
          id: objectId,
          type: furnitureType,
          position: layout.position.clone(), // Use the Vector3 position directly
          rotation: layout.rotation.clone(), // Use the Vector3 rotation directly
          scale: new Vector3(1, 1, 1),
          color: '#8B4513', // Wood color for furniture
          isNurbs: false
        };

        addObject(sceneObject);
      });

      addToResponseLog(`Placed ${layouts.length} ${furnitureType} objects in optimal positions`);
      
    } catch (error) {
      console.error('Failed to place objects:', error);
      addToResponseLog(`Error: Failed to place objects in scene`);
    }
  };

  return (
    <div className="ai-control-group space-optimization-panel">
      <label>🏗️ Space Optimization:</label>
      
      {/* Room Status */}
      <div className="room-status">
        {roomObjects.length === 0 ? (
          <div className="no-room-warning">
            ⚠️ No custom rooms found. Use "draw room panel" to create a room first.
          </div>
        ) : (
          <div className="room-found">
            ✅ Room available: {roomObjects[0].id}
          </div>
        )}
      </div>

      {/* Furniture Type Selection */}
      <div className="control-group">
        <label htmlFor="furniture-type">Furniture Type:</label>
        <select 
          id="furniture-type"
          value={selectedFurnitureType} 
          onChange={(e) => setSelectedFurnitureType(e.target.value)}
          disabled={isAnalyzing}
        >
          {furnitureTypes.map(type => (
            <option key={type} value={type}>{type}</option>
          ))}
        </select>
      </div>

      {/* Optimization Strategy */}
      <div className="control-group">
        <label htmlFor="optimization-strategy">Strategy:</label>
        <select 
          id="optimization-strategy"
          value={optimizationStrategy} 
          onChange={(e) => setOptimizationStrategy(e.target.value as any)}
          disabled={isAnalyzing}
        >
          <option value="maximize">Maximize Capacity</option>
          <option value="comfort">Comfort & Accessibility</option>
          <option value="ergonomic">Ergonomic Layout</option>
          <option value="aesthetic">Aesthetic Balance</option>
        </select>
      </div>

      {/* Analysis Actions */}
             <div className="control-group">
         <button 
           onClick={handleAnalyzeFurnitureType}
           disabled={isAnalyzing || roomObjects.length === 0}
           className="analysis-button primary"
         >
           {isAnalyzing ? '🔄 Analyzing...' : '🔍 Analyze Space'}
         </button>

         <button 
           onClick={handleAnalyzeSelectedObjects}
           disabled={isAnalyzing || !hasSelection() || roomObjects.length === 0}
           className="analysis-button secondary"
         >
           📋 Analyze Selected
         </button>

         <button 
           onClick={handleGenerateLayouts}
           disabled={isAnalyzing || roomObjects.length === 0}
           className="analysis-button tertiary"
         >
           🎨 Generate Layouts
         </button>

         <button 
           onClick={clearOptimizedObjects}
           disabled={isAnalyzing || optimizedObjectCount === 0}
           className="analysis-button clear-button"
         >
           🗑️ Clear Optimized Objects ({optimizedObjectCount})
         </button>
       </div>

      {/* Analysis Results */}
      {analysisResult && (
        <div className="analysis-results">
          <h4>📊 Analysis Results:</h4>
          
          {/* Optimization Summary */}
          <div className="result-summary">
            <div className="metric">
              <span className="metric-label">Max Objects:</span>
              <span className="metric-value">{analysisResult.optimization.maxObjects}</span>
            </div>
            <div className="metric">
              <span className="metric-label">Space Efficiency:</span>
              <span className="metric-value">{(analysisResult.optimization.efficiency * 100).toFixed(1)}%</span>
            </div>
                         <div className="metric">
               <span className="metric-label">Room Area:</span>
               <span className="metric-value">{analysisResult.roomAnalysis.area.toFixed(1)}m²</span>
             </div>
          </div>

                     {/* Room Analysis Summary */}
           <div className="room-analysis-summary">
             <h5>Room Analysis:</h5>
             <div className="analysis-metrics">
               <div className="metric-row">
                 <span>Total Area:</span>
                 <span>{analysisResult.roomAnalysis.area.toFixed(1)}m²</span>
               </div>
               <div className="metric-row">
                 <span>Usable Area:</span>
                 <span>{analysisResult.roomAnalysis.usableArea.toFixed(1)}m²</span>
               </div>
               <div className="metric-row">
                 <span>Density:</span>
                 <span>{analysisResult.roomAnalysis.density.toFixed(2)} objects/m²</span>
               </div>
             </div>
           </div>

           {/* Alternative Options */}
           {analysisResult.alternativeOptions.length > 0 && (
             <div className="alternative-options">
               <h5>💡 Alternative Options:</h5>
               <div className="alternatives-list">
                 {analysisResult.alternativeOptions.slice(0, 3).map((alt, index) => (
                   <div key={index} className="alternative-item">
                     <span className="alt-type">{alt.objectType}:</span>
                     <span className="alt-count">{alt.maxCount} objects</span>
                     <span className="alt-efficiency">({(alt.efficiency * 100).toFixed(0)}%)</span>
                   </div>
                 ))}
               </div>
             </div>
           )}

          {/* Warnings */}
          {analysisResult.optimization.warnings.length > 0 && (
            <div className="warnings">
              <h5>⚠️ Warnings:</h5>
              <ul>
                {analysisResult.optimization.warnings.map((warning, index) => (
                  <li key={index}>{warning}</li>
                ))}
              </ul>
            </div>
          )}

          {/* Recommendations */}
          {analysisResult.recommendations.length > 0 && (
            <div className="recommendations">
              <h5>💡 Recommendations:</h5>
              <ul>
                {analysisResult.recommendations.map((rec, index) => (
                  <li key={index}>{rec}</li>
                ))}
              </ul>
            </div>
          )}
        </div>
      )}

      {/* Layout Results */}
      {layoutResult && (
        <div className="layout-results">
          <h4>🎨 Generated Layouts:</h4>
          
          <div className="layout-summary">
            <div className="metric">
              <span className="metric-label">Total Layouts:</span>
              <span className="metric-value">{layoutResult.layouts.length}</span>
            </div>
            <div className="metric">
              <span className="metric-label">Best Score:</span>
              <span className="metric-value">{layoutResult.summary.bestScore}/100</span>
            </div>
          </div>

          {/* Layout Options */}
          <div className="layout-options">
            {layoutResult.layouts.slice(0, 3).map((layout, index) => (
              <div key={layout.id} className="layout-option">
                <div className="layout-header">
                  <span className="layout-name">Layout {index + 1}</span>
                  <span className="layout-score">{layout.metrics.score}/100</span>
                </div>
                <div className="layout-details">
                  <div className="detail">Objects: {layout.objects.length}</div>
                  <div className="detail">Strategy: {layout.strategy.name}</div>
                  <div className="detail">Accessibility: {layout.metrics.accessibility}/100</div>
                </div>
                <button 
                  onClick={() => handleApplyLayout(layout.id)}
                  className="apply-layout-button"
                >
                  Apply Layout
                </button>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Visualization Controls */}
      <div className="visualization-controls">
        <h4>🎯 Visualization:</h4>
        
        <div className="control-group">
          <label>
            <input 
              type="checkbox" 
              checked={showVisualization}
              onChange={(e) => setShowVisualization(e.target.checked)}
            />
            Show Visualization
          </label>
        </div>

        {showVisualization && (
          <>
            <div className="control-group">
              <label htmlFor="visualization-mode">Mode:</label>
              <select 
                id="visualization-mode"
                value={visualizationMode} 
                onChange={(e) => setVisualizationMode(e.target.value as any)}
              >
                <option value="default">Default</option>
                <option value="accessibility">Accessibility</option>
                <option value="efficiency">Efficiency</option>
                <option value="safety">Safety</option>
              </select>
            </div>

            {activeVisualizationLayers.length > 0 && (
              <div className="layer-controls">
                <button onClick={() => toggleVisualizationLayer('zones')}>
                  Toggle Zones
                </button>
                <button onClick={() => toggleVisualizationLayer('constraints')}>
                  Toggle Constraints
                </button>
                <button onClick={() => toggleVisualizationLayer('paths')}>
                  Toggle Paths
                </button>
                <button onClick={clearVisualization} className="clear-button">
                  Clear All
                </button>
              </div>
            )}
          </>
        )}
      </div>

      {/* Help Text */}
      <div className="help-text">
        <details>
          <summary>ℹ️ How to use</summary>
                     <div className="help-content">
             <p>1. Draw a custom room using "draw room panel"</p>
             <p>2. Select furniture type and optimization strategy</p>
             <p>3. Click "Analyze Space" to see how many objects fit</p>
             <p>4. Objects are automatically placed in the scene at optimal positions</p>
             <p>5. Use "Generate Layouts" for complete room arrangements</p>
             <p>6. Toggle visualization to see placement zones and constraints</p>
             <p>7. Select existing objects and use "Analyze Selected" for custom analysis</p>
             <p>8. Use "Clear Optimized Objects" to remove all placed objects</p>
           </div>
        </details>
      </div>
    </div>
  );
}; 