/** Graphics profile data shared by Settings and the WebGL renderer. */
export const GRAPHICS_PROFILES = {
  low: { label: 'Low', targetHeight: 540, shadowQuality: 'off', bloomQuality: 'reduced', waterQuality: 'low' },
  medium: { label: 'Medium', targetHeight: 720, shadowQuality: 'medium', bloomQuality: 'reduced', waterQuality: 'medium' },
  high: { label: 'High', targetHeight: 900, shadowQuality: 'high', bloomQuality: 'full', waterQuality: 'high' },
  ultra: { label: 'Ultra', targetHeight: null, shadowQuality: 'high', bloomQuality: 'full', waterQuality: 'ultra' },
};

export const RENDER_RESOLUTION_OPTIONS = [
  { value: 'profile', label: 'Profile Default' },
  ...[360, 480, 540, 720, 900, 1080].map((height) => ({
    value: String(height),
    label: `${height}p`,
  })),
  { value: 'native', label: 'Native' },
];

/** Resolve a profile/override pair to a vertical target, or null for native. */
export function getTargetRenderHeight(profile, override) {
  if (override === 'native') return null;
  if (override !== 'profile') return Number(override);
  return GRAPHICS_PROFILES[profile]
    ? GRAPHICS_PROFILES[profile].targetHeight
    : GRAPHICS_PROFILES.medium.targetHeight;
}

/**
 * Return the renderer pixel ratio that reaches the target without exceeding
 * the app's native renderer DPR ceiling.
 */
export function getRenderPixelRatio(cssHeight, nativePixelRatio, profile, override) {
  const nativeRatio = Math.min(Math.max(nativePixelRatio || 1, 0.01), 2);
  const targetHeight = getTargetRenderHeight(profile, override);
  if (targetHeight === null) return nativeRatio;
  return Math.min(nativeRatio, targetHeight / Math.max(cssHeight, 1));
}
