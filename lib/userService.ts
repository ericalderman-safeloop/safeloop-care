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
  emergency_contact_name?: string
  emergency_contact_phone?: string
  emergency_contact_relationship?: string
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

}