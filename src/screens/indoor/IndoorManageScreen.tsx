import React, { useState } from 'react';
import { View, Text, TextInput, Pressable, StyleSheet } from 'react-native';
import { indoorApi } from '../../api/indoor.api';
import { useManage } from './manageContext';
import { IndoorHeader } from './components/IndoorHeader';
import { SportyBackground } from './components/SportyBackground';
import { T } from './indoorTheme';

export default function IndoorManageScreen({ navigation }: any) {
  const { setAuth } = useManage();
  const [code, setCode] = useState('');
  const [err, setErr] = useState('');
  const [busy, setBusy] = useState(false);
  const submit = async () => {
    if (!code.trim()) return;
    setBusy(true); setErr('');
    try {
      const { role } = await indoorApi.login(code.trim());
      setAuth(role, code.trim());
      navigation.reset({ index: 0, routes: [{ name: 'IndoorOverview' }] });
    } catch (e) { setErr('Invalid passcode'); } finally { setBusy(false); }
  };
  return (
    <View style={{ flex: 1, backgroundColor: T.bg }}>
      <SportyBackground />
      <IndoorHeader onBack={() => navigation.navigate('IndoorOverview')} title="Manage" />
      <View style={s.wrap}>
        <View style={s.card}>
          <Text style={s.h}>OFFICIAL LOGIN</Text>
          <Text style={s.sub}>Enter your scorer or admin passcode.</Text>
          <TextInput value={code} onChangeText={setCode} placeholder="Passcode" placeholderTextColor={T.faint}
            secureTextEntry autoCapitalize="none" style={s.input} onSubmitEditing={submit} />
          {err ? <Text style={s.err}>{err}</Text> : null}
          <Pressable onPress={submit} disabled={busy} style={[s.btn, busy && { opacity: 0.6 }]}>
            <Text style={s.btnT}>{busy ? 'Checking…' : 'Log in'}</Text>
          </Pressable>
        </View>
      </View>
    </View>
  );
}
const s = StyleSheet.create({
  wrap: { flex: 1, alignItems: 'center', justifyContent: 'flex-start', padding: 20 },
  card: { width: '100%', maxWidth: 400, backgroundColor: T.card, borderColor: T.line, borderWidth: 1, borderRadius: 16, padding: 22, marginTop: 24 },
  h: { fontFamily: T.head, color: T.navy, fontSize: 16, fontWeight: '800', letterSpacing: 0.5 },
  sub: { color: T.muted, fontSize: 13, marginTop: 4, marginBottom: 16 },
  input: { borderWidth: 1, borderColor: T.line, borderRadius: 10, paddingHorizontal: 14, paddingVertical: 12, fontSize: 15, color: T.ink, backgroundColor: T.bgSoft },
  err: { color: '#EF4444', fontSize: 12.5, marginTop: 8 },
  btn: { backgroundColor: T.blue, borderRadius: 10, paddingVertical: 13, alignItems: 'center', marginTop: 16 },
  btnT: { color: '#fff', fontWeight: '800', fontSize: 14 },
});
