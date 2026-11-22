import React, { useEffect, useRef, useState } from 'react';
import {
  Animated,
  KeyboardAvoidingView,
  Modal,
  Platform,
  Pressable,
  ScrollView,
  StyleProp,
  StyleSheet,
  Text,
  View,
  ViewStyle,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { StatusBar } from 'expo-status-bar';
import { levelProgress } from '../lib/leveling';

export const colors = {
  ink: '#2C2118',
  inkSoft: '#5E4936',
  cream: '#FFF6E4',
  parchment: '#FFF9EE',
  line: '#2C2118',
  skyTop: '#5BA8DC',
  skyMid: '#9FD4F2',
  skyBottom: '#D7F3B4',
  grass: '#4E9A3A',
  grassDark: '#2F6E28',
  dirt: '#8B5A34',
  gold: '#F0C14A',
  goldDark: '#C4922A',
  green: '#3E9E46',
  blue: '#2F89C8',
  wood: '#C4844A',
  red: '#D4543C',
  white: '#FFFFFF',
  placeholder: '#8C7158',
  track: '#E7D3A8',
};

type Tone = 'green' | 'blue' | 'gold' | 'wood' | 'red';

const TONES: Record<Tone, { face: string; text: string }> = {
  green: { face: colors.green, text: colors.white },
  blue: { face: colors.blue, text: colors.white },
  gold: { face: colors.gold, text: colors.ink },
  wood: { face: colors.wood, text: colors.ink },
  red: { face: colors.red, text: colors.white },
};

function Cloud({ style }: { style?: StyleProp<ViewStyle> }) {
  return (
    <View style={[styles.cloud, style]}>
      <View style={[styles.puff, styles.puffSmall]} />
      <View style={[styles.puff, styles.puffLarge]} />
      <View style={[styles.puff, styles.puffMedium]} />
    </View>
  );
}

export function SkyScreen({
  children,
  scroll = false,
  footer,
}: {
  children: React.ReactNode;
  scroll?: boolean;
  footer?: React.ReactNode;
}) {
  const body = scroll ? (
    <KeyboardAvoidingView
      style={styles.flex}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
    >
      <ScrollView
        contentContainerStyle={styles.scrollContent}
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}
      >
        {children}
      </ScrollView>
    </KeyboardAvoidingView>
  ) : (
    <View style={styles.flex}>{children}</View>
  );

  return (
    <LinearGradient
      colors={[colors.skyTop, colors.skyMid, colors.skyBottom]}
      locations={[0, 0.42, 1]}
      style={styles.sky}
    >
      <StatusBar style="dark" />
      <View pointerEvents="none" style={StyleSheet.absoluteFill}>
        <View style={styles.sun}>
          <View style={styles.sunCore} />
        </View>
        <Cloud style={styles.cloudOne} />
        <Cloud style={styles.cloudTwo} />
        <View style={styles.hill} />
      </View>
      {body}
      {footer}
    </LinearGradient>
  );
}

export function ChunkButton({
  label,
  onPress,
  tone = 'green',
  compact = false,
  style,
}: {
  label: string;
  onPress: () => void;
  tone?: Tone;
  compact?: boolean;
  style?: StyleProp<ViewStyle>;
}) {
  const [pressed, setPressed] = useState(false);
  const palette = TONES[tone];

  return (
    <Pressable
      accessibilityRole="button"
      onPress={onPress}
      onPressIn={() => setPressed(true)}
      onPressOut={() => setPressed(false)}
      style={[styles.chunkWrap, compact && styles.chunkCompact, style]}
    >
      <View
        style={[
          styles.chunkFace,
          compact && styles.chunkFaceCompact,
          { backgroundColor: palette.face },
          pressed && styles.chunkFacePressed,
        ]}
      >
        <Text
          style={[styles.chunkText, compact && styles.chunkTextCompact, { color: palette.text }]}
          numberOfLines={2}
          adjustsFontSizeToFit
          minimumFontScale={0.72}
        >
          {label}
        </Text>
      </View>
    </Pressable>
  );
}

export function Parchment({
  children,
  style,
}: {
  children: React.ReactNode;
  style?: StyleProp<ViewStyle>;
}) {
  return <View style={[styles.parchment, style]}>{children}</View>;
}

