import * as THREE from './three.js';

export const TUNNEL_STATE = {
    IDLE: "IDLE",
    DISTURBING: "DISTURBING",
    ERUPTING: "ERUPTING",
    PEAKING: "PEAKING",
    DISSIPATING: "DISSIPATING",
    COMPLETE: "COMPLETE",
  };

  function saturate(v) {
    return v < 0 ? 0 : v > 1 ? 1 : v;
  }

  function easeOutCubic(t) {
    const x = saturate(t);
    return 1 - (1 - x) ** 3;
  }

  function easeInCubic(t) {
    const x = saturate(t);
    return x * x * x;
  }

  const TUNNEL_VERT = `
varying vec3 vWorldPos;
varying vec3 vNormal;
varying float vY01;
varying float vTheta;
varying float vRadius;
varying float vFormed;
varying float vFront;
varying vec2 vUv;
varying float vDeform;

uniform float uTime;
uniform float uHeight;
uniform float uFloorY;
uniform float uBaseRadius;
uniform float uTopRadius;
uniform float uTwistSpeed;
uniform float uTwistAmount;
uniform float uTurbulence;
uniform float uEruption;
uniform float uThin;
uniform float uUnstable;
uniform float uCenterlineWander;
uniform float uCenterlineWanderSpeed;
uniform float uUpperTurbulence;
uniform float uCrownChaos;
uniform float uRadiusVariation;
uniform float uFormationCoreRadius;
uniform float uFormationSpeed;
uniform float uFormationTurbulence;

float sat01(float v) {
  return clamp(v, 0.0, 1.0);
}

float hash13(vec3 p) {
  p = fract(p * 0.1031);
  p += dot(p, p.yzx + 33.33);
  return fract((p.x + p.y) * p.z);
}

float vnoise(vec3 p) {
  vec3 i = floor(p);
  vec3 f = fract(p);
  f = f * f * (3.0 - 2.0 * f);
  float n000 = hash13(i);
  float n100 = hash13(i + vec3(1.0, 0.0, 0.0));
  float n010 = hash13(i + vec3(0.0, 1.0, 0.0));
  float n110 = hash13(i + vec3(1.0, 1.0, 0.0));
  float n001 = hash13(i + vec3(0.0, 0.0, 1.0));
  float n101 = hash13(i + vec3(1.0, 0.0, 1.0));
  float n011 = hash13(i + vec3(0.0, 1.0, 1.0));
  float n111 = hash13(i + vec3(1.0, 1.0, 1.0));
  float nx00 = mix(n000, n100, f.x);
  float nx10 = mix(n010, n110, f.x);
  float nx01 = mix(n001, n101, f.x);
  float nx11 = mix(n011, n111, f.x);
  return mix(mix(nx00, nx10, f.y), mix(nx01, nx11, f.y), f.z);
}

float fbm(vec3 p) {
  float s = 0.0;
  float a = 0.55;
  s += a * vnoise(p);
  p = p * 2.07 + 13.7;
  a *= 0.5;
  s += a * vnoise(p);
  p = p * 2.03 + 8.1;
  a *= 0.5;
  s += a * vnoise(p);
  p = p * 2.11 + 4.4;
  a *= 0.5;
  s += a * vnoise(p);
  return s;
}

float matureProfile(float y, float t) {
  float root = mix(0.9, 1.0, smoothstep(0.0, 0.05, y));
  float taper = mix(1.0, uTopRadius / max(uBaseRadius, 0.0001), smoothstep(0.0, 1.0, y));
  return uBaseRadius * taper * root;
}

float streamDeform(float y01, float theta, float t) {
  vec2 p = vec2(cos(theta), sin(theta));
  float n1 = fbm(vec3(p * 1.55, y01 * 8.2 - t * 2.35)) - 0.5;
  float n2 = fbm(vec3(p * 3.05 + 5.2, y01 * 14.5 - t * 3.55)) - 0.5;
  float n3 = fbm(vec3(p.yx * 2.15, y01 * 4.4 - t * 1.45)) - 0.5;
  float waveA = sin(theta * 2.0 + y01 * 11.5 - t * 2.7 + n3 * 2.2);
  float waveB = sin(theta * 3.0 + y01 * 7.2 - t * 1.85);
  float waveC = sin(theta * 5.0 + y01 * 18.0 - t * 4.1 + n1 * 1.4);
  return n1 * 0.22 + n2 * 0.32 + waveA * 0.16 + waveB * 0.1 + waveC * 0.14;
}

vec2 streamWiggle(float y01, float t, float formed) {
  float amt = uBaseRadius * 0.1 * formed;
  return vec2(
    fbm(vec3(y01 * 6.4 - t * 2.15, 3.1, 0.6)) - 0.5,
    fbm(vec3(y01 * 5.9 - t * 1.95, 9.4, 2.8)) - 0.5
  ) * amt * 2.0;
}

float formationFront(float e, float theta, float t) {
  float rise = pow(sat01(e), mix(0.92, 0.52, sat01(uFormationSpeed)));
  float n = fbm(vec3(cos(theta) * 1.5, sin(theta) * 1.5, t * 0.74));
  float lobe =
    0.32 * sin(theta * 3.0 + t * 1.05) +
    0.18 * sin(theta * 5.0 - t * 0.8 + 1.3) +
    0.28 * (n * 2.0 - 1.0);
  float settle = 1.0 - smoothstep(0.72, 0.98, e);
  float jitter = (0.008 + 0.022 * e) * lobe * uFormationTurbulence * settle;
  return sat01(rise + jitter);
}

vec2 centerlineOffset(float y01, float t, float e, float formed) {
  float rise = pow(sat01((y01 - 0.06) / 0.94), 1.6);
  float amt = rise * uCenterlineWander * uBaseRadius * mix(0.4, 1.0, e) * formed;
  float spd = uCenterlineWanderSpeed;
  vec2 slow = vec2(
    fbm(vec3(y01 * 1.15, t * spd * 0.32, 1.4)) - 0.5,
    fbm(vec3(y01 * 1.05 + 4.8, t * spd * 0.28, 7.1)) - 0.5
  );
  vec2 med = vec2(
    fbm(vec3(y01 * 2.4 - t * spd * 0.4, 12.6, 2.0)) - 0.5,
    fbm(vec3(8.3, y01 * 2.2 - t * spd * 0.35, 4.1)) - 0.5
  );
  return (slow * 0.7 + med * 0.85) * amt;
}

void main() {
  float y01 = clamp(position.y, 0.0, 1.0);
  float theta0 = atan(position.z, position.x);
  float t = uTime;
  float e = sat01(uEruption);
  vY01 = y01;

  float front = formationFront(e, theta0, t);
  float band = mix(0.055, 0.13, e);
  float frontCover = front + mix(0.0, 0.22, smoothstep(0.78, 1.0, e));
  float formed = 1.0 - smoothstep(frontCover - band, frontCover, y01);
  vFormed = formed;
  vFront = front;

  float zoneUpper = smoothstep(0.78, 0.96, y01);

  float twist =
    t * uTwistSpeed +
    y01 * uTwistAmount * mix(0.35, 1.0, formed);

  float c = cos(twist);
  float s = sin(twist);
  vec2 xz = vec2(position.x * c - position.z * s, position.x * s + position.z * c);

  float matureR = matureProfile(y01, t);
  float heightRatio = sat01(front);
  float r = matureR * heightRatio;

  float flow = y01 * 9.2 - t * 2.55;
  float helixShape = sin(theta0 * 3.0 + flow + t * uTwistSpeed * 0.35);
  float stream = streamDeform(y01, theta0, t);
  float turb = uTurbulence * (0.7 + 0.45 * uUnstable) * (1.0 + zoneUpper * uUpperTurbulence * 0.35);
  r *= 1.0 + stream * turb * uRadiusVariation * formed;

  float atFront = formed * (1.0 - formed) * 4.0;
  float lobe =
    0.35 * sin(theta0 * 3.0 + t * 0.85) +
    0.22 * sin(theta0 * 5.0 - t * 1.1 + 1.2) +
    0.28 * (fbm(vec3(cos(theta0) * 1.5, sin(theta0) * 1.5, t * 0.42)) * 2.0 - 1.0);
  r *= 1.0 + atFront * uCrownChaos * (0.08 + 0.32 * lobe);
  r *= 1.0 + zoneUpper * e * uCrownChaos * 0.1 * lobe;
  r *= formed;

  float len = max(length(xz), 0.0001);
  vec2 dir = xz / len;
  vec2 center = centerlineOffset(y01, t, e, formed) + streamWiggle(y01, t, formed);
  center += dir * atFront * lobe * uBaseRadius * 0.05 * uFormationTurbulence;
  vec2 tangent = vec2(-dir.y, dir.x);
  xz = dir * r + center + tangent * helixShape * 0.045 * turb * uBaseRadius * formed;

  vRadius = length(xz);
  vTheta = atan(xz.y, xz.x);
  vUv = uv;
  vDeform = sat01(abs(stream) * 0.9 + atFront * 0.22 + zoneUpper * 0.12);

  float yDesigned = uFloorY + y01 * uHeight;
  float yFront = uFloorY + front * uHeight;
  float y = mix(yFront, yDesigned, formed);
  y += stream * 0.035 * uHeight * formed;
  y += atFront * uHeight * 0.02 * lobe * mix(0.4, 0.9, e);
  y += zoneUpper * e * uCrownChaos * uHeight * 0.014 * max(lobe, 0.0);

  vec3 pos = vec3(xz.x, y, xz.y);
  vec3 radialN = normalize(vec3(xz.x - center.x, 0.12 + stream * 0.35, xz.y - center.y));
  radialN = normalize(radialN + vec3(stream * 0.55, helixShape * 0.22, lobe * 0.18));
  vNormal = normalize(normalMatrix * radialN);
  vec4 world = modelMatrix * vec4(pos, 1.0);
  vWorldPos = world.xyz;
  gl_Position = projectionMatrix * viewMatrix * world;
}
`;

  const TUNNEL_FRAG = `
varying vec3 vWorldPos;
varying vec3 vNormal;
varying float vY01;
varying float vTheta;
varying float vRadius;
varying float vFormed;
varying float vFront;
varying vec2 vUv;
varying float vDeform;

uniform float uOpacity;
uniform float uShaderTime;
uniform float uTwistSpeed;
uniform float uTwistAmount;
uniform float uUnstable;
uniform float uEruption;
uniform vec3 uWaterColor;
uniform float uIntensity;
uniform float uNoiseScale;
uniform float uNoiseSpeed;
uniform float uWaterNoiseScale;
uniform float uWaterNoiseSpeed;
uniform float uFoamAmount;
uniform float uFoamThreshold;
uniform float uAlpha;
uniform float uFresnelPower;
uniform float uFresnelStrength;
uniform float uDissipation;
uniform float uDebugMode;
uniform sampler2D uNoise;
uniform sampler2D uWaterNoise;
uniform sampler2D uFoam;
uniform sampler2D uWaterMask;

const float INV_TAU = 0.15915494309;

void main() {
  vec3 nrm = normalize(vNormal);
  vec3 viewDir = normalize(cameraPosition - vWorldPos);
  float ndv = max(dot(nrm, viewDir), 0.0);
  float fresnel = pow(1.0 - ndv, max(uFresnelPower, 0.2));

  float t = uShaderTime;
  float ang = vTheta * INV_TAU;
  float helix = ang + vY01 * uTwistAmount * 0.11 + t * uTwistSpeed * 0.09;

  vec2 warpUV = vec2(ang * uNoiseScale, vY01 * uNoiseScale * 1.35) + vec2(t * uNoiseSpeed * 0.12, -t * uNoiseSpeed);
  float nWarp = texture2D(uNoise, warpUV).r;
  vec2 warp = vec2((nWarp - 0.5) * 0.14, (nWarp - 0.5) * 0.1);

  vec2 flowA = vec2(helix, vY01 * uWaterNoiseScale - t * uWaterNoiseSpeed) + warp;
  vec2 flowB = vec2(helix * 1.55 - t * uTwistSpeed * 0.05, vY01 * uWaterNoiseScale * 1.7 - t * uWaterNoiseSpeed * 1.35) - warp * 0.7;
  float waterA = texture2D(uWaterNoise, flowA).r;
  float waterB = texture2D(uWaterNoise, flowB).r;
  float turb = waterA * 0.58 + waterB * 0.42;
  float combinedNoise = mix(nWarp, turb, 0.65);

  float crest = smoothstep(
    uFoamThreshold,
    uFoamThreshold + 0.28,
    turb * 0.72 + vDeform * 0.4 + nWarp * 0.12 + vY01 * 0.08 * uUnstable
  );
  vec2 foamUV = flowA * 1.65 + vec2(t * 0.06, -t * 0.13);
  float foamTex = texture2D(uFoam, foamUV).r;
  float foam = foamTex * crest * uFoamAmount;
  foam *= mix(0.55, 1.0, smoothstep(0.45, 0.95, vY01));

  vec2 maskUV = vec2(helix * 0.85, vY01 * 1.1 - t * uWaterNoiseSpeed * 0.2) + warp * 0.5;
  float mask = texture2D(uWaterMask, maskUV).r;

  vec3 base = uWaterColor;
  vec3 deep = mix(base * 0.42, vec3(0.05, 0.14, 0.24), 0.35);
  vec3 mid = mix(base, vec3(0.22, 0.55, 0.78), 0.22);
  vec3 thin = mix(base, vec3(0.78, 0.93, 1.0), 0.5);
  vec3 foamCol = vec3(0.92, 0.97, 1.0);

  float flowLit = pow(clamp(turb, 0.0, 1.0), 1.15);
  vec3 col = mix(deep, mid, clamp(0.28 + flowLit * 0.72, 0.0, 1.0));
  col = mix(col, thin, fresnel * uFresnelStrength + pow(waterA, 3.2) * 0.18);
  col *= mix(0.88, 1.12, 1.0 - ndv * 0.28);
  col = mix(col, thin, crest * 0.28);
  col = mix(col, foamCol, foam * 0.9);
  col *= uIntensity * mix(0.82, 1.12, uEruption);

  float body = mix(0.52, 0.92, ndv);
  float holes = mix(0.84, 1.0, mask);
  float edgeBreak = smoothstep(0.1, 0.58, 1.0 - ndv) * (1.0 - mask) * 0.28;
  float alpha = uAlpha * uOpacity * mix(0.5, 1.0, vFormed);
  alpha *= mix(0.78, 1.0, body);
  alpha *= holes;
  alpha *= 1.0 - edgeBreak;
  alpha *= mix(0.9, 1.0, turb);
  alpha = mix(alpha, min(0.97, alpha + 0.22), foam);

  float front = mix(1.38, -0.22, clamp(uDissipation, 0.0, 1.0));
  float dissolve = smoothstep(front - 0.2, front + 0.14, vY01);
  alpha *= 1.0 - dissolve * mix(0.72, 1.0, 1.0 - mask);

  float rim = mix(0.82, 1.0, fresnel * 0.55);
  alpha *= rim;
  alpha = clamp(alpha, 0.0, 0.94);

  float mode = uDebugMode;
  if (mode > 0.5 && mode < 1.5) {
    col = vec3(combinedNoise);
    alpha = 0.92;
  } else if (mode > 1.5 && mode < 2.5) {
    col = vec3(mask);
    alpha = 0.92;
  } else if (mode > 2.5 && mode < 3.5) {
    col = vec3(foam);
    alpha = 0.92;
  } else if (mode > 3.5 && mode < 4.5) {
    col = vec3(fresnel);
    alpha = 0.92;
  }

  gl_FragColor = vec4(col, alpha);
}
`;

