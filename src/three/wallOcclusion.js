import * as THREE from 'three';

const raycaster = new THREE.Raycaster();
const direction = new THREE.Vector3();

export function makeWallFadeable(mesh) {
  if (!mesh?.isMesh || mesh.userData.wallFadeMaterials) return mesh;
  const materials = (Array.isArray(mesh.material) ? mesh.material : [mesh.material])
    .filter(Boolean)
    .map((material) => material.clone());
  mesh.material = Array.isArray(mesh.material) ? materials : materials[0];
  mesh.userData.wallFadeMaterials = materials.map((material) => ({
    material,
    opacity: material.opacity,
    transparent: material.transparent,
    depthWrite: material.depthWrite,
  }));
  return mesh;
}

function setFaded(mesh, faded, fadedOpacity) {
  for (const state of mesh.userData.wallFadeMaterials ?? []) {
    state.material.opacity = faded ? Math.min(state.opacity, fadedOpacity) : state.opacity;
    state.material.transparent = faded || state.transparent;
    state.material.depthWrite = faded ? false : state.depthWrite;
  }
}

export function updateWallOcclusion(camera, target, meshes, fadedOpacity = 0.22) {
  for (const mesh of meshes) setFaded(mesh, false, fadedOpacity);
  if (!camera || !target || meshes.length === 0) return [];

  camera.updateMatrixWorld();
  direction.copy(target).sub(camera.position);
  const distance = direction.length();
  if (distance <= 0.1) return [];

  raycaster.set(camera.position, direction.normalize());
  raycaster.near = 0;
  raycaster.far = Math.max(0, distance - 0.08);
  const faded = new Set(
    raycaster.intersectObjects(meshes, false).map((intersection) => intersection.object),
  );
  for (const mesh of faded) setFaded(mesh, true, fadedOpacity);
  return [...faded];
}

export function disposeWallFadeMaterials(mesh) {
  for (const state of mesh?.userData.wallFadeMaterials ?? []) state.material.dispose();
  if (mesh?.userData) delete mesh.userData.wallFadeMaterials;
}
