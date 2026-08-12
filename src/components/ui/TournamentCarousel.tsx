import React, { useRef, useState, useEffect, useCallback } from 'react';
import {
  View,
  Animated,
  StyleSheet,
  Dimensions,
  NativeSyntheticEvent,
  NativeScrollEvent,
  TouchableOpacity,
} from 'react-native';
import TournamentTile from './TournamentTile';
import { Tournament } from '../../types/tournament.types';

const { width: SW } = Dimensions.get('window');

// ─── Carousel geometry (Hotstar / IPL style) ──────────────────────────
// Main card takes most of the screen, with a thin sliver of the next card
// visible on the right to hint that there's more content.
const SIDE_PADDING = 20;
const CARD_GAP = 10;
// Card width = screen width - (left padding) - (peek of next card + its left gap)
// We want ~28px of the next card visible to form a "stacked" edge.
const NEXT_CARD_PEEK = 32;
const CARD_WIDTH = Math.min(SW - SIDE_PADDING - NEXT_CARD_PEEK - CARD_GAP, 380);
const SNAP_WIDTH = CARD_WIDTH + CARD_GAP;

const AUTO_SCROLL_INTERVAL = 4500;

interface Props {
  tournaments: Tournament[];
  onPress: (tournament: Tournament) => void;
}

export default function TournamentCarousel({ tournaments, onPress }: Props) {
  const flatListRef = useRef<Animated.FlatList<Tournament>>(null);
  const scrollX = useRef(new Animated.Value(0)).current;
  const [activeIndex, setActiveIndex] = useState(0);
  const autoScrollRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const count = tournaments.length;

  const startAutoScroll = useCallback(() => {
    if (autoScrollRef.current) clearInterval(autoScrollRef.current);
    if (count <= 1) return;

    autoScrollRef.current = setInterval(() => {
      setActiveIndex((prev) => {
        const next = (prev + 1) % count;
        (flatListRef.current as any)?.scrollToOffset?.({
          offset: next * SNAP_WIDTH,
          animated: true,
        });
        return next;
      });
    }, AUTO_SCROLL_INTERVAL);
  }, [count]);

  useEffect(() => {
    startAutoScroll();
    return () => {
      if (autoScrollRef.current) clearInterval(autoScrollRef.current);
    };
  }, [startAutoScroll]);

  const onScroll = Animated.event(
    [{ nativeEvent: { contentOffset: { x: scrollX } } }],
    {
      useNativeDriver: true,
      listener: (e: NativeSyntheticEvent<NativeScrollEvent>) => {
        const x = e.nativeEvent.contentOffset.x;
        const idx = Math.round(x / SNAP_WIDTH);
        if (idx !== activeIndex && idx >= 0 && idx < count) {
          setActiveIndex(idx);
        }
      },
    },
  );

  const onScrollBeginDrag = () => {
    if (autoScrollRef.current) clearInterval(autoScrollRef.current);
  };

  const onScrollEndDrag = () => {
    startAutoScroll();
  };

  if (count === 0) return null;

  const renderItem = ({ item, index }: { item: Tournament; index: number }) => {
    // Each card's "position" relative to the scroll offset.
    // When this card is active, scrollX == index * SNAP_WIDTH → position 0
    // One card back/forward, position == -1 / +1.
    const inputRange = [
      (index - 1) * SNAP_WIDTH,
      index * SNAP_WIDTH,
      (index + 1) * SNAP_WIDTH,
    ];

    // Slight scale-down when a card is not the active one → "stacked" look.
    const scale = scrollX.interpolate({
      inputRange,
      outputRange: [0.93, 1, 0.93],
      extrapolate: 'clamp',
    });

    // Fade slightly for non-active cards.
    const opacity = scrollX.interpolate({
      inputRange,
      outputRange: [0.55, 1, 0.55],
      extrapolate: 'clamp',
    });

    return (
      <Animated.View style={[s.cardWrapper, { transform: [{ scale }], opacity }]}>
        <TournamentTile
          tournament={item}
          variant="card"
          onPress={() => onPress(item)}
        />
      </Animated.View>
    );
  };

  return (
    <View style={s.container}>
      <Animated.FlatList
        ref={flatListRef as any}
        data={tournaments}
        keyExtractor={(item) => item.id}
        horizontal
        showsHorizontalScrollIndicator={false}
        snapToInterval={SNAP_WIDTH}
        decelerationRate="fast"
        contentContainerStyle={s.listContent}
        onScroll={onScroll}
        onScrollBeginDrag={onScrollBeginDrag}
        onScrollEndDrag={onScrollEndDrag}
        scrollEventThrottle={16}
        renderItem={renderItem}
      />

      {/* Dot indicators — hide if too many */}
      {count > 1 && count <= 6 && (
        <View style={s.dots}>
          {tournaments.map((_, i) => (
            <TouchableOpacity
              key={i}
              onPress={() => {
                (flatListRef.current as any)?.scrollToOffset?.({
                  offset: i * SNAP_WIDTH,
                  animated: true,
                });
                setActiveIndex(i);
                startAutoScroll();
              }}
            >
              <View style={[s.dot, i === activeIndex && s.dotActive]} />
            </TouchableOpacity>
          ))}
        </View>
      )}
    </View>
  );
}

const s = StyleSheet.create({
  container: {
    marginBottom: 8,
  },
  listContent: {
    paddingLeft: SIDE_PADDING,
    paddingRight: SIDE_PADDING / 2,
  },
  cardWrapper: {
    width: CARD_WIDTH,
    marginRight: CARD_GAP,
  },
  dots: {
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    gap: 6,
    marginTop: 8,
    paddingBottom: 4,
  },
  dot: {
    width: 7,
    height: 7,
    borderRadius: 4,
    backgroundColor: 'rgba(0,30,64,0.15)',
  },
  dotActive: {
    backgroundColor: '#1858D6',
    width: 20,
    borderRadius: 4,
  },
});
