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
import { userService } from '../lib/userService'

interface InviteCaregiverScreenProps {
  navigation: any
}

export default function InviteCaregiverScreen({ navigation }: InviteCaregiverScreenProps) {
  const { userProfile } = useAuth()
  const [loading, setLoading] = useState(false)
  const [email, setEmail] = useState('')

  const handleSendInvitation = async () => {
    // Validate email
    if (!email.trim()) {
      Alert.alert('Error', 'Please enter an email address')
      return
    }

    if (!isValidEmail(email)) {
      Alert.alert('Error', 'Please enter a valid email address')
      return
    }

    if (!userProfile?.safeloop_account_id) {
      Alert.alert('Error', 'Account information not found. Please try refreshing the app.')
      return
    }

    // Check if user is admin
    if (userProfile.user_type !== 'caregiver_admin') {
      Alert.alert('Error', 'Only account admins can invite caregivers.')
      return
    }

    setLoading(true)
    try {
      await userService.inviteCaregiver(email, userProfile.safeloop_account_id)

      Alert.alert(
        'Invitation Sent!',
        `An invitation email will be sent to ${email}. They'll receive instructions to create their SafeLoop account and join your team.`,
        [
          {
            text: 'Send Another',
            onPress: () => setEmail('')
          },
          {
            text: 'Done',
            onPress: () => navigation.goBack(),
            style: 'cancel'
          }
        ]
      )
    } catch (error: any) {
      console.error('Error sending invitation:', error)
      Alert.alert('Error', error.message || 'Failed to send invitation. Please try again.')
    } finally {
      setLoading(false)
    }
  }

  const isValidEmail = (email: string): boolean => {
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
    return emailRegex.test(email)
  }

  return (
    <ScrollView style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.title}>Invite Caregiver</Text>
        <Text style={styles.subtitle}>
          Add a new team member to help monitor and respond to alerts
        </Text>
      </View>

      <View style={styles.form}>
        <View style={styles.inputGroup}>
          <Text style={styles.label}>Email Address *</Text>
          <TextInput
            style={styles.input}
            placeholder="caregiver@example.com"
            value={email}
            onChangeText={setEmail}
            keyboardType="email-address"
            autoCapitalize="none"
            autoCorrect={false}
            editable={!loading}
            returnKeyType="send"
            onSubmitEditing={handleSendInvitation}
          />
          <Text style={styles.helperText}>
            They'll receive an email invitation to create their account
          </Text>
        </View>

        <View style={styles.infoBox}>
          <Text style={styles.infoTitle}>📧 How it works:</Text>
          <Text style={styles.infoText}>
            1. Enter the email address of the person you want to invite{'\n'}
            2. They'll receive an invitation email with a signup link{'\n'}
            3. When they create their account, they'll automatically join your team{'\n'}
            4. They'll be able to view alerts and manage wearers{'\n'}
            {'\n'}
            Note: Invitations expire after 7 days
          </Text>
        </View>

        <TouchableOpacity
          style={[styles.button, loading && styles.buttonDisabled]}
          onPress={handleSendInvitation}
          disabled={loading}
        >
          {loading ? (
            <ActivityIndicator color="#fff" />
          ) : (
            <Text style={styles.buttonText}>Send Invitation</Text>
          )}
        </TouchableOpacity>

        <TouchableOpacity
          style={styles.cancelButton}
          onPress={() => navigation.goBack()}
          disabled={loading}
        >
          <Text style={styles.cancelButtonText}>Cancel</Text>
        </TouchableOpacity>
      </View>
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
  helperText: {
    fontSize: 14,
    color: '#666',
    marginTop: 5,
    fontStyle: 'italic',
  },
  infoBox: {
    backgroundColor: '#e3f2fd',
    padding: 16,
    borderRadius: 8,
    marginBottom: 20,
    borderLeftWidth: 4,
    borderLeftColor: '#2196F3',
  },
  infoTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: '#1976D2',
    marginBottom: 8,
  },
  infoText: {
    fontSize: 14,
    color: '#555',
    lineHeight: 20,
  },
  button: {
    backgroundColor: '#2196F3',
    padding: 18,
    borderRadius: 8,
    alignItems: 'center',
    marginBottom: 10,
  },
  buttonDisabled: {
    backgroundColor: '#ccc',
  },
  buttonText: {
    color: 'white',
    fontSize: 18,
    fontWeight: '600',
  },
  cancelButton: {
    padding: 18,
    borderRadius: 8,
    alignItems: 'center',
  },
  cancelButtonText: {
    color: '#2196F3',
    fontSize: 16,
    fontWeight: '500',
  },
})
