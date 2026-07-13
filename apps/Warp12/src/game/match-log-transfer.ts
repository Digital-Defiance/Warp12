/**
 * Match Log Export/Import as Base64 Strings
 * 
 * Enables sharing match logs as compact base64 strings for:
 * - Copying/pasting between devices
 * - Sharing via chat/email
 * - URL parameters
 * - QR codes
 * 
 * Format: base64(JSON(BinaryMatchExport))
 * - Typical size: ~1-2KB for 200-action match
 * - URL-safe variant available
 * 
 * @example
 * ```typescript
 * // Export
 * const matchLog = log.export();
 * const base64 = exportMatchToBase64(matchLog);
 * console.log(base64); // Can be copied/pasted
 * 
 * // Import
 * const imported = importMatchFromBase64(base64);
 * console.log(imported.gameId, imported.actions.actionCount);
 * ```
 */

import type { BinaryMatchExport } from './match-log-binary.js';

/**
 * Export a binary match log to base64 string.
 * Uses standard base64 encoding (with +/= characters).
 */
export function exportMatchToBase64(match: BinaryMatchExport): string {
  const json = JSON.stringify(match);
  return btoa(json);
}

/**
 * Export a binary match log to URL-safe base64 string.
 * Replaces + with - and / with _, removes padding =.
 * Safe for URLs and QR codes.
 */
export function exportMatchToBase64Url(match: BinaryMatchExport): string {
  const standard = exportMatchToBase64(match);
  return standard
    .replace(/\+/g, '-')
    .replace(/\//g, '_')
    .replace(/=+$/, '');
}

/**
 * Import a binary match log from base64 string.
 * Handles both standard and URL-safe base64.
 */
export function importMatchFromBase64(base64: string): BinaryMatchExport {
  try {
    // Convert URL-safe to standard if needed
    let standard = base64;
    if (base64.includes('-') || base64.includes('_')) {
      standard = base64.replace(/-/g, '+').replace(/_/g, '/');
      // Add back padding
      const padding = (4 - (standard.length % 4)) % 4;
      standard += '='.repeat(padding);
    }

    const json = atob(standard);
    const match = JSON.parse(json) as BinaryMatchExport;

    // Validate structure
    if (!match.gameId || !match.actions || !match.exportedAt) {
      throw new Error('Invalid match log structure');
    }

    if (match.actions.format !== 'binary-v1') {
      throw new Error(`Unsupported format: ${match.actions.format}`);
    }

    return match;
  } catch (error) {
    if (error instanceof Error) {
      throw new Error(`Failed to import match log: ${error.message}`);
    }
    throw error;
  }
}

/**
 * Get the size of a match export in bytes.
 */
export function getMatchExportSize(match: BinaryMatchExport): number {
  const base64 = exportMatchToBase64(match);
  // Base64 uses 4 chars for every 3 bytes, so multiply by 0.75
  return Math.ceil(base64.length * 0.75);
}

/**
 * Compress match export for transfer (estimate).
 * Returns approximate size after gzip compression.
 * Note: Actual compression requires server-side or additional library.
 */
export function estimateCompressedSize(match: BinaryMatchExport): number {
  // Base64 JSON typically compresses to ~40-60% with gzip
  const uncompressed = getMatchExportSize(match);
  return Math.ceil(uncompressed * 0.5);
}

/**
 * Validate a base64 string looks like a match export (without decoding).
 */
export function isValidMatchBase64(base64: string): boolean {
  // Check length (minimum viable match is ~100 chars)
  if (base64.length < 100) {
    return false;
  }

  // Check for valid base64 characters
  const validChars = /^[A-Za-z0-9+/\-_=]*$/;
  if (!validChars.test(base64)) {
    return false;
  }

  return true;
}

/**
 * Create a shareable match link (for URL-based sharing).
 * Returns a URL with the match embedded as a query parameter.
 */
export function createShareableLink(
  match: BinaryMatchExport,
  baseUrl: string = window.location.origin
): string {
  const encoded = exportMatchToBase64Url(match);
  const url = new URL(baseUrl);
  url.searchParams.set('match', encoded);
  return url.toString();
}

/**
 * Extract match from URL query parameter.
 */
export function extractMatchFromUrl(url: string = window.location.href): BinaryMatchExport | null {
  try {
    const urlObj = new URL(url);
    const encoded = urlObj.searchParams.get('match');
    if (!encoded) {
      return null;
    }
    return importMatchFromBase64(encoded);
  } catch {
    return null;
  }
}
