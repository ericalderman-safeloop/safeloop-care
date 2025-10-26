import { supabase } from './supabase'

export interface UserProfile {
  id: string
  auth_user_id: string
  safeloop_account_id?: string
  email: string
  display_name?: string
  phone_number?: string
  user_type: 'caregiver' | 'caregiver_admin'
  is_active: boolean
  profile_image_url?: string
  timezone: string
  created_at: string
  updated_at: string
}

export interface CreateUserProfileData {
  display_name: string
  phone_number?: string
}

export interface InvitationInfo {
  invitation_id: string
  invitation_token: string
  safeloop_account_id: string
  invited_by: string
  user_type: 'caregiver'
}

export interface Wearer {
  id: string
  safeloop_account_id: string
  name: string
  date_of_birth?: string
  gender?: 'male' | 'female' | 'other' | 'prefer_not_to_say'
  medical_conditions?: string[]
  medications?: string[]
  allergies?: string[]
  emergency_notes?: string
  wearer_contact_phone?: string
  created_at: string
  updated_at: string
  device?: {
    id: string
    seven_digit_code: string
    device_model?: string
    is_verified: boolean
    last_seen?: string
  }[]
}

export interface CreateWearerData {
  name: string
  date_of_birth?: string
  seven_digit_code: string
}

export interface HelpRequest {
  id: string
  wearer_id: string
  device_id?: string
  request_type: 'manual_request' | 'fall'
  event_status: 'active' | 'responded_to' | 'resolved' | 'false_alarm'
  fall_response?: 'confirmed' | 'unresponsive'
  location_latitude?: number
  location_longitude?: number
  location_accuracy?: number
  location_timestamp?: string
  responded_by?: string
  responded_at?: string
  resolved_at?: string
  notes?: string
  created_at: string
  wearer?: {
    id: string
    name: string
    date_of_birth?: string
    gender?: string
    medical_conditions?: string[]
    medications?: string[]
    allergies?: string[]
    emergency_notes?: string
    wearer_contact_phone?: string
  }
}

