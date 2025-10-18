import React, { useState, useCallback } from 'react'
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Alert,
  ScrollView,
  ActivityIndicator,
  RefreshControl
} from 'react-native'
import { useAuth } from '../contexts/AuthContext'
import { userService, Wearer } from '../lib/userService'
import { useFocusEffect } from '@react-navigation/native'

interface WearerDetailsScreenProps {
  navigation: any
  route: {
    params: {
      wearerId: string
    }
  }
}

interface AssignedCaregiver {
  id: string
  assignment_id: string
  display_name?: string
  email: string
  phone_number?: string
  user_type: 'caregiver' | 'caregiver_admin'
  relationship_type?: string
  is_primary: boolean
  is_emergency_contact: boolean
}

interface AvailableCaregiver {
  id: string
  display_name?: string
  email: string
  phone_number?: string
  user_type: 'caregiver' | 'caregiver_admin'
}

export default function WearerDetailsScreen({ navigation, route }: WearerDetailsScreenProps) {
  const { userProfile } = useAuth()
  const { wearerId } = route.params
  const [wearer, setWearer] = useState<Wearer | null>(null)
  const [assignedCaregivers, setAssignedCaregivers] = useState<AssignedCaregiver[]>([])
  const [availableCaregivers, setAvailableCaregivers] = useState<AvailableCaregiver[]>([])
  const [loading, setLoading] = useState(true)
  const [refreshing, setRefreshing] = useState(false)

  const isAdmin = userProfile?.user_type === 'caregiver_admin'

  const loadWearerDetails = async () => {
    if (!userProfile) return

    try {
      const [wearerData, assigned, available] = await Promise.all([
        userService.getWearerById(wearerId),
        userService.getAssignedCaregivers(wearerId),
        userService.getAvailableCaregivers(userProfile, wearerId)
      ])

      setWearer(wearerData)
      setAssignedCaregivers(assigned)
      setAvailableCaregivers(available)
    } catch (error) {
      console.error('Error loading wearer details:', error)
      Alert.alert('Error', 'Failed to load wearer details. Please try again.')
    } finally {
      setLoading(false)
    }
  }

  const handleRefresh = async () => {
    setRefreshing(true)
    await loadWearerDetails()
    setRefreshing(false)
  }

  const handleAssignCaregiver = (caregiver: AvailableCaregiver) => {
    if (!isAdmin) {
      Alert.alert('Error', 'Only account admins can assign caregivers.')
      return
    }

    Alert.alert(
      'Assign Caregiver',
      `Assign ${caregiver.display_name || caregiver.email} to ${wearer?.name}?`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Assign',
          onPress: async () => {
            try {
              await userService.assignCaregiverToWearer(caregiver.id, wearerId)
              Alert.alert('Success', 'Caregiver assigned successfully')
              await loadWearerDetails()
            } catch (error: any) {
              console.error('Error assigning caregiver:', error)
              Alert.alert('Error', error.message || 'Failed to assign caregiver.')
            }
          }
        }
      ]
    )
  }

  const handleRemoveCaregiver = (assigned: AssignedCaregiver) => {
    if (!isAdmin) {
      Alert.alert('Error', 'Only account admins can remove caregivers.')
      return
    }

    Alert.alert(
      'Remove Caregiver',
      `Remove ${assigned.display_name || assigned.email} from ${wearer?.name}?`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Remove',
          style: 'destructive',
          onPress: async () => {
            try {
              await userService.removeCaregiverFromWearer(assigned.assignment_id)
              Alert.alert('Success', 'Caregiver removed successfully')
              await loadWearerDetails()
            } catch (error: any) {
              console.error('Error removing caregiver:', error)
              Alert.alert('Error', error.message || 'Failed to remove caregiver.')
            }
          }
        }
      ]
    )
  }

  useFocusEffect(
    useCallback(() => {
      if (userProfile) {
        loadWearerDetails()
      }
    }, [userProfile, wearerId])
  )

  if (loading) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color="#2196F3" />
        <Text style={styles.loadingText}>Loading wearer details...</Text>
      </View>
    )
  }

  if (!wearer) {
    return (
      <View style={styles.loadingContainer}>
        <Text style={styles.errorText}>Wearer not found</Text>
        <TouchableOpacity
          style={styles.errorButton}
          onPress={() => navigation.goBack()}
        >
          <Text style={styles.errorButtonText}>Go Back</Text>
        </TouchableOpacity>
      </View>
    )
  }

  const deviceStatus = wearer.device && wearer.device.length > 0 ? wearer.device[0] : null

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <TouchableOpacity
          style={styles.backButton}
          onPress={() => navigation.goBack()}
        >
          <Text style={styles.backButtonText}>‹ Back</Text>
        </TouchableOpacity>
        <Text style={styles.title} numberOfLines={1}>{wearer.name}</Text>
      </View>

      <ScrollView
        style={styles.content}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={handleRefresh} />
        }
      >
        {/* Wearer Info Card */}
        <View style={styles.infoCard}>
          <Text style={styles.infoCardTitle}>Wearer Information</Text>
          {wearer.date_of_birth && (
            <View style={styles.infoRow}>
              <Text style={styles.infoLabel}>Date of Birth:</Text>
              <Text style={styles.infoValue}>
                {new Date(wearer.date_of_birth).toLocaleDateString()}
              </Text>
            </View>
          )}
          {deviceStatus && (
            <>
              <View style={styles.infoRow}>
                <Text style={styles.infoLabel}>Device Code:</Text>
                <Text style={styles.infoValue}>{deviceStatus.seven_digit_code}</Text>
              </View>
              <View style={styles.infoRow}>
                <Text style={styles.infoLabel}>Device Status:</Text>
                <Text style={[styles.infoValue, { color: deviceStatus.is_verified ? '#4CAF50' : '#ff9800' }]}>
                  {deviceStatus.is_verified ? 'Verified' : 'Pending Verification'}
                </Text>
              </View>
            </>
          )}
        </View>

        {/* Assigned Caregivers Section */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>
            Assigned Caregivers ({assignedCaregivers.length})
          </Text>
          {assignedCaregivers.length === 0 ? (
            <View style={styles.emptyState}>
              <Text style={styles.emptyStateIcon}>👥</Text>
              <Text style={styles.emptyStateText}>No caregivers assigned yet</Text>
              {isAdmin && (
                <Text style={styles.emptyStateSubtext}>
                  Assign caregivers from the list below
                </Text>
              )}
            </View>
          ) : (
            assignedCaregivers.map((caregiver) => (
              <View key={caregiver.assignment_id} style={styles.caregiverCard}>
                <View style={styles.caregiverInfo}>
                  <View style={styles.caregiverNameRow}>
                    <Text style={styles.caregiverName}>
                      {caregiver.display_name || 'Unnamed User'}
                    </Text>
                    {caregiver.user_type === 'caregiver_admin' && (
                      <Text style={styles.adminBadge}>👑</Text>
                    )}
                  </View>
                  <Text style={styles.caregiverEmail}>{caregiver.email}</Text>
                  {caregiver.phone_number && (
                    <Text style={styles.caregiverPhone}>{caregiver.phone_number}</Text>
                  )}
                  <View style={styles.badgeRow}>
                    {caregiver.is_primary && (
                      <View style={[styles.badge, styles.primaryBadge]}>
                        <Text style={styles.badgeText}>Primary</Text>
                      </View>
                    )}
                    {caregiver.is_emergency_contact && (
                      <View style={[styles.badge, styles.emergencyBadge]}>
                        <Text style={styles.badgeText}>Emergency</Text>
                      </View>
                    )}
                  </View>
                </View>
                {isAdmin && (
                  <TouchableOpacity
                    style={styles.removeButton}
                    onPress={() => handleRemoveCaregiver(caregiver)}
                  >
                    <Text style={styles.removeButtonText}>Remove</Text>
                  </TouchableOpacity>
                )}
              </View>
            ))
          )}
        </View>

        {/* Available Caregivers Section (Admin Only) */}
        {isAdmin && availableCaregivers.length > 0 && (
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>
              Available Caregivers ({availableCaregivers.length})
            </Text>
            <Text style={styles.sectionDescription}>
              Tap to assign these caregivers to {wearer.name}
            </Text>
            {availableCaregivers.map((caregiver) => (
              <TouchableOpacity
                key={caregiver.id}
                style={styles.availableCaregiverCard}
                onPress={() => handleAssignCaregiver(caregiver)}
              >
                <View style={styles.caregiverInfo}>
                  <View style={styles.caregiverNameRow}>
                    <Text style={styles.caregiverName}>
                      {caregiver.display_name || 'Unnamed User'}
                    </Text>
                    {caregiver.user_type === 'caregiver_admin' && (
                      <Text style={styles.adminBadge}>👑</Text>
                    )}
                  </View>
                  <Text style={styles.caregiverEmail}>{caregiver.email}</Text>
                </View>
                <Text style={styles.assignIcon}>+</Text>
              </TouchableOpacity>
            ))}
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
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#f5f5f5',
  },
  loadingText: {
    marginTop: 10,
    fontSize: 16,
    color: '#666',
  },
  errorText: {
    fontSize: 18,
    color: '#f44336',
    marginBottom: 20,
  },
  errorButton: {
    backgroundColor: '#2196F3',
    padding: 15,
    borderRadius: 8,
  },
  errorButtonText: {
    color: 'white',
    fontSize: 16,
    fontWeight: '600',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 20,
    paddingTop: 60,
    backgroundColor: '#2196F3',
  },
  backButton: {
    padding: 10,
    marginRight: 10,
  },
  backButtonText: {
    color: 'white',
    fontSize: 28,
    fontWeight: '300',
  },
  title: {
    fontSize: 28,
    fontWeight: 'bold',
    color: 'white',
    flex: 1,
  },
  content: {
    flex: 1,
  },
  infoCard: {
    backgroundColor: 'white',
    margin: 20,
    marginBottom: 10,
    padding: 16,
    borderRadius: 12,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 3.84,
    elevation: 5,
  },
  infoCardTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: '#333',
    marginBottom: 12,
  },
  infoRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingVertical: 8,
    borderBottomWidth: 1,
    borderBottomColor: '#f0f0f0',
  },
  infoLabel: {
    fontSize: 14,
    color: '#666',
  },
  infoValue: {
    fontSize: 14,
    fontWeight: '500',
    color: '#333',
  },
  section: {
    paddingHorizontal: 20,
    paddingTop: 10,
    paddingBottom: 20,
  },
  sectionTitle: {
    fontSize: 20,
    fontWeight: '600',
    color: '#333',
    marginBottom: 8,
  },
  sectionDescription: {
    fontSize: 14,
    color: '#666',
    marginBottom: 15,
    fontStyle: 'italic',
  },
  caregiverCard: {
    backgroundColor: 'white',
    borderRadius: 12,
    padding: 16,
    marginBottom: 12,
    flexDirection: 'row',
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 3.84,
    elevation: 5,
  },
  availableCaregiverCard: {
    backgroundColor: 'white',
    borderRadius: 12,
    padding: 16,
    marginBottom: 12,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 3.84,
    elevation: 5,
    borderWidth: 2,
    borderColor: '#e0e0e0',
  },
  caregiverInfo: {
    flex: 1,
  },
  caregiverNameRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 4,
  },
  caregiverName: {
    fontSize: 16,
    fontWeight: '600',
    color: '#333',
    marginRight: 8,
  },
  adminBadge: {
    fontSize: 14,
    color: '#ff9800',
  },
  caregiverEmail: {
    fontSize: 14,
    color: '#666',
    marginBottom: 2,
  },
  caregiverPhone: {
    fontSize: 14,
    color: '#666',
    marginBottom: 6,
  },
  badgeRow: {
    flexDirection: 'row',
    marginTop: 4,
  },
  badge: {
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 12,
    marginRight: 8,
  },
  primaryBadge: {
    backgroundColor: '#2196F3',
  },
  emergencyBadge: {
    backgroundColor: '#f44336',
  },
  badgeText: {
    color: 'white',
    fontSize: 11,
    fontWeight: '600',
  },
  removeButton: {
    backgroundColor: '#f44336',
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 6,
    marginLeft: 10,
  },
  removeButtonText: {
    color: 'white',
    fontSize: 14,
    fontWeight: '600',
  },
  assignIcon: {
    fontSize: 32,
    color: '#4CAF50',
    fontWeight: '300',
  },
  emptyState: {
    alignItems: 'center',
    padding: 40,
    backgroundColor: 'white',
    borderRadius: 12,
    marginBottom: 12,
  },
  emptyStateIcon: {
    fontSize: 48,
    marginBottom: 16,
  },
  emptyStateText: {
    fontSize: 18,
    fontWeight: '600',
    color: '#333',
    marginBottom: 8,
  },
  emptyStateSubtext: {
    fontSize: 14,
    color: '#666',
    textAlign: 'center',
  },
})
