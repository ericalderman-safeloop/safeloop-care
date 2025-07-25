import React from 'react'
import { View, Text, StyleSheet, TouchableOpacity, Alert } from 'react-native'
import { useAuth } from '../contexts/AuthContext'
import { signOut } from '../lib/auth'

interface HomeScreenProps {
  navigation: any
}

export default function HomeScreen({ navigation }: HomeScreenProps) {
  const { userProfile } = useAuth()

  const handleSignOut = async () => {
    try {
      await signOut()
    } catch (error) {
      Alert.alert('Error', 'Failed to sign out')
    }
  }

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <TouchableOpacity 
          style={styles.menuButton} 
          onPress={() => navigation.navigate('MainMenu')}
        >
          <Text style={styles.menuButtonText}>☰ Menu</Text>
        </TouchableOpacity>
        <Text style={styles.title}>Dashboard</Text>
      </View>

      <Text style={styles.subtitle}>
        Hello, {userProfile?.display_name || 'User'}!
      </Text>

      <View style={styles.content}>
        <View style={styles.alertCard}>
          <Text style={styles.alertTitle}>No Active Alerts</Text>
          <Text style={styles.alertDescription}>
            All SafeLoop Watch devices are functioning normally
          </Text>
        </View>

        <View style={styles.statusGrid}>
          <View style={styles.statusCard}>
            <Text style={styles.statusNumber}>0</Text>
            <Text style={styles.statusLabel}>Active Alerts</Text>
          </View>
          <View style={styles.statusCard}>
            <Text style={styles.statusNumber}>0</Text>
            <Text style={styles.statusLabel}>Connected Devices</Text>
          </View>
        </View>
        
        <Text style={styles.comingSoon}>
          Coming Soon:
        </Text>
        <Text style={styles.featureList}>
          • Real-time fall detection alerts{'\n'}
          • Emergency contact management{'\n'}
          • Location tracking{'\n'}
          • Two-way communication with SafeLoop Watch
        </Text>
      </View>
    </View>
  )
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f5f5f5',
  },
  header: {
    backgroundColor: '#2196F3',
    paddingTop: 50,
    paddingBottom: 20,
    paddingHorizontal: 20,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  menuButton: {
    padding: 8,
  },
  menuButtonText: {
    color: 'white',
    fontSize: 18,
    fontWeight: '600',
  },
  title: {
    fontSize: 20,
    fontWeight: 'bold',
    color: 'white',
    flex: 1,
    textAlign: 'center',
    marginRight: 50, // Balance the menu button
  },
  subtitle: {
    fontSize: 18,
    color: '#666',
    margin: 20,
    textAlign: 'center',
  },
  content: {
    flex: 1,
    padding: 20,
  },
  alertCard: {
    backgroundColor: '#4CAF50',
    borderRadius: 12,
    padding: 20,
    marginBottom: 20,
    alignItems: 'center',
  },
  alertTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: 'white',
    marginBottom: 5,
  },
  alertDescription: {
    fontSize: 14,
    color: 'rgba(255, 255, 255, 0.9)',
    textAlign: 'center',
  },
  statusGrid: {
    flexDirection: 'row',
    gap: 15,
    marginBottom: 30,
  },
  statusCard: {
    flex: 1,
    backgroundColor: 'white',
    borderRadius: 12,
    padding: 20,
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: {
      width: 0,
      height: 2,
    },
    shadowOpacity: 0.1,
    shadowRadius: 3.84,
    elevation: 5,
  },
  statusNumber: {
    fontSize: 32,
    fontWeight: 'bold',
    color: '#2196F3',
    marginBottom: 5,
  },
  statusLabel: {
    fontSize: 14,
    color: '#666',
    textAlign: 'center',
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
})