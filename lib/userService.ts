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
  push_notifications_enabled: boolean
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
  photo_url?: string | null
  fall_detection_mode?: 'apple' | 'custom'
  created_at: string
  updated_at: string
  device?: {
    id: string
    seven_digit_code: string
    device_model?: string
    is_verified: boolean
    last_seen?: string
    battery_level?: number | null
    battery_state?: 'unknown' | 'unplugged' | 'charging' | 'full' | null
    monitoring_state?: 'active' | 'driving' | 'sos' | null
  }[]
}

export interface CreateWearerData {
  name: string
  date_of_birth?: string
  seven_digit_code: string
  wearer_contact_phone?: string
  photo_url?: string
}

export interface NotesLogEntry {
  id: string
  help_request_id: string
  notes: string | null
  changed_by_user_id: string | null
  changed_by_display_name: string
  changed_at: string
  created_at: string
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
  resolved_by?: string
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
    photo_url?: string
  }
  resolver?: {
    id: string
    display_name: string
  }
  responder?: {
    id: string
    display_name: string
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

  // Check for outstanding invitation by token (from deep link)
  async checkInvitationByToken(token: string): Promise<InvitationInfo | null> {
    const { data, error } = await supabase
      .from('caregiver_invitations')
      .select('id, invitation_token, safeloop_account_id, invited_by')
      .eq('invitation_token', token)
      .eq('status', 'pending')
      .gt('expires_at', new Date().toISOString())
      .single()

    if (error) {
      if (error.code === 'PGRST116') return null
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

  // Check for outstanding invitation for this email
  async checkInvitation(email: string): Promise<InvitationInfo | null> {
    const { data, error } = await supabase
      .from('caregiver_invitations')
      .select('id, invitation_token, safeloop_account_id, invited_by')
      .eq('email', email.trim().toLowerCase())
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
    const { error: acceptError } = await supabase
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
    const { error: accountError } = await supabase
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

  // Update push notification enabled/disabled setting
  async updatePushNotificationEnabled(userId: string, enabled: boolean): Promise<void> {
    const { error } = await supabase
      .from('users')
      .update({
        push_notifications_enabled: enabled,
        updated_at: new Date().toISOString()
      })
      .eq('id', userId)

    if (error) {
      throw error
    }
  },

  // Read the caregiver's preferred sound for help-request / fall alerts.
  // Defaults to 'alarm' if the row is missing (matches DB default).
  async getHelpRequestSound(userId: string): Promise<'alarm' | 'standard'> {
    const { data, error } = await supabase
      .from('notification_preferences')
      .select('help_request_sound')
      .eq('user_id', userId)
      .maybeSingle()

    if (error) throw error
    const value = data?.help_request_sound
    return value === 'standard' ? 'standard' : 'alarm'
  },

  async setHelpRequestSound(userId: string, sound: 'alarm' | 'standard'): Promise<void> {
    const { error } = await supabase
      .from('notification_preferences')
      .update({ help_request_sound: sound, updated_at: new Date().toISOString() })
      .eq('user_id', userId)

    if (error) throw error
  },

  // Invite a caregiver to join the account
  async inviteCaregiver(
    email: string,
    safeloopAccountId: string,
    wearerIds: string[] = [],
    invitedUserType: 'caregiver' | 'caregiver_admin' = 'caregiver'
  ): Promise<void> {
    const { data, error } = await supabase.functions.invoke('invite-caregiver', {
      body: {
        email: email.trim().toLowerCase(),
        safeloop_account_id: safeloopAccountId,
        wearer_ids: wearerIds,
        invited_user_type: invitedUserType
      }
    })

    if (error) {
      throw error
    }

    if (!data?.success) {
      throw new Error(data?.error || 'Failed to send invitation')
    }
  },

  // Promote or demote an existing caregiver
  async updateCaregiverRole(
    targetUserId: string,
    newUserType: 'caregiver' | 'caregiver_admin'
  ): Promise<void> {
    const { data, error } = await supabase.functions.invoke('update-caregiver-role', {
      body: { target_user_id: targetUserId, new_user_type: newUserType }
    })

    if (error) throw error
    if (data?.error) throw new Error(data.error)
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

  // Cancel a pending invitation
  async cancelInvitation(invitationId: string): Promise<void> {
    const { error } = await supabase
      .from('caregiver_invitations')
      .delete()
      .eq('id', invitationId)
      .eq('status', 'pending')

    if (error) throw error
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
        device:devices(id, seven_digit_code, device_model, is_verified, last_seen, battery_level, battery_state, monitoring_state)
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

    // Read the per-account default mode so admin's Settings preference
    // applies to newly created wearers. Falls back to 'apple' if unset.
    const defaultMode = await this.getAccountDefaultFallMode(userProfile.safeloop_account_id)

    // Create the wearer
    const { data: wearer, error: wearerError } = await supabase
      .from('wearers')
      .insert({
        safeloop_account_id: userProfile.safeloop_account_id,
        name: wearerData.name,
        date_of_birth: wearerData.date_of_birth || null,
        wearer_contact_phone: wearerData.wearer_contact_phone || null,
        fall_detection_mode: defaultMode,
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
          device_uuid: `temp-${Date.now()}-${Math.random().toString(36).substring(2, 11)}`, // Temporary UUID
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
        device:devices(id, seven_digit_code, device_model, is_verified, last_seen, battery_level, battery_state, monitoring_state)
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
    const { error } = await supabase
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

  async setFallDetectionMode(wearerId: string, mode: 'apple' | 'custom'): Promise<void> {
    // Routed through an edge function so the server can push a silent APNs
    // notification to the watch and apply the new mode in real time, rather
    // than waiting for the wearer to next launch the watch app.
    const { error } = await supabase.functions.invoke('set-fall-detection-mode', {
      body: { wearer_id: wearerId, mode },
    })
    if (error) throw error
  },

  // =============================================
  // FALL DETECTION DEFAULTS + SENSITIVITY
  // =============================================

  async getAccountDefaultFallMode(safeloopAccountId: string): Promise<'apple' | 'custom'> {
    const { data } = await supabase
      .from('safeloop_accounts')
      .select('default_fall_detection_mode')
      .eq('id', safeloopAccountId)
      .maybeSingle()
    return (data?.default_fall_detection_mode as 'apple' | 'custom') ?? 'apple'
  },

  async setAccountDefaultFallMode(safeloopAccountId: string, mode: 'apple' | 'custom'): Promise<void> {
    const { error } = await supabase
      .from('safeloop_accounts')
      .update({ default_fall_detection_mode: mode })
      .eq('id', safeloopAccountId)
    if (error) throw error
  },

  async getGlobalFallSensitivity(): Promise<'low' | 'medium' | 'high'> {
    const { data } = await supabase
      .from('fall_detection_settings')
      .select('sensitivity')
      .eq('wearer_device_id', 'GLOBAL')
      .maybeSingle()
    return (data?.sensitivity as 'low' | 'medium' | 'high') ?? 'medium'
  },

  async getWearerFallSensitivity(wearerDeviceId: string): Promise<'low' | 'medium' | 'high' | null> {
    const { data } = await supabase
      .from('fall_detection_settings')
      .select('sensitivity')
      .eq('wearer_device_id', wearerDeviceId)
      .maybeSingle()
    return (data?.sensitivity as 'low' | 'medium' | 'high') ?? null
  },

  async setFallSensitivity(wearerDeviceId: string, sensitivity: 'low' | 'medium' | 'high'): Promise<void> {
    // Routed through an edge function so the server can push a silent APNs
    // notification to the watch and apply the new sensitivity in real time
    // (same pattern as set-fall-detection-mode).
    const { error } = await supabase.functions.invoke('set-fall-detection-sensitivity', {
      body: { wearer_device_id: wearerDeviceId, sensitivity },
    })
    if (error) throw error
  },

  async clearWearerFallSensitivity(wearerDeviceId: string): Promise<void> {
    const { error } = await supabase.functions.invoke('set-fall-detection-sensitivity', {
      body: { wearer_device_id: wearerDeviceId, sensitivity: null },
    })
    if (error) throw error
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
    const { data, error } = await supabase
      .from('caregiver_wearer_assignments')
      .select(`
        id,
        relationship_type,
        is_primary,
        is_emergency_contact,
        users!caregiver_user_id (
          id,
          email,
          display_name,
          phone_number,
          user_type
        )
      `)
      .eq('wearer_id', wearerId)

    if (error) {
      console.error('Error fetching assigned caregivers:', error)
      throw error
    }

    return (data ?? []).map((row: any) => ({
      assignment_id: row.id,
      id: row.users?.id,
      email: row.users?.email,
      display_name: row.users?.display_name,
      phone_number: row.users?.phone_number,
      user_type: row.users?.user_type,
      relationship_type: row.relationship_type,
      is_primary: row.is_primary,
      is_emergency_contact: row.is_emergency_contact
    }))
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

  // Upload a wearer headshot to storage and return the public URL
  async uploadWearerPhoto(wearerId: string, imageUri: string): Promise<string> {
    const fileName = `${wearerId}/headshot.jpg`
    const supabaseUrl = process.env.EXPO_PUBLIC_SUPABASE_URL!

    // FormData with a file URI is the only reliable upload method in React Native —
    // both fetch().blob() and XHR responseType=blob produce empty files on iOS.
    const formData = new FormData()
    formData.append('file', { uri: imageUri, type: 'image/jpeg', name: 'headshot.jpg' } as any)

    const { data: { session } } = await supabase.auth.getSession()

    const response = await fetch(
      `${supabaseUrl}/storage/v1/object/wearer-photos/${fileName}`,
      {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${session?.access_token}`,
          'x-upsert': 'true',
        },
        body: formData,
      }
    )

    if (!response.ok) {
      const text = await response.text()
      throw new Error(`Photo upload failed: ${text}`)
    }

    return `${supabaseUrl}/storage/v1/object/public/wearer-photos/${fileName}?t=${Date.now()}`
  },

  // Get active help requests for a specific caregiver (only wearers they're assigned to)
  async getActiveHelpRequestsForCaregiver(caregiverUserId: string): Promise<HelpRequest[]> {
    const { data: assignments, error: assignmentsError } = await supabase
      .from('caregiver_wearer_assignments')
      .select('wearer_id')
      .eq('caregiver_user_id', caregiverUserId)

    if (assignmentsError) throw assignmentsError

    const wearerIds = (assignments || []).map((a: any) => a.wearer_id)
    if (wearerIds.length === 0) return []

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
        ),
        responder:users!responded_by(
          id,
          display_name
        )
      `)
      .in('event_status', ['active', 'responded_to'])
      .in('wearer_id', wearerIds)
      .order('created_at', { ascending: false })

    if (error) throw error
    return (data || []) as unknown as HelpRequest[]
  },

  // Get resolved help requests for a specific caregiver (only wearers they're assigned to)
  async getResolvedHelpRequestsForCaregiver(caregiverUserId: string, limit: number = 50): Promise<HelpRequest[]> {
    const { data: assignments, error: assignmentsError } = await supabase
      .from('caregiver_wearer_assignments')
      .select('wearer_id')
      .eq('caregiver_user_id', caregiverUserId)

    if (assignmentsError) throw assignmentsError

    const wearerIds = (assignments || []).map((a: any) => a.wearer_id)
    if (wearerIds.length === 0) return []

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
        resolved_by,
        resolved_at,
        notes,
        created_at,
        wearer:wearers!inner(
          id,
          name,
          safeloop_account_id
        ),
        resolver:users!resolved_by(
          id,
          display_name
        )
      `)
      .in('event_status', ['resolved', 'false_alarm'])
      .in('wearer_id', wearerIds)
      .order('resolved_at', { ascending: false })
      .limit(limit)

    if (error) throw error
    return (data || []) as unknown as HelpRequest[]
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
        ),
        responder:users!responded_by(
          id,
          display_name
        )
      `)
      .in('event_status', ['active', 'responded_to'])
      .eq('wearer.safeloop_account_id', safeloopAccountId)
      .order('created_at', { ascending: false })

    if (error) {
      throw error
    }

    return (data || []) as unknown as HelpRequest[]
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
        resolved_by,
        resolved_at,
        notes,
        created_at,
        wearer:wearers!inner(
          id,
          name,
          safeloop_account_id
        ),
        resolver:users!resolved_by(
          id,
          display_name
        )
      `)
      .in('event_status', ['resolved', 'false_alarm'])
      .eq('wearer.safeloop_account_id', safeloopAccountId)
      .order('resolved_at', { ascending: false })
      .limit(limit)

    if (error) {
      throw error
    }

    return (data || []) as unknown as HelpRequest[]
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
          wearer_contact_phone,
          photo_url
        ),
        responder:users!responded_by(
          id,
          display_name
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

    return data as unknown as HelpRequest
  },

  // Update help request status
  async updateHelpRequestNotes(
    helpRequestId: string,
    notes: string
  ): Promise<void> {
    const { error } = await supabase
      .from('help_requests')
      .update({ notes })
      .eq('id', helpRequestId)

    if (error) {
      throw error
    }
  },

  async logNotesChange(
    helpRequestId: string,
    notes: string,
    changedByUserId: string | null,
    changedByDisplayName: string
  ): Promise<void> {
    const { error } = await supabase
      .from('help_request_notes_log')
      .insert({
        help_request_id: helpRequestId,
        notes,
        changed_by_user_id: changedByUserId,
        changed_by_display_name: changedByDisplayName,
        changed_at: new Date().toISOString()
      })

    if (error) {
      throw error
    }
  },

  async getNotesLog(helpRequestId: string): Promise<NotesLogEntry[]> {
    const { data, error } = await supabase
      .from('help_request_notes_log')
      .select('*')
      .eq('help_request_id', helpRequestId)
      .order('changed_at', { ascending: true })

    if (error) {
      throw error
    }

    return data || []
  },

  async updateHelpRequestStatus(
    helpRequestId: string,
    status: 'responded_to' | 'resolved' | 'false_alarm',
    userId: string,
    notes?: string
  ): Promise<void> {
    if (status === 'resolved' || status === 'false_alarm') {
      // On cellular the background auto-refresh can fail silently, leaving an
      // expired token in AsyncStorage. Refresh explicitly and pass the resulting
      // token as a header so we bypass any stale cached value.
      const { data: refreshData } = await supabase.auth.refreshSession()
      const token = refreshData.session?.access_token
        ?? (await supabase.auth.getSession()).data.session?.access_token

      const { error } = await supabase.functions.invoke('resolve-help-request', {
        headers: token ? { Authorization: `Bearer ${token}` } : undefined,
        body: {
          help_request_id: helpRequestId,
          status,
          resolved_by_user_id: userId,
          notes,
        }
      })
      if (error) throw error
      return
    }

    // 'responded_to' — update directly, no notification needed
    const updates: any = {
      event_status: status,
      responded_by: userId,
      responded_at: new Date().toISOString()
    }

    const { error } = await supabase
      .from('help_requests')
      .update(updates)
      .eq('id', helpRequestId)

    if (error) throw error
  },

}