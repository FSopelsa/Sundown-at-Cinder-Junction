import * as THREE from 'three';
import { getMapWorldBounds } from './coordinates.js';

const MIN_DISTANCE = 9;
const MAX_DISTANCE = 44;

export class TacticalCamera {
  constructor(camera, domElement, map, hudRoot) {
    this.camera = camera;
    this.domElement = domElement;
    this.target = new THREE.Vector3();
    this.azimuth = -0.62;
    this.elevation = 0.72;
    this.distance = 24;
    this.drag = null;
    this.keys = new Set();
    this.map = map;
    this.onPointerDown = this.onPointerDown.bind(this);
    this.onPointerMove = this.onPointerMove.bind(this);
    this.onPointerUp = this.onPointerUp.bind(this);
    this.onWheel = this.onWheel.bind(this);
    this.onKeyDown = this.onKeyDown.bind(this);
    this.onKeyUp = this.onKeyUp.bind(this);
    this.onContextMenu = (event) => event.preventDefault();
    domElement.addEventListener('pointerdown', this.onPointerDown);
    window.addEventListener('pointermove', this.onPointerMove);
    window.addEventListener('pointerup', this.onPointerUp);
    domElement.addEventListener('wheel', this.onWheel, { passive: false });
    domElement.addEventListener('contextmenu', this.onContextMenu);
    window.addEventListener('keydown', this.onKeyDown);
    window.addEventListener('keyup', this.onKeyUp);
    this.createToolbar(hudRoot);
    this.overview(map);
  }

  createToolbar(hudRoot) {
    this.toolbar = document.createElement('nav');
    this.toolbar.className = 'camera-controls';
    this.toolbar.setAttribute('aria-label', '3D battlefield camera');
    this.toolbar.innerHTML = '<button data-camera="out" title="Zoom out">−</button><button data-camera="reset">Overview</button><button data-camera="in" title="Zoom in">+</button><button data-camera="left" aria-label="Pan left">←</button><button data-camera="up" aria-label="Pan up">↑</button><button data-camera="down" aria-label="Pan down">↓</button><button data-camera="right" aria-label="Pan right">→</button><small>Wheel: zoom · arrows or right-drag: pan</small>';
    this.onToolbarClick = (event) => {
      const action = event.target.closest('[data-camera]')?.dataset.camera;
      if (!action) return;
      if (action === 'reset') this.overview(this.map);
      if (action === 'in') this.zoom(0.8);
      if (action === 'out') this.zoom(1.25);
      const step = this.distance * 0.10;
      if (action === 'left') this.pan(-step, 0);
      if (action === 'right') this.pan(step, 0);
      if (action === 'up') this.pan(0, -step);
      if (action === 'down') this.pan(0, step);
    };
    this.toolbar.addEventListener('click', this.onToolbarClick);
    hudRoot.append(this.toolbar);
  }

  setMap(map) {
    this.map = map;
    this.overview(map);
  }

  overview(map = this.map) {
    const bounds = getMapWorldBounds(map);
    const spanX = bounds.maxX - bounds.minX;
    const spanZ = bounds.maxZ - bounds.minZ;
    this.target.set((bounds.minX + bounds.maxX) / 2, 0, (bounds.minZ + bounds.maxZ) / 2);
    const verticalFov = THREE.MathUtils.degToRad(this.camera.fov);
    this.distance = THREE.MathUtils.clamp(
      Math.max(spanZ / Math.tan(verticalFov / 2), spanX / (Math.tan(verticalFov / 2) * this.camera.aspect)) * 1.04,
      MIN_DISTANCE,
      MAX_DISTANCE,
    );
    this.updateCamera();
  }

  zoom(factor) {
    this.distance = THREE.MathUtils.clamp(this.distance * factor, MIN_DISTANCE, MAX_DISTANCE);
    this.updateCamera();
  }

  pan(horizontal, vertical) {
    const forward = new THREE.Vector3();
    this.camera.getWorldDirection(forward);
    forward.y = 0;
    forward.normalize();
    const right = new THREE.Vector3().crossVectors(forward, this.camera.up).normalize();
    this.target.addScaledVector(right, horizontal);
    this.target.addScaledVector(forward, vertical);
    this.updateCamera();
  }

  onPointerDown(event) {
    if (event.button !== 1 && event.button !== 2) return;
    this.drag = { x: event.clientX, y: event.clientY };
    this.domElement.setPointerCapture?.(event.pointerId);
  }

  onPointerMove(event) {
    if (!this.drag) return;
    const dx = event.clientX - this.drag.x;
    const dy = event.clientY - this.drag.y;
    this.drag = { x: event.clientX, y: event.clientY };
    const step = this.distance / Math.max(420, this.domElement.clientHeight);
    this.pan(-dx * step, dy * step);
  }

  onPointerUp() {
    this.drag = null;
  }

  onWheel(event) {
    event.preventDefault();
    this.zoom(Math.exp(event.deltaY * 0.0015));
  }

  onKeyDown(event) {
    if (/INPUT|SELECT|TEXTAREA/.test(event.target?.tagName)) return;
    if (['ArrowLeft', 'ArrowRight', 'ArrowUp', 'ArrowDown'].includes(event.key)) {
      event.preventDefault();
      this.keys.add(event.key);
    }
  }

  onKeyUp(event) {
    this.keys.delete(event.key);
  }

  update(deltaMs) {
    const step = Math.min(deltaMs, 50) * this.distance * 0.00085;
    if (this.keys.has('ArrowLeft')) this.pan(-step, 0);
    if (this.keys.has('ArrowRight')) this.pan(step, 0);
    if (this.keys.has('ArrowUp')) this.pan(0, -step);
    if (this.keys.has('ArrowDown')) this.pan(0, step);
  }

  updateCamera() {
    const horizontal = this.distance * Math.cos(this.elevation);
    this.camera.position.set(
      this.target.x + Math.sin(this.azimuth) * horizontal,
      this.target.y + Math.sin(this.elevation) * this.distance,
      this.target.z + Math.cos(this.azimuth) * horizontal,
    );
    this.camera.lookAt(this.target);
  }

  dispose() {
    this.domElement.removeEventListener('pointerdown', this.onPointerDown);
    window.removeEventListener('pointermove', this.onPointerMove);
    window.removeEventListener('pointerup', this.onPointerUp);
    this.domElement.removeEventListener('wheel', this.onWheel);
    this.domElement.removeEventListener('contextmenu', this.onContextMenu);
    window.removeEventListener('keydown', this.onKeyDown);
    window.removeEventListener('keyup', this.onKeyUp);
    this.toolbar?.removeEventListener('click', this.onToolbarClick);
    this.toolbar?.remove();
  }
}
