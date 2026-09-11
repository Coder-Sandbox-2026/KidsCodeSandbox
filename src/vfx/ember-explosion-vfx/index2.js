import * as e from "three";
//#region src/vfx/utils/events.js
var t = class {
	constructor() {
		this._listeners = /* @__PURE__ */ new Map();
	}
	on(e, t) {
		if (typeof t != "function") return this;
		let n = this._listeners.get(e);
		return n || (n = [], this._listeners.set(e, n)), n.push(t), this;
	}
	off(e, t) {
		let n = this._listeners.get(e);
		if (!n) return this;
		let r = n.indexOf(t);
		return r >= 0 && n.splice(r, 1), this;
	}
	once(e, t) {
		let n = (r) => {
			this.off(e, n), t(r);
		};
		return this.on(e, n);
	}
	emit(e, t) {
		let n = this._listeners.get(e);
		if (!n || n.length === 0) return this;
		let r = n.slice();
		for (let e = 0; e < r.length; e++) r[e](t);
		return this;
	}
	clear() {
		this._listeners.clear();
	}
}, n = Object.freeze({
	IDLE: "IDLE",
	CONVERGING: "CONVERGING",
	CHARGING: "CHARGING",
	EXPLODING: "EXPLODING",
	FADING: "FADING",
	FINISHED: "FINISHED"
}), r = {
	position: new e.Vector3(0, 0, 0),
	autoStart: !1,
	debug: !1,
	debugIsolateEmbers: !1,
	loop: !1,
	loopDelay: 3,
	embers: {
		count: 800,
		maxActive: 800,
		spawnRadius: 20,
		spawnRadiusMin: 13,
		spawnRate: 140,
		travelDurationMin: .85,
		travelDurationMax: 1.7,
		minSize: .33,
		maxSize: .87,
		minBrightness: .95,
		maxBrightness: 1.9,
		trailLength: 1.85,
		pathDeviation: .035,
		arrivalRadius: .28,
		whiteHotChance: .08,
		brightSpeedRef: 16,
		convergenceDuration: 5.2
	},
	timeline: {
		emberStart: 0,
		coreBuildStart: 2.2,
		emberStop: 5.2,
		finalChargeMaxDuration: 1.8,
		explosionDelayAfterEmbers: .35,
		coreRevealDuration: .55
	},
	core: {
		enabled: !0,
		maxScale: 2.5,
		pulseIntensity: 1,
		chargeDuration: 1,
		sparkCount: 64,
		lightEnabled: !0,
		lightMaxIntensity: 28,
		lightMaxDistance: 42
	},
	explosion: {
		radius: 15,
		duration: 2,
		flashDuration: .12
	},
	sparks: {
		enabled: !0,
		count: 420,
		minSpeed: 6,
		maxSpeed: 28,
		drag: 1.8,
		life: 1.65
	},
	shockwave: {
		enabled: !0,
		duration: .85,
		thickness: .18
	},
	smoke: {
		enabled: !0,
		count: 220,
		duration: 3.2,
		minSize: .7,
		maxSize: 2.4
	}
};
function i(e) {
	return typeof e == "object" && !!e && !Array.isArray(e) && !e.isVector3 && !e.isColor && !e.isTexture;
}
function a(e, t) {
	let n = Array.isArray(e) ? e.slice() : { ...e };
	if (!t) return n;
	for (let r of Object.keys(t)) {
		let o = e ? e[r] : void 0, s = t[r];
		s !== void 0 && (n[r] = i(o) && i(s) ? a(o, s) : s);
	}
	return n;
}
function o(e, t) {
	return t ? (t.emberCount != null && (e.embers.count = t.emberCount, e.embers.maxActive = t.emberCount), t.spawnRadius != null && (e.embers.spawnRadius = t.spawnRadius), t.convergenceDuration != null && (e.embers.convergenceDuration = t.convergenceDuration, (t.timeline == null || t.timeline.emberStop == null) && (e.timeline.emberStop = t.convergenceDuration)), t.chargeDuration != null && (e.core.chargeDuration = t.chargeDuration, (t.timeline == null || t.timeline.finalChargeMaxDuration == null) && (e.timeline.finalChargeMaxDuration = t.chargeDuration)), t.explosionRadius != null && (e.explosion.radius = t.explosionRadius), t.explosionDuration != null && (e.explosion.duration = t.explosionDuration), t.autoStart != null && (e.autoStart = t.autoStart), t.debug != null && (e.debug = t.debug), e) : e;
}
function s(t = {}) {
	let n = a(r, t);
	return o(n, t), n.position = t.position && t.position.isVector3 ? t.position.clone() : n.position && n.position.isVector3 ? n.position.clone() : new e.Vector3(), n.embers = { ...n.embers }, n.timeline = { ...n.timeline }, n.core = { ...n.core }, n.explosion = { ...n.explosion }, n.sparks = { ...n.sparks }, n.shockwave = { ...n.shockwave }, n.smoke = { ...n.smoke }, n.embers.maxActive == null ? n.embers.maxActive = n.embers.count : n.embers.count = n.embers.maxActive, n.embers.spawnRadiusMin > n.embers.spawnRadius && (n.embers.spawnRadiusMin = n.embers.spawnRadius * .65), n;
}
//#endregion
//#region src/vfx/utils/math.js
var c = (e) => e < 0 ? 0 : e > 1 ? 1 : e, l = (e, t, n) => e + (t - e) * n, u = (e) => 1 - (1 - e) ** 3, d = (e) => 1 - (1 - e) * (1 - e);
new e.Vector3(), new e.Vector3(), new e.Vector3(), new e.Vector3(), new e.Color(), new e.Color();
function f(e, t, n, r, i) {
	let a = t * 3;
	e[a] = n, e[a + 1] = r, e[a + 2] = i;
}
//#endregion
//#region src/vfx/textures/generate.js
function p(e) {
	return e * e * e * (e * (e * 6 - 15) + 10);
}
function m(e, t, n) {
	return e + (t - e) * n;
}
function h(e, t, n = 0) {
	let r = e * 374761393 + t * 668265263 + n * 1274126177;
	return r = (r ^ r >> 13) * 1274126177, r = (r ^ r >> 16) >>> 0, (r & 268435455) / 268435455;
}
function g(e, t, n = 0) {
	let r = Math.floor(e), i = Math.floor(t), a = e - r, o = t - i, s = p(a), c = p(o);
	return m(m(h(r, i, n), h(r + 1, i, n), s), m(h(r, i + 1, n), h(r + 1, i + 1, n), s), c);
}
function _(e, t, n, r = 0) {
	let i = Math.floor(e), a = Math.floor(t), o = e - i, s = t - a, c = p(o), l = p(s), u = (i % n + n) % n, d = (a % n + n) % n, f = (u + 1) % n, g = (d + 1) % n;
	return m(m(h(u, d, r), h(f, d, r), c), m(h(u, g, r), h(f, g, r), c), l);
}
function v(e, t, n, r, i) {
	let a = 0, o = .5, s = 1, c = n, l = 0;
	for (let n = 0; n < r; n++) a += o * _(e * s, t * s, c, i + n * 19), l += o, s *= 2, c *= 2, o *= .5;
	return a / l;
}
function y(e) {
	return e < 0 ? 0 : e > 1 ? 1 : e;
}
function b(e, t, n, r, i, a) {
	let o = t * 4;
	e[o] = Math.round(y(n) * 255), e[o + 1] = Math.round(y(r) * 255), e[o + 2] = Math.round(y(i) * 255), e[o + 3] = Math.round(y(a) * 255);
}
function x(e, t, n) {
	let r = 2 * n * n;
	return Math.exp(-(e * e + t * t) / r);
}
function S(e = 256) {
	let t = new Uint8Array(e * e * 4), n = (e - 1) * .5, r = (e - 1) * .5, i = 2 / e;
	for (let a = 0; a < e; a++) for (let o = 0; o < e; o++) {
		let s = (o - n) * i, c = (a - r) * i, l = Math.sqrt(s * s + c * c), u = g(o * .08, a * .08, 11) * .08, d = Math.exp(-((l + u) * (l + u)) * 28), f = Math.exp(-(l * l) * 8.5), p = Math.exp(-(l * l) * 2.6), m = Math.exp(-(l * l) * 1.05), h = d * 1.15 + f * 1 + p * .75 + m * .35, _ = d * 1.05 + f * .55 + p * .22 + m * .05, v = d * .75 + f * .12 + p * .03, y = d * .95 + f * .65 + p * .38 + m * .16;
		b(t, a * e + o, h, _, v, y);
	}
	return {
		width: e,
		height: e,
		data: t
	};
}
function C(e = 256) {
	let t = new Uint8Array(e * e * 4), n = (e - 1) * .5, r = (e - 1) * .5, i = 2 / e;
	for (let a = 0; a < e; a++) for (let o = 0; o < e; o++) {
		let s = (o - n) * i, c = (a - r) * i, l = s * s + c * c, u = Math.exp(-l * 14), d = Math.exp(-l * 3.2), f = Math.exp(-l * 1.05), p = u * 1.1 + d * .85 + f * .45, m = u * .95 + d * .4 + f * .12, h = u * .65 + d * .08, g = u * .7 + d * .45 + f * .22;
		b(t, a * e + o, p, m, h, g);
	}
	return {
		width: e,
		height: e,
		data: t
	};
}
function w(e = 128) {
	let t = new Uint8Array(e * e * 4), n = (e - 1) * .5, r = (e - 1) * .5, i = 2 / e, a = [
		{
			x: 0,
			y: 0,
			sx: .22,
			sy: .22,
			w: 1
		},
		{
			x: .16,
			y: -.08,
			sx: .14,
			sy: .1,
			w: .55
		},
		{
			x: -.12,
			y: .14,
			sx: .1,
			sy: .16,
			w: .4
		},
		{
			x: .04,
			y: .2,
			sx: .08,
			sy: .18,
			w: .28
		}
	];
	for (let o = 0; o < e; o++) for (let s = 0; s < e; s++) {
		let c = (s - n) * i, l = (o - r) * i, u = 0;
		for (let e = 0; e < a.length; e++) {
			let t = a[e], n = (c - t.x) / t.sx, r = (l - t.y) / t.sy;
			u += t.w * Math.exp(-(n * n + r * r));
		}
		let d = c * c + l * l, f = Math.exp(-d * 2.4) * .45, p = u + f, m = p * 1.15, h = p * .72, g = p * .28, _ = Math.min(1, p * .95);
		b(t, o * e + s, m, h, g, _);
	}
	return {
		width: e,
		height: e,
		data: t
	};
}
function T(e = 512) {
	let t = new Uint8Array(e * e * 4), n = (e - 1) * .5, r = (e - 1) * .5, i = 2 / e;
	for (let a = 0; a < e; a++) for (let o = 0; o < e; o++) {
		let s = o / e * 8, c = a / e * 8, l = v(s, c, 8, 4, 3), u = v(s + l * 1.6, c - l * 1.2, 8, 5, 7), d = v(s * 1.7 + 4.2, c * 1.7, 16, 3, 21), f = (o - n) * i, p = (a - r) * i, m = Math.sqrt(f * f + p * p), h = x(f, p, .42) * 1 + x(f - .18, p + .12, .28) * .55 + x(f + .22, p - .08, .24) * .4 + x(f - .05, p - .22, .2) * .32, g = y(1 - E(m, .55, .98)), _ = u * .62 + d * .38;
		_ = y((_ - .28) * 1.7) * h * g, _ **= .85, b(t, a * e + o, _, _, _, _);
	}
	return {
		width: e,
		height: e,
		data: t
	};
}
function E(e, t, n) {
	if (e <= t) return 0;
	if (e >= n) return 1;
	let r = (e - t) / (n - t);
	return r * r * (3 - 2 * r);
}
function D(e = 512) {
	let t = new Uint8Array(e * e * 4);
	for (let n = 0; n < e; n++) for (let r = 0; r < e; r++) {
		let i = r / e * 6, a = n / e * 6, o = v(i, a, 6, 3, 2), s = v(i + 3.1, a + 1.7, 6, 3, 9), c = v(i + o * 1.4, a + s * 1.1, 6, 6, 4), l = 1 - Math.abs(c * 2 - 1);
		c = c * .55 + l * .45, c = y((c - .22) / .56), c **= .92, b(t, n * e + r, c, c, c, 1);
	}
	return {
		width: e,
		height: e,
		data: t
	};
}
function O(e = 512) {
	let t = new Uint8Array(e * e * 4);
	for (let n = 0; n < e; n++) for (let r = 0; r < e; r++) {
		let i = v(r / e * 8, n / e * 8, 8, 5, 13);
		b(t, n * e + r, i, i, i, 1);
	}
	return {
		width: e,
		height: e,
		data: t
	};
}
//#endregion
//#region src/vfx/textures/createTextures.js
function k(t, n = {}) {
	let r = new e.DataTexture(t.data, t.width, t.height, e.RGBAFormat);
	return r.needsUpdate = !0, r.flipY = !0, r.generateMipmaps = !0, r.minFilter = e.LinearMipmapLinearFilter, r.magFilter = e.LinearFilter, r.wrapS = n.repeat ? e.RepeatWrapping : e.ClampToEdgeWrapping, r.wrapT = n.repeat ? e.RepeatWrapping : e.ClampToEdgeWrapping, r.colorSpace = n.colorSpace ?? e.NoColorSpace, r.anisotropy = 4, r;
}
function A() {
	let t = k(S(256), { colorSpace: e.SRGBColorSpace }), n = k(C(256), { colorSpace: e.SRGBColorSpace }), r = k(w(128), { colorSpace: e.SRGBColorSpace }), i = k(T(512)), a = k(D(512), { repeat: !0 }), o = k(O(512), { repeat: !0 });
	return t.name = "ember", n.name = "emberSoft", r.name = "spark", i.name = "smoke", a.name = "fireNoise", o.name = "noise", {
		ember: t,
		emberSoft: n,
		spark: r,
		smoke: i,
		fireNoise: a,
		noise: o
	};
}
function j(e) {
	if (e) for (let t of Object.keys(e)) {
		let n = e[t];
		n && n.dispose && n.dispose();
	}
}
//#endregion
//#region src/vfx/shaders/index.js
var M = {
	emberVert: "varying vec2 vUv;\r\nvarying vec3 vColor;\r\nvarying float vBright;\r\nvarying float vAlong;\r\nvarying float vAlive;\r\n\r\nattribute vec3 aPosition;\r\nattribute vec3 aVelocity;\r\nattribute vec3 aColor;\r\nattribute float aSize;\r\nattribute float aBrightness;\r\nattribute float aAlive;\r\n\r\nuniform float uTrailScale;\r\nuniform float uHeadBias;\r\n\r\nvoid main() {\r\n  vUv = uv;\r\n  vColor = aColor;\r\n  vBright = aBrightness;\r\n  vAlive = aAlive;\r\n\r\n  if (aAlive < 0.02) {\r\n    gl_Position = vec4(2.0, 2.0, 2.0, 1.0);\r\n    return;\r\n  }\r\n\r\n  vec4 viewCenter = modelViewMatrix * vec4(aPosition, 1.0);\r\n  vec3 velView = mat3(modelViewMatrix) * aVelocity;\r\n  float speed = length(velView.xy);\r\n  vec2 dir = speed > 0.0008 ? normalize(velView.xy) : vec2(0.0, 1.0);\r\n  vec2 perp = vec2(-dir.y, dir.x);\r\n\r\n  float dist = max(abs(viewCenter.z), 1.0);\r\n  float sizeBoost = dist * 0.013;\r\n  float trailLen = aSize * (3.4 + speed * uTrailScale) + sizeBoost * 1.8 + speed * 0.035;\r\n  float width = aSize * 2.4 + sizeBoost;\r\n\r\n  float along = position.x + 0.5;\r\n  vAlong = along;\r\n  float across = position.y;\r\n\r\n  vec2 offset = -dir * along * trailLen + perp * across * width;\r\n  viewCenter.xy += offset;\r\n\r\n  gl_Position = projectionMatrix * viewCenter;\r\n}\r\n",
	emberFrag: "uniform sampler2D uMap;\r\nuniform sampler2D uSoftMap;\r\nuniform float uOpacity;\r\n\r\nvarying vec2 vUv;\r\nvarying vec3 vColor;\r\nvarying float vBright;\r\nvarying float vAlong;\r\nvarying float vAlive;\r\n\r\nvoid main() {\r\n  if (vAlive < 0.02) discard;\r\n\r\n  // Sample the bright core of the circular sprite across the streak width.\r\n  // Do NOT use vUv.x — that maps the head onto the transparent texture edge.\r\n  vec2 glowUV = vec2(vUv.y, 0.5);\r\n  float tex = max(texture2D(uMap, glowUV).a, texture2D(uSoftMap, glowUV).a);\r\n  float shaft = pow(clamp(1.0 - vAlong, 0.0, 1.0), 1.15);\r\n  float alpha = tex * shaft * vBright * uOpacity * vAlive;\r\n  if (alpha < 0.002) discard;\r\n\r\n  vec3 col = mix(vColor * 0.75, vColor, shaft);\r\n  col *= 2.9 + shaft * 3.4;\r\n  col += vec3(1.0, 0.84, 0.42) * shaft * shaft * 1.15 * vBright;\r\n\r\n  gl_FragColor = vec4(col * alpha, alpha);\r\n}\r\n",
	trailVert: "varying vec2 vUv;\r\nvarying vec3 vColor;\r\nvarying float vBright;\r\nvarying float vAlong;\r\nvarying float vAlive;\r\n\r\nattribute vec3 aPosition;\r\nattribute vec3 aVelocity;\r\nattribute vec3 aColor;\r\nattribute float aSize;\r\nattribute float aBrightness;\r\nattribute float aAlive;\r\n\r\nuniform float uTrailScale;\r\n\r\nvoid main() {\r\n  vUv = uv;\r\n  vColor = aColor;\r\n  vBright = aBrightness;\r\n  vAlive = aAlive;\r\n\r\n  if (aAlive < 0.02) {\r\n    gl_Position = vec4(2.0, 2.0, 2.0, 1.0);\r\n    return;\r\n  }\r\n\r\n  vec4 viewCenter = modelViewMatrix * vec4(aPosition, 1.0);\r\n  vec3 velView = mat3(modelViewMatrix) * aVelocity;\r\n  float speed = length(velView.xy);\r\n  vec2 dir = speed > 0.0008 ? normalize(velView.xy) : vec2(0.0, 1.0);\r\n  vec2 perp = vec2(-dir.y, dir.x);\r\n\r\n  float dist = max(abs(viewCenter.z), 1.0);\r\n  float sizeBoost = dist * 0.012;\r\n  float trailLen = aSize * (6.0 + speed * uTrailScale) + sizeBoost * 2.4 + speed * 0.05;\r\n  float width = aSize * 1.6 + sizeBoost * 0.55;\r\n\r\n  float along = position.x + 0.5;\r\n  vAlong = along;\r\n  vec2 offset = -dir * along * trailLen + perp * position.y * width;\r\n  viewCenter.xy += offset;\r\n\r\n  gl_Position = projectionMatrix * viewCenter;\r\n}\r\n",
	trailFrag: "uniform sampler2D uMap;\r\nuniform float uOpacity;\r\n\r\nvarying vec2 vUv;\r\nvarying vec3 vColor;\r\nvarying float vBright;\r\nvarying float vAlong;\r\nvarying float vAlive;\r\n\r\nvoid main() {\r\n  if (vAlive < 0.02) discard;\r\n\r\n  vec2 glowUV = vec2(vUv.y, 0.5);\r\n  float tex = texture2D(uMap, glowUV).a;\r\n  float fade = pow(clamp(1.0 - vAlong, 0.0, 1.0), 1.35);\r\n  float alpha = tex * fade * vBright * uOpacity * vAlive * 0.9;\r\n  if (alpha < 0.002) discard;\r\n\r\n  vec3 col = vColor * (1.0 + fade * 1.85);\r\n  gl_FragColor = vec4(col * alpha, alpha);\r\n}\r\n",
	coreVert: "varying vec3 vNormal;\r\nvarying vec3 vWorldPos;\r\nvarying vec2 vUv;\r\nvarying float vDisp;\r\n\r\nuniform float uTime;\r\nuniform float uDisplacement;\r\nuniform float uUnstable;\r\n\r\nfloat dispNoise(vec3 p, float t) {\r\n  float n = 0.0;\r\n  n += 0.50 * sin(p.x * 3.4 + t * 2.1) * sin(p.y * 2.9 - t * 1.6) * sin(p.z * 3.1 + t * 1.2);\r\n  n += 0.28 * sin(p.x * 6.2 - t * 2.8) * sin(p.y * 5.7 + t * 2.2) * sin(p.z * 5.4 - t);\r\n  n += 0.14 * sin(p.x * 10.5 + p.y * 8.2 + t * 3.4);\r\n  n += 0.08 * sin(p.z * 12.0 - p.x * 7.0 + t * 4.1);\r\n  return n;\r\n}\r\n\r\nvoid main() {\r\n  vUv = uv;\r\n  vec3 nrm = normalize(normal);\r\n  float n = dispNoise(position * 1.35, uTime);\r\n  float disp = n * uDisplacement * (0.55 + uUnstable * 1.6);\r\n  vDisp = disp;\r\n  vec3 pos = position + nrm * disp;\r\n  vNormal = normalize(normalMatrix * nrm);\r\n  vec4 world = modelMatrix * vec4(pos, 1.0);\r\n  vWorldPos = world.xyz;\r\n  gl_Position = projectionMatrix * viewMatrix * world;\r\n}\r\n",
	coreFrag: "varying vec3 vNormal;\r\nvarying vec3 vWorldPos;\r\nvarying vec2 vUv;\r\nvarying float vDisp;\r\n\r\nuniform float uTime;\r\nuniform float uEnergy;\r\nuniform float uUnstable;\r\nuniform float uOpacity;\r\nuniform sampler2D uFireNoise;\r\nuniform sampler2D uNoise;\r\n\r\nvoid main() {\r\n  vec3 nrm = normalize(vNormal);\r\n  vec3 viewDir = normalize(cameraPosition - vWorldPos);\r\n  float ndv = max(dot(nrm, viewDir), 0.0);\r\n  float fresnel = pow(1.0 - ndv, 2.2);\r\n\r\n  vec2 uv1 = vUv * 2.2 + vec2(uTime * 0.18, -uTime * 0.11);\r\n  vec2 uv2 = vUv * 3.4 - vec2(uTime * 0.14, uTime * 0.09);\r\n  float fire = texture2D(uFireNoise, uv1).r;\r\n  float n = texture2D(uNoise, uv2).r;\r\n  float mixN = fire * 0.65 + n * 0.35;\r\n\r\n  vec3 hot = vec3(1.0, 0.96, 0.72);\r\n  vec3 yellow = vec3(1.0, 0.72, 0.18);\r\n  vec3 orange = vec3(1.0, 0.32, 0.04);\r\n  vec3 red = vec3(0.55, 0.05, 0.01);\r\n\r\n  float t = mixN + fresnel * 0.35 + uEnergy * 0.15;\r\n  vec3 col = mix(red, orange, smoothstep(0.15, 0.4, t));\r\n  col = mix(col, yellow, smoothstep(0.4, 0.7, t));\r\n  col = mix(col, hot, smoothstep(0.7, 1.05, t));\r\n\r\n  float flicker = 0.85 + 0.15 * sin(uTime * (8.0 + uUnstable * 22.0));\r\n  flicker += uUnstable * 0.12 * sin(uTime * 37.0);\r\n\r\n  float alpha = (0.35 + mixN * 0.5 + fresnel * 0.55) * uOpacity;\r\n  alpha *= 0.55 + uEnergy * 0.45;\r\n  col *= (1.3 + uEnergy * 1.8) * flicker;\r\n\r\n  gl_FragColor = vec4(col, alpha);\r\n}\r\n",
	fireballVert: "varying vec3 vNormal;\r\nvarying vec3 vWorldPos;\r\nvarying vec2 vUv;\r\nvarying float vDisp;\r\n\r\nuniform float uTime;\r\nuniform float uDisplacement;\r\n\r\nfloat dispNoise(vec3 p, float t) {\r\n  float n = 0.0;\r\n  n += 0.50 * sin(p.x * 2.6 + t * 1.4) * sin(p.y * 2.2 - t * 1.1) * sin(p.z * 2.4 + t * 0.9);\r\n  n += 0.30 * sin(p.x * 5.1 - t * 2.0) * sin(p.y * 4.7 + t * 1.6) * sin(p.z * 4.9);\r\n  n += 0.15 * sin(p.x * 9.2 + p.z * 7.1 + t * 2.4);\r\n  return n;\r\n}\r\n\r\nvoid main() {\r\n  vUv = uv;\r\n  vec3 nrm = normalize(normal);\r\n  float n = dispNoise(position, uTime);\r\n  float disp = n * uDisplacement;\r\n  vDisp = disp;\r\n  vec3 pos = position + nrm * disp;\r\n  vNormal = normalize(normalMatrix * nrm);\r\n  vec4 world = modelMatrix * vec4(pos, 1.0);\r\n  vWorldPos = world.xyz;\r\n  gl_Position = projectionMatrix * viewMatrix * world;\r\n}\r\n",
	fireballFrag: "varying vec3 vNormal;\r\nvarying vec3 vWorldPos;\r\nvarying vec2 vUv;\r\nvarying float vDisp;\r\n\r\nuniform float uTime;\r\nuniform float uProgress;\r\nuniform float uFade;\r\nuniform sampler2D uFireNoise;\r\nuniform sampler2D uNoise;\r\n\r\nvoid main() {\r\n  vec3 nrm = normalize(vNormal);\r\n  vec3 viewDir = normalize(cameraPosition - vWorldPos);\r\n  float ndv = max(dot(nrm, viewDir), 0.0);\r\n  float fresnel = pow(1.0 - ndv, 1.8);\r\n\r\n  vec2 uv1 = vUv * 2.2 + vec2(uTime * 0.16, -uTime * 0.1);\r\n  vec2 uv2 = vUv * 4.0 - vec2(uTime * 0.12, uTime * 0.08);\r\n  float fire = texture2D(uFireNoise, uv1).r;\r\n  float n = texture2D(uNoise, uv2).r;\r\n  float turb = fire * 0.62 + n * 0.38 + vDisp * 1.8;\r\n\r\n  vec3 hot = vec3(1.0, 0.97, 0.78);\r\n  vec3 yellow = vec3(1.0, 0.78, 0.22);\r\n  vec3 orange = vec3(1.0, 0.38, 0.05);\r\n  vec3 red = vec3(0.62, 0.07, 0.015);\r\n  vec3 smoke = vec3(0.07, 0.04, 0.035);\r\n\r\n  float heat = turb + fresnel * 0.22 - uProgress * 0.48;\r\n  vec3 col = mix(smoke, red, smoothstep(-0.05, 0.22, heat));\r\n  col = mix(col, orange, smoothstep(0.18, 0.48, heat));\r\n  col = mix(col, yellow, smoothstep(0.45, 0.72, heat));\r\n  col = mix(col, hot, smoothstep(0.78, 1.05, heat));\r\n\r\n  float holes = smoothstep(0.08, 0.42, turb + fresnel * 0.4);\r\n  float rim = mix(0.55, 1.0, fresnel);\r\n  float alpha = holes * rim * uFade;\r\n  alpha *= mix(1.0, 0.4, uProgress);\r\n  alpha *= mix(0.8, 1.0, fire);\r\n  alpha = min(alpha, 0.95);\r\n\r\n  float glow = 1.05 + (1.0 - uProgress) * 0.85 * max(heat, 0.0);\r\n  gl_FragColor = vec4(col * glow, alpha);\r\n}\r\n",
	shockwaveVert: "varying vec3 vNormal;\r\nvarying vec3 vWorldPos;\r\nvarying vec2 vUv;\r\n\r\nuniform float uTime;\r\nuniform float uNoiseAmt;\r\n\r\nvoid main() {\r\n  vUv = uv;\r\n  float n = sin(position.x * 6.0 + uTime * 3.0) * sin(position.y * 5.0 - uTime * 2.2) * sin(position.z * 5.5 + uTime);\r\n  vec3 nrm = normalize(normal);\r\n  vec3 pos = position + nrm * n * uNoiseAmt;\r\n  vNormal = normalize(normalMatrix * nrm);\r\n  vec4 world = modelMatrix * vec4(pos, 1.0);\r\n  vWorldPos = world.xyz;\r\n  gl_Position = projectionMatrix * viewMatrix * world;\r\n}\r\n",
	shockwaveFrag: "varying vec3 vNormal;\r\nvarying vec3 vWorldPos;\r\nvarying vec2 vUv;\r\n\r\nuniform float uTime;\r\nuniform float uFade;\r\nuniform float uNoiseAmt;\r\nuniform sampler2D uNoise;\r\n\r\nvoid main() {\r\n  vec3 nrm = normalize(vNormal);\r\n  vec3 viewDir = normalize(cameraPosition - vWorldPos);\r\n  float ndv = max(dot(nrm, viewDir), 0.0);\r\n  float fresnel = pow(1.0 - ndv, 3.2);\r\n\r\n  float n = texture2D(uNoise, vUv * 4.0 + vec2(uTime * 0.25, -uTime * 0.1)).r;\r\n  float band = smoothstep(0.12, 0.55, fresnel) * (1.0 - smoothstep(0.75, 1.0, fresnel));\r\n  band *= mix(0.75, 1.15, n);\r\n\r\n  vec3 col = mix(vec3(1.0, 0.72, 0.28), vec3(1.0, 0.92, 0.7), n);\r\n  float alpha = band * uFade * 0.7;\r\n\r\n  gl_FragColor = vec4(col * 1.8, alpha);\r\n}\r\n",
	billboardVert: "varying vec2 vUv;\r\nvarying vec3 vColor;\r\nvarying float vAlive;\r\nvarying float vSoft;\r\n\r\nattribute vec3 aPosition;\r\nattribute vec3 aColor;\r\nattribute float aSize;\r\nattribute float aRotation;\r\nattribute float aAlive;\r\nattribute float aSoft;\r\n\r\nvoid main() {\r\n  vUv = uv;\r\n  vColor = aColor;\r\n  vAlive = aAlive;\r\n  vSoft = aSoft;\r\n\r\n  if (aAlive < 0.02) {\r\n    gl_Position = vec4(2.0, 2.0, 2.0, 1.0);\r\n    return;\r\n  }\r\n\r\n  vec4 viewPos = modelViewMatrix * vec4(aPosition, 1.0);\r\n  float c = cos(aRotation);\r\n  float s = sin(aRotation);\r\n  vec2 r = vec2(position.x * c - position.y * s, position.x * s + position.y * c);\r\n  viewPos.xy += r * aSize;\r\n  gl_Position = projectionMatrix * viewPos;\r\n}\r\n",
	billboardFrag: "uniform sampler2D uMap;\r\nuniform float uOpacity;\r\nuniform float uPremultiply;\r\n\r\nvarying vec2 vUv;\r\nvarying vec3 vColor;\r\nvarying float vAlive;\r\nvarying float vSoft;\r\n\r\nvoid main() {\r\n  if (vAlive < 0.02) discard;\r\n  vec4 tex = texture2D(uMap, vUv);\r\n  float alpha = tex.a * vAlive * uOpacity;\r\n  vec3 col = vColor * mix(tex.rgb, vec3(1.0), vSoft) * (0.85 + vSoft * 0.8);\r\n  gl_FragColor = vec4(col, alpha);\r\n}\r\n"
}, N = new Float32Array([
	-.5,
	-.5,
	0,
	.5,
	-.5,
	0,
	.5,
	.5,
	0,
	-.5,
	.5,
	0
]), P = new Float32Array([
	0,
	0,
	1,
	0,
	1,
	1,
	0,
	1
]), F = [
	0,
	1,
	2,
	0,
	2,
	3
];
function I(t) {
	let n = new e.InstancedBufferGeometry();
	return n.setAttribute("position", new e.BufferAttribute(N.slice(), 3)), n.setAttribute("uv", new e.BufferAttribute(P.slice(), 2)), n.setIndex(F.slice()), n.instanceCount = t, n.boundingSphere = new e.Sphere(new e.Vector3(), 80), n;
}
function L(t, n, r, i, a = !0) {
	let o = new e.InstancedBufferAttribute(r, i);
	return a && o.setUsage(e.DynamicDrawUsage), t.setAttribute(n, o), o;
}
function R(e) {
	e.traverse((e) => {
		if (e.geometry && e.geometry.dispose(), e.material) {
			let t = Array.isArray(e.material) ? e.material : [e.material];
			for (let e of t) e.dispose();
		}
	});
}
//#endregion
//#region src/vfx/utils/random.js
function z(e = 0, t = 1) {
	return e + Math.random() * (t - e);
}
function B(e, t, n, r) {
	let i = Math.random() * 2 - 1, a = Math.random() * Math.PI * 2, o = Math.sqrt(Math.max(0, 1 - i * i)), s = Math.max(0, n), c = Math.max(s + 1e-4, r), l = Math.random(), u = Math.cbrt(s * s * s + l * (c * c * c - s * s * s));
	f(e, t, Math.cos(a) * o * u, i * u, Math.sin(a) * o * u);
}
function V(e, t, n = 1) {
	let r = Math.random() * 2 - 1, i = Math.random() * Math.PI * 2, a = Math.sqrt(Math.max(0, 1 - r * r)) * n;
	f(e, t, Math.cos(i) * a, r * n, Math.sin(i) * a);
}
var H = [
	[
		.45,
		.02,
		.01
	],
	[
		.72,
		.08,
		.02
	],
	[
		1,
		.28,
		.04
	],
	[
		1,
		.45,
		.06
	],
	[
		1,
		.62,
		.12
	],
	[
		1,
		.82,
		.22
	]
];
function U(e, t, n = .07) {
	if (Math.random() < n) {
		let n = .92 + Math.random() * .08;
		f(e, t, n, n * .96, n * .82);
		return;
	}
	let r = H[Math.random() * H.length | 0], i = H[Math.random() * H.length | 0], a = Math.random();
	f(e, t, r[0] + (i[0] - r[0]) * a, r[1] + (i[1] - r[1]) * a, r[2] + (i[2] - r[2]) * a);
}
//#endregion
//#region src/vfx/systems/EmberConvergenceSystem.js
function W(e) {
	return {
		count: e,
		position: new Float32Array(e * 3),
		velocity: new Float32Array(e * 3),
		color: new Float32Array(e * 3),
		size: new Float32Array(e),
		brightness: new Float32Array(e),
		baseBrightness: new Float32Array(e),
		alive: new Float32Array(e),
		seed: new Float32Array(e),
		spawnPosition: new Float32Array(e * 3),
		direction: new Float32Array(e * 3),
		perp: new Float32Array(e * 3),
		age: new Float32Array(e),
		lifetime: new Float32Array(e),
		deviation: new Float32Array(e),
		arrivedCount: 0,
		spawnedCount: 0,
		activeCount: 0
	};
}
function G(t, n, r, i, a = {}) {
	return new e.ShaderMaterial({
		vertexShader: t,
		fragmentShader: n,
		uniforms: {
			uMap: { value: a.map ?? r.ember },
			uSoftMap: { value: r.emberSoft },
			uTrailScale: { value: i },
			uHeadBias: { value: .65 },
			uOpacity: { value: 1 }
		},
		transparent: !0,
		blending: e.CustomBlending,
		blendEquation: e.AddEquation,
		blendSrc: e.OneFactor,
		blendDst: e.OneFactor,
		depthWrite: !1,
		depthTest: !0,
		toneMapped: !1
	});
}
var ee = class {
	constructor(t, n) {
		this.config = t.embers, this.state = W(this.config.maxActive || this.config.count), this.group = new e.Group(), this.group.name = "EmberConvergence", this._spawnAcc = 0, this._freeHint = 0;
		let r = I(this.state.count);
		this._attrPos = L(r, "aPosition", this.state.position, 3), this._attrVel = L(r, "aVelocity", this.state.velocity, 3), this._attrColor = L(r, "aColor", this.state.color, 3), this._attrSize = L(r, "aSize", this.state.size, 1), this._attrBright = L(r, "aBrightness", this.state.brightness, 1), this._attrAlive = L(r, "aAlive", this.state.alive, 1), this.material = G(M.emberVert, M.emberFrag, n, this.config.trailLength * .14), this.mesh = new e.Mesh(r, this.material), this.mesh.frustumCulled = !1, this.mesh.renderOrder = 6, this.group.add(this.mesh), this.reset();
	}
	reset() {
		let e = this.state;
		e.arrivedCount = 0, e.spawnedCount = 0, e.activeCount = 0, this._spawnAcc = 0, this._freeHint = 0;
		for (let t = 0; t < e.count; t++) {
			e.alive[t] = 0, e.brightness[t] = 0, e.age[t] = 0, e.lifetime[t] = 1;
			let n = t * 3;
			e.position[n] = 0, e.position[n + 1] = 0, e.position[n + 2] = 0, e.velocity[n] = 0, e.velocity[n + 1] = 0, e.velocity[n + 2] = 0;
		}
		this._markAttrs(), this.group.visible = !0, this.material.uniforms.uOpacity.value = 1;
	}
	absorbRemaining() {}
	update(e, t) {
		if (t.state !== n.IDLE && t.state !== n.FINISHED) {
			if (t.state === n.EXPLODING || t.state === n.FADING) {
				this.material.uniforms.uOpacity.value = Math.max(0, this.material.uniforms.uOpacity.value - e * 6), this.material.uniforms.uOpacity.value <= 0 && (this.group.visible = !1);
				return;
			}
			t.allowSpawn && this._spawnEmbers(e), this._integrate(e, t), this._markAttrs();
		}
	}
	getProgress() {
		let e = Math.max(1, this.state.spawnedCount);
		return this.state.arrivedCount / e;
	}
	_spawnEmbers(e) {
		let t = this.config, n = this.state;
		for (this._spawnAcc += e * t.spawnRate, this._spawnAcc > t.spawnRate * .12 && (this._spawnAcc = t.spawnRate * .12); this._spawnAcc >= 1 && n.activeCount < n.count && this._spawnOne();) --this._spawnAcc;
	}
	_spawnOne() {
		let e = this.state, t = e.count, n = -1;
		for (let r = 0; r < t; r++) {
			let i = (this._freeHint + r) % t;
			if (e.alive[i] < .5) {
				n = i;
				break;
			}
		}
		return n < 0 ? !1 : (this._freeHint = (n + 1) % t, this._initEmber(n), e.spawnedCount += 1, e.activeCount += 1, !0);
	}
	_initEmber(e) {
		let t = this.state, n = this.config, r = e * 3, i = n.spawnRadiusMin ?? n.spawnRadius * .65, a = n.spawnRadius;
		B(t.spawnPosition, e, i, a);
		let o = t.spawnPosition[r], s = t.spawnPosition[r + 1], c = t.spawnPosition[r + 2], l = Math.hypot(o, s, c) || 1, u = 1 / l, d = -o * u, f = -s * u, p = -c * u;
		t.direction[r] = d, t.direction[r + 1] = f, t.direction[r + 2] = p;
		let m = f, h = -d, g = 0;
		Math.abs(d) + Math.abs(f) < .2 && (m = 0, h = p, g = -f);
		let _ = Math.hypot(m, h, g) || 1;
		t.perp[r] = m / _, t.perp[r + 1] = h / _, t.perp[r + 2] = g / _;
		let v = z(n.travelDurationMin, n.travelDurationMax), y = l / v;
		t.position[r] = o, t.position[r + 1] = s, t.position[r + 2] = c, t.velocity[r] = d * y, t.velocity[r + 1] = f * y, t.velocity[r + 2] = p * y, U(t.color, e, n.whiteHotChance), t.size[e] = z(n.minSize, n.maxSize), t.baseBrightness[e] = z(n.minBrightness, n.maxBrightness), t.brightness[e] = t.baseBrightness[e], t.alive[e] = 1, t.age[e] = 0, t.lifetime[e] = v, t.seed[e] = z(0, Math.PI * 2), t.deviation[e] = z(.45, 1) * (n.pathDeviation ?? .03) * l;
	}
	_integrate(e, t) {
		let n = this.state, r = this.config, i = 0, a = 1 / Math.max(e, 1e-4);
		for (let o = 0; o < n.count; o++) {
			if (n.alive[o] < .5) continue;
			n.age[o] += e;
			let s = Math.max(n.lifetime[o], .05), l = c(n.age[o] / s), u = l * (.38 + .62 * l), d = o * 3, f = n.spawnPosition[d], p = n.spawnPosition[d + 1], m = n.spawnPosition[d + 2], h = 1 - u, g = f * h, _ = p * h, v = m * h, y = h * h, b = n.seed[o] + l * 2.2, x = n.deviation[o] * y, S = n.perp[d], C = n.perp[d + 1], w = n.perp[d + 2], T = n.direction[d], E = n.direction[d + 1], D = n.direction[d + 2], O = E * w - D * C, k = D * S - T * w, A = T * C - E * S, j = Math.sin(b), M = Math.cos(b * .7);
			g += (S * j + O * M) * x, _ += (C * j + k * M) * x, v += (w * j + A * M) * x;
			let N = n.position[d], P = n.position[d + 1], F = n.position[d + 2], I = (g - N) * a, L = (_ - P) * a, R = (v - F) * a;
			if (l >= .995 || Math.hypot(g, _, v) < r.arrivalRadius) {
				n.alive[o] = 0, n.brightness[o] = 0, n.arrivedCount += 1, t.onEmberArrive(o, n.baseBrightness[o] * n.size[o]);
				continue;
			}
			n.position[d] = g, n.position[d + 1] = _, n.position[d + 2] = v, n.velocity[d] = I, n.velocity[d + 1] = L, n.velocity[d + 2] = R;
			let z = Math.hypot(I, L, R), B = c(n.age[o] * 14);
			n.brightness[o] = n.baseBrightness[o] * B * (.85 + .45 * c(z / r.brightSpeedRef)), i += 1;
		}
		n.activeCount = i;
	}
	_markAttrs() {
		this._attrPos.needsUpdate = !0, this._attrVel.needsUpdate = !0, this._attrBright.needsUpdate = !0, this._attrAlive.needsUpdate = !0, this._attrSize.needsUpdate = !0, this._attrColor.needsUpdate = !0;
	}
	dispose() {
		R(this.group);
	}
}, te = class {
	constructor(t, n, r) {
		this.config = t.embers, this.emberState = r, this.group = new e.Group(), this.group.name = "EmberTrails";
		let i = I(r.count);
		this._attrPos = L(i, "aPosition", r.position, 3), this._attrVel = L(i, "aVelocity", r.velocity, 3), this._attrColor = L(i, "aColor", r.color, 3), this._attrSize = L(i, "aSize", r.size, 1), this._attrBright = L(i, "aBrightness", r.brightness, 1), this._attrAlive = L(i, "aAlive", r.alive, 1), this.material = new e.ShaderMaterial({
			vertexShader: M.trailVert,
			fragmentShader: M.trailFrag,
			uniforms: {
				uMap: { value: n.emberSoft },
				uTrailScale: { value: this.config.trailLength * .28 },
				uOpacity: { value: 1 }
			},
			transparent: !0,
			blending: e.CustomBlending,
			blendEquation: e.AddEquation,
			blendSrc: e.OneFactor,
			blendDst: e.OneFactor,
			depthWrite: !1,
			depthTest: !0,
			toneMapped: !1
		}), this.mesh = new e.Mesh(i, this.material), this.mesh.frustumCulled = !1, this.mesh.renderOrder = 5, this.group.add(this.mesh);
	}
	reset() {
		this.group.visible = !0, this.material.uniforms.uOpacity.value = 1, this._markAttrs();
	}
	update(e, t) {
		if (t.state !== n.IDLE && t.state !== n.FINISHED) {
			if (t.state === n.EXPLODING || t.state === n.FADING) {
				this.material.uniforms.uOpacity.value = Math.max(0, this.material.uniforms.uOpacity.value - e * 7), this.material.uniforms.uOpacity.value <= 0 && (this.group.visible = !1);
				return;
			}
			this._markAttrs();
		}
	}
	_markAttrs() {
		this._attrPos.needsUpdate = !0, this._attrVel.needsUpdate = !0, this._attrColor.needsUpdate = !0, this._attrSize.needsUpdate = !0, this._attrBright.needsUpdate = !0, this._attrAlive.needsUpdate = !0;
	}
	dispose() {
		R(this.group);
	}
}, ne = class {
	constructor(t, n) {
		this.config = t.core, this.explosionRadius = t.explosion.radius, this.group = new e.Group(), this.group.name = "EnergyCore", this.energy = 0, this.maxEnergy = 1, this.visibleEnergy = 0, this._explodeT = 0, this._exploding = !1, this._arrivalFlash = 0;
		let r = new e.IcosahedronGeometry(1, 3);
		this.innerMat = new e.MeshBasicMaterial({
			color: 16774864,
			transparent: !0,
			opacity: 1,
			blending: e.AdditiveBlending,
			depthWrite: !1,
			toneMapped: !1
		}), this.inner = new e.Mesh(r, this.innerMat), this.inner.renderOrder = 8, this.group.add(this.inner);
		let i = new e.IcosahedronGeometry(1, 4);
		this.shellMat = new e.ShaderMaterial({
			vertexShader: M.coreVert,
			fragmentShader: M.coreFrag,
			uniforms: {
				uTime: { value: 0 },
				uDisplacement: { value: .18 },
				uUnstable: { value: 0 },
				uEnergy: { value: 0 },
				uOpacity: { value: 1 },
				uFireNoise: { value: n.fireNoise },
				uNoise: { value: n.noise }
			},
			transparent: !0,
			blending: e.AdditiveBlending,
			depthWrite: !1,
			side: e.DoubleSide,
			toneMapped: !1
		}), this.shell = new e.Mesh(i, this.shellMat), this.shell.renderOrder = 7, this.group.add(this.shell), this.sparkCount = this.config.sparkCount, this._sparkPos = new Float32Array(this.sparkCount * 3), this._sparkColor = new Float32Array(this.sparkCount * 3), this._sparkSize = new Float32Array(this.sparkCount), this._sparkRot = new Float32Array(this.sparkCount), this._sparkAlive = new Float32Array(this.sparkCount), this._sparkSoft = new Float32Array(this.sparkCount), this._sparkPhase = new Float32Array(this.sparkCount), this._sparkRadius = new Float32Array(this.sparkCount), this._sparkSpeed = new Float32Array(this.sparkCount), this._sparkAxis = new Float32Array(this.sparkCount * 3), this._sparkEscape = new Float32Array(this.sparkCount * 3), this._sparkBaseSize = new Float32Array(this.sparkCount);
		let a = I(this.sparkCount);
		this._aPos = L(a, "aPosition", this._sparkPos, 3), this._aColor = L(a, "aColor", this._sparkColor, 3), this._aSize = L(a, "aSize", this._sparkSize, 1), this._aRot = L(a, "aRotation", this._sparkRot, 1), this._aAlive = L(a, "aAlive", this._sparkAlive, 1), this._aSoft = L(a, "aSoft", this._sparkSoft, 1), this.sparkMat = new e.ShaderMaterial({
			vertexShader: M.billboardVert,
			fragmentShader: M.billboardFrag,
			uniforms: {
				uMap: { value: n.spark },
				uOpacity: { value: 1 },
				uPremultiply: { value: 1 }
			},
			transparent: !0,
			blending: e.AdditiveBlending,
			depthWrite: !1,
			toneMapped: !1
		}), this.sparks = new e.Mesh(a, this.sparkMat), this.sparks.frustumCulled = !1, this.sparks.renderOrder = 9, this.group.add(this.sparks), this.light = new e.PointLight(16751162, 0, 8, 2), this.light.visible = this.config.lightEnabled, this.group.add(this.light), this._seedSparks(), this.group.visible = !1;
	}
	_seedSparks() {
		for (let e = 0; e < this.sparkCount; e++) {
			V(this._sparkAxis, e, 1);
			let t = e * 3;
			this._sparkColor[t] = 1, this._sparkColor[t + 1] = .55 + Math.random() * .4, this._sparkColor[t + 2] = .15 + Math.random() * .25, this._sparkPhase[e] = z(0, Math.PI * 2), this._sparkRadius[e] = z(.55, 1.35), this._sparkSpeed[e] = z(1.2, 3.8) * (Math.random() < .5 ? -1 : 1), this._sparkBaseSize[e] = z(.07, .18), this._sparkSize[e] = this._sparkBaseSize[e], this._sparkRot[e] = z(0, Math.PI * 2), this._sparkAlive[e] = 1, this._sparkSoft[e] = +(Math.random() < .4), this._sparkEscape[t] = 0, this._sparkEscape[t + 1] = 0, this._sparkEscape[t + 2] = 0;
		}
	}
	reset() {
		this.energy = 0, this.visibleEnergy = 0, this._explodeT = 0, this._exploding = !1, this._arrivalFlash = 0, this.group.visible = !1, this.inner.scale.setScalar(.001), this.shell.scale.setScalar(.001), this.innerMat.opacity = 1, this.shellMat.uniforms.uOpacity.value = 1, this.sparkMat.uniforms.uOpacity.value = 1, this.light.intensity = 0, this._seedSparks();
	}
	setMaxEnergy(e) {
		this.maxEnergy = Math.max(e, 1e-4);
	}
	addEnergy(e) {
		this.energy = Math.min(this.maxEnergy, this.energy + e);
	}
	addArrivalFlash(e = .22) {
		this._arrivalFlash = Math.min(2.4, this._arrivalFlash + e);
	}
	beginExplosion() {
		this._exploding = !0, this._explodeT = 0;
	}
	get energy01() {
		return c(this.energy / this.maxEnergy);
	}
	update(e, t) {
		if (!this.config.enabled) {
			this.group.visible = !1;
			return;
		}
		if (t.state === n.IDLE) return;
		this._arrivalFlash *= Math.exp(-11 * e);
		let r = this._arrivalFlash, i = t.coreReveal ?? 0, a = i > .001 ? this.energy01 : 0, o = i > .001 && this.visibleEnergy < a * .4 ? 8 : 5;
		this.visibleEnergy = l(this.visibleEnergy, a, 1 - Math.exp(-o * e));
		let s = this.visibleEnergy, d = r > .02 || i > .02 || this._exploding || t.state === n.EXPLODING;
		if (this.group.visible = d, !d && t.state !== n.EXPLODING && t.state !== n.FADING) {
			this.light.intensity = 0;
			return;
		}
		let f = t.state === n.CHARGING || t.state === n.EXPLODING ? c(s * .65 + (t.state === n.CHARGING ? t.charge01 : 1) * .55) : s * .22;
		if (this._exploding) {
			this._explodeT += e;
			let t = u(c(this._explodeT / .22)), n = c(1 - (this._explodeT - .12) / .45), r = Math.max(this.explosionRadius, .01), i = .12 + s * this.config.maxScale * .28, a = .28 + s * this.config.maxScale;
			this.inner.scale.setScalar(i * (1 - t) + r * .2 * t), this.shell.scale.setScalar(a * (1 - t) + r * .45 * t), this.innerMat.opacity = n, this.shellMat.uniforms.uOpacity.value = n, this.sparkMat.uniforms.uOpacity.value = n, this.light.intensity = this.config.lightMaxIntensity * s * n * 1.6, n <= 0 && (this.group.visible = !1);
		} else {
			let e = 3.5 + s * 16 * this.config.pulseIntensity, n = 1 + Math.sin(t.time * e) * (.04 + s * .12) * this.config.pulseIntensity, a = 1 + Math.sin(t.time * 29) * s * .08 * f, o = (.08 + s * this.config.maxScale) * n * a;
			this.inner.scale.setScalar(o * .26 + r * .42), this.shell.scale.setScalar(Math.max(.001, o * i + r * .18)), this.innerMat.opacity = c(.2 + s * .75 + r * .85), this.shellMat.uniforms.uOpacity.value = c(i * (.35 + s * .65) + r * .15), this.sparkMat.uniforms.uOpacity.value = c(i * (.25 + s)), this.light.intensity = this.config.lightMaxIntensity * s * s * (.5 + n * .2) + r * 6;
		}
		this.inner.material.color.setRGB(1, l(.82, .95, s), l(.45, .78, s)), this.light.color.setRGB(1, l(.45, .72, s), l(.12, .28, s)), this.light.distance = l(6, this.config.lightMaxDistance, s), this.shellMat.uniforms.uTime.value = t.time, this.shellMat.uniforms.uEnergy.value = s, this.shellMat.uniforms.uUnstable.value = f, this.shellMat.uniforms.uDisplacement.value = .12 + s * .28 + f * .22, this._updateSparks(e, s, f);
	}
	_updateSparks(e, t, n) {
		let r = Math.floor(l(12, this.sparkCount, c(t * 1.2)));
		for (let i = 0; i < this.sparkCount; i++) {
			if (i >= r) {
				this._sparkAlive[i] = 0;
				continue;
			}
			this._sparkAlive[i] = 1, this._sparkPhase[i] += this._sparkSpeed[i] * e * (1.2 + n * 2.2), this._sparkRot[i] += e * 2.5;
			let a = i * 3, o = this._sparkAxis[a], s = this._sparkAxis[a + 1], c = this._sparkAxis[a + 2], l = this._sparkPhase[i], u = (.35 + t * this.config.maxScale * .85) * this._sparkRadius[i] * (1 + Math.sin(l * 2.2) * .12), d = s, f = -o, p = 0;
			Math.abs(o) + Math.abs(s) < .2 && (d = 0, f = c, p = -s);
			let m = Math.hypot(d, f, p) || 1;
			d /= m, f /= m, p /= m;
			let h = s * p - c * f, g = c * d - o * p, _ = o * f - s * d, v = Math.cos(l), y = Math.sin(l), b = (d * v + h * y) * u, x = (f * v + g * y) * u, S = (p * v + _ * y) * u;
			n > .55 && Math.random() < n * .08 && (this._sparkEscape[a] += (Math.random() - .5) * 4, this._sparkEscape[a + 1] += (Math.random() - .5) * 4, this._sparkEscape[a + 2] += (Math.random() - .5) * 4), this._sparkEscape[a] *= Math.exp(-1.8 * e), this._sparkEscape[a + 1] *= Math.exp(-1.8 * e), this._sparkEscape[a + 2] *= Math.exp(-1.8 * e), b += this._sparkEscape[a] * e * 8, x += this._sparkEscape[a + 1] * e * 8, S += this._sparkEscape[a + 2] * e * 8, this._sparkPos[a] = b, this._sparkPos[a + 1] = x, this._sparkPos[a + 2] = S, this._sparkSize[i] = this._sparkBaseSize[i] * (.8 + t * 1.1);
		}
		this._aPos.needsUpdate = !0, this._aSize.needsUpdate = !0, this._aRot.needsUpdate = !0, this._aAlive.needsUpdate = !0;
	}
	dispose() {
		R(this.group);
	}
}, re = class {
	constructor(t, n) {
		this.config = t.explosion, this.group = new e.Group(), this.group.name = "Fireball", this.elapsed = 0, this.active = !1;
		let r = new e.IcosahedronGeometry(1, 2);
		this.hotFlashMat = new e.MeshBasicMaterial({
			color: 16775392,
			transparent: !0,
			opacity: 0,
			blending: e.AdditiveBlending,
			depthWrite: !1,
			toneMapped: !1
		}), this.hotFlash = new e.Mesh(r, this.hotFlashMat), this.hotFlash.renderOrder = 12, this.softFlashMat = new e.MeshBasicMaterial({
			color: 16760928,
			transparent: !0,
			opacity: 0,
			blending: e.AdditiveBlending,
			depthWrite: !1,
			toneMapped: !1
		}), this.softFlash = new e.Mesh(r.clone(), this.softFlashMat), this.softFlash.renderOrder = 11;
		let i = new e.IcosahedronGeometry(1, 5);
		this.ballMat = new e.ShaderMaterial({
			vertexShader: M.fireballVert,
			fragmentShader: M.fireballFrag,
			uniforms: {
				uTime: { value: 0 },
				uDisplacement: { value: .2 },
				uProgress: { value: 0 },
				uFade: { value: 0 },
				uFireNoise: { value: n.fireNoise },
				uNoise: { value: n.noise }
			},
			transparent: !0,
			depthWrite: !1,
			side: e.DoubleSide,
			toneMapped: !1
		}), this.ball = new e.Mesh(i, this.ballMat), this.ball.renderOrder = 3, this.innerGlowMat = new e.MeshBasicMaterial({
			color: 16769162,
			transparent: !0,
			opacity: 0,
			blending: e.AdditiveBlending,
			depthWrite: !1,
			toneMapped: !1
		}), this.innerGlow = new e.Mesh(new e.IcosahedronGeometry(1, 3), this.innerGlowMat), this.innerGlow.renderOrder = 4, this.group.add(this.ball, this.innerGlow, this.softFlash, this.hotFlash), this.group.visible = !1;
	}
	reset() {
		this.elapsed = 0, this.active = !1, this.group.visible = !1, this.hotFlashMat.opacity = 0, this.softFlashMat.opacity = 0, this.innerGlowMat.opacity = 0, this.ballMat.uniforms.uFade.value = 0, this.ball.scale.setScalar(.01), this.hotFlash.scale.setScalar(.01), this.softFlash.scale.setScalar(.01), this.innerGlow.scale.setScalar(.01);
	}
	trigger() {
		this.elapsed = 0, this.active = !0, this.group.visible = !0;
	}
	update(e, t) {
		if (!this.active || t.state !== n.EXPLODING && t.state !== n.FADING) return;
		this.elapsed += e;
		let r = this.elapsed, i = this.config.duration, a = this.config.radius, o = c(r / i), s = c(r / this.config.flashDuration), l = 1 - s, d = u(s);
		this.hotFlash.scale.setScalar(a * K(.1, .28, d)), this.softFlash.scale.setScalar(a * K(.18, .48, d)), this.hotFlashMat.opacity = l, this.softFlashMat.opacity = l * .4;
		let f = K(.35, a, u(o));
		this.ball.scale.setScalar(f), this.innerGlow.scale.setScalar(f * K(.55, .28, o));
		let p = 1 - c((o - .42) / .58);
		this.ballMat.uniforms.uTime.value = t.time, this.ballMat.uniforms.uProgress.value = o, this.ballMat.uniforms.uFade.value = p, this.ballMat.uniforms.uDisplacement.value = .14 + o * .38, this.innerGlowMat.opacity = p * (1 - o) * .7, o >= 1 && p <= 0 && (this.group.visible = !1);
	}
	dispose() {
		R(this.group);
	}
};
function K(e, t, n) {
	return e + (t - e) * n;
}
//#endregion
//#region src/vfx/systems/SparkBurstSystem.js
var q = class {
	constructor(t, n) {
		this.config = t.sparks, this.group = new e.Group(), this.group.name = "SparkBurst", this.elapsed = 0, this.active = !1, this.count = this.config.count, this.position = new Float32Array(this.count * 3), this.velocity = new Float32Array(this.count * 3), this.color = new Float32Array(this.count * 3), this.size = new Float32Array(this.count), this.brightness = new Float32Array(this.count), this.alive = new Float32Array(this.count), this.life = new Float32Array(this.count), this.maxLife = new Float32Array(this.count);
		let r = I(this.count);
		this._aPos = L(r, "aPosition", this.position, 3), this._aVel = L(r, "aVelocity", this.velocity, 3), this._aColor = L(r, "aColor", this.color, 3), this._aSize = L(r, "aSize", this.size, 1), this._aBright = L(r, "aBrightness", this.brightness, 1), this._aAlive = L(r, "aAlive", this.alive, 1), this.material = new e.ShaderMaterial({
			vertexShader: M.emberVert,
			fragmentShader: M.emberFrag,
			uniforms: {
				uMap: { value: n.spark },
				uSoftMap: { value: n.emberSoft },
				uTrailScale: { value: .18 },
				uHeadBias: { value: .5 },
				uOpacity: { value: 1 }
			},
			transparent: !0,
			blending: e.CustomBlending,
			blendEquation: e.AddEquation,
			blendSrc: e.OneFactor,
			blendDst: e.OneFactor,
			depthWrite: !1,
			toneMapped: !1
		}), this.mesh = new e.Mesh(r, this.material), this.mesh.frustumCulled = !1, this.mesh.renderOrder = 10, this.group.add(this.mesh), this.group.visible = !1;
	}
	reset() {
		this.elapsed = 0, this.active = !1, this.group.visible = !1, this.material.uniforms.uOpacity.value = 1;
		for (let e = 0; e < this.count; e++) this.alive[e] = 0;
		this._aAlive.needsUpdate = !0;
	}
	trigger() {
		if (!this.config.enabled) return;
		this.elapsed = 0, this.active = !0, this.group.visible = !0;
		let e = this.config;
		for (let t = 0; t < this.count; t++) {
			let n = t * 3, r = z(e.minSpeed, e.maxSpeed) * (Math.random() < .12 ? z(1.4, 2.1) : 1);
			V(this.velocity, t, r), this.position[n] = this.velocity[n] * .02, this.position[n + 1] = this.velocity[n + 1] * .02, this.position[n + 2] = this.velocity[n + 2] * .02, U(this.color, t, .12), this.size[t] = z(.1, .32), this.maxLife[t] = e.life * z(.45, 1.15), this.life[t] = this.maxLife[t], this.alive[t] = 1, this.brightness[t] = z(.8, 1.5);
		}
		this._mark();
	}
	update(e, t) {
		if (!this.active || !this.config.enabled || t.state !== n.EXPLODING && t.state !== n.FADING) return;
		this.elapsed += e;
		let r = Math.exp(-this.config.drag * e), i = 0;
		for (let t = 0; t < this.count; t++) {
			if (this.alive[t] < .5) continue;
			if (this.life[t] -= e, this.life[t] <= 0) {
				this.alive[t] = 0, this.brightness[t] = 0;
				continue;
			}
			let n = t * 3;
			this.velocity[n] *= r, this.velocity[n + 1] *= r, this.velocity[n + 2] *= r, this.velocity[n + 1] -= 1.6 * e, this.position[n] += this.velocity[n] * e, this.position[n + 1] += this.velocity[n + 1] * e, this.position[n + 2] += this.velocity[n + 2] * e;
			let a = c(this.life[t] / this.maxLife[t]);
			this.brightness[t] = a * (.7 + (1 - a) * .2), this.alive[t] = a, i += 1;
		}
		this._mark(), i === 0 && this.elapsed > .4 && (this.group.visible = !1);
	}
	_mark() {
		this._aPos.needsUpdate = !0, this._aVel.needsUpdate = !0, this._aBright.needsUpdate = !0, this._aAlive.needsUpdate = !0;
	}
	dispose() {
		R(this.group);
	}
}, J = class {
	constructor(t, n) {
		this.config = t.shockwave, this.radius = t.explosion.radius, this.group = new e.Group(), this.group.name = "Shockwave", this.elapsed = 0, this.active = !1;
		let r = new e.SphereGeometry(1, 64, 48);
		this.material = new e.ShaderMaterial({
			vertexShader: M.shockwaveVert,
			fragmentShader: M.shockwaveFrag,
			uniforms: {
				uTime: { value: 0 },
				uFade: { value: 0 },
				uNoiseAmt: { value: .04 },
				uNoise: { value: n.noise }
			},
			transparent: !0,
			blending: e.AdditiveBlending,
			depthWrite: !1,
			side: e.DoubleSide,
			toneMapped: !1
		}), this.mesh = new e.Mesh(r, this.material), this.mesh.renderOrder = 2, this.group.add(this.mesh), this.group.visible = !1;
	}
	reset() {
		this.elapsed = 0, this.active = !1, this.group.visible = !1, this.mesh.scale.setScalar(.01), this.material.uniforms.uFade.value = 0;
	}
	trigger() {
		this.config.enabled && (this.elapsed = 0, this.active = !0, this.group.visible = !0);
	}
	update(e, t) {
		if (!this.active || !this.config.enabled || t.state !== n.EXPLODING && t.state !== n.FADING) return;
		this.elapsed += e;
		let r = c(this.elapsed / this.config.duration), i = d(r);
		this.mesh.scale.setScalar(.4 + this.radius * 1.55 * i), this.material.uniforms.uTime.value = t.time, this.material.uniforms.uFade.value = (1 - r) * (.35 + (1 - r) * .65), this.material.uniforms.uNoiseAmt.value = .03 + r * .05, r >= 1 && (this.group.visible = !1);
	}
	dispose() {
		R(this.group);
	}
}, Y = [
	[
		.28,
		.05,
		.02
	],
	[
		.22,
		.07,
		.02
	],
	[
		.12,
		.08,
		.07
	],
	[
		.18,
		.16,
		.15
	],
	[
		.08,
		.07,
		.07
	]
], ie = class {
	constructor(t, n) {
		this.config = t.smoke, this.radius = t.explosion.radius, this.group = new e.Group(), this.group.name = "Smoke", this.elapsed = 0, this.active = !1, this.count = this.config.count, this.position = new Float32Array(this.count * 3), this.velocity = new Float32Array(this.count * 3), this.color = new Float32Array(this.count * 3), this.size = new Float32Array(this.count), this.baseSize = new Float32Array(this.count), this.rotation = new Float32Array(this.count), this.rotSpeed = new Float32Array(this.count), this.alive = new Float32Array(this.count), this.soft = new Float32Array(this.count), this.life = new Float32Array(this.count), this.maxLife = new Float32Array(this.count), this.delay = new Float32Array(this.count);
		let r = I(this.count);
		this._aPos = L(r, "aPosition", this.position, 3), this._aColor = L(r, "aColor", this.color, 3), this._aSize = L(r, "aSize", this.size, 1), this._aRot = L(r, "aRotation", this.rotation, 1), this._aAlive = L(r, "aAlive", this.alive, 1), this._aSoft = L(r, "aSoft", this.soft, 1), this.material = new e.ShaderMaterial({
			vertexShader: M.billboardVert,
			fragmentShader: M.billboardFrag,
			uniforms: {
				uMap: { value: n.smoke },
				uOpacity: { value: .85 },
				uPremultiply: { value: 0 }
			},
			transparent: !0,
			blending: e.NormalBlending,
			depthWrite: !1,
			toneMapped: !0
		}), this.mesh = new e.Mesh(r, this.material), this.mesh.frustumCulled = !1, this.mesh.renderOrder = 1, this.group.add(this.mesh), this.group.visible = !1;
	}
	reset() {
		this.elapsed = 0, this.active = !1, this.group.visible = !1;
		for (let e = 0; e < this.count; e++) this.alive[e] = 0;
		this._aAlive.needsUpdate = !0;
	}
	trigger() {
		if (!this.config.enabled) return;
		this.elapsed = 0, this.active = !0, this.group.visible = !0;
		let e = this.config;
		for (let t = 0; t < this.count; t++) {
			let n = t * 3, r = z(.6, 3.4);
			V(this.velocity, t, r), this.position[n] = this.velocity[n] * .15, this.position[n + 1] = this.velocity[n + 1] * .15, this.position[n + 2] = this.velocity[n + 2] * .15;
			let i = Y[Math.random() * Y.length | 0];
			this.color[n] = i[0] * z(.7, 1.15), this.color[n + 1] = i[1] * z(.7, 1.15), this.color[n + 2] = i[2] * z(.7, 1.15), this.baseSize[t] = z(e.minSize, e.maxSize), this.size[t] = this.baseSize[t] * .2, this.rotation[t] = z(0, Math.PI * 2), this.rotSpeed[t] = z(-.6, .6), this.maxLife[t] = e.duration * z(.55, 1.15), this.life[t] = this.maxLife[t], this.delay[t] = z(.05, .35), this.alive[t] = 0, this.soft[t] = 1;
		}
		this._mark();
	}
	update(e, t) {
		if (!this.active || !this.config.enabled || t.state !== n.EXPLODING && t.state !== n.FADING) return;
		this.elapsed += e;
		let r = Math.exp(-.55 * e), i = 0;
		for (let t = 0; t < this.count; t++) {
			if (this.delay[t] > 0) {
				this.delay[t] -= e;
				continue;
			}
			if (this.life[t] -= e, this.life[t] <= 0) {
				this.alive[t] = 0;
				continue;
			}
			let n = t * 3;
			this.velocity[n] *= r, this.velocity[n + 1] *= r, this.velocity[n + 2] *= r, this.velocity[n + 1] += .35 * e, this.position[n] += this.velocity[n] * e, this.position[n + 1] += this.velocity[n + 1] * e, this.position[n + 2] += this.velocity[n + 2] * e, this.rotation[t] += this.rotSpeed[t] * e;
			let a = c(this.life[t] / this.maxLife[t]), o = 1 - a;
			this.size[t] = this.baseSize[t] * (.35 + o * 1.6);
			let s = c((this.maxLife[t] - this.life[t]) / .35);
			this.alive[t] = s * a * a, i += 1;
		}
		this._mark(), i === 0 && this.elapsed > .6 && (this.group.visible = !1);
	}
	_mark() {
		this._aPos.needsUpdate = !0, this._aSize.needsUpdate = !0, this._aRot.needsUpdate = !0, this._aAlive.needsUpdate = !0;
	}
	dispose() {
		R(this.group);
	}
}, ae = class {
	constructor(t) {
		this.effect = t, this.group = new e.Group(), this.group.name = "EffectDebug", this.origin = new e.Mesh(new e.SphereGeometry(.08, 12, 12), new e.MeshBasicMaterial({
			color: 16777215,
			depthTest: !1
		})), this.origin.renderOrder = 20, this.spawnWire = new e.Mesh(new e.SphereGeometry(1, 24, 16), new e.MeshBasicMaterial({
			color: 16746564,
			wireframe: !0,
			transparent: !0,
			opacity: .28,
			depthTest: !1
		})), this.spawnWire.renderOrder = 20, this.spawnMinWire = new e.Mesh(new e.SphereGeometry(1, 20, 14), new e.MeshBasicMaterial({
			color: 16764006,
			wireframe: !0,
			transparent: !0,
			opacity: .16,
			depthTest: !1
		})), this.spawnMinWire.renderOrder = 20, this.explosionWire = new e.Mesh(new e.SphereGeometry(1, 24, 16), new e.MeshBasicMaterial({
			color: 6737151,
			wireframe: !0,
			transparent: !0,
			opacity: .18,
			depthTest: !1
		})), this.explosionWire.renderOrder = 20, this.axes = new e.AxesHelper(1.5), this.group.add(this.origin, this.spawnMinWire, this.spawnWire, this.explosionWire, this.axes), this.group.visible = !1;
	}
	setEnabled(e) {
		this.group.visible = !!e;
	}
	update() {
		let e = this.effect.config;
		this.spawnWire.scale.setScalar(e.embers.spawnRadius), this.spawnMinWire.scale.setScalar(e.embers.spawnRadiusMin || e.embers.spawnRadius * .65), this.explosionWire.scale.setScalar(e.explosion.radius);
	}
	formatHud() {
		let e = this.effect.getDebugInfo(), t = se(e.energy01);
		return [
			`STATE    ${e.state}`,
			`TIME     ${e.time.toFixed(2)}s / ${e.totalDuration.toFixed(2)}s`,
			`DURATION ember ${e.emberDuration.toFixed(2)}s  charge ${e.chargeDuration.toFixed(2)}s  blast ${e.blastDuration.toFixed(2)}s`,
			`PHASE    ${e.phaseElapsed.toFixed(2)}s / ${e.phaseDuration.toFixed(2)}s`,
			`EMBERS   ${e.emberAlive} alive / ${e.emberArrived} arrived / ${e.emberSpawned ?? 0} spawned`,
			`ENERGY   ${t} ${(e.energy01 * 100).toFixed(0)}%`,
			`ORIGIN   ${oe(e.position)}`,
			`SPAWN R  ${e.spawnRadiusMin?.toFixed?.(1) ?? "?"}–${e.spawnRadius.toFixed(1)}   BLAST R ${e.explosionRadius.toFixed(1)}`
		].join("\n");
	}
	dispose() {
		this.group.traverse((e) => {
			e.geometry && e.geometry.dispose(), e.material && e.material.dispose();
		});
	}
};
function oe(e) {
	return `${e.x.toFixed(1)}, ${e.y.toFixed(1)}, ${e.z.toFixed(1)}`;
}
function se(e) {
	let t = Math.round(e * 16);
	return "[" + "#".repeat(t) + "-".repeat(16 - t) + "]";
}
var X = new URL("data:image/png;base64,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", "" + import.meta.url).href;
function Z(e) {
	let t = e?.image, n = t?.width ?? 0, r = t?.height ?? 0, i = t?.data, a = 0, o = 0;
	return i && n && r && (a = i[(Math.floor(n / 2) + Math.floor(r / 2) * n) * 4 + 3] / 255, o = i[3] / 255), {
		loaded: !!(e && n > 0 && r > 0 && a > .04),
		width: n,
		height: r,
		centerAlpha: a,
		cornerAlpha: o
	};
}
function ce(e) {
	let t = e?.width ?? 0, n = e?.height ?? 0;
	if (!e || t <= 0 || n <= 0) return {
		loaded: !1,
		width: t,
		height: n,
		centerAlpha: 0,
		cornerAlpha: 0
	};
	try {
		let r = document.createElement("canvas");
		r.width = t, r.height = n;
		let i = r.getContext("2d", { willReadFrequently: !0 });
		i.drawImage(e, 0, 0);
		let a = i.getImageData(t >> 1, n >> 1, 1, 1).data, o = i.getImageData(0, 0, 1, 1).data, s = a[3] / 255, c = o[3] / 255;
		return {
			loaded: s > .04,
			width: t,
			height: n,
			centerAlpha: s,
			cornerAlpha: c
		};
	} catch {
		return {
			loaded: !0,
			width: t,
			height: n,
			centerAlpha: 1,
			cornerAlpha: 0
		};
	}
}
function le(e) {
	console.log(`Ember texture:\nloaded: ${!!e.loaded}\nwidth: ${e.width}\nheight: ${e.height}`);
}
function Q(t = 128) {
	let n = new Uint8Array(t * t * 4), r = (t - 1) * .5, i = 2 / t;
	for (let e = 0; e < t; e++) for (let a = 0; a < t; a++) {
		let o = (a - r) * i, s = (e - r) * i, c = o * o + s * s, l = Math.exp(-c * 16), u = Math.exp(-c * 5.5), d = Math.exp(-c * 1.8), f = l * .95 + u * .55 + d * .18, p = (e * t + a) * 4;
		n[p] = Math.round(Math.min(1, l * 1.15 + u * 1 + d * .4) * 255), n[p + 1] = Math.round(Math.min(1, l * .95 + u * .42 + d * .08) * 255), n[p + 2] = Math.round(Math.min(1, l * .55 + u * .08) * 255), n[p + 3] = Math.round(Math.min(1, f) * 255);
	}
	let a = new e.DataTexture(n, t, t, e.RGBAFormat);
	return a.needsUpdate = !0, a.flipY = !0, a.name = "emberRadialFallback", a.minFilter = e.LinearFilter, a.magFilter = e.LinearFilter, a.generateMipmaps = !1, a.colorSpace = e.SRGBColorSpace, a;
}
var ue = class {
	constructor(t) {
		this.effect = t, this.stage = 6, this.group = new e.Group(), this.group.name = "EmberRenderProbe", this._loggedTexture = !1, this._matrix = new e.Matrix4(), this._position = new e.Vector3(), this._quaternion = new e.Quaternion(), this._parentQuat = new e.Quaternion(), this._scale = new e.Vector3(), this._color = new e.Color(), this._camPos = new e.Vector3(), this._firstPos = new e.Vector3(), this._firstScale = 0, this._camDist = 0, this._visibleCount = 0, this.axes = new e.AxesHelper(2), this.axes.visible = !1, this.group.add(this.axes);
		let n = t.config.embers.spawnRadius;
		this.spawnWire = new e.Mesh(new e.SphereGeometry(1, 24, 16), new e.MeshBasicMaterial({
			color: 16746564,
			wireframe: !0,
			toneMapped: !1,
			fog: !1,
			depthTest: !1,
			depthWrite: !1
		})), this.spawnWire.scale.setScalar(n), this.spawnWire.visible = !1, this.group.add(this.spawnWire);
		let r = t.embers.state.count, i = new e.PlaneGeometry(1, 1);
		this.fallbackMaterial = new e.MeshBasicMaterial({
			color: 16737792,
			side: e.DoubleSide,
			toneMapped: !1,
			fog: !1,
			depthTest: !1,
			depthWrite: !1,
			transparent: !1,
			blending: e.NoBlending
		});
		let a = t.textures?.ember, o = Z(a);
		this._textureSource = "runtime DataTexture", this.map = a, o.loaded || (this.map = Q(128), this._textureSource = "generated radial fallback", o = Z(this.map)), this._texInfo = o, this.texturedMaterial = new e.MeshBasicMaterial({
			map: this.map,
			color: 16777215,
			side: e.DoubleSide,
			toneMapped: !1,
			fog: !1,
			depthTest: !1,
			depthWrite: !1,
			transparent: !0,
			blending: e.AdditiveBlending
		});
		let s = o.loaded ? this.texturedMaterial : this.fallbackMaterial;
		this._usingTexture = s === this.texturedMaterial, this.instanced = new e.InstancedMesh(i, s, r), this.instanced.name = "EmberStage6Instances", this.instanced.frustumCulled = !1, this.instanced.renderOrder = 50, this.group.add(this.instanced), this._loadEmberPng();
	}
	_logTextureOnce(e, t) {
		this._loggedTexture || (this._loggedTexture = !0, this._texInfo = e, this._textureSource = t, le(e));
	}
	_applyTexture(e, t, n) {
		this.map = e, this.texturedMaterial.map = e, this.texturedMaterial.needsUpdate = !0, this.instanced.material = this.texturedMaterial, this._usingTexture = !0, this._texInfo = t, this._textureSource = n;
	}
	_useFallback() {
		this.instanced.material = this.fallbackMaterial, this._usingTexture = !1;
	}
	_loadEmberPng() {
		new e.TextureLoader().load(X, (t) => {
			t.colorSpace = e.SRGBColorSpace, t.minFilter = e.LinearFilter, t.magFilter = e.LinearFilter, t.generateMipmaps = !0, t.flipY = !0;
			let n = ce(t.image);
			if (n.loaded) this._applyTexture(t, n, "ember.png");
			else if (!this._usingTexture) {
				let e = Q(128), t = Z(e);
				t.loaded ? this._applyTexture(e, t, "generated radial fallback") : this._useFallback();
			}
			this._logTextureOnce(n.loaded ? n : this._texInfo, this._textureSource);
		}, void 0, () => {
			if (!this._texInfo?.loaded) {
				let e = Q(128), t = Z(e);
				t.loaded ? this._applyTexture(e, t, "generated radial fallback") : this._useFallback();
			}
			this._logTextureOnce(this._texInfo, `${this._textureSource} (ember.png failed)`);
		});
	}
	update(e) {
		let t = this.effect.embers.state, n = t.count, r = 0, i = -1;
		this.instanced.updateWorldMatrix(!0, !1), this.instanced.getWorldQuaternion(this._parentQuat), e ? this._quaternion.copy(this._parentQuat).invert().multiply(e.quaternion) : this._quaternion.identity();
		for (let e = 0; e < n; e++) {
			let n = t.alive[e] > .5, a = e * 3;
			if (n) {
				this._position.set(t.position[a], t.position[a + 1], t.position[a + 2]);
				let n = Math.max((t.size[e] || .48) * .8, .37);
				this._scale.setScalar(n);
				let o = Math.min(Math.max(t.brightness[e] || 1, .5), 1.55) * .88;
				this._color.setRGB(t.color[a] * o, t.color[a + 1] * o, t.color[a + 2] * o), r += 1, i < 0 && (i = e, this._firstPos.copy(this._position), this._firstScale = n);
			} else this._position.set(0, 0, 0), this._scale.set(0, 0, 0), this._color.setRGB(0, 0, 0);
			this._matrix.compose(this._position, this._quaternion, this._scale), this.instanced.setMatrixAt(e, this._matrix), this.instanced.setColorAt(e, this._color);
		}
		this.instanced.instanceMatrix.needsUpdate = !0, this.instanced.instanceColor && (this.instanced.instanceColor.needsUpdate = !0), this._visibleCount = r, e && i >= 0 && (e.getWorldPosition(this._camPos), this._camDist = this._firstPos.distanceTo(this._camPos));
	}
	formatHud() {
		let e = this.effect.embers?.state?.activeCount ?? 0, t = this._firstPos, n = this._texInfo || {};
		return [
			"EMBER RENDER TEST",
			`Live particles: ${e}`,
			"----------------",
			"Renderer: InstancedMesh",
			"Geometry: PlaneGeometry",
			`Material: MeshBasicMaterial${this._usingTexture ? " + map" : " fallback"}`,
			`Stage: ${this.stage} textured billboards`,
			`Visible: ${this._visibleCount}`,
			`Texture: ${n.loaded ? "ok" : "FAIL"} ${n.width || 0}x${n.height || 0}`,
			`First position: ${t.x.toFixed(2)} ${t.y.toFixed(2)} ${t.z.toFixed(2)}`,
			`First scale: ${this._firstScale.toFixed(2)}`,
			`Camera distance: ${this._camDist.toFixed(2)}`
		].join("\n");
	}
	dispose() {
		this.group.remove(this.instanced), this.instanced.geometry.dispose(), this.fallbackMaterial.dispose(), this.texturedMaterial.dispose(), this.spawnWire.geometry.dispose(), this.spawnWire.material.dispose(), this.axes.dispose?.();
	}
}, de = class {
	constructor(r = {}) {
		this.config = s(r), this.object3D = new e.Group(), this.object3D.name = "EmberExplosionEffect", this.object3D.position.copy(this.config.position), this.state = n.IDLE, this.time = 0, this._chargeTime = 0, this._explodeTime = 0, this._loopWait = 0, this._sinceEmpty = 0, this._ownsTextures = !r.textures, this.textures = r.textures || A(), this._events = new t(), this.embers = new ee(this.config, this.textures), this.trails = new te(this.config, this.textures, this.embers.state), this.core = new ne(this.config, this.textures), this.fireball = new re(this.config, this.textures), this.sparks = new q(this.config, this.textures), this.shockwave = new J(this.config, this.textures), this.smoke = new ie(this.config, this.textures), this.debugger = new ae(this), this.renderProbe = new ue(this), this.object3D.add(this.smoke.group, this.shockwave.group, this.fireball.group, this.trails.group, this.embers.group, this.core.group, this.sparks.group, this.debugger.group, this.renderProbe.group), this._ctx = {
			time: 0,
			dt: 0,
			state: this.state,
			charge01: 0,
			energy01: 0,
			allowSpawn: !1,
			coreReveal: 0,
			onEmberArrive: (e, t) => {
				this.core.addEnergy(t), this.core.addArrivalFlash(.2), this._events.emit("emberArrive", {
					index: e,
					amount: t,
					energy: this.core.energy01
				});
			}
		}, this._syncCoreBudget(), this.debugger.setEnabled(this.config.debug), this.debugger.update(), this.config.autoStart && this.start();
	}
	on(e, t) {
		return this._events.on(e, t), this;
	}
	off(e, t) {
		return this._events.off(e, t), this;
	}
	start() {
		return this.reset(), this.object3D.visible = !0, this._setState(n.CONVERGING), this;
	}
	reset() {
		return this.time = 0, this._chargeTime = 0, this._explodeTime = 0, this._loopWait = 0, this._sinceEmpty = 0, this.embers.reset(), this.trails.reset(), this.core.reset(), this.fireball.reset(), this.sparks.reset(), this.shockwave.reset(), this.smoke.reset(), this._syncCoreBudget(), this.object3D.visible = !0, this._setState(n.IDLE), this;
	}
	update(e) {
		let t = Math.min(Math.max(e || 0, 0), .05);
		if (this.state === n.FINISHED && this.config.loop) {
			this._loopWait += t, this._loopWait >= this.config.loopDelay && (this.reset(), this.start()), this._updateDebug();
			return;
		}
		if (this.state === n.IDLE || this.state === n.FINISHED) {
			this._updateDebug();
			return;
		}
		this.time += t, this._advanceState(t);
		let r = this._ctx;
		r.dt = t, r.time = this.time, r.state = this.state, r.charge01 = c(this._chargeTime / Math.max(this.config.timeline.finalChargeMaxDuration, 1e-4)), r.energy01 = this.core.energy01, r.allowSpawn = this._canSpawn(), r.coreReveal = this._coreReveal(), this.embers.update(t, r), this.trails.update(t, r), this.core.update(t, r), this.fireball.update(t, r), this.sparks.update(t, r), this.shockwave.update(t, r), this.smoke.update(t, r), this._applyIsolateEmbers(), this._updateDebug();
	}
	setDebug(e) {
		this.config.debug = !!e, this.debugger.setEnabled(this.config.debug), this.debugger.update();
	}
	getDebugInfo() {
		let e = this.getDurationInfo();
		return {
			state: this.state,
			time: this.time,
			energy01: this.core.energy01,
			emberAlive: this.embers.state.activeCount,
			emberArrived: this.embers.state.arrivedCount,
			emberSpawned: this.embers.state.spawnedCount,
			emberCount: this.embers.state.count,
			spawnRadius: this.config.embers.spawnRadius,
			spawnRadiusMin: this.config.embers.spawnRadiusMin,
			explosionRadius: this.config.explosion.radius,
			position: this.object3D.position,
			...e
		};
	}
	getDurationInfo() {
		let e = this.config.timeline, t = Math.max(0, e.emberStop - e.emberStart), r = e.finalChargeMaxDuration, i = this._blastDuration(), a = t + r + i, o = this.time, s = t;
		return this.state === n.CHARGING ? (o = this._chargeTime, s = r) : this.state === n.EXPLODING || this.state === n.FADING ? (o = this._explodeTime, s = i) : (this.state === n.FINISHED || this.state === n.IDLE) && (o = this.time, s = a), {
			emberDuration: t,
			chargeDuration: r,
			blastDuration: i,
			totalDuration: a,
			phaseElapsed: o,
			phaseDuration: s
		};
	}
	_blastDuration() {
		return Math.max(this.config.explosion.duration, this.config.sparks.life, this.config.smoke.duration + .4) + .25;
	}
	dispose() {
		this.embers.dispose(), this.trails.dispose(), this.core.dispose(), this.fireball.dispose(), this.sparks.dispose(), this.shockwave.dispose(), this.smoke.dispose(), this.debugger.dispose(), this.renderProbe.dispose(), this._ownsTextures && j(this.textures), this._events.clear(), this.object3D.parent && this.object3D.parent.remove(this.object3D);
	}
	_advanceState(e) {
		let t = this.config.timeline;
		if (this.state === n.CONVERGING) {
			this.time >= t.emberStop && (this._chargeTime = 0, this._setState(n.CHARGING), this._events.emit("charged", {
				energy: this.core.energy01,
				time: this.time
			}));
			return;
		}
		if (this.state === n.CHARGING) {
			this._chargeTime += e;
			let n = this.embers.state.spawnedCount > 0 && this.embers.state.activeCount === 0;
			n ? this._sinceEmpty += e : this._sinceEmpty = 0;
			let r = this._chargeTime >= t.finalChargeMaxDuration, i = t.explosionDelayAfterEmbers ?? 0;
			(n && this._sinceEmpty >= i || r) && this._beginExplosion();
			return;
		}
		if (this.state === n.EXPLODING || this.state === n.FADING) {
			this._explodeTime += e;
			let t = this.config.explosion.duration, r = this._blastDuration();
			this.state === n.EXPLODING && this._explodeTime >= t * .52 && this._setState(n.FADING), this._explodeTime >= r && (this._setState(n.FINISHED), this._events.emit("finished", { time: this.time }));
		}
	}
	_beginExplosion() {
		this._explodeTime = 0, this._setState(n.EXPLODING), this.core.beginExplosion(), this.fireball.trigger(), this.sparks.trigger(), this.shockwave.trigger(), this.smoke.trigger(), this._events.emit("explode", {
			energy: this.core.energy01,
			time: this.time,
			radius: this.config.explosion.radius
		});
	}
	_setState(e) {
		if (this.state === e) return;
		let t = this.state;
		this.state = e, this._ctx.state = e, this._events.emit("stateChange", {
			from: t,
			to: e,
			time: this.time
		});
	}
	_canSpawn() {
		let e = this.config.timeline;
		return this.state === n.CONVERGING && this.time >= e.emberStart && this.time < e.emberStop;
	}
	_coreReveal() {
		let e = this.config.timeline;
		return this.time < e.coreBuildStart ? 0 : c((this.time - e.coreBuildStart) / Math.max(e.coreRevealDuration || .5, .05));
	}
	_syncCoreBudget() {
		let e = this.config.embers, t = this.config.timeline, n = Math.max(.1, t.emberStop - t.emberStart), r = Math.min(e.maxActive, e.spawnRate * n), i = (e.minBrightness + e.maxBrightness) * .5 * ((e.minSize + e.maxSize) * .5);
		this.core.setMaxEnergy(Math.max(r * i * .92, .001));
	}
	_applyIsolateEmbers() {
		this.renderProbe && (this.embers.mesh.visible = !1), this.config.debugIsolateEmbers && (this.core.group.visible = !1, this.fireball.group.visible = !1, this.shockwave.group.visible = !1, this.smoke.group.visible = !1, this.sparks.group.visible = !1, this.trails.group.visible = !1, this.debugger.group.visible = !1);
	}
	_updateDebug() {
		this.config.debug && this.debugger.update();
	}
}, $ = class extends de {
	constructor(e = {}) {
		super(e);
		let t = this.renderProbe;
		t?.instanced && (t.instanced.onBeforeRender = (e, n, r) => {
			t.update(r);
		});
	}
	update(e, t) {
		super.update(e), t && this.renderProbe?.update(t);
	}
};
function fe(t, n = {}) {
	let r = new $({
		...n,
		position: n.position ?? new e.Vector3(0, 0, 0),
		autoStart: !1
	});
	return t.add(r.object3D), r.start(), r;
}
//#endregion
export { $ as EmberExplosionEffect, fe as playEmberExplosion };