export class WaterTunnel {
    constructor(textures) {
      this.textures = textures;
      this.group = new THREE.Group();
      this.group.name = "WaterTunnel";
      this.group.visible = false;

      this.active = false;
      this.finished = false;
      this.state = TUNNEL_STATE.IDLE;
      this.time = 0;
      this.animTime = 0;
      this.shaderTime = 0;
      this._phaseTime = 0;
      this.origin = new THREE.Vector3();

      this._ctx = {
        eruption: 0,
        thin: 1,
        unstable: 0,
        opacity: 1,
      };

      this._radialSegments = 64;
      this._heightSegments = 128;
      this.waterColor = new THREE.Color(0x2a7eb8);

      this.material = new THREE.ShaderMaterial({
        vertexShader: TUNNEL_VERT,
        fragmentShader: TUNNEL_FRAG,
        uniforms: {
          uTime: { value: 0 },
          uShaderTime: { value: 0 },
          uHeight: { value: 14 },
          uFloorY: { value: 0 },
          uBaseRadius: { value: 1.45 },
          uTopRadius: { value: 1.45 },
          uTwistSpeed: { value: 1.45 },
          uTwistAmount: { value: 1.15 },
          uTurbulence: { value: 0.78 },
          uEruption: { value: 0 },
          uThin: { value: 1 },
          uUnstable: { value: 0 },
          uOpacity: { value: 1 },
          uCenterlineWander: { value: 0.22 },
          uCenterlineWanderSpeed: { value: 0.48 },
          uUpperTurbulence: { value: 0.7 },
          uCrownChaos: { value: 0.42 },
          uRadiusVariation: { value: 0.95 },
          uFormationCoreRadius: { value: 1.2 },
          uFormationSpeed: { value: 0.68 },
          uFormationTurbulence: { value: 0.55 },
          uWaterColor: { value: this.waterColor },
          uIntensity: { value: 1.5 },
          uNoiseScale: { value: 1.65 },
          uNoiseSpeed: { value: 1.16 },
          uWaterNoiseScale: { value: 2.35 },
          uWaterNoiseSpeed: { value: 0.34 },
          uFoamAmount: { value: 0.62 },
          uFoamThreshold: { value: 0.4 },
          uAlpha: { value: 1 },
          uFresnelPower: { value: 5 },
          uFresnelStrength: { value: 0.38 },
          uDissipation: { value: 0 },
          uDebugMode: { value: 0 },
          uNoise: { value: textures.noise },
          uWaterNoise: { value: textures.waterNoise },
          uFoam: { value: textures.foam },
          uWaterMask: { value: textures.waterMask },
        },
        transparent: true,
        depthWrite: false,
        blending: THREE.NormalBlending,
        side: THREE.DoubleSide,
        toneMapped: false,
        fog: false,
      });

      this.mesh = new THREE.Mesh(this._createGeometry(), this.material);
      this.mesh.name = "WaterTunnelMesh";
      this.mesh.frustumCulled = false;
      this.mesh.renderOrder = 5;
      this.group.add(this.mesh);
    }

