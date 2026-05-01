/**
 * Generates a random interval from an exponential distribution.
 * The configured `averageSeconds` becomes the mean of the distribution.
 * Results are clamped to a sensible range [0.5s, 60s] to avoid extremes.
 */
export function randomIntervalMs(averageSeconds: number): number {
  const lambda = 1 / averageSeconds
  // Exponential distribution: -ln(U) / lambda, where U ~ Uniform(0,1)
  const u = Math.random()
  const intervalSeconds = -Math.log(u) / lambda
  const clamped = Math.max(0.5, Math.min(60, intervalSeconds))
  return clamped * 1000
}
