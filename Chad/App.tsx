import React, { useEffect, useRef, useState } from 'react';
import {
  Alert,
  AppState,
  NativeScrollEvent,
  NativeSyntheticEvent,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  useWindowDimensions,
  View,
} from 'react-native';
import * as Notifications from 'expo-notifications';
import {
  ChadMessage,
  formatMessageTime,
  loadChadMessages,
  saveChadMessage,
  saveChadMessages,
} from './lib/chadMessages';
import { localDateKey } from './lib/dates';
import { levelProgress } from './lib/leveling';
import {
  ChadMessageKind,
  generateMessageByKind,
  generateTestMessage,
} from './lib/messageGenerator';
import {
  Mission,
  MissionBoard,
  MissionCategory,
  createMission,
  formatXpRange,
  loadMissionBoard,
  loadTotalXp,
  rollMissionXp,
  saveMissionBoard,
  saveTotalXp,
} from './lib/missions';
import { loadChadProfile, saveAntiVision, saveChadProfile, saveVision } from './lib/profile';
import { scheduleNext24Hours, scheduleSoonTestNotifications } from './lib/scheduleDailyChadMessages';
import { recordAppOpen, recordStreakActivity } from './lib/streak';
import { DayWins, emptyWins, loadTodayWins, saveTodayWins, winsHaveActivity } from './lib/wins';
import {
  ChunkButton,
  GroundDock,
  LevelUpModal,
  Parchment,
  SkyScreen,
  StreakPlaque,
  XpPanel,
  XpToast,
  colors,
  ui,
} from './components/ui';

const PREVIEW_KINDS: ChadMessageKind[] = [
  'affirmation',
  'accountability',
  'sideQuest',
  'affirmation',
  'accountability',
];

const PAGES = ['home', 'goals', 'messages', 'schedule'] as const;

const CATEGORY_TITLES: Record<MissionCategory, string> = {
  daily: 'Daily Missions',
  quarterly: 'Quarterly Missions',
  year: '1 Year Missions',
};

Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowBanner: true,
    shouldShowList: true,
    shouldPlaySound: true,
    shouldSetBadge: true,
  }),
});

type Step = 'anti' | 'vision' | 'main' | 'editAnti' | 'editVision' | 'viewVision' | 'viewAnti';
type EditTarget = 'antiVision' | 'vision';

const emptyBoard = (): MissionBoard => ({ daily: [], quarterly: [], year: [] });