export function StreakPlaque({ count, prominent = false }: { count: number; prominent?: boolean }) {
  return (
    <View style={[styles.plaque, prominent && styles.plaqueProminent, count === 0 && styles.plaqueQuiet]}>
      <Text style={[styles.flame, prominent && styles.flameProminent]}>🔥</Text>
      <Text style={[styles.streakCount, prominent && styles.streakCountProminent]}>{count}</Text>
      <Text style={styles.streakLabel}>DAY STREAK</Text>
      <Text style={styles.streakHint}>
        {count > 0 ? 'Open the app and log a win to keep it.' : 'Finish a mission or save a win.'}
      </Text>
    </View>
  );
}

export function XpPanel({ totalXp }: { totalXp: number }) {
  const progress = levelProgress(totalXp);
  const pct = progress.progress <= 0 ? 0 : Math.max(8, Math.round(progress.progress * 100));

  return (
    <Parchment style={styles.xpCard}>
      <View style={styles.xpHeader}>
        <Text style={styles.xpLevel}>LEVEL {progress.level}</Text>
        <Text style={styles.xpTotal}>{progress.totalXp} XP</Text>
      </View>
      <View style={styles.track}>
        <View style={[styles.fill, { width: `${pct}%` as `${number}%` }]} />
      </View>
      <Text style={styles.xpMeta}>
        {progress.xpIntoLevel} / {progress.xpForNext} XP to level {progress.level + 1}
      </Text>
    </Parchment>
  );
}

export function LevelUpModal({ level, onClose }: { level: number | null; onClose: () => void }) {
  const scale = useRef(new Animated.Value(0.45)).current;
  const opacity = useRef(new Animated.Value(0)).current;
  const pulse = useRef(new Animated.Value(1)).current;

  useEffect(() => {
    if (level == null) return;
    scale.setValue(0.45);
    opacity.setValue(0);
    pulse.setValue(1);

    const entrance = Animated.parallel([
      Animated.spring(scale, { toValue: 1, friction: 5, tension: 90, useNativeDriver: true }),
      Animated.timing(opacity, { toValue: 1, duration: 180, useNativeDriver: true }),
    ]);
    const loop = Animated.loop(
      Animated.sequence([
        Animated.timing(pulse, { toValue: 1.08, duration: 420, useNativeDriver: true }),
        Animated.timing(pulse, { toValue: 1, duration: 420, useNativeDriver: true }),
      ]),
    );
    let alive = true;
    entrance.start(() => {
      if (alive) loop.start();
    });
    return () => {
      alive = false;
      entrance.stop();
      loop.stop();
    };
  }, [level, scale, opacity, pulse]);

  return (
    <Modal visible={level != null} transparent animationType="none" onRequestClose={onClose}>
      <Animated.View style={[styles.backdrop, { opacity }]}>
        <Pressable style={styles.backdropTap} onPress={onClose} />
        <Animated.View style={[styles.levelCard, { transform: [{ scale }] }]}>
          <Text style={styles.levelStars}>★  ★  ★</Text>
          <Text style={styles.levelKicker}>LEVEL UP</Text>
          <Animated.Text style={[styles.levelNumber, { transform: [{ scale: pulse }] }]}>
            {level ?? ''}
          </Animated.Text>
          <Text style={styles.levelBody}>You hit level {level}. Keep building.</Text>
          <ChunkButton label="KEEP GOING" onPress={onClose} tone="gold" />
        </Animated.View>
      </Animated.View>
    </Modal>
  );
}

export function XpToast({ event }: { event: { amount: number; token: number } | null }) {
  const [amount, setAmount] = useState<number | null>(null);
  const translate = useRef(new Animated.Value(-140)).current;

  useEffect(() => {
    if (!event) return;
    setAmount(event.amount);
    translate.setValue(-140);
    const anim = Animated.sequence([
      Animated.spring(translate, { toValue: 0, friction: 7, tension: 80, useNativeDriver: true }),
      Animated.delay(1100),
      Animated.timing(translate, { toValue: -150, duration: 220, useNativeDriver: true }),
    ]);
    anim.start(({ finished }) => {
      if (finished) setAmount(null);
    });
    return () => anim.stop();
  }, [event, translate]);

  if (amount == null) return null;

  return (
    <Animated.View pointerEvents="none" style={[styles.toast, { transform: [{ translateY: translate }] }]}>
      <Text style={styles.toastText}>+{amount} XP</Text>
    </Animated.View>
  );
}

