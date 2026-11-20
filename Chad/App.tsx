import React, { useState, useEffect, useRef } from 'react';
import {
  View,
  Text,
  TextInput,
  Button,
  FlatList,
  StyleSheet,
  Pressable,
  ScrollView,
  ImageBackground,
  Dimensions,
  NativeSyntheticEvent,
  NativeScrollEvent,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import AsyncStorage from '@react-native-async-storage/async-storage';
import * as Notifications from 'expo-notifications';
import {
  ChadMessage,
  formatMessageTime,
  loadChadMessages,
  saveChadMessage,
  saveChadMessages,
} from './lib/chadMessages';
import {
  ChadMessageKind,
  generateMessageByKind,
  generateTestMessage,
} from './lib/messageGenerator';
import {
  scheduleNext24Hours,
  scheduleSoonTestNotifications,
} from './lib/scheduleDailyChadMessages';
import {
  CATEGORY_LABELS,
  Mission,
  MissionBoard,
  MissionCategory,
  XP_REWARDS,
  createMission,
  loadMissionBoard,
  loadTotalXp,
  saveMissionBoard,
  saveTotalXp,
} from './lib/missions';

const PREVIEW_KINDS: ChadMessageKind[] = [
  'affirmation',
  'accountability',
  'sideQuest',
  'affirmation',
  'accountability',
];

const PAGE_WIDTH = Dimensions.get('window').width;
const PAGES = ['home', 'goals', 'messages', 'schedule'] as const;

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

export default function App() {
  const [step, setStep] = useState<Step>('anti');
  const [pageIndex, setPageIndex] = useState(0);
  const [antiInput, setAntiInput] = useState('');
  const [visionInput, setVisionInput] = useState('');
  const [antiList, setAntiList] = useState<string[]>([]);
  const [visionList, setVisionList] = useState<string[]>([]);
  const [editDraft, setEditDraft] = useState<string[]>([]);
  const [editNewItem, setEditNewItem] = useState('');
  const [chadMessages, setChadMessages] = useState<ChadMessage[]>([]);
  const [missionBoard, setMissionBoard] = useState<MissionBoard>({
    daily: [],
    quarterly: [],
    year: [],
  });
  const [missionDrafts, setMissionDrafts] = useState<Record<MissionCategory, string>>({
    daily: '',
    quarterly: '',
    year: '',
  });
  const [totalXp, setTotalXp] = useState(0);
  const didAutoSchedule = useRef(false);

  useEffect(() => {
    loadData();
  }, []);

  useEffect(() => {
    if (step !== 'main') return;
    refreshChadMessages();
    if (antiList.length === 0 && visionList.length === 0) return;
    if (didAutoSchedule.current) return;
    didAutoSchedule.current = true;
    scheduleNext24Hours().then(() => {
      refreshChadMessages();
    });
  }, [step, antiList.length, visionList.length]);

  const refreshChadMessages = async () => {
    const messages = await loadChadMessages();
    setChadMessages(messages.slice(0, 10));
  };

  const loadData = async () => {
    const anti = await AsyncStorage.getItem('antiVision');
    const vision = await AsyncStorage.getItem('vision');
    const [messages, board, xp] = await Promise.all([
      loadChadMessages(),
      loadMissionBoard(),
      loadTotalXp(),
    ]);
    setChadMessages(messages.slice(0, 10));
    setMissionBoard(board);
    setTotalXp(xp);
    if (anti && vision) {
      setAntiList(JSON.parse(anti));
      setVisionList(JSON.parse(vision));
      setStep('main');
    }
  };

  const saveAndContinue = async () => {
    await AsyncStorage.setItem('antiVision', JSON.stringify(antiList));
    await AsyncStorage.setItem('vision', JSON.stringify(visionList));
    setStep('main');
  };

  const openEdit = (target: EditTarget) => {
    setEditDraft(target === 'antiVision' ? [...antiList] : [...visionList]);
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
    const storageKey = step === 'editAnti' ? 'antiVision' : 'vision';
    await AsyncStorage.setItem(storageKey, JSON.stringify(cleaned));

    if (storageKey === 'antiVision') {
      setAntiList(cleaned);
      setEditNewItem('');
      setStep('viewAnti');
      return;
    }

    setVisionList(cleaned);
    setEditNewItem('');
    setStep('viewVision');
  };

  const cancelEdit = () => {
    setEditNewItem('');
    setStep(step === 'editAnti' ? 'viewAnti' : 'viewVision');
  };

  const persistBoard = async (next: MissionBoard) => {
    setMissionBoard(next);
    await saveMissionBoard(next);
  };

  const addMission = async (category: MissionCategory) => {
    const text = missionDrafts[category].trim();
    if (!text) return;
    const next: MissionBoard = {
      ...missionBoard,
      [category]: [createMission(text), ...missionBoard[category]],
    };
    setMissionDrafts((prev) => ({ ...prev, [category]: '' }));
    await persistBoard(next);
  };

  const completeMission = async (category: MissionCategory, missionId: string) => {
    const target = missionBoard[category].find((mission) => mission.id === missionId);
    if (!target || target.completed) return;

    const reward = XP_REWARDS[category];
    const nextBoard: MissionBoard = {
      ...missionBoard,
      [category]: missionBoard[category].map((mission) =>
        mission.id === missionId ? { ...mission, completed: true } : mission,
      ),
    };
    const nextXp = totalXp + reward;
    setTotalXp(nextXp);
    await Promise.all([persistBoard(nextBoard), saveTotalXp(nextXp)]);
    alert(`+${reward} XP`);
  };

  const sendRealTest = async () => {
    const { status } = await Notifications.requestPermissionsAsync();
    if (status !== 'granted') {
      alert('Permission not granted');
      return;
    }

    const visionRaw = await AsyncStorage.getItem('vision');
    const antiRaw = await AsyncStorage.getItem('antiVision');
    const vision: string[] = visionRaw ? JSON.parse(visionRaw) : [];
    const antiVision: string[] = antiRaw ? JSON.parse(antiRaw) : [];
    const message = generateTestMessage(vision, antiVision);

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
        alert('Could not schedule. Check notification permission and saved lists.');
        return;
      }
      alert('Scheduled 6 messages from Chad over the next 24 hours');
    } catch {
      alert('Could not schedule. Check notification permission and saved lists.');
    }
  };

  const onTestScheduleSoon = async () => {
    try {
      const { scheduled, confirmed, exampleMessage } = await scheduleSoonTestNotifications();
      await refreshChadMessages();
      if (!scheduled) {
        alert('Could not schedule test notifications. Check permission and saved lists.');
        return;
      }
      alert(
        `${confirmed || scheduled} test notifications scheduled\n\nExample: ${exampleMessage}`,
      );
    } catch {
      alert('Could not schedule test notifications. Check permission and saved lists.');
    }
  };

  const onGeneratePreview = async () => {
    try {
      const visionRaw = await AsyncStorage.getItem('vision');
      const antiRaw = await AsyncStorage.getItem('antiVision');
      const vision: string[] = visionRaw ? JSON.parse(visionRaw) : [];
      const antiVision: string[] = antiRaw ? JSON.parse(antiRaw) : [];

      if (vision.length === 0 && antiVision.length === 0) {
        alert('Add vision or anti-vision items first.');
        return;
      }

      const bodies = PREVIEW_KINDS.map((kind) =>
        generateMessageByKind(kind, vision, antiVision),
      );
      const updated = await saveChadMessages(bodies);
      setChadMessages(updated.slice(0, 10));
      alert(`Preview ready\n\nExample: ${bodies[0]}`);
    } catch {
      alert('Could not generate preview messages.');
    }
  };

  const onPagerScroll = (event: NativeSyntheticEvent<NativeScrollEvent>) => {
    const index = Math.round(event.nativeEvent.contentOffset.x / PAGE_WIDTH);
    if (index !== pageIndex && index >= 0 && index < PAGES.length) {
      setPageIndex(index);
    }
  };

  const renderCinematicShell = (content: React.ReactNode) => (
    <ImageBackground
      source={require('./assets/home-cinematic-bg.jpg')}
      style={styles.homeScreen}
      resizeMode="cover"
    >
      <LinearGradient
        colors={['rgba(0,0,0,0.28)', 'rgba(0,0,0,0.32)', 'rgba(0,0,0,0.42)']}
        locations={[0, 0.55, 1]}
        style={styles.homeOverlay}
      >
        <ScrollView
          contentContainerStyle={styles.panelContent}
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}
        >
          {content}
        </ScrollView>
      </LinearGradient>
    </ImageBackground>
  );

  const renderMissionCard = (category: MissionCategory, mission: Mission) => (
    <View key={mission.id} style={styles.missionCard}>
      <View style={styles.missionBody}>
        <Text style={[styles.missionText, mission.completed && styles.missionTextDone]}>
          {mission.completed ? '✓ ' : ''}
          {mission.text}
        </Text>
        <Text style={styles.missionXp}>+{XP_REWARDS[category]} XP</Text>
      </View>
      {!mission.completed ? (
        <Pressable style={styles.completeButton} onPress={() => completeMission(category, mission.id)}>
          <Text style={styles.completeButtonText}>COMPLETE</Text>
        </Pressable>
      ) : (
        <Text style={styles.missionDoneLabel}>DONE</Text>
      )}
    </View>
  );

  const renderGoalsPage = () => (
    <ScrollView
      style={styles.page}
      contentContainerStyle={styles.pageScrollContent}
      keyboardShouldPersistTaps="handled"
      showsVerticalScrollIndicator={false}
    >
      <Text style={styles.pageTitle}>GOALS / MISSIONS</Text>
      <View style={styles.xpBadge}>
        <Text style={styles.xpBadgeText}>TOTAL XP  {totalXp}</Text>
      </View>

      {(['daily', 'quarterly', 'year'] as MissionCategory[]).map((category) => (
        <View key={category} style={styles.missionSection}>
          <Text style={styles.sectionTitle}>{CATEGORY_LABELS[category].toUpperCase()}</Text>
          {missionBoard[category].length === 0 ? (
            <Text style={styles.chatEmpty}>No missions yet. Add one below.</Text>
          ) : (
            missionBoard[category].map((mission) => renderMissionCard(category, mission))
          )}
          <View style={styles.addMissionRow}>
            <TextInput
              style={[styles.editField, styles.addMissionInput]}
              placeholder="New mission"
              placeholderTextColor="rgba(255,255,255,0.35)"
              value={missionDrafts[category]}
              onChangeText={(value) =>
                setMissionDrafts((prev) => ({ ...prev, [category]: value }))
              }
              onSubmitEditing={() => addMission(category)}
              selectionColor="#ffffff"
            />
            <Pressable style={styles.addMissionButton} onPress={() => addMission(category)}>
              <Text style={styles.gameButtonText}>ADD</Text>
            </Pressable>
          </View>
        </View>
      ))}
    </ScrollView>
  );

  const renderMessagesPage = () => (
    <ScrollView
      style={styles.page}
      contentContainerStyle={styles.pageScrollContent}
      showsVerticalScrollIndicator={false}
    >
      <Text style={styles.pageTitle}>MESSAGES</Text>
      {chadMessages.length === 0 ? (
        <Text style={styles.chatEmpty}>No messages yet. Schedule or preview from Schedule.</Text>
      ) : (
        chadMessages.map((message) => (
          <View key={`${message.timestamp}-${message.text}`} style={styles.chatRow}>
            <View style={styles.chatBubble}>
              <Text style={styles.chatBubbleText}>{message.text}</Text>
              <Text style={styles.chatTime}>{formatMessageTime(message.timestamp)}</Text>
            </View>
          </View>
        ))
      )}
    </ScrollView>
  );

  const renderSchedulePage = () => (
    <ScrollView
      style={styles.page}
      contentContainerStyle={styles.pageScrollContent}
      showsVerticalScrollIndicator={false}
    >
      <Text style={styles.pageTitle}>SCHEDULE</Text>
      <Pressable style={styles.gameButton} onPress={onScheduleNext24Hours}>
        <Text style={styles.gameButtonText}>SCHEDULE NEXT 24 HOURS</Text>
      </Pressable>
      <Pressable style={styles.gameButton} onPress={onTestScheduleSoon}>
        <Text style={styles.gameButtonText}>TEST SCHEDULE IN 30 SECONDS</Text>
      </Pressable>
      <Pressable style={styles.gameButton} onPress={sendRealTest}>
        <Text style={styles.gameButtonText}>SEND TEST MESSAGE FROM CHAD</Text>
      </Pressable>
      <Pressable style={[styles.gameButton, styles.gameButtonLast]} onPress={onGeneratePreview}>
        <Text style={styles.gameButtonText}>GENERATE & PREVIEW MESSAGES</Text>
      </Pressable>
    </ScrollView>
  );

  const renderHomePage = () => (
    <View style={[styles.page, styles.homePage]}>
      <View style={styles.homeTop}>
        <View style={styles.xpBadge}>
          <Text style={styles.xpBadgeText}>XP  {totalXp}</Text>
        </View>
      </View>
      <View style={styles.homeNav}>
        <Pressable style={styles.gameButton} onPress={() => setStep('viewVision')}>
          <Text style={styles.gameButtonText}>VISION</Text>
        </Pressable>
        <Pressable
          style={[styles.gameButton, styles.gameButtonLast]}
          onPress={() => setStep('viewAnti')}
        >
          <Text style={styles.gameButtonText}>ANTI-VISION</Text>
        </Pressable>
        <Text style={styles.swipeHint}>SWIPE FOR GOALS · MESSAGES · SCHEDULE</Text>
      </View>
    </View>
  );

  if (step === 'anti') {
    return (
      <View style={styles.container}>
        <Text style={styles.title}>Anti-Vision</Text>
        <Text style={styles.sub}>What are you refusing to become?</Text>
        <TextInput
          style={styles.input}
          placeholder="Add an item and press Add"
          value={antiInput}
          onChangeText={setAntiInput}
          onSubmitEditing={() => {
            if (antiInput.trim()) {
              setAntiList([...antiList, antiInput.trim()]);
              setAntiInput('');
            }
          }}
        />
        <Button
          title="Add"
          onPress={() => {
            if (antiInput.trim()) {
              setAntiList([...antiList, antiInput.trim()]);
              setAntiInput('');
            }
          }}
        />
        <FlatList
          data={antiList}
          keyExtractor={(item, i) => i.toString()}
          renderItem={({ item }) => <Text style={styles.item}>• {item}</Text>}
        />
        <Button title="Next → Vision" onPress={() => setStep('vision')} />
      </View>
    );
  }

  if (step === 'vision') {
    return (
      <View style={styles.container}>
        <Text style={styles.title}>Vision</Text>
        <Text style={styles.sub}>Who are you becoming?</Text>
        <TextInput
          style={styles.input}
          placeholder="Add an item and press Add"
          value={visionInput}
          onChangeText={setVisionInput}
          onSubmitEditing={() => {
            if (visionInput.trim()) {
              setVisionList([...visionList, visionInput.trim()]);
              setVisionInput('');
            }
          }}
        />
        <Button
          title="Add"
          onPress={() => {
            if (visionInput.trim()) {
              setVisionList([...visionList, visionInput.trim()]);
              setVisionInput('');
            }
          }}
        />
        <FlatList
          data={visionList}
          keyExtractor={(item, i) => i.toString()}
          renderItem={({ item }) => <Text style={styles.item}>• {item}</Text>}
        />
        <Button title="Finish & Save" onPress={saveAndContinue} />
      </View>
    );
  }

  if (step === 'editAnti' || step === 'editVision') {
    const title = step === 'editAnti' ? 'EDIT ANTI-VISION' : 'EDIT VISION';
    return (
      <View style={styles.editScreen}>
        <ScrollView
          contentContainerStyle={styles.editScreenContent}
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}
        >
          <Text style={styles.editTitle}>{title}</Text>
          <Text style={styles.editSub}>Add, edit, or remove items, then Save.</Text>

          <View style={styles.editList}>
            {editDraft.map((item, index) => (
              <View key={index} style={styles.editRow}>
                <TextInput
                  style={[styles.editField, styles.editInput]}
                  value={item}
                  onChangeText={(value) => updateDraftItem(index, value)}
                  placeholderTextColor="rgba(255,255,255,0.35)"
                  selectionColor="#ffffff"
                />
                <Pressable style={styles.removeButton} onPress={() => removeDraftItem(index)}>
                  <Text style={styles.removeText}>REMOVE</Text>
                </Pressable>
              </View>
            ))}
          </View>

          <TextInput
            style={styles.editField}
            placeholder="Add a new item"
            placeholderTextColor="rgba(255,255,255,0.35)"
            value={editNewItem}
            onChangeText={setEditNewItem}
            onSubmitEditing={addDraftItem}
            selectionColor="#ffffff"
          />

          <Pressable style={styles.gameButton} onPress={addDraftItem}>
            <Text style={styles.gameButtonText}>ADD</Text>
          </Pressable>

          <View style={styles.editActions}>
            <Pressable style={styles.gameButton} onPress={cancelEdit}>
              <Text style={styles.gameButtonText}>CANCEL</Text>
            </Pressable>
            <Pressable style={[styles.gameButton, styles.gameButtonLast]} onPress={saveEdit}>
              <Text style={styles.gameButtonText}>SAVE</Text>
            </Pressable>
          </View>
        </ScrollView>
      </View>
    );
  }

  if (step === 'viewVision') {
    return renderCinematicShell(
      <>
        <Pressable style={[styles.gameButton, styles.backButton]} onPress={() => setStep('main')}>
          <Text style={styles.gameButtonText}>BACK</Text>
        </Pressable>
        <View style={styles.sectionHeader}>
          <Text style={styles.sectionTitle}>VISION</Text>
          <Pressable onPress={() => openEdit('vision')} hitSlop={8}>
            <Text style={styles.editLink}>EDIT</Text>
          </Pressable>
        </View>
        {visionList.length === 0 ? (
          <Text style={styles.chatEmpty}>No vision items yet.</Text>
        ) : (
          visionList.map((item, i) => (
            <View key={`vision-${i}`} style={styles.card}>
              <Text style={styles.cardBullet}>•</Text>
              <Text style={styles.cardText}>{item}</Text>
            </View>
          ))
        )}
      </>,
    );
  }

  if (step === 'viewAnti') {
    return renderCinematicShell(
      <>
        <Pressable style={[styles.gameButton, styles.backButton]} onPress={() => setStep('main')}>
          <Text style={styles.gameButtonText}>BACK</Text>
        </Pressable>
        <View style={styles.sectionHeader}>
          <Text style={styles.sectionTitle}>ANTI-VISION</Text>
          <Pressable onPress={() => openEdit('antiVision')} hitSlop={8}>
            <Text style={styles.editLink}>EDIT</Text>
          </Pressable>
        </View>
        {antiList.length === 0 ? (
          <Text style={styles.chatEmpty}>No anti-vision items yet.</Text>
        ) : (
          antiList.map((item, i) => (
            <View key={`anti-${i}`} style={styles.card}>
              <Text style={styles.cardBullet}>•</Text>
              <Text style={styles.cardText}>{item}</Text>
            </View>
          ))
        )}
      </>,
    );
  }

  return (
    <ImageBackground
      source={require('./assets/home-cinematic-bg.jpg')}
      style={styles.homeScreen}
      resizeMode="cover"
    >
      <LinearGradient
        colors={['rgba(0,0,0,0.28)', 'rgba(0,0,0,0.32)', 'rgba(0,0,0,0.42)']}
        locations={[0, 0.55, 1]}
        style={styles.homeOverlay}
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
          <View style={styles.pageSlide}>{renderHomePage()}</View>
          <View style={styles.pageSlide}>{renderGoalsPage()}</View>
          <View style={styles.pageSlide}>{renderMessagesPage()}</View>
          <View style={styles.pageSlide}>{renderSchedulePage()}</View>
        </ScrollView>

        <View style={styles.dots}>
          {PAGES.map((page, index) => (
            <View
              key={page}
              style={[styles.dot, index === pageIndex && styles.dotActive]}
            />
          ))}
        </View>
      </LinearGradient>
    </ImageBackground>
  );
}

