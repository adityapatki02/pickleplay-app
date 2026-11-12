// Admin mode's Teams and Management tabs, like the event site's /admin. Teams: squads, cards,
// renames. Management: the league's links, each team's captain link and PIN, the
// scorers (add, PIN, court, remove) and the broadcast overlays for OBS. Reads and writes go through the web admin's endpoints.
import React, { useState } from 'react';
import { Linking, Platform, Pressable, Share, StyleSheet, Text, TextInput, View } from 'react-native';
import * as Clipboard from 'expo-clipboard';
import { Empty, TeamBadge } from '../../components/ui';
import { categoryLabel } from '../../data/league-feed';
import { errorText, leagueAdmin, type AdminData } from '../../data/modes-api';
import { useLoad } from '../../hooks';
import { xConfirm } from '../../../utils/alert';
import { CourtPicker } from './LeagueMode';
import { printTieSheets, tieSheetsHtml, type SheetMode } from './tie-sheets';
import { API_BASE_URL } from '../../../config/constants';
import { C, body, card, head, label } from '../../theme';

export type Note = { ok: boolean; text: string } | null;

/** A section heading for these padded tabs (SectionLabel brings its own side padding). */
export function Heading({ children }: { children: string }) {
  return <Text style={[head(19, C.bar), { marginTop: 14 }]}>{children}</Text>;
}

export function NoteBox({ note }: { note: Note }) {
  if (!note) return null;
  return (
    <View style={[s.note, { backgroundColor: note.ok ? C.greenSoft : '#FDE8EA' }]}>
      <Text style={body(13, note.ok ? C.green : C.live, 'semi')}>{note.text}</Text>
    </View>
  );
}

function SmallButton({ title, onPress, tone = 'white' }: { title: string; onPress: () => void; tone?: 'white' | 'navy' | 'lime' }) {
  const bg = tone === 'navy' ? C.bar : tone === 'lime' ? C.hl : C.white;
  const fg = tone === 'navy' ? C.white : C.bar;
  return (
    <Pressable onPress={onPress} style={({ pressed }) => [s.small, { backgroundColor: bg, opacity: pressed ? 0.8 : 1 }, tone === 'white' && s.smallLine]}>
      <Text style={label(12, fg)}>{title}</Text>
    </Pressable>
  );
}

function useAdminData(leagueId: string) {
  return useLoad(`league-admin-${leagueId}`, () => leagueAdmin.data(leagueId));
}

function Loading({ state }: { state: ReturnType<typeof useAdminData>['state'] }) {
  if (state.status === 'loading') return <Empty>Loading…</Empty>;
  if (state.status === 'error') return <Empty>Couldn't load this. Pull down to try again.</Empty>;
  return null;
}

// ── Scorers ───────────────────────────────────────────────────────