export function GroundDock({ children }: { children: React.ReactNode }) {
  return (
    <View style={styles.dock}>
      <View style={styles.dockGrass} />
      <View style={styles.dockDirt}>{children}</View>
    </View>
  );
}

export const ui = StyleSheet.create({
  input: {
    backgroundColor: colors.cream,
    borderWidth: 3,
    borderColor: colors.line,
    borderRadius: 16,
    paddingHorizontal: 14,
    paddingVertical: 12,
    color: colors.ink,
    fontSize: 16,
    fontWeight: '600',
  },
  story: {
    minHeight: 150,
    textAlignVertical: 'top',
    lineHeight: 22,
  },
  label: {
    color: colors.ink,
    fontSize: 13,
    fontWeight: '900',
    letterSpacing: 0.8,
    marginBottom: 8,
  },
  heroTitle: {
    color: colors.ink,
    fontSize: 32,
    lineHeight: 36,
    fontWeight: '900',
    marginBottom: 8,
  },
  heroSub: {
    color: colors.inkSoft,
    fontSize: 16,
    lineHeight: 22,
    fontWeight: '600',
    marginBottom: 16,
  },
  stepPill: {
    alignSelf: 'flex-start',
    backgroundColor: colors.gold,
    borderWidth: 3,
    borderColor: colors.line,
    borderRadius: 999,
    paddingHorizontal: 12,
    paddingVertical: 4,
    marginBottom: 12,
  },
  stepPillText: {
    color: colors.ink,
    fontSize: 12,
    fontWeight: '900',
    letterSpacing: 0.8,
  },
  pageTitle: {
    color: colors.ink,
    fontSize: 32,
    fontWeight: '900',
    marginBottom: 12,
  },
  hint: {
    color: colors.inkSoft,
    fontSize: 13,
    fontWeight: '700',
    textAlign: 'center',
    marginTop: 4,
  },
  empty: {
    color: colors.inkSoft,
    fontSize: 15,
    fontWeight: '600',
    marginBottom: 10,
  },
});

