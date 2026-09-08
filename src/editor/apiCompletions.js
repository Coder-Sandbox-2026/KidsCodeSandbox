/**
 * Kid API completion metadata.
 *
 * Each item describes hover docs plus token-scoped Code Coach templates:
 *   off    — identifier only
 *   basic  — callable form with empty parentheses
 *   guided — useful syntax scaffold (args / callbacks)
 *   high   — most complete useful scaffold for that API
 *
 * These are API templates, not full-statement snippets.
 * "const player = getPlayer();" is a statement snippet and must not
 * be used as the normal getPlayer completion.
 */
export function call(name, guided, high = guided, extras = {}) {
  return { kind: 'token', off: name, basic: `${name}()`, guided, high, ...extras };
}

export function ident(name, assigned) {
  return {
    kind: 'token',
    off: name,
    basic: name,
    guided: assigned || name,
    high: assigned || name,
  };
}

/** Global API completions */
export const API_DOCS = [
  {
    label: 'createCube',
    kind: 'Function',
    detail: 'Create a cube in the game world',
    doc: 'createCube(options)\n\nCreates a cube.\n\nOptions: position, scale, color, physics, mass, name\n\nExample:\ncreateCube({ position: [0, 5, 0], color: "red" });',
    completion: call(
      'createCube',
      'createCube({\n\tposition: [0, 3, -5],\n\tcolor: "${1:red}"\n})',
      'createCube({\n\tposition: [0, 3, -5],\n\tcolor: "${1:red}",\n\tphysics: true\n})'
    ),
  },
  {
    label: 'createSphere',
    kind: 'Function',
    detail: 'Create a sphere in the game world',
    doc: 'createSphere(options)\n\nCreates a sphere.\n\nOptions: position, scale, color, physics, mass, name',
    completion: call(
      'createSphere',
      'createSphere({\n\tposition: [0, 3, -5],\n\tcolor: "${1:blue}"\n})',
      'createSphere({\n\tposition: [0, 3, -5],\n\tcolor: "${1:blue}",\n\tphysics: true\n})'
    ),
  },
  {
    label: 'createCone',
    kind: 'Function',
    detail: 'Create a cone',
    doc: 'createCone(options)',
    completion: call(
      'createCone',
      'createCone({\n\tposition: [0, 3, -5],\n\tcolor: "${1:green}"\n})',
      'createCone({\n\tposition: [0, 3, -5],\n\tcolor: "${1:green}",\n\tphysics: true\n})'
    ),
  },
  {
    label: 'createCylinder',
    kind: 'Function',
    detail: 'Create a cylinder',
    doc: 'createCylinder(options)',
    completion: call(
      'createCylinder',
      'createCylinder({\n\tposition: [0, 3, -5],\n\tcolor: "${1:yellow}"\n})',
      'createCylinder({\n\tposition: [0, 3, -5],\n\tcolor: "${1:yellow}",\n\tphysics: true\n})'
    ),
  },
  {
    label: 'createPlane',
    kind: 'Function',
    detail: 'Create a flat plane',
    doc: 'createPlane(options)',
    completion: call(
      'createPlane',
      'createPlane({\n\tposition: [0, 0, -5],\n\tcolor: "${1:white}"\n})',
      'createPlane({\n\tposition: [0, 0, -5],\n\tcolor: "${1:white}"\n})'
    ),
  },
  {
    label: 'createGoldCoin',
    kind: 'Function',
    detail: 'Place a gold coin you can collect',
    doc: 'createGoldCoin(options)\n\nPlaces a gold coin in the world.\nIt notices when the player touches it, but it does not fall\nor get pushed (unless you call enablePhysics()).\n\nOptions: position, scale, color, name, collision, physics\n\nExample:\nconst coin = createGoldCoin({ position: [0, 1, 2] });\ncoin.onCollision((other) => {\n  if (other && other.isPlayer()) {\n    coin.destroy();\n    print("You got a coin!");\n  }\n});',
    completion: call(
      'createGoldCoin',
      'createGoldCoin({\n\tposition: [0, 1, 2]\n})',
      'createGoldCoin({\n\tposition: [0, 1, 2]\n})'
    ),
  },
  {
    label: 'createCake',
    kind: 'Function',
    detail: 'Place a cake you can collect',
    doc: 'createCake(options)\n\nPlaces a cake in the world.\nIt notices when the player touches it, but it does not fall\nor get pushed (unless you call enablePhysics()).\n\nOptions: position, scale, color, name, collision, physics\n\nExample:\nconst cake = createCake({ position: [0, 1, 2] });\ncake.onCollision((other) => {\n  if (other && other.isPlayer()) {\n    cake.destroy();\n    print("Yum!");\n  }\n});',
    completion: call(
      'createCake',
      'createCake({\n\tposition: [0, 1, 2]\n})',
      'createCake({\n\tposition: [0, 1, 2]\n})'
    ),
  },
  {
    label: 'print',
    kind: 'Function',
    detail: 'Show text on screen',
    doc: 'print(text, options)\n\nShows text in the game for 10 seconds (then it disappears).\n\nOptions:\n  x, y     – screen position in pixels\n  color    – CSS color\n  size     – font size in pixels\n  duration – how many seconds to show (default 10)\n\nLines that share the same x and y stack together.\nWhen a line expires, the ones below it move up.\n\nprint("Hello!");\nprint("Stay longer", { duration: 30 });',
    completion: call('print', 'print("${1:Hello!}")'),
  },
  {
    label: 'setText',
    kind: 'Function',
    detail: 'Set named text on screen',
    doc: 'setText(id, text, options)',
    completion: call('setText', 'setText("${1:score}", "${2:Score: 0}")'),
  },
  {
    label: 'clearText',
    kind: 'Function',
    detail: 'Remove all screen text',
    doc: 'clearText()',
    completion: call('clearText', 'clearText()'),
  },
  {
    label: 'update',
    kind: 'Function',
    detail: 'Run code every frame',
    doc: 'update(callback)\n\nCalls your function every frame.\n\nExample:\nupdate((dt) => {\n  cube.rotation.y += 0.02;\n});',
    completion: call('update', 'update((${1:dt}) => {\n\t${0}\n})'),
  },
  {
    label: 'onUpdate',
    kind: 'Function',
    detail: 'Run code every frame (alias for update)',
    doc: 'onUpdate(callback)',
    completion: call('onUpdate', 'onUpdate((${1:dt}) => {\n\t${0}\n})'),
  },
  {
    label: 'wait',
    kind: 'Function',
    detail: 'Wait for milliseconds',
    doc: 'await wait(ms)\n\nPauses for the given number of milliseconds.',
    completion: call('wait', 'wait(${1:1000})', 'wait(${1:1000})', { leadingKeyword: 'await' }),
  },
  {
    label: 'random',
    kind: 'Function',
    detail: 'Random number between min and max',
    doc: 'random(min, max)',
    completion: call('random', 'random(${1:0}, ${2:10})'),
  },
  {
    label: 'distance',
    kind: 'Function',
    detail: 'Distance between two objects',
    doc: 'distance(a, b)',
    completion: call('distance', 'distance(${1:objectA}, ${2:objectB})'),
  },
  {
    label: 'destroy',
    kind: 'Function',
    detail: 'Remove an object from the world',
    doc: 'destroy(object)\n\nRemoves the object from the scene and physics.',
    completion: call('destroy', 'destroy(${1:object})'),
  },
  {
    label: 'findObject',
    kind: 'Function',
    detail: 'Find an object by name',
    doc: 'findObject(name)',
    completion: call('findObject', 'findObject("${1:name}")'),
  },
  {
    label: 'getPlayer',
    kind: 'Function',
    detail: 'Get the player you control',
    doc: 'getPlayer()\n\nReturns the player actor (the person you walk around as).\nUse this to change walk speed, jump, or check if you are on the ground.\n\nExample:\nconst player = getPlayer();\nplayer.setWalkSpeed(8);\nif (player.isGrounded()) {\n  print("Standing!");\n}',
    completion: call('getPlayer', 'getPlayer()'),
  },
  {
    label: 'isKeyDown',
    kind: 'Function',
    detail: 'Check if a key is pressed',
    doc: 'isKeyDown(keyCode)\n\nReturns true if the key is currently held down.',
    completion: call('isKeyDown', 'isKeyDown("${1:Space}")'),
  },
  {
    label: 'onKeyDown',
    kind: 'Function',
    detail: 'Run code when a key is held down',
    doc: 'onKeyDown(key, callback)\n\nRuns your function when the key is down.\nIf you hold the key, this can fire again (keyboard repeat).\n\nUse onKeyPressed if you want it to run only once.\n\nExample:\nonKeyDown("KeyE", () => {\n  print("E is down");\n});',
    completion: call('onKeyDown', 'onKeyDown("${1:KeyE}", () => {\n\t${0}\n})'),
  },
  {
    label: 'onKeyPressed',
    kind: 'Function',
    detail: 'Run code once when a key is first pressed',
    doc: 'onKeyPressed(key, callback)\n\nRuns your function once when the key is first pressed.\nIt does not keep firing while you hold the key.\n\nExample:\nonKeyPressed("KeyE", () => {\n  print("You pressed E!");\n});',
    completion: call('onKeyPressed', 'onKeyPressed("${1:KeyE}", () => {\n\t${0}\n})'),
  },
  {
    label: 'onKeyReleased',
    kind: 'Function',
    detail: 'Run code when a key is let go',
    doc: 'onKeyReleased(key, callback)\n\nRuns your function when you let go of the key.\n\nExample:\nonKeyReleased("KeyE", () => {\n  print("You let go of E!");\n});',
    completion: call('onKeyReleased', 'onKeyReleased("${1:KeyE}", () => {\n\t${0}\n})'),
  },
  {
    label: 'console',
    kind: 'Property',
    detail: 'Print a message in the Console panel',
    doc: 'console.log(message)\n\nSafe console methods:\n  log, info, debug, warn, error\n  clear, assert, table\n  time, timeLog, timeEnd\n  count, countReset\n  group, groupCollapsed, groupEnd',
    completion: ident('console'),
  },
];

