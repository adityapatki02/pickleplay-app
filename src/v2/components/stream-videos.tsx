// Event streams as video cards: YouTube's own thumbnail with a lime play
// button. Tapping opens the stream in YouTube (the app on phones, a new tab on
// the web), so no player script loads until someone wants to watch.
import React from 'react';
import { Image, Linking, Pressable, StyleSheet, Text, View } from 'react-native';
import { C, body } from '../theme';
import { Panel } from './ui';
import { PlayIcon } from './icons';

export type StreamVideo = { title: string; url: string };

export function youtubeId(url: string): string | null {
  const m =
    url.match(/youtu\.be\/([^?&/]+)/) ||
    url.match(/[?&]v=([^&]+)/) ||
    url.match(/youtube\.com\/(?:live|embed|shorts)\/([^?&/]+)/);
  return m?.[1] ?? null;
}

export function StreamVideos({ videos, live }: { videos: StreamVideo[]; live?: boolean }) {
  if (!videos.length) return null;
  return (
    <Panel title={live ? 'Watch live' : 'Watch the stream'}>
      {videos.map((v, i) => {
        const id = youtubeId(v.url);
        return (
          <Pressable key={v.url} onPress={() => Linking.openURL(v.url)} style={[s.item, i > 0 && { borderTopWidth: 1, borderTopColor: C.line }]}>
            <View style={s.thumb}>
              {id ? <Image source={{ uri: `https://i.ytimg.com/vi/${id}/hqdefault.jpg` }} style={StyleSheet.absoluteFill} resizeMode="cover" /> : null}
              <View style={s.play}>
                <PlayIcon size={24} color={C.bar} />
              </View>
            </View>
            <Text style={[body(13, C.ink, 'semi'), { marginTop: 8 }]}>{v.title}</Text>
          </Pressable>
        );
      })}
    </Panel>
  );
}

const s = StyleSheet.create({
  item: { padding: 12 },
  thumb: { aspectRatio: 16 / 9, borderRadius: 8, backgroundColor: C.bar, overflow: 'hidden', alignItems: 'center', justifyContent: 'center' },
  play: { width: 56, height: 56, borderRadius: 28, backgroundColor: C.hl, alignItems: 'center', justifyContent: 'center', paddingLeft: 3 },
});
