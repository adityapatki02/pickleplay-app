/**
 * Tie Sheet downloader for SPPL admins.
 *
 * Opens a new tab containing a print-styled HTML version of the tie sheet
 * (matching the SPPL Tie Sheet PDF layout, minus the Point/Final Score/Sign
 * columns per organizer request) and auto-fires the browser's print dialog
 * so the admin can save as PDF or print to paper for on-court scoring.
 *
 * Uses native browser print — no new bundle dependencies (jsPDF/puppeteer).
 * The new tab includes a manual "Print / Save as PDF" button as a fallback
 * if popup-blockers swallow the auto-print, and a print-stylesheet that
 * hides that button when actually printing.
 *
 * Web-only — on native, falls back to an alert.
 */

import { Platform } from 'react-native';

export type TieSheetSlot = {
  slotNumber: number;
  /** Game label as shown on the SPPL sheet, e.g., "K & K", "TF & TM", "W1 & M1". */
  gameLabel: string;
  /** Each player on its own line — the sheet renders one row per player so
   *  long names don't get clipped or jammed. Empty strings for un-submitted lineups. */
  team1Player1: string;
  team1Player2: string;
  team2Player1: string;
  team2Player2: string;
};

export type TieSheetInput = {
  /** League name shown in the header, e.g. "SPPL", "SBPL S2". Defaults to "SPPL". */
  leagueName?: string;
  /** Match number / tie number printed in the header. Use the tie's slot index in the season or just the round name. */
  matchNo: string | number;
  /** Display date, e.g., "1 May 2026". */
  date: string;
  /** Display time range, e.g., "07:00 – 09:10". */
  time: string;
  /** Court number, e.g., 1, 2, 3. */
  court: string | number | null;
  /** Team 1 (home) franchise name. */
  team1Name: string;
  /** Team 2 (away) franchise name. */
  team2Name: string;
  /** 13 rows for league + QF ties; 14 rows (slot 0 Rally Point Game first)
   *  for Q1 / Eliminator / Q2 / Final per SPPL §15.a. */
  slots: TieSheetSlot[];
};