const styles = StyleSheet.create({
  flex: { flex: 1 },
  sky: { flex: 1 },
  scrollContent: {
    flexGrow: 1,
    paddingHorizontal: 20,
    paddingTop: 58,
    paddingBottom: 36,
  },
  sun: {
    position: 'absolute',
    top: 8,
    right: 16,
    width: 54,
    height: 54,
    borderRadius: 27,
    backgroundColor: '#E6A23C',
    alignItems: 'center',
    justifyContent: 'center',
  },
  sunCore: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: '#FFE08A',
  },
  cloud: {
    position: 'absolute',
    flexDirection: 'row',
    alignItems: 'flex-end',
  },
  cloudOne: { top: 6, left: 12 },
  cloudTwo: { top: 18, right: 78 },
  puff: {
    backgroundColor: colors.white,
    borderWidth: 3,
    borderColor: colors.line,
  },
  puffSmall: {
    width: 28,
    height: 28,
    borderRadius: 14,
    marginRight: -8,
  },
  puffLarge: {
    width: 46,
    height: 36,
    borderRadius: 18,
    marginBottom: 2,
  },
  puffMedium: {
    width: 32,
    height: 30,
    borderRadius: 16,
    marginLeft: -10,
  },
  hill: {
    position: 'absolute',
    left: -40,
    right: -40,
    bottom: 46,
    height: 54,
    backgroundColor: colors.grass,
    borderTopWidth: 4,
    borderColor: colors.grassDark,
    borderTopLeftRadius: 70,
    borderTopRightRadius: 70,
  },
  chunkWrap: { marginBottom: 12, width: '100%' },
  chunkCompact: { width: 'auto', alignSelf: 'flex-start', marginBottom: 0 },
  chunkFace: {
    borderWidth: 3,
    borderColor: colors.line,
    borderBottomWidth: 7,
    borderRadius: 18,
    minHeight: 54,
    paddingHorizontal: 16,
    paddingVertical: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
  chunkFaceCompact: {
    minHeight: 48,
    paddingHorizontal: 14,
    borderRadius: 14,
  },
  chunkFacePressed: {
    borderBottomWidth: 3,
    transform: [{ translateY: 4 }],
  },
  chunkText: {
    fontSize: 15,
    fontWeight: '900',
    letterSpacing: 0.6,
    textAlign: 'center',
  },
  chunkTextCompact: { fontSize: 13 },
  parchment: {
    backgroundColor: colors.parchment,
    borderRadius: 20,
    borderWidth: 3,
    borderColor: colors.line,
    padding: 14,
    marginBottom: 14,
    shadowColor: colors.line,
    shadowOffset: { width: 3, height: 4 },
    shadowOpacity: 1,
    shadowRadius: 0,
    elevation: 3,
  },
  plaque: {
    backgroundColor: colors.cream,
    borderWidth: 3,
    borderColor: colors.line,
    borderBottomWidth: 8,
    borderRadius: 28,
    alignItems: 'center',
    paddingVertical: 14,
    paddingHorizontal: 18,
    marginBottom: 14,
  },
  plaqueProminent: { paddingVertical: 18 },
  plaqueQuiet: { opacity: 0.92 },
  flame: { fontSize: 28 },
  flameProminent: { fontSize: 42 },
  streakCount: {
    color: colors.ink,
    fontSize: 42,
    fontWeight: '900',
    lineHeight: 46,
  },
  streakCountProminent: { fontSize: 64, lineHeight: 68 },
  streakLabel: {
    color: colors.ink,
    fontSize: 13,
    fontWeight: '900',
    letterSpacing: 1.4,
  },
  streakHint: {
    color: colors.inkSoft,
    fontSize: 12,
    fontWeight: '700',
    textAlign: 'center',
    marginTop: 4,
  },
  xpCard: { marginBottom: 0 },
  xpHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
  },
  xpLevel: { color: colors.ink, fontSize: 16, fontWeight: '900', letterSpacing: 0.6 },
  xpTotal: { color: colors.goldDark, fontSize: 14, fontWeight: '900' },
  track: {
    height: 18,
    borderRadius: 9,
    backgroundColor: colors.track,
    borderWidth: 2,
    borderColor: colors.line,
    overflow: 'hidden',
  },
  fill: {
    height: '100%',
    backgroundColor: colors.gold,
    borderRightWidth: 2,
    borderRightColor: colors.goldDark,
  },
  xpMeta: {
    marginTop: 8,
    color: colors.inkSoft,
    fontSize: 12,
    fontWeight: '700',
  },
  backdrop: {
    flex: 1,
    backgroundColor: 'rgba(44, 33, 24, 0.55)',
    alignItems: 'center',
    justifyContent: 'center',
    padding: 24,
  },
  backdropTap: {
    position: 'absolute',
    top: 0,
    right: 0,
    bottom: 0,
    left: 0,
  },
  levelCard: {
    width: '100%',
    maxWidth: 340,
    backgroundColor: colors.cream,
    borderRadius: 28,
    borderWidth: 4,
    borderColor: colors.line,
    padding: 22,
    alignItems: 'center',
  },
  levelStars: {
    color: colors.goldDark,
    fontSize: 18,
    fontWeight: '900',
    letterSpacing: 4,
    marginBottom: 4,
  },
  levelKicker: {
    color: colors.ink,
    fontSize: 14,
    fontWeight: '900',
    letterSpacing: 2,
  },
  levelNumber: {
    color: colors.ink,
    fontSize: 84,
    fontWeight: '900',
    lineHeight: 92,
  },
  levelBody: {
    color: colors.inkSoft,
    fontSize: 16,
    fontWeight: '700',
    textAlign: 'center',
    marginBottom: 16,
  },
  toast: {
    position: 'absolute',
    top: 54,
    alignSelf: 'center',
    backgroundColor: colors.gold,
    borderWidth: 3,
    borderColor: colors.line,
    borderBottomWidth: 6,
    borderRadius: 16,
    paddingHorizontal: 18,
    paddingVertical: 10,
    zIndex: 20,
  },
  toastText: {
    color: colors.ink,
    fontSize: 22,
    fontWeight: '900',
  },
  dock: {},
  dockGrass: {
    height: 10,
    backgroundColor: colors.grass,
    borderTopWidth: 3,
    borderTopColor: colors.grassDark,
  },
  dockDirt: {
    backgroundColor: colors.dirt,
    paddingTop: 10,
    paddingBottom: 22,
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    gap: 8,
  },
});
