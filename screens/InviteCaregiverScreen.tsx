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
import { AppNavigationProp } from '../types/navigation'

interface InviteCaregiverScreenProps {
  navigation: AppNavigationProp
}

export default function InviteCaregiverScreen({ navigation }: InviteCaregiverScreenProps) {
  const { userProfile } = useAuth()
  const [loading, setLoading] = useState(false)
  const [wearersLoading, setWearersLoading] = useState(true)
  const [email, setEmail] = useState('')
  const [wearers, setWearers] = useState<Wearer[]>([])
  const [selectedWearerIds, setSelectedWearerIds] = useState<Set<string>>(new Set())
  const [inviteAsAdmin, setInviteAsAdmin] = useState(false)

  useEffect(() => {
    loadWearers()
  }, [])

  const loadWearers = async () => {
    if (!userProfile) return
    try {
      const data = await userService.getWearers(userProfile)
      setWearers(data)
    } catch (error: any) {
      console.error('Error loading wearers:', error)
    } finally {
      setWearersLoading(false)
    }
  }

  const toggleWearer = (wearerId: string) => {
    setSelectedWearerIds(prev => {
      const next = new Set(prev)
      next.has(wearerId) ? next.delete(wearerId) : next.add(wearerId)
      return next
    })
  }

  const handleSendInvitation = async () => {
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

    if (userProfile.user_type !== 'caregiver_admin') {
      Alert.alert('Error', 'Only account admins can invite caregivers.')
      return
    }

    if (selectedWearerIds.size === 0) {
      Alert.alert('No Wearers Selected', 'Please select at least one wearer to assign this caregiver to.')
      return
    }

    setLoading(true)
    try {
      await userService.inviteCaregiver(
        email,
        userProfile.safeloop_account_id,
        Array.from(selectedWearerIds),
        inviteAsAdmin ? 'caregiver_admin' : 'caregiver'
      )

      Alert.alert(
        'Invitation Sent!',
        `An invitation has been sent to ${email}. When they create their account, they'll be automatically assigned to the selected wearer${selectedWearerIds.size > 1 ? 's' : ''}${inviteAsAdmin ? ' and given account admin access' : ''}.`,
        [
          {
            text: 'Send Another',
            onPress: () => {
              setEmail('')
              setSelectedWearerIds(new Set())
              setInviteAsAdmin(false)
            }
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

  const isValidEmail = (value: string): boolean => {
    return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value)
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
        {/* Email */}
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
            returnKeyType="next"
          />
        </View>

        {/* Wearer selection */}
        <View style={styles.inputGroup}>
          <Text style={styles.label}>Assign to Wearers *</Text>
          <Text style={styles.helperText}>
            Select which wearers this caregiver will monitor
          </Text>

          {wearersLoading ? (
            <ActivityIndicator style={styles.wearerLoader} color="#2196F3" />
          ) : wearers.length === 0 ? (
            <View style={styles.emptyWearers}>
              <Text style={styles.emptyWearersText}>
                No wearers registered yet. Add a wearer first before inviting caregivers.
              </Text>
            </View>
          ) : (
            wearers.map(wearer => {
              const selected = selectedWearerIds.has(wearer.id)
              return (
                <TouchableOpacity
                  key={wearer.id}
                  style={[styles.wearerRow, selected && styles.wearerRowSelected]}
                  onPress={() => toggleWearer(wearer.id)}
                  disabled={loading}
                >
                  <View style={[styles.checkbox, selected && styles.checkboxSelected]}>
                    {selected && <Text style={styles.checkmark}>✓</Text>}
                  </View>
                  <View style={styles.wearerInfo}>
                    <Text style={[styles.wearerName, selected && styles.wearerNameSelected]}>
                      {wearer.name}
                    </Text>
                    {wearer.date_of_birth && (
                      <Text style={styles.wearerDob}>DOB: {wearer.date_of_birth}</Text>
                    )}
                  </View>
                </TouchableOpacity>
              )
            })
          )}
        </View>

        {/* Admin role */}
        <View style={styles.inputGroup}>
          <TouchableOpacity
            style={[styles.adminRow, inviteAsAdmin && styles.adminRowSelected]}
            onPress={() => setInviteAsAdmin(prev => !prev)}
            disabled={loading}
          >
            <View style={[styles.checkbox, inviteAsAdmin && styles.checkboxSelected]}>
              {inviteAsAdmin && <Text style={styles.checkmark}>✓</Text>}
            </View>
            <View style={styles.wearerInfo}>
              <Text style={[styles.wearerName, inviteAsAdmin && styles.wearerNameSelected]}>
                Invite as account admin
              </Text>
              <Text style={styles.wearerDob}>
                Admins can register wearers, invite caregivers, and change account settings.
              </Text>
            </View>
          </TouchableOpacity>
        </View>

        <View style={styles.infoBox}>
          <Text style={styles.infoTitle}>📧 How it works:</Text>
          <Text style={styles.infoText}>
            1. Enter the caregiver's email address{'\n'}
            2. Select which wearers to assign them to{'\n'}
            3. They'll receive an email invitation to create their account{'\n'}
            4. When they sign up, they'll be automatically assigned{'\n'}
            {'\n'}
            Note: Invitations expire after 7 days
          </Text>
        </View>

        <TouchableOpacity
          style={[styles.button, (loading || wearers.length === 0) && styles.buttonDisabled]}
          onPress={handleSendInvitation}
          disabled={loading || wearers.length === 0}
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
    marginBottom: 24,
  },
  label: {
    fontSize: 16,
    fontWeight: '600',
    color: '#333',
    marginBottom: 8,
  },
  helperText: {
    fontSize: 14,
    color: '#666',
    marginBottom: 10,
    fontStyle: 'italic',
  },
  input: {
    borderWidth: 1,
    borderColor: '#ddd',
    borderRadius: 8,
    padding: 15,
    fontSize: 16,
    backgroundColor: 'white',
  },
  wearerLoader: {
    marginTop: 12,
  },
  emptyWearers: {
    backgroundColor: '#fff3e0',
    borderRadius: 8,
    padding: 16,
    borderLeftWidth: 4,
    borderLeftColor: '#ff9800',
  },
  emptyWearersText: {
    fontSize: 14,
    color: '#e65100',
    lineHeight: 20,
  },
  wearerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'white',
    borderRadius: 8,
    padding: 14,
    marginBottom: 8,
    borderWidth: 1.5,
    borderColor: '#e0e0e0',
  },
  wearerRowSelected: {
    borderColor: '#2196F3',
    backgroundColor: '#e3f2fd',
  },
  adminRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    backgroundColor: 'white',
    borderRadius: 8,
    padding: 14,
    borderWidth: 1.5,
    borderColor: '#e0e0e0',
  },
  adminRowSelected: {
    borderColor: '#ff9800',
    backgroundColor: '#fff8e1',
  },
  checkbox: {
    width: 22,
    height: 22,
    borderRadius: 4,
    borderWidth: 2,
    borderColor: '#bdbdbd',
    marginRight: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
  checkboxSelected: {
    backgroundColor: '#2196F3',
    borderColor: '#2196F3',
  },
  checkmark: {
    color: 'white',
    fontSize: 13,
    fontWeight: 'bold',
  },
  wearerInfo: {
    flex: 1,
  },
  wearerName: {
    fontSize: 16,
    fontWeight: '500',
    color: '#333',
  },
  wearerNameSelected: {
    color: '#1565C0',
    fontWeight: '600',
  },
  wearerDob: {
    fontSize: 13,
    color: '#888',
    marginTop: 2,
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
