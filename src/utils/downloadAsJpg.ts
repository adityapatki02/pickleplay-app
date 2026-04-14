import { Platform } from 'react-native';

/**
 * Downloads a given DOM/View element as a JPG file.
 *
 * On web, uses `dom-to-image-more` + `file-saver`.
 * On native, logs a warning and resolves without doing anything.
 *
 * @param node The target element (for web: an HTMLElement; the caller should
 *             `.findNodeHandle` or pass a ref.current that resolves to a div
 *             via RN Web).
 * @param filename The suggested filename for the download (e.g. `bracket.jpg`)
 */
export async function downloadAsJpg(node: any, filename: string): Promise<void> {
  if (Platform.OS !== 'web') {
    console.warn('[downloadAsJpg] Native platforms not supported yet');
    return;
  }

  if (!node) {
    console.warn('[downloadAsJpg] No target node provided');
    return;
  }

  try {
    // html2canvas renders text reliably (dom-to-image was producing
    // missing-glyph boxes because the web font wasn't being embedded).
    const html2canvas = (await import('html2canvas')).default;
    const FileSaver = await import('file-saver');

    // Wait for any pending web fonts to load before capture.
    if (typeof document !== 'undefined' && (document as any).fonts?.ready) {
      try {
        await (document as any).fonts.ready;
      } catch {
        // ignore — not all browsers support this
      }
    }

    const canvas = await html2canvas(node, {
      backgroundColor: '#FFFFFF',
      scale: 2, // 2x for crisp output
      useCORS: true,
      logging: false,
      width: node.scrollWidth,
      height: node.scrollHeight,
      windowWidth: node.scrollWidth,
      windowHeight: node.scrollHeight,
    });

    const blob: Blob | null = await new Promise((resolve) =>
      canvas.toBlob((b) => resolve(b), 'image/jpeg', 0.95),
    );

    if (!blob) {
      throw new Error('canvas.toBlob returned null');
    }

    FileSaver.saveAs(blob, filename);
  } catch (err) {
    console.error('[downloadAsJpg] failed:', err);
    throw err;
  }
}

/**
 * Sanitizes a string to be safe in filenames.
 */
export function sanitizeFilename(s: string): string {
  return s
    .replace(/[^\w\s-]/g, '')
    .trim()
    .replace(/\s+/g, '-')
    .toLowerCase()
    .slice(0, 60);
}

/**
 * Builds a suggested filename for an exported tournament section.
 */
export function buildExportFilename(
  tournamentName: string,
  categoryName: string | undefined,
  section: string,
): string {
  const parts = [sanitizeFilename(tournamentName || 'tournament')];
  if (categoryName) parts.push(sanitizeFilename(categoryName));
  parts.push(section);
  const date = new Date().toISOString().slice(0, 10);
  parts.push(date);
  return `${parts.join('-')}.jpg`;
}