/** Object member completions (shown after cube.) */
export const MEMBER_DOCS = [
  { label: 'position', kind: 'Property', detail: 'Object position (x, y, z)', completion: ident('position') },
  { label: 'rotation', kind: 'Property', detail: 'Object rotation (x, y, z)', completion: ident('rotation') },
  { label: 'scale', kind: 'Property', detail: 'Object scale (x, y, z)', completion: ident('scale') },
  { label: 'color', kind: 'Property', detail: 'Set object color', completion: ident('color', 'color = "${1:red}"') },
  { label: 'setColor', kind: 'Method', detail: 'Set object color', completion: call('setColor', 'setColor("${1:red}")') },
  { label: 'setScale', kind: 'Method', detail: 'Set object scale', completion: call('setScale', 'setScale(${1:1}, ${2:1}, ${3:1})') },
  { label: 'rotate', kind: 'Method', detail: 'Rotate by degrees', completion: call('rotate', 'rotate(${1:0}, ${2:45}, ${3:0})') },
  {
    label: 'enablePhysics',
    kind: 'Method',
    detail: 'Make this object fall and get pushed',
    doc: 'object.enablePhysics()\n\nTurns on gravity and momentum.\nThe object becomes solid (the player cannot walk through it).\nThis is separate from enableCollision().',
    completion: call('enablePhysics', 'enablePhysics()'),
  },
  {
    label: 'disablePhysics',
    kind: 'Method',
    detail: 'Stop falling and being pushed',
    doc: 'object.disablePhysics()\n\nTurns off gravity and momentum.\nCollision detection stays on if you already enabled it.',
    completion: call('disablePhysics', 'disablePhysics()'),
  },
  { label: 'setPhysics', kind: 'Method', detail: 'Configure physics', completion: call('setPhysics', 'setPhysics({ enabled: true })', 'setPhysics({ enabled: true, mass: ${1:1} })') },
  {
    label: 'enableCollision',
    kind: 'Method',
    detail: 'Notice when something touches this object',
    doc: 'object.enableCollision()\n\nStart noticing touches without making the object fall.\nThe player can walk through it (great for coins).\n\nExample:\ncoin.enableCollision();\ncoin.onCollision((other) => {\n  if (other && other.isPlayer()) coin.destroy();\n});',
    completion: call('enableCollision', 'enableCollision()'),
  },
  {
    label: 'disableCollision',
    kind: 'Method',
    detail: 'Stop noticing touches',
    completion: call('disableCollision', 'disableCollision()'),
  },
  {
    label: 'setCollision',
    kind: 'Method',
    detail: 'Turn collision detection on or off',
    completion: call('setCollision', 'setCollision({ enabled: true })', 'setCollision({ enabled: ${1:true} })'),
  },
  { label: 'physicsEnabled', kind: 'Property', detail: 'True if this object can fall', completion: ident('physicsEnabled') },
  { label: 'collisionEnabled', kind: 'Property', detail: 'True if this object notices touches', completion: ident('collisionEnabled') },
  { label: 'destroy', kind: 'Method', detail: 'Remove this object', completion: call('destroy', 'destroy()') },
  { label: 'name', kind: 'Property', detail: 'Object name', completion: ident('name') },
  { label: 'mass', kind: 'Property', detail: 'Object mass', completion: ident('mass', 'mass = ${1:1}') },
  { label: 'bounciness', kind: 'Property', detail: 'Object bounciness (0-1)', completion: ident('bounciness', 'bounciness = ${1:0.5}') },
  { label: 'friction', kind: 'Property', detail: 'Object friction (0-1)', completion: ident('friction', 'friction = ${1:0.5}') },
  {
    label: 'onClick',
    kind: 'Method',
    detail: 'Run code when this object is clicked',
    doc: 'object.onClick(callback)\n\nRuns your function when this object is clicked.\nThe callback receives an event with point, distance, and gameObject.\n\nExample:\ncube.onClick((event) => {\n  cube.color = "red";\n  print(event.point);\n});',
    completion: call('onClick', 'onClick((${1:event}) => {\n\t${0}\n})'),
  },
  {
    label: 'onCollision',
    kind: 'Method',
    detail: 'Run code when this object starts touching something',
    doc: 'object.onCollision(callback)\n\nRuns your function once when this object starts touching something.\nIt does not keep firing every frame while they stay touching.\n`other` is the thing you hit (use other.isPlayer() for the player),\nor null for the ground or level.\n\nThis turns on collision detection. It does NOT turn on gravity.\nCollectibles (coins, cake) already detect touches by default.\n\nExample:\ncoin.onCollision((other) => {\n  if (other && other.isPlayer()) {\n    coin.destroy();\n    print("You got the coin!");\n  }\n});',
    completion: call('onCollision', 'onCollision((${1:other}) => {\n\t${0}\n})'),
  },
  {
    label: 'isPlayer',
    kind: 'Method',
    detail: 'True if this is the player',
    doc: 'other.isPlayer()\n\nReturns true only for the player you control.\nUse this inside onCollision to detect player touches.\n\nExample:\nif (other.isPlayer()) {\n  print("The player touched me!");\n}',
    completion: call('isPlayer', 'isPlayer()'),
  },
];

