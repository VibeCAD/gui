import { Vector3, Color3, Mesh, StandardMaterial, Scene, MeshBuilder, DynamicTexture } from 'babylonjs';
import type { RoomAnalysisResult, PlacementZone, RoomConstraint } from '../services/roomAnalysisService';
import type { PlacementValidationResult, PlacementConstraint } from '../services/placementConstraintsService';
import type { GeneratedLayout } from '../services/layoutGenerationService';

export interface VisualizationOptions {
  showConstraints: boolean;
  showPlacementZones: boolean;
  showAccessibilityPaths: boolean;
  showViolations: boolean;
  showMetrics: boolean;
  opacity: number; // 0-1 for overlay opacity
  colorScheme: 'default' | 'accessibility' | 'efficiency' | 'safety';
}

export interface VisualizationLayer {
  id: string;
  type: 'zone' | 'constraint' | 'path' | 'violation' | 'metric';
  meshes: Mesh[];
  visible: boolean;
  interactive: boolean;
  metadata?: any;
}

export interface SpaceVisualizationData {
  roomId: string;
  roomAnalysis: RoomAnalysisResult;
  validation?: PlacementValidationResult;
  layout?: GeneratedLayout;
  options: VisualizationOptions;
}

/**
 * Space Visualization Utilities - creates visual overlays for space analysis
 */
export class SpaceVisualizationUtils {
  private scene: Scene;
  private visualizationLayers = new Map<string, VisualizationLayer>();
  
  // Color schemes for different visualization modes
  private colorSchemes = {
    default: {
      optimal: new Color3(0, 1, 0),      // Green
      good: new Color3(0.7, 1, 0),       // Yellow-green
      acceptable: new Color3(1, 1, 0),   // Yellow
      poor: new Color3(1, 0.5, 0),       // Orange
      restricted: new Color3(1, 0, 0),   // Red
      constraint: new Color3(0.5, 0.5, 1), // Blue
      violation: new Color3(1, 0, 1),    // Magenta
      path: new Color3(0, 0.8, 1)        // Cyan
    },
    accessibility: {
      optimal: new Color3(0, 0.8, 0),    // Accessibility green
      good: new Color3(0.5, 0.8, 0),     // Light green
      acceptable: new Color3(1, 0.8, 0), // Amber
      poor: new Color3(1, 0.4, 0),       // Orange warning
      restricted: new Color3(0.8, 0, 0), // Red restriction
      constraint: new Color3(0, 0.4, 0.8), // ADA blue
      violation: new Color3(0.9, 0, 0.4), // Critical red
      path: new Color3(0, 0.6, 0.9)      // Path blue
    },
    efficiency: {
      optimal: new Color3(0, 0.9, 0.1),  // Efficient green
      good: new Color3(0.4, 0.9, 0.1),   // Good efficiency
      acceptable: new Color3(0.8, 0.9, 0.1), // Moderate
      poor: new Color3(0.9, 0.6, 0.1),   // Low efficiency
      restricted: new Color3(0.6, 0.3, 0.1), // Wasted space
      constraint: new Color3(0.2, 0.5, 0.8), // Space blocker
      violation: new Color3(0.9, 0.2, 0.2), // Efficiency loss
      path: new Color3(0.3, 0.7, 0.9)    // Circulation
    },
    safety: {
      optimal: new Color3(0.1, 0.9, 0.1), // Safe green
      good: new Color3(0.3, 0.8, 0.2),    // Generally safe
      acceptable: new Color3(0.6, 0.7, 0.3), // Caution
      poor: new Color3(0.8, 0.5, 0.2),    // Safety concern
      restricted: new Color3(0.9, 0.2, 0.1), // Danger
      constraint: new Color3(0.2, 0.3, 0.8), // Safety barrier
      violation: new Color3(0.9, 0.1, 0.3), // Safety violation
      path: new Color3(0.1, 0.5, 0.9)     // Emergency path
    }
  };

  constructor(scene: Scene) {
    this.scene = scene;
  }

