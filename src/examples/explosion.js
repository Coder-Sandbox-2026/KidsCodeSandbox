export default `// 💥 Ember Explosion
// playExplosion() starts the ember VFX. Press E for another after you click the 3D world.

print("Ember explosion incoming! Press E for another.");

playExplosion({
    position: [0, 2, -8]
});

onKeyPressed("KeyE", () => {
    playExplosion();
});
`;