    _createGeometry() {
      const geo = new THREE.CylinderGeometry(1, 1, 1, this._radialSegments, this._heightSegments, true);
      geo.translate(0, 0.5, 0);
      geo.computeBoundingSphere();
      return geo;
    }

    setResolution(radialSegments, heightSegments) {
      const radial = Math.max(8, Math.round(radialSegments));
      const height = Math.max(8, Math.round(heightSegments));
      if (radial === this._radialSegments && height === this._heightSegments) return;
      this._radialSegments = radial;
      this._heightSegments = height;
      const prev = this.mesh.geometry;
      this.mesh.geometry = this._createGeometry();
      prev.dispose();
    }

    spawn(origin, cfg) {
      this.reset();
      this.origin.copy(origin);
      this.group.position.set(origin.x, origin.y - 0.5, origin.z);
      this.active = true;
      this.finished = false;
      this.state = TUNNEL_STATE.DISTURBING;
      this.group.visible = true;
      this._applyLook(cfg);
    }

    beginDissipate() {
      if (!this.active) return;
      if (this.state === TUNNEL_STATE.DISSIPATING || this.state === TUNNEL_STATE.COMPLETE) return;
      this.state = TUNNEL_STATE.DISSIPATING;
      this._phaseTime = 0;
    }

    reset() {
      this.time = 0;
      this.animTime = 0;
      this.shaderTime = 0;
      this._phaseTime = 0;
      this.state = TUNNEL_STATE.IDLE;
      this.active = false;
      this.finished = false;
      this.group.visible = false;
      this._ctx.eruption = 0;
      this._ctx.thin = 1;
      this._ctx.unstable = 0;
      this._ctx.opacity = 1;
      const u = this.material.uniforms;
      u.uTime.value = 0;
      u.uShaderTime.value = 0;
      u.uEruption.value = 0;
      u.uThin.value = 1;
      u.uUnstable.value = 0;
      u.uOpacity.value = 1;
      u.uDissipation.value = 0;
    }

