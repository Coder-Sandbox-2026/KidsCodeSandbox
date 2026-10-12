// Maximum velocity kick in world units/second, shared by bodies and player.
const BLAST_STRENGTH = 40;

function kick(position, center, radius) {
  const x = position.x - center.x, y = position.y - center.y, z = position.z - center.z;
  const distance = Math.hypot(x, y, z);
  if (distance > radius) return null;
  const strength = BLAST_STRENGTH * (1 - distance / radius);
  if (distance < 1e-6) return { x: 0, y: strength, z: 0 };
  return { x: x / distance * strength, y: y / distance * strength, z: z / distance * strength };
}

export function applyExplosionBlast(engine, center, radius) {
  if (!Number.isFinite(radius) || radius <= 0) return;
  for (const { body } of engine.physics?.bodies?.values() ?? []) {
    if (!body.isDynamic()) continue;
    const velocity = kick(body.translation(), center, radius);
    if (!velocity) continue;
    const mass = body.mass();
    body.applyImpulse({ x: velocity.x * mass, y: velocity.y * mass, z: velocity.z * mass }, true);
  }
  const player = engine.player;
  if (player?.body && player.movementController?.addKnockback) {
    const velocity = kick(player.body.translation(), center, radius);
    if (velocity) player.movementController.addKnockback(velocity);
  }
}