/** Shown after player. */
export const PLAYER_DOCS = [
  { label: 'isPlayer', kind: 'Method', detail: 'True — this is the player', doc: 'player.isPlayer()\n\nReturns true only for the player you control.\n\nExample:\nconst player = getPlayer();\nconsole.log(player.isPlayer());', completion: call('isPlayer', 'isPlayer()') },
  { label: 'isGrounded', kind: 'Method', detail: 'True if standing on the ground', doc: 'player.isGrounded()\n\nReturns true when the player is standing on the ground\nor a platform.\n\nExample:\nif (player.isGrounded()) {\n  print("You are standing on the ground!");\n}', completion: call('isGrounded', 'isGrounded()') },
  { label: 'position', kind: 'Property', detail: 'Player position (x, y, z)', completion: ident('position') },
  { label: 'name', kind: 'Property', detail: 'Player name', completion: ident('name') },
  { label: 'onCollision', kind: 'Method', detail: 'Run code when the player starts touching something', doc: 'player.onCollision(callback)\n\nRuns once when the player starts touching an object.\n\nExample:\ngetPlayer().onCollision((other) => {\n  if (other) print("Bumped into something!");\n});', completion: call('onCollision', 'onCollision((${1:other}) => {\n\t${0}\n})') },
  { label: 'setWalkSpeed', kind: 'Method', detail: 'How fast the player walks', doc: 'player.setWalkSpeed(speed)\n\nChanges how fast the player walks.\n\nspeed — Walking speed. Must be 0 or greater.\n\nExample:\nplayer.setWalkSpeed(8);', completion: call('setWalkSpeed', 'setWalkSpeed(${1:8})') },
  { label: 'getWalkSpeed', kind: 'Method', detail: 'Read the walk speed', doc: 'player.getWalkSpeed()\n\nReturns the current walk speed.\n\nExample:\nconsole.log(player.getWalkSpeed());', completion: call('getWalkSpeed', 'getWalkSpeed()') },
  { label: 'setJumpForce', kind: 'Method', detail: 'How high the player jumps', doc: 'player.setJumpForce(force)\n\nChanges how strong the jump is.\n\nforce — Jump power. Must be 0 or greater.\n\nExample:\nplayer.setJumpForce(12);', completion: call('setJumpForce', 'setJumpForce(${1:12})') },
  { label: 'getJumpForce', kind: 'Method', detail: 'Read the jump force', doc: 'player.getJumpForce()\n\nReturns the current jump force.\n\nExample:\nconsole.log(player.getJumpForce());', completion: call('getJumpForce', 'getJumpForce()') },
  { label: 'setGravity', kind: 'Method', detail: 'How strongly the player is pulled down', doc: 'player.setGravity(gravity)\n\nChanges how fast the player falls.\nThis only affects the player, not other objects.\n\ngravity — Fall strength. Must be 0 or greater.\n\nExample:\nplayer.setGravity(20);', completion: call('setGravity', 'setGravity(${1:20})') },
  { label: 'getGravity', kind: 'Method', detail: 'Read player gravity', doc: 'player.getGravity()\n\nReturns the player gravity strength.\n\nExample:\nconsole.log(player.getGravity());', completion: call('getGravity', 'getGravity()') },
  { label: 'setAirControl', kind: 'Method', detail: 'How much you can steer in the air', doc: 'player.setAirControl(value)\n\nHow well you can steer while jumping (0 = none, 1 = full).\n\nExample:\nplayer.setAirControl(0.5);', completion: call('setAirControl', 'setAirControl(${1:1})') },
  { label: 'getAirControl', kind: 'Method', detail: 'Read air control', doc: 'player.getAirControl()\n\nReturns air control from 0 to 1.', completion: call('getAirControl', 'getAirControl()') },
  { label: 'setMaxFallSpeed', kind: 'Method', detail: 'Fastest the player can fall', doc: 'player.setMaxFallSpeed(speed)\n\nLimits how fast the player can fall.\n\nExample:\nplayer.setMaxFallSpeed(40);', completion: call('setMaxFallSpeed', 'setMaxFallSpeed(${1:40})') },
  { label: 'getMaxFallSpeed', kind: 'Method', detail: 'Read the max fall speed', doc: 'player.getMaxFallSpeed()\n\nReturns the maximum fall speed.', completion: call('getMaxFallSpeed', 'getMaxFallSpeed()') },
  { label: 'setAcceleration', kind: 'Method', detail: 'How quickly the player speeds up', doc: 'player.setAcceleration(value)\n\nHow quickly the player reaches walk speed.\nA very large number feels instant (the default).\n\nExample:\nplayer.setAcceleration(20);', completion: call('setAcceleration', 'setAcceleration(${1:20})') },
  { label: 'getAcceleration', kind: 'Method', detail: 'Read acceleration', doc: 'player.getAcceleration()\n\nReturns how quickly the player speeds up.', completion: call('getAcceleration', 'getAcceleration()') },
  { label: 'setDeceleration', kind: 'Method', detail: 'How quickly the player slows down', doc: 'player.setDeceleration(value)\n\nHow quickly the player stops when you let go of WASD.\n\nExample:\nplayer.setDeceleration(20);', completion: call('setDeceleration', 'setDeceleration(${1:20})') },
  { label: 'getDeceleration', kind: 'Method', detail: 'Read deceleration', doc: 'player.getDeceleration()\n\nReturns how quickly the player slows down.', completion: call('getDeceleration', 'getDeceleration()') },
  { label: 'setJumpCount', kind: 'Method', detail: 'How many jumps before landing', doc: 'player.setJumpCount(count)\n\nHow many times you can jump before you must land.\nUse 1 for a normal jump. Use 2 for a double jump.\n\nExample:\nplayer.setJumpCount(2);', completion: call('setJumpCount', 'setJumpCount(${1:1})') },
  { label: 'getJumpCount', kind: 'Method', detail: 'Read the jump count', doc: 'player.getJumpCount()\n\nReturns how many jumps you get before landing.', completion: call('getJumpCount', 'getJumpCount()') },
  { label: 'setMovementEnabled', kind: 'Method', detail: 'Turn walking and jumping on or off', doc: 'player.setMovementEnabled(enabled)\n\nSet false to freeze walking and jumping.\nLooking around still works.\n\nExample:\nplayer.setMovementEnabled(false);', completion: call('setMovementEnabled', 'setMovementEnabled(${1:true})') },
  { label: 'getMovementEnabled', kind: 'Method', detail: 'Is walking enabled?', doc: 'player.getMovementEnabled()\n\nReturns true if the player can walk and jump.', completion: call('getMovementEnabled', 'getMovementEnabled()') },
  {
    label: 'setSettings',
    kind: 'Method',
    detail: 'Change several player settings at once',
    doc: 'player.setSettings(settings)\n\nChange several player settings at once.\n\nExample:\nplayer.setSettings({\n  walkSpeed: 8,\n  jumpForce: 12,\n  gravity: 20\n});',
    completion: call(
      'setSettings',
      'setSettings({\n\twalkSpeed: ${1:8},\n\tjumpForce: ${2:12}\n})',
      'setSettings({\n\twalkSpeed: ${1:8},\n\tjumpForce: ${2:12},\n\tgravity: ${3:20}\n})'
    ),
  },
  { label: 'getSettings', kind: 'Method', detail: 'Read all player settings', doc: 'player.getSettings()\n\nReturns an object with the current player settings.\n\nExample:\nconsole.log(player.getSettings());', completion: call('getSettings', 'getSettings()') },
];

