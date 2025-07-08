import React from 'react';
import { useSceneStore } from '../../state/sceneStore';

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
  } = useSceneStore();

  const selectObjectById = (objectId: string) => {
    const object = sceneObjects.find(obj => obj.id === objectId);
    if (object) {
      setSelectedObjectId(objectId);
      console.log('📋 Selected from sidebar:', objectId);
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
          
          return (
            <div 
              key={obj.id} 
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
