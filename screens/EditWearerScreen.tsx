import React, { useState, useEffect } from 'react'
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

interface EditWearerScreenProps {
  navigation: any
  route: {
    params: {
      wearerId: string
    }
  }
}

export default function EditWearerScreen({ navigation, route }: EditWearerScreenProps) {
  const { wearerId } = route.params
  const { userProfile } = useAuth()
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [wearer, setWearer] = useState<Wearer | null>(null)
  const [formData, setFormData] = useState({
    name: '',
    date_of_birth: '',
    emergency_contact_name: '',
    emergency_contact_phone: '',
    emergency_contact_relationship: '',
    emergency_notes: '',
  })

  const loadWearer = async () => {
    try {
      const wearerData = await userService.getWearerById(wearerId)
      setWearer(wearerData)
      setFormData({
        name: wearerData.name || '',
        date_of_birth: wearerData.date_of_birth || '',
        emergency_contact_name: wearerData.emergency_contact_name || '',
        emergency_contact_phone: wearerData.emergency_contact_phone || '',
        emergency_contact_relationship: wearerData.emergency_contact_relationship || '',
        emergency_notes: wearerData.emergency_notes || '',
      })
    } catch (error) {
      console.error('Error loading wearer:', error)
      Alert.alert('Error', 'Failed to load wearer information.')
      navigation.goBack()
    } finally {
      setLoading(false)
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
      await userService.updateWearer(wearerId, {
        name: formData.name,
        date_of_birth: formData.date_of_birth || undefined,
        emergency_contact_name: formData.emergency_contact_name || undefined,
        emergency_contact_phone: formData.emergency_contact_phone || undefined,
        emergency_contact_relationship: formData.emergency_contact_relationship || undefined,
        emergency_notes: formData.emergency_notes || undefined,
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
      formData.emergency_contact_name !== (wearer.emergency_contact_name || '') ||
      formData.emergency_contact_phone !== (wearer.emergency_contact_phone || '') ||
      formData.emergency_contact_relationship !== (wearer.emergency_contact_relationship || '') ||
      formData.emergency_notes !== (wearer.emergency_notes || '')
    )
  }

  useEffect(() => {
    loadWearer()
  }, [wearerId])

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
          <Text style={styles.backButtonText}>‹ Back</Text>
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

          <Text style={styles.sectionTitle}>Emergency Contact</Text>

          <View style={styles.inputGroup}>
            <Text style={styles.label}>Contact Name</Text>
            <TextInput
              style={styles.input}
              value={formData.emergency_contact_name}
              onChangeText={(text) => setFormData({ ...formData, emergency_contact_name: text })}
              placeholder="Emergency contact's name"
              autoCapitalize="words"
              returnKeyType="next"
            />
          </View>

          <View style={styles.inputGroup}>
            <Text style={styles.label}>Contact Phone</Text>
            <TextInput
              style={styles.input}
              value={formData.emergency_contact_phone}
              onChangeText={(text) => setFormData({ ...formData, emergency_contact_phone: text })}
              placeholder="Emergency contact's phone number"
              keyboardType="phone-pad"
              returnKeyType="next"
            />
          </View>

          <View style={styles.inputGroup}>
            <Text style={styles.label}>Relationship</Text>
            <TextInput
              style={styles.input}
              value={formData.emergency_contact_relationship}
              onChangeText={(text) => setFormData({ ...formData, emergency_contact_relationship: text })}
              placeholder="e.g., Spouse, Child, Friend"
              autoCapitalize="words"
              returnKeyType="next"
            />
          </View>

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