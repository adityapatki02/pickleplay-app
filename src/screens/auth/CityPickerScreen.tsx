/**
 * CityPickerScreen — last step of onboarding.
 *
 * Two paths:
 *   1. "Use my location" → browser/native geolocation → backend reverse-geocodes
 *      lat/lng to a Google-canonical city (locality / admin_area_level_2).
 *   2. "Pick manually" → debounced typeahead against Google Places (cities-only,
 *      India-only) → user taps a suggestion.
 *
 * Selected city is saved to the user profile via PUT /auth/me, then we navigate
 * out of the auth stack — the RootNavigator picks up the authenticated state.
 */

import React, { useEffect, useRef, useState } from 'react';
import {
  View,
  Text,
  TextInput,
  ScrollView,
  StyleSheet,
  TouchableOpacity,
  ActivityIndicator,
  SafeAreaView,
  Platform,
} from 'react-native';
import { useNavigation } from '@react-navigation/native';
import { YColors } from '../../components/yoiden';
import apiClient from '../../api/client';
import { useAuthStore } from '../../store/authStore';

type Suggestion = {
  place_id: string;
  description: string;
  structured_formatting?: { main_text: string; secondary_text?: string };
};

export const CityPickerScreen: React.FC = () => {
  const nav = useNavigation<any>();
  const canClose = nav.canGoBack();
  const updateUser = useAuthStore((s: any) => s.setUser ?? s.updateUser);
  const user = useAuthStore((s: any) => s.user);

  const [selected, setSelected] = useState<{ city: string; state?: string; lat?: number; lng?: number } | null>(null);
  const [locLoading, setLocLoading] = useState(false);
  const [locError, setLocError] = useState<string | null>(null);

  const [query, setQuery] = useState('');
  const [suggestions, setSuggestions] = useState<Suggestion[]>([]);
  const [searching, setSearching] = useState(false);
  const debounceTimer = useRef<any>(null);

  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);

  // ── Manual search (debounced) ─────────────────────────────────────
  useEffect(() => {
    if (debounceTimer.current) clearTimeout(debounceTimer.current);
    if (query.trim().length < 2) {
      setSuggestions([]);
      return;
    }
    setSearching(true);
    debounceTimer.current = setTimeout(async () => {
      try {
        const res = await apiClient.get('/places/cities', { params: { input: query.trim() } });
        const preds: Suggestion[] = (res.data as any)?.predictions ?? [];
        setSuggestions(preds);
      } catch {
        setSuggestions([]);
      } finally {
        setSearching(false);
      }
    }, 300);
    return () => debounceTimer.current && clearTimeout(debounceTimer.current);
  }, [query]);

  // Reverse-geocode lat/lng → { city, state }. Tries our backend first (Google
  // Geocoding — canonical, matches manual search), then falls back to a keyless
  // client-side service. The fallback exists because the backend's Google key
  // currently has the Geocoding API disabled (REQUEST_DENIED), which would
  // otherwise make "Use my location" fail even though city search works.
  const reverseGeocode = async (
    latitude: number,
    longitude: number,
  ): Promise<{ city: string; state?: string; lat?: number; lng?: number } | null> => {
    try {
      const res = await apiClient.get('/places/reverse-geocode', {
        params: { lat: latitude, lng: longitude },
      });
      const d: any = res.data;
      if (d?.city) {
        return { city: d.city, state: d.state, lat: d.lat ?? latitude, lng: d.lng ?? longitude };
      }
    } catch {
      // ignore — fall through to the keyless fallback below
    }

    try {
      const res = await fetch(
        `https://api.bigdatacloud.net/data/reverse-geocode-client?latitude=${latitude}&longitude=${longitude}&localityLanguage=en`,
      );
      const d: any = await res.json();
      const city = d?.city || d?.locality;
      if (city) {
        return { city, state: d?.principalSubdivision || undefined, lat: latitude, lng: longitude };
      }
    } catch {
      // ignore — caller shows a generic "couldn't detect" message
    }

    return null;
  };

  // ── "Use my location" ────────────────────────────────────────────
  const detectLocation = async () => {
    setLocError(null);
    setLocLoading(true);

    // Web + native both have navigator.geolocation in Expo
    const getPosition = (): Promise<GeolocationPosition> =>
      new Promise((resolve, reject) => {
        if (typeof navigator === 'undefined' || !navigator.geolocation) {
          reject(new Error('Geolocation is not available on this device'));
          return;
        }
        navigator.geolocation.getCurrentPosition(resolve, reject, {
          timeout: 10_000,
          enableHighAccuracy: false,
          maximumAge: 60_000,
        });
      });

    try {
      const pos = await getPosition();
      const { latitude, longitude } = pos.coords;
      const result = await reverseGeocode(latitude, longitude);
      if (!result) {
        setLocError("Couldn't detect your city. Try picking manually below.");
      } else {
        setSelected(result);
      }
    } catch (e: any) {
      const code = e?.code;
      if (code === 1) setLocError('Location permission denied. Please allow it in browser settings, or pick manually.');
      else if (code === 2) setLocError('Could not determine your location. Try manual pick.');
      else if (code === 3) setLocError('Location request timed out. Try manual pick.');
      else setLocError(e?.message || 'Could not detect location.');
    } finally {
      setLocLoading(false);
    }
  };

  // ── Pick a suggestion from search ─────────────────────────────────
  const pickSuggestion = async (sug: Suggestion) => {
    const main = sug.structured_formatting?.main_text ?? sug.description.split(',')[0];
    const secondary = sug.structured_formatting?.secondary_text;
    // Fetch lat/lng via details for better data quality
    try {
      const res = await apiClient.get('/places/details', { params: { place_id: sug.place_id } });
      const loc = (res.data as any)?.result?.geometry?.location;
      setSelected({
        city: main,
        state: secondary,
        lat: loc?.lat,
        lng: loc?.lng,
      });
    } catch {
      // Fall back without coords
      setSelected({ city: main, state: secondary });
    }
    setQuery('');
    setSuggestions([]);
  };

  // ── Save & continue ───────────────────────────────────────────────
  const handleSave = async () => {
    if (!selected) return;
    setSaving(true);
    setSaveError(null);
    try {
      const payload: any = { city: selected.city };
      if (selected.state) payload.state = selected.state;
      const res = await apiClient.put('/auth/me', payload);
      const updated = (res.data as any)?.data ?? res.data;
      if (updated && updateUser) updateUser({ ...user, ...updated });
      // When opened as a modal (post-login), close ourselves so Home re-renders
      // with the new city. During onboarding (root screen) there's nothing to
      // pop — the navigator gate handles the transition instead.
      if (nav.canGoBack()) nav.goBack();
    } catch (e: any) {
      setSaveError(e?.response?.data?.message ?? 'Could not save your city. Please try again.');
    } finally {
      setSaving(false);
    }
  };

  // ── Render ────────────────────────────────────────────────────────
  return (
    <SafeAreaView style={s.screen}>
      {canClose && (
        <TouchableOpacity style={s.closeBtn} onPress={() => nav.goBack()} hitSlop={10} activeOpacity={0.7}>
          <Text style={s.closeIcon}>✕</Text>
        </TouchableOpacity>
      )}
      <ScrollView contentContainerStyle={s.scroll} keyboardShouldPersistTaps="handled">
        <Text style={s.eyebrow}>ONE MORE STEP</Text>
        <Text style={s.title}>Where do you play?</Text>
        <Text style={s.subtitle}>
          We use this to show tournaments and players near you.
        </Text>

        {/* Use my location CTA */}
        <TouchableOpacity
          style={[s.locBtn, locLoading && { opacity: 0.6 }]}
          onPress={detectLocation}
          disabled={locLoading}
          activeOpacity={0.85}
        >
          {locLoading ? (
            <ActivityIndicator color={YColors.lime} />
          ) : (
            <>
              <Text style={s.locBtnIcon}>📍</Text>
              <Text style={s.locBtnText}>USE MY LOCATION</Text>
            </>
          )}
        </TouchableOpacity>
        {locError && <Text style={s.errorText}>{locError}</Text>}

        {/* Divider */}
        <View style={s.dividerRow}>
          <View style={s.dividerLine} />
          <Text style={s.dividerText}>OR PICK MANUALLY</Text>
          <View style={s.dividerLine} />
        </View>

        {/* Manual search */}
        <View style={s.searchBox}>
          <TextInput
            style={s.searchInput}
            placeholder="Search your city…"
            placeholderTextColor={YColors.ink3}
            value={query}
            onChangeText={setQuery}
            autoCapitalize="words"
            autoCorrect={false}
          />
          {searching && (
            <ActivityIndicator size="small" color={YColors.ink2} style={{ marginLeft: 8 }} />
          )}
        </View>
        {suggestions.length > 0 && (
          <View style={s.suggestList}>
            {suggestions.slice(0, 6).map((sug) => (
              <TouchableOpacity key={sug.place_id} style={s.suggestRow} onPress={() => pickSuggestion(sug)}>
                <Text style={s.suggestMain}>
                  {sug.structured_formatting?.main_text ?? sug.description.split(',')[0]}
                </Text>
                {sug.structured_formatting?.secondary_text && (
                  <Text style={s.suggestSecondary}>{sug.structured_formatting.secondary_text}</Text>
                )}
              </TouchableOpacity>
            ))}
          </View>
        )}

        {/* Selected city preview */}
        {selected && (
          <View style={s.selectedCard}>
            <Text style={s.selectedLabel}>SELECTED</Text>
            <Text style={s.selectedCity}>{selected.city}</Text>
            {selected.state && <Text style={s.selectedSub}>{selected.state}</Text>}
            <TouchableOpacity onPress={() => setSelected(null)}>
              <Text style={s.changeText}>↻ Change</Text>
            </TouchableOpacity>
          </View>
        )}

        {/* Continue */}
        <TouchableOpacity
          style={[s.continueBtn, (!selected || saving) && s.continueBtnDisabled]}
          onPress={handleSave}
          disabled={!selected || saving}
          activeOpacity={0.85}
        >
          {saving ? <ActivityIndicator color="#FFFFFF" /> : <Text style={s.continueText}>CONTINUE</Text>}
        </TouchableOpacity>
        {saveError && <Text style={s.errorText}>{saveError}</Text>}
      </ScrollView>
    </SafeAreaView>
  );
};

