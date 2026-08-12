import React, { useState, useRef, useCallback } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  FlatList,
  ActivityIndicator,
  StyleSheet,
  Keyboard,
} from 'react-native';
import Svg, { Path, Circle } from 'react-native-svg';
import { API_BASE_URL } from '../../config/constants';

// ─── Types ────────────────────────────────────────────────────────────────────

export interface PlaceResult {
  name: string;
  address: string;
  city: string;
  state: string;
  lat: number;
  lng: number;
}

interface Suggestion {
  placeId: string;
  mainText: string;
  secondaryText: string;
}

// ─── Constants ────────────────────────────────────────────────────────────────

const NAVY = '#001E40';
const BLUE = '#1858D6';
const GRAY = '#737780';
const WHITE = '#FFFFFF';
const BG = '#F8F9FA';
const BORDER = '#E1E3E4';

// Proxy through our backend (CORS-safe). Backend needs GOOGLE_PLACES_API_KEY env var
// set on Cloud Run — currently missing, so this fails until that's fixed.
const AUTOCOMPLETE_URL = `${API_BASE_URL}/places/autocomplete`;
const DETAILS_URL = `${API_BASE_URL}/places/details`;

// ─── Icons ────────────────────────────────────────────────────────────────────

const MapPinIcon = ({ color = GRAY }: { color?: string }) => (
  <Svg width={16} height={16} viewBox="0 0 24 24" fill="none">
    <Path d="M12 2C8.13 2 5 5.13 5 9c0 5.25 7 13 7 13s7-7.75 7-13c0-3.87-3.13-7-7-7z" fill={color} />
    <Circle cx="12" cy="9" r="2.5" fill={WHITE} />
  </Svg>
);

const SearchIcon = () => (
  <Svg width={16} height={16} viewBox="0 0 24 24" fill="none">
    <Circle cx="11" cy="11" r="8" stroke={GRAY} strokeWidth={2} />
    <Path d="M21 21l-4.35-4.35" stroke={GRAY} strokeWidth={2} strokeLinecap="round" />
  </Svg>
);

const ClearIcon = () => (
  <Svg width={16} height={16} viewBox="0 0 24 24" fill="none">
    <Path d="M18 6L6 18M6 6l12 12" stroke={GRAY} strokeWidth={2} strokeLinecap="round" />
  </Svg>
);

// ─── Component ────────────────────────────────────────────────────────────────

interface Props {
  onSelect: (place: PlaceResult) => void;
  initialValue?: string;
  placeholder?: string;
  error?: string;
}

