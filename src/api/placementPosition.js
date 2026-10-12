/** Placement only: explicit coordinates win; defaults use an unrounded snapshot. */
export function placementPosition(engine, explicit) {
  if (explicit !== undefined) return explicit;
  try {
    const player = engine.getPlayer?.();
    if (player && !player._destroyed) {
      const p = player.position;
      if (p && [p.x, p.y, p.z].every(Number.isFinite)) return [p.x, p.y, p.z];
    }
  } catch { /* Player/physics may not be initialized. */ }
  return [0, 0, 0];
}
