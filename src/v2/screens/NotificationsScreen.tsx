// The bell: every match result from the events you follow, plus live now,
// starting soon, results in, and registration forms closing soon. Opening it
// clears the dot. Push notifications will deliver the same lines.
import React, { useEffect } from 'react';
import { Linking, Pressable, StyleSheet, Text, View } from 'react-native';
import { useNavigation } from '@react-navigation/native';
import { AppHeader, Page } from '../components/chrome';
import { Button } from '../components/ui';
import { BellIcon, ChevronRight } from '../components/icons';
import { useNotes, useNotesSeen, type Note } from '../store/notifications';
import { useNow } from '../hooks';
import { C, body, card, label } from '../theme';

const KIND: Record<Note['kind'], { text: string; color: string }> = {
  live: { text: '● Live now', color: C.live },
  soon: { text: 'Starting soon', color: C.hlInk },
  results: { text: 'Results', color: C.accent },
  closing: { text: 'Closing soon', color: C.amber },
  result: { text: 'Result', color: C.green },
};

export default function NotificationsScreen() {
  const nav = useNavigation<any>();
  const now = useNow();
  const notes = useNotes(now);
  const { seenAt, markSeen } = useNotesSeen();
  // Remember what was new on arrival, then clear the dot.
  const [newSince] = React.useState(seenAt);
  useEffect(() => {
    markSeen();
  }, [markSeen]);

  const open = (n: Note) => {
    if (n.eventId && n.matchId) nav.navigate('Match', { eventId: n.eventId, matchId: n.matchId });
    else if (n.eventId) nav.navigate('Event', { id: n.eventId });
    else if (n.url) Linking.openURL(n.url);
  };

  return (
    <View style={{ flex: 1, backgroundColor: C.page }}>
      <AppHeader back title="Notifications" />
      <Page>
        {notes.length ? (
          <View style={[card, { overflow: 'hidden', marginTop: 12 }]}>
            {notes.map((n, i) => (
              <Pressable
                key={n.id}
                onPress={() => open(n)}
                style={({ pressed }) => [s.row, i < notes.length - 1 && s.divider, pressed && { backgroundColor: C.page }]}
              >
                <View style={[s.dot, { backgroundColor: n.at > newSince ? C.accent : 'transparent' }]} />
                <View style={{ flex: 1 }}>
                  <Text style={label(11.5, KIND[n.kind].color)}>{KIND[n.kind].text}</Text>
                  <Text style={[body(14.5, C.ink, 'semi'), { marginTop: 3 }]}>{n.title}</Text>
                  <Text style={[body(12.5, C.soft), { marginTop: 2 }]}>{n.body}</Text>
                </View>
                <ChevronRight color={C.mute} />
              </Pressable>
            ))}
          </View>
        ) : (
          <View style={[card, s.empty]}>
            <View style={s.bell}>
              <BellIcon size={22} color={C.bar} />
            </View>
            <Text style={[body(15, C.ink, 'bold'), { textAlign: 'center' }]}>Nothing new yet</Text>
            <Text style={[body(13, C.soft), { textAlign: 'center' }]}>
              Follow an event and you'll hear here when it goes live, when it starts and when results are in.
            </Text>
            <Button title="Browse events" tone="navy" small onPress={() => nav.navigate('Tabs', { screen: 'EventsTab' })} />
          </View>
        )}
      </Page>
    </View>
  );
}

const s = StyleSheet.create({
  row: { flexDirection: 'row', alignItems: 'center', gap: 10, paddingVertical: 12, paddingRight: 12, paddingLeft: 10, backgroundColor: C.white },
  divider: { borderBottomWidth: 1, borderBottomColor: C.line },
  dot: { width: 8, height: 8, borderRadius: 4 },
  empty: { marginTop: 12, padding: 22, alignItems: 'center', gap: 10 },
  bell: { width: 46, height: 46, borderRadius: 23, backgroundColor: C.hl, alignItems: 'center', justifyContent: 'center' },
});
