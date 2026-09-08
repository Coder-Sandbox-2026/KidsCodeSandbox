export default `// 🏗 Build a Tower
// Stack 10 cubes on top of each other!

for (let i = 0; i < 10; i++) {
    createCube({
        position: [0, i * 1.1 + 1, -5],
        physics: true,
        color: "orange"
    });
}

print("I built a tower! Try pushing it over!");
`;
