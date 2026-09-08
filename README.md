# 🎮 Kids Code 3D

A browser-based JavaScript programming environment for teaching young children to code by creating simple 3D games.

## Quick Start

<<<<<<< HEAD
=======
### Play without a server (recommended for kids' PCs)

You cannot open the project `index.html` directly — browsers block JavaScript modules on `file://` (the CORS error you may have seen).

Build once on a computer that has Node.js (not Python):

```bash
npm install
npm run build
```

Then double-click **`KidsCode3D.html`** in this folder. That file is a single self-contained page. Copy it to any PC and open it in a browser — no Python, Node, or local server needed.

### Develop with live reload

Double-click **`start.bat`** (Windows). That starts the local server and opens `index.html` in your browser. Leave the black window open while you work.

Or from a terminal:

```bash
npm install
npm start
```

`npm start` and `start.bat` both run Vite and open http://localhost:5173/index.html.

```bash
npm run dev
```

starts the same server without opening a browser. This uses Node's Vite dev server, not Python.

### GitHub Pages

The `offline/` folder is not used. GitHub builds from the repo root (`package.json` + `package-lock.json`).

1. Push this project to GitHub (branch `main`).
2. In the repo: **Settings → Pages → Source → GitHub Actions**.
3. Each push to `main` runs `.github/workflows/pages.yml`: `npm ci`, tests, `npm run build`, then publishes `dist/`.

The live site will be `https://YOUR_USER.github.io/YOUR_REPO/`.


## How It Works

- **Left panel**: Monaco code editor with JavaScript syntax highlighting and autocomplete
- **Right panel**: 3D game world powered by Three.js + Rapier physics
- Write JavaScript, click **▶ Run**, and see objects appear in the 3D world
- Walk around with WASD, look with mouse, jump with Space/Click

## Kid-Friendly API

### Create Shapes
```javascript
createCube({ position: [0, 5, -5], color: "red", physics: true })
createSphere({ position: [0, 3, -5], color: "blue" })
createCone({ position: [2, 3, -5], color: "green" })
createCylinder({ position: [-2, 3, -5], color: "yellow" })
createPlane({ color: "white" })
createGoldCoin({ position: [0, 1, 2] })
createCake({ position: [2, 1, 2] })
```

### Modify Objects
```javascript
const cube = createCube();
cube.position.set(0, 3, -5);
cube.color = "red";              // or cube.setColor("red")
cube.scale.set(2, 2, 2);        // or cube.setScale(2, 2, 2)
cube.rotate(0, 45, 0);          // degrees
cube.enablePhysics();
cube.enableCollision();          // notice touches without falling
cube.disableCollision();
cube.destroy();
```

### Animation
```javascript
const cube = createCube({ position: [0, 3, -5], color: "purple" });
update((dt) => {
    cube.rotation.y += 0.02;
});
```

### Screen Text
```javascript
print("Hello World!");
setText("score", "Score: 10", { x: 20, y: 20 });
clearText();
```

### Utilities
```javascript
random(0, 10)                    // random number
distance(objA, objB)             // distance between objects
destroy(obj)                     // remove object
findObject("name")               // find by name
getPlayer()                      // the player you walk around as
wait(1000)                       // await wait(1000)
isKeyDown("Space")               // check key state
onKeyDown("KeyE", () => { })     // while the key is down (can repeat)
onKeyPressed("KeyE", () => { })  // once when the key is first pressed
onKeyReleased("KeyE", () => { }) // when the key is let go
```

### Click Events
```javascript
const cube = createCube();

function handleClick(event) {
    cube.color = "red";
    print(event.point);
}

cube.onClick(handleClick);
```

### Collision Events
```javascript
const coin = createGoldCoin({ position: [0, 1, 2] });

coin.onCollision((other) => {
    if (other && other.isPlayer()) {
        coin.destroy();
        print("You got a coin!");
    }
});

const cube = createCube({ position: [0, 5, -5], color: "blue", physics: true });
cube.onCollision((other) => {
    cube.color = "red";
});

const player = getPlayer();
player.setWalkSpeed(8);
player.setSettings({ jumpForce: 12, gravity: 20 });
```

Physics (falling / being pushed) and collision detection (noticing a touch) are separate:

```javascript
coin.enableCollision();   // detect touches, do not fall
coin.disableCollision();
coin.enablePhysics();     // fall, bounce, and become solid
coin.disablePhysics();    // stop falling; detection stays if you enabled it
```

## Architecture

```
src/
├── main.js                  # Entry point, wires everything together
├── editor/
│   ├── EditorManager.js     # Monaco Editor setup
│   ├── AutocompleteProvider.js  # Custom API autocomplete + hover docs
│   └── ErrorHandler.js      # Friendly error messages for kids
├── engine/
│   ├── GameEngine.js        # Main orchestrator + render loop
│   ├── SceneManager.js      # Three.js scene, camera, sky, lighting
│   ├── Renderer.js          # WebGL renderer + bloom post-processing
│   ├── PhysicsManager.js    # Rapier physics world + sync
│   ├── collisionMeshes.js   # COL_* solid + ITEM_* detect-only helpers
│   ├── ModelLoader.js       # Preload / clone GLB models
│   ├── Actor.js             # Shared identity for GameObject and Player
│   ├── InputSystem.js       # Keyboard / mouse input for controllers
│   ├── FirstPersonMovementController.js
│   ├── FirstPersonCameraController.js
│   ├── playerSettings.js    # Walk / jump / gravity settings + validation
│   └── DefaultLevel.js      # Playground: ground, platforms, ramps, objects
├── api/
│   ├── GameAPI.js           # Global API injected into user code
│   ├── ShapeFactory.js      # createCube/Sphere/Cone/Cylinder/Plane
│   ├── ModelFactory.js      # createGoldCoin / createCake GLB models
│   ├── GameObject.js        # Wrapper: Three.js mesh + Rapier body
│   ├── Player.js            # First-class player actor + settings API
│   └── HUD.js              # Screen text overlay
├── assets/                  # Local 3D files (temporary debug source)
│   ├── assetSource.js       # Relative GLB + Basis decoder URLs (GitHub Pages-safe)
│   └── model/goldCoin.glb, Cake.glb
├── examples/                # Example code snippets
└── styles/
    └── main.css
```

## Adding New Helper Functions

1. Add the function to `src/api/GameAPI.js` in the `buildScope()` method
2. Add autocomplete entry in `src/editor/AutocompleteProvider.js`
3. The function will be available globally in the child's code
>>>>>>> 5d9da8c (Fix GitHub Pages build)
