// My passport (opened from Me): the answers registration forms ask, saved once. Each section
// shows what is saved and has its own Edit, so a player fixes one thing without a long form.
// Passport fields need a one-time agreement on first save; name, DOB, gender, city and email
// already live on the account and save without it.
import React, { useState } from 'react';
import { ActivityIndicator, Image, Pressable, StyleSheet, Text, TextInput, View } from 'react-native';
import * as ImagePicker from 'expo-image-picker';
import { C, body, card, head, label } from '../theme';
import { Chip, Empty, Stripes } from '../components/ui';
import { AppHeader, Page } from '../components/chrome';
import { SectionLabel } from './MeScreen';
import { useLoad } from '../hooks';
import { errorText } from '../data/modes-api';
import { useAuthStore } from '../../store/authStore';
import { xConfirm } from '../../utils/alert';
import {
  FOOD,
  GENDERS,
  LOWER_SIZES,
  MISSING_LABEL,
  SPORTS,
  TSHIRT_SIZES,
  passportApi,
  type Passport,
  type PassportPatch,
  type PassportView,
} from '../data/passport-api';

type Option = { key: string; label: string };
type Field = {
  key: string;
  label: string;
  part: 'user' | 'passport';
  kind?: 'text' | 'choice' | 'date' | 'phone' | 'digits' | 'email';
  options?: Option[];
  placeholder?: string;
  max?: number;
};

const opts = (xs: string[]): Option[] => xs.map((x) => ({ key: x, label: x }));
const cap = (s: string) => s.charAt(0).toUpperCase() + s.slice(1);

// yyyy-mm-dd (server) ⇄ dd/mm/yyyy (what people type in India).
const toDmy = (iso: string | null) => (iso ? iso.slice(0, 10).split('-').reverse().join('/') : '');
function toIso(dmy: string): string | null | false {
  const t = dmy.trim();
  if (!t) return null;
  const m = /^(\d{1,2})[/.-](\d{1,2})[/.-](\d{4})$/.exec(t);
  if (!m) return false;
  return `${m[3]}-${m[2].padStart(2, '0')}-${m[1].padStart(2, '0')}`;
}

function shown(f: Field, v: string | null | undefined): string {
  if (!v) return 'Not set';
  if (f.kind === 'date') return toDmy(v);
  return f.options?.find((o) => o.key === v)?.label ?? v;
}

const SECTIONS: { title: string; note?: string; fields: Field[] }[] = [
  {
    title: 'About you',
    fields: [
      { key: 'fullName', label: 'Full name', part: 'user', max: 100 },
      { key: 'dateOfBirth', label: 'Date of birth', part: 'user', kind: 'date', placeholder: 'DD/MM/YYYY' },
      { key: 'gender', label: 'Gender', part: 'user', kind: 'choice', options: GENDERS },
      { key: 'city', label: 'City', part: 'user', max: 100 },
      { key: 'email', label: 'Email', part: 'user', kind: 'email' },
    ],
  },
  {
    title: 'Kit',
    note: 'For jerseys and T-shirts.',
    fields: [
      { key: 'tshirtSize', label: 'T-shirt size', part: 'passport', kind: 'choice', options: opts(TSHIRT_SIZES) },
      { key: 'tshirtSizeOther', label: 'Other size (if Other)', part: 'passport', max: 20 },
      { key: 'shirtName', label: 'Name on shirt', part: 'passport', max: 20 },
      { key: 'shirtNumber', label: 'Shirt number', part: 'passport', kind: 'digits', max: 3 },
      { key: 'lowerSize', label: 'Trouser / track size', part: 'passport', kind: 'choice', options: opts(LOWER_SIZES) },
    ],
  },
  {
    title: 'Where you play from',
    note: 'Society and company leagues ask for these.',
    fields: [
      { key: 'society', label: 'Society', part: 'passport', max: 120 },
      { key: 'tower', label: 'Tower / wing', part: 'passport', max: 40 },
      { key: 'flatNo', label: 'Flat number', part: 'passport', max: 20 },
      { key: 'organisation', label: 'Company or business', part: 'passport', max: 120 },
    ],
  },
  {
    title: 'Emergency contact',
    fields: [
      { key: 'emergencyName', label: 'Name', part: 'passport', max: 80 },
      { key: 'emergencyPhone', label: 'Phone', part: 'passport', kind: 'phone' },
    ],
  },
  {
    title: 'Food',
    fields: [{ key: 'foodPreference', label: 'Food preference', part: 'passport', kind: 'choice', options: FOOD }],
  },
];

