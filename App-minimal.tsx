import React from 'react'
import { View, Text, StyleSheet } from 'react-native'
import { SafeAreaProvider } from 'react-native-safe-area-context'

export default function App() {
  return (
    <SafeAreaProvider>
      <View style={styles.container}>
        <Text style={styles.title}>SafeLoop Care</Text>
        <Text style={styles.subtitle}>App is working!</Text>
      </View>
    </SafeAreaProvider>
  )
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#f5f5f5',
  },
  title: {
    fontSize: 32,
    fontWeight: 'bold',
    marginBottom: 10,
    color: '#333',
  },
  subtitle: {
    fontSize: 16,
    color: '#666',
  },
})