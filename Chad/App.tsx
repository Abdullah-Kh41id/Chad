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

const PREVIEW_KINDS: ChadMessageKind[] = [
  'affirmation',
  'accountability',
  'sideQuest',
  'affirmation',
  'accountability',
];

Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowBanner: true,
    shouldShowList: true,
    shouldPlaySound: true,
    shouldSetBadge: true,
  }),
});

type Step = 'anti' | 'vision' | 'home' | 'editAnti' | 'editVision';
type EditTarget = 'antiVision' | 'vision';

export default function App() {
  const [step, setStep] = useState<Step>('anti');
  const [antiInput, setAntiInput] = useState('');
  const [visionInput, setVisionInput] = useState('');
  const [antiList, setAntiList] = useState<string[]>([]);
  const [visionList, setVisionList] = useState<string[]>([]);
  const [editDraft, setEditDraft] = useState<string[]>([]);
  const [editNewItem, setEditNewItem] = useState('');
  const [chadMessages, setChadMessages] = useState<ChadMessage[]>([]);
  const didAutoSchedule = useRef(false);

  useEffect(() => {
    loadData();
  }, []);

  useEffect(() => {
    if (step !== 'home') return;
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
    const messages = await loadChadMessages();
    setChadMessages(messages.slice(0, 10));
    if (anti && vision) {
      setAntiList(JSON.parse(anti));
      setVisionList(JSON.parse(vision));
      setStep('home');
    }
  };

  const saveAndContinue = async () => {
    await AsyncStorage.setItem('antiVision', JSON.stringify(antiList));
    await AsyncStorage.setItem('vision', JSON.stringify(visionList));
    setStep('home');
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
    } else {
      setVisionList(cleaned);
    }

    setEditNewItem('');
    setStep('home');
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
    const title = step === 'editAnti' ? 'Edit Anti-Vision' : 'Edit Vision';
    return (
      <View style={styles.container}>
        <Text style={styles.title}>{title}</Text>
        <Text style={styles.sub}>Add, edit, or remove items, then Save.</Text>
        <ScrollView style={styles.editList} keyboardShouldPersistTaps="handled">
          {editDraft.map((item, index) => (
            <View key={index} style={styles.editRow}>
              <TextInput
                style={[styles.input, styles.editInput]}
                value={item}
                onChangeText={(value) => updateDraftItem(index, value)}
              />
              <Pressable style={styles.removeButton} onPress={() => removeDraftItem(index)}>
                <Text style={styles.removeText}>Remove</Text>
              </Pressable>
            </View>
          ))}
        </ScrollView>
        <TextInput
          style={styles.input}
          placeholder="Add a new item"
          value={editNewItem}
          onChangeText={setEditNewItem}
          onSubmitEditing={addDraftItem}
        />
        <Button title="Add" onPress={addDraftItem} />
        <View style={styles.editActions}>
          <Button title="Cancel" onPress={() => setStep('home')} />
          <View style={{ height: 8 }} />
          <Button title="Save" onPress={saveEdit} />
        </View>
      </View>
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
          contentContainerStyle={styles.homeContent}
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}
        >
          <Text style={styles.homeTitle}>CHAD</Text>
          <Text style={styles.homeSub}>The man you’re becoming</Text>

          <Pressable style={styles.gameButton} onPress={sendRealTest}>
            <Text style={styles.gameButtonText}>SEND TEST MESSAGE FROM CHAD</Text>
          </Pressable>
          <Pressable style={styles.gameButton} onPress={onScheduleNext24Hours}>
            <Text style={styles.gameButtonText}>SCHEDULE NEXT 24 HOURS</Text>
          </Pressable>
          <Pressable style={styles.gameButton} onPress={onTestScheduleSoon}>
            <Text style={styles.gameButtonText}>TEST SCHEDULE IN 30 SECONDS</Text>
          </Pressable>
          <Pressable style={[styles.gameButton, styles.gameButtonLast]} onPress={onGeneratePreview}>
            <Text style={styles.gameButtonText}>GENERATE & PREVIEW MESSAGES</Text>
          </Pressable>

          <View style={styles.sectionHeader}>
            <Text style={styles.sectionTitle}>ANTI-VISION</Text>
            <Pressable onPress={() => openEdit('antiVision')} hitSlop={8}>
              <Text style={styles.editLink}>EDIT</Text>
            </Pressable>
          </View>
          {antiList.map((item, i) => (
            <View key={`anti-${i}`} style={styles.card}>
              <Text style={styles.cardBullet}>•</Text>
              <Text style={styles.cardText}>{item}</Text>
            </View>
          ))}

          <View style={styles.sectionHeader}>
            <Text style={styles.sectionTitle}>VISION</Text>
            <Pressable onPress={() => openEdit('vision')} hitSlop={8}>
              <Text style={styles.editLink}>EDIT</Text>
            </Pressable>
          </View>
          {visionList.map((item, i) => (
            <View key={`vision-${i}`} style={styles.card}>
              <Text style={styles.cardBullet}>•</Text>
              <Text style={styles.cardText}>{item}</Text>
            </View>
          ))}

          <View style={styles.sectionHeader}>
            <Text style={styles.sectionTitle}>CHAD MESSAGES</Text>
          </View>
          {chadMessages.length === 0 ? (
            <Text style={styles.chatEmpty}>No messages yet. Send a test or schedule the next 24 hours.</Text>
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
  homeOverlay: {
    flex: 1,
  },
  homeContent: { flexGrow: 1, padding: 20, paddingTop: 64, paddingBottom: 48 },
  homeTitle: {
    fontSize: 42,
    fontWeight: '800',
    marginBottom: 4,
    color: '#ffffff',
    letterSpacing: 4,
    textShadowColor: 'rgba(0,0,0,0.6)',
    textShadowOffset: { width: 0, height: 2 },
    textShadowRadius: 8,
  },
  homeSub: {
    fontSize: 14,
    marginBottom: 28,
    color: 'rgba(255,255,255,0.72)',
    letterSpacing: 1.2,
    textTransform: 'uppercase',
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
  gameButtonLast: { marginBottom: 8 },
  gameButtonText: {
    color: '#ffffff',
    fontSize: 12,
    fontWeight: '700',
    letterSpacing: 1.4,
    textTransform: 'uppercase',
  },
  sectionHeader: {
    marginTop: 28,
    marginBottom: 12,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  sectionTitle: {
    fontSize: 13,
    fontWeight: '700',
    color: '#ffffff',
    letterSpacing: 2,
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
  chatEmpty: { color: 'rgba(255,255,255,0.55)', fontSize: 13, marginBottom: 8 },
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
  editList: { flexGrow: 0, maxHeight: 360, marginBottom: 12 },
  editRow: { flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 4 },
  editInput: { flex: 1, marginBottom: 0 },
  removeButton: { paddingHorizontal: 8, paddingVertical: 10 },
  removeText: { color: '#c62828', fontWeight: '600' },
  editActions: { marginTop: 16 },
});
