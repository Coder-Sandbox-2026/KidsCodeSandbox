/**
 * FirstPersonCameraController.js – Mouse-look camera that follows an actor.
 * Swap this later for third-person / vehicle cameras without changing Player.
 */
const DEFAULT_SENSITIVITY = 0.002;

export class FirstPersonCameraController {
  constructor(camera, { eyeHeight = 0.8, sensitivity = DEFAULT_SENSITIVITY } = {}) {
    this.camera = camera;
    this.eyeHeight = eyeHeight;
    this.sensitivity = sensitivity;
    this.yaw = 0;
    this.pitch = 0;
  }

  /** Apply mouse look for this frame. */
  applyLook(lookDelta) {
    if (!lookDelta) return;
    this.yaw -= lookDelta.x * this.sensitivity;
    this.pitch -= lookDelta.y * this.sensitivity;
    this.pitch = Math.max(-Math.PI / 2 + 0.05, Math.min(Math.PI / 2 - 0.05, this.pitch));
  }

  /** Place the camera at the actor's eyes. `origin` is { x, y, z }. */
  applyToActor(origin) {
    this.camera.position.set(origin.x, origin.y + this.eyeHeight, origin.z);
    this.camera.rotation.set(this.pitch, this.yaw, 0, 'YXZ');
  }

  reset() {
    this.yaw = 0;
    this.pitch = 0;
  }
}
