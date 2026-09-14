export default `// 🌪 Typhoon
// playTyphoon() starts a water tornado. Press T for another after you click the 3D world.

print("Typhoon incoming! Press T for another.");

playTyphoon({
    position: [0, 0, -8],
    duration: 8,
    radius: 1
});

onKeyPressed("KeyT", () => {
    playTyphoon();
});
`;
