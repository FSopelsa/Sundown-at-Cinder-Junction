import assert from 'node:assert/strict';
import test from 'node:test';
import * as THREE from 'three';
import { disposeObjectResources } from '../../src/three/disposeObjectResources.js';

test('disposes each owned Three resource once even when meshes share it', () => {
  const geometry = new THREE.BoxGeometry(1, 1, 1);
  const texture = new THREE.DataTexture(new Uint8Array([255, 255, 255, 255]), 1, 1);
  const material = new THREE.MeshBasicMaterial({ map: texture });
  const root = new THREE.Group();
  root.add(new THREE.Mesh(geometry, material), new THREE.Mesh(geometry, material));

  const disposed = { geometry: 0, material: 0, texture: 0 };
  geometry.addEventListener('dispose', () => { disposed.geometry += 1; });
  material.addEventListener('dispose', () => { disposed.material += 1; });
  texture.addEventListener('dispose', () => { disposed.texture += 1; });

  disposeObjectResources(root);

  assert.deepEqual(disposed, { geometry: 1, material: 1, texture: 1 });
});