  /**
   * Create complete space visualization
   */
  public createSpaceVisualization(data: SpaceVisualizationData): VisualizationLayer[] {
    const layers: VisualizationLayer[] = [];

    // Clear existing visualization
    this.clearVisualization(data.roomId);

    if (data.options.showPlacementZones) {
      const zoneLayer = this.createPlacementZonesVisualization(data);
      if (zoneLayer) layers.push(zoneLayer);
    }

    if (data.options.showConstraints) {
      const constraintLayer = this.createConstraintsVisualization(data);
      if (constraintLayer) layers.push(constraintLayer);
    }

    if (data.options.showAccessibilityPaths) {
      const pathLayer = this.createAccessibilityPathsVisualization(data);
      if (pathLayer) layers.push(pathLayer);
    }

    if (data.options.showViolations && data.validation) {
      const violationLayer = this.createViolationsVisualization(data);
      if (violationLayer) layers.push(violationLayer);
    }

    if (data.options.showMetrics && data.layout) {
      const metricsLayer = this.createMetricsVisualization(data);
      if (metricsLayer) layers.push(metricsLayer);
    }

    // Store layers for management
    layers.forEach(layer => {
      this.visualizationLayers.set(layer.id, layer);
    });

    return layers;
  }

  /**
   * Create placement zones visualization
   */
  private createPlacementZonesVisualization(data: SpaceVisualizationData): VisualizationLayer | null {
    const meshes: Mesh[] = [];
    const { roomAnalysis, options } = data;
    const colors = this.colorSchemes[options.colorScheme];

    for (const zone of roomAnalysis.placementZones) {
      // Create zone floor overlay
      const zoneMesh = this.createZoneOverlay(zone, colors);
      if (zoneMesh) {
        zoneMesh.name = `zone-${zone.id}`;
        zoneMesh.metadata = { 
          type: 'placement-zone', 
          zoneData: zone,
          roomId: data.roomId 
        };
        meshes.push(zoneMesh);
      }

      // Create zone label
      const labelMesh = this.createZoneLabel(zone, colors);
      if (labelMesh) {
        labelMesh.name = `zone-label-${zone.id}`;
        labelMesh.metadata = { 
          type: 'zone-label', 
          zoneData: zone,
          roomId: data.roomId 
        };
        meshes.push(labelMesh);
      }
    }

    if (meshes.length === 0) return null;

    return {
      id: `zones-${data.roomId}`,
      type: 'zone',
      meshes,
      visible: true,
      interactive: true,
      metadata: { roomId: data.roomId, type: 'placement-zones' }
    };
  }

  /**
   * Create constraints visualization
   */
  private createConstraintsVisualization(data: SpaceVisualizationData): VisualizationLayer | null {
    const meshes: Mesh[] = [];
    const { roomAnalysis, options } = data;
    const colors = this.colorSchemes[options.colorScheme];

    for (const constraint of roomAnalysis.constraints) {
      // Skip wall constraints for cleaner visualization
      if (constraint.type === 'wall') continue;

      const constraintMesh = this.createConstraintVisualization(constraint, colors, options);
      if (constraintMesh) {
        constraintMesh.name = `constraint-${constraint.id}`;
        constraintMesh.metadata = { 
          type: 'constraint', 
          constraintData: constraint,
          roomId: data.roomId 
        };
        meshes.push(constraintMesh);
      }
    }

    if (meshes.length === 0) return null;

    return {
      id: `constraints-${data.roomId}`,
      type: 'constraint',
      meshes,
      visible: true,
      interactive: true,
      metadata: { roomId: data.roomId, type: 'constraints' }
    };
  }

  /**
   * Create accessibility paths visualization
   */
  private createAccessibilityPathsVisualization(data: SpaceVisualizationData): VisualizationLayer | null {
    const meshes: Mesh[] = [];
    const { roomAnalysis, options } = data;
    const colors = this.colorSchemes[options.colorScheme];

    for (const path of roomAnalysis.accessibilityPaths) {
      const pathMesh = this.createPathVisualization(path, colors, options);
      if (pathMesh) {
        pathMesh.name = `path-${path.id}`;
        pathMesh.metadata = { 
          type: 'accessibility-path', 
          pathData: path,
          roomId: data.roomId 
        };
        meshes.push(pathMesh);
      }

      // Add width indicators
      const widthIndicators = this.createPathWidthIndicators(path, colors);
      meshes.push(...widthIndicators);
    }

    if (meshes.length === 0) return null;

    return {
      id: `paths-${data.roomId}`,
      type: 'path',
      meshes,
      visible: true,
      interactive: true,
      metadata: { roomId: data.roomId, type: 'accessibility-paths' }
    };
  }

