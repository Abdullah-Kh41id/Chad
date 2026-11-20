import React, { useState, useEffect } from 'react';
import { View, Text, TextInput, Button, FlatList, StyleSheet } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import * as Notifications from 'expo-notifications';

Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowAlert: true,
    shouldPlaySound: true,
    shouldSetBadge: true,
    shouldShowBanner: true,
    shouldShowList: true,
  }),
});

export default function App() {
  const [step, setStep] = useState<'anti' | 'vision' | 'home'>('anti');
  const [antiInput, setAntiInput] = useState('');
  const [visionInput, setVisionInput] = useState('');
  const [antiList, setAntiList] = useState<string[]>([]);
  const [visionList, setVisionList] = useState<string[]>([]);

  useEffect(() => {
    loadData();
  }, []);

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

  const sendTestMessage = async () => {
    const { status } = await Notifications.requestPermissionsAsync();
    if (status !== 'granted') {
      alert('Permission not granted');
      return;
    }

    await Notifications.scheduleNotificationAsync({
      content: {
        title: 'Chad',
        body: 'You will get that 8 supercar garage.',
        sound: 'default',
      },
      trigger: null, // fires immediately
    });

    alert('Test message scheduled');
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
        <Button title="Add" onPress={() => {
          if (antiInput.trim()) {
            setAntiList([...antiList, antiInput.trim()]);
            setAntiInput('');
          }
        }} />
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
        <Button title="Add" onPress={() => {
          if (visionInput.trim()) {
            setVisionList([...visionList, visionInput.trim()]);
            setVisionInput('');
          }
        }} />
        <FlatList
          data={visionList}
          keyExtractor={(item, i) => i.toString()}
          renderItem={({ item }) => <Text style={styles.item}>• {item}</Text>}
        />
        <Button title="Finish & Save" onPress={saveAndContinue} />
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <Text style={styles.title}>Chad is ready</Text>
      <Text style={styles.sub}>Your lists are saved.</Text>
      <Button title="SEND TEST MESSAGE FROM CHAD" onPress={sendTestMessage} />
      <Text style={{ marginTop: 30, fontWeight: 'bold' }}>Anti-Vision:</Text>
      {antiList.map((item, i) => <Text key={i}>• {item}</Text>)}
      <Text style={{ marginTop: 20, fontWeight: 'bold' }}>Vision:</Text>
      {visionList.map((item, i) => <Text key={i}>• {item}</Text>)}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, padding: 20, paddingTop: 60 },
  title: { fontSize: 28, fontWeight: 'bold', marginBottom: 8 },
  sub: { fontSize: 16, marginBottom: 20, color: '#555' },
  input: { borderWidth: 1, borderColor: '#ccc', padding: 12, marginBottom: 10, borderRadius: 8 },
  item: { fontSize: 16, marginVertical: 4 },
});
