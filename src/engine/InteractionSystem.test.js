import test from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from 'three';
import { InteractionSystem } from './InteractionSystem.js';

function fakeElement() {
  return {
    className: '', textContent: '', children: [],
    classList: { add() {}, remove() {} },
    setAttribute() {},
    appendChild(child) { this.children.push(child); },
    append(...children) { this.children.push(...children); },
    replaceChildren(...children) { this.children = children; },
    remove() {},
  };
}

test('door interaction only targets closed doors and uses P', () => {
  const previousDocument = globalThis.document;
  const listeners = new Map();
  globalThis.document = {
    activeElement: { closest: () => null },
    createElement: fakeElement,
    createTextNode: text => ({ textContent: text }),
    addEventListener: (type, handler) => listeners.set(type, handler),
    removeEventListener: () => {},
  };

  const door = { target: 0, value: 0 };
  const player = {
    position: new THREE.Vector3(0, 0, 0),
    input: { active: true },
    getPlayerDirection: () => [0, 0, -1],
  };
  const system = new InteractionSystem({
    getPlayer: () => player,
    isActive: () => true,
    promptHost: fakeElement(),
  });
  system.register({
    bounds: { minX: -1, maxX: 1, minY: -1, maxY: 1, minZ: -2, maxZ: 1 },
    object: new THREE.Object3D(),
    label: 'P Open Door',
    isAvailable: () => door.target === 0 && door.value === 0,
    onInteract: () => { door.target = 1; return true; },
  });

  system.update();
  assert.ok(system.current);
  let prevented = false;
  listeners.get('keydown')({
    code: 'KeyI', repeat: false, target: { closest: () => null }, preventDefault: () => { prevented = true; },
  });
  assert.equal(door.target, 0);
  assert.equal(prevented, false);

  listeners.get('keydown')({
    code: 'KeyP', repeat: false, target: { closest: () => null }, preventDefault: () => { prevented = true; },
  });
  assert.equal(door.target, 1);
  assert.equal(prevented, true);
  assert.equal(system.current, null);

  system.update();
  assert.equal(system.current, null);
  door.target = 0;
  door.value = 0;
  system.update();
  assert.ok(system.current);
  system.dispose();
  globalThis.document = previousDocument;
});