  /**
   * Create violations visualization
   */
  private createViolationsVisualization(data: SpaceVisualizationData): VisualizationLayer | null {
    if (!data.validation) return null;

    const meshes: Mesh[] = [];
    const { validation, options } = data;
    const colors = this.colorSchemes[options.colorScheme];

    // Visualize all violations and warnings
    const allViolations = [...validation.violations, ...validation.warnings];

    for (const violation of allViolations) {
      const violationMesh = this.createViolationVisualization(violation, colors, options);
      if (violationMesh) {
        violationMesh.name = `violation-${violation.id}`;
        violationMesh.metadata = { 
          type: 'violation', 
          violationData: violation,
          roomId: data.roomId 
        };
        meshes.push(violationMesh);
      }
    }

    if (meshes.length === 0) return null;

    return {
      id: `violations-${data.roomId}`,
      type: 'violation',
      meshes,
      visible: true,
      interactive: true,
      metadata: { roomId: data.roomId, type: 'violations' }
    };
  }

  /**
   * Create metrics visualization
   */
  private createMetricsVisualization(data: SpaceVisualizationData): VisualizationLayer | null {
    if (!data.layout) return null;

    const meshes: Mesh[] = [];
    const { layout, options } = data;

    // Create functional zones visualization
    for (const functionalZone of layout.zones.functional) {
      const zoneMesh = this.createFunctionalZoneVisualization(functionalZone, options);
      if (zoneMesh) {
        zoneMesh.name = `functional-zone-${functionalZone.name}`;
        zoneMesh.metadata = { 
          type: 'functional-zone', 
          zoneData: functionalZone,
          roomId: data.roomId 
        };
        meshes.push(zoneMesh);
      }
    }

    // Create circulation visualization
    for (const circulation of layout.zones.circulation) {
      const circulationMesh = this.createCirculationVisualization(circulation, options);
      if (circulationMesh) {
        circulationMesh.name = `circulation-${Date.now()}`;
        circulationMesh.metadata = { 
          type: 'circulation', 
          circulationData: circulation,
          roomId: data.roomId 
        };
        meshes.push(circulationMesh);
      }
    }

    if (meshes.length === 0) return null;

    return {
      id: `metrics-${data.roomId}`,
      type: 'metric',
      meshes,
      visible: true,
      interactive: false,
      metadata: { roomId: data.roomId, type: 'layout-metrics' }
    };
  }

  /**
   * Create zone overlay mesh
   */
  private createZoneOverlay(zone: PlacementZone, colors: any): Mesh | null {
    try {
      // Create ground polygon from zone
      const points = zone.polygon.map(p => new Vector3(p.x, 0.01, p.z)); // Slight elevation
      
      // Create polygon mesh
      const mesh = MeshBuilder.CreatePolygon(`zone-${zone.id}`, {
        shape: points,
        sideOrientation: Mesh.DOUBLESIDE
      }, this.scene);

      // Create material based on zone type
      const material = new StandardMaterial(`zone-material-${zone.id}`, this.scene);
      const color = colors[zone.type] || colors.acceptable;
      
      material.diffuseColor = color;
      material.alpha = 0.3; // Semi-transparent
      material.emissiveColor = color.scale(0.2); // Slight glow
      
      mesh.material = material;
      mesh.isPickable = true;

      return mesh;
    } catch (error) {
      console.warn('Failed to create zone overlay:', error);
      return null;
    }
  }

  /**
   * Create zone label
   */
  private createZoneLabel(zone: PlacementZone, colors: any): Mesh | null {
    try {
      const labelText = `${zone.type.toUpperCase()}\n${zone.area.toFixed(1)}m²`;
      
      // Create dynamic texture for text
      const dynamicTexture = new DynamicTexture(`zone-label-texture-${zone.id}`, 
        { width: 256, height: 128 }, this.scene);
      
      const color = colors[zone.type] || colors.acceptable;
      const textColor = color.r + color.g + color.b > 1.5 ? 'black' : 'white';
      
      dynamicTexture.drawText(labelText, null, null, '20px Arial', textColor, 'transparent', true);

      // Create plane for label
      const labelPlane = MeshBuilder.CreatePlane(`zone-label-${zone.id}`, {
        size: 1,
        sideOrientation: Mesh.DOUBLESIDE
      }, this.scene);

      const labelMaterial = new StandardMaterial(`zone-label-material-${zone.id}`, this.scene);
      labelMaterial.diffuseTexture = dynamicTexture;
      labelMaterial.emissiveTexture = dynamicTexture;
      labelMaterial.alpha = 0.8;
      
      labelPlane.material = labelMaterial;
      labelPlane.position = zone.center.add(new Vector3(0, 0.5, 0));
      labelPlane.billboardMode = Mesh.BILLBOARDMODE_ALL;
      labelPlane.isPickable = false;

      return labelPlane;
    } catch (error) {
      console.warn('Failed to create zone label:', error);
      return null;
    }
  }

