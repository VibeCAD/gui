import React from 'react';
import { useSceneStore } from '../../state/sceneStore';
import type { ParametricWallObject } from '../../types/types';

export const SceneGraph: React.FC = () => {
  const {
    sceneObjects,
    selectedObjectId,
    selectedObjectIds,
    multiSelectMode,
    objectVisibility,
    objectLocked,
    setSelectedObjectId,
    setObjectVisibility,
    setObjectLocked,
    clearSelection,
    clearAllObjects,
    isObjectVisible,
    isObjectLocked,
    setSelectedOpeningId,
    selectedOpeningId,
  } = useSceneStore();

  const selectObjectById = (objectId: string, isOpening: boolean = false) => {
    if (isOpening) {
      setSelectedOpeningId(objectId);
      // Also select the parent wall
      const parentWall = sceneObjects.find(obj => 
        obj.type === 'parametric-wall' && (obj as ParametricWallObject).params.openings.some(o => o.id === objectId)
      );
      if (parentWall) {
        // In multi-select, we don't want to clear other selections.
        // The store's `setSelectedObjectId` handles the logic based on the `multiSelectMode` flag.
        setSelectedObjectId(parentWall.id);
      }
    } else {
      setSelectedObjectId(objectId);
      setSelectedOpeningId(null); // Clear opening selection
    }
  };

  const toggleObjectVisibility = (objectId: string) => {
    const isCurrentlyVisible = isObjectVisible(objectId);
    setObjectVisibility(objectId, !isCurrentlyVisible);
    const obj = sceneObjects.find(o => o.id === objectId);
    if (obj?.mesh) {
      obj.mesh.isVisible = !isCurrentlyVisible;
    }
  };

  const toggleObjectLock = (objectId: string) => {
    const isCurrentlyLocked = isObjectLocked(objectId);
    setObjectLocked(objectId, !isCurrentlyLocked);
    if (!isCurrentlyLocked) {
      clearSelection();
    }
  };

  const visibleObjects = sceneObjects.filter(obj => obj.type !== 'ground');

  return (
    <div className="ai-control-group">
      <label>Scene Objects ({visibleObjects.length}):</label>
      <div className="selection-mode-hint">
        💡 {multiSelectMode ? 'Multi-select mode: Ctrl+Click to select multiple' : 'Click objects to select them'}
      </div>
      <div className="scene-objects">
        {visibleObjects.map(obj => {
          const isSelected = selectedObjectId === obj.id || selectedObjectIds.includes(obj.id);
          const isVisible = objectVisibility[obj.id] !== false;
          const isLocked = objectLocked[obj.id] || false;
          
          const renderWallOpenings = (wall: ParametricWallObject) => {
            return (
              <div className="opening-list">
                {(wall.params.openings || []).map(opening => {
                  const isOpeningSelected = selectedOpeningId === opening.id;
                  return (
                    <div
                      key={opening.id}
                      className={`scene-object opening ${isOpeningSelected ? 'selected' : ''}`}
                      onClick={(e) => {
                        e.stopPropagation();
                        selectObjectById(opening.id, true);
                      }}
                      title={`Click to select this ${opening.type}`}
                    >
                      <span className="object-type"> L {opening.type}</span>
                      <span className="object-id">{opening.id.slice(0, 8)}...</span>
                    </div>
                  );
                })}
              </div>
            );
          };

          return (
            <div key={obj.id}>
              <div 
                className={`scene-object ${isSelected ? 'selected' : ''} ${isLocked ? 'locked' : ''} ${!isVisible ? 'hidden' : ''}`}
                onClick={() => selectObjectById(obj.id)}
                title={`${isLocked ? '[LOCKED] ' : ''}${!isVisible ? '[HIDDEN] ' : ''}Click to select this object`}
              >
                <span className="object-type">{obj.type}</span>
                <span className="object-id">{obj.id}</span>
                <div className="object-controls">
                  <button
                    className={`object-control-btn ${isVisible ? 'visible' : 'hidden'}`}
                    onClick={(e) => {
                      e.stopPropagation();
                      toggleObjectVisibility(obj.id);
                    }}
                    title={isVisible ? 'Hide object' : 'Show object'}
                  >
                    {isVisible ? '👁️' : '🚫'}
                  </button>
                  <button
                    className={`object-control-btn ${isLocked ? 'locked' : 'unlocked'}`}
                    onClick={(e) => {
                      e.stopPropagation();
                      toggleObjectLock(obj.id);
                    }}
                    title={isLocked ? 'Unlock object' : 'Lock object'}
                  >
                    {isLocked ? '🔒' : '🔓'}
                  </button>
                </div>
                <div className="object-color" style={{ backgroundColor: obj.color }}></div>
              </div>
              {obj.type === 'parametric-wall' && renderWallOpenings(obj as ParametricWallObject)}
            </div>
          );
        })}
        {visibleObjects.length === 0 && (
          <div className="no-objects">
            No objects in scene<br/>
            <small>Use the Create menu to add objects</small>
          </div>
        )}
      </div>
      <div className="object-stats">
        <small>
          Selected: {selectedObjectId ? 1 : selectedObjectIds.length} | 
          Hidden: {Object.values(objectVisibility).filter(v => v === false).length} | 
          Locked: {Object.values(objectLocked).filter(v => v === true).length}
        </small>
      </div>
      <button 
        onClick={clearAllObjects}
        className="clear-all-button"
        disabled={visibleObjects.length === 0}
      >
        Clear All Objects
      </button>
    </div>
  );
};
