// Opens one event inside the app, picking the view for its type. Event types
// without a v2 view yet (indoor games, tournaments, registration-only events)
// show the tile details and a link to the event's own site.
import React from 'react';
import { Linking, View } from 'react-native';
import { useRoute } from '@react-navigation/native';
import { AppHeader, Page } from '../components/chrome';
import { EventBanner } from '../components/event-banner';
import { Button, Empty } from '../components/ui';
import { eventById } from '../data/events';
import { C } from '../theme';
import LeagueEvent from './event/LeagueEvent';
import FootballEvent from './event/FootballEvent';
import AuctionEvent from './event/AuctionEvent';

export default function EventScreen() {
  const { id } = useRoute<any>().params as { id: string };
  const event = eventById(id);
  if (!event) {
    return (
      <View style={{ flex: 1, backgroundColor: C.page }}>
        <AppHeader back title="Event" />
        <Page>
          <View style={{ marginTop: 16 }}>
            <Empty>This event isn't on Yoiden any more.</Empty>
          </View>
        </Page>
      </View>
    );
  }
  if (event.football) return <FootballEvent event={event} />;
  if (event.auctions?.length) return <AuctionEvent event={event} />;
  if (event.leagues?.length) return <LeagueEvent event={event} />;
  return (
    <View style={{ flex: 1, backgroundColor: C.page }}>
      <AppHeader back title={event.name} />
      <Page padded={false}>
        <EventBanner event={event} />
        <View style={{ padding: 16, gap: 12 }}>
          <Empty>Results for this event are on its own site for now.</Empty>
          {event.url ? <Button title="Open the event site" onPress={() => Linking.openURL(event.url!)} tone="navy" /> : null}
        </View>
      </Page>
    </View>
  );
}
