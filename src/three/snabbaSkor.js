// Presentation-only deformation. Contents, ownership and collision remain gameplay decisions.
export function setSnabbaSkorOpening(root, amount) {
  if (!Number.isFinite(amount)) throw new TypeError('Bag opening must be a finite number.');
  const value = Math.max(0, Math.min(1, amount));
  let affected = 0;
  root.traverse((node) => {
    const index = node.morphTargetDictionary?.SnabbaSkor_Open;
    if (index === undefined) return;
    node.morphTargetInfluences[index] = value;
    affected += 1;
  });
  if (affected) root.userData.opening = value;
  return affected;
}