function ScorersSection({ leagueId }: { leagueId: string }) {
  const { state, reload } = useAdminData(leagueId);
  const [name, setName] = useState('');
  const [phone, setPhone] = useState('');
  const [pin, setPin] = useState('');
  const [busy, setBusy] = useState(false);
  const [note, setNote] = useState<Note>(null);

  const add = async () => {
    const ph = phone.replace(/\D/g, '').slice(-10);
    if (ph.length !== 10) return setNote({ ok: false, text: 'Enter a 10-digit phone number.' });
    if (pin && !/^\d{6}$/.test(pin)) return setNote({ ok: false, text: 'The PIN must be 6 digits, or leave it blank.' });
    setBusy(true);
    try {
      const r = await leagueAdmin.addScorer(leagueId, { name: name.trim() || undefined, phone: ph, pin: pin || undefined });
      setNote({ ok: true, text: `${r.name || ph} can now score with ${r.phone || ph}${r.generatedPin ? ` and PIN ${r.generatedPin}` : ''}.` });
      setName(''); setPhone(''); setPin('');
      reload();
    } catch (e) {
      setNote({ ok: false, text: errorText(e, 'Could not add the scorer.') });
    } finally {
      setBusy(false);
    }
  };

  const showPin = async (userId: string, who: string) => {
    try {
      const r = await leagueAdmin.scorerPin(leagueId, userId);
      setNote(r.pin ? { ok: true, text: `${who}'s scorer PIN: ${r.pin}` } : { ok: false, text: `${who} has no scorer PIN on record.` });
    } catch (e) {
      setNote({ ok: false, text: errorText(e, 'Could not load the PIN.') });
    }
  };

  const remove = async (userId: string, who: string) => {
    try {
      await leagueAdmin.removeScorer(leagueId, userId);
      setNote({ ok: true, text: `${who} is no longer a scorer.` });
      reload();
    } catch (e) {
      setNote({ ok: false, text: errorText(e, 'Could not remove the scorer.') });
    }
  };

  const list = state.status === 'ready' ? state.data.scorers.filter((x) => !x.isAdmin) : [];
  return (
    <>
      <Heading>{`Scorers · ${list.length}`}</Heading>
      <Loading state={state} />
      {state.status === 'ready' && !list.length ? <Empty>No scorers yet. You can score every tie yourself.</Empty> : null}
      {list.length ? (
        <View style={[card, { paddingVertical: 4 }]}>
          {list.map((sc, i) => (
            <View key={sc.userId} style={[s.row, i > 0 && s.rowLine, { flexWrap: 'wrap' }]}>
              <View style={{ flex: 1 }}>
                <Text style={body(14.5, C.ink, 'semi')}>{sc.name}</Text>
                <Text style={body(12, C.mute)}>
                  {sc.phone || 'No phone'}
                  {sc.defaultCourt ? ` · Court ${sc.defaultCourt}` : ''}
                </Text>
              </View>
              <CourtPicker
                court={sc.defaultCourt}
                save={(c) => leagueAdmin.scorerCourt(leagueId, sc.userId, c).then(() => reload())}
              />
              <SmallButton title="PIN" onPress={() => showPin(sc.userId, sc.name)} />
              <SmallButton title="Remove" onPress={() => remove(sc.userId, sc.name)} />
            </View>
          ))}
        </View>
      ) : null}
      <NoteBox note={note} />
      <View style={[card, { padding: 14, gap: 10 }]}>
        <Text style={body(15, C.ink, 'bold')}>Add a scorer</Text>
        <Text style={body(12.5, C.soft)}>They score in the Yoiden app, or at the scorer link, with this number and PIN, on the ties you give them.</Text>
        <TextInput value={name} onChangeText={setName} placeholder="Name (optional)" placeholderTextColor={C.mute} style={s.input} />
        <TextInput value={phone} onChangeText={setPhone} placeholder="Phone number (10 digits)" placeholderTextColor={C.mute} keyboardType="phone-pad" maxLength={14} style={s.input} />
        <TextInput value={pin} onChangeText={setPin} placeholder="6-digit PIN (blank = make one)" placeholderTextColor={C.mute} keyboardType="number-pad" maxLength={6} style={s.input} />
        <Pressable onPress={busy ? undefined : add} style={({ pressed }) => [s.primary, { opacity: busy ? 0.6 : pressed ? 0.85 : 1 }]}>
          <Text style={label(14, C.bar)}>{busy ? 'Adding…' : 'Add scorer'}</Text>
        </Pressable>
      </View>
    </>
  );
}

// ── Links ─────────────────────────────────────────────────────────

/** The league's own addresses: its event site (from the server, else the event's own
 *  site in the app's list), otherwise the API pages. */
function linksFor(d: AdminData, eventUrl?: string | null) {
  const site = d.site ?? (eventUrl ? { host: eventUrl.replace(/\/+$/, ''), path: '' } : null);
  return {
    publicPage: site ? `${site.host}${site.path ? `/${site.path}` : ''}` : `${API_BASE_URL}/l/${d.season.slug ?? ''}`,
    captains: site ? `${site.host}/teams` : null,
    scorers: site ? `${site.host}/scorer` : `${API_BASE_URL}/scorer`,
    captain: (token: string) => (site ? `${site.host}/teams/${token}` : `${API_BASE_URL}/captain-portal/${token}`),
  };
}