export const userService = {
  // Check if user profile exists
  async getUserProfile(authUserId: string): Promise<UserProfile | null> {
    const { data, error } = await supabase
      .from('users')
      .select('*')
      .eq('auth_user_id', authUserId)
      .single()

    if (error) {
      if (error.code === 'PGRST116') {
        // No rows found - user doesn't exist yet
        return null
      }
      throw error
    }

    return data
  },

  // Check for outstanding invitation for this email
  async checkInvitation(email: string): Promise<InvitationInfo | null> {
    const { data, error } = await supabase
      .from('caregiver_invitations')
      .select('id, invitation_token, safeloop_account_id, invited_by')
      .eq('email', email)
      .eq('status', 'pending')
      .gt('expires_at', new Date().toISOString())
      .single()

    if (error) {
      if (error.code === 'PGRST116') {
        // No invitation found
        return null
      }
      throw error
    }

    return {
      invitation_id: data.id,
      invitation_token: data.invitation_token,
      safeloop_account_id: data.safeloop_account_id,
      invited_by: data.invited_by,
      user_type: 'caregiver'
    }
  },

  // Create user profile for invited caregiver
  async createInvitedUserProfile(
    authUserId: string, 
    email: string, 
    profileData: CreateUserProfileData,
    invitationInfo: InvitationInfo
  ): Promise<UserProfile> {
    // Use the existing accept_caregiver_invitation database function
    const { data: userId, error: acceptError } = await supabase
      .rpc('accept_caregiver_invitation', {
        p_invitation_token: invitationInfo.invitation_token,
        p_email: email,
        p_display_name: profileData.display_name,
        p_phone_number: profileData.phone_number || null
      })

    if (acceptError) {
      throw acceptError
    }

    // Get the created user profile
    const { data: userData, error: userError } = await supabase
      .from('users')
      .select('*')
      .eq('auth_user_id', authUserId)
      .single()

    if (userError) {
      throw userError
    }

    return userData
  },

  // Create user profile for new admin (no invitation)
  async createAdminUserProfile(authUserId: string, email: string, profileData: CreateUserProfileData): Promise<UserProfile> {
    // Use the existing create_safeloop_account database function
    const { data: accountId, error: accountError } = await supabase
      .rpc('create_safeloop_account', {
        p_account_name: `${profileData.display_name}'s SafeLoop Account`,
        p_admin_email: email,
        p_admin_display_name: profileData.display_name,
        p_admin_phone: profileData.phone_number || null
      })

    if (accountError) {
      throw accountError
    }

    // Get the created user profile
    const { data: userData, error: userError } = await supabase
      .from('users')
      .select('*')
      .eq('auth_user_id', authUserId)
      .single()

    if (userError) {
      throw userError
    }

    return userData
  },

  // Update user profile
  async updateUserProfile(userId: string, profileData: Partial<CreateUserProfileData>): Promise<UserProfile> {
    const { data, error } = await supabase
      .from('users')
      .update({
        ...profileData,
        updated_at: new Date().toISOString(),
      })
      .eq('id', userId)
      .select()
      .single()

    if (error) {
      throw error
    }

    return data
  },

  // Check if user has completed profile setup
  async hasCompletedProfile(userProfile: UserProfile): Promise<boolean> {
    return !!(userProfile.display_name && userProfile.display_name.trim().length > 0)
  },

  // Update push notification token for the user
  async updatePushToken(userId: string, apnsToken?: string, fcmToken?: string): Promise<void> {
    const updates: any = {
      updated_at: new Date().toISOString()
    }

    if (apnsToken !== undefined) {
      updates.apns_token = apnsToken
    }
    if (fcmToken !== undefined) {
      updates.fcm_token = fcmToken
    }

    const { error } = await supabase
      .from('users')
      .update(updates)
      .eq('id', userId)

    if (error) {
      throw error
    }
  },

  // Invite a caregiver to join the account
  async inviteCaregiver(email: string, safeloopAccountId: string): Promise<void> {
    const { data, error } = await supabase.functions.invoke('invite-caregiver', {
      body: {
        email: email,
        safeloop_account_id: safeloopAccountId
      }
    })

    if (error) {
      throw error
    }

    if (!data?.success) {
      throw new Error(data?.error || 'Failed to send invitation')
    }
  },

  // Get all caregivers for the user's account
  async getCaregivers(userProfile: UserProfile): Promise<any[]> {
    if (!userProfile.safeloop_account_id) {
      throw new Error('User is not associated with a SafeLoop account')
    }

    const { data, error } = await supabase
      .from('users')
      .select('*')
      .eq('safeloop_account_id', userProfile.safeloop_account_id)
      .order('created_at', { ascending: false })

    if (error) {
      throw error
    }

    return data || []
  },

  // Get pending invitations for the user's account
  async getPendingInvitations(userProfile: UserProfile): Promise<any[]> {
    if (!userProfile.safeloop_account_id) {
      throw new Error('User is not associated with a SafeLoop account')
    }

    const { data, error } = await supabase
      .from('caregiver_invitations')
      .select('*')
      .eq('safeloop_account_id', userProfile.safeloop_account_id)
      .eq('status', 'pending')
      .order('created_at', { ascending: false })

    if (error) {
      throw error
    }

    return data || []
  },

  // =============================================
  // WEARER MANAGEMENT
  // =============================================

  // Get all wearers for the user's account
  async getWearers(userProfile: UserProfile): Promise<Wearer[]> {
    if (!userProfile.safeloop_account_id) {
      throw new Error('User is not associated with a SafeLoop account')
    }

    const { data, error } = await supabase
      .from('wearers')
      .select(`
        *,
        device:devices(id, seven_digit_code, device_model, is_verified, last_seen)
      `)
      .eq('safeloop_account_id', userProfile.safeloop_account_id)
      .order('created_at', { ascending: false })

    if (error) {
      throw error
    }

    return data || []
  },

  // Create a new wearer with device registration
  async createWearer(userProfile: UserProfile, wearerData: CreateWearerData): Promise<Wearer> {
    if (!userProfile.safeloop_account_id) {
      throw new Error('User is not associated with a SafeLoop account')
    }

    // First check if the 7-digit code is already in use
    const { data: existingDevice, error: deviceCheckError } = await supabase
      .from('devices')
      .select('id, wearer_id')
      .eq('seven_digit_code', wearerData.seven_digit_code)
      .single()

    if (deviceCheckError && deviceCheckError.code !== 'PGRST116') {
      throw deviceCheckError
    }

    if (existingDevice && existingDevice.wearer_id) {
      throw new Error('This device code is already registered to another wearer')
    }

    // Create the wearer
    const { data: wearer, error: wearerError } = await supabase
      .from('wearers')
      .insert({
        safeloop_account_id: userProfile.safeloop_account_id,
        name: wearerData.name,
        date_of_birth: wearerData.date_of_birth || null
      })
      .select()
      .single()

    if (wearerError) {
      throw wearerError
    }

    // If device exists but isn't assigned, assign it to this wearer
    if (existingDevice && !existingDevice.wearer_id) {
      const { error: updateError } = await supabase
        .from('devices')
        .update({ wearer_id: wearer.id })
        .eq('id', existingDevice.id)

      if (updateError) {
        // Clean up the wearer if device assignment fails
        await supabase.from('wearers').delete().eq('id', wearer.id)
        throw updateError
      }
    } else {
      // Create a new device record (this handles the case where the device hasn't contacted the server yet)
      const { error: deviceError } = await supabase
        .from('devices')
        .insert({
          device_uuid: `temp-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`, // Temporary UUID
          seven_digit_code: wearerData.seven_digit_code,
          wearer_id: wearer.id,
          is_verified: false // This will show as "Pending" until watch verification
        })

      if (deviceError) {
        // Clean up the wearer if device creation fails
        await supabase.from('wearers').delete().eq('id', wearer.id)
        throw deviceError
      }
    }

    // Return the complete wearer with device info
    return this.getWearerById(wearer.id)
  },

  // Get a single wearer by ID
  async getWearerById(wearerId: string): Promise<Wearer> {
    const { data, error } = await supabase
      .from('wearers')
      .select(`
        *,
        device:devices(id, seven_digit_code, device_model, is_verified, last_seen)
      `)
      .eq('id', wearerId)
      .single()

    if (error) {
      throw error
    }

    return data
  },

  // Update wearer information
  async updateWearer(wearerId: string, updates: Partial<Omit<Wearer, 'id' | 'safeloop_account_id' | 'created_at' | 'updated_at' | 'device'>>): Promise<Wearer> {
    const { data, error } = await supabase
      .from('wearers')
      .update({
        ...updates,
        updated_at: new Date().toISOString()
      })
      .eq('id', wearerId)
      .select()
      .single()

    if (error) {
      throw error
    }

    return this.getWearerById(wearerId)
  },

  // Delete a wearer (with confirmation)
  async deleteWearer(wearerId: string): Promise<void> {
    // Delete the wearer - associated devices will be automatically deleted via CASCADE
    const { error: wearerError } = await supabase
      .from('wearers')
      .delete()
      .eq('id', wearerId)

    if (wearerError) {
      throw wearerError
    }
  },

  // =============================================
  // CAREGIVER-WEARER ASSIGNMENT MANAGEMENT
  // =============================================

  // Get caregivers assigned to a specific wearer
  async getAssignedCaregivers(wearerId: string): Promise<any[]> {
    // First get the assignments
    const { data: assignments, error: assignmentsError } = await supabase
      .from('caregiver_wearer_assignments')
      .select('*')
      .eq('wearer_id', wearerId)

    if (assignmentsError) {
      console.error('Error fetching assignments:', assignmentsError)
      throw assignmentsError
    }

    if (!assignments || assignments.length === 0) {
      return []
    }

    // Then get the user details for each caregiver
    const caregiverIds = assignments.map((a: any) => a.caregiver_user_id)
    const { data: caregivers, error: caregiversError } = await supabase
      .from('users')
      .select('id, email, display_name, phone_number, user_type')
      .in('id', caregiverIds)

    if (caregiversError) {
      console.error('Error fetching caregivers:', caregiversError)
      throw caregiversError
    }

    // Combine the data
    return assignments.map((assignment: any) => {
      const caregiver = caregivers?.find((c: any) => c.id === assignment.caregiver_user_id)
      return {
        assignment_id: assignment.id,
        id: caregiver?.id,
        email: caregiver?.email,
        display_name: caregiver?.display_name,
        phone_number: caregiver?.phone_number,
        user_type: caregiver?.user_type,
        relationship_type: assignment.relationship_type,
        is_primary: assignment.is_primary,
        is_emergency_contact: assignment.is_emergency_contact
      }
    })
  },

  // Get caregivers available to assign (not yet assigned to this wearer)
  async getAvailableCaregivers(userProfile: UserProfile, wearerId: string): Promise<any[]> {
    if (!userProfile.safeloop_account_id) {
      throw new Error('User is not associated with a SafeLoop account')
    }

    // Get all caregivers for the account
    const { data: allCaregivers, error: caregiversError } = await supabase
      .from('users')
      .select('id, email, display_name, phone_number, user_type')
      .eq('safeloop_account_id', userProfile.safeloop_account_id)

    if (caregiversError) {
      throw caregiversError
    }

    // Get already assigned caregivers
    const { data: assignments, error: assignmentsError } = await supabase
      .from('caregiver_wearer_assignments')
      .select('caregiver_user_id')
      .eq('wearer_id', wearerId)

    if (assignmentsError) {
      throw assignmentsError
    }

    const assignedIds = new Set((assignments || []).map((a: any) => a.caregiver_user_id))

    // Filter out already assigned caregivers
    return (allCaregivers || []).filter((c: any) => !assignedIds.has(c.id))
  },

  // Assign a caregiver to a wearer
  async assignCaregiverToWearer(caregiverUserId: string, wearerId: string): Promise<void> {
    const { error } = await supabase.rpc('assign_caregiver_to_wearer', {
      p_caregiver_user_id: caregiverUserId,
      p_wearer_id: wearerId,
      p_relationship_type: 'family',
      p_is_primary: false,
      p_is_emergency_contact: false
    })

    if (error) {
      throw error
    }
  },

  // Remove a caregiver from a wearer
  async removeCaregiverFromWearer(assignmentId: string): Promise<void> {
    const { error } = await supabase
      .from('caregiver_wearer_assignments')
      .delete()
      .eq('id', assignmentId)

    if (error) {
      throw error
    }
  },

  // Get active help requests for caregivers assigned to specific wearers
  async getActiveHelpRequests(safeloopAccountId: string): Promise<HelpRequest[]> {
    const { data, error } = await supabase
      .from('help_requests')
      .select(`
        id,
        wearer_id,
        device_id,
        request_type,
        event_status,
        fall_response,
        location_latitude,
        location_longitude,
        location_accuracy,
        location_timestamp,
        responded_by,
        responded_at,
        resolved_at,
        notes,
        created_at,
        wearer:wearers!inner(
          id,
          name,
          safeloop_account_id
        )
      `)
      .eq('event_status', 'active')
      .eq('wearer.safeloop_account_id', safeloopAccountId)
      .order('created_at', { ascending: false })

    if (error) {
      throw error
    }

    return data || []
  },

  // Get resolved help requests (resolved and false_alarm)
  async getResolvedHelpRequests(safeloopAccountId: string, limit: number = 50): Promise<HelpRequest[]> {
    const { data, error } = await supabase
      .from('help_requests')
      .select(`
        id,
        wearer_id,
        device_id,
        request_type,
        event_status,
        fall_response,
        location_latitude,
        location_longitude,
        location_accuracy,
        location_timestamp,
        responded_by,
        responded_at,
        resolved_at,
        notes,
        created_at,
        wearer:wearers!inner(
          id,
          name,
          safeloop_account_id
        )
      `)
      .in('event_status', ['resolved', 'false_alarm'])
      .eq('wearer.safeloop_account_id', safeloopAccountId)
      .order('resolved_at', { ascending: false })
      .limit(limit)

    if (error) {
      throw error
    }

    return data || []
  },

  // Get single help request with full details
  async getHelpRequestDetails(helpRequestId: string): Promise<HelpRequest | null> {
    const { data, error } = await supabase
      .from('help_requests')
      .select(`
        id,
        wearer_id,
        device_id,
        request_type,
        event_status,
        fall_response,
        location_latitude,
        location_longitude,
        location_accuracy,
        location_timestamp,
        responded_by,
        responded_at,
        resolved_at,
        notes,
        created_at,
        wearer:wearers!inner(
          id,
          name,
          date_of_birth,
          gender,
          medical_conditions,
          medications,
          allergies,
          emergency_notes,
          wearer_contact_phone
        )
      `)
      .eq('id', helpRequestId)
      .single()

    if (error) {
      if (error.code === 'PGRST116') {
        return null
      }
      throw error
    }

    return data
  },

  // Update help request status
  async updateHelpRequestStatus(
    helpRequestId: string,
    status: 'responded_to' | 'resolved' | 'false_alarm',
    userId: string,
    notes?: string
  ): Promise<void> {
    const updates: any = {
      event_status: status
    }

    if (status === 'responded_to') {
      updates.responded_by = userId
      updates.responded_at = new Date().toISOString()
    } else if (status === 'resolved' || status === 'false_alarm') {
      updates.resolved_at = new Date().toISOString()
    }

    if (notes) {
      updates.notes = notes
    }

    const { error } = await supabase
      .from('help_requests')
      .update(updates)
      .eq('id', helpRequestId)

    if (error) {
      throw error
    }
  },

}