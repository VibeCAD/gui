import React, { useMemo } from 'react';
import { Vector3 } from 'babylonjs';
import { useSceneStore } from '../../state/sceneStore';
import type { SceneObject } from '../../types/types';
import './SelectionInfoDisplay.css';

interface SelectionInfoDisplayProps {
  className?: string;
}

interface SelectionInfoData {
  selectionCount: number;
  selectionTypes: Map<string, number>;
  commonProperties: {
    color?: string;
    scale?: Vector3;
  };
  boundingBox: {
    min: Vector3;
    max: Vector3;
    center: Vector3;
    size: Vector3;
  };
}

export const SelectionInfoDisplay: React.FC<SelectionInfoDisplayProps> = ({ className }) => {
  const { selectedObjectId, selectedObjectIds, sceneObjects } = useSceneStore();

  const selectionInfo = useMemo((): SelectionInfoData | null => {
    const selectedObjs = sceneObjects.filter(obj => 
      selectedObjectId === obj.id || selectedObjectIds.includes(obj.id)
    );

    if (selectedObjs.length === 0) return null;

    // Count selection types
    const selectionTypes = new Map<string, number>();
    selectedObjs.forEach(obj => {
      const count = selectionTypes.get(obj.type) || 0;
      selectionTypes.set(obj.type, count + 1);
    });

    // Check for common properties
    const commonProperties: SelectionInfoData['commonProperties'] = {};
    
    // Check common color
    const colors = new Set(selectedObjs.map(obj => obj.color));
    if (colors.size === 1) {
      commonProperties.color = Array.from(colors)[0];
    }

    // Check common scale
    const scales = selectedObjs.map(obj => obj.scale);
    if (scales.length > 0) {
      const firstScale = scales[0];
      const sameScale = scales.every(scale => 
        Math.abs(scale.x - firstScale.x) < 0.01 &&
        Math.abs(scale.y - firstScale.y) < 0.01 &&
        Math.abs(scale.z - firstScale.z) < 0.01
      );
      if (sameScale) {
        commonProperties.scale = firstScale.clone();
      }
    }

    // Calculate bounding box
    let minX = Infinity, minY = Infinity, minZ = Infinity;
    let maxX = -Infinity, maxY = -Infinity, maxZ = -Infinity;

    selectedObjs.forEach(obj => {
      const pos = obj.position;
      const scale = obj.scale;
      
      // Simple bounding box calculation based on position and scale
      const halfScaleX = scale.x / 2;
      const halfScaleY = scale.y / 2;
      const halfScaleZ = scale.z / 2;
      
      minX = Math.min(minX, pos.x - halfScaleX);
      minY = Math.min(minY, pos.y - halfScaleY);
      minZ = Math.min(minZ, pos.z - halfScaleZ);
      maxX = Math.max(maxX, pos.x + halfScaleX);
      maxY = Math.max(maxY, pos.y + halfScaleY);
      maxZ = Math.max(maxZ, pos.z + halfScaleZ);
    });

    const min = new Vector3(minX, minY, minZ);
    const max = new Vector3(maxX, maxY, maxZ);
    const center = min.add(max).scale(0.5);
    const size = max.subtract(min);

    return {
      selectionCount: selectedObjs.length,
      selectionTypes,
      commonProperties,
      boundingBox: { min, max, center, size }
    };
  }, [selectedObjectId, selectedObjectIds, sceneObjects]);

  if (!selectionInfo) {
    return (
      <div className={`selection-info-display no-selection ${className || ''}`}>
        <div className="info-section">
          <span className="info-label">Selection:</span>
          <span className="info-value">None</span>
        </div>
        <div className="info-hint">
          Click objects to select them • Ctrl+Click for multi-select
        </div>
      </div>
    );
  }

  const { selectionCount, selectionTypes, commonProperties, boundingBox } = selectionInfo;

  return (
    <div className={`selection-info-display has-selection ${className || ''}`}>
      <div className="info-header">
        <div className="selection-count">
          <span className="count-number">{selectionCount}</span>
          <span className="count-label">
            {selectionCount === 1 ? 'Object' : 'Objects'} Selected
          </span>
        </div>
        {selectionCount > 1 && (
          <div className="selection-indicator">
            <span className="multi-icon">🔸</span>
            <span>Multi-Select</span>
          </div>
        )}
      </div>

      <div className="info-sections">
        {/* Object Types */}
        <div className="info-section">
          <span className="info-label">Types:</span>
          <div className="info-value">
            {Array.from(selectionTypes.entries()).map(([type, count]) => (
              <span key={type} className="type-item">
                {type} ({count})
              </span>
            ))}
          </div>
        </div>

        {/* Common Properties */}
        {commonProperties.color && (
          <div className="info-section">
            <span className="info-label">Color:</span>
            <div className="info-value">
              <div className="color-preview" style={{ backgroundColor: commonProperties.color }}></div>
              <span>{commonProperties.color}</span>
            </div>
          </div>
        )}

        {commonProperties.scale && (
          <div className="info-section">
            <span className="info-label">Scale:</span>
            <span className="info-value">
              ({commonProperties.scale.x.toFixed(2)}, {commonProperties.scale.y.toFixed(2)}, {commonProperties.scale.z.toFixed(2)})
            </span>
          </div>
        )}

        {/* Bounding Box */}
        <div className="info-section">
          <span className="info-label">Bounds:</span>
          <div className="info-value bounds-info">
            <div className="bounds-item">
              <span className="bounds-label">Size:</span>
              <span>
                {boundingBox.size.x.toFixed(1)}×{boundingBox.size.y.toFixed(1)}×{boundingBox.size.z.toFixed(1)}
              </span>
            </div>
            <div className="bounds-item">
              <span className="bounds-label">Center:</span>
              <span>
                ({boundingBox.center.x.toFixed(1)}, {boundingBox.center.y.toFixed(1)}, {boundingBox.center.z.toFixed(1)})
              </span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}; 