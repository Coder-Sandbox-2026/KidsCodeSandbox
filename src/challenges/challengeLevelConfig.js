// Final body-center starts and completion rewards for all challenge stages.
export const CHALLENGE_LEVEL_CONFIG = Object.freeze(Object.fromEntries([
  [[-22.520, 2.700, -18.584], [-0.589, 0, 0.808], [23.7, 6, -20.4], 0.2],
  [[-7.671, 0.950, 41.289], [-0.965, 0, -0.262], [11, 8, -19.6], 0.2],
  [[-3.272, 0.950, -3.906], [0.998, 0, 0.057], [-42.6, 2, -29.5], 0.2],
  [[-28.033, 4.949, -29.991], [-0.090, 0, 0.996], [29.3, 2, -23.2], 0.2],
  [[29.873, 0.944, 34.094], [0.018, 0, -1], [-26, 5.5, -22], 0.2],
  [[-16.074, 0.950, -34.130], [0.031, 0, 1], [-0.4, 8.3, -37.6], 0.6],
  [[-2.510, 0.950, -38.182], [0.018, 0, 1], [35, 2, 42.7], 0.2],
  [[30.973, 17.950, 24.599], [-0.999, 0, 0.050], [46.7, 2, -41.8], 0.2],
  [[33.609, 7.950, -33.082], [-0.780, 0, 0.626], [-27.5, 2, -26.5], 0.2],
  [[44.661, 22.250, -15.425], [0.078, 0, 0.997], [-28, 12, -31.1], 1.0],
  [[24.627, 0.950, 40.763], [0.042, 0, -0.999], [23.5, 28, 42.3], 0.9],
].map(([position, direction, goldStarPosition, scale], index) => [index + 1, Object.freeze({
  playerPosition: Object.freeze(position), playerDirection: Object.freeze(direction),
  goldStar: Object.freeze({ position: Object.freeze(goldStarPosition), scale }),
})])));
