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
import { userService, CreateWearerData } from '../lib/userService'

interface RegisterWearerScreenProps {
  navigation: any
}

export default function RegisterWearerScreen({ navigation }: RegisterWearerScreenProps) {
  const { userProfile } = useAuth()
  const [loading, setLoading] = useState(false)
  const [formData, setFormData] = useState<CreateWearerData>({
    name: '',
    date_of_birth: '',
    seven_digit_code: '',
  })

  const handleSave = async () => {
    if (!formData.name.trim()) {
      Alert.alert('Error', 'Please enter the wearer\'s name')
      return
    }

    if (!formData.seven_digit_code.trim()) {
      Alert.alert('Error', 'Please enter the 7-digit device code')
      return
    }

    if (formData.seven_digit_code.length !== 7) {
      Alert.alert('Error', 'Device code must be exactly 7 digits')
      return
    }

    if (!/^\d{7}$/.test(formData.seven_digit_code)) {
      Alert.alert('Error', 'Device code must contain only numbers')
      return
    }

    if (formData.date_of_birth && !isValidDate(formData.date_of_birth)) {
      Alert.alert('Error', 'Please enter a valid date (YYYY-MM-DD)')
      return
    }

    if (!userProfile) {
      Alert.alert('Error', 'User profile not found. Please try refreshing the app.')
      return
    }

    setLoading(true)
    try {
      const newWearer = await userService.createWearer(userProfile, formData)
      Alert.alert(
        'Success', 
        `${newWearer.name} has been registered successfully! Their device will be activated once they launch the SafeLoop Watch app.`,
        [
          {
            text: 'OK',
            onPress: () => navigation.goBack()
          }
        ]
      )
    } catch (error: any) {
      console.error('Error creating wearer:', error)
      Alert.alert('Error', error.message || 'Failed to register wearer. Please try again.')
    } finally {
      setLoading(false)
    }
  }

  const isValidDate = (dateString: string): boolean => {
    if (!/^\d{4}-\d{2}-\d{2}$/.test(dateString)) {
      return false
    }
    const date = new Date(dateString)
    return date.toString() !== 'Invalid Date' && date <= new Date()
  }

  const formatDeviceCode = (input: string) => {
    // Remove non-digit characters and limit to 7 digits
    const digits = input.replace(/\D/g, '').slice(0, 7)
    setFormData({ ...formData, seven_digit_code: digits })
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
        <Text style={styles.title}>Register New Wearer</Text>
      </View>

      <ScrollView style={styles.content}>
        <Text style={styles.description}>
          Register a new person who will use a SafeLoop Watch. You'll need the 7-digit code displayed on the watch when first launched.
        </Text>

        <View style={styles.form}>
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
              Optional. Format: YYYY-MM-DD (e.g., 1950-12-25)
            </Text>
          </View>

          <View style={styles.inputGroup}>
            <Text style={styles.label}>Device 7-Digit Code *</Text>
            <TextInput
              style={[styles.input, styles.codeInput]}
              value={formData.seven_digit_code}
              onChangeText={formatDeviceCode}
              placeholder="1234567"
              keyboardType="numeric"
              maxLength={7}
              textAlign="center"
              returnKeyType="done"
            />
            <Text style={styles.helperText}>
              Enter the 7-digit code displayed on the SafeLoop Watch when first launched
            </Text>
          </View>

          <View style={styles.infoBox}>
            <Text style={styles.infoTitle}>📱 Finding the Device Code</Text>
            <Text style={styles.infoText}>
              1. Turn on the SafeLoop Watch{'\n'}
              2. Open the SafeLoop app on the watch{'\n'}
              3. The 7-digit code will appear on the home screen{'\n'}
              4. Enter that code here to register the device
            </Text>
          </View>
        </View>
      </ScrollView>

      <View style={styles.buttonContainer}>
        <TouchableOpacity 
          style={[styles.saveButton, loading && styles.saveButtonDisabled]} 
          onPress={handleSave}
          disabled={loading}
        >
          {loading ? (
            <ActivityIndicator color="white" />
          ) : (
            <Text style={styles.saveButtonText}>Register Wearer</Text>
          )}
        </TouchableOpacity>
      </View>
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
  description: {
    fontSize: 16,
    color: '#666',
    lineHeight: 24,
    marginBottom: 30,
    textAlign: 'center',
  },
  form: {
    flex: 1,
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
  codeInput: {
    fontSize: 24,
    fontWeight: 'bold',
    letterSpacing: 2,
    fontFamily: 'monospace',
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
    borderLeftWidth: 4,
    borderLeftColor: '#2196F3',
    marginTop: 20,
  },
  infoTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: '#1976d2',
    marginBottom: 8,
  },
  infoText: {
    fontSize: 14,
    color: '#1565c0',
    lineHeight: 20,
  },
  buttonContainer: {
    padding: 20,
    backgroundColor: 'white',
    borderTopWidth: 1,
    borderTopColor: '#eee',
  },
  saveButton: {
    backgroundColor: '#4CAF50',
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