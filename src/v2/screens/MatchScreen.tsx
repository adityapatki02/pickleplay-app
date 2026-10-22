// One match inside an event: a league tie or a football match.
import React from 'react';
import { useRoute } from '@react-navigation/native';
import { eventById } from '../data/events';
import LeagueMatch from './match/LeagueMatch';
import FootballMatch from './match/FootballMatch';

export default function MatchScreen() {
  const { eventId, matchId } = useRoute<any>().params as { eventId: string; matchId: string };
  const event = eventById(eventId);
  if (!event) return null;
  return event.football ? <FootballMatch event={event} matchId={matchId} /> : <LeagueMatch event={event} matchId={matchId} />;
}
