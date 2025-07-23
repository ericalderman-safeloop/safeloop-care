import React from 'react'
import { View, Text, StyleSheet, TouchableOpacity, Alert } from 'react-native'
import { useAuth } from '../contexts/AuthContext'
import { signOut } from '../lib/auth'

export default function HomeScreen() {
  const { session } = useAuth()

  const handleSignOut = async () => {
    try {
      await signOut()
    } catch (error) {
      Alert.alert('Error', 'Failed to sign out')
    }
  }

  return (
    <View style={styles.container}>
      <Text style={styles.title}>Welcome to SafeLoop Care</Text>
      <Text style={styles.subtitle}>
        Hello, {session?.user?.email || 'User'}!
      </Text>

      <View style={styles.content}>
        <Text style={styles.description}>
          Your SafeLoop Care app is ready to help you monitor and respond to emergency situations.
        </Text>
        
        <Text style={styles.comingSoon}>
          Features coming soon:
        </Text>
        <Text style={styles.featureList}>
          • Real-time fall detection alerts{'\n'}
          • Emergency contact management{'\n'}
          • Location tracking{'\n'}
          • Communication with SafeLoop Watch
        </Text>
      </View>

      <TouchableOpacity style={styles.signOutButton} onPress={handleSignOut}>
        <Text style={styles.signOutText}>Sign Out</Text>
      </TouchableOpacity>
    </View>
  )
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    padding: 20,
    backgroundColor: '#f5f5f5',
  },
  title: {
    fontSize: 28,
    fontWeight: 'bold',
    marginBottom: 10,
    color: '#333',
    textAlign: 'center',
  },
  subtitle: {
    fontSize: 18,
    color: '#666',
    marginBottom: 30,
    textAlign: 'center',
  },
  content: {
    flex: 1,
    justifyContent: 'center',
  },
  description: {
    fontSize: 16,
    color: '#555',
    lineHeight: 24,
    textAlign: 'center',
    marginBottom: 30,
  },
  comingSoon: {
    fontSize: 18,
    fontWeight: '600',
    color: '#333',
    marginBottom: 15,
  },
  featureList: {
    fontSize: 16,
    color: '#555',
    lineHeight: 24,
  },
  signOutButton: {
    backgroundColor: '#ff4444',
    padding: 15,
    borderRadius: 5,
    alignItems: 'center',
    marginTop: 20,
  },
  signOutText: {
    color: 'white',
    fontSize: 16,
    fontWeight: '600',
  },
})