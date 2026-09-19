import assert from 'node:assert/strict';
import test from 'node:test';
import * as THREE from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { NodeIO } from '@gltf-transform/core';
import { ALL_EXTENSIONS } from '@gltf-transform/extensions';
import { MODEL_KEYS, getModelAsset } from '../../src/game/assets/manifest.js';
import { setZipBagOpening } from '../../src/three/zipBag.js';

async function loadBag() {
  const io = new NodeIO().registerExtensions(ALL_EXTENSIONS);
  const document = await io.read(`public${getModelAsset(MODEL_KEYS.zipBag).path}`);
  const material = document.getRoot().listMaterials().find(m => m.getName() === 'ZipBag_ClearPolyethylene');
  assert.equal(material.getAlphaMode(), 'BLEND');
  assert.ok(material.getBaseColorFactor()[3] < 0.4);
  assert.ok(material.getNormalTexture());
  assert.ok(material.getMetallicRoughnessTexture());
  assert.equal(document.getRoot().listTextures().length, 2);
  for (const texture of document.getRoot().listTextures()) texture.dispose();
  const data = await io.writeBinary(document);
  const gltf = await new GLTFLoader().parseAsync(data.buffer.slice(data.byteOffset, data.byteOffset + data.byteLength), '');
  return gltf.scene.getObjectByName('Prop_ZipBag');
}

test('zip bag has real punched geometry, a sealed base, anchors and thin-film materials', async () => {
  const bag = await loadBag();
  bag.updateMatrixWorld(true);
  const holeRay = new THREE.Raycaster(new THREE.Vector3(1, 0.915, 0), new THREE.Vector3(-1, 0, 0));
  assert.equal(holeRay.intersectObject(bag, true).length, 0, 'hole is empty, not a dark texture');
  const filmRay = new THREE.Raycaster(new THREE.Vector3(1, 0.915, 0.08), new THREE.Vector3(-1, 0, 0));
  assert.ok(filmRay.intersectObject(bag, true).length >= 2, 'both film leaves exist');
  const bottomRay = new THREE.Raycaster(new THREE.Vector3(0, -0.1, 0), new THREE.Vector3(0, 1, 0));
  assert.ok(bottomRay.intersectObject(bag, true).length, 'bottom weld joins the film leaves');
  assert.ok(bag.getObjectByName('ZipBag_ContentAnchor'));
  assert.ok(bag.getObjectByName('ZipBag_HangingAnchor'));
  assert.equal(bag.userData.forward_axis, '+X');
  assert.equal(getModelAsset(MODEL_KEYS.zipBag).preload, true);
  const bounds = new THREE.Box3().setFromObject(bag, true);
  assert.ok(Math.abs(bounds.min.y) < 0.001);
  assert.ok(bounds.max.x - bounds.min.x < 0.06);
});

test('bag opening deforms all six parts, preserves the base and is independent per clone', async () => {
  const source = await loadBag();
  const bag = source.clone(true);
  assert.equal(setZipBagOpening(bag, 1), 6);
  const closed = new THREE.Box3().setFromObject(source, true);
  const open = new THREE.Box3().setFromObject(bag, true);
  assert.ok(open.max.x-open.min.x > closed.max.x-closed.min.x+0.15);
  assert.equal(open.min.y, closed.min.y);
  source.traverse(n => { if (n.morphTargetInfluences) assert.equal(n.morphTargetInfluences[0], 0); });
  setZipBagOpening(bag, 0.5);
  bag.traverse(n => { if (n.morphTargetInfluences) assert.equal(n.morphTargetInfluences[0], 0.5); });
  setZipBagOpening(bag, -1);
  assert.equal(bag.userData.opening, 0);
  setZipBagOpening(bag, 2);
  assert.equal(bag.userData.opening, 1);
  assert.throws(() => setZipBagOpening(bag, NaN), TypeError);
  assert.equal(setZipBagOpening(new THREE.Group(), 1), 0);
});
