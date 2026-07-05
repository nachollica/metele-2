/**
 * Generates a random interval bounded between half and double the average.
 * Uses a Beta(2, 4) distribution (which looks like a right-skewed Gaussian/Log-normal)
 * mapped to [averageSeconds / 2, averageSeconds * 2].
 * The mean of this distribution exactly equals averageSeconds.
 */
export function randomIntervalMs(averageSeconds: number): number {
  const min = averageSeconds / 2
  const max = averageSeconds * 2
  const range = max - min

  // Generate Beta(2, 4) using order statistics:
  // The 2nd smallest of 5 uniform random variables follows Beta(2, 4).
  const u = [
    Math.random(),
    Math.random(),
    Math.random(),
    Math.random(),
    Math.random(),
  ]
  u.sort((a, b) => a - b)
  const betaSample = u[1]

  const intervalSeconds = min + betaSample * range
  return intervalSeconds * 1000
}
