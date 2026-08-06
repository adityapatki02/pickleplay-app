// Maps an SBPL roster/auction sub-category (e.g. 'a1', 'a2 legend', 'w4', 'k1')
// to its slot category GROUP (rulebook §2). Mirrors the backend
// sbplGroupForCategory in pickleplay-api. Case-insensitive; tolerates a
// trailing ' legend'. Returns null for anything unrecognised.
export function sbplGroupForCategory(sub?: string | null): string | null {
  if (!sub) return null;
  const c = sub.trim().toUpperCase();
  const letter = c[0];
  const num = parseInt(c.slice(1), 10);
  if (letter === 'K') return 'kids';
  if (letter === 'A') return 'menA';
  if (letter === 'B') return 'menB';
  if (letter === 'C') return 'menC';
  if (letter === 'W') {
    if (num >= 1 && num <= 3) return 'women13';
    if (num >= 4) return 'women45';
    return 'women13';
  }
  return null;
}

// The rulebook splits a tie's 15 games across its two courts by slot: slots 1–7
// (Kids/Women) on the first court, 8–15 (Men A/B/C) on the second. Mirrors the
// backend courtForSlot. Single-court ties (no courtNumber2) put every game on
// the one court. Returns null when no court is assigned.
export const SBPL_COURT_SPLIT_SLOT = 7;
export function courtForSlot(
  tie: { courtNumber?: number | null; courtNumber2?: number | null },
  slotNumber: number,
  boundary: number = SBPL_COURT_SPLIT_SLOT,
): number | null {
  if (tie.courtNumber2 == null) return tie.courtNumber ?? null;
  return slotNumber <= boundary ? (tie.courtNumber ?? null) : tie.courtNumber2;
}