    destroy() {
      this.active = false;
      this.finished = true;
      this.state = TUNNEL_STATE.COMPLETE;
      this.group.visible = false;
      this.material.uniforms.uOpacity.value = 0;
      this.material.uniforms.uEruption.value = 0;
    }

    update(dt, cfg) {
      if (!this.active) return;

      this.time += dt;
      this.animTime += dt;
      this.shaderTime += dt;
      this._phaseTime += dt;

      this._advanceState(cfg);
      if (!this.active) return;

      this._evalEnvelopes(cfg);
      this._applyLook(cfg);
      this._syncUniforms(cfg);
    }

    _advanceState(cfg) {
      const disturb = Math.max(cfg.disturbDuration, 0.0001);
      const erupt = Math.max(cfg.eruptDuration, 0.0001);
      const peak = Math.max(cfg.peakDuration, 0.0001);
      const dissipate = Math.max(cfg.dissipateDuration, 0.0001);

      if (this.state === TUNNEL_STATE.DISTURBING && this._phaseTime >= disturb) {
        this._phaseTime = 0;
        this.state = TUNNEL_STATE.ERUPTING;
        return;
      }
      if (this.state === TUNNEL_STATE.ERUPTING && this._phaseTime >= erupt) {
        this._phaseTime = 0;
        this.state = TUNNEL_STATE.PEAKING;
        return;
      }
      if (this.state === TUNNEL_STATE.PEAKING && this._phaseTime >= peak) {
        this._phaseTime = 0;
        return;
      }
      if (this.state === TUNNEL_STATE.DISSIPATING) {
        const fallDone = this._phaseTime >= Math.max(cfg.fallDuration, 0.0001);
        if (this._phaseTime >= dissipate && fallDone) {
          this.destroy();
        }
      }
    }

