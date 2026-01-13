/**
 * Similarity utilities for RSA asset quality checks
 * Provides Jaccard similarity, Levenshtein distance, and near-duplicate detection
 */

/**
 * Compute Jaccard similarity between two strings
 * Returns value between 0 (completely different) and 1 (identical)
 * 
 * @param {string} str1 - First string
 * @param {string} str2 - Second string
 * @returns {number} Similarity score between 0 and 1
 */
function jaccardSimilarity(str1, str2) {
  if (!str1 || !str2) return 0;
  
  const tokens1 = new Set((str1 || '').toLowerCase().split(/\s+/).filter(Boolean));
  const tokens2 = new Set((str2 || '').toLowerCase().split(/\s+/).filter(Boolean));
  
  if (tokens1.size === 0 && tokens2.size === 0) return 1;
  if (tokens1.size === 0 || tokens2.size === 0) return 0;
  
  const intersection = new Set([...tokens1].filter(t => tokens2.has(t)));
  const union = new Set([...tokens1, ...tokens2]);
  
  return intersection.size / union.size;
}

/**
 * Compute Levenshtein distance between two strings
 * Returns the minimum number of single-character edits needed
 * 
 * @param {string} str1 - First string
 * @param {string} str2 - Second string
 * @returns {number} Edit distance
 */
function levenshteinDistance(str1, str2) {
  if (!str1) return str2 ? str2.length : 0;
  if (!str2) return str1.length;
  
  const matrix = [];
  const len1 = str1.length;
  const len2 = str2.length;
  
  // Initialize matrix
  for (let i = 0; i <= len1; i++) {
    matrix[i] = [i];
  }
  for (let j = 0; j <= len2; j++) {
    matrix[0][j] = j;
  }
  
  // Fill matrix
  for (let i = 1; i <= len1; i++) {
    for (let j = 1; j <= len2; j++) {
      if (str1[i - 1] === str2[j - 1]) {
        matrix[i][j] = matrix[i - 1][j - 1];
      } else {
        matrix[i][j] = Math.min(
          matrix[i - 1][j] + 1,     // deletion
          matrix[i][j - 1] + 1,     // insertion
          matrix[i - 1][j - 1] + 1  // substitution
        );
      }
    }
  }
  
  return matrix[len1][len2];
}

/**
 * Normalize string for comparison (lowercase, trim, remove punctuation)
 * 
 * @param {string} str - String to normalize
 * @returns {string} Normalized string
 */
function normalizeForComparison(str) {
  if (!str) return '';
  return String(str)
    .toLowerCase()
    .trim()
    .replace(/[^\w\s]/g, '') // Remove punctuation
    .replace(/\s+/g, ' ');   // Normalize whitespace
}

/**
 * Check if two strings are near-duplicates
 * Uses both Jaccard similarity and normalized Levenshtein distance
 * 
 * @param {string} str1 - First string
 * @param {string} str2 - Second string
 * @param {number} jaccardThreshold - Jaccard similarity threshold (default 0.7)
 * @param {number} levenshteinThreshold - Normalized Levenshtein threshold (default 0.3)
 * @returns {boolean} True if strings are near-duplicates
 */
function isNearDuplicate(str1, str2, jaccardThreshold = 0.7, levenshteinThreshold = 0.3) {
  if (!str1 || !str2) return false;
  
  const norm1 = normalizeForComparison(str1);
  const norm2 = normalizeForComparison(str2);
  
  // Exact match after normalization
  if (norm1 === norm2) return true;
  
  // Jaccard similarity check
  const jaccard = jaccardSimilarity(norm1, norm2);
  if (jaccard >= jaccardThreshold) return true;
  
  // Levenshtein distance check (normalized by max length)
  const maxLen = Math.max(norm1.length, norm2.length);
  if (maxLen === 0) return false;
  
  const levenshtein = levenshteinDistance(norm1, norm2);
  const normalizedLevenshtein = levenshtein / maxLen;
  
  if (normalizedLevenshtein <= levenshteinThreshold) return true;
  
  return false;
}

/**
 * Find all near-duplicates in an array of strings
 * 
 * @param {string[]} strings - Array of strings to check
 * @param {number} jaccardThreshold - Jaccard similarity threshold
 * @param {number} levenshteinThreshold - Normalized Levenshtein threshold
 * @returns {Array<{index1: number, index2: number, str1: string, str2: string}>} Array of duplicate pairs
 */
function findNearDuplicates(strings, jaccardThreshold = 0.7, levenshteinThreshold = 0.3) {
  const duplicates = [];
  
  for (let i = 0; i < strings.length; i++) {
    for (let j = i + 1; j < strings.length; j++) {
      if (isNearDuplicate(strings[i], strings[j], jaccardThreshold, levenshteinThreshold)) {
        duplicates.push({
          index1: i,
          index2: j,
          str1: strings[i],
          str2: strings[j]
        });
      }
    }
  }
  
  return duplicates;
}

/**
 * Check if a string is too similar to any string in an array
 * 
 * @param {string} candidate - String to check
 * @param {string[]} existing - Array of existing strings
 * @param {number} threshold - Similarity threshold (default 0.7)
 * @returns {boolean} True if candidate is too similar to any existing string
 */
function isTooSimilar(candidate, existing, threshold = 0.7) {
  if (!candidate || !existing || existing.length === 0) return false;
  
  for (const existingStr of existing) {
    if (isNearDuplicate(candidate, existingStr, threshold)) {
      return true;
    }
  }
  
  return false;
}

module.exports = {
  jaccardSimilarity,
  levenshteinDistance,
  normalizeForComparison,
  isNearDuplicate,
  findNearDuplicates,
  isTooSimilar
};
