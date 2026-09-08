export default `// ⭐ Collect a Coin
// Walk into the gold coin. It knows you are the player!

const player = getPlayer();
console.log("Is this the player?", player.isPlayer());

player.setSettings({
    walkSpeed: 8,
    jumpForce: 10
});

const coin = createGoldCoin({
    position: [0, 1, 2]
});

coin.onCollision((other) => {
    if (other && other.isPlayer()) {
        coin.destroy();
        print("⭐ Coin collected!");
    }
});

print("Walk forward into the gold coin!");
`;