export default function App() {
  const { width: pageWidth } = useWindowDimensions();
  const [step, setStep] = useState<Step>('anti');
  const [pageIndex, setPageIndex] = useState(0);
  const [antiInput, setAntiInput] = useState('');
  const [visionInput, setVisionInput] = useState('');
  const [antiStory, setAntiStory] = useState('');
  const [visionStory, setVisionStory] = useState('');
  const [antiList, setAntiList] = useState<string[]>([]);
  const [visionList, setVisionList] = useState<string[]>([]);
  const [editDraft, setEditDraft] = useState<string[]>([]);
  const [editStory, setEditStory] = useState('');
  const [editNewItem, setEditNewItem] = useState('');
  const [chadMessages, setChadMessages] = useState<ChadMessage[]>([]);
  const [missionBoard, setMissionBoard] = useState<MissionBoard>(emptyBoard);
  const [missionDrafts, setMissionDrafts] = useState<Record<MissionCategory, string>>({
    daily: '',
    quarterly: '',
    year: '',
  });
  const [totalXp, setTotalXp] = useState(0);
  const [streak, setStreak] = useState(0);
  const [wins, setWins] = useState<DayWins>(emptyWins);
  const [winsNote, setWinsNote] = useState('');
  const [xpToast, setXpToast] = useState<{ amount: number; token: number } | null>(null);
  const [levelUp, setLevelUp] = useState<number | null>(null);
  const didAutoSchedule = useRef(false);
  const completing = useRef(new Set<string>());
  const boardRef = useRef<MissionBoard>(emptyBoard());
  const xpRef = useRef(0);
  const winsDate = useRef(localDateKey());

  useEffect(() => {
    loadData();
  }, []);

  useEffect(() => {
    const sub = AppState.addEventListener('change', (next) => {
      if (next === 'active') {
        refreshIfNewDay();
      }
    });
    return () => sub.remove();
  }, []);

  useEffect(() => {
    if (step !== 'main') return;
    refreshChadMessages();
    const hasContent =
      antiList.length > 0 ||
      visionList.length > 0 ||
      antiStory.trim().length > 0 ||
      visionStory.trim().length > 0;
    if (!hasContent || didAutoSchedule.current) return;
    didAutoSchedule.current = true;
    scheduleNext24Hours().then(() => {
      refreshChadMessages();
    });
  }, [step, antiList.length, visionList.length, antiStory, visionStory]);

  const refreshChadMessages = async () => {
    const messages = await loadChadMessages();
    setChadMessages(messages.slice(0, 10));
  };

  const refreshIfNewDay = async () => {
    const today = localDateKey();
    const streakData = await recordAppOpen(today);
    setStreak(streakData.count);
    if (winsDate.current !== today) {
      winsDate.current = today;
      setWins(await loadTodayWins(today));
      setWinsNote('');
    }
  };

  const loadData = async () => {
    const today = localDateKey();
    const [profile, messages, board, xp, streakData, todayWins] = await Promise.all([
      loadChadProfile(),
      loadChadMessages(),
      loadMissionBoard(),
      loadTotalXp(),
      recordAppOpen(today),
      loadTodayWins(today),
    ]);
    winsDate.current = today;
    boardRef.current = board;
    xpRef.current = xp;
    setChadMessages(messages.slice(0, 10));
    setMissionBoard(board);
    setTotalXp(xp);
    setStreak(streakData.count);
    setWins(todayWins);
    setAntiList(profile.antiVision);
    setVisionList(profile.vision);
    setAntiStory(profile.antiStory);
    setVisionStory(profile.visionStory);
    if (profile.onboarded) setStep('main');
  };

  const saveAndContinue = async () => {
    const profile = {
      antiStory: antiStory.trim(),
      visionStory: visionStory.trim(),
      antiVision: antiList,
      vision: visionList,
    };
    await saveChadProfile(profile);
    setAntiStory(profile.antiStory);
    setVisionStory(profile.visionStory);
    setAntiList(profile.antiVision.map((item) => item.trim()).filter(Boolean));
    setVisionList(profile.vision.map((item) => item.trim()).filter(Boolean));
    setStep('main');
  };

  const openEdit = (target: EditTarget) => {
    setEditDraft(target === 'antiVision' ? [...antiList] : [...visionList]);
    setEditStory(target === 'antiVision' ? antiStory : visionStory);
    setEditNewItem('');
    setStep(target === 'antiVision' ? 'editAnti' : 'editVision');
  };

  const updateDraftItem = (index: number, value: string) => {
    setEditDraft((prev) => prev.map((item, i) => (i === index ? value : item)));
  };

  const removeDraftItem = (index: number) => {
    setEditDraft((prev) => prev.filter((_, i) => i !== index));
  };

  const addDraftItem = () => {
    const trimmed = editNewItem.trim();
    if (!trimmed) return;
    setEditDraft((prev) => [...prev, trimmed]);
    setEditNewItem('');
  };

  const saveEdit = async () => {
    const cleaned = editDraft.map((item) => item.trim()).filter(Boolean);
    const story = editStory.trim();
    if (step === 'editAnti') {
      await saveAntiVision(story, cleaned);
      setAntiList(cleaned);
      setAntiStory(story);
      setEditNewItem('');
      setStep('viewAnti');
      return;
    }
    await saveVision(story, cleaned);
    setVisionList(cleaned);
    setVisionStory(story);
    setEditNewItem('');
    setStep('viewVision');
  };

  const cancelEdit = () => {
    setEditNewItem('');
    setStep(step === 'editAnti' ? 'viewAnti' : 'viewVision');
  };

  const addMission = async (category: MissionCategory) => {
    const text = missionDrafts[category].trim();
    if (!text) return;
    const next: MissionBoard = {
      ...boardRef.current,
      [category]: [createMission(text), ...boardRef.current[category]],
    };
    boardRef.current = next;
    setMissionBoard(next);
    setMissionDrafts((prev) => ({ ...prev, [category]: '' }));
    await saveMissionBoard(next);
  };

  const completeMission = async (category: MissionCategory, missionId: string) => {
    if (completing.current.has(missionId)) return;
    const target = boardRef.current[category].find((mission) => mission.id === missionId);
    if (!target || target.completed) return;
    completing.current.add(missionId);

    const reward = rollMissionXp(category);
    const beforeLevel = levelProgress(xpRef.current).level;
    const nextXp = xpRef.current + reward;
    xpRef.current = nextXp;
    const nextBoard: MissionBoard = {
      ...boardRef.current,
      [category]: boardRef.current[category].map((mission) =>
        mission.id === missionId ? { ...mission, completed: true } : mission,
      ),
    };
    boardRef.current = nextBoard;
    setMissionBoard(nextBoard);
    setTotalXp(nextXp);

    try {
      await Promise.all([saveMissionBoard(nextBoard), saveTotalXp(nextXp)]);
      const nextStreak = await recordStreakActivity();
      setStreak(nextStreak.count);
      setXpToast({ amount: reward, token: Date.now() });
      const afterLevel = levelProgress(nextXp).level;
      if (afterLevel > beforeLevel) setLevelUp(afterLevel);
    } finally {
      completing.current.delete(missionId);
    }
  };

  const saveWins = async () => {
    const next: DayWins = {
      mental: wins.mental.trim(),
      physical: wins.physical.trim(),
      spiritual: wins.spiritual.trim(),
    };
    setWins(next);
    await saveTodayWins(next);
    if (winsHaveActivity(next)) {
      const nextStreak = await recordStreakActivity();
      setStreak(nextStreak.count);
      setWinsNote('Saved for today');
      return;
    }
    setWinsNote('Cleared for today');
  };

  const messageExtras = () => ({
    dailyMissions: boardRef.current.daily.filter((mission) => !mission.completed).map((mission) => mission.text),
    quarterlyMissions: boardRef.current.quarterly
      .filter((mission) => !mission.completed)
      .map((mission) => mission.text),
  });

  const sendRealTest = async () => {
    const { status } = await Notifications.requestPermissionsAsync();
    if (status !== 'granted') {
      Alert.alert('Chad', 'Permission not granted');
      return;
    }

    const profile = await loadChadProfile();
    const message = generateTestMessage(profile.vision, profile.antiVision, {
      ...messageExtras(),
      visionStory: profile.visionStory,
      antiVisionStory: profile.antiStory,
    });

    await Notifications.scheduleNotificationAsync({
      content: {
        title: 'Chad',
        body: message,
        sound: 'default',
      },
      trigger: null,
    });

    const updated = await saveChadMessage(message);
    setChadMessages(updated.slice(0, 10));
  };

  const onScheduleNext24Hours = async () => {
    try {
      const { scheduled } = await scheduleNext24Hours();
      await refreshChadMessages();
      if (!scheduled) {
        Alert.alert('Chad', 'Could not schedule. Check notification permission and saved lists.');
        return;
      }
      Alert.alert('Chad', 'Scheduled 6 messages from Chad over the next 24 hours');
    } catch {
      Alert.alert('Chad', 'Could not schedule. Check notification permission and saved lists.');
    }
  };

  const onTestScheduleSoon = async () => {
    try {
      const { scheduled, confirmed, exampleMessage } = await scheduleSoonTestNotifications();
      await refreshChadMessages();
      if (!scheduled) {
        Alert.alert('Chad', 'Could not schedule test notifications. Check permission and saved lists.');
        return;
      }
      Alert.alert(
        'Chad',
        `${confirmed || scheduled} test notifications scheduled\n\nExample: ${exampleMessage}`,
      );
    } catch {
      Alert.alert('Chad', 'Could not schedule test notifications. Check permission and saved lists.');
    }
  };

  const onGeneratePreview = async () => {
    try {
      const profile = await loadChadProfile();
      if (
        profile.vision.length === 0 &&
        profile.antiVision.length === 0 &&
        !profile.visionStory.trim() &&
        !profile.antiStory.trim()
      ) {
        Alert.alert('Chad', 'Add vision or anti-vision items first.');
        return;
      }

      const bodies = PREVIEW_KINDS.map((kind) =>
        generateMessageByKind(kind, profile.vision, profile.antiVision, {
          ...messageExtras(),
          visionStory: profile.visionStory,
          antiVisionStory: profile.antiStory,
        }),
      );
      const updated = await saveChadMessages(bodies);
      setChadMessages(updated.slice(0, 10));
      Alert.alert('Chad', `Preview ready\n\nExample: ${bodies[0]}`);
    } catch {
      Alert.alert('Chad', 'Could not generate preview messages.');
    }
  };

  const onPagerScroll = (event: NativeSyntheticEvent<NativeScrollEvent>) => {
    const index = Math.round(event.nativeEvent.contentOffset.x / pageWidth);
    if (index !== pageIndex && index >= 0 && index < PAGES.length) {
      setPageIndex(index);
    }
  };

  const addBullet = (which: 'anti' | 'vision') => {
    if (which === 'anti') {
      const trimmed = antiInput.trim();
      if (!trimmed) return;
      setAntiList((prev) => [...prev, trimmed]);
      setAntiInput('');
      return;
    }
    const trimmed = visionInput.trim();
    if (!trimmed) return;
    setVisionList((prev) => [...prev, trimmed]);
    setVisionInput('');
  };

  const renderMissionCard = (category: MissionCategory, mission: Mission) => (
    <Parchment key={mission.id} style={styles.missionCard}>
      <Text style={[styles.missionText, mission.completed && styles.missionTextDone]}>{mission.text}</Text>
      <Text style={styles.missionXp}>{mission.completed ? 'DONE' : formatXpRange(category)}</Text>
      {mission.completed ? null : (
        <ChunkButton
          label="COMPLETE"
          tone="gold"
          compact
          onPress={() => completeMission(category, mission.id)}
        />
      )}
    </Parchment>
  );

  const renderGoalsPage = () => (
    <ScrollView
      style={styles.page}
      contentContainerStyle={styles.pageScroll}
      keyboardShouldPersistTaps="handled"
      showsVerticalScrollIndicator={false}
      nestedScrollEnabled
    >
      <View style={styles.titleRow}>
        <Text style={[ui.pageTitle, styles.titleGrow]}>Goals</Text>
        <Text style={styles.miniStreak}>🔥 {streak}</Text>
      </View>
      <XpPanel totalXp={totalXp} />

      <Text style={[ui.label, styles.sectionGap]}>TODAY'S WINS</Text>
      <Parchment>
        <WinField
          label="Mental win"
          value={wins.mental}
          onChangeText={(mental) => {
            setWins((prev) => ({ ...prev, mental }));
            setWinsNote('');
          }}
        />
        <WinField
          label="Physical win"
          value={wins.physical}
          onChangeText={(physical) => {
            setWins((prev) => ({ ...prev, physical }));
            setWinsNote('');
          }}
        />
        <WinField
          label="Spiritual win"
          value={wins.spiritual}
          onChangeText={(spiritual) => {
            setWins((prev) => ({ ...prev, spiritual }));
            setWinsNote('');
          }}
        />
        <ChunkButton label="SAVE WINS" tone="gold" onPress={saveWins} />
        {winsNote ? <Text style={styles.savedNote}>{winsNote}</Text> : null}
      </Parchment>

      {(['daily', 'quarterly', 'year'] as MissionCategory[]).map((category) => (
        <View key={category} style={styles.missionSection}>
          <Text style={ui.label}>{CATEGORY_TITLES[category].toUpperCase()}</Text>
          {missionBoard[category].length === 0 ? (
            <Text style={ui.empty}>No missions yet. Add one below.</Text>
          ) : (
            missionBoard[category].map((mission) => renderMissionCard(category, mission))
          )}
          <View style={styles.addRow}>
            <TextInput
              style={[ui.input, styles.addInput]}
              placeholder="New mission"
              placeholderTextColor={colors.placeholder}
              value={missionDrafts[category]}
              onChangeText={(value) => setMissionDrafts((prev) => ({ ...prev, [category]: value }))}
              onSubmitEditing={() => addMission(category)}
              maxLength={160}
            />
            <ChunkButton label="ADD" compact onPress={() => addMission(category)} />
          </View>
        </View>
      ))}
    </ScrollView>
  );

  const renderMessagesPage = () => (
    <ScrollView
      style={styles.page}
      contentContainerStyle={styles.pageScroll}
      showsVerticalScrollIndicator={false}
      nestedScrollEnabled
    >
      <Text style={ui.pageTitle}>Messages</Text>
      {chadMessages.length === 0 ? (
        <Text style={ui.empty}>No messages yet. Schedule or preview from Schedule.</Text>
      ) : (
        chadMessages.map((message) => (
          <View key={`${message.timestamp}-${message.text}`} style={styles.bubble}>
            <Text style={styles.bubbleName}>CHAD</Text>
            <Text style={styles.bubbleText}>{message.text}</Text>
            <Text style={styles.bubbleTime}>{formatMessageTime(message.timestamp)}</Text>
          </View>
        ))
      )}
    </ScrollView>
  );

  const renderSchedulePage = () => (
    <ScrollView
      style={styles.page}
      contentContainerStyle={styles.pageScroll}
      showsVerticalScrollIndicator={false}
      nestedScrollEnabled
    >
      <Text style={ui.pageTitle}>Schedule</Text>
      <Text style={ui.heroSub}>Chad checks in across the next day.</Text>
      <ChunkButton label="SCHEDULE NEXT 24 HOURS" onPress={onScheduleNext24Hours} />
      <ChunkButton label="TEST SCHEDULE IN 30 SECONDS" tone="blue" onPress={onTestScheduleSoon} />
      <ChunkButton label="SEND TEST MESSAGE FROM CHAD" tone="wood" onPress={sendRealTest} />
      <ChunkButton label="GENERATE & PREVIEW MESSAGES" tone="gold" onPress={onGeneratePreview} />
    </ScrollView>
  );

  const renderHomePage = () => (
    <ScrollView
      style={styles.page}
      contentContainerStyle={styles.homeScroll}
      showsVerticalScrollIndicator={false}
      nestedScrollEnabled
    >
      <View>
        <Text style={styles.wordmark}>CHAD</Text>
        <Text style={styles.tagline}>Build the man. One day at a time.</Text>
        <StreakPlaque count={streak} prominent />
        <View style={styles.xpGap}>
          <XpPanel totalXp={totalXp} />
        </View>
      </View>
      <View style={styles.homeActions}>
        <ChunkButton label="VISION" onPress={() => setStep('viewVision')} />
        <ChunkButton label="ANTI-VISION" tone="wood" onPress={() => setStep('viewAnti')} />
        <Text style={ui.hint}>SWIPE  ·  GOALS  ·  MESSAGES  ·  SCHEDULE</Text>
      </View>
    </ScrollView>
  );

  if (step === 'anti' || step === 'vision') {
    const isAnti = step === 'anti';
    return (
      <SkyScreen scroll>
        <View style={ui.stepPill}>
          <Text style={ui.stepPillText}>{isAnti ? 'STEP 1 OF 2' : 'STEP 2 OF 2'}</Text>
        </View>
        <Text style={ui.heroTitle}>{isAnti ? 'Who are you refusing to become?' : 'Who are you becoming?'}</Text>
        <Text style={ui.heroSub}>
          {isAnti
            ? 'Write the man you will not be. Name the habits, the excuses, and the life you are done living.'
            : 'Write the man you are building. Then add a few goals you can actually do.'}
        </Text>
        <Parchment>
          <Text style={ui.label}>THE STORY</Text>
          <TextInput
            style={[ui.input, ui.story]}
            multiline
            placeholder={
              isAnti
                ? 'The life you refuse. The man you will not be…'
                : 'The life you are building, in your own words…'
            }
            placeholderTextColor={colors.placeholder}
            value={isAnti ? antiStory : visionStory}
            onChangeText={isAnti ? setAntiStory : setVisionStory}
            maxLength={2000}
          />
        </Parchment>
        <Text style={ui.label}>{isAnti ? 'SHORT BULLETS · OPTIONAL' : 'SHORT GOALS · OPTIONAL'}</Text>
        <PlainBullets
          items={isAnti ? antiList : visionList}
          onRemove={(index) =>
            isAnti
              ? setAntiList((prev) => prev.filter((_, i) => i !== index))
              : setVisionList((prev) => prev.filter((_, i) => i !== index))
          }
        />
        <View style={styles.addRow}>
          <TextInput
            style={[ui.input, styles.addInput]}
            placeholder={isAnti ? 'A line you refuse' : 'A goal you can act on'}
            placeholderTextColor={colors.placeholder}
            value={isAnti ? antiInput : visionInput}
            onChangeText={isAnti ? setAntiInput : setVisionInput}
            onSubmitEditing={() => addBullet(isAnti ? 'anti' : 'vision')}
            maxLength={140}
          />
          <ChunkButton label="ADD" compact onPress={() => addBullet(isAnti ? 'anti' : 'vision')} />
        </View>
        {isAnti ? (
          <ChunkButton label="NEXT" tone="blue" onPress={() => setStep('vision')} />
        ) : (
          <ChunkButton label="FINISH & SAVE" tone="gold" onPress={saveAndContinue} />
        )}
      </SkyScreen>
    );
  }

  if (step === 'editAnti' || step === 'editVision') {
    const isAnti = step === 'editAnti';
    return (
      <SkyScreen scroll>
        <Text style={ui.heroTitle}>{isAnti ? 'Edit anti-vision' : 'Edit vision'}</Text>
        <Text style={ui.heroSub}>
          {isAnti
            ? 'Update the story and the short lines you are refusing.'
            : 'Update the story and the goals you are chasing.'}
        </Text>
        <Parchment>
          <Text style={ui.label}>THE STORY</Text>
          <TextInput
            style={[ui.input, ui.story]}
            multiline
            placeholder={isAnti ? 'Who you refuse to become…' : 'Who you are becoming…'}
            placeholderTextColor={colors.placeholder}
            value={editStory}
            onChangeText={setEditStory}
            maxLength={2000}
          />
        </Parchment>
        <Text style={ui.label}>{isAnti ? 'BULLETS' : 'GOALS'}</Text>
        {editDraft.map((item, index) => (
          <View key={`edit-${index}`} style={styles.editRow}>
            <TextInput
              style={[ui.input, styles.editInput]}
              value={item}
              onChangeText={(value) => updateDraftItem(index, value)}
              placeholderTextColor={colors.placeholder}
              maxLength={140}
            />
            <ChunkButton label="REMOVE" tone="red" compact onPress={() => removeDraftItem(index)} />
          </View>
        ))}
        <View style={styles.addRow}>
          <TextInput
            style={[ui.input, styles.addInput]}
            placeholder="Add a new line"
            placeholderTextColor={colors.placeholder}
            value={editNewItem}
            onChangeText={setEditNewItem}
            onSubmitEditing={addDraftItem}
            maxLength={140}
          />
          <ChunkButton label="ADD" compact onPress={addDraftItem} />
        </View>
        <ChunkButton label="CANCEL" tone="wood" onPress={cancelEdit} />
        <ChunkButton label="SAVE" tone="gold" onPress={saveEdit} />
      </SkyScreen>
    );
  }

  if (step === 'viewVision' || step === 'viewAnti') {
    const isAnti = step === 'viewAnti';
    const story = isAnti ? antiStory : visionStory;
    const items = isAnti ? antiList : visionList;
    return (
      <SkyScreen scroll>
        <ChunkButton label="BACK" tone="wood" compact onPress={() => setStep('main')} style={styles.backButton} />
        <View style={styles.titleRow}>
          <Text style={[ui.pageTitle, styles.titleGrow]}>{isAnti ? 'Anti-vision' : 'Vision'}</Text>
          <ChunkButton
            label="EDIT"
            tone="blue"
            compact
            onPress={() => openEdit(isAnti ? 'antiVision' : 'vision')}
          />
        </View>
        {story.trim() ? (
          <Parchment>
            <Text style={styles.storyBody}>{story}</Text>
          </Parchment>
        ) : null}
        <Text style={ui.label}>{isAnti ? 'BULLETS' : 'GOALS'}</Text>
        {items.length === 0 ? (
          <Text style={ui.empty}>{isAnti ? 'No bullets yet.' : 'No goals yet.'}</Text>
        ) : (
          items.map((item, index) => (
            <Parchment key={`${item}-${index}`} style={styles.listCard}>
              <Text style={styles.listText}>▸ {item}</Text>
            </Parchment>
          ))
        )}
      </SkyScreen>
    );
  }

  return (
    <View style={styles.root}>
      <SkyScreen
        footer={
          <GroundDock>
            {PAGES.map((page, index) => (
              <View key={page} style={[styles.dot, index === pageIndex && styles.dotActive]} />
            ))}
          </GroundDock>
        }
      >
        <ScrollView
          horizontal
          pagingEnabled
          showsHorizontalScrollIndicator={false}
          onMomentumScrollEnd={onPagerScroll}
          onScroll={onPagerScroll}
          scrollEventThrottle={16}
          style={styles.pager}
        >
          <View style={[styles.pageSlide, { width: pageWidth }]}>{renderHomePage()}</View>
          <View style={[styles.pageSlide, { width: pageWidth }]}>{renderGoalsPage()}</View>
          <View style={[styles.pageSlide, { width: pageWidth }]}>{renderMessagesPage()}</View>
          <View style={[styles.pageSlide, { width: pageWidth }]}>{renderSchedulePage()}</View>
        </ScrollView>
      </SkyScreen>
      <XpToast event={xpToast} />
      <LevelUpModal level={levelUp} onClose={() => setLevelUp(null)} />
    </View>
  );
}