/** Shown after console. */
export const CONSOLE_DOCS = [
  { label: 'log', kind: 'Method', detail: 'Print a message', doc: 'console.log(message)\n\nWrites a message to the Console panel.', completion: call('log', 'log(${1:"Hello!"})') },
  { label: 'info', kind: 'Method', detail: 'Print an info message', doc: 'console.info(message)', completion: call('info', 'info(${1:"Hello!"})') },
  { label: 'debug', kind: 'Method', detail: 'Print a debug message', doc: 'console.debug(message)', completion: call('debug', 'debug(${1:"Hello!"})') },
  { label: 'warn', kind: 'Method', detail: 'Print a warning', doc: 'console.warn(message)', completion: call('warn', 'warn(${1:"Careful!"})') },
  { label: 'error', kind: 'Method', detail: 'Print an error', doc: 'console.error(message)', completion: call('error', 'error(${1:"Oops!"})') },
  { label: 'clear', kind: 'Method', detail: 'Clear the Console panel', doc: 'console.clear()', completion: call('clear', 'clear()') },
  { label: 'assert', kind: 'Method', detail: 'Warn if something is not true', doc: 'console.assert(ok, message)\n\nPrints an error only if ok is false.', completion: call('assert', 'assert(${1:true}, "${2:message}")') },
  { label: 'table', kind: 'Method', detail: 'Print a list or object as lines', doc: 'console.table(data)', completion: call('table', 'table(${1:data})') },
  { label: 'time', kind: 'Method', detail: 'Start a timer', doc: 'console.time(label)', completion: call('time', 'time("${1:default}")') },
  { label: 'timeLog', kind: 'Method', detail: 'Print how long a timer has run', doc: 'console.timeLog(label)', completion: call('timeLog', 'timeLog("${1:default}")') },
  { label: 'timeEnd', kind: 'Method', detail: 'Stop a timer and print the time', doc: 'console.timeEnd(label)', completion: call('timeEnd', 'timeEnd("${1:default}")') },
  { label: 'count', kind: 'Method', detail: 'Count how many times this ran', doc: 'console.count(label)', completion: call('count', 'count("${1:default}")') },
  { label: 'countReset', kind: 'Method', detail: 'Reset a counter', doc: 'console.countReset(label)', completion: call('countReset', 'countReset("${1:default}")') },
  { label: 'group', kind: 'Method', detail: 'Start an indented group', doc: 'console.group(title)', completion: call('group', 'group(${1:"Group"})') },
  { label: 'groupCollapsed', kind: 'Method', detail: 'Start an indented group', doc: 'console.groupCollapsed(title)', completion: call('groupCollapsed', 'groupCollapsed(${1:"Group"})') },
  { label: 'groupEnd', kind: 'Method', detail: 'End an indented group', doc: 'console.groupEnd()', completion: call('groupEnd', 'groupEnd()') },
];

export function findCompletion(label, catalog = API_DOCS) {
  const item = catalog.find((entry) => entry.label === label);
  if (!item) throw new Error(`Unknown API completion: ${label}`);
  return item;
}

export function findHoverEntry(word) {
  return API_DOCS.find((d) => d.label === word)
    || CONSOLE_DOCS.find((d) => d.label === word)
    || PLAYER_DOCS.find((d) => d.label === word)
    || MEMBER_DOCS.find((d) => d.label === word)
    || null;
}