const styles = StyleSheet.create({
  container: { flexGrow: 1, padding: 20, paddingTop: 60, paddingBottom: 40 },
  title: { fontSize: 28, fontWeight: 'bold', marginBottom: 8 },
  sub: { fontSize: 16, marginBottom: 20, color: '#555' },
  input: { borderWidth: 1, borderColor: '#ccc', padding: 12, marginBottom: 10, borderRadius: 8 },
  item: { fontSize: 16, marginVertical: 4 },
  homeScreen: { flex: 1, backgroundColor: '#0a0a0a' },
  homeOverlay: { flex: 1 },
  pager: { flex: 1 },
  pageSlide: { width: PAGE_WIDTH, flex: 1 },
  page: { flex: 1, width: PAGE_WIDTH },
  homePage: { justifyContent: 'space-between' },
  homeTop: {
    paddingTop: 56,
    paddingHorizontal: 20,
    alignItems: 'flex-start',
  },
  homeNav: {
    paddingHorizontal: 20,
    paddingBottom: 28,
  },
  pageScrollContent: {
    paddingHorizontal: 20,
    paddingTop: 56,
    paddingBottom: 40,
  },
  panelContent: {
    flexGrow: 1,
    paddingHorizontal: 20,
    paddingTop: 56,
    paddingBottom: 40,
  },
  pageTitle: {
    fontSize: 16,
    fontWeight: '700',
    color: '#ffffff',
    letterSpacing: 2.4,
    marginBottom: 14,
  },
  xpBadge: {
    alignSelf: 'flex-start',
    backgroundColor: 'rgba(0,0,0,0.55)',
    borderColor: 'rgba(255,255,255,0.28)',
    borderWidth: 1,
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 8,
    marginBottom: 18,
  },
  xpBadgeText: {
    color: '#ffffff',
    fontSize: 12,
    fontWeight: '700',
    letterSpacing: 1.6,
  },
  swipeHint: {
    marginTop: 14,
    color: 'rgba(255,255,255,0.45)',
    fontSize: 10,
    letterSpacing: 1.4,
    textAlign: 'center',
  },
  dots: {
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    paddingBottom: 18,
    gap: 8,
  },
  dot: {
    width: 7,
    height: 7,
    borderRadius: 4,
    backgroundColor: 'rgba(255,255,255,0.28)',
  },
  dotActive: {
    backgroundColor: '#ffffff',
    width: 8,
    height: 8,
  },
  backButton: {
    alignSelf: 'flex-start',
    minWidth: 96,
    marginBottom: 18,
  },
  gameButton: {
    height: 46,
    backgroundColor: 'rgba(0,0,0,0.55)',
    borderRadius: 8,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.28)',
    paddingHorizontal: 14,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 10,
  },
  gameButtonLast: { marginBottom: 0 },
  gameButtonText: {
    color: '#ffffff',
    fontSize: 12,
    fontWeight: '700',
    letterSpacing: 1.4,
    textTransform: 'uppercase',
  },
  sectionHeader: {
    marginTop: 8,
    marginBottom: 12,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  sectionTitle: {
    fontSize: 12,
    fontWeight: '700',
    color: '#ffffff',
    letterSpacing: 1.8,
    marginBottom: 10,
  },
  editLink: {
    color: 'rgba(255,255,255,0.85)',
    fontSize: 11,
    fontWeight: '700',
    letterSpacing: 1.6,
  },
  card: {
    backgroundColor: 'rgba(0,0,0,0.5)',
    borderRadius: 12,
    paddingVertical: 12,
    paddingHorizontal: 14,
    marginBottom: 8,
    flexDirection: 'row',
    alignItems: 'flex-start',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.12)',
  },
  cardBullet: { color: 'rgba(255,255,255,0.55)', fontSize: 15, marginRight: 10, marginTop: 1 },
  cardText: { flex: 1, color: '#ffffff', fontSize: 15, lineHeight: 21 },
  chatEmpty: { color: 'rgba(255,255,255,0.55)', fontSize: 13, marginBottom: 10 },
  chatRow: { alignItems: 'flex-start', marginBottom: 10 },
  chatBubble: {
    maxWidth: '88%',
    backgroundColor: 'rgba(0,0,0,0.55)',
    borderRadius: 14,
    borderTopLeftRadius: 4,
    paddingVertical: 11,
    paddingHorizontal: 13,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.12)',
  },
  chatBubbleText: { color: '#ffffff', fontSize: 14, lineHeight: 20 },
  chatTime: { color: 'rgba(255,255,255,0.45)', fontSize: 11, marginTop: 6 },
  missionSection: { marginBottom: 24 },
  missionCard: {
    backgroundColor: 'rgba(0,0,0,0.5)',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.12)',
    padding: 12,
    marginBottom: 8,
  },
  missionBody: { marginBottom: 10 },
  missionText: { color: '#ffffff', fontSize: 15, lineHeight: 21 },
  missionTextDone: {
    textDecorationLine: 'line-through',
    color: 'rgba(180,255,180,0.9)',
  },
  missionXp: {
    marginTop: 4,
    color: 'rgba(255,255,255,0.45)',
    fontSize: 11,
    letterSpacing: 1,
  },
  completeButton: {
    alignSelf: 'flex-start',
    height: 34,
    paddingHorizontal: 12,
    borderRadius: 7,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.28)',
    backgroundColor: 'rgba(0,0,0,0.45)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  completeButtonText: {
    color: '#ffffff',
    fontSize: 11,
    fontWeight: '700',
    letterSpacing: 1.2,
  },
  missionDoneLabel: {
    color: '#8dff9a',
    fontSize: 11,
    fontWeight: '700',
    letterSpacing: 1.2,
  },
  addMissionRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 4,
  },
  addMissionInput: {
    flex: 1,
    marginBottom: 0,
    marginRight: 8,
  },
  addMissionButton: {
    height: 46,
    minWidth: 72,
    paddingHorizontal: 12,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.28)',
    backgroundColor: 'rgba(0,0,0,0.55)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  editScreen: {
    flex: 1,
    backgroundColor: '#0a0a0a',
  },
  editScreenContent: {
    flexGrow: 1,
    paddingHorizontal: 20,
    paddingTop: 56,
    paddingBottom: 40,
  },
  editTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: '#ffffff',
    letterSpacing: 2,
    marginBottom: 8,
  },
  editSub: {
    fontSize: 14,
    color: 'rgba(255,255,255,0.6)',
    marginBottom: 20,
  },
  editList: { marginBottom: 16 },
  editRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 10,
  },
  editField: {
    backgroundColor: 'rgba(255,255,255,0.06)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.22)',
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 12,
    marginBottom: 10,
    color: '#ffffff',
    fontSize: 15,
  },
  editInput: {
    flex: 1,
    marginBottom: 0,
    marginRight: 10,
  },
  removeButton: {
    paddingHorizontal: 10,
    paddingVertical: 8,
    borderRadius: 6,
    borderWidth: 1,
    borderColor: 'rgba(198,40,40,0.55)',
    backgroundColor: 'rgba(198,40,40,0.08)',
  },
  removeText: {
    color: '#ff6b6b',
    fontSize: 10,
    fontWeight: '700',
    letterSpacing: 1.2,
  },
  editActions: { marginTop: 8 },
});