    _evalEnvelopes(cfg) {
      const t = this._phaseTime;
      const ctx = this._ctx;

      if (this.state === TUNNEL_STATE.DISTURBING) {
        const k = saturate(t / Math.max(cfg.disturbDuration, 0.0001));
        ctx.eruption = this._riseEruption(cfg);
        ctx.thin = 0.42 + 0.08 * k;
        ctx.unstable = 0.35;
        ctx.opacity = 0.85;
        return;
      }

      if (this.state === TUNNEL_STATE.ERUPTING) {
        const k = saturate(t / Math.max(cfg.eruptDuration, 0.0001));
        ctx.eruption = this._riseEruption(cfg);
        ctx.thin = 0.55 + 0.45 * easeOutCubic(k);
        ctx.unstable = 0.2 + 0.15 * k;
        ctx.opacity = 1;
        return;
      }

      if (this.state === TUNNEL_STATE.PEAKING) {
        ctx.eruption = this._riseEruption(cfg);
        ctx.thin = 1 + 0.04 * Math.sin(this.animTime * 1.7);
        ctx.unstable = 0.28 + 0.12 * Math.sin(this.animTime * 2.3);
        ctx.opacity = 1;
        return;
      }

      if (this.state === TUNNEL_STATE.DISSIPATING) {
        const k = saturate(t / Math.max(cfg.dissipateDuration, 0.0001));
        const fall = easeInCubic(saturate(t / Math.max(cfg.fallDuration, 0.0001)));
        const risen = saturate((this.time - t) / Math.max(cfg.riseDuration, 0.0001));
        ctx.eruption = risen * (1 - fall);
        ctx.thin = 1 - 0.78 * easeOutCubic(k);
        ctx.unstable = 0.35 + 0.65 * k;
        ctx.opacity = 1 - fall;
        return;
      }

      ctx.eruption = 0;
      ctx.thin = 1;
      ctx.unstable = 0;
      ctx.opacity = 1;
    }

