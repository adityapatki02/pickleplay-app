// Admin mode's Scorers and Links tabs, like the event site's /admin: add, check and remove
// scorers; hand out the league's links (public page, captains, scorers) and each team's
// captain link. Reads and writes go through the web admin's endpoints.
import React, { useState } from 'react';
import { Platform, Pressable, Share, StyleSheet, Text, TextInput, View } from 'react-native';
import * as Clipboard from 'expo-clipboard';
import { Empty } from '../../components/ui';
import { errorText, leagueAdmin, type AdminData } from '../../data/modes-api';
import { useLoad } from '../../hooks';
import { API_BASE_URL } from '../../../config/constants';
import { C, body, card, head, label } from '../../theme';

type Note = { ok: boolean; text: string } | null;

/** A section heading for these padded tabs (SectionLabel brings its own side padding). */
function Heading({ children }: { children: string }) {
  return <Text style={[head(19, C.bar), { marginTop: 14 }]}>{children}</Text>;
}

function NoteBox({ note }: { note: Note }) {
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

export function ScorersTab({ leagueId }: { leagueId: string }) {
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
    <View style={{ paddingHorizontal: 16, gap: 12 }}>
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
      <NoteBox note={note} />
      <Heading>{`Scorers · ${list.length}`}</Heading>
      <Loading state={state} />
      {state.status === 'ready' && !list.length ? <Empty>No scorers yet. You can score every tie yourself.</Empty> : null}
      {list.length ? (
        <View style={[card, { paddingVertical: 4 }]}>
          {list.map((sc, i) => (
            <View key={sc.userId} style={[s.row, i > 0 && s.rowLine]}>
              <View style={{ flex: 1 }}>
                <Text style={body(14.5, C.ink, 'semi')}>{sc.name}</Text>
                <Text style={body(12, C.mute)}>
                  {sc.phone || 'No phone'}
                  {sc.defaultCourt ? ` · Court ${sc.defaultCourt}` : ''}
                </Text>
              </View>
              <SmallButton title="PIN" onPress={() => showPin(sc.userId, sc.name)} />
              <SmallButton title="Remove" onPress={() => remove(sc.userId, sc.name)} />
            </View>
          ))}
        </View>
      ) : null}
    </View>
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

function LinkRow({ title, sub, url, onCopied }: { title: string; sub?: string; url: string; onCopied: (t: string) => void }) {
  const copy = async () => {
    await Clipboard.setStringAsync(url);
    onCopied(`${title} link copied.`);
  };
  const share = () => (Platform.OS === 'web' ? copy() : Share.share({ message: `${title}: ${url}` }));
  return (
    <View style={s.link}>
      <View style={{ flex: 1 }}>
        <Text style={body(14, C.ink, 'semi')}>{title}</Text>
        {sub ? <Text style={body(12, C.soft)}>{sub}</Text> : null}
        <Text style={body(12, C.accent)} numberOfLines={1}>
          {url.replace(/^https?:\/\//, '')}
        </Text>
      </View>
      <SmallButton title="Copy" onPress={copy} />
      {Platform.OS === 'web' ? null : <SmallButton title="Share" tone="navy" onPress={share} />}
    </View>
  );
}

export function LinksTab({ leagueId, eventUrl }: { leagueId: string; eventUrl?: string | null }) {
  const { state } = useAdminData(leagueId);
  const [note, setNote] = useState<Note>(null);
  const copied = (text: string) => setNote({ ok: true, text });
  if (state.status !== 'ready') {
    return (
      <View style={{ paddingHorizontal: 16 }}>
        <Loading state={state} />
      </View>
    );
  }
  const L = linksFor(state.data, eventUrl);
  const teams = state.data.franchises.filter((f) => f.captainToken);
  return (
    <View style={{ paddingHorizontal: 16, gap: 12 }}>
      <NoteBox note={note} />
      <Heading>League links</Heading>
      <View style={[card, { paddingVertical: 4 }]}>
        <LinkRow title="Public page" sub="Scores, fixtures and standings for everyone" url={L.publicPage} onCopied={copied} />
        {L.captains ? <LinkRow title="Captains" sub="Sign in with phone and PIN" url={L.captains} onCopied={copied} /> : null}
        <LinkRow title="Scorers" sub="Sign in with the phone and PIN from the Scorers tab" url={L.scorers} onCopied={copied} />
      </View>
      <Heading>{`Captain links · ${teams.length}`}</Heading>
      <Text style={[body(12.5, C.soft), { marginTop: -6 }]}>One link per team. Captains can also pick line-ups in the Yoiden app with their own phone number.</Text>
      {teams.length ? (
        <View style={[card, { paddingVertical: 4 }]}>
          {teams.map((f) => (
            <LinkRow
              key={f.id}
              title={f.name}
              sub={[f.captainName ? `Captain: ${f.captainName}` : 'No captain set', f.hasPin ? 'Team PIN set' : null].filter(Boolean).join(' · ')}
              url={L.captain(f.captainToken!)}
              onCopied={copied}
            />
          ))}
        </View>
      ) : (
        <Empty>No captain links yet.</Empty>
      )}
    </View>
  );
}

const s = StyleSheet.create({
  input: { borderWidth: 1, borderColor: C.lineStrong, borderRadius: 9, paddingHorizontal: 12, minHeight: 44, fontSize: 14, color: C.ink, backgroundColor: C.white },
  primary: { backgroundColor: C.hl, borderRadius: 10, minHeight: 46, alignItems: 'center', justifyContent: 'center' },
  note: { borderRadius: 10, paddingHorizontal: 12, paddingVertical: 10 },
  row: { flexDirection: 'row', alignItems: 'center', gap: 8, paddingHorizontal: 13, paddingVertical: 11 },
  rowLine: { borderTopWidth: 1, borderTopColor: C.line },
  link: { flexDirection: 'row', alignItems: 'center', gap: 8, paddingHorizontal: 13, paddingVertical: 11, borderBottomWidth: 1, borderBottomColor: C.line },
  small: { borderRadius: 8, paddingHorizontal: 11, paddingVertical: 8 },
  smallLine: { borderWidth: 1, borderColor: C.lineStrong },
});