export default function PlacesAutocomplete({
  onSelect,
  initialValue = '',
  placeholder = 'Search for a venue...',
  error,
}: Props) {
  const [query, setQuery] = useState(initialValue);
  const [suggestions, setSuggestions] = useState<Suggestion[]>([]);
  const [loading, setLoading] = useState(false);
  const [showDropdown, setShowDropdown] = useState(false);
  const [selected, setSelected] = useState(!!initialValue);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const fetchSuggestions = useCallback(async (text: string) => {
    if (text.length < 3) {
      setSuggestions([]);
      setShowDropdown(false);
      return;
    }

    setLoading(true);
    try {
      const res = await fetch(`${AUTOCOMPLETE_URL}?input=${encodeURIComponent(text)}`);
      const data = await res.json();

      if (data.predictions && data.predictions.length > 0) {
        const mapped: Suggestion[] = data.predictions.map((p: any) => ({
          placeId: p.place_id,
          mainText: p.structured_formatting?.main_text ?? p.description,
          secondaryText: p.structured_formatting?.secondary_text ?? '',
        }));
        setSuggestions(mapped);
        setShowDropdown(true);
      } else {
        setSuggestions([]);
        setShowDropdown(false);
      }
    } catch {
      setSuggestions([]);
    } finally {
      setLoading(false);
    }
  }, []);

  const handleChangeText = (text: string) => {
    setQuery(text);
    setSelected(false);

    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => fetchSuggestions(text), 350);
  };

  const handleSelect = async (suggestion: Suggestion) => {
    Keyboard.dismiss();
    setShowDropdown(false);
    setLoading(true);
    setQuery(suggestion.mainText);

    try {
      const res = await fetch(`${DETAILS_URL}?place_id=${encodeURIComponent(suggestion.placeId)}`);
      const data = await res.json();

      if (data.result) {
        const r = data.result;
        const components = r.address_components ?? [];

        let city = '';
        let state = '';
        for (const c of components) {
          if (c.types.includes('locality')) city = c.long_name;
          if (c.types.includes('administrative_area_level_1')) state = c.long_name;
          if (!city && c.types.includes('sublocality_level_1')) city = c.long_name;
        }

        const place: PlaceResult = {
          name: r.name ?? suggestion.mainText,
          address: r.formatted_address ?? suggestion.secondaryText,
          city,
          state,
          lat: r.geometry?.location?.lat ?? 0,
          lng: r.geometry?.location?.lng ?? 0,
        };

        setQuery(place.name);
        setSelected(true);
        onSelect(place);
      }
    } catch {
      // Fallback: use suggestion text
      setQuery(suggestion.mainText);
      setSelected(true);
      onSelect({
        name: suggestion.mainText,
        address: suggestion.secondaryText,
        city: '',
        state: '',
        lat: 0,
        lng: 0,
      });
    } finally {
      setLoading(false);
    }
  };

  const handleClear = () => {
    setQuery('');
    setSuggestions([]);
    setShowDropdown(false);
    setSelected(false);
  };

  return (
    <View style={s.container}>
      {/* Input */}
      <View style={[s.inputRow, error ? s.inputError : null, selected ? s.inputSelected : null]}>
        <View style={s.iconBox}>
          {selected ? <MapPinIcon color={BLUE} /> : <SearchIcon />}
        </View>
        <TextInput
          style={s.input}
          value={query}
          onChangeText={handleChangeText}
          placeholder={placeholder}
          placeholderTextColor="#B0B3BA"
          onFocus={() => {
            if (suggestions.length > 0 && !selected) setShowDropdown(true);
          }}
          returnKeyType="search"
        />
        {loading && <ActivityIndicator size="small" color={BLUE} style={{ marginRight: 8 }} />}
        {query.length > 0 && !loading && (
          <TouchableOpacity onPress={handleClear} style={s.clearBtn}>
            <ClearIcon />
          </TouchableOpacity>
        )}
      </View>

      {/* Error */}
      {error && <Text style={s.errorText}>{error}</Text>}

      {/* Selected badge */}
      {selected && query && (
        <View style={s.selectedBadge}>
          <MapPinIcon color={BLUE} />
          <Text style={s.selectedText} numberOfLines={1}>Venue selected</Text>
        </View>
      )}

      {/* Dropdown */}
      {showDropdown && suggestions.length > 0 && (
        <View style={s.dropdown}>
          {suggestions.map((item) => (
            <TouchableOpacity
              key={item.placeId}
              style={s.suggestionRow}
              onPress={() => handleSelect(item)}
              activeOpacity={0.7}
            >
              <View style={s.suggestionIcon}>
                <MapPinIcon color={NAVY} />
              </View>
              <View style={s.suggestionText}>
                <Text style={s.suggestionMain} numberOfLines={1}>{item.mainText}</Text>
                <Text style={s.suggestionSec} numberOfLines={1}>{item.secondaryText}</Text>
              </View>
            </TouchableOpacity>
          ))}
          <View style={s.poweredBy}>
            <Text style={s.poweredByText}>Powered by Google</Text>
          </View>
        </View>
      )}
    </View>
  );
}

// ─── Styles ───────────────────────────────────────────────────────────────────

const s = StyleSheet.create({
  container: {
    marginBottom: 14,
    zIndex: 9999,
    position: 'relative',
  },
  inputRow: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: WHITE,
    borderWidth: 1.5,
    borderColor: BORDER,
    borderRadius: 12,
    minHeight: 50,
  },
  inputError: {
    borderColor: '#BA1A1A',
  },
  inputSelected: {
    borderColor: BLUE,
    backgroundColor: '#F0F7FF',
  },
  iconBox: {
    width: 40,
    alignItems: 'center',
    justifyContent: 'center',
  },
  input: {
    flex: 1,
    fontSize: 15,
    fontWeight: '600',
    color: NAVY,
    paddingVertical: 13,
    paddingRight: 8,
  },
  clearBtn: {
    width: 36,
    height: 36,
    alignItems: 'center',
    justifyContent: 'center',
  },
  errorText: {
    fontSize: 11,
    color: '#BA1A1A',
    fontWeight: '600',
    marginTop: 5,
  },
  selectedBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginTop: 6,
    paddingHorizontal: 10,
    paddingVertical: 5,
    backgroundColor: BLUE + '12',
    borderRadius: 8,
    alignSelf: 'flex-start',
  },
  selectedText: {
    fontSize: 11,
    fontWeight: '700',
    color: BLUE,
    letterSpacing: 0.3,
  },
  dropdown: {
    position: 'absolute',
    top: 54,
    left: 0,
    right: 0,
    backgroundColor: WHITE,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: BORDER,
    shadowColor: NAVY,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.15,
    shadowRadius: 16,
    elevation: 50,
    zIndex: 99999,
    maxHeight: 300,
  },
  suggestionRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 12,
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#F0F0F0',
  },
  suggestionIcon: {
    width: 32,
    height: 32,
    borderRadius: 8,
    backgroundColor: NAVY + '0C',
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 10,
  },
  suggestionText: {
    flex: 1,
  },
  suggestionMain: {
    fontSize: 14,
    fontWeight: '700',
    color: NAVY,
    marginBottom: 2,
  },
  suggestionSec: {
    fontSize: 12,
    fontWeight: '500',
    color: GRAY,
  },
  poweredBy: {
    paddingVertical: 8,
    alignItems: 'center',
  },
  poweredByText: {
    fontSize: 10,
    fontWeight: '500',
    color: '#B0B3BA',
    letterSpacing: 0.3,
  },
});