function valueOf(v: PassportView, f: Field): string | null {
  return f.part === 'user' ? ((v.user as any)[f.key] ?? null) : ((v.passport as any)?.[f.key] ?? null);
}

/** Save note shown before the first passport save. */
const CONSENT = 'Saving keeps these answers on your Yoiden account. Only you can see them. A registration form gets them only when you open it from this app.';

function Section({ title, note, fields, v, onSaved }: { title: string; note?: string; fields: Field[]; v: PassportView; onSaved: (n: PassportView) => void }) {
  const [draft, setDraft] = useState<Record<string, string> | null>(null);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState('');
  const needsConsent = !v.passport && fields.some((f) => f.part === 'passport');

  const start = () => {
    setErr('');
    setDraft(Object.fromEntries(fields.map((f) => [f.key, f.kind === 'date' ? toDmy(valueOf(v, f)) : (valueOf(v, f) ?? '')])));
  };

  const save = async () => {
    if (!draft) return;
    const patch: PassportPatch = {};
    for (const f of fields) {
      let val: string | null = draft[f.key].trim() || null;
      if (f.kind === 'date' && val) {
        const iso = toIso(val);
        if (iso === false) return setErr('Date of birth should look like 17/05/1990.');
        val = iso;
      }
      if (val === (valueOf(v, f) ?? null) || (f.kind === 'date' && val === valueOf(v, f)?.slice(0, 10))) continue;
      const part = (patch[f.part] ??= {}) as Record<string, string | null>;
      part[f.key] = val;
    }
    if (!patch.user && !patch.passport) return setDraft(null);
    if (patch.passport && needsConsent) patch.consent = true;
    setBusy(true);
    setErr('');
    try {
      onSaved(await passportApi.update(patch));
      setDraft(null);
    } catch (e) {
      setErr(errorText(e, 'Could not save. Try again.'));
    } finally {
      setBusy(false);
    }
  };

  return (
    <>
      <SectionLabel
        right={
          !draft ? (
            <Pressable onPress={start} hitSlop={8}>
              <Text style={label(13, C.accent)}>Edit</Text>
            </Pressable>
          ) : undefined
        }
      >
        {title}
      </SectionLabel>
      <View style={[card, { overflow: 'hidden' }]}>
        {!draft ? (
          fields.map((f, i) => {
            const val = valueOf(v, f);
            if (f.key === 'tshirtSizeOther' && !val) return null;
            return (
              <View key={f.key} style={[s.detail, i === fields.length - 1 && { borderBottomWidth: 0 }]}>
                <Text style={body(12, C.mute, 'medium')}>{f.label}</Text>
                <Text style={[body(14, val ? C.ink : C.mute, val ? 'semi' : 'text'), { marginTop: 2 }]}>{shown(f, val)}</Text>
              </View>
            );
          })
        ) : (
          <View style={{ padding: 14, gap: 14 }}>
            {note ? <Text style={body(12.5, C.soft)}>{note}</Text> : null}
            {fields.map((f) =>
              f.key === 'tshirtSizeOther' && draft.tshirtSize !== 'Other' ? null : (
                <View key={f.key} style={{ gap: 6 }}>
                  <Text style={body(12.5, C.soft, 'medium')}>{f.label}</Text>
                  {f.kind === 'choice' ? (
                    <View style={s.chips}>
                      {f.options!.map((o) => (
                        <Chip key={o.key} on={draft[f.key] === o.key} onPress={() => setDraft({ ...draft, [f.key]: draft[f.key] === o.key ? '' : o.key })}>
                          {o.label}
                        </Chip>
                      ))}
                    </View>
                  ) : (
                    <TextInput
                      value={draft[f.key]}
                      onChangeText={(t) => setDraft({ ...draft, [f.key]: f.kind === 'digits' ? t.replace(/\D/g, '') : t })}
                      placeholder={f.placeholder}
                      placeholderTextColor={C.mute}
                      maxLength={f.kind === 'phone' ? 14 : f.kind === 'date' ? 10 : f.max}
                      keyboardType={f.kind === 'phone' ? 'phone-pad' : f.kind === 'digits' ? 'number-pad' : f.kind === 'email' ? 'email-address' : f.kind === 'date' ? 'numbers-and-punctuation' : 'default'}
                      autoCapitalize={f.kind === 'email' ? 'none' : 'words'}
                      style={s.input}
                    />
                  )}
                </View>
              ),
            )}
            {needsConsent ? <Text style={[body(12.5, C.soft), s.consent]}>{CONSENT}</Text> : null}
            {err ? <Text style={body(13, C.live, 'medium')}>{err}</Text> : null}
            <View style={{ flexDirection: 'row', gap: 10 }}>
              <Pressable onPress={save} disabled={busy} style={({ pressed }) => [s.primary, { flex: 1, opacity: pressed || busy ? 0.8 : 1 }]}>
                {busy ? <ActivityIndicator color={C.bar} /> : <Text style={label(15, C.bar)}>{needsConsent ? 'Agree and save' : 'Save'}</Text>}
              </Pressable>
              <Pressable onPress={() => setDraft(null)} style={s.ghost}>
                <Text style={label(15, C.soft)}>Cancel</Text>
              </Pressable>
            </View>
          </View>
        )}
      </View>
    </>
  );
}