  /**
   * Create constraint visualization
   */
  private createConstraintVisualization(
    constraint: RoomConstraint, 
    colors: any, 
    options: VisualizationOptions
  ): Mesh | null {
    try {
      let mesh: Mesh;

      if (constraint.type === 'existing-object') {
        // Create clearance radius visualization
        mesh = MeshBuilder.CreateCylinder(`constraint-${constraint.id}`, {
          height: 0.05,
          diameter: constraint.clearanceRequired * 2
        }, this.scene);
      } else if (constraint.type === 'door' || constraint.type === 'window') {
        // Create rectangular area
        mesh = MeshBuilder.CreateBox(`constraint-${constraint.id}`, {
          width: constraint.dimensions.width,
          height: 0.05,
          depth: constraint.dimensions.depth
        }, this.scene);
      } else {
        // Create generic constraint marker
        mesh = MeshBuilder.CreateSphere(`constraint-${constraint.id}`, {
          diameter: 0.5
        }, this.scene);
      }

      mesh.position = constraint.position.clone();

      const material = new StandardMaterial(`constraint-material-${constraint.id}`, this.scene);
      const color = colors.constraint;
      
      material.diffuseColor = color;
      material.alpha = options.opacity * 0.6;
      material.emissiveColor = color.scale(0.3);
      
      mesh.material = material;
      mesh.isPickable = true;

      return mesh;
    } catch (error) {
      console.warn('Failed to create constraint visualization:', error);
      return null;
    }
  }

  /**
   * Create path visualization
   */
  private createPathVisualization(
    path: any, 
    colors: any, 
    options: VisualizationOptions
  ): Mesh | null {
    try {
      // Create path as a tube
      const pathPoints = [path.start, path.end];
      
      const mesh = MeshBuilder.CreateTube(`path-${path.id}`, {
        path: pathPoints,
        radius: path.width / 2,
        tessellation: 8
      }, this.scene);

      const material = new StandardMaterial(`path-material-${path.id}`, this.scene);
      const color = path.width < 0.91 ? colors.violation : colors.path;
      
      material.diffuseColor = color;
      material.alpha = options.opacity * 0.4;
      material.emissiveColor = color.scale(0.2);
      
      mesh.material = material;
      mesh.isPickable = true;

      return mesh;
    } catch (error) {
      console.warn('Failed to create path visualization:', error);
      return null;
    }
  }

  /**
   * Create path width indicators
   */
  private createPathWidthIndicators(path: any, colors: any): Mesh[] {
    const indicators: Mesh[] = [];

    try {
      // Create width measurement indicators at start and end
      const positions = [path.start, path.end];
      
      for (let i = 0; i < positions.length; i++) {
        const indicator = MeshBuilder.CreateCylinder(`path-indicator-${path.id}-${i}`, {
          height: 0.1,
          diameter: 0.2
        }, this.scene);

        indicator.position = positions[i].clone();
        indicator.position.y += 0.05;

        const material = new StandardMaterial(`path-indicator-material-${path.id}-${i}`, this.scene);
        const color = path.width < 0.91 ? colors.violation : colors.path;
        
        material.diffuseColor = color;
        material.emissiveColor = color.scale(0.5);
        
        indicator.material = material;
        indicator.isPickable = false;

        indicators.push(indicator);
      }
    } catch (error) {
      console.warn('Failed to create path indicators:', error);
    }

    return indicators;
  }

