/**
 * Calculates the exact probability mass function for rolling a set of identical dice.
 * @param {number} count Number of dice
 * @param {number} sides Number of faces per die
 * @returns {Array<{sum: number, probability: number, ways: number}>}
 */
export function calculatePMF(count, sides) {
  if (count === 0) return [];
  
  // dp[i] = number of ways to roll sum i
  // Initialize with 1 die
  let dp = new Array(sides + 1).fill(0);
  for (let i = 1; i <= sides; i++) {
    dp[i] = 1;
  }

  // Iterate for remaining dice
  for (let n = 2; n <= count; n++) {
    const nextDp = new Array(n * sides + 1).fill(0);
    for (let sum = 0; sum < dp.length; sum++) {
      if (dp[sum] > 0) {
        for (let roll = 1; roll <= sides; roll++) {
          nextDp[sum + roll] += dp[sum];
        }
      }
    }
    dp = nextDp;
  }

  const totalWays = Math.pow(sides, count);
  const pmf = [];
  
  for (let i = count; i <= count * sides; i++) {
    pmf.push({
      sum: i,
      probability: dp[i] / totalWays,
      ways: dp[i]
    });
  }

  return pmf;
}

/**
 * Returns a simple optimal placement based on expected value.
 * It distributes `totalPieces` proportionally across the most probable sums.
 */
export function getOptimalPlacement(count, sides, totalPieces) {
  const pmf = calculatePMF(count, sides);
  const placement = {};
  
  // Initialize
  pmf.forEach(p => {
    placement[p.sum] = 0;
  });

  // Calculate proportional pieces
  let piecesLeft = totalPieces;
  pmf.forEach(p => {
    const pieces = Math.floor(p.probability * totalPieces);
    placement[p.sum] = pieces;
    piecesLeft -= pieces;
  });

  // Distribute remaining pieces to the highest probabilities
  // Sort by probability descending
  const sortedPmf = [...pmf].sort((a, b) => b.probability - a.probability);
  let i = 0;
  while (piecesLeft > 0 && i < sortedPmf.length) {
    placement[sortedPmf[i].sum]++;
    piecesLeft--;
    i++;
  }

  return placement;
}
