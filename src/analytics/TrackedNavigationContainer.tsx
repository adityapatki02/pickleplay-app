import React from 'react';
import { NavigationContainer, useNavigationContainerRef } from '@react-navigation/native';
import { analytics, SCREEN_EVENTS } from './index';

type Props = React.ComponentProps<typeof NavigationContainer>;

/**
 * NavigationContainer that reports a screen view to analytics whenever the
 * focused route changes (and once on ready). Drop-in replacement; every prop
 * passes through.
 */
export function TrackedNavigationContainer({ children, onReady, onStateChange, ...rest }: Props) {
  const ref = useNavigationContainerRef();
  const lastRoute = React.useRef<string | undefined>(undefined);
  const report = () => {
    const route = ref.getCurrentRoute();
    if (!route || route.name === lastRoute.current) return;
    lastRoute.current = route.name;
    const p = (route.params || {}) as Record<string, any>;
    const props = {
      leagueId: p.leagueId, seasonId: p.seasonId, tieId: p.tieId, tournamentId: p.tournamentId,
      venueId: p.venueId, playerId: p.playerId || p.userId, franchiseId: p.franchiseId, screen: route.name,
    };
    analytics.screen(route.name, props);
    const ev = SCREEN_EVENTS[route.name];
    if (ev) analytics.capture(ev, props);
  };
  return (
    <NavigationContainer
      ref={ref as any}
      {...rest}
      onReady={() => { report(); onReady?.(); }}
      onStateChange={(state) => { report(); onStateChange?.(state); }}
    >
      {children}
    </NavigationContainer>
  );
}