    _riseEruption(cfg) {
      return saturate(this.time / Math.max(cfg.riseDuration, 0.0001));
    }

    _applyLook(cfg) {
      this.setResolution(cfg.radialSegments, cfg.heightSegments);
      this.waterColor.set(cfg.waterColor);
    }

    _syncUniforms(cfg) {
      const u = this.material.uniforms;
      const ctx = this._ctx;
      const radius = Math.max(cfg.radius, 0.05);
      u.uTime.value = this.animTime;
      u.uShaderTime.value = this.shaderTime;
      u.uHeight.value = cfg.height;
      u.uFloorY.value = cfg.floorY;
      u.uBaseRadius.value = radius;
      u.uTopRadius.value = radius;
      u.uTwistSpeed.value = cfg.twistSpeed;
      u.uTwistAmount.value = cfg.twistAmount;
      u.uTurbulence.value = cfg.turbulence;
      u.uCenterlineWander.value = cfg.centerlineWander;
      u.uCenterlineWanderSpeed.value = cfg.centerlineWanderSpeed;
      u.uUpperTurbulence.value = cfg.upperTurbulence;
      u.uCrownChaos.value = cfg.crownChaos;
      u.uRadiusVariation.value = cfg.radiusVariation;
      u.uFormationCoreRadius.value = cfg.formationCoreRadius;
      u.uFormationSpeed.value = cfg.formationSpeed;
      u.uFormationTurbulence.value = cfg.formationTurbulence;
      u.uEruption.value = ctx.eruption;
      u.uThin.value = ctx.thin;
      u.uUnstable.value = ctx.unstable;
      u.uOpacity.value = ctx.opacity;
      u.uWaterColor.value.copy(this.waterColor);
      u.uIntensity.value = cfg.intensity;
      u.uNoiseScale.value = cfg.noiseScale;
      u.uNoiseSpeed.value = cfg.noiseSpeed;
      u.uWaterNoiseScale.value = cfg.waterNoiseScale;
      u.uWaterNoiseSpeed.value = cfg.waterNoiseSpeed;
      u.uFoamAmount.value = cfg.foamAmount;
      u.uFoamThreshold.value = cfg.foamThreshold;
      u.uAlpha.value = cfg.alpha;
      u.uFresnelPower.value = cfg.fresnelPower;
      u.uFresnelStrength.value = cfg.fresnelStrength;
      u.uDissipation.value = this.state === TUNNEL_STATE.DISSIPATING
        ? saturate(this._phaseTime / Math.max(cfg.fallDuration, 0.0001))
        : 0;
      u.uDebugMode.value = cfg.debugMode;
      this.group.visible = this.active && ctx.eruption > 0.001 && ctx.opacity > 0.01;
    }
  }

