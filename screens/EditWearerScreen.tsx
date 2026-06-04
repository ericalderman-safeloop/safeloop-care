import React, { useCallback, useState } from 'react'
import {
  View,
  Text,
  StyleSheet,
  TextInput,
  TouchableOpacity,
  Alert,
  ScrollView,
  ActivityIndicator
} from 'react-native'
import { useAuth } from '../contexts/AuthContext'
import { userService, Wearer } from '../lib/userService'
import WearerPhotoPicker from '../components/WearerPhotoPicker'
import { useFocusEffect } from '@react-navigation/native'
import { NativeStackScreenProps } from '@react-navigation/native-stack'
import { RootStackParamList } from '../types/navigation'

const MODE_LABELS: Record<string, string> = {
  apple: 'Apple Fall Detection',
  custom: 'SafeLoop Fall Detection',
}

type EditWearerScreenProps = NativeStackScreenProps<RootStackParamList, 'EditWearer'>

export default function EditWearerScreen({ navigation, route }: EditWearerScreenProps) {
  const { wearerId } = route.params
  const { userProfile } = useAuth()
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [wearer, setWearer] = useState<Wearer | null>(null)
  const [formData, setFormData] = useState({
    name: '',
    date_of_birth: '',
    wearer_contact_phone: '',
    emergency_notes: '',
  })
  const [photoUri, setPhotoUri] = useState<string | null>(null)
  const [wearerSensitivity, setWearerSensitivity] = useState<'low' | 'medium' | 'high' | null>(null)
  const [globalSensitivity, setGlobalSensitivity] = useState<'low' | 'medium' | 'high'>('medium')
  const [sensitivityLoading, setSensitivityLoading] = useState(false)

  const isAdmin = userProfile?.user_type === 'caregiver_admin'

  // `seedForm` is false on focus re-runs so the user's in-progress edits to
  // name / DOB / phone / notes aren't wiped when they return from a child
  // screen (e.g. the Fall Detection Mode picker).
  const loadWearer = async (seedForm: boolean) => {
    try {
      const wearerData = await userService.getWearerById(wearerId)
      setWearer(wearerData)
      if (seedForm) {
        setFormData({
          name: wearerData.name || '',
          date_of_birth: wearerData.date_of_birth || '',
          wearer_contact_phone: wearerData.wearer_contact_phone || '',
          emergency_notes: wearerData.emergency_notes || '',
        })
        setPhotoUri(wearerData.photo_url || null)
      }

      if (isAdmin && wearerData.device?.[0]?.seven_digit_code) {
        const [wearerSpecific, globalDefault] = await Promise.all([
          userService.getWearerFallSensitivity(wearerData.device[0].seven_digit_code),
          userService.getGlobalFallSensitivity(),
        ])
        setWearerSensitivity(wearerSpecific)
        setGlobalSensitivity(globalDefault)
      }
    } catch (error) {
      console.error('Error loading wearer:', error)
      Alert.alert('Error', 'Failed to load wearer information.')
      navigation.goBack()
    } finally {
      setLoading(false)
    }
  }

  const handleSensitivityChange = async (value: 'low' | 'medium' | 'high' | null) => {
    const deviceCode = wearer?.device?.[0]?.seven_digit_code
    if (!deviceCode) return
    setSensitivityLoading(true)
    const previous = wearerSensitivity
    setWearerSensitivity(value)
    try {
      if (value === null) {
        await userService.clearWearerFallSensitivity(deviceCode)
      } else {
        await userService.setFallSensitivity(deviceCode, value)
      }
    } catch (error) {
      console.error('Error updating wearer sensitivity:', error)
      Alert.alert('Error', 'Failed to update fall detection sensitivity.')
      setWearerSensitivity(previous)
    } finally {
      setSensitivityLoading(false)
    }
  }

  const handleSave = async () => {
    if (!formData.name.trim()) {
      Alert.alert('Error', 'Please enter the wearer\'s name')
      return
    }

    if (formData.date_of_birth && !isValidDate(formData.date_of_birth)) {
      Alert.alert('Error', 'Please enter a valid date (YYYY-MM-DD)')
      return
    }

    setSaving(true)
    try {
      let resolvedPhotoUrl = wearer?.photo_url || undefined

      // Upload new photo if the URI changed from the stored URL
      if (photoUri && photoUri !== wearer?.photo_url) {
        resolvedPhotoUrl = await userService.uploadWearerPhoto(wearerId, photoUri)
        console.log('Uploaded photo URL:', resolvedPhotoUrl)
      } else if (!photoUri && wearer?.photo_url) {
        resolvedPhotoUrl = undefined
      }

      await userService.updateWearer(wearerId, {
        name: formData.name,
        date_of_birth: formData.date_of_birth || undefined,
        wearer_contact_phone: formData.wearer_contact_phone || undefined,
        emergency_notes: formData.emergency_notes || undefined,
        photo_url: resolvedPhotoUrl || null,
      })
      
      Alert.alert(
        'Success', 
        'Wearer information has been updated successfully!',
        [
          {
            text: 'OK',
            onPress: () => navigation.goBack()
          }
        ]
      )
    } catch (error: any) {
      console.error('Error updating wearer:', error)
      Alert.alert('Error', error.message || 'Failed to update wearer. Please try again.')
    } finally {
      setSaving(false)
    }
  }

  const isValidDate = (dateString: string): boolean => {
    if (!/^\d{4}-\d{2}-\d{2}$/.test(dateString)) {
      return false
    }
    const date = new Date(dateString)
    return date.toString() !== 'Invalid Date' && date <= new Date()
  }

  const hasChanges = () => {
    if (!wearer) return false
    return (
      formData.name !== (wearer.name || '') ||
      formData.date_of_birth !== (wearer.date_of_birth || '') ||
      formData.wearer_contact_phone !== (wearer.wearer_contact_phone || '') ||
      formData.emergency_notes !== (wearer.emergency_notes || '') ||
      photoUri !== (wearer.photo_url || null)
    )
  }

  useFocusEffect(
    useCallback(() => {
      loadWearer(wearer === null)
    }, [wearerId, wearer === null])
  )

  if (loading) {
    return (
      <View style={styles.container}>
        <View style={styles.header}>
          <TouchableOpacity 
            style={styles.backButton} 
            onPress={() => navigation.goBack()}
          >
            <Text style={styles.backButtonText}>← Back</Text>
          </TouchableOpacity>
          <Text style={styles.title}>Edit Wearer</Text>
        </View>
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color="#2196F3" />
          <Text style={styles.loadingText}>Loading wearer information...</Text>
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
          <Text style={styles.backButtonText}>← Back</Text>
        </TouchableOpacity>
        <Text style={styles.title}>Edit Wearer</Text>
      </View>

      <ScrollView style={styles.content}>
        {wearer?.device && wearer.device.length > 0 && (
          <View style={styles.deviceInfo}>
            <Text style={styles.deviceTitle}>📱 Device Information</Text>
            <Text style={styles.deviceText}>Code: {wearer.device[0].seven_digit_code}</Text>
            <Text style={styles.deviceText}>
              Status: {wearer.device[0].is_verified ? '✅ Verified' : '⏳ Pending Verification'}
            </Text>
            {wearer.device[0].last_seen && (
              <Text style={styles.deviceText}>
                Last Seen: {new Date(wearer.device[0].last_seen).toLocaleString()}
              </Text>
            )}
          </View>
        )}

        <View style={styles.form}>
          <WearerPhotoPicker
            photoUri={photoUri}
            wearerName={formData.name}
            onPhotoChange={setPhotoUri}
            disabled={saving}
          />

          <Text style={styles.sectionTitle}>Basic Information</Text>
          
          <View style={styles.inputGroup}>
            <Text style={styles.label}>Full Name *</Text>
            <TextInput
              style={styles.input}
              value={formData.name}
              onChangeText={(text) => setFormData({ ...formData, name: text })}
              placeholder="Enter wearer's full name"
              autoCapitalize="words"
              returnKeyType="next"
            />
          </View>

          <View style={styles.inputGroup}>
            <Text style={styles.label}>Date of Birth</Text>
            <TextInput
              style={styles.input}
              value={formData.date_of_birth}
              onChangeText={(text) => setFormData({ ...formData, date_of_birth: text })}
              placeholder="YYYY-MM-DD (optional)"
              keyboardType="numeric"
              returnKeyType="next"
            />
            <Text style={styles.helperText}>
              Format: YYYY-MM-DD (e.g., 1950-12-25)
            </Text>
          </View>

          <Text style={styles.sectionTitle}>Contact Information</Text>

          <View style={styles.inputGroup}>
            <Text style={styles.label}>Wearer Contact Phone</Text>
            <TextInput
              style={styles.input}
              value={formData.wearer_contact_phone}
              onChangeText={(text) => setFormData({ ...formData, wearer_contact_phone: text })}
              placeholder="Phone number to reach the wearer"
              keyboardType="phone-pad"
              returnKeyType="next"
            />
            <Text style={styles.helperText}>
              Phone number to call the wearer in case of emergency
            </Text>
          </View>

          {isAdmin && (
            <View style={styles.inputGroup}>
              <Text style={styles.sectionTitle}>Fall Detection</Text>
              <TouchableOpacity
                style={styles.settingsRow}
                onPress={() => navigation.navigate('FallDetectionMode', { wearerId })}
              >
                <View style={styles.settingsRowLeft}>
                  <Text style={styles.settingsRowLabel}>Detection Mode</Text>
                  <Text style={styles.settingsRowValue}>
                    {MODE_LABELS[wearer?.fall_detection_mode ?? 'apple'] ?? 'Apple Fall Detection'}
                  </Text>
                </View>
                <Text style={styles.settingsRowChevron}>›</Text>
              </TouchableOpacity>

              {wearer?.fall_detection_mode === 'custom' && wearer?.device && wearer.device.length > 0 && (
                <View style={styles.sensitivitySection}>
                  <Text style={styles.settingsRowLabel}>Sensitivity</Text>
                  <Text style={styles.helperText}>
                    Override the account default ({globalSensitivity}) for this wearer.
                  </Text>
                  <View style={styles.sensitivityRow}>
                    {([null, 'low', 'medium', 'high'] as const).map((level) => {
                      const isActive = wearerSensitivity === level
                      const label = level === null
                        ? `Default (${globalSensitivity})`
                        : level.charAt(0).toUpperCase() + level.slice(1)
                      return (
                        <TouchableOpacity
                          key={String(level)}
                          style={[
                            styles.sensitivityButton,
                            isActive && styles.sensitivityButtonActive,
                            sensitivityLoading && styles.sensitivityButtonDisabled,
                          ]}
                          onPress={() => handleSensitivityChange(level)}
                          disabled={sensitivityLoading}
                        >
                          <Text style={[styles.sensitivityButtonText, isActive && styles.sensitivityButtonTextActive]}>
                            {label}
                          </Text>
                        </TouchableOpacity>
                      )
                    })}
                  </View>
                </View>
              )}
            </View>
          )}

          <View style={styles.inputGroup}>
            <Text style={styles.label}>Emergency Notes</Text>
            <TextInput
              style={[styles.input, styles.textArea]}
              value={formData.emergency_notes}
              onChangeText={(text) => setFormData({ ...formData, emergency_notes: text })}
              placeholder="Medical conditions, medications, or other important information for emergency responders"
              multiline
              numberOfLines={4}
              textAlignVertical="top"
            />
            <Text style={styles.helperText}>
              Important medical or safety information for emergency responders
            </Text>
          </View>

        </View>
      </ScrollView>

      {hasChanges() && (
        <View style={styles.buttonContainer}>
          <TouchableOpacity 
            style={[styles.saveButton, saving && styles.saveButtonDisabled]} 
            onPress={handleSave}
            disabled={saving}
          >
            {saving ? (
              <ActivityIndicator color="white" />
            ) : (
              <Text style={styles.saveButtonText}>Save Changes</Text>
            )}
          </TouchableOpacity>
        </View>
      )}
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
    fontSize: 16,
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
  deviceInfo: {
    backgroundColor: '#e8f5e8',
    padding: 16,
    borderRadius: 8,
    marginBottom: 20,
    borderLeftWidth: 4,
    borderLeftColor: '#4CAF50',
  },
  deviceTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: '#2e7d32',
    marginBottom: 8,
  },
  deviceText: {
    fontSize: 14,
    color: '#388e3c',
    marginBottom: 2,
  },
  form: {
    flex: 1,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: '#333',
    marginBottom: 15,
    marginTop: 10,
  },
  inputGroup: {
    marginBottom: 20,
  },
  label: {
    fontSize: 16,
    fontWeight: '600',
    color: '#333',
    marginBottom: 8,
  },
  input: {
    borderWidth: 1,
    borderColor: '#ddd',
    borderRadius: 8,
    padding: 15,
    fontSize: 16,
    backgroundColor: 'white',
  },
  textArea: {
    height: 100,
  },
  helperText: {
    fontSize: 14,
    color: '#666',
    marginTop: 5,
    fontStyle: 'italic',
  },
  settingsRow: {
    backgroundColor: 'white',
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#ddd',
    paddingHorizontal: 15,
    paddingVertical: 14,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  settingsRowLeft: {
    flex: 1,
  },
  settingsRowLabel: {
    fontSize: 15,
    fontWeight: '600',
    color: '#333',
    marginBottom: 2,
  },
  settingsRowValue: {
    fontSize: 13,
    color: '#888',
  },
  settingsRowChevron: {
    fontSize: 22,
    color: '#ccc',
    marginLeft: 8,
  },
  sensitivitySection: {
    marginTop: 16,
    marginBottom: 4,
  },
  sensitivityRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 10,
    marginTop: 10,
  },
  sensitivityButton: {
    paddingVertical: 10,
    paddingHorizontal: 14,
    borderRadius: 8,
    borderWidth: 2,
    borderColor: '#ddd',
    backgroundColor: 'white',
  },
  sensitivityButtonActive: {
    borderColor: '#2196F3',
    backgroundColor: '#e3f2fd',
  },
  sensitivityButtonDisabled: {
    opacity: 0.5,
  },
  sensitivityButtonText: {
    fontSize: 14,
    fontWeight: '600',
    color: '#666',
  },
  sensitivityButtonTextActive: {
    color: '#2196F3',
  },
  buttonContainer: {
    padding: 20,
    backgroundColor: 'white',
    borderTopWidth: 1,
    borderTopColor: '#eee',
  },
  saveButton: {
    backgroundColor: '#2196F3',
    padding: 18,
    borderRadius: 8,
    alignItems: 'center',
  },
  saveButtonDisabled: {
    backgroundColor: '#ccc',
  },
  saveButtonText: {
    color: 'white',
    fontSize: 18,
    fontWeight: '600',
  },
})