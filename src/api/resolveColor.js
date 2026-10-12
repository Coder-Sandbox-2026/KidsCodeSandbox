/** Resolve the student color keyword for both Three.js and CSS. */
export function resolveColor(value) {
  return typeof value === 'string' && value.toLowerCase() === 'random'
    ? '#' + Math.floor(Math.random() * 0x1000000).toString(16).padStart(6, '0')
    : value;
}
