export default `// 🔄 Spinning Object
const cube = createCube({
    position: [0, 3, -5],
    color: "purple"
});

update(() => {
    cube.rotation.y += 0.02;
});

print("The cube is spinning!");
`;
