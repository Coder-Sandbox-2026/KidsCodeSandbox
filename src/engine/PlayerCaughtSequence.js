import * as THREE from 'three';

export const PLAYER_CAUGHT_STATES = Object.freeze({
  PLAYING: 'PLAYING',
  CAUGHT_CAMERA_LOCK: 'CAUGHT_CAMERA_LOCK',
  CAUGHT_SCREEN_EFFECT: 'CAUGHT_SCREEN_EFFECT',
  CAUGHT_GAME_OVER: 'CAUGHT_GAME_OVER',
  RESTART: 'RESTART',
});

export const PLAYER_CAUGHT_CONFIG = Object.freeze({
  caughtCameraRotationDuration: 0.8,
  caughtRedEffectDuration: 4.0,
  caughtPostEffectDelay: 1.0,
  caughtRedFadeInDuration: 0.4,
  caughtRedFadeOutDuration: 0.4,
  caughtRedOverlayOpacity: 0.45,
  caughtDroneTrackingSpeed: 5.0,
  caughtSirenVolume: 0.8,
  caughtMusicVolumeMultiplier: 0.2,
  caughtDroneAudioMultiplier: 0.0,
  caughtAudioFadeDuration: 0.3,
});

/** Reusable, update-loop-driven cinematic sequence for NPC player detection. */
export class PlayerCaughtSequence {
  constructor({ engine, host = null, restart = null, config = {} } = {}) {
    this.engine = engine;
    this.host = host;
    this.restart = restart;
    this.config = { ...PLAYER_CAUGHT_CONFIG, ...config };
    this.state = PLAYER_CAUGHT_STATES.PLAYING;
    this.drone = null;
    this.elapsed = 0;
    this.pulseIndex = 0;
    this._popupTimer = null;
    this.overlay = null;
    this.dialog = null;
    this._cameraTarget = new THREE.Vector3();
    this._cameraTargetQuaternion = new THREE.Quaternion();
    this._lookMatrix = new THREE.Matrix4();
    this._up = new THREE.Vector3(0, 1, 0);
    this._euler = new THREE.Euler(0, 0, 0, 'YXZ');

    if (typeof document !== 'undefined') this._createDialog();
  }

  get active() { return this.state !== PLAYER_CAUGHT_STATES.PLAYING; }
  isActive() { return this.active; }

  start(drone) {
    if (this.active || !drone?.beginCaughtSequence?.()) return false;
    this.drone = drone;
    this.elapsed = 0;
    this.pulseIndex = 0;
    this.state = PLAYER_CAUGHT_STATES.CAUGHT_CAMERA_LOCK;
    this.engine?.player?.input?.clear?.();
    this.engine?.player?.setEnabled?.(false);
    return true;
  }

  update(dt = 0) {
    if (!this.active || !this.drone) return;
    const safeDt = Math.max(0, Number(dt) || 0);
    this._updateCameraAndDrone(safeDt);

    if (this.state === PLAYER_CAUGHT_STATES.CAUGHT_CAMERA_LOCK) {
      this.elapsed += safeDt;
      if (this.elapsed >= Math.max(0, Number(this._setting('caughtCameraRotationDuration')) || 0.8)) {
        this.elapsed = 0;
        this._showOverlay();
        this.engine?.audio?.beginCaughtAudio?.(this.drone?.config ?? this.config);
        this.state = PLAYER_CAUGHT_STATES.CAUGHT_SCREEN_EFFECT;
      }
    } else if (this.state === PLAYER_CAUGHT_STATES.CAUGHT_SCREEN_EFFECT) {
      this._updateOverlay(safeDt);
    }
  }

  cancel({ restorePlayer = true } = {}) {
    this.drone?.endCaughtSequence?.();
    this.drone = null;
    this._removeOverlay();
    this._closeDialog();
    if (this._popupTimer) clearTimeout(this._popupTimer);
    this._popupTimer = null;
    this.engine?.audio?.endCaughtAudio?.();
    if (restorePlayer && this.engine?.running) this.engine.player?.setEnabled?.(true);
    this.elapsed = 0;
    this.pulseIndex = 0;
    this.state = PLAYER_CAUGHT_STATES.PLAYING;
  }

  dispose() {
    this.cancel();
    this.dialog?.remove();
    this.dialog = null;
  }

  _setting(name) { return this.drone?.config?.[name] ?? this.config[name]; }

