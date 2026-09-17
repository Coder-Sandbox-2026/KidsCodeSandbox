import { CHALLENGE_LEVEL_CLASSES } from './challengeLevelRegistry.js';

export const CREATE_LEVEL_CHOICES = Object.freeze(Object.keys(CHALLENGE_LEVEL_CLASSES)
  .map(id => Object.freeze({ level: Number(id.slice('challenge-'.length)), label: `Level ${id.slice('challenge-'.length)}` })));

export function selectedStage(state) {
  const challenge = state.mode === 'challenge';
  return { levelId: `challenge-${challenge ? state.challengeLevel : state.level}`, challenge };
}
