import React, { useState, useEffect } from 'react'
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, Alert, TextInput, Linking, ActivityIndicator, Dimensions } from 'react-native'
import MapView, { Marker } from 'react-native-maps'
import { useAuth } from '../contexts/AuthContext'
import { userService, HelpRequest } from '../lib/userService'

interface HelpRequestDetailScreenProps {
  navigation: any
  route: {
    params: {
      helpRequestId: string
    }
  }
}

export default function HelpRequestDetailScreen({ navigation, route }: HelpRequestDetailScreenProps) {
  const { userProfile } = useAuth()
  const [helpRequest, setHelpRequest] = useState<HelpRequest | null>(null)
  const [loading, setLoading] = useState(true)
  const [notes, setNotes] = useState('')
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    loadHelpRequest()
  }, [route.params.helpRequestId])

  const loadHelpRequest = async () => {
    try {
      const data = await userService.getHelpRequestDetails(route.params.helpRequestId)
      if (data) {
        setHelpRequest(data)
        setNotes(data.notes || '')
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
    if (!userProfile?.id || !helpRequest?.id) return

    setSaving(true)
    try {
      await userService.updateHelpRequestStatus(
        helpRequest.id,
        'responded_to',
        userProfile.id,
        notes
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

    const url = `http://maps.apple.com/?ll=${helpRequest.location_latitude},${helpRequest.location_longitude}`
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

  return (
    <View style={styles.container}>
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
                  latitude: Number(helpRequest.location_latitude),
                  longitude: Number(helpRequest.location_longitude),
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
                  description={String(requestType || 'Emergency Alert')}
                />
              </MapView>
              {helpRequest.location_accuracy && (
                <View style={styles.accuracyBadge}>
                  <Text style={styles.accuracyText}>
                    Accuracy: ±{Number(helpRequest.location_accuracy).toFixed(0)}m
                  </Text>
                </View>
              )}
              <TouchableOpacity style={styles.mapButton} onPress={openInMaps}>
                <Text style={styles.mapButtonText}>Open in Apple Maps</Text>
              </TouchableOpacity>
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

        {/* Notes */}
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
          </View>
        </View>

        {/* Resolve Button */}
        {helpRequest.event_status === 'active' && (
          <TouchableOpacity style={styles.resolveButton} onPress={handleResolve}>
            <Text style={styles.resolveButtonText}>Resolve Alert</Text>
          </TouchableOpacity>
        )}

        {helpRequest.event_status !== 'active' && (
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
    </View>
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
    marginBottom: 8,
  },
  alertTime: {
    fontSize: 16,
    color: '#666',
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
    shadowOffset: {
      width: 0,
      height: 2,
    },
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
  infoTextSmall: {
    fontSize: 14,
    color: '#666',
    marginTop: 4,
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
    shadowOffset: {
      width: 0,
      height: 2,
    },
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
    shadowOffset: {
      width: 0,
      height: 1,
    },
    shadowOpacity: 0.2,
    shadowRadius: 2,
    elevation: 3,
  },
  accuracyText: {
    fontSize: 12,
    fontWeight: '600',
    color: '#666',
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
  },
  saveButtonDisabled: {
    backgroundColor: '#ccc',
  },
  saveButtonText: {
    color: 'white',
    fontSize: 16,
    fontWeight: '600',
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
