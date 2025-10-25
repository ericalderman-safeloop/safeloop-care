import React, { useState, useEffect } from 'react'
import { View, Text, StyleSheet, TouchableOpacity, Alert, ScrollView, ActivityIndicator } from 'react-native'
import { useAuth } from '../contexts/AuthContext'
import { signOut } from '../lib/auth'
import { userService, HelpRequest } from '../lib/userService'
import { supabase } from '../lib/supabase'

interface HomeScreenProps {
  navigation: any
}

export default function HomeScreen({ navigation }: HomeScreenProps) {
  const { userProfile } = useAuth()
  const [activeTab, setActiveTab] = useState<'active' | 'history'>('active')
  const [activeRequests, setActiveRequests] = useState<HelpRequest[]>([])
  const [resolvedRequests, setResolvedRequests] = useState<HelpRequest[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    if (userProfile?.safeloop_account_id) {
      loadHelpRequests()
      setupRealtimeSubscription()
    }
  }, [userProfile?.safeloop_account_id])

  const loadHelpRequests = async () => {
    if (!userProfile?.safeloop_account_id) return

    try {
      const [active, resolved] = await Promise.all([
        userService.getActiveHelpRequests(userProfile.safeloop_account_id),
        userService.getResolvedHelpRequests(userProfile.safeloop_account_id)
      ])
      setActiveRequests(active)
      setResolvedRequests(resolved)
    } catch (error) {
      console.error('Error loading help requests:', error)
    } finally {
      setLoading(false)
    }
  }

  const setupRealtimeSubscription = () => {
    if (!userProfile?.safeloop_account_id) return

    const subscription = supabase
      .channel('help-requests-realtime')
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'help_requests'
        },
        (payload) => {
          console.log('Help request change detected:', payload.eventType)
          loadHelpRequests()
        }
      )
      .subscribe((status) => {
        console.log('Help requests subscription status:', status)
      })

    return () => {
      subscription.unsubscribe()
    }
  }

  const handleSignOut = async () => {
    try {
      await signOut()
    } catch (error) {
      Alert.alert('Error', 'Failed to sign out')
    }
  }

  const handleResolveAlert = async (helpRequestId: string) => {
    if (!userProfile?.id) return

    Alert.alert(
      'Resolve Alert',
      'How would you like to resolve this alert?',
      [
        {
          text: 'Mark as Resolved',
          onPress: async () => {
            try {
              await userService.updateHelpRequestStatus(helpRequestId, 'resolved', userProfile.id)
              Alert.alert('Success', 'Alert marked as resolved')
            } catch (error) {
              Alert.alert('Error', 'Failed to update alert status')
            }
          }
        },
        {
          text: 'Mark as False Alarm',
          onPress: async () => {
            try {
              await userService.updateHelpRequestStatus(helpRequestId, 'false_alarm', userProfile.id)
              Alert.alert('Success', 'Alert marked as false alarm')
            } catch (error) {
              Alert.alert('Error', 'Failed to update alert status')
            }
          }
        },
        { text: 'Cancel', style: 'cancel' }
      ]
    )
  }

  const formatTime = (timestamp: string) => {
    const date = new Date(timestamp)
    const now = new Date()
    const isToday = date.toDateString() === now.toDateString()

    if (isToday) {
      return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
    } else {
      return date.toLocaleString([], {
        month: 'short',
        day: 'numeric',
        hour: '2-digit',
        minute: '2-digit'
      })
    }
  }

  const formatRequestType = (type: string) => {
    return type === 'fall' ? '🚨 Fall Detected' : '🆘 Help Requested'
  }

  if (loading) {
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
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color="#2196F3" />
        </View>
      </View>
    )
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

      <ScrollView style={styles.content}>
        <View style={styles.statusGrid}>
          <View style={styles.statusCard}>
            <Text style={[styles.statusNumber, activeRequests.length > 0 && styles.statusNumberAlert]}>
              {activeRequests.length}
            </Text>
            <Text style={styles.statusLabel}>Active Alerts</Text>
          </View>
        </View>

        {/* Tabs */}
        <View style={styles.tabContainer}>
          <TouchableOpacity
            style={[styles.tab, activeTab === 'active' && styles.tabActive]}
            onPress={() => setActiveTab('active')}
          >
            <Text style={[styles.tabText, activeTab === 'active' && styles.tabTextActive]}>
              Active ({activeRequests.length})
            </Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={[styles.tab, activeTab === 'history' && styles.tabActive]}
            onPress={() => setActiveTab('history')}
          >
            <Text style={[styles.tabText, activeTab === 'history' && styles.tabTextActive]}>
              History ({resolvedRequests.length})
            </Text>
          </TouchableOpacity>
        </View>

        {/* Active Tab */}
        {activeTab === 'active' && (
          <>
            {activeRequests.length === 0 ? (
              <View style={styles.alertCard}>
                <Text style={styles.alertTitle}>No Active Alerts</Text>
                <Text style={styles.alertDescription}>
                  All SafeLoop Watch devices are functioning normally
                </Text>
              </View>
            ) : (
              <>
                {activeRequests.map((request) => (
                  <View key={request.id} style={styles.helpRequestCard}>
                    <View style={styles.helpRequestHeader}>
                      <Text style={styles.helpRequestType}>
                        {formatRequestType(request.request_type)}
                      </Text>
                      <Text style={styles.helpRequestTime}>
                        {formatTime(request.created_at)}
                      </Text>
                    </View>

                    <Text style={styles.helpRequestWearer}>
                      {request.wearer?.name || 'Unknown Wearer'}
                    </Text>

                    {request.location_latitude && request.location_longitude && (
                      <Text style={styles.helpRequestLocation}>
                        📍 Location: {request.location_latitude.toFixed(4)}, {request.location_longitude.toFixed(4)}
                      </Text>
                    )}

                    <TouchableOpacity
                      style={styles.resolveButton}
                      onPress={() => handleResolveAlert(request.id)}
                    >
                      <Text style={styles.resolveButtonText}>Resolve Alert</Text>
                    </TouchableOpacity>
                  </View>
                ))}
              </>
            )}
          </>
        )}

        {/* History Tab */}
        {activeTab === 'history' && (
          <>
            {resolvedRequests.length === 0 ? (
              <View style={styles.alertCard}>
                <Text style={styles.alertTitle}>No History</Text>
                <Text style={styles.alertDescription}>
                  No resolved help requests yet
                </Text>
              </View>
            ) : (
              <>
                {resolvedRequests.map((request) => (
                  <View key={request.id} style={styles.resolvedRequestCard}>
                    <View style={styles.helpRequestHeader}>
                      <Text style={styles.resolvedRequestType}>
                        {formatRequestType(request.request_type)}
                      </Text>
                      <Text style={styles.helpRequestTime}>
                        {formatTime(request.created_at)}
                      </Text>
                    </View>

                    <Text style={styles.helpRequestWearer}>
                      {request.wearer?.name || 'Unknown Wearer'}
                    </Text>

                    <View style={styles.statusBadge}>
                      <Text style={styles.statusBadgeText}>
                        {request.event_status === 'false_alarm' ? '⚠️ False Alarm' : '✅ Resolved'}
                      </Text>
                    </View>

                    {request.resolved_at && (
                      <Text style={styles.resolvedTime}>
                        Resolved: {formatTime(request.resolved_at)}
                      </Text>
                    )}

                    {request.notes && (
                      <Text style={styles.notes}>
                        Notes: {request.notes}
                      </Text>
                    )}
                  </View>
                ))}
              </>
            )}
          </>
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
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  statusNumberAlert: {
    color: '#f44336',
  },
  sectionTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#333',
    marginBottom: 15,
    marginTop: 10,
  },
  helpRequestCard: {
    backgroundColor: '#fff3e0',
    borderLeftWidth: 4,
    borderLeftColor: '#ff9800',
    borderRadius: 12,
    padding: 16,
    marginBottom: 15,
    shadowColor: '#000',
    shadowOffset: {
      width: 0,
      height: 2,
    },
    shadowOpacity: 0.1,
    shadowRadius: 3.84,
    elevation: 5,
  },
  helpRequestHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 10,
  },
  helpRequestType: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#e65100',
  },
  helpRequestTime: {
    fontSize: 14,
    color: '#666',
  },
  helpRequestWearer: {
    fontSize: 16,
    fontWeight: '600',
    color: '#333',
    marginBottom: 8,
  },
  helpRequestLocation: {
    fontSize: 14,
    color: '#555',
    marginBottom: 12,
  },
  resolveButton: {
    backgroundColor: '#4CAF50',
    borderRadius: 8,
    padding: 12,
    alignItems: 'center',
  },
  resolveButtonText: {
    color: 'white',
    fontSize: 16,
    fontWeight: '600',
  },
  tabContainer: {
    flexDirection: 'row',
    marginBottom: 20,
    borderRadius: 8,
    backgroundColor: '#e0e0e0',
    padding: 4,
  },
  tab: {
    flex: 1,
    paddingVertical: 12,
    alignItems: 'center',
    borderRadius: 6,
  },
  tabActive: {
    backgroundColor: 'white',
    shadowColor: '#000',
    shadowOffset: {
      width: 0,
      height: 1,
    },
    shadowOpacity: 0.1,
    shadowRadius: 2,
    elevation: 2,
  },
  tabText: {
    fontSize: 16,
    color: '#666',
    fontWeight: '500',
  },
  tabTextActive: {
    color: '#2196F3',
    fontWeight: '600',
  },
  resolvedRequestCard: {
    backgroundColor: '#f5f5f5',
    borderLeftWidth: 4,
    borderLeftColor: '#9e9e9e',
    borderRadius: 12,
    padding: 16,
    marginBottom: 15,
    shadowColor: '#000',
    shadowOffset: {
      width: 0,
      height: 2,
    },
    shadowOpacity: 0.05,
    shadowRadius: 3.84,
    elevation: 3,
  },
  resolvedRequestType: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#666',
  },
  statusBadge: {
    backgroundColor: '#e8f5e9',
    borderRadius: 6,
    paddingHorizontal: 12,
    paddingVertical: 6,
    alignSelf: 'flex-start',
    marginVertical: 8,
  },
  statusBadgeText: {
    fontSize: 14,
    fontWeight: '600',
    color: '#4CAF50',
  },
  resolvedTime: {
    fontSize: 14,
    color: '#666',
    marginTop: 4,
  },
  notes: {
    fontSize: 14,
    color: '#555',
    marginTop: 8,
    fontStyle: 'italic',
  },
})