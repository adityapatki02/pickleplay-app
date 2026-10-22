// My events tab: the events the player follows, the events where they hold a
// role (admin / scorer / captain), and the registration forms open right now.
// Per-user registrations need a backend endpoint, so for now only open forms show.
import React, { useMemo } from 'react';
import { ActivityIndicator, Text, View } from 'react-native';
import { useNavigation } from '@react-navigation/native';
import { C, body, card } from '../theme';
import { Button } from '../components/ui';
import { AppHeader, Page } from '../components/chrome';
import { EventRow, RegistrationTile, useOpenRegistrations } from '../components/tiles';
import { useNow } from '../hooks';
import { useFollows } from '../store/follows';
import { useMyRoles } from '../store/roles';
import { eventById, statusOf, type YoidenEvent } from '../data/events';
import { useAuthStore } from '../../store/authStore';
import { RoleRows, SectionLabel } from './MeScreen';

export default function MyEventsScreen() {
  const nav = useNavigation<any>();
  const now = useNow();
  const ids = useFollows((st) => st.ids);
  const signedIn = useAuthStore((st) => st.isAuthenticated && !!st.user);
  const { roles, loading } = useMyRoles();
  const regs = useOpenRegistrations(now);

  const followed = useMemo(() => ids.map(eventById).filter((e): e is YoidenEvent => !!e), [ids]);

  return (
    <View style={{ flex: 1, backgroundColor: C.page }}>
      <AppHeader title="My events" />
      <Page>
        <SectionLabel>★ Following</SectionLabel>
        {followed.length ? (
          <View style={[card, { overflow: 'hidden' }]}>
            {followed.map((e, i) => (
              <EventRow
                key={e.id}
                e={e}
                status={statusOf(e, now)}
                last={i === followed.length - 1}
                onPress={() => nav.navigate('Event', { id: e.id })}
              />
            ))}
          </View>
        ) : (
          <View style={[card, { padding: 20, alignItems: 'center', gap: 14 }]}>
            <Text style={[body(14, C.soft), { textAlign: 'center' }]}>Follow an event to keep it here and at the top of Home.</Text>
            <Button title="Browse events" tone="navy" small onPress={() => nav.navigate('EventsTab')} />
          </View>
        )}

        {signedIn && (loading || roles.length > 0) && (
          <>
            <SectionLabel>Your roles</SectionLabel>
            <View style={[card, { overflow: 'hidden' }]}>
              {loading && !roles.length ? (
                <View style={{ padding: 16 }}>
                  <ActivityIndicator color={C.accent} />
                </View>
              ) : (
                <RoleRows roles={roles} compact />
              )}
            </View>
          </>
        )}

        <SectionLabel>Registrations</SectionLabel>
        {regs.length ? (
          <View style={{ gap: 12 }}>
            {regs.map((o) => (
              <RegistrationTile key={o.r.id} {...o} width="100%" />
            ))}
          </View>
        ) : (
          <View style={[card, { padding: 18 }]}>
            <Text style={[body(14, C.soft), { textAlign: 'center' }]}>No registration forms are open right now.</Text>
          </View>
        )}
        <Text style={[body(12.5, C.mute), { marginTop: 10, textAlign: 'center' }]}>
          Your registrations will show here once you register through the app.
        </Text>
      </Page>
    </View>
  );
}