/** Sports the player plays, and the few questions forms ask about each. */
function SportsSection({ v, onSaved }: { v: PassportView; onSaved: (n: PassportView) => void }) {
  const saved = v.passport?.sportDetails ?? {};
  const [draft, setDraft] = useState<Record<string, Record<string, string>> | null>(null);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState('');
  const needsConsent = !v.passport;
  const picked = SPORTS.filter((sp) => sp.key in saved);

  const save = async () => {
    if (!draft) return;
    const clean: Passport['sportDetails'] = {};
    for (const [k, answers] of Object.entries(draft)) clean[k] = Object.fromEntries(Object.entries(answers).filter(([, x]) => x.trim()).map(([a, x]) => [a, x.trim()]));
    setBusy(true);
    setErr('');
    try {
      onSaved(await passportApi.update({ passport: { sportDetails: clean }, ...(needsConsent ? { consent: true } : {}) }));
      setDraft(null);
    } catch (e) {
      setErr(errorText(e, 'Could not save. Try again.'));
    } finally {
      setBusy(false);
    }
  };

  return (
    <>
      <SectionLabel
        right={
          !draft ? (
            <Pressable onPress={() => (setErr(''), setDraft(JSON.parse(JSON.stringify(saved))))} hitSlop={8}>
              <Text style={label(13, C.accent)}>Edit</Text>
            </Pressable>
          ) : undefined
        }
      >
        Sports
      </SectionLabel>
      <View style={[card, { overflow: 'hidden' }]}>
        {!draft ? (
          !picked.length ? (
            <Text style={[body(14, C.mute), { padding: 14 }]}>Not set. Add the sports you play.</Text>
          ) : (
            picked.map((sp, i) => {
              const answers = sp.fields.map((f) => saved[sp.key]?.[f.key]).filter(Boolean).map((x) => (x!.startsWith('http') ? 'CricHeroes linked' : cap(x!)));
              return (
                <View key={sp.key} style={[s.detail, i === picked.length - 1 && { borderBottomWidth: 0 }]}>
                  <Text style={body(14, C.ink, 'semi')}>{sp.label}</Text>
                  {answers.length ? <Text style={[body(12.5, C.soft), { marginTop: 2 }]}>{answers.join(' · ')}</Text> : null}
                </View>
              );
            })
          )
        ) : (
          <View style={{ padding: 14, gap: 14 }}>
            <View style={s.chips}>
              {SPORTS.map((sp) => (
                <Chip
                  key={sp.key}
                  on={sp.key in draft}
                  onPress={() => {
                    const next = { ...draft };
                    if (sp.key in next) delete next[sp.key];
                    else next[sp.key] = {};
                    setDraft(next);
                  }}
                >
                  {sp.label}
                </Chip>
              ))}
            </View>
            {SPORTS.filter((sp) => sp.key in draft && sp.fields.length).map((sp) => (
              <View key={sp.key} style={s.sportBox}>
                <Text style={head(16, C.bar)}>{sp.label}</Text>
                {sp.fields.map((f) => (
                  <View key={f.key} style={{ gap: 6 }}>
                    <Text style={body(12.5, C.soft, 'medium')}>{f.label}</Text>
                    {f.options ? (
                      <View style={s.chips}>
                        {f.options.map((o) => {
                          const on = draft[sp.key][f.key] === o;
                          return (
                            <Chip key={o} on={on} onPress={() => setDraft({ ...draft, [sp.key]: { ...draft[sp.key], [f.key]: on ? '' : o } })}>
                              {cap(o)}
                            </Chip>
                          );
                        })}
                      </View>
                    ) : (
                      <TextInput
                        value={draft[sp.key][f.key] ?? ''}
                        onChangeText={(t) => setDraft({ ...draft, [sp.key]: { ...draft[sp.key], [f.key]: t } })}
                        placeholder="https://cricheroes.com/..."
                        placeholderTextColor={C.mute}
                        autoCapitalize="none"
                        keyboardType="url"
                        style={s.input}
                      />
                    )}
                  </View>
                ))}
              </View>
            ))}
            {needsConsent ? <Text style={[body(12.5, C.soft), s.consent]}>{CONSENT}</Text> : null}
            {err ? <Text style={body(13, C.live, 'medium')}>{err}</Text> : null}
            <View style={{ flexDirection: 'row', gap: 10 }}>
              <Pressable onPress={save} disabled={busy} style={({ pressed }) => [s.primary, { flex: 1, opacity: pressed || busy ? 0.8 : 1 }]}>
                {busy ? <ActivityIndicator color={C.bar} /> : <Text style={label(15, C.bar)}>{needsConsent ? 'Agree and save' : 'Save'}</Text>}
              </Pressable>
              <Pressable onPress={() => setDraft(null)} style={s.ghost}>
                <Text style={label(15, C.soft)}>Cancel</Text>
              </Pressable>
            </View>
          </View>
        )}
      </View>
    </>
  );
}

