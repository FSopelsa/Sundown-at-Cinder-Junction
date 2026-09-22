export function collectMotionParts(root) {
  const parts = [];
  root.traverse((node) => {
    const role = node.userData.motion_role;
    if (role) parts.push({ node, role, rest: node.rotation.clone() });
  });
  return parts;
}

export function animateAsset(parts, timeMs, moving = false) {
  for (const { node, role, rest } of parts) {
    const phase = /(?:_L|_FL|_BR)$/.test(role) ? 0 : Math.PI;
    if (role.startsWith('Motion_Leg') || role.startsWith('Motion_Arm')) {
      node.rotation.z = rest.z + (moving ? Math.sin(timeMs * 0.012 + phase) * 0.32 : 0);
    } else if (role.startsWith('Motion_Tendril')) {
      const index = Number(role.split('_').at(-1));
      node.rotation.x = rest.x + Math.sin(timeMs * 0.002 + index) * 0.075;
      node.rotation.z = rest.z + Math.cos(timeMs * 0.0025 + index) * 0.05;
    } else if (role === 'Motion_Core') {
      node.rotation.y = rest.y + timeMs * 0.00022;
    }
  }
}

export function headingFromTravel(dx, dz) {
  // Authored models face +X. Three.js positive yaw turns +X toward -Z.
  return Math.atan2(-dz, dx);
}