const s = StyleSheet.create({
  screen: { flex: 1, backgroundColor: YColors.bg },
  scroll: { paddingHorizontal: 24, paddingTop: 60, paddingBottom: 180 },

  closeBtn: { position: 'absolute', top: 16, right: 20, zIndex: 20, elevation: 6, width: 36, height: 36, borderRadius: 18, alignItems: 'center', justifyContent: 'center', backgroundColor: YColors.bg2, borderWidth: 1, borderColor: YColors.line },
  closeIcon: { fontSize: 16, fontWeight: '900', color: YColors.ink },

  eyebrow: { fontSize: 11, fontWeight: '900', letterSpacing: 1.6, color: YColors.ink2, textTransform: 'uppercase' },
  title: { fontSize: 32, fontWeight: '900', color: YColors.ink, marginTop: 8, letterSpacing: 0.3 },
  subtitle: { fontSize: 14, color: YColors.ink2, marginTop: 8, lineHeight: 20 },

  // Use my location button
  locBtn: {
    marginTop: 28,
    backgroundColor: YColors.ink,
    paddingVertical: 16, paddingHorizontal: 18,
    borderRadius: 14,
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center',
    gap: 12,
  },
  locBtnIcon: { fontSize: 18 },
  locBtnText: { color: YColors.lime, fontSize: 14, fontWeight: '900', letterSpacing: 1.4 },

  errorText: { fontSize: 12, color: '#E76F51', marginTop: 10, fontWeight: '600' },

  // Divider
  dividerRow: { flexDirection: 'row', alignItems: 'center', gap: 10, marginVertical: 28 },
  dividerLine: { flex: 1, height: 1, backgroundColor: YColors.line },
  dividerText: { fontSize: 10, fontWeight: '900', letterSpacing: 1.5, color: YColors.ink3 },

  // Search
  searchBox: {
    backgroundColor: YColors.bg2, borderRadius: 12, borderWidth: 1, borderColor: YColors.line,
    paddingHorizontal: 14, paddingVertical: 12,
    flexDirection: 'row', alignItems: 'center',
  },
  searchInput: { flex: 1, fontSize: 15, fontWeight: '600', color: YColors.ink },

  suggestList: { marginTop: 10, backgroundColor: YColors.bg2, borderRadius: 12, borderWidth: 1, borderColor: YColors.line, overflow: 'hidden' },
  suggestRow: { paddingHorizontal: 14, paddingVertical: 12, borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: YColors.line },
  suggestMain: { fontSize: 15, fontWeight: '800', color: YColors.ink },
  suggestSecondary: { fontSize: 12, color: YColors.ink2, marginTop: 2 },

  // Selected preview
  selectedCard: {
    marginTop: 24, padding: 18, borderRadius: 14, backgroundColor: YColors.lime,
    borderWidth: 1, borderColor: YColors.ink,
  },
  selectedLabel: { fontSize: 10, fontWeight: '900', letterSpacing: 1.5, color: YColors.ink },
  selectedCity: { fontSize: 24, fontWeight: '900', color: YColors.ink, marginTop: 4 },
  selectedSub: { fontSize: 12, fontWeight: '700', color: YColors.ink2, marginTop: 2 },
  changeText: { fontSize: 12, fontWeight: '700', color: YColors.ink, marginTop: 10, textDecorationLine: 'underline' },

  // Continue
  continueBtn: {
    marginTop: 32, paddingVertical: 16, borderRadius: 14, alignItems: 'center',
    backgroundColor: YColors.ink,
  },
  continueBtnDisabled: { opacity: 0.35 },
  continueText: { color: '#FFFFFF', fontSize: 14, fontWeight: '900', letterSpacing: 1.6 },
});
