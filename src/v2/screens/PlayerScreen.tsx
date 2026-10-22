// A player within one event (same as yoiden.com/events/<id>/player/<slug>).
import React from 'react';
import { useRoute } from '@react-navigation/native';
import { eventById } from '../data/events';
import LeaguePlayer from './player/LeaguePlayer';
import FootballPlayer from './player/FootballPlayer';

export default function PlayerScreen() {
  const { eventId, slug } = useRoute<any>().params as { eventId: string; slug: string };
  const event = eventById(eventId);
  if (!event) return null;
  return event.football ? <FootballPlayer event={event} slug={slug} /> : <LeaguePlayer event={event} slug={slug} />;
}
