import test from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from 'three';
import { PlayerCaughtSequence, PLAYER_CAUGHT_STATES } from './PlayerCaughtSequence.js';

test('PlayerCaughtSequence guards duplicate starts, locks input, tracks the drone, and finishes once', () => {
  const camera = new THREE.PerspectiveCamera();
  const root = new THREE.Group();
  root.position.set(0, 1.4, 4);
  root.updateMatrixWorld(true);
  let enabled = true;
  let cleared = 0;
  let stopped = 0;
  let ended = 0;
  let audioStarted = 0;
  let audioFinished = 0;
  const engine = {
    camera,
    player: {
      position: new THREE.Vector3(0, 1.4, 0),
      input: { clear: () => { cleared += 1; } },
      cameraController: { eyeHeight: 0.8, yaw: 0, pitch: 0 },
      setEnabled(value) { enabled = value; },
    },
    audio: {
      beginCaughtAudio() { audioStarted += 1; },
      finishCaughtAudio() { audioFinished += 1; return 0; },
      endCaughtAudio() {},
    },
    stop() { stopped += 1; },
  };
  const drone = {
    root,
    config: {
      caughtCameraRotationDuration: 0.1,
      caughtRedEffectDuration: 0.25,
      caughtRedFadeInDuration: 0.1,
      caughtRedFadeOutDuration: 0.1,
      caughtDroneTrackingSpeed: 5,
    },
    beginCaughtSequence: () => true,
    updateCaughtSequencePose() { root.lookAt(engine.player.position); },
    endCaughtSequence() { ended += 1; },
  };
  const sequence = new PlayerCaughtSequence({ engine });

  assert.equal(sequence.start(drone), true);
  assert.equal(sequence.start(drone), false);
  assert.equal(sequence.state, PLAYER_CAUGHT_STATES.CAUGHT_CAMERA_LOCK);
  assert.equal(enabled, false);
  assert.equal(cleared, 1);

  sequence.update(0.1);
  assert.equal(sequence.state, PLAYER_CAUGHT_STATES.CAUGHT_SCREEN_EFFECT);
  sequence.update(0.05);
  assert.equal(sequence.state, PLAYER_CAUGHT_STATES.CAUGHT_SCREEN_EFFECT);
  sequence.update(0.1);
  assert.equal(sequence.state, PLAYER_CAUGHT_STATES.CAUGHT_SCREEN_EFFECT);
  sequence.update(0.1);
  assert.equal(sequence.state, PLAYER_CAUGHT_STATES.CAUGHT_GAME_OVER);
  assert.equal(stopped, 1);
  assert.equal(audioStarted, 1);
  assert.equal(audioFinished, 1);
  assert.ok(Math.abs(engine.player.cameraController.yaw) > 0.01);

  sequence.cancel({ restorePlayer: false });
  assert.equal(sequence.state, PLAYER_CAUGHT_STATES.PLAYING);
  assert.equal(ended, 1);
});
