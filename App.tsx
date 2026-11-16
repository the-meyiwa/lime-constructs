import React from 'react';
import { StatusBar } from 'expo-status-bar';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { Planner } from './src/Planner';

export default function App() {
  return (
    <SafeAreaProvider>
      <StatusBar style="light" />
      <Planner />
    </SafeAreaProvider>
  );
}