export default function PassportScreen() {
  const userId = useAuthStore((st) => st.user?.id);
  const { state, reload } = useLoad<PassportView>(`passport-${userId}`, () => passportApi.get());
  const [view, setView] = useState<PassportView | null>(null);
  const [photoBusy, setPhotoBusy] = useState(false);
  const [photoErr, setPhotoErr] = useState('');
  const v = view ?? (state.status === 'ready' ? state.data : null);

  // Keep the signed-in user (Me's header) in step with what was saved.
  const onSaved = (n: PassportView) => {
    setView(n);
    if (useAuthStore.getState().user) useAuthStore.getState().updateUser({ fullName: n.user.fullName ?? undefined, city: n.user.city ?? undefined, avatarUrl: n.user.avatarUrl ?? undefined } as any);
  };

  const pickPhoto = async () => {
    setPhotoErr('');
    const res = await ImagePicker.launchImageLibraryAsync({ mediaTypes: ['images'], allowsEditing: true, aspect: [1, 1], quality: 0.9 });
    if (res.canceled || !res.assets?.length) return;
    const a = res.assets[0];
    setPhotoBusy(true);
    try {
      onSaved(await passportApi.photo({ uri: a.uri, name: a.fileName || 'photo.jpg', type: a.mimeType || 'image/jpeg' }));
    } catch (e) {
      setPhotoErr(errorText(e, 'Could not upload the photo. Try again.'));
    } finally {
      setPhotoBusy(false);
    }
  };

  const remove = () =>
    xConfirm(
      'Delete passport?',
      'This removes your kit sizes, address, sports and emergency contact. Your name, photo, account and match records stay.',
      async () => {
        try {
          onSaved(await passportApi.remove());
        } catch {
          /* the screen still shows the old values; pull to refresh */
        }
      },
      'Delete',
    );

  return (
    <View style={{ flex: 1, backgroundColor: C.page }}>
      <AppHeader title="My passport" back />
      <Page onRefresh={() => (setView(null), reload())}>
        {!v ? (
          state.status === 'error' ? (
            <View style={{ marginTop: 16 }}>
              <Empty>Could not load your passport. Pull down to try again.</Empty>
            </View>
          ) : (
            <View style={[card, { padding: 24, marginTop: 16 }]}>
              <ActivityIndicator color={C.accent} />
            </View>
          )
        ) : (
          <>
            {/* Completeness + photo */}
            <View style={s.banner}>
              <View pointerEvents="none" style={s.stripeBand}>
                <Stripes height={64} wide />
              </View>
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 14 }}>
                <Pressable onPress={pickPhoto} disabled={photoBusy} style={s.photoWrap}>
                  {v.user.avatarUrl ? (
                    <Image source={{ uri: v.user.avatarUrl }} style={s.photo} />
                  ) : (
                    <View style={[s.photo, { backgroundColor: C.barSoft, alignItems: 'center', justifyContent: 'center' }]}>
                      <Text style={label(11, C.hl)}>Add photo</Text>
                    </View>
                  )}
                  {photoBusy ? (
                    <View style={[StyleSheet.absoluteFill, s.photoBusy]}>
                      <ActivityIndicator color={C.hl} />
                    </View>
                  ) : null}
                </Pressable>
                <View style={{ flex: 1 }}>
                  <Text style={label(12, 'rgba(255,255,255,0.7)')}>Passport</Text>
                  <Text style={head(30, C.hl)}>{v.completeness}% ready</Text>
                  <View style={s.meter}>
                    <View style={[s.meterFill, { width: `${v.completeness}%` }]} />
                  </View>
                </View>
              </View>
              <Pressable onPress={pickPhoto} disabled={photoBusy} hitSlop={6} style={{ marginTop: 12 }}>
                <Text style={label(13, C.hl)}>{v.user.avatarUrl ? 'Change photo' : 'Add a photo'}</Text>
              </Pressable>
              {photoErr ? <Text style={[body(12.5, '#FFB4B4'), { marginTop: 6 }]}>{photoErr}</Text> : null}
              <Text style={[body(12.5, 'rgba(255,255,255,0.8)'), { marginTop: 10, lineHeight: 19 }]}>
                {v.missing.length
                  ? `Still to add: ${v.missing.map((m) => MISSING_LABEL[m] ?? m).join(', ')}.`
                  : 'Everything forms usually ask is saved. Registering from the app fills it in for you.'}
              </Text>
            </View>

            <Text style={[body(12.5, C.soft), { marginTop: 12, lineHeight: 19 }]}>
              Fill this in once. When you open a registration form from the Yoiden app, the form fills itself from here. Only you see this, and a form gets it only when you open it from the app.
            </Text>

            {SECTIONS.slice(0, 2).map((sec) => (
              <Section key={sec.title} {...sec} v={v} onSaved={onSaved} />
            ))}
            <SportsSection v={v} onSaved={onSaved} />
            {SECTIONS.slice(2).map((sec) => (
              <Section key={sec.title} {...sec} v={v} onSaved={onSaved} />
            ))}

            <View style={[card, { marginTop: 20, padding: 14, gap: 4 }]}>
              <Text style={body(13, C.soft)}>Phone: {v.user.phone ? `+91 ${v.user.phone.slice(-10)}` : 'Not set'} (this is your login, so it can't be changed here)</Text>
            </View>

            {v.passport ? (
              <Pressable onPress={remove} hitSlop={8} style={{ marginTop: 18, alignSelf: 'center' }}>
                <Text style={label(13, C.live)}>Delete my passport</Text>
              </Pressable>
            ) : null}
          </>
        )}
      </Page>
    </View>
  );
}

