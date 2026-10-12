import { ChallengeLevel1 } from './ChallengeLevel1.js';
import { ChallengeLevel2, ChallengeLevel3, ChallengeLevel4, ChallengeLevel5, ChallengeLevel6, ChallengeLevel7, ChallengeLevel8, ChallengeLevel9, ChallengeLevel10, ChallengeLevel11, ChallengeLevel12 } from './ChallengeLevels.js';
import { ChallengeLevel13 } from './ChallengeLevel13.js';

export const CHALLENGE_LEVEL_CLASSES = Object.freeze(Object.fromEntries(
  [ChallengeLevel1, ChallengeLevel2, ChallengeLevel3, ChallengeLevel4, ChallengeLevel5, ChallengeLevel6, ChallengeLevel7, ChallengeLevel8, ChallengeLevel9, ChallengeLevel10, ChallengeLevel11, ChallengeLevel12, ChallengeLevel13]
    .map((Level, index) => [`challenge-${index + 1}`, Level])
));