function WinField({
  label,
  value,
  onChangeText,
}: {
  label: string;
  value: string;
  onChangeText: (value: string) => void;
}) {
  return (
    <View style={styles.winField}>
      <Text style={styles.winLabel}>{label}</Text>
      <TextInput
        style={ui.input}
        placeholder={label}
        placeholderTextColor={colors.placeholder}
        value={value}
        onChangeText={onChangeText}
        maxLength={120}
      />
    </View>
  );
}

function PlainBullets({ items, onRemove }: { items: string[]; onRemove: (index: number) => void }) {
  if (items.length === 0) return null;
  return (
    <View style={styles.bulletList}>
      {items.map((item, index) => (
        <View key={`${item}-${index}`} style={styles.bulletRow}>
          <Text style={styles.bulletText}>{item}</Text>
          <ChunkButton label="REMOVE" tone="red" compact onPress={() => onRemove(index)} />
        </View>
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.skyTop },
  pager: { flex: 1 },
  pageSlide: { height: '100%' },
  page: { flex: 1 },
  pageScroll: {
    paddingHorizontal: 20,
    paddingTop: 58,
    paddingBottom: 28,
  },
  homeScroll: {
    flexGrow: 1,
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    paddingTop: 58,
    paddingBottom: 16,
  },
  homeActions: { marginTop: 18 },
  wordmark: {
    color: colors.ink,
    fontSize: 42,
    fontWeight: '900',
    letterSpacing: 2,
  },
  tagline: {
    color: colors.inkSoft,
    fontSize: 15,
    fontWeight: '700',
    marginBottom: 12,
  },
  xpGap: { marginTop: 12 },
  titleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 8,
  },
  titleGrow: { flex: 1, marginBottom: 0 },
  miniStreak: {
    color: colors.ink,
    fontSize: 20,
    fontWeight: '900',
    marginLeft: 8,
  },
  sectionGap: { marginTop: 16 },
  winField: { marginBottom: 10 },
  winLabel: {
    color: colors.inkSoft,
    fontSize: 13,
    fontWeight: '800',
    marginBottom: 6,
  },
  savedNote: {
    color: colors.grassDark,
    fontSize: 13,
    fontWeight: '800',
    textAlign: 'center',
  },
  missionSection: { marginBottom: 8 },
  missionCard: { marginBottom: 10 },
  missionText: {
    color: colors.ink,
    fontSize: 16,
    lineHeight: 22,
    fontWeight: '700',
  },
  missionTextDone: {
    textDecorationLine: 'line-through',
    color: colors.grassDark,
  },
  missionXp: {
    marginTop: 6,
    marginBottom: 8,
    color: colors.goldDark,
    fontSize: 12,
    fontWeight: '900',
    letterSpacing: 0.4,
  },
  addRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 14,
  },
  addInput: { flex: 1, marginRight: 8 },
  editRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 10,
  },
  editInput: { flex: 1, marginRight: 8 },
  bulletList: { marginBottom: 8 },
  bulletRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 8,
  },
  bulletText: {
    flex: 1,
    color: colors.ink,
    fontSize: 15,
    fontWeight: '700',
    marginRight: 8,
  },
  backButton: { marginBottom: 12 },
  storyBody: {
    color: colors.ink,
    fontSize: 17,
    lineHeight: 24,
    fontWeight: '600',
  },
  listCard: { marginBottom: 8 },
  listText: {
    color: colors.ink,
    fontSize: 16,
    lineHeight: 22,
    fontWeight: '700',
  },
  bubble: {
    alignSelf: 'flex-start',
    maxWidth: '88%',
    backgroundColor: colors.parchment,
    borderRadius: 18,
    borderTopLeftRadius: 6,
    borderWidth: 3,
    borderColor: colors.line,
    paddingVertical: 10,
    paddingHorizontal: 12,
    marginBottom: 10,
  },
  bubbleName: {
    color: colors.grassDark,
    fontSize: 11,
    fontWeight: '900',
    letterSpacing: 1,
    marginBottom: 4,
  },
  bubbleText: {
    color: colors.ink,
    fontSize: 15,
    lineHeight: 21,
    fontWeight: '600',
  },
  bubbleTime: {
    color: colors.inkSoft,
    fontSize: 11,
    fontWeight: '700',
    marginTop: 6,
  },
  dot: {
    width: 10,
    height: 10,
    borderRadius: 5,
    backgroundColor: 'rgba(255, 246, 228, 0.45)',
    borderWidth: 2,
    borderColor: colors.line,
  },
  dotActive: {
    width: 12,
    height: 12,
    borderRadius: 6,
    backgroundColor: colors.gold,
  },
});