const s = StyleSheet.create({
  banner: { backgroundColor: C.bar, borderRadius: 10, marginTop: 16, padding: 16, overflow: 'hidden' },
  stripeBand: { position: 'absolute', top: 0, left: 0, right: 0, height: 64 },
  photoWrap: { borderRadius: 36, overflow: 'hidden' },
  photo: { width: 72, height: 72, borderRadius: 36, borderWidth: 2, borderColor: C.hl },
  photoBusy: { backgroundColor: 'rgba(0,30,64,0.6)', alignItems: 'center', justifyContent: 'center' },
  meter: { height: 6, borderRadius: 3, backgroundColor: C.barSoft, marginTop: 8, overflow: 'hidden' },
  meterFill: { height: 6, borderRadius: 3, backgroundColor: C.hl },
  detail: { paddingHorizontal: 14, paddingVertical: 10, borderBottomWidth: 1, borderBottomColor: C.line },
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  input: { borderWidth: 1, borderColor: C.lineStrong, borderRadius: 9, paddingHorizontal: 12, minHeight: 44, fontSize: 14, color: C.ink, backgroundColor: C.white },
  primary: { backgroundColor: C.hl, borderRadius: 10, minHeight: 46, alignItems: 'center', justifyContent: 'center' },
  ghost: { borderRadius: 10, minHeight: 46, paddingHorizontal: 18, alignItems: 'center', justifyContent: 'center', borderWidth: 1, borderColor: C.lineStrong },
  consent: { backgroundColor: C.page, borderRadius: 9, padding: 10, lineHeight: 19 },
  sportBox: { borderWidth: 1, borderColor: C.line, borderRadius: 10, padding: 12, gap: 12 },
});
