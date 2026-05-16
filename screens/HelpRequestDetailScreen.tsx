import React, { useState, useEffect } from 'react'
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, Alert, TextInput, Linking, ActivityIndicator, KeyboardAvoidingView, Platform, Modal } from 'react-native'
import MapView, { Marker } from 'react-native-maps'
import { useAuth } from '../contexts/AuthContext'
import { userService, HelpRequest, NotesLogEntry } from '../lib/userService'
import { supabase } from '../lib/supabase'

interface HelpRequestDetailScreenProps {
  navigation: any
  route: {
    params: {
      helpRequestId: string
    }
  }
}

interface LocationUpdate {
  latitude: number
  longitude: number
  accuracy?: number
  timestamp: string
}

export default function HelpRequestDetailScreen({ navigation, route }: HelpRequestDetailScreenProps) {
  const { userProfile } = useAuth()
  const [helpRequest, setHelpRequest] = useState<HelpRequest | null>(null)
  const [loading, setLoading] = useState(true)
  const [notes, setNotes] = useState('')
  const [saving, setSaving] = useState(false)
  const [currentLocation, setCurrentLocation] = useState<LocationUpdate | null>(null)
  const [notesLog, setNotesLog] = useState<NotesLogEntry[]>([])
  const [showChangeLog, setShowChangeLog] = useState(false)
  const [selectedLogEntry, setSelectedLogEntry] = useState<NotesLogEntry | null>(null)

  useEffect(() => {
    loadHelpRequest()
  }, [route.params.helpRequestId])

  useEffect(() => {
    if (!route.params.helpRequestId) return

    const statusChannel = supabase
      .channel(`help-request-status-${route.params.helpRequestId}`)
      .on(
        'postgres_changes',
        {
          event: 'UPDATE',
          schema: 'public',
          table: 'help_requests',
          filter: `id=eq.${route.params.helpRequestId}`
        },
        (payload) => {
          const newStatus = payload.new.event_status
          if (newStatus === 'resolved' || newStatus === 'false_alarm') {
            const message = newStatus === 'false_alarm'
              ? 'This alert was cancelled — false alarm.'
              : 'This alert has been resolved.'
            Alert.alert('Alert Resolved', message, [
              { text: 'OK', onPress: () => navigation.navigate('Home') }
            ])
          }
        }
      )
      .subscribe()

    return () => {
      supabase.removeChannel(statusChannel)
    }
  }, [route.params.helpRequestId])

  useEffect(() => {
    if (!route.params.helpRequestId) return

    const channelName = `location-updates-${route.params.helpRequestId}`

    const locationChannel = supabase
      .channel(channelName)
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'location_updates',
          filter: `help_request_id=eq.${route.params.helpRequestId}`
        },
        (payload) => {
          setCurrentLocation({
            latitude: Number(payload.new.latitude),
            longitude: Number(payload.new.longitude),
            accuracy: payload.new.accuracy ? Number(payload.new.accuracy) : undefined,
            timestamp: payload.new.timestamp
          })
        }
      )
      .subscribe()

    return () => {
      supabase.removeChannel(locationChannel)
    }
  }, [route.params.helpRequestId])

  const buildRequestSentence = (request: HelpRequest): string => {
    const wearerName = request.wearer?.name || 'The wearer'
    const timeStr = new Date(request.created_at).toLocaleString([], {
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    })

    if (request.request_type === 'manual_request') {
      return `${wearerName} manually requested help at ${timeStr}`
    }

    // fall
    if (request.fall_response === 'confirmed') {
      return `Fall detected for ${wearerName} at ${timeStr}, confirmed by user`
    } else if (request.fall_response === 'unresponsive') {
      return `Fall detected for ${wearerName} at ${timeStr}, user was unresponsive`
    }
    return `Fall detected for ${wearerName} at ${timeStr}`
  }

  const buildFormattedNotes = (request: HelpRequest): string => {
    const rawNotes = request.notes || ''

    // Already formatted — return as-is
    if (
      rawNotes.includes(' manually requested help at ') ||
      rawNotes.includes('Fall detected for ')
    ) {
      return rawNotes
    }

    const parts: string[] = []

    parts.push(buildRequestSentence(request))

    const placeName = rawNotes.trim()
    if (placeName) {
      parts.push(`Wearer located at: ${placeName}`)
    }

    if (request.location_latitude && request.location_longitude) {
      parts.push(`https://www.google.com/maps/search/?api=1&query=${request.location_latitude},${request.location_longitude}`)
    }

    if (request.responder?.display_name && request.responded_at) {
      const respondedTime = new Date(request.responded_at).toLocaleString([], {
        month: 'short',
        day: 'numeric',
        hour: '2-digit',
        minute: '2-digit'
      })
      parts.push(`${request.responder.display_name} responded to the help request at ${respondedTime}`)
    }

    return parts.join('\n') + '\n\n'
  }

  const loadNotesLog = async (helpRequestId: string) => {
    try {
      const log = await userService.getNotesLog(helpRequestId)
      setNotesLog(log)
    } catch (error) {
      console.error('Error loading notes log:', error)
    }
  }

  const loadHelpRequest = async () => {
    try {
      const data = await userService.getHelpRequestDetails(route.params.helpRequestId)
      if (data) {
        setHelpRequest(data)
        const formattedNotes = buildFormattedNotes(data)
        setNotes(formattedNotes)
        if (formattedNotes !== (data.notes || '')) {
          await userService.updateHelpRequestNotes(data.id, formattedNotes)
          await userService.logNotesChange(data.id, formattedNotes, null, 'System')
        }
        loadNotesLog(data.id)
      } else {
        Alert.alert('Error', 'Help request not found')
        navigation.goBack()
      }
    } catch (error) {
      console.error('Error loading help request:', error)
      Alert.alert('Error', 'Failed to load help request details')
    } finally {
      setLoading(false)
    }
  }

  const handleCallWearer = () => {
    const phoneNumber = helpRequest?.wearer?.wearer_contact_phone
    if (!phoneNumber) {
      Alert.alert('No Contact', 'No contact phone number available for this wearer')
      return
    }
    Linking.openURL(`tel:${phoneNumber}`)
  }

  const handleSaveNotes = async () => {
    if (!helpRequest?.id) return

    setSaving(true)
    try {
      await userService.updateHelpRequestNotes(helpRequest.id, notes)
      await userService.logNotesChange(
        helpRequest.id,
        notes,
        userProfile?.id || null,
        userProfile?.display_name || 'Unknown Caregiver'
      )
      Alert.alert('Success', 'Notes saved successfully')
      loadHelpRequest()
    } catch (error) {
      console.error('Error saving notes:', error)
      Alert.alert('Error', 'Failed to save notes')
    } finally {
      setSaving(false)
    }
  }

  const handleResolve = async () => {
    if (!userProfile?.id || !helpRequest?.id) return

    Alert.alert(
      'Resolve Alert',
      'How would you like to resolve this alert?',
      [
        {
          text: 'Mark as Resolved',
          onPress: async () => {
            try {
              await userService.updateHelpRequestStatus(
                helpRequest.id,
                'resolved',
                userProfile.id,
                notes
              )
              Alert.alert('Success', 'Alert marked as resolved', [
                { text: 'OK', onPress: () => navigation.goBack() }
              ])
            } catch (error) {
              Alert.alert('Error', 'Failed to update alert status')
            }
          }
        },
        {
          text: 'Mark as False Alarm',
          onPress: async () => {
            try {
              await userService.updateHelpRequestStatus(
                helpRequest.id,
                'false_alarm',
                userProfile.id,
                notes
              )
              Alert.alert('Success', 'Alert marked as false alarm', [
                { text: 'OK', onPress: () => navigation.goBack() }
              ])
            } catch (error) {
              Alert.alert('Error', 'Failed to update alert status')
            }
          }
        },
        { text: 'Cancel', style: 'cancel' }
      ]
    )
  }

  const openInMaps = () => {
    if (!helpRequest?.location_latitude || !helpRequest?.location_longitude) {
      Alert.alert('No Location', 'Location data not available for this request')
      return
    }

    const lat = currentLocation ? currentLocation.latitude : helpRequest.location_latitude
    const lng = currentLocation ? currentLocation.longitude : helpRequest.location_longitude
    const url = `https://www.google.com/maps/search/?api=1&query=${lat},${lng}`
    Linking.openURL(url)
  }

  const formatTime = (timestamp: string) => {
    const date = new Date(timestamp)
    return date.toLocaleString([], {
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    })
  }

  if (loading) {
    return (
      <View style={styles.container}>
        <View style={styles.header}>
          <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backButton}>
            <Text style={styles.backButtonText}>← Back</Text>
          </TouchableOpacity>
          <Text style={styles.title}>Help Request Details</Text>
        </View>
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color="#2196F3" />
        </View>
      </View>
    )
  }

  if (!helpRequest) {
    return null
  }

  const requestType = helpRequest.event_status === 'responded_to'
    ? `👤 Being Assisted by ${helpRequest.responder?.display_name || 'a caregiver'}`
    : helpRequest.request_type === 'fall' ? '🚨 Fall Detected' : '🆘 Help Requested'

  return (
    <KeyboardAvoidingView
      style={styles.container}
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
      keyboardVerticalOffset={0}
    >
      <View style={styles.header}>
        <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backButton}>
          <Text style={styles.backButtonText}>← Back</Text>
        </TouchableOpacity>
        <Text style={styles.title}>Help Request Details</Text>
      </View>

      <ScrollView style={styles.content}>
        {/* Alert Type Banner */}
        <View style={styles.alertBanner}>
          <Text style={styles.alertType}>{requestType}</Text>
          <Text style={styles.alertTime}>{formatTime(helpRequest.created_at)}</Text>
          <Text style={styles.requestSentence}>{buildRequestSentence(helpRequest)}</Text>
        </View>

        {/* Wearer Information */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Wearer Information</Text>
          <View style={styles.infoCard}>
            <Text style={styles.wearerName}>{helpRequest.wearer?.name}</Text>
            {helpRequest.wearer?.date_of_birth && (
              <Text style={styles.infoText}>DOB: {new Date(helpRequest.wearer.date_of_birth).toLocaleDateString()}</Text>
            )}
            {helpRequest.wearer?.gender && (
              <Text style={styles.infoText}>Gender: {helpRequest.wearer.gender}</Text>
            )}
          </View>
        </View>

        {/* Medical Information */}
        {(helpRequest.wearer?.medical_conditions?.length ||
          helpRequest.wearer?.medications?.length ||
          helpRequest.wearer?.allergies?.length ||
          helpRequest.wearer?.emergency_notes) && (
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Medical Information</Text>
            <View style={styles.infoCard}>
              {helpRequest.wearer?.medical_conditions && helpRequest.wearer.medical_conditions.length > 0 && (
                <View style={styles.medicalItem}>
                  <Text style={styles.medicalLabel}>Conditions:</Text>
                  <Text style={styles.medicalText}>{helpRequest.wearer.medical_conditions.join(', ')}</Text>
                </View>
              )}
              {helpRequest.wearer?.medications && helpRequest.wearer.medications.length > 0 && (
                <View style={styles.medicalItem}>
                  <Text style={styles.medicalLabel}>Medications:</Text>
                  <Text style={styles.medicalText}>{helpRequest.wearer.medications.join(', ')}</Text>
                </View>
              )}
              {helpRequest.wearer?.allergies && helpRequest.wearer.allergies.length > 0 && (
                <View style={styles.medicalItem}>
                  <Text style={styles.medicalLabel}>Allergies:</Text>
                  <Text style={styles.medicalText}>{helpRequest.wearer.allergies.join(', ')}</Text>
                </View>
              )}
              {helpRequest.wearer?.emergency_notes && (
                <View style={styles.medicalItem}>
                  <Text style={styles.medicalLabel}>Emergency Notes:</Text>
                  <Text style={styles.medicalText}>{helpRequest.wearer.emergency_notes}</Text>
                </View>
              )}
            </View>
          </View>
        )}

        {/* Contact Wearer */}
        {helpRequest.wearer?.wearer_contact_phone && (
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Contact Wearer</Text>
            <View style={styles.infoCard}>
              <Text style={styles.infoText}>{helpRequest.wearer.wearer_contact_phone}</Text>
              <TouchableOpacity style={styles.callButton} onPress={handleCallWearer}>
                <Text style={styles.callButtonText}>📞 Call {helpRequest.wearer.name}</Text>
              </TouchableOpacity>
            </View>
          </View>
        )}

        {/* Location */}
        {helpRequest.location_latitude &&
         helpRequest.location_longitude &&
         !isNaN(Number(helpRequest.location_latitude)) &&
         !isNaN(Number(helpRequest.location_longitude)) && (
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Location</Text>
            <View style={styles.mapContainer}>
              <MapView
                style={styles.map}
                region={{
                  latitude: currentLocation ? currentLocation.latitude : Number(helpRequest.location_latitude),
                  longitude: currentLocation ? currentLocation.longitude : Number(helpRequest.location_longitude),
                  latitudeDelta: 0.01,
                  longitudeDelta: 0.01,
                }}
                scrollEnabled={true}
                zoomEnabled={true}
                pitchEnabled={false}
                rotateEnabled={false}
              >
                <Marker
                  coordinate={{
                    latitude: Number(helpRequest.location_latitude),
                    longitude: Number(helpRequest.location_longitude),
                  }}
                  title={String(helpRequest.wearer?.name || 'Help Request')}
                  description="Initial location"
                  pinColor="blue"
                />
                {currentLocation && (
                  <Marker
                    coordinate={{
                      latitude: currentLocation.latitude,
                      longitude: currentLocation.longitude,
                    }}
                    title={String(helpRequest.wearer?.name || 'Wearer')}
                    description="Current location"
                    pinColor="red"
                  />
                )}
              </MapView>
              {(currentLocation?.accuracy || helpRequest.location_accuracy) && (
                <View style={styles.accuracyBadge}>
                  <Text style={styles.accuracyText}>
                    Accuracy: ±{Number(currentLocation?.accuracy || helpRequest.location_accuracy).toFixed(0)}m
                  </Text>
                  {currentLocation && (
                    <Text style={styles.liveIndicator}>🔴 LIVE</Text>
                  )}
                </View>
              )}
              <TouchableOpacity style={styles.mapButton} onPress={openInMaps}>
                <Text style={styles.mapButtonText}>Open in Google Maps</Text>
              </TouchableOpacity>
            </View>
          </View>
        )}

        {/* Assistance Notes */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Assistance Notes</Text>
          <View style={styles.infoCard}>
            <TextInput
              style={styles.notesInput}
              value={notes}
              onChangeText={setNotes}
              placeholder="Document the assistance provided, situation details, or follow-up actions..."
              multiline
              numberOfLines={6}
              textAlignVertical="top"
            />
            <TouchableOpacity
              style={[styles.saveButton, saving && styles.saveButtonDisabled]}
              onPress={handleSaveNotes}
              disabled={saving}
            >
              <Text style={styles.saveButtonText}>
                {saving ? 'Saving...' : 'Save Notes'}
              </Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={styles.changeLogButton}
              onPress={() => {
                setSelectedLogEntry(null)
                setShowChangeLog(true)
              }}
            >
              <Text style={styles.changeLogButtonText}>
                Change Log{notesLog.length > 0 ? ` (${notesLog.length})` : ''}
              </Text>
            </TouchableOpacity>
          </View>
        </View>

        {/* Resolve Button */}
        {(helpRequest.event_status === 'active' || helpRequest.event_status === 'responded_to') && (
          <TouchableOpacity style={styles.resolveButton} onPress={handleResolve}>
            <Text style={styles.resolveButtonText}>Resolve Alert</Text>
          </TouchableOpacity>
        )}

        {(helpRequest.event_status === 'resolved' || helpRequest.event_status === 'false_alarm') && (
          <View style={styles.resolvedBanner}>
            <Text style={styles.resolvedText}>
              {helpRequest.event_status === 'false_alarm' ? '⚠️ Marked as False Alarm' : '✅ Resolved'}
            </Text>
            {helpRequest.resolved_at && (
              <Text style={styles.resolvedTime}>
                {formatTime(helpRequest.resolved_at)}
              </Text>
            )}
          </View>
        )}
      </ScrollView>

      {/* Change Log Modal */}
      <Modal
        visible={showChangeLog}
        animationType="slide"
        presentationStyle="pageSheet"
        onRequestClose={() => {
          if (selectedLogEntry) {
            setSelectedLogEntry(null)
          } else {
            setShowChangeLog(false)
          }
        }}
      >
        <View style={styles.modalContainer}>
          <View style={styles.modalHeader}>
            <Text style={styles.modalTitle}>
              {selectedLogEntry ? 'Version Details' : 'Change Log'}
            </Text>
            <TouchableOpacity
              onPress={() => {
                if (selectedLogEntry) {
                  setSelectedLogEntry(null)
                } else {
                  setShowChangeLog(false)
                }
              }}
            >
              <Text style={styles.modalDismiss}>
                {selectedLogEntry ? '← Back' : 'Close'}
              </Text>
            </TouchableOpacity>
          </View>

          {selectedLogEntry ? (
            <ScrollView style={styles.modalContent} contentContainerStyle={styles.modalContentPadded}>
              <View style={styles.logVersionMeta}>
                <Text style={styles.logVersionAuthor}>{selectedLogEntry.changed_by_display_name}</Text>
                <Text style={styles.logVersionTime}>{formatTime(selectedLogEntry.changed_at)}</Text>
              </View>
              <View style={styles.logVersionNotes}>
                <Text style={styles.logVersionNotesText}>
                  {selectedLogEntry.notes || '(empty)'}
                </Text>
              </View>
            </ScrollView>
          ) : (
            <ScrollView style={styles.modalContent}>
              {notesLog.length === 0 ? (
                <View style={styles.emptyLogContainer}>
                  <Text style={styles.emptyLogText}>No changes recorded yet</Text>
                </View>
              ) : (
                notesLog.map((entry, index) => (
                  <TouchableOpacity
                    key={entry.id}
                    style={styles.logEntryRow}
                    onPress={() => setSelectedLogEntry(entry)}
                  >
                    <View style={styles.logEntryInfo}>
                      <Text style={styles.logEntryAuthor}>
                        {entry.changed_by_display_name}
                        {index === 0 && (
                          <Text style={styles.logEntryOriginal}> · original</Text>
                        )}
                      </Text>
                      <Text style={styles.logEntryTime}>{formatTime(entry.changed_at)}</Text>
                    </View>
                    <Text style={styles.logEntryChevron}>›</Text>
                  </TouchableOpacity>
                ))
              )}
            </ScrollView>
          )}
        </View>
      </Modal>
    </KeyboardAvoidingView>
  )
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f5f5f5',
  },
  header: {
    backgroundColor: '#ff9800',
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
    fontSize: 16,
    fontWeight: '600',
  },
  title: {
    fontSize: 20,
    fontWeight: 'bold',
    color: 'white',
    flex: 1,
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  content: {
    flex: 1,
    padding: 20,
  },
  alertBanner: {
    backgroundColor: '#fff3e0',
    borderLeftWidth: 4,
    borderLeftColor: '#ff9800',
    borderRadius: 12,
    padding: 20,
    marginBottom: 20,
  },
  alertType: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#e65100',
    marginBottom: 4,
  },
  alertTime: {
    fontSize: 14,
    color: '#888',
    marginBottom: 8,
  },
  requestSentence: {
    fontSize: 15,
    color: '#555',
    fontStyle: 'italic',
  },
  section: {
    marginBottom: 20,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#333',
    marginBottom: 10,
  },
  infoCard: {
    backgroundColor: 'white',
    borderRadius: 12,
    padding: 16,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 3.84,
    elevation: 5,
  },
  wearerName: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#333',
    marginBottom: 8,
  },
  infoText: {
    fontSize: 16,
    color: '#555',
    marginBottom: 4,
  },
  medicalItem: {
    marginBottom: 12,
  },
  medicalLabel: {
    fontSize: 14,
    fontWeight: '600',
    color: '#666',
    marginBottom: 4,
  },
  medicalText: {
    fontSize: 16,
    color: '#333',
  },
  mapContainer: {
    backgroundColor: 'white',
    borderRadius: 12,
    overflow: 'hidden',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 3.84,
    elevation: 5,
  },
  map: {
    width: '100%',
    height: 300,
  },
  accuracyBadge: {
    position: 'absolute',
    top: 10,
    right: 10,
    backgroundColor: 'rgba(255, 255, 255, 0.9)',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 16,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.2,
    shadowRadius: 2,
    elevation: 3,
  },
  accuracyText: {
    fontSize: 12,
    fontWeight: '600',
    color: '#666',
  },
  liveIndicator: {
    fontSize: 10,
    fontWeight: 'bold',
    color: '#f44336',
    marginTop: 2,
  },
  mapButton: {
    backgroundColor: '#2196F3',
    padding: 12,
    alignItems: 'center',
  },
  mapButtonText: {
    color: 'white',
    fontSize: 16,
    fontWeight: '600',
  },
  callButton: {
    backgroundColor: '#4CAF50',
    borderRadius: 8,
    padding: 12,
    marginTop: 12,
    alignItems: 'center',
  },
  callButtonText: {
    color: 'white',
    fontSize: 16,
    fontWeight: '600',
  },
  notesInput: {
    borderWidth: 1,
    borderColor: '#ddd',
    borderRadius: 8,
    padding: 12,
    fontSize: 16,
    minHeight: 120,
    marginBottom: 12,
  },
  saveButton: {
    backgroundColor: '#2196F3',
    borderRadius: 8,
    padding: 12,
    alignItems: 'center',
    marginBottom: 10,
  },
  saveButtonDisabled: {
    backgroundColor: '#ccc',
  },
  saveButtonText: {
    color: 'white',
    fontSize: 16,
    fontWeight: '600',
  },
  changeLogButton: {
    alignItems: 'center',
    paddingVertical: 6,
  },
  changeLogButtonText: {
    fontSize: 14,
    color: '#2196F3',
    textDecorationLine: 'underline',
  },
  resolveButton: {
    backgroundColor: '#4CAF50',
    borderRadius: 12,
    padding: 16,
    alignItems: 'center',
    marginBottom: 20,
  },
  resolveButtonText: {
    color: 'white',
    fontSize: 18,
    fontWeight: 'bold',
  },
  resolvedBanner: {
    backgroundColor: '#e8f5e9',
    borderRadius: 12,
    padding: 16,
    alignItems: 'center',
    marginBottom: 20,
  },
  resolvedText: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#4CAF50',
    marginBottom: 4,
  },
  resolvedTime: {
    fontSize: 14,
    color: '#666',
  },
  // Modal styles
  modalContainer: {
    flex: 1,
    backgroundColor: '#f5f5f5',
  },
  modalHeader: {
    backgroundColor: '#ff9800',
    paddingTop: 60,
    paddingBottom: 20,
    paddingHorizontal: 20,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  modalTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    color: 'white',
  },
  modalDismiss: {
    fontSize: 16,
    color: 'white',
    fontWeight: '600',
  },
  modalContent: {
    flex: 1,
  },
  modalContentPadded: {
    padding: 20,
  },
  logEntryRow: {
    backgroundColor: 'white',
    paddingHorizontal: 20,
    paddingVertical: 16,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: '#e0e0e0',
  },
  logEntryInfo: {
    flex: 1,
  },
  logEntryAuthor: {
    fontSize: 16,
    fontWeight: '600',
    color: '#333',
    marginBottom: 2,
  },
  logEntryOriginal: {
    fontSize: 14,
    fontWeight: '400',
    color: '#888',
  },
  logEntryTime: {
    fontSize: 13,
    color: '#888',
  },
  logEntryChevron: {
    fontSize: 22,
    color: '#bbb',
    marginLeft: 12,
  },
  emptyLogContainer: {
    padding: 40,
    alignItems: 'center',
  },
  emptyLogText: {
    fontSize: 16,
    color: '#888',
  },
  logVersionMeta: {
    marginBottom: 16,
  },
  logVersionAuthor: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#333',
    marginBottom: 4,
  },
  logVersionTime: {
    fontSize: 14,
    color: '#888',
  },
  logVersionNotes: {
    backgroundColor: 'white',
    borderRadius: 12,
    padding: 16,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 3,
    elevation: 3,
  },
  logVersionNotesText: {
    fontSize: 16,
    color: '#333',
    lineHeight: 24,
  },
})
