import { MovingObject } from './MovingObject.js';

/** Shared scripted door behavior. Movement and its persistent collider remain in MovingObject. */
export class Door extends MovingObject {
  constructor(options = {}) {
    super(options);
    this._locked = options.locked === true;
  }

  get locked() {
    return this._locked;
  }

  /** Change only the lock state; never changes the door pose or animation. */
  lockDoor(locked) {
    if (typeof locked !== 'boolean') {
      throw new TypeError('lockDoor() expects true or false.');
    }
    this._locked = locked;
    return this;
  }
}
