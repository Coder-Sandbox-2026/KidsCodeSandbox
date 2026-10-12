import * as THREE from 'three';

const UI_TARGET = 'input, textarea, select, button, [contenteditable], .monaco-editor, dialog, [role=combobox], [role=menu]';
const FACING_COSINE = Math.cos(Math.PI / 4);
export const INTERACTION_KEY_CODE = 'KeyP';
export const INTERACTION_KEY_LABEL = 'P';

function containsPoint(bounds, point) {
  return point.x >= bounds.minX && point.x <= bounds.maxX
    && point.y >= bounds.minY && point.y <= bounds.maxY
    && point.z >= bounds.minZ && point.z <= bounds.maxZ;
}

/** Small, reusable trigger + facing interaction selector for authored volumes. */
export class InteractionSystem {
  constructor({ getPlayer, isActive, promptHost }) {
    this.getPlayer = getPlayer;
    this.isActive = isActive;
    this.entries = [];
    this.current = null;
    this.prompt = null;
    this._messageTimer = null;
    this._lastMessage = '';
    this._targetPosition = new THREE.Vector3();

    if (promptHost && typeof document !== 'undefined') {
      this.prompt = document.createElement('div');
      this.prompt.className = 'level-interaction-prompt hidden';
      this.prompt.setAttribute('aria-live', 'polite');
      promptHost.appendChild(this.prompt);
    }

    this._onKeyDown = event => {
      if (event.code !== INTERACTION_KEY_CODE || event.repeat || !this.isActive()) return;
      if (event.target?.closest?.(UI_TARGET) || document.activeElement?.closest?.(UI_TARGET)) return;
      const player = this.getPlayer();
      if (!player?.input?.active || !this.current) return;
      const entry = this.current;
      if (entry.isAvailable && !entry.isAvailable()) {
        this.current = null;
        this._hidePrompt();
        return;
      }
      event.preventDefault();
      const handled = entry.onInteract?.();
      if (handled !== false) {
        this.current = null;
        this._hidePrompt();
      }
    };
    if (typeof document !== 'undefined') document.addEventListener('keydown', this._onKeyDown);
  }

  register(entry) {
    this.entries.push(entry);
    return entry;
  }

  update() {
    const player = this.getPlayer();
    if (!this.isActive() || !player?.input?.active) {
      this.current = null;
      this._hidePrompt();
      return;
    }

    const position = player.position;
    const direction = player.getPlayerDirection();
    let nearest = null;
    let nearestDistance = Infinity;

    for (const entry of this.entries) {
      if (entry.isAvailable && !entry.isAvailable()) continue;
      if (!containsPoint(entry.bounds, position)) continue;

      const objectPosition = entry.object.getWorldPosition(this._targetPosition);
      const dx = objectPosition.x - position.x;
      const dz = objectPosition.z - position.z;
      const horizontalDistance = Math.hypot(dx, dz);
      const facing = horizontalDistance > 1e-6
        ? (direction[0] * dx + direction[2] * dz) / horizontalDistance
        : 1;
      if (facing < FACING_COSINE) continue;

      const distance = dx * dx + (objectPosition.y - position.y) ** 2 + dz * dz;
      if (distance < nearestDistance) {
        nearest = entry;
        nearestDistance = distance;
      }
    }

    this.current = nearest;
    if (this._messageTimer) return;
    if (nearest) this._showPrompt(typeof nearest.label === 'function'
      ? nearest.label()
      : (nearest.label ?? `${INTERACTION_KEY_LABEL} Interact`));
    else this._hidePrompt();
  }

  
_showPrompt(text) {
  if (!this.prompt) return;

  this.prompt.replaceChildren();

  const label = String(text ?? '');
  const keyMatch = label.match(
    new RegExp(`^(${INTERACTION_KEY_LABEL})(\\s+.*)$`)
  );

  if (keyMatch) {
    const key = document.createElement('span');
    key.className = 'interaction-keycap';
    key.textContent = INTERACTION_KEY_LABEL;

    this.prompt.append(
      key,
      document.createTextNode(keyMatch[2])
    );
  } else {
    this.prompt.textContent = label;
  }

  this.prompt.classList.remove('hidden');
}


  _hidePrompt() {
    this.prompt?.classList.add('hidden');
  }

  /** Show a short interaction message without stacking duplicate rapid notices. */
  notify(message, duration = 1000) {
    if (!this.prompt || (this._lastMessage === message && this._messageTimer)) return;
    this._lastMessage = message;
    clearTimeout(this._messageTimer);
    this.prompt.textContent = message;
    this.prompt.classList.remove('hidden');
    this._messageTimer = setTimeout(() => {
      this._messageTimer = null;
      this._lastMessage = '';
      if (this.current) this._showPrompt(typeof this.current.label === 'function'
        ? this.current.label()
        : this.current.label);
      else this._hidePrompt();
    }, duration);
  }

  dispose() {
    if (typeof document !== 'undefined') document.removeEventListener('keydown', this._onKeyDown);
    this.entries = [];
    this.current = null;
    clearTimeout(this._messageTimer);
    this._messageTimer = null;
    this.prompt?.remove();
    this.prompt = null;
  }
}

export function boundsFromPart(part, root = null) {
  const bounds = {
    minX: Infinity, minY: Infinity, minZ: Infinity,
    maxX: -Infinity, maxY: -Infinity, maxZ: -Infinity,
  };
  const matrix = root?.matrixWorld;
  const rotation = part.rotation
    ? new THREE.Quaternion().fromArray(part.rotation)
    : null;
  const point = new THREE.Vector3();
  for (const x of [-1, 1]) {
    for (const y of [-1, 1]) {
      for (const z of [-1, 1]) {
        point.set(part.tx + x * part.hx, part.ty + y * part.hy, part.tz + z * part.hz);
        if (rotation) {
          point.sub(new THREE.Vector3(part.tx, part.ty, part.tz))
            .applyQuaternion(rotation)
            .add(new THREE.Vector3(part.tx, part.ty, part.tz));
        }
        if (matrix) point.applyMatrix4(matrix);
        bounds.minX = Math.min(bounds.minX, point.x);
        bounds.minY = Math.min(bounds.minY, point.y);
        bounds.minZ = Math.min(bounds.minZ, point.z);
        bounds.maxX = Math.max(bounds.maxX, point.x);
        bounds.maxY = Math.max(bounds.maxY, point.y);
        bounds.maxZ = Math.max(bounds.maxZ, point.z);
      }
    }
  }
  return bounds;
}
