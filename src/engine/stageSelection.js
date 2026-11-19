import { CHALLENGE_LEVEL_CLASSES } from './challengeLevelRegistry.js';
import { CHALLENGE_LEVEL_CONFIG } from '../challenges/challengeLevelConfig.js';
import { isAccessibleLevel } from '../config/levelAccess.js';

export const CREATE_LEVEL_CHOICES = Object.freeze(Object.keys(CHALLENGE_LEVEL_CLASSES)
  .map(id => Number(id.slice('challenge-'.length)))
  .filter(isAccessibleLevel)
  .map(level => Object.freeze({ level, label: `Level ${level}` })));

export function selectedStage(state) {
  const challenge = state.mode === 'challenge';
  const requestedLevel = challenge ? state.challengeLevel : state.level;
  const level = isAccessibleLevel(requestedLevel)
    && (!challenge || Object.hasOwn(CHALLENGE_LEVEL_CONFIG, requestedLevel))
    ? requestedLevel
    : 1;
  return { levelId: `challenge-${level}`, challenge };
}
