import * as THREE from 'three';
import { MODEL_KEYS } from '../game/assets/manifest.js';
import { METERS_PER_SIMULATION_UNIT } from './coordinates.js';

export function createFloorKit(room, modelLibrary) {
  const sources = ['Kit_FloorPlate', 'Kit_FloorGrate', 'Kit_FloorHazard']
    .map((name) => modelLibrary.cloneNamed(MODEL_KEYS.industrialKit, name));
  if (sources.some((source) => !source)) return null;
  const group = new THREE.Group();
  group.name = `${room.id} authored floor kit`;
  const batches = [[], [], []];
  const { columns, rows, cellSize } = room.grid;
  const cell = cellSize * METERS_PER_SIMULATION_UNIT;
  for (let col = 0; col < columns; col += 1) {
    for (let row = 0; row < rows; row += 1) {
      const edge = row === 0 || row === rows - 1;
      const type = edge ? 2 : col % 7 === 3 ? 1 : 0;
      const transform = new THREE.Matrix4().compose(
        new THREE.Vector3((col + 0.5) * cell, 0, (row + 0.5) * cell),
        new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(0, 1, 0), row === 0 ? Math.PI : 0),
        new THREE.Vector3(cell, 1, cell),
      );
      batches[type].push(transform);
    }
  }
  sources.forEach((source, type) => {
    source.updateMatrixWorld(true);
    source.traverse((node) => {
      if (!node.isMesh || !batches[type].length) return;
      const mesh = new THREE.InstancedMesh(node.geometry, node.material, batches[type].length);
      mesh.name = `${room.id} ${source.name}`;
      mesh.receiveShadow = true;
      batches[type].forEach((matrix, index) => mesh.setMatrixAt(index, new THREE.Matrix4().multiplyMatrices(matrix, node.matrixWorld)));
      mesh.instanceMatrix.needsUpdate = true;
      mesh.computeBoundingSphere();
      group.add(mesh);
    });
  });
  return group;
}
