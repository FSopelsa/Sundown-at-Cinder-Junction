import assert from 'node:assert/strict';
import test from 'node:test';
import * as THREE from 'three';
import { makeWallFadeable, updateWallOcclusion } from '../../src/three/wallOcclusion.js';

test('only a wall between the camera and focus point becomes transparent', () => {
  const scene = new THREE.Scene();
  const camera = new THREE.PerspectiveCamera();
  camera.position.set(0, 0, 5);
  const wall = new THREE.Mesh(
    new THREE.BoxGeometry(2, 2, 0.2),
    new THREE.MeshBasicMaterial({ color: 0xffffff }),
  );
  makeWallFadeable(wall);
  scene.add(wall);
  scene.updateMatrixWorld(true);

  assert.deepEqual(updateWallOcclusion(camera, new THREE.Vector3(0, 0, -5), [wall]), [wall]);
  assert.equal(wall.material.transparent, true);
  assert.equal(wall.material.opacity, 0.22);

  assert.deepEqual(updateWallOcclusion(camera, new THREE.Vector3(5, 0, -5), [wall]), []);
  assert.equal(wall.material.transparent, false);
  assert.equal(wall.material.opacity, 1);
});
