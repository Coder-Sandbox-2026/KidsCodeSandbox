import { CHALLENGE_LEVEL_CONFIG } from './challengeLevelConfig.js';
import { isAccessibleLevel } from '../config/levelAccess.js';

// Both the dropdown and Next use the same existing reset/stop/briefing actions.
export function selectChallengeLevel(level, { setLevel, reset, stop, show }) {
  if (!isAccessibleLevel(level) || !Object.hasOwn(CHALLENGE_LEVEL_CONFIG, level)) return false;
  setLevel(level);
  reset();
  stop();
  show();
  return true;
}