  /**
   * Create violation visualization
   */
  private createViolationVisualization(
    violation: PlacementConstraint, 
    colors: any, 
    options: VisualizationOptions
  ): Mesh | null {
    if (!violation.position) return null;

    try {
      // Create violation marker based on severity
      let mesh: Mesh;
      
      if (violation.severity === 'error') {
        mesh = MeshBuilder.CreateOctahedron(`violation-${violation.id}`, {
          size: 0.3
        }, this.scene);
      } else if (violation.severity === 'warning') {
        mesh = MeshBuilder.CreateCylinder(`violation-${violation.id}`, {
          height: 0.6,
          diameter: 0.3
        }, this.scene);
      } else {
        mesh = MeshBuilder.CreateSphere(`violation-${violation.id}`, {
          diameter: 0.2
        }, this.scene);
      }

      mesh.position = violation.position.clone();
      mesh.position.y += 0.5; // Elevate above ground

      const material = new StandardMaterial(`violation-material-${violation.id}`, this.scene);
      const color = violation.severity === 'error' ? colors.violation : 
                   violation.severity === 'warning' ? colors.poor : colors.acceptable;
      
      material.diffuseColor = color;
      material.emissiveColor = color.scale(0.8); // Strong glow for attention
      
      mesh.material = material;
      mesh.isPickable = true;

      return mesh;
    } catch (error) {
      console.warn('Failed to create violation visualization:', error);
      return null;
    }
  }

  /**
   * Create functional zone visualization
   */
  private createFunctionalZoneVisualization(
    functionalZone: any, 
    options: VisualizationOptions
  ): Mesh | null {
    try {
      const mesh = MeshBuilder.CreateCylinder(`functional-zone-${functionalZone.name}`, {
        height: 0.02,
        diameter: functionalZone.radius * 2
      }, this.scene);

      mesh.position = functionalZone.center.clone();

      const material = new StandardMaterial(`functional-zone-material-${functionalZone.name}`, this.scene);
      material.diffuseColor = new Color3(0.2, 0.6, 0.8);
      material.alpha = options.opacity * 0.2;
      material.emissiveColor = new Color3(0.1, 0.3, 0.4);
      
      mesh.material = material;
      mesh.isPickable = false;

      return mesh;
    } catch (error) {
      console.warn('Failed to create functional zone visualization:', error);
      return null;
    }
  }

  /**
   * Create circulation visualization
   */
  private createCirculationVisualization(
    circulation: any, 
    options: VisualizationOptions
  ): Mesh | null {
    try {
      const pathPoints = [circulation.start, circulation.end];
      
      const mesh = MeshBuilder.CreateTube(`circulation-${Date.now()}`, {
        path: pathPoints,
        radius: circulation.width / 4, // Thinner than accessibility paths
        tessellation: 6
      }, this.scene);

      const material = new StandardMaterial(`circulation-material-${Date.now()}`, this.scene);
      material.diffuseColor = new Color3(0.6, 0.8, 0.2);
      material.alpha = options.opacity * 0.3;
      material.emissiveColor = new Color3(0.3, 0.4, 0.1);
      
      mesh.material = material;
      mesh.isPickable = false;

      return mesh;
    } catch (error) {
      console.warn('Failed to create circulation visualization:', error);
      return null;
    }
  }

  /**
   * Toggle layer visibility
   */
  public toggleLayer(layerId: string, visible: boolean): void {
    const layer = this.visualizationLayers.get(layerId);
    if (layer) {
      layer.visible = visible;
      layer.meshes.forEach(mesh => {
        mesh.setEnabled(visible);
      });
    }
  }

  /**
   * Update layer opacity
   */
  public updateLayerOpacity(layerId: string, opacity: number): void {
    const layer = this.visualizationLayers.get(layerId);
    if (layer) {
      layer.meshes.forEach(mesh => {
        if (mesh.material && mesh.material instanceof StandardMaterial) {
          mesh.material.alpha = opacity;
        }
      });
    }
  }

  /**
   * Clear all visualization for a room
   */
  public clearVisualization(roomId: string): void {
    const layersToRemove: string[] = [];
    
    for (const [layerId, layer] of this.visualizationLayers) {
      if (layer.metadata?.roomId === roomId) {
        // Dispose of all meshes
        layer.meshes.forEach(mesh => {
          if (mesh.material) {
            mesh.material.dispose();
          }
          mesh.dispose();
        });
        layersToRemove.push(layerId);
      }
    }

    // Remove layers from map
    layersToRemove.forEach(layerId => {
      this.visualizationLayers.delete(layerId);
    });
  }

  /**
   * Get all visualization layers
   */
  public getLayers(): VisualizationLayer[] {
    return Array.from(this.visualizationLayers.values());
  }