/** Build the printable HTML document. Exported for testing. */
export function buildTieSheetHTML(input: TieSheetInput): string {
  // SPPL brand palette — kept inline so the printed sheet matches the app
  // colors regardless of where it gets opened.
  const NAVY = '#001E40';
  const ORANGE = '#F97316';
  const BORDER_DARK = '#001E40';
  const SURFACE = '#F5F7FA';
  const SUB = '#64748B';

  const escape = (s: unknown) => String(s ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');

  // Per-match rows. TWO rows per match — one player per row — so long
  // names stay readable. Sr No, Game, and the two Final-Pts cells span
  // both rows via rowspan=2. Empty score cells are ready for hand-writing.
  //
  // Column groups:  Sr No | Game | [T1 P | T2 P] | [T1 Pts | T2 Pts]
  // (Players together on the left, score boxes together on the right.)
  const blank = '<span style="color:#CBD5E1">______________</span>';
  const rowsHtml = input.slots.map((s) => `
    <tr>
      <td rowspan="2" style="text-align:center;font-weight:800;font-size:13px;width:6%">${escape(s.slotNumber)}</td>
      <td rowspan="2" style="text-align:center;font-weight:800;font-size:11px;width:10%;background:${SURFACE}">${escape(s.gameLabel)}</td>
      <td style="text-align:left;padding:4px 9px;width:27%">${escape(s.team1Player1) || blank}</td>
      <td style="text-align:left;padding:4px 9px;width:27%">${escape(s.team2Player1) || blank}</td>
      <td rowspan="2" style="text-align:center;width:15%"></td>
      <td rowspan="2" style="text-align:center;width:15%"></td>
    </tr>
    <tr>
      <td style="text-align:left;padding:4px 9px;border-top:1px dashed #94A3B8">${escape(s.team1Player2) || blank}</td>
      <td style="text-align:left;padding:4px 9px;border-top:1px dashed #94A3B8">${escape(s.team2Player2) || blank}</td>
    </tr>
  `).join('');

  // Document title becomes the default "Save as PDF" filename in the browser
  // print dialog. We use "Team1 vs Team2" so the saved file is recognizable
  // without renaming, e.g. "Hungama Hustlers vs Singham Stars.pdf".
  const docTitle = `${input.team1Name} vs ${input.team2Name}`;

  return `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8">
<title>${escape(docTitle)}</title>
<style>
  /* Sized to fill an A4 page in one shot — 13 matches × 2 player rows
     + signatures. Tuned by trial: any taller and the signature spills to
     page 2; any shorter and there's empty space at the bottom. */
  @page { size: A4 portrait; margin: 7mm; }
  * { box-sizing: border-box; }
  html, body { height: auto; }
  body {
    font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
    color: ${NAVY};
    margin: 0;
    background: white;
  }
  .hdr {
    background: ${NAVY};
    color: white;
    padding: 7px 14px;
    display: flex;
    align-items: center;
    justify-content: space-between;
  }
  .hdr .title {
    font-size: 16px;
    font-weight: 900;
    letter-spacing: 2px;
    line-height: 1.1;
  }
  .hdr .title .sub {
    font-size: 9px;
    font-weight: 600;
    opacity: 0.8;
    letter-spacing: 1px;
    margin-top: 1px;
    display: block;
  }
  .hdr .match {
    background: ${ORANGE};
    color: white;
    padding: 5px 12px;
    border-radius: 4px;
    font-weight: 800;
    font-size: 12px;
    letter-spacing: 1px;
  }
  .info {
    padding: 4px 0;
    background: white;
    border-bottom: 2px solid ${ORANGE};
  }
  /* Info grid uses table-style borders so every field cell is enclosed,
     matching the user's "borders everywhere" request. */
  .info-tbl {
    width: 100%;
    border-collapse: collapse;
    font-size: 11px;
  }
  .info-tbl td {
    border: 1px solid ${BORDER_DARK};
    padding: 4px 9px;
    vertical-align: middle;
    width: 20%;
  }
  .info-tbl .label {
    color: ${SUB};
    font-size: 8px;
    text-transform: uppercase;
    letter-spacing: 1px;
    font-weight: 700;
    display: block;
    margin-bottom: 1px;
  }
  .info-tbl .value {
    color: ${NAVY};
    font-weight: 800;
    font-size: 11px;
  }
  table.sheet {
    width: 100%;
    margin: 5px 0 0;
    border-collapse: collapse;
    font-size: 11px;
  }
  table.sheet th, table.sheet td {
    border: 1px solid ${BORDER_DARK};
    padding: 3px 5px;
    vertical-align: middle;
    line-height: 1.25;
  }
  table.sheet thead th {
    background: ${NAVY};
    color: white;
    font-weight: 800;
    font-size: 9px;
    letter-spacing: 0.4px;
    padding: 5px 5px;
    text-transform: uppercase;
  }
  /* Signature section: matching bordered table layout with team names as
     headers and a blank cell sized so the whole sheet stays on one page. */
  .sig {
    width: 100%;
    margin: 5px 0 0;
    border-collapse: collapse;
    font-size: 10px;
    page-break-inside: avoid;
  }
  .sig td, .sig th {
    border: 1px solid ${BORDER_DARK};
    padding: 0;
    vertical-align: middle;
  }
  .sig th {
    background: ${NAVY};
    color: white;
    font-weight: 800;
    font-size: 10px;
    letter-spacing: 1px;
    padding: 6px 12px;
    text-transform: uppercase;
    text-align: left;
    width: 50%;
  }
  .sig .sig-pad {
    height: 42px;
    padding: 3px 12px;
    position: relative;
  }
  .sig .sig-line {
    border-top: 1px solid ${NAVY};
    margin-top: 26px;
    padding-top: 2px;
    text-align: center;
    font-size: 9px;
    color: ${SUB};
    letter-spacing: 0.5px;
    font-weight: 700;
  }
  /* Wrap the printable content in a fixed-width container so the spacing
     above is consistent regardless of viewport width when previewing. */
  .sheet-wrap { padding: 0 7px; }
  .actions {
    padding: 14px 18px 24px;
    text-align: center;
  }
  .actions button {
    background: ${NAVY};
    color: white;
    border: none;
    padding: 12px 24px;
    border-radius: 8px;
    font-weight: 800;
    font-size: 13px;
    letter-spacing: 1px;
    cursor: pointer;
  }
  .actions .note {
    margin-top: 8px;
    font-size: 11px;
    color: ${SUB};
  }
  @media print {
    .actions { display: none; }
  }
</style>
</head>
<body>
  <div class="hdr">
    <div class="title">
      ${escape(input.leagueName || 'SPPL')} — SEASON 2026
      <span class="sub">TIE SHEET</span>
    </div>
    <div class="match">${escape(input.matchNo)}</div>
  </div>

  <div class="info">
    <table class="info-tbl">
      <tr>
        <td><span class="label">Date</span><span class="value">${escape(input.date)}</span></td>
        <td><span class="label">Time</span><span class="value">${escape(input.time)}</span></td>
        <td><span class="label">Court</span><span class="value">${escape(input.court ?? '—')}</span></td>
        <td><span class="label">Team 1</span><span class="value">${escape(input.team1Name)}</span></td>
        <td><span class="label">Team 2</span><span class="value">${escape(input.team2Name)}</span></td>
      </tr>
    </table>
  </div>

  <table class="sheet">
    <thead>
      <tr>
        <th>Sr No</th>
        <th>Game</th>
        <th style="text-align:left;padding-left:8px">${escape(input.team1Name)}</th>
        <th style="text-align:left;padding-left:8px">${escape(input.team2Name)}</th>
        <th>${escape(input.team1Name)}<br><span style="font-size:8px;opacity:0.7;font-weight:600">FINAL PTS</span></th>
        <th>${escape(input.team2Name)}<br><span style="font-size:8px;opacity:0.7;font-weight:600">FINAL PTS</span></th>
      </tr>
    </thead>
    <tbody>
      ${rowsHtml}
    </tbody>
  </table>

  <table class="sig">
    <tr>
      <th>${escape(input.team1Name).toUpperCase()}</th>
      <th>${escape(input.team2Name).toUpperCase()}</th>
    </tr>
    <tr>
      <td class="sig-pad"><div class="sig-line">Captain Signature</div></td>
      <td class="sig-pad"><div class="sig-line">Captain Signature</div></td>
    </tr>
  </table>

  <div class="actions">
    <button onclick="window.print()">🖨️  PRINT / SAVE AS PDF</button>
    <div class="note">Use your browser's print dialog to save as PDF or print on A4.</div>
  </div>

  <script>
    // Auto-trigger the print dialog after a small delay so fonts/layout settle.
    // The dialog will offer "Save as PDF" as a destination — that's the
    // primary intended path. If the popup-blocker suppresses this, the
    // manual button above is the fallback.
    window.addEventListener('load', function() {
      setTimeout(function() { window.print(); }, 350);
    });
  </script>
</body>
</html>`;
}

/** Open a new window with the printable tie sheet and auto-fire the print dialog. */
export function downloadTieSheet(input: TieSheetInput): void {
  if (Platform.OS !== 'web') {
    if (typeof window !== 'undefined' && window.alert) {
      window.alert('Tie sheet download is available on the web app only.');
    }
    return;
  }
  const html = buildTieSheetHTML(input);
  const win = window.open('', '_blank', 'width=900,height=900');
  if (!win) {
    // Popup blocker swallowed the open(). Tell the admin to allow popups.
    // eslint-disable-next-line no-alert
    window.alert('Please allow popups for this site to download tie sheets.');
    return;
  }
  win.document.open();
  win.document.write(html);
  win.document.close();
}

/**
 * Map a TieMatch's slotNumber to the SPPL game label exactly as printed on
 * the official tie sheet. Single source of truth so the same labels show up
 * wherever a tie sheet is rendered.
 */
export const SPPL_TIE_SHEET_LABELS: Record<number, string> = {
  // Slot 0 — Rally Point Game. Only present in Q1 / Eliminator / Q2 / Final
  // (per SPPL §15.a). The whole roster contributes; we leave the player
  // cells empty on the printed sheet so the scorer fills in the running
  // rally tally by hand.
  0: 'Rally Pt',
  1: 'K & K',
  2: 'K & TM',
  3: 'TF & TM',
  4: 'W1 & W1',
  5: 'W1 & M1',
  6: 'W2 & W2',
  7: 'W2 & W2',
  8: 'W2 & M2',
  9: 'M1 & M1',
  10: 'M2 & M2',
  11: 'M3 & M3',
  12: 'M3 & M3',
  13: 'M3 & M3',
};
