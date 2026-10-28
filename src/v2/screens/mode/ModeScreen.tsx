// One role mode inside an event: admin, scorer or captain, for a league or a football
// event. The lime ModeBar stays on top; "View as public" goes back to the event page.
import React from 'react';
import { View } from 'react-native';
import { useRoute } from '@react-navigation/native';
import { ModeBar } from '../../components/mode-bar';
import { Page } from '../../components/chrome';
import { Empty } from '../../components/ui';
import { eventById } from '../../data/events';
import type { Role } from '../../store/roles';
import { C } from '../../theme';
import LeagueMode from './LeagueMode';
import CaptainMode from './CaptainMode';
import FootballMode from './FootballMode';

export type ModeParams = {
  eventId: string;
  role: Role;
  kind: 'league' | 'football' | 'event';
  slug: string | null;
  leagueId?: string;
  teamId?: string;
};

export default function ModeScreen() {
  const p = useRoute<any>().params as ModeParams;
  const event = eventById(p.eventId);
  const division = event?.leagues && event.leagues.length > 1 ? event.leagues.find((l) => l.slug === p.slug)?.label : null;
  const title = [event?.name ?? 'Event', division].filter(Boolean).join(' · ');

  let body: React.ReactNode;
  if (!event) body = <Empty>This event isn't on Yoiden any more.</Empty>;
  else if (p.kind === 'football' && event.football) body = <FootballMode event={event} role={p.role} />;
  else if (p.kind === 'league' && p.slug && p.role === 'captain') body = <CaptainMode event={event} slug={p.slug} teamId={p.teamId} />;
  else if (p.kind === 'league' && p.slug) body = <LeagueMode event={event} slug={p.slug} leagueId={p.leagueId} role={p.role} />;
  else body = <Empty>Tools for this role aren't in the app yet. Your organiser can help from the web console.</Empty>;

  return (
    <View style={{ flex: 1, backgroundColor: C.page }}>
      <ModeBar role={p.role} title={title} />
      {React.isValidElement(body) && (body.type === Empty) ? (
        <Page>
          <View style={{ marginTop: 16 }}>{body}</View>
        </Page>
      ) : (
        body
      )}
    </View>
  );
}
