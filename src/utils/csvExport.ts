/**
 * Minimal CSV download helper for organizer-portal exports.
 *
 * Web-only — triggers a browser download via Blob + anchor click. Native
 * platforms get a no-op + alert (organizer use the web build for exports).
 *
 * Usage:
 *   downloadCSV('standings.csv',
 *     ['Rank', 'Team', 'Played', 'Won'],
 *     [[1, 'Dangal Dinkers', 4, 3], [2, 'Force Finishers', 4, 2]]);
 */

import { Platform } from 'react-native';

/** Escape a single cell value per RFC 4180 — wraps in quotes if it contains
 * a comma, quote, or newline; doubles internal quotes. Numbers/booleans pass
 * through as their string forms. null/undefined become empty cells. */
function escapeCell(v: unknown): string {
  if (v === null || v === undefined) return '';
  const s = String(v);
  if (s.includes(',') || s.includes('"') || s.includes('\n') || s.includes('\r')) {
    return `"${s.replace(/"/g, '""')}"`;
  }
  return s;
}

/** Build a CSV string from headers + rows. Exported separately so callers
 * with multi-section layouts (e.g. fantasy export) can compose by hand. */
export function buildCSV(headers: string[], rows: unknown[][]): string {
  const headerLine = headers.map(escapeCell).join(',');
  const bodyLines = rows.map((row) => row.map(escapeCell).join(','));
  // BOM (\uFEFF) so Excel opens UTF-8 characters (player names with diacritics) correctly.
  return '\uFEFF' + [headerLine, ...bodyLines].join('\r\n');
}

/** Download a single-section CSV. */
export function downloadCSV(filename: string, headers: string[], rows: unknown[][]): void {
  downloadCSVRaw(filename, buildCSV(headers, rows));
}

/** Lower-level: download an already-built CSV string. Useful when caller
 * composes multiple sections (blank rows + new headers + new rows). */
export function downloadCSVRaw(filename: string, csvText: string): void {
  if (Platform.OS !== 'web') {
    // We could implement Sharing.shareAsync for native, but organizers use
    // the web build for these exports — keep this trivial.
    // eslint-disable-next-line no-alert
    if (typeof window !== 'undefined' && window.alert) {
      window.alert('CSV export is available on the web app only.');
    }
    return;
  }
  try {
    const blob = new Blob([csvText], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    a.style.display = 'none';
    document.body.appendChild(a);
    a.click();
    // Defer revocation so Safari has time to start the download.
    setTimeout(() => {
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
    }, 200);
  } catch (err) {
    // eslint-disable-next-line no-console
    console.error('downloadCSV failed', err);
  }
}
