/** Maximum level number currently exposed to players. */
export const MAX_ACCESSIBLE_LEVEL = 11;

export function isAccessibleLevel(level) {
  return Number.isInteger(level) && level >= 1 && level <= MAX_ACCESSIBLE_LEVEL;
}

export function levelNumberFromId(levelId) {
  const match = /^challenge-(\d+)$/.exec(levelId);
  return match ? Number(match[1]) : null;
}

export function isAccessibleLevelId(levelId) {
  const level = levelNumberFromId(levelId);
  return level !== null && isAccessibleLevel(level);
}
