// Paper tie sheets, as the web admin prints them (admin-portal.controller.ts, combinedSheet):
// one A4 landscape page per tie with both squads, each side's pair on its own edge and the
// score between them. BLANK leaves the names empty for captains to fill in before the round;
// FILLED carries the lineups and any scores already in, so a scorer has a paper record if a
// device or the wifi gives out. Phones use the system print sheet (which can save a PDF);
// the web opens a print window, the way the web admin does.
import { Platform } from 'react-native';
import * as Print from 'expo-print';
import { roundLabel } from '../../data/league-feed';
import type { AdminData, AdminTie } from '../../data/modes-api';
import { tieWhen } from './LeagueMode';

export type SheetMode = 'blank' | 'filled';

const esc = (v: unknown) =>
  String(v ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]!);

const DEFAULT_RULE =
  'All 10 squad members play exactly one game. Pairings cannot be repeated during the league stage. Game to 30, change ends at 15, golden point at 29&ndash;29.';

function sheet(d: AdminData, tie: AdminTie, mode: SheetMode): string {
  const h = tie.home, a = tie.away;
  if (!h || !a) return '';
  const nameFor = (fid: string, pid: string | null | undefined) => (d.squads[fid] ?? []).find((p) => p.playerId === pid)?.name ?? '';
  const lineupFor = (fid: string) => {
    const rows = tie.sheets.find((x) => x.franchiseId === fid)?.lineupData ?? [];
    return Object.fromEntries(rows.map((l) => [l.slotNumber, l]));
  };
  const hl = lineupFor(h.id), al = lineupFor(a.id);
  const games = Object.fromEntries((tie.games ?? []).map((g) => [g.slotNumber, g]));
  const slots = tie.slots ?? [];
  const sheetRule = d.season.sheetRule;

  // Cumulative points, which is what the league table ranks on.
  let totH = 0, totA = 0, anyPlayed = false;
  for (const sl of slots) {
    const g = games[sl.slot];
    if (g?.played && g.homeScore !== null && g.awayScore !== null) { totH += g.homeScore; totA += g.awayScore; anyPlayed = true; }
  }
  const showTot = mode === 'filled' && anyPlayed;
  const box = '<div class="sc"><span class="bx"></span><b>&ndash;</b><span class="bx"></span></div>';
  const pair = (fid: string, l?: { player1Id: string | null; player2Id: string | null }) =>
    mode !== 'filled'
      ? '<div class="ln"></div><div class="ln"></div>'
      : `<div class="ln">${esc(nameFor(fid, l?.player1Id))}</div><div class="ln">${esc(nameFor(fid, l?.player2Id))}</div>`;
  const scoreCell = (slot: number) => {
    const g = games[slot];
    return mode === 'filled' && g?.played && g.homeScore !== null
      ? `<div class="sc done">${g.homeScore}<span>&ndash;</span>${g.awayScore}</div>`
      : box;
  };
  const rows = slots
    .map(
      (sl) =>
        `<tr><td class="n">${sl.slot}</td><td class="p left">${pair(h.id, hl[sl.slot])}</td>` +
        `<td class="mid"><div class="cat">${esc(sl.category)}${sl.points && sheetRule ? ` · ${sl.points} pts` : ''}</div>${scoreCell(sl.slot)}</td>` +
        `<td class="p right">${pair(a.id, al[sl.slot])}</td></tr>`,
    )
    .join('');
  const when = tieWhen({ scheduledStart: tie.scheduledStart, matchDay: tie.matchDay ?? null } as any);

  // More than six games still fits one A4 page, packed tighter.
  return (
    `<section class="sheet${slots.length > 6 ? ' dense' : ''}">` +
    `<div class="hd"><div class="ev">${esc(d.leagueName ?? '')}</div>` +
    `<div class="mt">${esc(roundLabel(tie.round))} &nbsp;&middot;&nbsp; ${esc(when)}${tie.court ? ` &nbsp;&middot;&nbsp; COURT ${tie.court}` : ''}</div></div>` +
    `<div class="vs"><div class="t l"><span class="lb">HOME</span><b>${esc(h.name)}</b>${showTot ? `<span class="pts">${totH} pts</span>` : ''}</div>` +
    `<div class="x">vs</div><div class="t r"><span class="lb">AWAY</span><b>${esc(a.name)}</b>${showTot ? `<span class="pts">${totA} pts</span>` : ''}</div></div>` +
    `<table><thead><tr><th class="n">#</th><th class="p left">${esc(h.name)}</th><th class="mid">Score</th><th class="p right">${esc(a.name)}</th></tr></thead>` +
    `<tbody>${rows}</tbody><tfoot><tr><td class="n"></td><td class="p left lbl">TOTAL POINTS</td>` +
    `<td class="mid">${showTot ? `<div class="sc done tot">${totH}<span>&ndash;</span>${totA}</div>` : box}</td>` +
    `<td class="p right lbl">TOTAL POINTS</td></tr></tfoot></table>` +
    `<div class="rule">${sheetRule ? esc(sheetRule) : DEFAULT_RULE}</div>` +
    `<div class="sig"><div>${esc(h.name)} captain<span class="line"></span></div><div>${esc(a.name)} captain<span class="line"></span></div><div>Scorer<span class="line"></span></div></div>` +
    '</section>'
  );
}

