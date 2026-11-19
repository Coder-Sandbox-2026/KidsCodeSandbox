import * as THREE from 'three';
import { authoredAssociationKey } from './collisionMeshes.js';
import { Door } from './Door.js';
import { InteractionSystem, boundsFromPart, INTERACTION_KEY_LABEL } from './InteractionSystem.js';

const DOOR_COLORS = Object.freeze(['Red', 'Green', 'Yellow', 'Blue']);

/** Builds named GLTF doors and their player interactions for any stage. */
export class StageDoorSystem {
  constructor({ root, stageInteractionParts, physics, engine, isActive = () => true, promptHost = null } = {}) {
    this.root = root;
    this.physics = physics;
    this.engine = engine;
    this.doors = new Map();
    this.interactionSystem = null;
    this._promptHost = promptHost;
    this._onTestKeyDown = event => {
      if (event.code !== 'Digit1' || event.repeat || !isActive()) return;
      if (event.target?.closest?.('input, textarea, select, button, [contenteditable], .monaco-editor, dialog')) return;
      if (!this.engine?.player?.input?.active) return;
      let closed = false;
      for (const door of this.doors.values()) {
        closed = door.setOpen(false, moving => !moving.containsPlayerAtClosedPosition(this.engine.player)) || closed;
      }
      if (closed) event.preventDefault();
    };
    if (typeof document !== 'undefined') document.addEventListener('keydown', this._onTestKeyDown);

    for (const color of DOOR_COLORS) {
      this._buildDoor(color, stageInteractionParts, isActive);
    }
  }

  _buildDoor(color, stageInteractionParts, isActive) {
    const association = authoredAssociationKey(`Door${color}`);
    const triggerPart = stageInteractionParts?.find(part => part.role === 'trigger' && part.associationKey === association);
    const colliderPart = stageInteractionParts?.find(part => part.role === 'movcol' && part.associationKey === association);
    if (!triggerPart || !colliderPart) return;

    let doorObject = null;
    this.root?.traverse(object => {
      if (doorObject || object === this.root) return;
      if (authoredAssociationKey(object.name) !== colliderPart.associationKey) return;
      let hasVisibleMesh = false;
      object.traverse(child => { if (child.isMesh && child.visible) hasVisibleMesh = true; });
      if (hasVisibleMesh) doorObject = object;
    });
    if (!doorObject) return;

    this.root.updateMatrixWorld(true);
    const doorBounds = new THREE.Box3().setFromObject(doorObject);
    const floorY = colliderPart.ty - colliderPart.hy;
    const travelDistance = Math.max(colliderPart.hy * 2 + 0.25, doorBounds.max.y - floorY + 0.25);
    const door = new Door({
      physics: this.physics,
      object: doorObject,
      colliderPart,
      travel: new THREE.Vector3(0, -travelDistance, 0),
      locked: true,
      keyColor: color.toLowerCase(),
    });
    if (this.engine?.player?.movementController) {
      this.engine.player.movementController.contactDiagnosticEnabled = true;
    }
    this.doors.set(color.toLowerCase(), door);

    this.interactionSystem ??= new InteractionSystem({
      findPlayer: () => this.engine?.findPlayer?.() ?? this.engine?.player,
      isActive,
      promptHost: this._promptHost,
    });
    this.interactionSystem.register({
      bounds: boundsFromPart(triggerPart),
      object: doorObject,
      label: `${INTERACTION_KEY_LABEL} Open Door`,
      isAvailable: () => door.target === 0 && door.value === 0,
      onInteract: () => {
        if (door.target !== 0 || door.value !== 0) return false;
        if (door.locked) {
          this.interactionSystem.notify('This door is locked.');
          return false;
        }
        return door.setOpen(true);
      },
    });
  }

  update(dt) {
    for (const door of this.doors.values()) door.update(dt);
    this.interactionSystem?.update();
  }

  clear() {
    if (typeof document !== 'undefined') document.removeEventListener('keydown', this._onTestKeyDown);
    this.interactionSystem?.dispose();
    for (const door of this.doors.values()) door.dispose();
    if (this.engine?.player?.movementController) {
      this.engine.player.movementController.contactDiagnosticEnabled = false;
      this.engine.player.movementController.lastMovementContactSnapshot = null;
    }
    this.interactionSystem = null;
    this.doors.clear();
    this.root = null;
    this.engine = null;
    this.physics = null;
  }
}
