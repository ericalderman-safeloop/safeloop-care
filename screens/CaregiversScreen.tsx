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
import { userService } from '../lib/userService'
import { useFocusEffect } from '@react-navigation/native'

interface CaregiversScreenProps {
  navigation: any
}

interface CaregiverUser {
  id: string
  email: string
  display_name?: string
  phone_number?: string
  user_type: 'caregiver' | 'caregiver_admin'
  is_active: boolean
  created_at: string
}

interface PendingInvitation {
  id: string
  email: string
  invited_by_name?: string
  status: 'pending' | 'accepted' | 'expired'
  expires_at: string
  created_at: string
}

export default function CaregiversScreen({ navigation }: CaregiversScreenProps) {
  const { userProfile } = useAuth()
  const [caregivers, setCaregivers] = useState<CaregiverUser[]>([])
  const [invitations, setInvitations] = useState<PendingInvitation[]>([])
  const [loading, setLoading] = useState(true)
  const [refreshing, setRefreshing] = useState(false)

  const isAdmin = userProfile?.user_type === 'caregiver_admin'

  const loadCaregivers = async () => {
    if (!userProfile) return

    try {
      const [caregiversList, invitationsList] = await Promise.all([
        userService.getCaregivers(userProfile),
        userService.getPendingInvitations(userProfile)
      ])
      setCaregivers(caregiversList)
      setInvitations(invitationsList)
    } catch (error) {
      console.error('Error loading caregivers:', error)
      Alert.alert('Error', 'Failed to load caregivers. Please try again.')
    } finally {
      setLoading(false)
    }
  }

  const handleRefresh = async () => {
    setRefreshing(true)
    await loadCaregivers()
    setRefreshing(false)
  }

  const handleResendInvitation = async (invitation: PendingInvitation) => {
    if (!isAdmin) {
      Alert.alert('Error', 'Only account admins can resend invitations.')
      return
    }

    if (!userProfile?.safeloop_account_id) {
      Alert.alert('Error', 'Account information not found.')
      return
    }

    Alert.alert(
      'Resend Invitation',
      `Send a new invitation to ${invitation.email}?`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Resend',
          onPress: async () => {
            try {
              await userService.inviteCaregiver(invitation.email, userProfile.safeloop_account_id!)
              Alert.alert('Success', `Invitation resent to ${invitation.email}`)
              await loadCaregivers()
            } catch (error: any) {
              console.error('Error resending invitation:', error)
              Alert.alert('Error', error.message || 'Failed to resend invitation.')
            }
          }
        }
      ]
    )
  }

  const formatDate = (dateString: string) => {
    const date = new Date(dateString)
    return date.toLocaleDateString()
  }

  const getInvitationStatus = (invitation: PendingInvitation) => {
    const expiresAt = new Date(invitation.expires_at)
    const now = new Date()

    if (expiresAt < now) {
      return { text: 'Expired', color: '#f44336' }
    }

    return { text: 'Pending', color: '#ff9800' }
  }

  // Refresh when screen comes into focus
  useFocusEffect(
    useCallback(() => {
      if (userProfile) {
        loadCaregivers()
      }
    }, [userProfile])
  )

  if (loading) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color="#2196F3" />
        <Text style={styles.loadingText}>Loading caregivers...</Text>
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
        <Text style={styles.title}>Caregivers</Text>
      </View>

      <ScrollView
        style={styles.content}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={handleRefresh} />
        }
      >

        {isAdmin && (
          <TouchableOpacity
            style={styles.inviteButton}
            onPress={() => navigation.navigate('InviteCaregiver')}
          >
            <Text style={styles.inviteButtonIcon}>✉️</Text>
            <Text style={styles.inviteButtonText}>Invite New Caregiver</Text>
          </TouchableOpacity>
        )}

        {/* Active Caregivers Section */}
        <View style={styles.section}>
        <Text style={styles.sectionTitle}>Active Caregivers ({caregivers.length})</Text>
        {caregivers.length === 0 ? (
          <View style={styles.emptyState}>
            <Text style={styles.emptyStateIcon}>👥</Text>
            <Text style={styles.emptyStateText}>No caregivers yet</Text>
            {isAdmin && (
              <Text style={styles.emptyStateSubtext}>
                Invite team members to help monitor alerts
              </Text>
            )}
          </View>
        ) : (
          caregivers.map((caregiver) => (
            <View key={caregiver.id} style={styles.caregiverCard}>
              <View style={styles.caregiverHeader}>
                <View style={styles.caregiverInfo}>
                  <View style={styles.caregiverNameRow}>
                    <Text style={styles.caregiverName}>
                      {caregiver.display_name || 'Unnamed User'}
                    </Text>
                    {caregiver.user_type === 'caregiver_admin' && (
                      <Text style={styles.adminBadge}>👑 Admin</Text>
                    )}
                  </View>
                  <Text style={styles.caregiverEmail}>{caregiver.email}</Text>
                  {caregiver.phone_number && (
                    <Text style={styles.caregiverPhone}>{caregiver.phone_number}</Text>
                  )}
                </View>
              </View>
              <View style={styles.caregiverFooter}>
                <Text style={styles.caregiverDate}>
                  Joined {formatDate(caregiver.created_at)}
                </Text>
                <View style={[styles.statusBadge, { backgroundColor: '#4CAF50' }]}>
                  <Text style={styles.statusText}>Active</Text>
                </View>
              </View>
            </View>
          ))
        )}
        </View>

        {/* Pending Invitations Section */}
        {isAdmin && (
          <View style={styles.section}>
          <Text style={styles.sectionTitle}>Pending Invitations ({invitations.length})</Text>
          {invitations.length === 0 ? (
            <View style={styles.emptyState}>
              <Text style={styles.emptyStateIcon}>📧</Text>
              <Text style={styles.emptyStateText}>No pending invitations</Text>
            </View>
          ) : (
            invitations.map((invitation) => {
              const status = getInvitationStatus(invitation)
              return (
                <View key={invitation.id} style={styles.invitationCard}>
                  <View style={styles.invitationInfo}>
                    <Text style={styles.invitationEmail}>{invitation.email}</Text>
                    <Text style={styles.invitationDate}>
                      Sent {formatDate(invitation.created_at)}
                    </Text>
                    <Text style={styles.invitationExpires}>
                      Expires {formatDate(invitation.expires_at)}
                    </Text>
                  </View>
                  <View style={styles.invitationActions}>
                    <View style={[styles.statusBadge, { backgroundColor: status.color }]}>
                      <Text style={styles.statusText}>{status.text}</Text>
                    </View>
                    <TouchableOpacity
                      style={styles.resendButton}
                      onPress={() => handleResendInvitation(invitation)}
                    >
                      <Text style={styles.resendButtonText}>Resend</Text>
                    </TouchableOpacity>
                  </View>
                </View>
              )
            })
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
  inviteButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#4CAF50',
    marginHorizontal: 20,
    marginTop: 20,
    marginBottom: 10,
    padding: 16,
    borderRadius: 8,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 3.84,
    elevation: 5,
  },
  inviteButtonIcon: {
    fontSize: 20,
    marginRight: 10,
  },
  inviteButtonText: {
    color: 'white',
    fontSize: 18,
    fontWeight: '600',
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
    marginBottom: 15,
  },
  caregiverCard: {
    backgroundColor: 'white',
    borderRadius: 12,
    padding: 16,
    marginBottom: 12,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 3.84,
    elevation: 5,
  },
  caregiverHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: 12,
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
    fontSize: 18,
    fontWeight: '600',
    color: '#333',
    marginRight: 8,
  },
  adminBadge: {
    fontSize: 14,
    color: '#ff9800',
    fontWeight: '500',
  },
  caregiverEmail: {
    fontSize: 14,
    color: '#666',
    marginBottom: 2,
  },
  caregiverPhone: {
    fontSize: 14,
    color: '#666',
  },
  caregiverFooter: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    borderTopWidth: 1,
    borderTopColor: '#f0f0f0',
    paddingTop: 12,
  },
  caregiverDate: {
    fontSize: 12,
    color: '#999',
  },
  statusBadge: {
    paddingHorizontal: 12,
    paddingVertical: 4,
    borderRadius: 12,
  },
  statusText: {
    color: 'white',
    fontSize: 12,
    fontWeight: '600',
  },
  invitationCard: {
    backgroundColor: 'white',
    borderRadius: 12,
    padding: 16,
    marginBottom: 12,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 3.84,
    elevation: 5,
  },
  invitationInfo: {
    flex: 1,
  },
  invitationEmail: {
    fontSize: 16,
    fontWeight: '600',
    color: '#333',
    marginBottom: 4,
  },
  invitationDate: {
    fontSize: 12,
    color: '#666',
    marginBottom: 2,
  },
  invitationExpires: {
    fontSize: 12,
    color: '#999',
  },
  invitationActions: {
    alignItems: 'flex-end',
  },
  resendButton: {
    marginTop: 8,
    paddingHorizontal: 16,
    paddingVertical: 6,
    backgroundColor: '#2196F3',
    borderRadius: 6,
  },
  resendButtonText: {
    color: 'white',
    fontSize: 14,
    fontWeight: '500',
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
