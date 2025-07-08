import React from 'react';
import { Vector3 } from 'babylonjs';
import { useSceneStore } from '../../state/sceneStore';
import type { SceneObject } from '../../types/types';

export const PropertiesPanel: React.FC = () => {
  const {
    sceneObjects,
    selectedObjectId,
    selectedObjectIds,
    tessellationQuality,
    controlPointVisualizations,
    selectedControlPointIndex,
    updateObject,
    setTessellationQuality,
    setSelectedControlPointIndex,
    getSelectedObject,
    getSelectedObjects,
    hasSelection,
  } = useSceneStore();

  const selectedObject = getSelectedObject();
  const selectedObjects = getSelectedObjects();
  const hasSelectionFlag = hasSelection();

  const updateSelectedObjectProperty = (property: keyof SceneObject, value: any) => {
    if (selectedObject) {
      updateObject(selectedObject.id, { [property]: value });
    }
  };

  const updateSelectedObjectsProperty = (property: keyof SceneObject, value: any) => {
    const objectsToUpdate = selectedObjectId ? [selectedObjectId] : selectedObjectIds;
    objectsToUpdate.forEach(id => {
      updateObject(id, { [property]: value });
    });
  };

  const updateControlPoint = (objectId: string, uvIndex: [number, number], newPosition: Vector3) => {
    const obj = sceneObjects.find(o => o.id === objectId);
    if (obj && obj.isNurbs && obj.verbData) {
      const [u, v] = uvIndex;
      const newVerbData = { ...obj.verbData };
      newVerbData.controlPoints[u][v] = [newPosition.x, newPosition.y, newPosition.z];
      updateObject(objectId, { verbData: newVerbData });
    }
  };

  const renderBasicProperties = (obj: SceneObject) => (
    <div className="properties-section">
      <h4>Transform Properties</h4>
      
      {/* Position */}
      <div className="property-group">
        <label>Position:</label>
        <div className="vector-input">
          <input
            type="number"
            value={obj.position.x.toFixed(2)}
            onChange={(e) => updateSelectedObjectProperty('position', 
              new Vector3(parseFloat(e.target.value), obj.position.y, obj.position.z))}
            step="0.1"
            className="vector-component"
          />
          <input
            type="number"
            value={obj.position.y.toFixed(2)}
            onChange={(e) => updateSelectedObjectProperty('position', 
              new Vector3(obj.position.x, parseFloat(e.target.value), obj.position.z))}
            step="0.1"
            className="vector-component"
          />
          <input
            type="number"
            value={obj.position.z.toFixed(2)}
            onChange={(e) => updateSelectedObjectProperty('position', 
              new Vector3(obj.position.x, obj.position.y, parseFloat(e.target.value)))}
            step="0.1"
            className="vector-component"
          />
        </div>
      </div>

      {/* Rotation */}
      <div className="property-group">
        <label>Rotation (radians):</label>
        <div className="vector-input">
          <input
            type="number"
            value={obj.rotation.x.toFixed(2)}
            onChange={(e) => updateSelectedObjectProperty('rotation', 
              new Vector3(parseFloat(e.target.value), obj.rotation.y, obj.rotation.z))}
            step="0.1"
            className="vector-component"
          />
          <input
            type="number"
            value={obj.rotation.y.toFixed(2)}
            onChange={(e) => updateSelectedObjectProperty('rotation', 
              new Vector3(obj.rotation.x, parseFloat(e.target.value), obj.rotation.z))}
            step="0.1"
            className="vector-component"
          />
          <input
            type="number"
            value={obj.rotation.z.toFixed(2)}
            onChange={(e) => updateSelectedObjectProperty('rotation', 
              new Vector3(obj.rotation.x, obj.rotation.y, parseFloat(e.target.value)))}
            step="0.1"
            className="vector-component"
          />
        </div>
      </div>

      {/* Scale */}
      <div className="property-group">
        <label>Scale:</label>
        <div className="vector-input">
          <input
            type="number"
            value={obj.scale.x.toFixed(2)}
            onChange={(e) => updateSelectedObjectProperty('scale', 
              new Vector3(parseFloat(e.target.value), obj.scale.y, obj.scale.z))}
            step="0.1"
            min="0.1"
            className="vector-component"
          />
          <input
            type="number"
            value={obj.scale.y.toFixed(2)}
            onChange={(e) => updateSelectedObjectProperty('scale', 
              new Vector3(obj.scale.x, parseFloat(e.target.value), obj.scale.z))}
            step="0.1"
            min="0.1"
            className="vector-component"
          />
          <input
            type="number"
            value={obj.scale.z.toFixed(2)}
            onChange={(e) => updateSelectedObjectProperty('scale', 
              new Vector3(obj.scale.x, obj.scale.y, parseFloat(e.target.value)))}
            step="0.1"
            min="0.1"
            className="vector-component"
          />
        </div>
      </div>

      {/* Color */}
      <div className="property-group">
        <label>Color:</label>
        <div className="color-input-group">
          <input
            type="color"
            value={obj.color}
            onChange={(e) => updateSelectedObjectProperty('color', e.target.value)}
            className="color-picker"
          />
          <input
            type="text"
            value={obj.color}
            onChange={(e) => {
              if (/^#[0-9A-F]{6}$/i.test(e.target.value)) {
                updateSelectedObjectProperty('color', e.target.value);
              }
            }}
            className="color-hex-input"
            placeholder="#FFFFFF"
          />
        </div>
      </div>
    </div>
  );

  const renderNurbsProperties = (obj: SceneObject) => {
    if (!obj.isNurbs || !obj.verbData) return null;

    const visualization = controlPointVisualizations.find(viz => viz.objectId === obj.id);
    const currentTessellation = tessellationQuality[obj.id] || 16;

    return (
      <div className="properties-section">
        <h4>NURBS Properties</h4>
        
        {/* Tessellation Quality */}
        <div className="property-group">
          <label>Tessellation Quality:</label>
          <div className="tessellation-input">
            <input
              type="range"
              min="4"
              max="64"
              value={currentTessellation}
              onChange={(e) => setTessellationQuality(obj.id, parseInt(e.target.value))}
              className="tessellation-slider"
            />
            <span className="tessellation-value">{currentTessellation}</span>
          </div>
        </div>

        {/* NURBS Surface Information */}
        <div className="property-group">
          <label>Surface Info:</label>
          <div className="nurbs-info">
            <div>Degree U: {obj.verbData.degreeU}</div>
            <div>Degree V: {obj.verbData.degreeV}</div>
            <div>Control Points: {obj.verbData.controlPoints.length} × {obj.verbData.controlPoints[0]?.length || 0}</div>
          </div>
        </div>

        {/* Control Point Editing */}
        {visualization && selectedControlPointIndex !== null && (
          <div className="property-group">
            <label>Selected Control Point:</label>
            <div className="control-point-info">
              <div>Index: {selectedControlPointIndex}</div>
              {(() => {
                const controlPointsFlat = obj.verbData.controlPoints.flat();
                const controlPointData = controlPointsFlat[selectedControlPointIndex];
                if (controlPointData) {
                  const [u, v] = [
                    Math.floor(selectedControlPointIndex / obj.verbData.controlPoints[0].length),
                    selectedControlPointIndex % obj.verbData.controlPoints[0].length
                  ];
                  return (
                    <div className="vector-input">
                      <input
                        type="number"
                        value={controlPointData[0].toFixed(2)}
                        onChange={(e) => updateControlPoint(obj.id, [u, v], 
                          new Vector3(parseFloat(e.target.value), controlPointData[1], controlPointData[2]))}
                        step="0.1"
                        className="vector-component"
                      />
                      <input
                        type="number"
                        value={controlPointData[1].toFixed(2)}
                        onChange={(e) => updateControlPoint(obj.id, [u, v], 
                          new Vector3(controlPointData[0], parseFloat(e.target.value), controlPointData[2]))}
                        step="0.1"
                        className="vector-component"
                      />
                      <input
                        type="number"
                        value={controlPointData[2].toFixed(2)}
                        onChange={(e) => updateControlPoint(obj.id, [u, v], 
                          new Vector3(controlPointData[0], controlPointData[1], parseFloat(e.target.value)))}
                        step="0.1"
                        className="vector-component"
                      />
                    </div>
                  );
                }
                return null;
              })()}
            </div>
          </div>
        )}

        {/* Control Point Instructions */}
        <div className="property-group">
          <div className="control-point-instructions">
            <small>
              💡 Click on control points in the 3D view to select and edit them here.
            </small>
          </div>
        </div>
      </div>
    );
  };

  const renderMultiSelectProperties = () => (
    <div className="properties-section">
      <h4>Multiple Objects Selected ({selectedObjects.length})</h4>
      
      {/* Bulk Color Change */}
      <div className="property-group">
        <label>Bulk Color Change:</label>
        <div className="color-input-group">
          <input
            type="color"
            onChange={(e) => updateSelectedObjectsProperty('color', e.target.value)}
            className="color-picker"
          />
          <button
            onClick={() => {
              const randomColor = `#${Math.floor(Math.random()*16777215).toString(16).padStart(6, '0')}`;
              updateSelectedObjectsProperty('color', randomColor);
            }}
            className="random-color-btn"
          >
            Random Color
          </button>
        </div>
      </div>

      {/* Object List */}
      <div className="property-group">
        <label>Selected Objects:</label>
        <div className="selected-objects-list">
          {selectedObjects.map(obj => (
            <div key={obj.id} className="selected-object-item">
              <span className="object-type">{obj.type}</span>
              <span className="object-id">{obj.id}</span>
              <div className="object-color" style={{ backgroundColor: obj.color }}></div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );

  if (!hasSelectionFlag) {
    return (
      <div className="ai-control-group">
        <label>Properties:</label>
        <div className="no-selection-message">
          Select an object to view its properties
        </div>
      </div>
    );
  }

  return (
    <div className="ai-control-group">
      <label>Properties:</label>
      <div className="properties-content">
        {selectedObject ? (
          <>
            {renderBasicProperties(selectedObject)}
            {renderNurbsProperties(selectedObject)}
          </>
        ) : (
          renderMultiSelectProperties()
        )}
      </div>
    </div>
  );
};
