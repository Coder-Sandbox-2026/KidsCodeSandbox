import { ChallengeLevel1 } from './ChallengeLevel1.js';
import { ChallengeLevel2, ChallengeLevel3, ChallengeLevel4, ChallengeLevel5, ChallengeLevel6, ChallengeLevel7, ChallengeLevel8, ChallengeLevel9, ChallengeLevel10, ChallengeLevel11 } from './ChallengeLevels.js';

export const CHALLENGE_LEVEL_CLASSES = Object.freeze(Object.fromEntries(
  [ChallengeLevel1, ChallengeLevel2, ChallengeLevel3, ChallengeLevel4, ChallengeLevel5, ChallengeLevel6, ChallengeLevel7, ChallengeLevel8, ChallengeLevel9, ChallengeLevel10, ChallengeLevel11]
    .map((Level, index) => [`challenge-${index + 1}`, Level])
));
