import assert from 'node:assert/strict';
import test from 'node:test';
import { readFile } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import * as THREE from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { NodeIO } from '@gltf-transform/core';
import { ALL_EXTENSIONS } from '@gltf-transform/extensions';
import { ASSET_CATALOGUE } from '../../src/game/assets/catalogue.js';
import { ASSET_MANIFEST, MODEL_KEYS, getModelAsset } from '../../src/game/assets/manifest.js';
import { ModelLibrary } from '../../src/three/loaders/ModelLibrary.js';
import { animateAsset, collectMotionParts, headingFromTravel } from '../../src/three/assetMotion.js';
import { createFloorKit } from '../../src/three/floorKit.js';

async function readKit(key) {
  const buffer = await readFile(`public${getModelAsset(key).path}`);
  if (key === MODEL_KEYS.industrialKit || key === MODEL_KEYS.zipBag) {
    // Node checks geometry/hierarchy; the browser suite decodes the packed textures.
    const io = new NodeIO().registerExtensions(ALL_EXTENSIONS);
    const doc = await io.readBinary(buffer);
    assert.equal(doc.getRoot().listTextures().length, key === MODEL_KEYS.zipBag ? 2 : 1, 'packed procedural maps');
    for (const texture of doc.getRoot().listTextures()) texture.dispose();
    const geometryOnly = await io.writeBinary(doc);
    return new GLTFLoader().parseAsync(geometryOnly.buffer.slice(geometryOnly.byteOffset, geometryOnly.byteOffset + geometryOnly.byteLength), '');
  }
  return new GLTFLoader().parseAsync(buffer.buffer.slice(buffer.byteOffset, buffer.byteOffset + buffer.byteLength), '');
}

test('all catalogue entries resolve to unique, origin-centred GLB roots with painted geometry', async () => {
  assert.equal(new Set(ASSET_CATALOGUE.map(a => a.node)).size, ASSET_CATALOGUE.length);
  const report = JSON.parse(await readFile('docs/3d/asset-collection/build-report.json', 'utf8'));
  const bagReport = JSON.parse(await readFile('docs/3d/zip-bag/build-report.json', 'utf8'));
  assert.equal(report.assets.length + bagReport.assets.length, ASSET_CATALOGUE.length);
  for (const key of new Set(ASSET_CATALOGUE.map(a => a.model))) {
    const gltf = await readKit(key);
    const entries = ASSET_CATALOGUE.filter(a => a.model === key);
    assert.deepEqual(gltf.scene.children.map(n => n.name).sort(), entries.map(a => a.node).sort());
    for (const entry of entries) {
      const root = gltf.scene.getObjectByName(entry.node);
      assert.deepEqual(root.position.toArray(), [0, 0, 0]);
      assert.equal(root.userData.forward_axis, '+X');
      const bounds = new THREE.Box3().setFromObject(root);
      assert.ok(bounds.max.y > bounds.min.y, `${entry.node} has volume`);
      assert.ok(bounds.min.y > -0.11, `${entry.node} ground contact`);
      assert.ok(bounds.max.y < 3, `${entry.node} scale`);
      let meshes = 0;
      root.traverse((node) => {
        if (!node.isMesh) return;
        meshes += 1;
        assert.ok(key === MODEL_KEYS.zipBag ? node.geometry.attributes.uv : node.geometry.attributes.color, `${entry.node} material coordinates`);
      });
      assert.ok(meshes > 0, entry.node);
    }
  }
  for (const pkg of [...report.packages, ...bagReport.packages]) {
    const bytes = await readFile(pkg.path);
    assert.equal(createHash('sha256').update(bytes).digest('hex'), pkg.sha256);
  }
});

test('authored motion retains hierarchy and moves cloned parts independently', async () => {
  const gltf = await readKit(MODEL_KEYS.units);
  const source = gltf.scene.getObjectByName('Unit_Hero');
  const clone = source.clone(true);
  const parts = collectMotionParts(clone);
  assert.equal(parts.length, 4);
  animateAsset(parts, 100, true);
  assert.ok(parts.some(p => Math.abs(p.node.rotation.z) > 0.1));
  assert.ok(collectMotionParts(source).every(p => p.node.rotation.z === 0));
  animateAsset(parts, 100, false);
  assert.ok(parts.every(p => p.node.rotation.z === p.rest.z));
  for (const [dx, dz] of [[1, 0], [0, 1], [-1, 0], [0, -1]]) {
    const forward = new THREE.Vector3(1, 0, 0).applyAxisAngle(new THREE.Vector3(0, 1, 0), headingFromTravel(dx, dz));
    assert.ok(forward.distanceTo(new THREE.Vector3(dx, 0, dz)) < 0.00001);
  }
});

test('floor kit fills each cell once using shared instanced geometry', async () => {
  const gltf = await readKit(MODEL_KEYS.industrialKit);
  const library = new ModelLibrary(new Map([[MODEL_KEYS.industrialKit, gltf.scene]]));
  const floor = createFloorKit({ id: 'audit', grid: { columns: 15, rows: 20, cellSize: 40 } }, library);
  assert.ok(floor);
  assert.ok(floor.children.every(mesh => mesh.isInstancedMesh));
  assert.equal(floor.children.length, 6, 'one draw per material primitive and tile type');
  const plate = floor.children.find(mesh => mesh.name.endsWith('Kit_FloorPlate'));
  const matrix = new THREE.Matrix4();
  plate.getMatrixAt(0, matrix);
  const position = new THREE.Vector3().setFromMatrixPosition(matrix);
  assert.equal(position.x, 0.5);
  assert.equal(position.z, 1.5);
  assert.equal(createFloorKit({ id: 'missing', grid: { columns: 1, rows: 1, cellSize: 40 } }, new ModelLibrary()), null);
  assert.equal(getModelAsset(MODEL_KEYS.productionReserve).preload, false);
  assert.equal(new Set(ASSET_MANIFEST.models.map(a => a.path)).size, ASSET_MANIFEST.models.length);
});
