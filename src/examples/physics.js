export default `// 🧱 Falling Objects
// Watch 10 cubes rain from the sky!

for (let i = 0; i < 10; i++) {
    createCube({
        position: [
            random(-5, 5),
            10 + i * 2,
            random(-8, -3)
        ],
        color: "blue",
        physics: true
    });
}

print("Look up! Cubes are falling!");
`;
