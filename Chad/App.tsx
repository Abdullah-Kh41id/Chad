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
} from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import * as Notifications from 'expo-notifications';
import { generateTestMessage } from './lib/messageGenerator';
import { scheduleDailyChadMessages } from './lib/scheduleDailyChadMessages';

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
  const didAutoSchedule = useRef(false);

  useEffect(() => {
    loadData();
  }, []);

  useEffect(() => {
    if (step !== 'home') return;
    if (antiList.length === 0 && visionList.length === 0) return;
    if (didAutoSchedule.current) return;
    didAutoSchedule.current = true;
    scheduleDailyChadMessages();
  }, [step, antiList.length, visionList.length]);

  const loadData = async () => {
    const anti = await AsyncStorage.getItem('antiVision');
    const vision = await AsyncStorage.getItem('vision');
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
  };

  const onScheduleDaily = async () => {
    const ok = await scheduleDailyChadMessages();
    if (!ok) {
      alert('Could not schedule. Check notification permission and saved lists.');
      return;
    }
    alert('Daily Chad messages scheduled');
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
    <ScrollView contentContainerStyle={styles.container} keyboardShouldPersistTaps="handled">
      <Text style={styles.title}>Chad is ready</Text>
      <Text style={styles.sub}>Your lists are saved.</Text>
      <Button title="SEND TEST MESSAGE FROM CHAD" onPress={sendRealTest} />
      <View style={{ height: 12 }} />
      <Button title="Schedule Daily Messages" onPress={onScheduleDaily} />

      <View style={styles.sectionHeader}>
        <Text style={styles.sectionTitle}>Anti-Vision</Text>
        <Pressable onPress={() => openEdit('antiVision')}>
          <Text style={styles.editLink}>Edit</Text>
        </Pressable>
      </View>
      {antiList.map((item, i) => (
        <Text key={`anti-${i}`} style={styles.item}>
          • {item}
        </Text>
      ))}

      <View style={styles.sectionHeader}>
        <Text style={styles.sectionTitle}>Vision</Text>
        <Pressable onPress={() => openEdit('vision')}>
          <Text style={styles.editLink}>Edit</Text>
        </Pressable>
      </View>
      {visionList.map((item, i) => (
        <Text key={`vision-${i}`} style={styles.item}>
          • {item}
        </Text>
      ))}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flexGrow: 1, padding: 20, paddingTop: 60, paddingBottom: 40 },
  title: { fontSize: 28, fontWeight: 'bold', marginBottom: 8 },
  sub: { fontSize: 16, marginBottom: 20, color: '#555' },
  input: { borderWidth: 1, borderColor: '#ccc', padding: 12, marginBottom: 10, borderRadius: 8 },
  item: { fontSize: 16, marginVertical: 4 },
  sectionHeader: {
    marginTop: 30,
    marginBottom: 8,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  sectionTitle: { fontSize: 18, fontWeight: 'bold' },
  editLink: { color: '#1a73e8', fontSize: 16, fontWeight: '600' },
  editList: { flexGrow: 0, maxHeight: 360, marginBottom: 12 },
  editRow: { flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 4 },
  editInput: { flex: 1, marginBottom: 0 },
  removeButton: { paddingHorizontal: 8, paddingVertical: 10 },
  removeText: { color: '#c62828', fontWeight: '600' },
  editActions: { marginTop: 16 },
});