export function LinkRow({ title, sub, url, onCopied, children }: { title: string; sub?: string; url: string | null; onCopied: (t: string) => void; children?: React.ReactNode }) {
  const copy = async () => {
    if (!url) return;
    await Clipboard.setStringAsync(url);
    onCopied(`${title} link copied.`);
  };
  const share = () => (Platform.OS === 'web' ? copy() : Share.share({ message: `${title}: ${url}` }));
  return (
    <View style={s.link}>
      <View style={{ flex: 1 }}>
        <Text style={body(14, C.ink, 'semi')}>{title}</Text>
        {sub ? <Text style={body(12, C.soft)}>{sub}</Text> : null}
        {url ? (
          <Text style={body(12, C.accent)} numberOfLines={1}>
            {url.replace(/^https?:\/\//, '')}
          </Text>
        ) : null}
      </View>
      {children}
      {url ? <SmallButton title="Copy" onPress={copy} /> : null}
      {url && Platform.OS !== 'web' ? <SmallButton title="Share" tone="navy" onPress={share} /> : null}
    </View>
  );
}

// ── Knockout ──────────────────────────────────────────────────────

/** League-stage progress, then the draw from the final table once every league tie is done. */
function KnockoutSection({ leagueId, d, onDone }: { leagueId: string; d: AdminData; onDone: () => void }) {
  const [note, setNote] = useState<Note>(null);
  const total = d.season.leagueTies ?? 0;
  const done = d.season.leagueDone ?? 0;
  const seeded = !!d.season.knockoutSeeded;
  const three = d.season.teamCount === 3;
  const draw = three ? '2nd v 3rd, and the winner meets 1st in the final' : '1st v 4th and 2nd v 3rd in the semi-finals';
  const generate = () =>
    xConfirm('Draw the knockout?', `From the final league table: ${draw}. The teams go straight into the knockout matches.`, async () => {
      try {
        await leagueAdmin.knockout(leagueId);
        setNote({ ok: true, text: 'Knockout drawn. The matches are in the Matches tab.' });
        onDone();
      } catch (e) {
        setNote({ ok: false, text: errorText(e, 'Could not draw the knockout.') });
      }
    }, 'Draw knockout');
  return (
    <>
      <Heading>Knockout</Heading>
      <View style={[card, { padding: 14, gap: 10 }]}>
        <Text style={body(13.5, C.ink, 'semi')}>
          League matches finished: {done} of {total}
          {seeded ? ' · knockout drawn' : ''}
        </Text>
        {seeded ? (
          <Text style={body(12.5, C.soft)}>The knockout teams are set. Their matches are in the Matches tab.</Text>
        ) : total && done >= total ? (
          <>
            <Text style={body(12.5, C.soft)}>Every league match is finished. The draw puts {draw}.</Text>
            <SmallButton title="Draw the knockout" tone="lime" onPress={generate} />
          </>
        ) : (
          <Text style={body(12.5, C.soft)}>The draw opens once every league match is finished, so it uses the final table.</Text>
        )}
        <NoteBox note={note} />
      </View>
    </>
  );
}

// ── Downloads and prints ──────────────────────────────────────────

/** Results and stats as Excel or PDF (the public page's own download), and tie sheets
 *  for every match still to finish. */
function DownloadsSection({ d }: { d: AdminData }) {
  const [note, setNote] = useState<Note>(null);
  const slug = d.season.slug;
  const dl = (fmt: 'xlsx' | 'pdf') => {
    if (!slug) return setNote({ ok: false, text: "This league has no public page yet, so there's nothing to download." });
    const url = `${API_BASE_URL}/l/${encodeURIComponent(slug)}?download=${fmt}`;
    if (Platform.OS === 'web') window.open(url, '_blank');
    else Linking.openURL(url);
  };
  const open = d.ties.filter((t) => t.home && t.away && t.status !== 'completed');
  const print = (mode: SheetMode) => {
    const html = tieSheetsHtml(d, open, mode);
    if (!html) return setNote({ ok: false, text: 'No match with both teams is still to play.' });
    printTieSheets(html).catch((e) => setNote({ ok: false, text: errorText(e, 'Could not print.') }));
  };
  return (
    <>
      <Heading>Downloads and prints</Heading>
      <View style={[card, { paddingVertical: 4 }]}>
        <View style={[s.row, { flexWrap: 'wrap' }]}>
          <View style={{ flex: 1, minWidth: 180 }}>
            <Text style={body(14, C.ink, 'semi')}>Results and stats</Text>
            <Text style={body(12, C.soft)}>Standings, every result and game, and player stats by category</Text>
          </View>
          <SmallButton title="Excel" onPress={() => dl('xlsx')} />
          <SmallButton title="PDF" onPress={() => dl('pdf')} />
        </View>
        <View style={[s.row, s.rowLine, { flexWrap: 'wrap' }]}>
          <View style={{ flex: 1, minWidth: 180 }}>
            <Text style={body(14, C.ink, 'semi')}>Tie sheets · {open.length} match{open.length === 1 ? '' : 'es'} to play</Text>
            <Text style={body(12, C.soft)}>Blank for captains; filled with lineups and scores for scorers. One page each.</Text>
          </View>
          <SmallButton title="Blank" onPress={() => print('blank')} />
          <SmallButton title="Filled" onPress={() => print('filled')} />
        </View>
      </View>
      <NoteBox note={note} />
    </>
  );
}

// ── Card points ───────────────────────────────────────────────────

/** Points off for each yellow and each red. Saving re-prices cards already given. */
function CardRulesSection({ leagueId, rules, onSaved }: { leagueId: string; rules: { yellow: number; red: number }; onSaved: () => void }) {
  const [yellow, setYellow] = useState(String(rules.yellow));
  const [red, setRed] = useState(String(rules.red));
  const [note, setNote] = useState<Note>(null);
  const save = async () => {
    const y = Number(yellow), r = Number(red);
    const ok = (n: number) => Number.isInteger(n) && n >= 0 && n <= 100;
    if (!ok(y) || !ok(r)) return setNote({ ok: false, text: 'Points must be whole numbers from 0 to 100.' });
    try {
      await leagueAdmin.setCardRules(leagueId, { yellow: y, red: r });
      setNote({ ok: true, text: `Saved. A yellow costs ${y}, a red costs ${r}. The table is updated.` });
      onSaved();
    } catch (e) {
      setNote({ ok: false, text: errorText(e, 'Could not save the card points.') });
    }
  };
  return (
    <>
      <Heading>Card points</Heading>
      <View style={[card, { padding: 14, gap: 10 }]}>
        <Text style={body(12.5, C.soft)}>Points a team loses in the table for each card. Put 0 for a warning only. Changing these re-prices cards already given.</Text>
        <View style={s.row0}>
          <Text style={[body(13.5, C.ink, 'semi'), { flex: 1 }]}>🟨 Yellow card</Text>
          <TextInput value={yellow} onChangeText={setYellow} keyboardType="number-pad" maxLength={3} style={[s.input, { width: 64, textAlign: 'center' }]} />
        </View>
        <View style={s.row0}>
          <Text style={[body(13.5, C.ink, 'semi'), { flex: 1 }]}>🟥 Red card</Text>
          <TextInput value={red} onChangeText={setRed} keyboardType="number-pad" maxLength={3} style={[s.input, { width: 64, textAlign: 'center' }]} />
        </View>
        <SmallButton title="Save card points" tone="lime" onPress={save} />
        <NoteBox note={note} />
      </View>
    </>
  );
}

// ── Broadcast ─────────────────────────────────────────────────────

/** OBS browser sources. Court pages follow whatever game is live on that court, so two
 *  games at once need one set per court; court 0 follows the latest game anywhere. */
function BroadcastSection({ d }: { d: AdminData }) {
  const courts = d.courts ?? [];
  const [note, setNote] = useState<Note>(null);
  const onCopied = (text: string) => setNote({ ok: true, text });
  const [court, setCourt] = useState<number>(courts[0] ?? 0);
  const sb = `${API_BASE_URL}/scoreboard`;
  const sid = d.season.id;
  const per = `${sb}/court/${sid}/${court}`;
  const where = court ? `Court ${court}` : 'Any court';
  return (
    <>
      <Heading>Broadcast</Heading>
      <Text style={[body(12.5, C.soft), { marginTop: -6 }]}>
        Add these in OBS as browser sources. Each court's links follow whatever game is live on that court, so when games run on several courts at once, use one set per court.
      </Text>
      <View style={[card, { paddingVertical: 4 }]}>
        <LinkRow title="Venue screen" sub={courts.length ? `Every court at once: ${courts.map((c) => `Court ${c}`).join(', ')}` : 'Every court at once'} url={`${sb}/master/${sid}${courts.length ? `?courts=${courts.join(',')}` : ''}`} onCopied={onCopied} />
        <LinkRow title="Standings" sub="Full points table" url={`${sb}/full-standings/${sid}`} onCopied={onCopied} />
        <LinkRow title="Player stats" sub="Leaderboard" url={`${sb}/stats/${sid}`} onCopied={onCopied} />
      </View>
      <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>
        {[...courts, 0].map((c) => (
          <Pressable key={c} onPress={() => setCourt(c)} style={[s.chip, court === c && s.chipOn]}>
            <Text style={label(12, court === c ? C.white : C.bar)}>{c ? `Court ${c}` : 'Any court'}</Text>
          </Pressable>
        ))}
      </View>
      <View style={[card, { paddingVertical: 4 }]}>
        <LinkRow title={`Score ticker · ${where}`} sub="Live score along the bottom of the stream" url={`${per}/ticker?size=small`} onCopied={onCopied} />
        <LinkRow title={`Digital scoreboard · ${where}`} sub="Wide board for an LED screen or TV at the court" url={`${per}/scoreboard`} onCopied={onCopied} />
      </View>
      {court === 0 ? (
        <Text style={[body(12, C.soft), { marginTop: -6 }]}>Any court shows the latest game in the league, wherever it is. Use it when the league plays on one court or sets no courts.</Text>
      ) : null}
      <NoteBox note={note} />
    </>
  );
}

/** Everything that runs the league rather than one match: links, captain PINs, scorers, broadcast. */
export function ManagementTab({ leagueId, eventUrl }: { leagueId: string; eventUrl?: string | null }) {
  const { state, reload } = useAdminData(leagueId);
  const [note, setNote] = useState<Note>(null);
  const [pinFor, setPinFor] = useState<string | null>(null);
  const [pinText, setPinText] = useState('');
  const copied = (text: string) => setNote({ ok: true, text });
  if (state.status !== 'ready') {
    return (
      <View style={{ paddingHorizontal: 16 }}>
        <Loading state={state} />
      </View>
    );
  }

  const showPin = async (id: string, team: string) => {
    setPinFor(pinFor === id ? null : id);
    setPinText('');
    try {
      const r = await leagueAdmin.captainPin(leagueId, id);
      setNote(r.pin ? { ok: true, text: `${team}'s captain PIN: ${r.pin}` } : { ok: false, text: `${team} has no captain PIN we can show. Set a new one below it.` });
    } catch (e) {
      setNote({ ok: false, text: errorText(e, 'Could not load the PIN.') });
    }
  };

  const savePin = async (id: string, team: string) => {
    if (!/^\d{4,8}$/.test(pinText)) return setNote({ ok: false, text: 'The PIN must be 4 to 8 digits.' });
    try {
      await leagueAdmin.setCaptainPin(leagueId, id, pinText);
      setNote({ ok: true, text: `${team}'s captain PIN is now ${pinText}.` });
      setPinFor(null);
      reload();
    } catch (e) {
      setNote({ ok: false, text: errorText(e, 'Could not set the PIN.') });
    }
  };

  const L = linksFor(state.data, eventUrl);
  const teams = state.data.franchises;
  return (
    <View style={{ paddingHorizontal: 16, gap: 12 }}>
      <Heading>League links</Heading>
      <View style={[card, { paddingVertical: 4 }]}>
        <LinkRow title="Public page" sub="Scores, fixtures and standings for everyone" url={L.publicPage} onCopied={copied} />
        {L.captains ? <LinkRow title="Captains" sub="Sign in with phone and PIN" url={L.captains} onCopied={copied} /> : null}
        <LinkRow title="Scorers" sub="Sign in with the phone and PIN from Scorers below" url={L.scorers} onCopied={copied} />
      </View>
      <Heading>{`Captains · ${teams.length}`}</Heading>
      <Text style={[body(12.5, C.soft), { marginTop: -6 }]}>Each team's link and captain PIN. Captains can also pick line-ups in the Yoiden app with their own phone number.</Text>
      {teams.length ? (
        <View style={[card, { paddingVertical: 4 }]}>
          {teams.map((f) => (
            <View key={f.id}>
              <LinkRow
                title={f.name}
                sub={[f.captainName ? `Captain: ${f.captainName}` : 'No captain set', f.hasPin ? 'PIN set' : 'No PIN yet'].join(' · ')}
                url={f.captainToken ? L.captain(f.captainToken) : null}
                onCopied={copied}
              >
                <SmallButton title={f.hasPin ? 'PIN' : 'Set PIN'} tone={pinFor === f.id ? 'navy' : 'white'} onPress={() => showPin(f.id, f.name)} />
              </LinkRow>
              {pinFor === f.id ? (
                <View style={[s.pinRow, { paddingHorizontal: 13, paddingBottom: 11, marginTop: 0, borderBottomWidth: 1, borderBottomColor: C.line }]}>
                  <TextInput value={pinText} onChangeText={setPinText} autoFocus placeholder="New captain PIN (4-8 digits)" placeholderTextColor={C.mute} keyboardType="number-pad" maxLength={8} style={[s.input, { flex: 1 }]} />
                  <SmallButton title="Save" tone="lime" onPress={() => savePin(f.id, f.name)} />
                  <SmallButton title="Close" onPress={() => setPinFor(null)} />
                </View>
              ) : null}
            </View>
          ))}
        </View>
      ) : (
        <Empty>No teams in this league yet.</Empty>
      )}
      <CardRulesSection leagueId={leagueId} rules={state.data.cardRules ?? { yellow: 5, red: 10 }} onSaved={reload} />
      {/* Under the captains, so a copy or PIN message shows next to what was tapped. */}
      <NoteBox note={note} />
      <ScorersSection leagueId={leagueId} />
      <KnockoutSection leagueId={leagueId} d={state.data} onDone={reload} />
      <DownloadsSection d={state.data} />
      <BroadcastSection d={state.data} />
    </View>
  );
}

const s = StyleSheet.create({
  pinRow: { width: '100%', flexDirection: 'row', alignItems: 'center', gap: 8, marginTop: 6 },
  playerRow: { borderTopWidth: 1, borderTopColor: C.line, paddingVertical: 9, gap: 4 },
  row0: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  input: { borderWidth: 1, borderColor: C.lineStrong, borderRadius: 9, paddingHorizontal: 12, minHeight: 44, fontSize: 14, color: C.ink, backgroundColor: C.white },
  primary: { backgroundColor: C.hl, borderRadius: 10, minHeight: 46, alignItems: 'center', justifyContent: 'center' },
  note: { borderRadius: 10, paddingHorizontal: 12, paddingVertical: 10 },
  row: { flexDirection: 'row', alignItems: 'center', gap: 8, paddingHorizontal: 13, paddingVertical: 11 },
  rowLine: { borderTopWidth: 1, borderTopColor: C.line },
  link: { flexDirection: 'row', alignItems: 'center', gap: 8, paddingHorizontal: 13, paddingVertical: 11, borderBottomWidth: 1, borderBottomColor: C.line },
  small: { borderRadius: 8, paddingHorizontal: 11, paddingVertical: 8 },
  chip: { borderRadius: 999, borderWidth: 1, borderColor: C.lineStrong, backgroundColor: C.white, paddingHorizontal: 14, paddingVertical: 8 },
  chipOn: { backgroundColor: C.bar, borderColor: C.bar },
  smallLine: { borderWidth: 1, borderColor: C.lineStrong },
});

// ── Teams ─────────────────────────────────────────────────────────

/** The form under an open squad: name, the category they play, and a phone if known. The
 *  categories offered are the ones this league's squads already use. */
function AddPlayer({ leagueId, franchiseId, team, cats, onAdded }: { leagueId: string; franchiseId: string; team: string; cats: string[]; onAdded: () => void }) {
  const [note, onDone] = useState<Note>(null);
  const [name, setName] = useState('');
  const [cat, setCat] = useState(cats.length === 1 ? cats[0] : '');
  const [phone, setPhone] = useState('');
  const [busy, setBusy] = useState(false);
  const add = async () => {
    if (!name.trim()) return onDone({ ok: false, text: "Enter the player's name." });
    if (!cat.trim()) return onDone({ ok: false, text: 'Pick the category they play in.' });
    const ph = phone.replace(/\D/g, '').slice(-10);
    if (phone.trim() && ph.length !== 10) return onDone({ ok: false, text: 'Enter a 10-digit phone number, or leave it blank.' });
    setBusy(true);
    try {
      const r = await leagueAdmin.addPlayer(leagueId, franchiseId, { name: name.trim(), category: cat.trim(), phone: ph || undefined });
      onDone({ ok: true, text: `${r.name} added to ${team}${r.existingAccount ? ' (their Yoiden account, found by phone)' : ''}.` });
      setName('');
      setPhone('');
      onAdded();
    } catch (e) {
      onDone({ ok: false, text: errorText(e, 'Could not add the player.') });
    } finally {
      setBusy(false);
    }
  };
  return (
    <View style={[s.playerRow, { gap: 8 }]}>
      <Text style={body(13.5, C.ink, 'bold')}>Add a player</Text>
      <TextInput value={name} onChangeText={setName} placeholder="Player's name" placeholderTextColor={C.mute} style={s.input} />
      {cats.length ? (
        <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 6 }}>
          {cats.map((c) => (
            <Pressable key={c} onPress={() => setCat(c)} style={[s.chip, cat === c && s.chipOn]}>
              <Text style={label(11.5, cat === c ? C.white : C.bar)}>{categoryLabel(c)}</Text>
            </Pressable>
          ))}
        </View>
      ) : (
        <TextInput value={cat} onChangeText={setCat} placeholder="Category (e.g. men)" placeholderTextColor={C.mute} style={s.input} />
      )}
      <TextInput value={phone} onChangeText={setPhone} placeholder="Phone (optional, links their Yoiden profile)" placeholderTextColor={C.mute} keyboardType="phone-pad" maxLength={14} style={s.input} />
      <Pressable onPress={busy ? undefined : add} style={({ pressed }) => [s.primary, { opacity: busy ? 0.6 : pressed ? 0.85 : 1 }]}>
        <Text style={label(14, C.bar)}>{busy ? 'Adding…' : `Add to ${team}`}</Text>
      </Pressable>
      <NoteBox note={note} />
    </View>
  );
}

