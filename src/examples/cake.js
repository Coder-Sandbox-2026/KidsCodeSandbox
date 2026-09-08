export default `// 🎂 Collect a Cake
// Walk into the cake. It knows you are the player!

const player = getPlayer();
console.log("Is this the player?", player.isPlayer());

player.setSettings({
    walkSpeed: 8,
    jumpForce: 10
});

const cake = createCake({
    position: [0, 1, 2]
});

cake.onCollision((other) => {
    if (other && other.isPlayer()) {
        cake.destroy();
        print("🎂 Yum!");
    }
});

print("Walk forward into the cake!");
`;
