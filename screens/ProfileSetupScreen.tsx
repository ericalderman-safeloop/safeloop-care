import React, { useState } from 'react'
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

export default function ProfileSetupScreen() {
  const { session, invitationInfo, refreshUserProfile } = useAuth()
  const [loading, setLoading] = useState(false)
  const [formData, setFormData] = useState<CreateUserProfileData>({
    display_name: '',
    phone_number: '',
  })

  const handleSave = async () => {
    if (!formData.display_name.trim()) {
      Alert.alert('Error', 'Please enter your full name')
      return
    }

    if (!session?.user?.id || !session?.user?.email) {
      Alert.alert('Error', 'Authentication error. Please sign in again.')
      return
    }

    setLoading(true)
    try {
      if (invitationInfo) {
        // User has an invitation - join existing account as caregiver
        await userService.createInvitedUserProfile(
          session.user.id,
          session.user.email,
          formData,
          invitationInfo
        )
      } else {
        // No invitation - create new account and become admin
        await userService.createAdminUserProfile(
          session.user.id,
          session.user.email,
          formData
        )
      }
      
      // Refresh the user profile in context
      await refreshUserProfile()
      
      const role = invitationInfo ? 'caregiver' : 'administrator'
      Alert.alert(
        'Welcome to SafeLoop!', 
        `Your profile has been created successfully. You are now a ${role} on this SafeLoop account.`
      )
    } catch (error) {
      console.error('Error creating profile:', error)
      Alert.alert('Error', 'Failed to create profile. Please try again.')
    } finally {
      setLoading(false)
    }
  }

  return (
    <ScrollView style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.title}>
          {invitationInfo ? 'Join SafeLoop Team!' : 'Welcome to SafeLoop!'}
        </Text>
        <Text style={styles.subtitle}>
          {invitationInfo 
            ? 'You\'ve been invited to join a SafeLoop account. Complete your profile to get started as a caregiver.'
            : 'Let\'s set up your profile and create your SafeLoop account. You\'ll be the administrator.'
          }
        </Text>
      </View>

      <View style={styles.form}>
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
            value={session?.user?.email || ''}
            editable={false}
          />
          <Text style={styles.helperText}>
            This is your sign-in email and cannot be changed here
          </Text>
        </View>

        <View style={styles.inputGroup}>
          <Text style={styles.label}>Your Role</Text>
          <View style={styles.roleDisplay}>
            <Text style={styles.roleDisplayText}>
              {invitationInfo ? '👥 Caregiver' : '👑 Account Administrator'}
            </Text>
          </View>
          <Text style={styles.helperText}>
            {invitationInfo 
              ? 'You\'ve been invited to join as a caregiver team member'
              : 'As the account creator, you\'ll be the administrator with full access to manage the account'
            }
          </Text>
        </View>
      </View>

      <TouchableOpacity 
        style={[styles.saveButton, loading && styles.saveButtonDisabled]} 
        onPress={handleSave}
        disabled={loading}
      >
        {loading ? (
          <ActivityIndicator color="white" />
        ) : (
          <Text style={styles.saveButtonText}>Complete Setup</Text>
        )}
      </TouchableOpacity>
    </ScrollView>
  )
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f5f5f5',
  },
  header: {
    padding: 30,
    paddingTop: 60,
    backgroundColor: '#2196F3',
    alignItems: 'center',
  },
  title: {
    fontSize: 28,
    fontWeight: 'bold',
    color: 'white',
    marginBottom: 10,
  },
  subtitle: {
    fontSize: 16,
    color: 'rgba(255, 255, 255, 0.9)',
    textAlign: 'center',
  },
  form: {
    padding: 20,
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
  saveButton: {
    margin: 20,
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