/** Every team with its captain, squad and cards. Tap Edit to fix a team's name; captain
 *  PINs are under Management, and captains themselves are changed on the event site's admin,
 *  since that also changes the captain's own account. */
export function TeamsTab({ leagueId, colors }: { leagueId: string; colors: Record<string, string | null> }) {
  const { state, reload } = useAdminData(leagueId);
  const [editing, setEditing] = useState<string | null>(null);
  const [squad, setSquad] = useState<string | null>(null);
  const [replacing, setReplacing] = useState<string | null>(null);
  const [newPlayer, setNewPlayer] = useState('');
  const [search, setSearch] = useState('');
  // The card panel open under a team: which colour, the points a red takes off, why.
  const [carding, setCarding] = useState<{ id: string; type: 'yellow' | 'red' } | null>(null);
  const [reason, setReason] = useState('');
  const [cardNote, setCardNote] = useState<Note>(null);
  const [name, setName] = useState('');
  const [busy, setBusy] = useState(false);
  const [note, setNote] = useState<Note>(null);

  if (state.status !== 'ready') {
    return (
      <View style={{ paddingHorizontal: 16 }}>
        <Loading state={state} />
      </View>
    );
  }

  const save = async (id: string) => {
    if (!name.trim()) return setNote({ ok: false, text: 'Enter a team name.' });
    setBusy(true);
    try {
      await leagueAdmin.renameTeam(id, name.trim());
      setNote({ ok: true, text: `Renamed to ${name.trim()}.` });
      setEditing(null);
      reload();
    } catch (e) {
      setNote({ ok: false, text: errorText(e, 'Could not rename the team.') });
    } finally {
      setBusy(false);
    }
  };

  const swap = async (franchiseId: string, playerId: string, outName: string) => {
    if (!newPlayer.trim()) return setNote({ ok: false, text: 'Enter the new player name.' });
    setBusy(true);
    try {
      const r = await leagueAdmin.swapPlayer(leagueId, franchiseId, playerId, newPlayer.trim());
      setNote({ ok: true, text: `${r.inName} replaced ${outName}. ${r.gamesMoved} unplayed game(s) and ${r.sheetsMoved} lineup(s) updated.` });
      setReplacing(null);
      setNewPlayer('');
      reload();
    } catch (e) {
      setNote({ ok: false, text: errorText(e, 'Could not replace the player.') });
    } finally {
      setBusy(false);
    }
  };

  const rules = state.data.cardRules ?? { yellow: 5, red: 10 };
  const pts = (n: number) => `${n} point${n === 1 ? '' : 's'}`;
  /** What this card will cost, in words. */
  const cardCost = (team: string, type: 'yellow' | 'red') => {
    const n = type === 'red' ? rules.red : rules.yellow;
    return n ? `${team} lose ${pts(n)} in the table.` : 'A warning. No points are lost.';
  };

  const giveCard = (franchiseId: string, team: string) => {
    if (!carding) return;
    const red = carding.type === 'red';
    xConfirm(
      red ? `Red card for ${team}?` : `Yellow card for ${team}?`,
      cardCost(team, carding.type),
      async () => {
        try {
          await leagueAdmin.addCard(leagueId, franchiseId, carding.type, reason.trim() || undefined);
          setCardNote({ ok: true, text: `${red ? 'Red' : 'Yellow'} card given to ${team}.` });
          setReason('');
          reload();
        } catch (e) {
          setCardNote({ ok: false, text: errorText(e, 'Could not give the card.') });
        }
      },
      'Give card',
    );
  };

  const removeCard = (id: string, team: string) =>
    xConfirm('Take this card back?', `Any points it cost ${team} come back.`, async () => {
      try {
        await leagueAdmin.removeCard(leagueId, id);
        reload();
      } catch (e) {
        setNote({ ok: false, text: errorText(e, 'Could not remove the card.') });
      }
    }, 'Take back');

  const renderPlayer = (franchiseId: string, p: { playerId: string; name: string; cat: string }, team?: string) => (
    <View key={p.playerId} style={[s.playerRow]}>
      <View style={s.row0}>
        <View style={{ flex: 1 }}>
          <Text style={body(13.5, C.ink, 'semi')}>{p.name}</Text>
          <Text style={body(11.5, C.mute)}>{team ? `${team} · ` : ''}{categoryLabel(p.cat)}</Text>
        </View>
        <SmallButton title="Replace" onPress={() => { setNewPlayer(''); setReplacing(replacing === p.playerId ? null : p.playerId); }} />
      </View>
      {replacing === p.playerId ? (
        <View style={s.pinRow}>
          <TextInput value={newPlayer} onChangeText={setNewPlayer} autoFocus placeholder="New player's name" placeholderTextColor={C.mute} style={[s.input, { flex: 1 }]} />
          <SmallButton title={busy ? 'Saving…' : 'Save'} tone="lime" onPress={() => (busy ? undefined : swap(franchiseId, p.playerId, p.name))} />
        </View>
      ) : null}
    </View>
  );

  const teams = state.data.franchises;
  const q = search.trim().toLowerCase();
  const found = q ? teams.flatMap((f) => (state.data.squads[f.id] ?? []).filter((p) => p.name.toLowerCase().includes(q)).map((p) => ({ f, p }))) : [];
  return (
    <View style={{ paddingHorizontal: 16, gap: 12 }}>
      <NoteBox note={note} />
      <View style={[card, { padding: 14, gap: 10 }]}>
        <Text style={body(15, C.ink, 'bold')}>Find a player</Text>
        <TextInput value={search} onChangeText={setSearch} placeholder="Search by name" placeholderTextColor={C.mute} style={s.input} />
        {q && !found.length ? <Text style={body(12.5, C.soft)}>No player with that name.</Text> : null}
        {found.slice(0, 20).map(({ f, p }) => renderPlayer(f.id, p, f.name))}
      </View>
      {state.data.cards.length ? (
        <>
          <Heading>{`Cards · ${state.data.cards.length}`}</Heading>
          <View style={[card, { paddingVertical: 4 }]}>
            {state.data.cards.map((c, i) => {
              const team = teams.find((t) => t.id === c.franchiseId)?.name ?? 'Team';
              return (
                <View key={c.id} style={[s.row, i > 0 && s.rowLine]}>
                  <View style={{ flex: 1 }}>
                    <Text style={body(14, C.ink, 'semi')}>{c.type === 'red' ? '🟥' : '🟨'} {team}</Text>
                    <Text style={body(12, C.mute)}>
                      {[c.reason, (c.type === 'red' ? rules.red : rules.yellow) ? `−${pts(c.type === 'red' ? rules.red : rules.yellow)}` : 'Warning'].filter(Boolean).join(' · ')}
                    </Text>
                  </View>
                  <SmallButton title="Take back" onPress={() => removeCard(c.id, team)} />
                </View>
              );
            })}
          </View>
        </>
      ) : null}
      <Heading>{`Teams · ${teams.length}`}</Heading>
      {teams.length ? (
        <View style={[card, { paddingVertical: 4 }]}>
          {teams.map((f, i) => (
            <View key={f.id} style={[s.row, i > 0 && s.rowLine, { flexWrap: 'wrap' }]}>
              <TeamBadge team={{ name: f.name, shortName: f.shortName ?? '', color: colors[f.id] ?? null }} size={30} />
              {editing === f.id ? (
                <View style={{ flex: 1, gap: 8 }}>
                  <TextInput value={name} onChangeText={setName} autoFocus placeholder="Team name" placeholderTextColor={C.mute} style={s.input} />
                  <View style={{ flexDirection: 'row', gap: 8 }}>
                    <SmallButton title={busy ? 'Saving…' : 'Save'} tone="lime" onPress={() => (busy ? undefined : save(f.id))} />
                    <SmallButton title="Cancel" onPress={() => setEditing(null)} />
                  </View>
                </View>
              ) : (
                <>
                  <View style={{ flex: 1 }}>
                    <Text style={body(14.5, C.ink, 'semi')}>
                      {f.name}
                      {state.data.cards.filter((c) => c.franchiseId === f.id).map((c) => (c.type === 'red' ? ' 🟥' : ' 🟨')).join('')}
                    </Text>
                    <Text style={body(12, C.mute)}>
                      {f.captainName ? `Captain: ${f.captainName}` : 'No captain set'}
                      {f.captainPhone ? ` · ${f.captainPhone}` : ''}
                    </Text>
                    {state.data.cardPenalty?.[f.id] ? (
                      <Text style={body(12, C.live, 'semi')}>−{pts(state.data.cardPenalty[f.id])} from cards</Text>
                    ) : null}
                  </View>
                  <SmallButton title="Squad" tone={squad === f.id ? 'navy' : 'white'} onPress={() => setSquad(squad === f.id ? null : f.id)} />
                  <SmallButton
                    title="Card"
                    tone={carding?.id === f.id ? 'navy' : 'white'}
                    onPress={() => {
                      setCardNote(null);
                      setReason('');
                      setCarding(carding?.id === f.id ? null : { id: f.id, type: 'yellow' });
                    }}
                  />
                  {f.captainPhone && Platform.OS !== 'web' ? <SmallButton title="Call" onPress={() => Linking.openURL(`tel:${f.captainPhone}`)} /> : null}
                  <SmallButton
                    title="Edit"
                    onPress={() => {
                      setName(f.name);
                      setNote(null);
                      setEditing(f.id);
                    }}
                  />
                </>
              )}
              {carding?.id === f.id ? (
                <View style={[s.playerRow, { width: '100%', gap: 8 }]}>
                  <View style={{ flexDirection: 'row', gap: 6 }}>
                    {(['yellow', 'red'] as const).map((t) => (
                      <Pressable key={t} onPress={() => { setCardNote(null); setCarding({ id: f.id, type: t }); }} style={[s.chip, carding.type === t && s.chipOn]}>
                        <Text style={label(12, carding.type === t ? C.white : C.bar)}>{t === 'red' ? '🟥 Red card' : '🟨 Yellow card'}</Text>
                      </Pressable>
                    ))}
                  </View>
                  <Text style={body(12.5, C.soft)}>{cardCost(f.name, carding.type)} Change card points under Management.</Text>
                  <TextInput value={reason} onChangeText={setReason} placeholder="Reason (optional), e.g. late for the tie" placeholderTextColor={C.mute} maxLength={200} style={s.input} />
                  <View style={{ flexDirection: 'row', gap: 8 }}>
                    <SmallButton title="Give card" tone="lime" onPress={() => giveCard(f.id, f.name)} />
                    <SmallButton title="Close" onPress={() => setCarding(null)} />
                  </View>
                  <NoteBox note={cardNote} />
                </View>
              ) : null}
              {squad === f.id ? (
                <View style={{ width: '100%' }}>
                  {(state.data.squads[f.id] ?? []).map((p) => renderPlayer(f.id, p))}
                  <AddPlayer
                    leagueId={leagueId}
                    franchiseId={f.id}
                    team={f.name}
                    cats={[...new Set(Object.values(state.data.squads).flat().map((p) => p.cat))]}
                    onAdded={reload}
                  />
                </View>
              ) : null}
            </View>
          ))}
        </View>
      ) : (
        <Empty>No teams in this league yet.</Empty>
      )}
    </View>
  );
}
