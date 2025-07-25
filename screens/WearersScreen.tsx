import React, { useState, useEffect, useCallback } from 'react'
import { 
  View, 
  Text, 
  StyleSheet, 
  TouchableOpacity, 
  Alert, 
  ScrollView,
  ActivityIndicator,
  RefreshControl 
} from 'react-native'
import { useAuth } from '../contexts/AuthContext'
import { userService, Wearer } from '../lib/userService'
import { supabase } from '../lib/supabase'
import { useFocusEffect } from '@react-navigation/native'

interface WearersScreenProps {
  navigation: any
}

export default function WearersScreen({ navigation }: WearersScreenProps) {
  const { userProfile } = useAuth()
  const [wearers, setWearers] = useState<Wearer[]>([])
  const [loading, setLoading] = useState(true)
  const [refreshing, setRefreshing] = useState(false)

  const loadWearers = async () => {
    if (!userProfile) return
    
    try {
      const wearersList = await userService.getWearers(userProfile)
      setWearers(wearersList)
    } catch (error) {
      console.error('Error loading wearers:', error)
      Alert.alert('Error', 'Failed to load wearers. Please try again.')
    } finally {
      setLoading(false)
    }
  }

  const handleRefresh = async () => {
    setRefreshing(true)
    await loadWearers()
    setRefreshing(false)
  }

  const handleDeleteWearer = (wearer: Wearer) => {
    const deviceCode = wearer.device && wearer.device.length > 0 ? wearer.device[0].seven_digit_code : 'device'
    Alert.alert(
      'Remove Wearer',
      `Are you sure you want to remove ${wearer.name}? This will permanently delete both the wearer and their ${deviceCode} device. This action cannot be undone.`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Remove',
          style: 'destructive',
          onPress: async () => {
            try {
              await userService.deleteWearer(wearer.id)
              Alert.alert('Success', `${wearer.name} has been removed.`)
              await loadWearers()
            } catch (error) {
              console.error('Error deleting wearer:', error)
              Alert.alert('Error', 'Failed to remove wearer. Please try again.')
            }
          }
        }
      ]
    )
  }

  const formatLastSeen = (lastSeen?: string) => {
    if (!lastSeen) return 'Never'
    const date = new Date(lastSeen)
    return date.toLocaleDateString() + ' ' + date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
  }

  const getDeviceStatus = (deviceArray?: Wearer['device']) => {
    // Handle the fact that device comes as an array from Supabase join
    const device = deviceArray && deviceArray.length > 0 ? deviceArray[0] : undefined
    
    if (!device) return { text: 'No Device', color: '#999' }
    
    // If device is not verified, it's pending verification from the watch
    if (!device.is_verified) return { text: 'Pending Verification', color: '#ff9800' }
    
    // Device is verified, check connectivity status
    if (device.last_seen) {
      const lastSeen = new Date(device.last_seen)
      const hoursSince = (Date.now() - lastSeen.getTime()) / (1000 * 60 * 60)
      if (hoursSince < 1) return { text: 'Online', color: '#4CAF50' }
      if (hoursSince < 24) return { text: 'Recent', color: '#2196F3' }
      return { text: 'Offline', color: '#f44336' }
    }
    
    // Device is verified but hasn't checked in yet
    return { text: 'Verified', color: '#4CAF50' }
  }

  // Refresh wearers when screen comes into focus
  useFocusEffect(
    useCallback(() => {
      if (userProfile) {
        loadWearers()
      }
    }, [userProfile])
  )

  // Set up real-time subscription for wearers and devices
  useEffect(() => {
    if (!userProfile?.safeloop_account_id) return

    console.log('🔔 Setting up real-time subscriptions for wearers...', userProfile.safeloop_account_id)
    
    // Test connection first
    console.log('🧪 Testing Supabase real-time connection...')
    const testChannel = supabase
      .channel('connection-test')
      .subscribe((status) => {
        console.log('🧪 Connection test status:', status)
        if (status === 'SUBSCRIBED') {
          console.log('✅ Supabase real-time is working!')
        } else if (status === 'CHANNEL_ERROR') {
          console.log('❌ Supabase real-time connection failed')
        }
      })

    // Subscribe to changes in wearers table
    const wearersSubscription = supabase
      .channel('wearers-realtime')
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'wearers',
          filter: `safeloop_account_id=eq.${userProfile.safeloop_account_id}`
        },
        (payload) => {
          console.log('👤 REAL-TIME: Wearer change detected:', payload.eventType, payload.new || payload.old)
          loadWearers()
        }
      )
      .subscribe((status) => {
        console.log('👤 Wearers subscription status:', status)
      })

    // Subscribe to changes in devices table - this is key for verification updates
    const devicesSubscription = supabase
      .channel(`devices-verification-${userProfile.safeloop_account_id}`)
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'devices'
        },
        (payload) => {
          console.log('📱 REAL-TIME: Device change detected:', payload.eventType)
          
          // Check if this is a verification update (is_verified changed to true)
          if (payload.eventType === 'UPDATE' && payload.new?.is_verified === true && payload.old?.is_verified === false) {
            console.log('✅ REAL-TIME: Device verification detected! Refreshing wearers...')
          }
          
          loadWearers()
        }
      )
      .subscribe((status) => {
        console.log('📱 Devices subscription status:', status)
      })

    return () => {
      console.log('🔕 Cleaning up real-time subscriptions')
      supabase.removeChannel(testChannel)
      supabase.removeChannel(wearersSubscription)
      supabase.removeChannel(devicesSubscription)
    }
  }, [userProfile?.safeloop_account_id])

  if (loading) {
    return (
      <View style={styles.container}>
        <View style={styles.header}>
          <TouchableOpacity 
            style={styles.backButton} 
            onPress={() => navigation.goBack()}
          >
            <Text style={styles.backButtonText}>‹ Back</Text>
          </TouchableOpacity>
          <Text style={styles.title}>Wearers</Text>
        </View>
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color="#2196F3" />
          <Text style={styles.loadingText}>Loading wearers...</Text>
        </View>
      </View>
    )
  }

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <TouchableOpacity 
          style={styles.backButton} 
          onPress={() => navigation.goBack()}
        >
          <Text style={styles.backButtonText}>‹ Back</Text>
        </TouchableOpacity>
        <Text style={styles.title}>Wearers</Text>
      </View>

      <ScrollView 
        style={styles.content}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={handleRefresh} />
        }
      >
        <TouchableOpacity 
          style={styles.addButton}
          onPress={() => navigation.navigate('RegisterWearer')}
        >
          <Text style={styles.addButtonIcon}>+</Text>
          <Text style={styles.addButtonText}>Register New Wearer</Text>
        </TouchableOpacity>



        {wearers.length === 0 ? (
          <View style={styles.emptyContainer}>
            <Text style={styles.emptyIcon}>⌚</Text>
            <Text style={styles.emptyTitle}>No Wearers Registered</Text>
            <Text style={styles.emptyDescription}>
              Tap "Register New Wearer" to add someone who will use a SafeLoop Watch.
            </Text>
          </View>
        ) : (
          wearers.map((wearer) => {
            const deviceStatus = getDeviceStatus(wearer.device)
            return (
              <View key={wearer.id} style={styles.wearerCard}>
                <View style={styles.wearerInfo}>
                  <Text style={styles.wearerName}>{wearer.name}</Text>
                  {wearer.date_of_birth && (
                    <Text style={styles.wearerDetail}>
                      Born: {new Date(wearer.date_of_birth).toLocaleDateString()}
                    </Text>
                  )}
                  {wearer.device && wearer.device.length > 0 && (
                    <Text style={styles.wearerDetail}>
                      Device: {wearer.device[0].seven_digit_code}
                    </Text>
                  )}
                  <View style={styles.statusContainer}>
                    <View style={[styles.statusDot, { backgroundColor: deviceStatus.color }]} />
                    <Text style={[styles.statusText, { color: deviceStatus.color }]}>
                      {deviceStatus.text}
                    </Text>
                    {wearer.device && wearer.device.length > 0 && wearer.device[0].last_seen && (
                      <Text style={styles.lastSeenText}>
                        • Last seen: {formatLastSeen(wearer.device[0].last_seen)}
                      </Text>
                    )}
                  </View>
                </View>
                
                <View style={styles.actionButtons}>
                  <TouchableOpacity 
                    style={styles.editButton}
                    onPress={() => navigation.navigate('EditWearer', { wearerId: wearer.id })}
                  >
                    <Text style={styles.editButtonText}>Edit</Text>
                  </TouchableOpacity>
                  
                  <TouchableOpacity 
                    style={styles.deleteButton}
                    onPress={() => handleDeleteWearer(wearer)}
                  >
                    <Text style={styles.deleteButtonText}>Remove</Text>
                  </TouchableOpacity>
                </View>
              </View>
            )
          })
        )}
      </ScrollView>
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
  },
  backButton: {
    marginRight: 15,
  },
  backButtonText: {
    color: 'white',
    fontSize: 24,
    fontWeight: '600',
  },
  title: {
    fontSize: 20,
    fontWeight: 'bold',
    color: 'white',
  },
  content: {
    flex: 1,
    padding: 20,
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  loadingText: {
    marginTop: 10,
    color: '#666',
    fontSize: 16,
  },
  addButton: {
    backgroundColor: '#4CAF50',
    padding: 20,
    borderRadius: 12,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 20,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 3.84,
    elevation: 5,
  },
  addButtonIcon: {
    color: 'white',
    fontSize: 24,
    fontWeight: 'bold',
    marginRight: 10,
  },
  addButtonText: {
    color: 'white',
    fontSize: 18,
    fontWeight: '600',
  },
  emptyContainer: {
    alignItems: 'center',
    padding: 40,
    marginTop: 40,
  },
  emptyIcon: {
    fontSize: 64,
    marginBottom: 20,
  },
  emptyTitle: {
    fontSize: 20,
    fontWeight: '600',
    color: '#333',
    marginBottom: 10,
  },
  emptyDescription: {
    fontSize: 16,
    color: '#666',
    textAlign: 'center',
    lineHeight: 24,
  },
  wearerCard: {
    backgroundColor: 'white',
    borderRadius: 12,
    padding: 16,
    marginBottom: 12,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 3.84,
    elevation: 5,
  },
  wearerInfo: {
    marginBottom: 15,
  },
  wearerName: {
    fontSize: 18,
    fontWeight: '600',
    color: '#333',
    marginBottom: 4,
  },
  wearerDetail: {
    fontSize: 14,
    color: '#666',
    marginBottom: 2,
  },
  statusContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 8,
  },
  statusDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    marginRight: 6,
  },
  statusText: {
    fontSize: 14,
    fontWeight: '600',
  },
  lastSeenText: {
    fontSize: 12,
    color: '#999',
    marginLeft: 8,
  },
  actionButtons: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
  },
  editButton: {
    backgroundColor: '#2196F3',
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 6,
    marginRight: 8,
  },
  editButtonText: {
    color: 'white',
    fontSize: 14,
    fontWeight: '600',
  },
  deleteButton: {
    backgroundColor: '#f44336',
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 6,
  },
  deleteButtonText: {
    color: 'white',
    fontSize: 14,
    fontWeight: '600',
  },
})