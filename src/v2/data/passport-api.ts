// Player passport: the answers registration forms ask, saved once on the account
// (GET/PATCH/DELETE /me/passport). Registration websites get it only through a one-time
// handoff token the app adds to the form's link.
import { Platform } from 'react-native';
import apiClient from '../../api/client';
import { API_BASE_URL } from '../../config/constants';
import { useAuthStore } from '../../store/authStore';

const unwrap = <T>(res: { data: any }): T => (res.data?.data ?? res.data) as T;

export type PassportUser = {
  fullName: string | null;
  phone: string | null;
  email: string | null;
  dateOfBirth: string | null;
  gender: string | null;
  city: string | null;
  avatarUrl: string | null;
};

export type Passport = {
  tshirtSize: string | null;
  tshirtSizeOther: string | null;
  shirtName: string | null;
  shirtNumber: string | null;
  lowerSize: string | null;
  foodPreference: string | null;
  society: string | null;
  tower: string | null;
  flatNo: string | null;
  organisation: string | null;
  emergencyName: string | null;
  emergencyPhone: string | null;
  sportDetails: Record<string, Record<string, string>>;
};

export type PassportView = { user: PassportUser; passport: Passport | null; completeness: number; missing: string[] };

export type PassportPatch = { user?: Partial<Record<keyof PassportUser, string | null>>; passport?: Partial<Passport>; consent?: boolean };

export const passportApi = {
  get: async () => unwrap<PassportView>(await apiClient.get('/me/passport')),
  update: async (patch: PassportPatch) => unwrap<PassportView>(await apiClient.patch('/me/passport', patch)),
  remove: async () => unwrap<PassportView>(await apiClient.delete('/me/passport')),
  /** Multipart, so fetch rather than the axios instance (its JSON default breaks FormData). */
  photo: async (file: { uri: string; name: string; type: string }): Promise<PassportView> => {
    const form = new FormData();
    if (Platform.OS === 'web') {
      const blob = await (await fetch(file.uri)).blob();
      form.append('file', new File([blob], file.name, { type: file.type }));
    } else {
      form.append('file', { uri: file.uri, name: file.name, type: file.type } as any);
    }
    const token = useAuthStore.getState().token;
    const res = await fetch(`${API_BASE_URL}/me/passport/photo`, {
      method: 'POST',
      headers: token ? { Authorization: `Bearer ${token}` } : undefined,
      body: form,
    });
    const json = await res.json().catch(() => null);
    if (!res.ok || !json?.success) throw { response: { data: json } };
    return json.data as PassportView;
  },
  handoff: async (formId: string) => unwrap<{ token: string; expiresAt: string }>(await apiClient.post('/me/passport/handoff', { formId })),
};

/**
 * A registration form's link with a one-time passport token after `#yp=`. The fragment never
 * reaches the website's server logs; the form's script reads it and trades it once. Signed out,
 * or if the token call fails or is slow, the plain link opens, so registering never waits on this.
 * On web the plain link opens too: a tab opened after an await is blocked as a popup.
 */
export async function registrationLink(formId: string, url: string): Promise<string> {
  const { isAuthenticated, token } = useAuthStore.getState();
  if (!isAuthenticated || !token || Platform.OS === 'web') return url;
  try {
    const t = await Promise.race([passportApi.handoff(formId), new Promise<null>((r) => setTimeout(() => r(null), 2500))]);
    return t ? `${url.split('#')[0]}#yp=${encodeURIComponent(t.token)}` : url;
  } catch {
    return url;
  }
}

// Choice lists (must match the server's passport.util.ts).
export const TSHIRT_SIZES = ['XS', 'S', 'M', 'L', 'XL', '2XL', '3XL', '4XL', '5XL', 'Other'];
export const LOWER_SIZES = TSHIRT_SIZES.filter((x) => x !== 'Other');
export const FOOD = [
  { key: 'veg', label: 'Veg' },
  { key: 'non-veg', label: 'Non-veg' },
  { key: 'jain', label: 'Jain' },
  { key: 'vegan', label: 'Vegan' },
];
export const GENDERS = [
  { key: 'male', label: 'Male' },
  { key: 'female', label: 'Female' },
  { key: 'other', label: 'Other' },
];

/** Sports a player can list, with the few questions forms ask about each. No skill levels: DUPR is the only rating. */
export const SPORTS: { key: string; label: string; fields: { key: string; label: string; options?: string[] }[] }[] = [
  { key: 'pickleball', label: 'Pickleball', fields: [{ key: 'hand', label: 'Playing hand', options: ['right', 'left'] }] },
  { key: 'badminton', label: 'Badminton', fields: [{ key: 'hand', label: 'Playing hand', options: ['right', 'left'] }] },
  {
    key: 'cricket',
    label: 'Cricket',
    fields: [
      { key: 'role', label: 'Role', options: ['batter', 'bowler', 'all-rounder', 'wicket-keeper'] },
      { key: 'batting', label: 'Batting', options: ['right-hand', 'left-hand'] },
      { key: 'bowling', label: 'Bowling', options: ['right-arm fast', 'right-arm medium', 'right-arm spin', 'left-arm fast', 'left-arm medium', 'left-arm spin', 'none'] },
      { key: 'cricheroes', label: 'CricHeroes profile link' },
    ],
  },
  { key: 'table_tennis', label: 'Table tennis', fields: [{ key: 'hand', label: 'Playing hand', options: ['right', 'left'] }] },
  { key: 'tennis', label: 'Tennis', fields: [{ key: 'hand', label: 'Playing hand', options: ['right', 'left'] }] },
  { key: 'padel', label: 'Padel', fields: [{ key: 'hand', label: 'Playing hand', options: ['right', 'left'] }] },
  { key: 'squash', label: 'Squash', fields: [{ key: 'hand', label: 'Playing hand', options: ['right', 'left'] }] },
  {
    key: 'football',
    label: 'Football',
    fields: [
      { key: 'position', label: 'Position', options: ['goalkeeper', 'defender', 'midfielder', 'forward'] },
      { key: 'foot', label: 'Stronger foot', options: ['right', 'left', 'both'] },
    ],
  },
  { key: 'carrom', label: 'Carrom', fields: [] },
  { key: 'chess', label: 'Chess', fields: [] },
];

/** What each `missing` key from the server means to the player. */
export const MISSING_LABEL: Record<string, string> = {
  photo: 'Photo',
  dateOfBirth: 'Date of birth',
  gender: 'Gender',
  tshirtSize: 'T-shirt size',
  shirtNameOrNumber: 'Name or number on shirt',
  place: 'City or society',
  emergencyContact: 'Emergency contact',
};
