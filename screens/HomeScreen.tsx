import React, { useState, useEffect, useCallback } from 'react'
import { View, Text, StyleSheet, TouchableOpacity, Alert, ScrollView, ActivityIndicator, Linking } from 'react-native'
import { useAuth } from '../contexts/AuthContext'
import { userService, HelpRequest } from '../lib/userService'
import { supabase } from '../lib/supabase'
import { AppNavigationProp } from '../types/navigation'

interface HomeScreenProps {
  navigation: AppNavigationProp
}

export default function HomeScreen({ navigation }: HomeScreenProps) {
  const { userProfile } = useAuth()
  const [activeTab, setActiveTab] = useState<'active' | 'history'>('active')
  const [activeRequests, setActiveRequests] = useState<HelpRequest[]>([])
  const [resolvedRequests, setResolvedRequests] = useState<HelpRequest[]>([])
  const [loading, setLoading] = useState(true)

  const loadHelpRequests = useCallback(async () => {
    if (!userProfile?.safeloop_account_id) return

    try {
      const isAdmin = userProfile.user_type === 'caregiver_admin'
      const [active, resolved] = await Promise.all([
        isAdmin
          ? userService.getActiveHelpRequests(userProfile.safeloop_account_id)
          : userService.getActiveHelpRequestsForCaregiver(userProfile.id),
        isAdmin
          ? userService.getResolvedHelpRequests(userProfile.safeloop_account_id)
          : userService.getResolvedHelpRequestsForCaregiver(userProfile.id)
      ])
      setActiveRequests(active)
      setResolvedRequests(resolved)
    } catch (error) {
      console.error('Error loading help requests:', error)
    } finally {
      setLoading(false)
    }
  }, [userProfile])

  useEffect(() => {
    if (!userProfile?.safeloop_account_id) return
    loadHelpRequests()
  }, [userProfile])

  useEffect(() => {
    if (!userProfile?.safeloop_account_id) return

    const channel = supabase
      .channel(`help-requests-${userProfile.safeloop_account_id}`)
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'help_requests' },
        () => { loadHelpRequests() }
      )
      .subscribe()

    return () => { supabase.removeChannel(channel) }
  }, [userProfile?.safeloop_account_id])

  useEffect(() => {
    const unsubscribe = navigation.addListener('focus', () => {
      if (userProfile?.safeloop_account_id) {
        loadHelpRequests()
      }
    })
    return unsubscribe
  }, [navigation, loadHelpRequests])

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

  const parseNotesLogEntries = (notes: string) => {
    const autoPrefix = notes.split('\n\n')[0] || ''
    const caregiverText = notes.split('\n\n').slice(1).join('\n\n').trim()
    const lines = autoPrefix.split('\n').filter(l => l.trim())
    const entries: { type: string; text: string; url?: string }[] = []
    let i = 0
    while (i < lines.length) {
      const line = lines[i]
      if (line.startsWith('Wearer located at:')) {
        const nextLine = lines[i + 1]
        const url = nextLine?.startsWith('https://') ? nextLine : undefined
        entries.push({ type: 'location', text: line.replace('Wearer located at: ', ''), url })
        i += url ? 2 : 1
      } else if (line.startsWith('https://')) {
        i++
      } else if (line.includes('responded to the help request')) {
        entries.push({ type: 'responder', text: line })
        i++
      } else {
        entries.push({ type: 'event', text: line })
        i++
      }
    }
    return { entries, caregiverText }
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
                  No SafeLoop Watch Wearers currently have any active help alerts.
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
                    {request.event_status === 'responded_to' && (
                      <Text style={styles.helpRequestResponder}>
                        👤 Being assisted by {request.responder?.display_name || 'a caregiver'}
                      </Text>
                    )}

                    <Text style={styles.helpRequestWearer}>
                      {request.wearer?.name || 'Unknown Wearer'}
                    </Text>

                    <TouchableOpacity
                      style={[
                        styles.assistButton,
                        request.event_status === 'responded_to' && styles.viewButton
                      ]}
                      onPress={async () => {
                        if (request.event_status === 'active' && userProfile?.id) {
                          await userService.updateHelpRequestStatus(request.id, 'responded_to', userProfile.id)
                        }
                        navigation.navigate('HelpRequestDetail', { helpRequestId: request.id })
                      }}
                    >
                      <Text style={styles.assistButtonText}>
                        {request.event_status === 'responded_to' ? 'View Help Request' : 'Provide Assistance'}
                      </Text>
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
                {resolvedRequests.map((request) => {
                  const isFalseAlarm = request.event_status === 'false_alarm'
                  const { entries, caregiverText } = request.notes
                    ? parseNotesLogEntries(request.notes)
                    : { entries: [], caregiverText: '' }
                  return (
                    <View
                      key={request.id}
                      style={[styles.resolvedRequestCard, isFalseAlarm && styles.resolvedRequestCardFalseAlarm]}
                    >
                      {/* Header */}
                      <View style={styles.historyCardHeader}>
                        <View style={styles.historyCardHeaderLeft}>
                          <Text style={styles.historyRequestType}>
                            {formatRequestType(request.request_type)}
                          </Text>
                          <Text style={styles.historyWearerName}>
                            {request.wearer?.name || 'Unknown Wearer'}
                          </Text>
                        </View>
                        <View style={[styles.statusBadge, isFalseAlarm && styles.statusBadgeFalseAlarm]}>
                          <Text style={[styles.statusBadgeText, isFalseAlarm && styles.statusBadgeTextFalseAlarm]}>
                            {isFalseAlarm ? '⚠️ False Alarm' : '✅ Resolved'}
                          </Text>
                        </View>
                      </View>

                      {/* Timeline entries + resolution as unified log */}
                      <View style={styles.historyLogSection}>
                        {entries.map((entry, idx) => (
                          <View key={idx} style={styles.historyLogEntry}>
                            <Text style={styles.historyLogIcon}>
                              {entry.type === 'event' ? '🚨' : entry.type === 'location' ? '📍' : '👤'}
                            </Text>
                            <View style={styles.historyLogBody}>
                              <Text style={styles.historyLogText}>{entry.text}</Text>
                              {entry.url && entry.type === 'location' && (
                                <TouchableOpacity onPress={() => Linking.openURL(entry.url!)}>
                                  <Text style={styles.historyLogLink}>View on Google Maps →</Text>
                                </TouchableOpacity>
                              )}
                            </View>
                          </View>
                        ))}

                        {/* Resolution entry */}
                        {(request.resolver?.display_name || request.resolved_at) && (
                          <View style={styles.historyLogEntry}>
                            <Text style={styles.historyLogIcon}>
                              {isFalseAlarm ? '⚠️' : '✅'}
                            </Text>
                            <View style={styles.historyLogBody}>
                              <Text style={styles.historyLogText}>
                                {request.resolver?.display_name
                                  ? `${isFalseAlarm ? 'Marked as False Alarm' : 'Resolved'} by ${request.resolver.display_name}`
                                  : isFalseAlarm ? 'Marked as False Alarm' : 'Resolved'}
                              </Text>
                              {request.resolved_at && (
                                <Text style={styles.historyLogMeta}>{formatTime(request.resolved_at)}</Text>
                              )}
                            </View>
                          </View>
                        )}
                      </View>

                      {/* Caregiver notes */}
                      {caregiverText.length > 0 && (
                        <View style={styles.historyCaregiverNotes}>
                          <Text style={styles.historyCaregiverNotesLabel}>Notes</Text>
                          <Text style={styles.historyCaregiverNotesText}>{caregiverText}</Text>
                        </View>
                      )}

                    </View>
                  )
                })}
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
    fontSize: 16,
    fontWeight: 'bold',
    color: '#e65100',
    flex: 1,
    marginRight: 8,
  },
  helpRequestTime: {
    fontSize: 13,
    color: '#666',
    flexShrink: 0,
  },
  helpRequestResponder: {
    fontSize: 13,
    color: '#e65100',
    marginBottom: 6,
    marginTop: -4,
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
  assistButton: {
    backgroundColor: '#f44336',
    borderRadius: 8,
    padding: 12,
    alignItems: 'center',
  },
  viewButton: {
    backgroundColor: '#2196F3',
  },
  assistButtonText: {
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
    backgroundColor: 'white',
    borderLeftWidth: 4,
    borderLeftColor: '#4CAF50',
    borderRadius: 12,
    padding: 16,
    marginBottom: 15,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.08,
    shadowRadius: 3.84,
    elevation: 3,
  },
  resolvedRequestCardFalseAlarm: {
    borderLeftColor: '#ff9800',
  },
  historyCardHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: 12,
  },
  historyCardHeaderLeft: {
    flex: 1,
    marginRight: 10,
  },
  historyRequestType: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#333',
    marginBottom: 2,
  },
  historyWearerName: {
    fontSize: 15,
    fontWeight: '600',
    color: '#555',
  },
  statusBadge: {
    backgroundColor: '#e8f5e9',
    borderRadius: 6,
    paddingHorizontal: 10,
    paddingVertical: 5,
    alignSelf: 'flex-start',
  },
  statusBadgeFalseAlarm: {
    backgroundColor: '#fff3e0',
  },
  statusBadgeText: {
    fontSize: 13,
    fontWeight: '600',
    color: '#4CAF50',
  },
  statusBadgeTextFalseAlarm: {
    color: '#e65100',
  },
  historyLogSection: {
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: '#eeeeee',
    paddingTop: 10,
    marginBottom: 10,
    gap: 8,
  },
  historyLogEntry: {
    flexDirection: 'row',
    alignItems: 'flex-start',
  },
  historyLogIcon: {
    fontSize: 14,
    marginRight: 7,
    marginTop: 1,
  },
  historyLogBody: {
    flex: 1,
  },
  historyLogText: {
    fontSize: 13,
    color: '#444',
    lineHeight: 18,
  },
  historyLogLink: {
    fontSize: 12,
    color: '#2196F3',
    marginTop: 2,
  },
  historyLogMeta: {
    fontSize: 12,
    color: '#888',
    marginTop: 2,
  },
  historyCaregiverNotes: {
    backgroundColor: '#fafafa',
    borderRadius: 6,
    padding: 10,
    marginTop: 8,
    borderWidth: 1,
    borderColor: '#eeeeee',
  },
  historyCaregiverNotesLabel: {
    fontSize: 11,
    fontWeight: '700',
    color: '#999',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
    marginBottom: 4,
  },
  historyCaregiverNotesText: {
    fontSize: 13,
    color: '#444',
    lineHeight: 18,
  },
})