const CSS =
  '@page{size:A4 landscape;margin:12mm}' +
  'body{font-family:-apple-system,BlinkMacSystemFont,Segoe UI,Roboto,sans-serif;color:#001E40;margin:0}' +
  '.sheet{page-break-after:always;padding:0 0 6mm}.sheet:last-child{page-break-after:auto}' +
  '.hd{border-bottom:2px solid #001E40;padding-bottom:6px;margin-bottom:10px}' +
  '.ev{font-size:15px;font-weight:800}' +
  '.mt{font-size:11px;font-weight:700;color:#475569;margin-top:3px;letter-spacing:.6px}' +
  '.vs{display:flex;align-items:flex-end;margin-bottom:10px}.vs .t{flex:1}.vs .t.r{text-align:right}' +
  '.vs b{font-size:19px;font-weight:800;display:block}.vs .x{font-size:11px;color:#94A3B8;padding:0 14px 3px}' +
  '.vs .pts{display:block;font-size:13px;font-weight:800;color:#2952E3;margin-top:1px}' +
  'tfoot td{border-top:2px solid #001E40;border-bottom:none;padding-top:9px}' +
  'tfoot .lbl{font-size:9px;font-weight:800;letter-spacing:1px;color:#475569}tfoot td.p.right.lbl{text-align:right}' +
  'td.mid .sc.done.tot{font-size:19px}' +
  '.lb{display:block;font-size:8.5px;font-weight:800;letter-spacing:1.1px;color:#94A3B8}' +
  'table{width:100%;border-collapse:collapse;table-layout:fixed}' +
  'th{font-size:8.5px;letter-spacing:1px;text-transform:uppercase;color:#475569;border-bottom:1px solid #001E40;padding:0 8px 5px}' +
  'th.p.left{text-align:left}th.p.right{text-align:right}th.mid{text-align:center}' +
  'td{border-bottom:1px solid #CBD5E1;padding:9px 8px;vertical-align:top}' +
  'th.n,td.n{width:20px;text-align:center;font-weight:800}th.mid,td.mid{width:118px;text-align:center}' +
  'td.p .ln{border-bottom:1px solid #94A3B8;min-height:19px;margin:2px 0 8px;font-size:13px;font-weight:600;padding-bottom:1px}' +
  'td.p .ln:last-child{margin-bottom:2px}td.p.right{text-align:right}' +
  'td.mid .cat{font-size:10px;font-weight:800;color:#2952E3;margin-bottom:6px}' +
  'td.mid .sc{display:flex;align-items:center;justify-content:center;gap:5px}' +
  'td.mid .sc .bx{display:inline-block;width:30px;height:22px;border:1px solid #94A3B8;border-radius:3px}' +
  'td.mid .sc b{color:#94A3B8;font-weight:600}td.mid .sc.done{font-size:17px;font-weight:800;gap:7px}' +
  'td.mid .sc.done span{color:#94A3B8;font-weight:600}' +
  '.rule{margin-top:10px;font-size:9px;color:#64748B;line-height:1.5}' +
  '.sig{display:flex;gap:26px;margin-top:14px;font-size:9px;font-weight:700;letter-spacing:.6px;color:#475569}' +
  '.sig div{flex:1}.sig .line{display:block;border-bottom:1px solid #001E40;margin-top:16px}' +
  '.dense .hd{margin-bottom:6px}.dense .vs{margin-bottom:6px}.dense .vs b{font-size:17px}' +
  '.dense td{padding:4px 8px}.dense tfoot td{padding-top:6px}' +
  '.dense td.p .ln{min-height:17px;margin:1px 0 4px;font-size:12px}' +
  '.dense td.mid .cat{margin-bottom:3px}.dense td.mid .sc .bx{height:19px}' +
  '.dense .rule{margin-top:6px}.dense .sig{margin-top:8px}.dense .sig .line{margin-top:12px}' +
  '@media screen{body{background:#eef0ee;padding:16px}.sheet{background:#fff;max-width:265mm;margin:0 auto 14px;padding:14mm;box-shadow:0 2px 10px rgba(0,0,0,.12)}}';

/** The printable page for these ties, or null when none has both teams. */
export function tieSheetsHtml(d: AdminData, ties: AdminTie[], mode: SheetMode): string | null {
  const body = ties.map((t) => sheet(d, t, mode)).join('');
  if (!body) return null;
  return `<!DOCTYPE html><html><head><meta charset="UTF-8"><title>Tie sheets</title><style>${CSS}</style></head><body>${body}</body></html>`;
}

/** Print it: the system print sheet on a phone, a print window on the web. */
export async function printTieSheets(html: string): Promise<void> {
  if (Platform.OS !== 'web') {
    await Print.printAsync({ html, orientation: Print.Orientation.landscape });
    return;
  }
  const w = window.open('', '_blank');
  if (!w) throw new Error('Allow pop-ups for this site to print tie sheets.');
  w.document.write(html);
  w.document.close();
  w.focus();
  setTimeout(() => w.print(), 350);
}
