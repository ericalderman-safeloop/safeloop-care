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
import { userService, CreateUserProfileData } from '../lib/userService'

interface SettingsScreenProps {
  navigation: any
}

export default function SettingsScreen({ navigation }: SettingsScreenProps) {
  const { userProfile, refreshUserProfile } = useAuth()
  const [loading, setLoading] = useState(false)
  const [formData, setFormData] = useState<CreateUserProfileData>({
    display_name: '',
    phone_number: '',
  })

  useEffect(() => {
    if (userProfile) {
      setFormData({
        display_name: userProfile.display_name || '',
        phone_number: userProfile.phone_number || '',
      })
    }
  }, [userProfile])

  const handleSave = async () => {
    if (!formData.display_name.trim()) {
      Alert.alert('Error', 'Please enter your full name')
      return
    }

    if (!userProfile?.id) {
      Alert.alert('Error', 'Profile not found. Please try refreshing the app.')
      return
    }

    setLoading(true)
    try {
      await userService.updateUserProfile(userProfile.id, formData)
      await refreshUserProfile()
      Alert.alert('Success', 'Your profile has been updated successfully!')
    } catch (error) {
      console.error('Error updating profile:', error)
      Alert.alert('Error', 'Failed to update profile. Please try again.')
    } finally {
      setLoading(false)
    }
  }

  const hasChanges = () => {
    if (!userProfile) return false
    return (
      formData.display_name !== (userProfile.display_name || '') ||
      formData.phone_number !== (userProfile.phone_number || '')
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
        <Text style={styles.title}>Settings</Text>
      </View>

      <ScrollView style={styles.content}>
        <Text style={styles.sectionTitle}>Profile Information</Text>

        <View style={styles.inputGroup}>
          <Text style={styles.label}>Full Name *</Text>
          <TextInput
            style={styles.input}
            value={formData.display_name}
            onChangeText={(text) => setFormData({ ...formData, display_name: text })}
            placeholder="Enter your full name"
            autoCapitalize="words"
            returnKeyType="next"
          />
        </View>

        <View style={styles.inputGroup}>
          <Text style={styles.label}>Phone Number</Text>
          <TextInput
            style={styles.input}
            value={formData.phone_number}
            onChangeText={(text) => setFormData({ ...formData, phone_number: text })}
            placeholder="Enter your phone number"
            keyboardType="phone-pad"
            returnKeyType="next"
          />
        </View>

        <View style={styles.inputGroup}>
          <Text style={styles.label}>Email</Text>
          <TextInput
            style={[styles.input, styles.disabledInput]}
            value={userProfile?.email || ''}
            editable={false}
          />
          <Text style={styles.helperText}>
            To change your email, please contact support
          </Text>
        </View>

        <View style={styles.inputGroup}>
          <Text style={styles.label}>Role</Text>
          <View style={styles.roleDisplay}>
            <Text style={styles.roleDisplayText}>
              {userProfile?.user_type === 'caregiver_admin' ? '👑 Account Administrator' : '👥 Caregiver'}
            </Text>
          </View>
          <Text style={styles.helperText}>
            {userProfile?.user_type === 'caregiver_admin' 
              ? 'You have full access to manage this SafeLoop account'
              : 'You are a caregiver team member on this SafeLoop account'
            }
          </Text>
        </View>

        <View style={styles.accountInfo}>
          <Text style={styles.sectionTitle}>Account Information</Text>
          <View style={styles.infoRow}>
            <Text style={styles.infoLabel}>Account Created:</Text>
            <Text style={styles.infoValue}>
              {userProfile?.created_at ? new Date(userProfile.created_at).toLocaleDateString() : 'Unknown'}
            </Text>
          </View>
          <View style={styles.infoRow}>
            <Text style={styles.infoLabel}>Timezone:</Text>
            <Text style={styles.infoValue}>{userProfile?.timezone || 'UTC'}</Text>
          </View>
          <View style={styles.infoRow}>
            <Text style={styles.infoLabel}>Status:</Text>
            <Text style={[styles.infoValue, styles.activeStatus]}>
              {userProfile?.is_active ? 'Active' : 'Inactive'}
            </Text>
          </View>
        </View>
      </ScrollView>

      {hasChanges() && (
        <View style={styles.saveContainer}>
          <TouchableOpacity 
            style={[styles.saveButton, loading && styles.saveButtonDisabled]} 
            onPress={handleSave}
            disabled={loading}
          >
            {loading ? (
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
  disabledInput: {
    backgroundColor: '#f8f8f8',
    color: '#666',
  },
  helperText: {
    fontSize: 14,
    color: '#666',
    marginTop: 5,
    fontStyle: 'italic',
  },
  roleDisplay: {
    padding: 15,
    borderRadius: 8,
    backgroundColor: '#f0f8ff',
    borderWidth: 2,
    borderColor: '#2196F3',
    alignItems: 'center',
  },
  roleDisplayText: {
    fontSize: 18,
    fontWeight: '600',
    color: '#2196F3',
  },
  accountInfo: {
    marginTop: 20,
    padding: 15,
    backgroundColor: 'white',
    borderRadius: 8,
  },
  infoRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingVertical: 8,
    borderBottomWidth: 1,
    borderBottomColor: '#f0f0f0',
  },
  infoLabel: {
    fontSize: 16,
    color: '#666',
  },
  infoValue: {
    fontSize: 16,
    color: '#333',
    fontWeight: '500',
  },
  activeStatus: {
    color: '#4CAF50',
  },
  saveContainer: {
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