  _updateCameraAndDrone(dt) {
    this.drone.updateCaughtSequencePose?.(dt);
    const player = this.engine?.player;
    const camera = this.engine?.camera;
    const controller = player?.cameraController;
    if (!player || !camera || !controller) return;

    const playerPosition = player.position;
    camera.position.set(playerPosition.x, playerPosition.y + controller.eyeHeight, playerPosition.z);
    this._getDroneTarget(this._cameraTarget);
    this._lookMatrix.lookAt(camera.position, this._cameraTarget, this._up);
    this._cameraTargetQuaternion.setFromRotationMatrix(this._lookMatrix);
    const amount = 1 - Math.exp(-Math.max(0, dt) * 8);
    camera.quaternion.slerp(this._cameraTargetQuaternion, amount);
    this._euler.setFromQuaternion(camera.quaternion, 'YXZ');
    controller.yaw = this._euler.y;
    controller.pitch = this._euler.x;
  }

  _getDroneTarget(target) {
    let eye = null;
    this.drone?.root?.traverse?.(object => {
      if (eye) return;
      const name = String(object.userData?.name ?? object.name ?? '').trim().toLowerCase();
      if (name === 'eye_dronea') eye = object;
    });
    if (eye) return eye.getWorldPosition(target);
    this.drone?.root?.getWorldPosition(target);
    target.y += 0.35;
    return target;
  }

  _showOverlay() {
    if (this.overlay || typeof document === 'undefined') return;
    const overlay = document.createElement('div');
    overlay.className = 'player-caught-red-overlay';
    overlay.setAttribute('aria-hidden', 'true');
    overlay.style.opacity = '0';
    (this.host || this.engine?.container || document.body)?.appendChild(overlay);
    this.overlay = overlay;
  }

  _updateOverlay(dt) {
    if (!this.overlay) this._showOverlay();
    const fadeIn = Math.max(0, Number(this._setting('caughtRedFadeInDuration')) || 0.4);
    const fadeOut = Math.max(0, Number(this._setting('caughtRedFadeOutDuration')) || 0.4);
    const maxOpacity = Math.max(0, Math.min(1, Number(this._setting('caughtRedOverlayOpacity')) || 0.45));
    this.elapsed += dt;
    const effectDuration = Math.max(0, Number(this._setting('caughtRedEffectDuration')) || 4);
    if (this.elapsed >= effectDuration) {
      if (this.overlay) this.overlay.style.opacity = '0';
      this._finish();
      return;
    }
    const cycleDuration = fadeIn + fadeOut;
    const phase = cycleDuration > 1e-6 ? this.elapsed % cycleDuration : 0;
    const opacity = phase < fadeIn
      ? (fadeIn > 1e-6 ? phase / fadeIn : 1) * maxOpacity
      : (fadeOut > 1e-6 ? 1 - (phase - fadeIn) / fadeOut : 0) * maxOpacity;
    if (this.overlay) this.overlay.style.opacity = String(opacity);
  }

  _finish() {
    if (this.state !== PLAYER_CAUGHT_STATES.CAUGHT_SCREEN_EFFECT) return;
    this._removeOverlay();
    this.state = PLAYER_CAUGHT_STATES.CAUGHT_GAME_OVER;
    const audioFade = this.engine?.audio?.finishCaughtAudio?.() ?? 0;
    const postEffectDelay = Math.max(0, Number(this._setting('caughtPostEffectDelay')) || 1);
    const popupDelay = audioFade + postEffectDelay;
    this.engine?.stop?.();
    if (typeof document !== 'undefined' && document.pointerLockElement) document.exitPointerLock?.();
    if (popupDelay > 0) {
      this._popupTimer = setTimeout(() => {
        this._popupTimer = null;
        if (this.state === PLAYER_CAUGHT_STATES.CAUGHT_GAME_OVER) this._showDialog();
      }, popupDelay * 1000);
    } else this._showDialog();
  }

  _createDialog() {
    this.dialog = document.createElement('dialog');
    this.dialog.className = 'challenge-briefing-card success-dialog player-caught-dialog';
    this.dialog.setAttribute('aria-labelledby', 'player-caught-title');
    this.dialog.innerHTML = `
      <h2 id="player-caught-title">You Were Caught!</h2>
      <div class="challenge-briefing-buttons">
        <button type="button" class="tb-btn run" data-action="restart">Restart</button>
      </div>`;
    this.dialog.addEventListener('cancel', event => event.preventDefault());
    this.dialog.querySelector('[data-action="restart"]')?.addEventListener('click', () => {
      this.state = PLAYER_CAUGHT_STATES.RESTART;
      this.cancel({ restorePlayer: false });
      this.restart?.();
    });
    (this.host || document.body)?.appendChild(this.dialog);
  }

  _showDialog() {
    if (!this.dialog || this.dialog.open) return;
    this.dialog.showModal?.();
  }

  _closeDialog() { if (this.dialog?.open) this.dialog.close(); }
  _removeOverlay() { this.overlay?.remove(); this.overlay = null; }
}
