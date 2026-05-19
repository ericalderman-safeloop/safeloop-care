import React, { useState, useEffect, useRef } from 'react'
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, Alert, TextInput, Linking, ActivityIndicator, KeyboardAvoidingView, Platform, Image } from 'react-native'
import MapView, { Marker, PROVIDER_GOOGLE } from 'react-native-maps'
import { useAuth } from '../contexts/AuthContext'
import { userService, HelpRequest } from '../lib/userService'
import { supabase } from '../lib/supabase'
import { NativeStackScreenProps } from '@react-navigation/native-stack'
import { RootStackParamList } from '../types/navigation'

type HelpRequestDetailScreenProps = NativeStackScreenProps<RootStackParamList, 'HelpRequestDetail'>

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
  const [saveStatus, setSaveStatus] = useState<'idle' | 'saving' | 'saved'>('idle')
  const [currentLocation, setCurrentLocation] = useState<LocationUpdate | null>(null)
  const isResolvingRef = useRef(false)
  const notesInitializedRef = useRef(false)
  const autoSaveTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const pendingSaveRef = useRef(false)
  const notesRef = useRef('')

  useEffect(() => { notesRef.current = notes }, [notes])

  useEffect(() => {
    return () => { if (autoSaveTimerRef.current) clearTimeout(autoSaveTimerRef.current) }
  }, [])

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
            if (isResolvingRef.current) {
              isResolvingRef.current = false
              return
            }
            const message = newStatus === 'false_alarm'
              ? 'This alert was cancelled — false alarm.'
              : 'This alert has been resolved.'
            Alert.alert('Alert Resolved', message, [
              { text: 'OK', onPress: () => navigation.navigate('Home') }
            ])
          } else if (newStatus === 'responded_to') {
            // Another caregiver responded — refresh to switch to read-only mode
            loadHelpRequest()
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

  const loadHelpRequest = async () => {
    try {
      const data = await userService.getHelpRequestDetails(route.params.helpRequestId)
      if (data) {
        setHelpRequest(data)
        const formattedNotes = buildFormattedNotes(data)
        setNotes(formattedNotes)
        if (!notesInitializedRef.current && formattedNotes !== (data.notes || '')) {
          notesInitializedRef.current = true
          await userService.updateHelpRequestNotes(data.id, formattedNotes)
        } else {
          notesInitializedRef.current = true
        }
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
    // Strip non-digit chars (except leading +) so tel: URLs work across formats like (555) 123-4567
    const dialable = phoneNumber.replace(/(?!^\+)[^\d]/g, '')
    Linking.openURL(`tel:${dialable}`)
  }

  const handleCaregiverNotesChange = (text: string) => {
    const autoPrefix = notes.split('\n\n')[0] || ''
    const updated = autoPrefix + '\n\n' + text
    setNotes(updated)
    setSaveStatus('idle')
    pendingSaveRef.current = true
    if (autoSaveTimerRef.current) clearTimeout(autoSaveTimerRef.current)
    autoSaveTimerRef.current = setTimeout(() => performAutoSave(updated), 3000)
  }

  const performAutoSave = async (notesToSave?: string) => {
    if (!helpRequest?.id || !pendingSaveRef.current) return
    if (autoSaveTimerRef.current) clearTimeout(autoSaveTimerRef.current)
    const value = notesToSave ?? notesRef.current
    setSaveStatus('saving')
    try {
      await userService.updateHelpRequestNotes(helpRequest.id, value)
      pendingSaveRef.current = false
      setSaveStatus('saved')
    } catch (error) {
      console.error('Error auto-saving notes:', error)
      setSaveStatus('idle')
    }
  }

  const handleBack = async () => {
    await performAutoSave()
    navigation.goBack()
  }

  const handleResolve = async () => {
    if (!userProfile?.id || !helpRequest?.id) return
    await performAutoSave()

    Alert.alert(
      'Resolve Alert',
      'How would you like to resolve this alert?',
      [
        {
          text: 'Mark as Resolved',
          onPress: async () => {
            try {
              isResolvingRef.current = true
              await userService.updateHelpRequestStatus(
                helpRequest.id,
                'resolved',
                userProfile.id,
                notesRef.current
              )
              navigation.navigate('Home')
            } catch (error) {
              isResolvingRef.current = false
              Alert.alert('Error', 'Failed to update alert status')
            }
          }
        },
        {
          text: 'Mark as False Alarm',
          onPress: async () => {
            try {
              isResolvingRef.current = true
              await userService.updateHelpRequestStatus(
                helpRequest.id,
                'false_alarm',
                userProfile.id,
                notesRef.current
              )
              navigation.navigate('Home')
            } catch (error) {
              isResolvingRef.current = false
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

  const requestType = helpRequest.request_type === 'fall' ? '🚨 Fall Detected' : '🆘 Help Requested'

  // Only the responder (or the first viewer of an active alert) can edit notes and resolve
  const canEdit = helpRequest.event_status === 'active' || helpRequest.responded_by === userProfile?.id

  return (
    <KeyboardAvoidingView
      style={styles.container}
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
      keyboardVerticalOffset={0}
    >
      <View style={styles.header}>
        <TouchableOpacity onPress={handleBack} style={styles.backButton}>
          <Text style={styles.backButtonText}>← Back</Text>
        </TouchableOpacity>
        <Text style={styles.title}>Help Request Details</Text>
      </View>

      <ScrollView style={styles.content}>
        {/* Alert Type Banner */}
        <View style={styles.alertBanner}>
          <Text style={styles.alertType}>{requestType}</Text>
          <Text style={styles.alertTime}>{formatTime(helpRequest.created_at)}</Text>
          {helpRequest.event_status === 'responded_to' && (
            <Text style={styles.alertResponder}>
              👤 Being assisted by {helpRequest.responder?.display_name || 'a caregiver'}
            </Text>
          )}
        </View>

        {/* Wearer Information */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Wearer Information</Text>
          <View style={styles.infoCard}>
            <View style={styles.wearerInfoRow}>
              {helpRequest.wearer?.photo_url ? (
                <Image source={{ uri: helpRequest.wearer.photo_url }} style={styles.wearerPhoto} />
              ) : (
                <View style={styles.wearerPhotoPlaceholder}>
                  <Text style={styles.wearerPhotoInitials}>
                    {helpRequest.wearer?.name?.trim().split(/\s+/).map(n => n[0]).join('').slice(0, 2).toUpperCase() || '?'}
                  </Text>
                </View>
              )}
              <View style={styles.wearerInfoText}>
                <Text style={styles.wearerName}>{helpRequest.wearer?.name}</Text>
                {helpRequest.wearer?.date_of_birth && (
                  <Text style={styles.infoText}>DOB: {new Date(helpRequest.wearer.date_of_birth).toLocaleDateString()}</Text>
                )}
                {helpRequest.wearer?.gender && (
                  <Text style={styles.infoText}>Gender: {helpRequest.wearer.gender}</Text>
                )}
              </View>
            </View>
            {helpRequest.wearer?.emergency_notes && (
              <View style={styles.emergencyNotesContainer}>
                <Text style={styles.emergencyNotesLabel}>Emergency Notes</Text>
                <Text style={styles.emergencyNotesText}>{helpRequest.wearer.emergency_notes}</Text>
              </View>
            )}
          </View>
        </View>

        {/* Medical Information */}
        {(helpRequest.wearer?.medical_conditions?.length ||
          helpRequest.wearer?.medications?.length ||
          helpRequest.wearer?.allergies?.length) && (
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
                provider={PROVIDER_GOOGLE}
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

          {!canEdit && helpRequest.event_status === 'responded_to' && (
            <View style={styles.readOnlyBanner}>
              <Text style={styles.readOnlyText}>
                🔒 {helpRequest.responder?.display_name || 'A caregiver'} is handling this alert. Notes are read-only.
              </Text>
            </View>
          )}

          {/* Auto-generated log entries */}
          {(() => {
            const autoPrefix = notes.split('\n\n')[0] || ''
            const autoLines = autoPrefix.split('\n').filter(l => l.trim())
            const entries: { type: string; text: string; url?: string }[] = []
            let i = 0
            while (i < autoLines.length) {
              const line = autoLines[i]
              if (line.startsWith('Wearer located at:')) {
                const nextLine = autoLines[i + 1]
                const url = nextLine?.startsWith('https://') ? nextLine : undefined
                entries.push({ type: 'location', text: line.replace('Wearer located at: ', ''), url })
                i += url ? 2 : 1
              } else if (line.startsWith('https://')) {
                entries.push({ type: 'link', text: 'View on Google Maps', url: line })
                i++
              } else if (line.includes('responded to the help request')) {
                entries.push({ type: 'responder', text: line })
                i++
              } else {
                entries.push({ type: 'event', text: line })
                i++
              }
            }
            return entries.filter(e => e.type !== 'location' && e.type !== 'link').map((entry, idx) => (
              <View key={idx} style={[styles.logEntry, styles[`logEntry_${entry.type}` as keyof typeof styles] as any]}>
                <Text style={styles.logEntryIcon}>
                  {entry.type === 'event' ? '🚨' : '👤'}
                </Text>
                <View style={styles.logEntryBody}>
                  <Text style={styles.logEntryText}>{entry.text}</Text>
                </View>
              </View>
            ))
          })()}

          {/* Caregiver freeform notes */}
          <View style={styles.infoCard}>
            <View style={styles.caregiverNotesHeader}>
              <Text style={styles.caregiverNotesLabel}>Caregiver Notes</Text>
              {canEdit && saveStatus === 'saving' && (
                <Text style={styles.saveStatusText}>Saving...</Text>
              )}
              {canEdit && saveStatus === 'saved' && (
                <Text style={[styles.saveStatusText, styles.saveStatusSaved]}>✓ Saved</Text>
              )}
            </View>
            <TextInput
              style={[styles.notesInput, !canEdit && styles.notesInputReadOnly]}
              value={notes.split('\n\n').slice(1).join('\n\n')}
              onChangeText={canEdit ? handleCaregiverNotesChange : undefined}
              placeholder="Document the assistance provided, situation details, or follow-up actions..."
              multiline
              numberOfLines={4}
              textAlignVertical="top"
              editable={canEdit}
            />
          </View>
        </View>

        {/* Resolve Button — only for the responder */}
        {canEdit && (helpRequest.event_status === 'active' || helpRequest.event_status === 'responded_to') && (
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
  alertResponder: {
    fontSize: 14,
    color: '#e65100',
    marginTop: 4,
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
  wearerInfoRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  wearerPhoto: {
    width: 64,
    height: 64,
    borderRadius: 32,
    marginRight: 14,
    backgroundColor: '#e0e0e0',
  },
  wearerPhotoPlaceholder: {
    width: 64,
    height: 64,
    borderRadius: 32,
    backgroundColor: '#e3f2fd',
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 14,
  },
  wearerPhotoInitials: {
    fontSize: 22,
    fontWeight: 'bold',
    color: '#2196F3',
  },
  wearerInfoText: {
    flex: 1,
  },
  wearerName: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#333',
    marginBottom: 4,
  },
  infoText: {
    fontSize: 16,
    color: '#555',
    marginBottom: 4,
  },
  emergencyNotesContainer: {
    marginTop: 12,
    paddingTop: 12,
    borderTopWidth: 1,
    borderTopColor: '#f0f0f0',
  },
  emergencyNotesLabel: {
    fontSize: 13,
    fontWeight: '600',
    color: '#e65100',
    marginBottom: 4,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  emergencyNotesText: {
    fontSize: 15,
    color: '#333',
    lineHeight: 22,
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
  logEntry: {
    flexDirection: 'row',
    backgroundColor: 'white',
    borderRadius: 10,
    padding: 12,
    marginBottom: 8,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.06,
    shadowRadius: 2,
    elevation: 2,
  },
  logEntry_event: {
    borderLeftWidth: 3,
    borderLeftColor: '#ff9800',
    backgroundColor: '#fff8f0',
  },
  logEntry_location: {
    borderLeftWidth: 3,
    borderLeftColor: '#4CAF50',
    backgroundColor: '#f1f8f1',
  },
  logEntry_responder: {
    borderLeftWidth: 3,
    borderLeftColor: '#2196F3',
    backgroundColor: '#f0f6ff',
  },
  logEntry_link: {
    borderLeftWidth: 3,
    borderLeftColor: '#9e9e9e',
  },
  logEntryIcon: {
    fontSize: 18,
    marginRight: 10,
    marginTop: 1,
  },
  logEntryBody: {
    flex: 1,
  },
  logEntryText: {
    fontSize: 14,
    color: '#333',
    lineHeight: 20,
  },
  logEntryLink: {
    fontSize: 13,
    color: '#2196F3',
    marginTop: 4,
    fontWeight: '500',
  },
  caregiverNotesHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 8,
  },
  caregiverNotesLabel: {
    fontSize: 14,
    fontWeight: '600',
    color: '#666',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  saveStatusText: {
    fontSize: 12,
    color: '#999',
    marginLeft: 8,
  },
  saveStatusSaved: {
    color: '#4CAF50',
  },
  readOnlyBanner: {
    backgroundColor: '#f5f5f5',
    borderRadius: 8,
    padding: 10,
    marginBottom: 10,
    borderLeftWidth: 3,
    borderLeftColor: '#bdbdbd',
  },
  readOnlyText: {
    fontSize: 13,
    color: '#757575',
  },
  notesInput: {
    borderWidth: 1,
    borderColor: '#ddd',
    borderRadius: 8,
    padding: 12,
    fontSize: 15,
    minHeight: 90,
    marginBottom: 12,
  },
  notesInputReadOnly: {
    backgroundColor: '#fafafa',
    color: '#555',
    borderColor: '#eeeeee',
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
})