  /**
   * Get layer by ID
   */
  public getLayer(layerId: string): VisualizationLayer | undefined {
    return this.visualizationLayers.get(layerId);
  }

  /**
   * Create a heat map overlay for space efficiency
   */
  public createSpaceEfficiencyHeatMap(
    roomAnalysis: RoomAnalysisResult, 
    options: VisualizationOptions
  ): Mesh | null {
    try {
      // Create a grid-based heat map
      const { boundingBox } = roomAnalysis.roomGeometry;
      const gridResolution = 0.5;
      
      const width = boundingBox.max.x - boundingBox.min.x;
      const depth = boundingBox.max.z - boundingBox.min.z;
      
      const gridWidth = Math.ceil(width / gridResolution);
      const gridDepth = Math.ceil(depth / gridResolution);
      
      // Create dynamic texture for heat map
      const textureSize = 256;
      const dynamicTexture = new DynamicTexture('heatmap-texture', {
        width: textureSize,
        height: textureSize
      }, this.scene);
      
      const context = dynamicTexture.getContext();
      const imageData = context.createImageData(textureSize, textureSize);
      
      // Generate heat map data
      for (let x = 0; x < textureSize; x++) {
        for (let z = 0; z < textureSize; z++) {
          // Map texture coordinates to world coordinates
          const worldX = boundingBox.min.x + (x / textureSize) * width;
          const worldZ = boundingBox.min.z + (z / textureSize) * depth;
          
          // Find closest placement zone
          let efficiency = 0;
          let minDistance = Infinity;
          
          for (const zone of roomAnalysis.placementZones) {
            const distance = Vector3.Distance(
              new Vector3(worldX, 0, worldZ),
              zone.center
            );
            
            if (distance < minDistance) {
              minDistance = distance;
              efficiency = zone.accessibilityScore;
            }
          }
          
          // Convert efficiency to heat map color
          const pixel = (z * textureSize + x) * 4;
          const heatColor = this.efficiencyToHeatMapColor(efficiency);
          
          imageData.data[pixel] = heatColor.r * 255;     // Red
          imageData.data[pixel + 1] = heatColor.g * 255; // Green
          imageData.data[pixel + 2] = heatColor.b * 255; // Blue
          imageData.data[pixel + 3] = 128; // Alpha (50% transparent)
        }
      }
      
      context.putImageData(imageData, 0, 0);
      dynamicTexture.update();
      
      // Create plane for heat map
      const heatMapPlane = MeshBuilder.CreateGround('heatmap', {
        width,
        height: depth
      }, this.scene);
      
      heatMapPlane.position = new Vector3(
        (boundingBox.min.x + boundingBox.max.x) / 2,
        0.005, // Slightly above floor
        (boundingBox.min.z + boundingBox.max.z) / 2
      );
      
      const material = new StandardMaterial('heatmap-material', this.scene);
      material.diffuseTexture = dynamicTexture;
      material.alpha = options.opacity;
      
      heatMapPlane.material = material;
      heatMapPlane.isPickable = false;
      
      return heatMapPlane;
    } catch (error) {
      console.warn('Failed to create heat map:', error);
      return null;
    }
  }

  /**
   * Convert efficiency value to heat map color
   */
  private efficiencyToHeatMapColor(efficiency: number): Color3 {
    // Create heat map from blue (low) to red (high)
    if (efficiency < 0.3) {
      return new Color3(0, 0, 1); // Blue - poor efficiency
    } else if (efficiency < 0.6) {
      return new Color3(0, 1, 1); // Cyan - low efficiency
    } else if (efficiency < 0.8) {
      return new Color3(0, 1, 0); // Green - good efficiency
    } else {
      return new Color3(1, 1, 0); // Yellow - excellent efficiency
    }
  }
}

// Export utility functions
export function createDefaultVisualizationOptions(): VisualizationOptions {
  return {
    showConstraints: true,
    showPlacementZones: true,
    showAccessibilityPaths: true,
    showViolations: true,
    showMetrics: false,
    opacity: 0.7,
    colorScheme: 'default'
  };
}

export function createAccessibilityVisualizationOptions(): VisualizationOptions {
  return {
    showConstraints: true,
    showPlacementZones: true,
    showAccessibilityPaths: true,
    showViolations: true,
    showMetrics: false,
    opacity: 0.8,
    colorScheme: 'accessibility'
  };
} 