import { Scene, Mesh, MeshBuilder, Vector3, CSG, StandardMaterial, Color3 } from 'babylonjs';
import type { Wall } from '../models/Wall';
import type { Opening } from '../models/Opening';
import { subtractMeshes } from '../utils/csgUtils';

export class GeometryService {
    private scene: Scene;

    constructor(scene: Scene) {
        this.scene = scene;
    }

    public async generateWallMesh(wall: Wall): Promise<Mesh> {
        const wallMesh = MeshBuilder.CreateBox(wall.id, {
            width: wall.parameters.length,
            height: wall.parameters.height,
            depth: wall.parameters.thickness
        }, this.scene);
        wallMesh.position = wall.parameters.position.clone();

        const material = new StandardMaterial(`${wall.id}-material`, this.scene);
        material.diffuseColor = Color3.FromHexString("#C0C0C0"); // Silver-grey color for walls
        wallMesh.material = material;

        if (wall.openings && wall.openings.length > 0) {
            console.log(`[GeometryService] Found ${wall.openings.length} openings for wall ${wall.id}`);
            const validOpenings = wall.openings.filter(opening => {
                const wallBounds = {
                    minX: -wall.parameters.length / 2,
                    maxX: wall.parameters.length / 2,
                    minY: -wall.parameters.height / 2,
                    maxY: wall.parameters.height / 2,
                };

                const openingBounds = {
                    minX: opening.parameters.position.offsetX - opening.parameters.width / 2,
                    maxX: opening.parameters.position.offsetX + opening.parameters.width / 2,
                    minY: opening.parameters.position.elevation - opening.parameters.height / 2,
                    maxY: opening.parameters.position.elevation + opening.parameters.height / 2,
                };

                if (
                    openingBounds.minX < wallBounds.minX ||
                    openingBounds.maxX > wallBounds.maxX ||
                    openingBounds.minY < wallBounds.minY ||
                    openingBounds.maxY > wallBounds.maxY
                ) {
                    console.warn(`[GeometryService] Opening ${opening.id} is outside the bounds of wall ${wall.id}. Skipping.`);
                    return false;
                }

                // Check for overlaps with other openings
                for (const otherOpening of wall.openings) {
                    if (opening.id === otherOpening.id) continue;

                    const otherOpeningBounds = {
                        minX: otherOpening.parameters.position.offsetX - otherOpening.parameters.width / 2,
                        maxX: otherOpening.parameters.position.offsetX + otherOpening.parameters.width / 2,
                        minY: otherOpening.parameters.position.elevation - otherOpening.parameters.height / 2,
                        maxY: otherOpening.parameters.position.elevation + otherOpening.parameters.height / 2,
                    };

                    const overlapX = Math.max(0, Math.min(openingBounds.maxX, otherOpeningBounds.maxX) - Math.max(openingBounds.minX, otherOpeningBounds.minX));
                    const overlapY = Math.max(0, Math.min(openingBounds.maxY, otherOpeningBounds.maxY) - Math.max(openingBounds.minY, otherOpeningBounds.minY));

                    if (overlapX > 0 && overlapY > 0) {
                        console.warn(`[GeometryService] Opening ${opening.id} overlaps with opening ${otherOpening.id}. Skipping.`);
                        return false;
                    }
                }

                return true;
            });

            if (validOpenings.length > 0) {
                console.log(`[GeometryService] Subtracting ${validOpenings.length} valid opening(s) from wall ${wall.id}`);
                const openingVolumes = validOpenings.map(opening => 
                    this.createOpeningVolume(opening, wall.parameters.thickness, wallMesh.position)
                );
                
                let wallCSG = CSG.FromMesh(wallMesh);

                openingVolumes.forEach(openingVolume => {
                    const openingCSG = CSG.FromMesh(openingVolume);
                    wallCSG = wallCSG.subtract(openingCSG);
                    openingVolume.dispose();
                });

                const finalMesh = wallCSG.toMesh(wall.id, wallMesh.material, this.scene);
                console.log(`[GeometryService] Created final mesh for wall ${wall.id} with openings.`);
                wallMesh.dispose();
                return finalMesh;
            }
        }

        return wallMesh;
    }

    public createOpeningVolume(opening: Opening, wallThickness: number, wallPosition: Vector3): Mesh {
        const openingVolume = MeshBuilder.CreateBox(`opening-volume-${opening.id}`, {
            width: opening.parameters.width,
            height: opening.parameters.height,
            depth: wallThickness + 0.1 // Add a little extra depth to ensure a clean cut
        }, this.scene);

        // Position the opening relative to the wall's center.
        const localPosition = new Vector3(
            opening.parameters.position.offsetX,
            opening.parameters.position.elevation - wallPosition.y + opening.parameters.height / 2,
            0
        );

        openingVolume.position = wallPosition.add(localPosition);
        openingVolume.isVisible = false; // The volume is for subtraction, it shouldn't be visible.

        return openingVolume;
    }
} 