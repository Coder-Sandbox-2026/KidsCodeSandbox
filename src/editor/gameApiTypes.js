/**
 * Type declarations injected into Monaco so createCube, print, etc. get
 * IntelliSense, hover docs, and parameter hints.
 */
export const GAME_API_DTS = `
/** Options for creating a 3D shape. */
interface ShapeOptions {
  /** Position in the world, like [0, 3, -5] */
  position?: [number, number, number] | number[];
  /** Size, like [2, 2, 2] or a single number */
  scale?: [number, number, number] | number[] | number;
  /** CSS name ("red") or hex ("#ff0000") */
  color?: string;
  /** If true, the object falls and can be pushed */
  physics?: boolean;
  /**
   * If true, the object notices when something touches it.
   * This does not make it fall. Collectibles (coins, cake) default to true.
   */
  collision?: boolean;
  mass?: number;
  name?: string;
  bounciness?: number;
  friction?: number;
}

interface Vec3 {
  x: number;
  y: number;
  z: number;
  set(x: number, y: number, z: number): void;
}

interface ClickEvent {
  gameObject: GameObject;
  point: Vec3;
  distance: number;
  object: any;
}

interface PlayerSettings {
  walkSpeed?: number;
  jumpForce?: number;
  gravity?: number;
  airControl?: number;
  maxFallSpeed?: number;
  acceleration?: number;
  deceleration?: number;
  jumpCount?: number;
  movementEnabled?: boolean;
}

/** Shared identity for things in the game (shapes and the player). */
interface Actor {
  position: Vec3;
  name: string;
  /** True only for the active player. */
  isPlayer(): boolean;
  /**
   * Runs when this actor starts touching something.
   * other is the player, another object, or null for the ground / level.
   */
  onCollision(fn: (other: Actor | null) => void): this;
}

interface GameObject extends Actor {
  rotation: Vec3;
  scale: Vec3;
  color: string;
  mass: number;
  bounciness: number;
  friction: number;
  /** True when this object falls and can be pushed */
  physicsEnabled: boolean;
  /** True when this object notices touches (even if it does not fall) */
  collisionEnabled: boolean;
  setColor(color: string): GameObject;
  setScale(x: number, y?: number, z?: number): GameObject;
  /** Rotate in degrees */
  rotate(x: number, y: number, z: number): GameObject;
  enablePhysics(opts?: { mass?: number; bounciness?: number; friction?: number }): GameObject;
  disablePhysics(): GameObject;
  setPhysics(opts: { enabled?: boolean; mass?: number; bounciness?: number; friction?: number } | boolean): GameObject;
  /** Notice when something touches this object, without making it fall */
  enableCollision(): GameObject;
  disableCollision(): GameObject;
  setCollision(opts: { enabled?: boolean } | boolean): GameObject;
  destroy(): void;
  onClick(fn: (event: ClickEvent) => void): GameObject;
}

interface Player extends Actor {
  isGrounded(): boolean;
  setSettings(settings: PlayerSettings): Player;
  getSettings(): PlayerSettings;
  setWalkSpeed(speed: number): Player;
  getWalkSpeed(): number;
  setJumpForce(force: number): Player;
  getJumpForce(): number;
  setGravity(gravity: number): Player;
  getGravity(): number;
  setAirControl(value: number): Player;
  getAirControl(): number;
  setMaxFallSpeed(speed: number): Player;
  getMaxFallSpeed(): number;
  setAcceleration(value: number): Player;
  getAcceleration(): number;
  setDeceleration(value: number): Player;
  getDeceleration(): number;
  setJumpCount(count: number): Player;
  getJumpCount(): number;
  setMovementEnabled(enabled: boolean): Player;
  getMovementEnabled(): boolean;
}

interface PrintOptions {
  x?: number;
  y?: number;
  color?: string;
  size?: number;
  /** Seconds on screen. Default 10. Use 0 to keep forever. */
  duration?: number;
}

declare function createCube(options?: ShapeOptions): GameObject;
declare function createSphere(options?: ShapeOptions): GameObject;
declare function createCone(options?: ShapeOptions): GameObject;
declare function createCylinder(options?: ShapeOptions): GameObject;
declare function createPlane(options?: ShapeOptions): GameObject;
declare function createGoldCoin(options?: ShapeOptions): GameObject;
declare function createCake(options?: ShapeOptions): GameObject;

declare function print(text: string, options?: PrintOptions): void;
declare function setText(id: string, text: string, options?: PrintOptions): void;
declare function clearText(): void;

declare function update(callback: (deltaTime: number) => void): void;
declare function onUpdate(callback: (deltaTime: number) => void): void;

declare function wait(ms: number): Promise<void>;
declare function random(min?: number, max?: number): number;
declare function distance(a: GameObject | Vec3, b: GameObject | Vec3): number;
declare function destroy(object: GameObject): void;
declare function findObject(name: string): GameObject | null;
declare function getPlayer(): Player;

declare function isKeyDown(key: string): boolean;
declare function onKeyDown(key: string, callback: () => void): void;
declare function onKeyPressed(key: string, callback: () => void): void;
declare function onKeyReleased(key: string, callback: () => void): void;

/** Simple, safe console methods for the in-game Console panel. */
interface Console {
  log(...args: any[]): void;
  info(...args: any[]): void;
  debug(...args: any[]): void;
  warn(...args: any[]): void;
  error(...args: any[]): void;
  clear(): void;
  assert(ok: any, ...args: any[]): void;
  table(data: any): void;
  time(label?: string): void;
  timeLog(label?: string, ...args: any[]): void;
  timeEnd(label?: string): void;
  count(label?: string): void;
  countReset(label?: string): void;
  group(...args: any[]): void;
  groupCollapsed(...args: any[]): void;
  groupEnd(): void;
}

declare var console: Console;
`;
