import { Mesh, CSG, VertexData, StandardMaterial } from 'babylonjs';

/**
 * Subtracts one or more meshes from a base mesh using a Web Worker for CSG operations.
 * @param baseMesh The mesh to subtract from.
 * @param meshesToSubtract An array of meshes to subtract from the base mesh.
 * @returns A new mesh representing the result of the subtraction, or the original mesh if subtraction fails.
 */
export function subtractMeshes(baseMesh: Mesh, meshesToSubtract: Mesh[]): Promise<Mesh> {
    return new Promise((resolve, reject) => {
        if (!meshesToSubtract || meshesToSubtract.length === 0) {
            resolve(baseMesh);
            return;
        }

        const worker = new Worker('/csg-worker.js');

        worker.onmessage = (e) => {
            const { result } = e.data;
            const scene = baseMesh.getScene();

            const resultMesh = new Mesh(baseMesh.name, scene); // Use original name
            const vertexData = new VertexData();
            vertexData.positions = result.positions;
            vertexData.indices = result.indices;
            vertexData.normals = result.normals;
            vertexData.uvs = result.uvs;
            vertexData.applyToMesh(resultMesh);

            if(result.material) {
                const material = new StandardMaterial(`${baseMesh.name}-material`, scene);
                // In a real implementation, you would transfer material properties
                resultMesh.material = material;
            } else {
                resultMesh.material = baseMesh.material;
            }

            baseMesh.dispose();
            meshesToSubtract.forEach(mesh => mesh.dispose());

            worker.terminate();
            resolve(resultMesh);
        };

        worker.onerror = (err) => {
            console.error('Error in CSG worker:', err);
            worker.terminate();
            reject(err);
        };

        const getMeshData = (mesh: Mesh) => {
            const vertexData = VertexData.ExtractFromMesh(mesh);
            return {
                id: mesh.id,
                name: mesh.name,
                positions: vertexData.positions,
                indices: vertexData.indices,
                normals: vertexData.normals,
                uvs: vertexData.uvs,
                material: mesh.material ? { id: mesh.material.id } : null
            };
        };

        worker.postMessage({
            baseMesh: getMeshData(baseMesh),
            meshesToSubtract: meshesToSubtract.map(getMeshData)
        });
    });
} 