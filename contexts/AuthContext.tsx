import React, { createContext, useContext, useEffect, useState } from 'react'
import { Session } from '@supabase/supabase-js'
import { supabase } from '../lib/supabase'
import { UserProfile, userService, InvitationInfo } from '../lib/userService'

interface AuthContextType {
  session: Session | null
  userProfile: UserProfile | null
  invitationInfo: InvitationInfo | null
  loading: boolean
  profileLoading: boolean
  needsProfileSetup: boolean
  refreshUserProfile: () => Promise<void>
}

const AuthContext = createContext<AuthContextType>({
  session: null,
  userProfile: null,
  invitationInfo: null,
  loading: true,
  profileLoading: true,
  needsProfileSetup: false,
  refreshUserProfile: async () => {},
})

export function useAuth() {
  return useContext(AuthContext)
}

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [session, setSession] = useState<Session | null>(null)
  const [userProfile, setUserProfile] = useState<UserProfile | null>(null)
  const [invitationInfo, setInvitationInfo] = useState<InvitationInfo | null>(null)
  const [loading, setLoading] = useState(true)
  const [profileLoading, setProfileLoading] = useState(true)
  const [needsProfileSetup, setNeedsProfileSetup] = useState(false)

  const loadUserProfile = async (authUserId: string, email: string) => {
    try {
      setProfileLoading(true)
      const profile = await userService.getUserProfile(authUserId)
      
      if (profile) {
        setUserProfile(profile)
        setInvitationInfo(null)
        const needsSetup = !(await userService.hasCompletedProfile(profile))
        setNeedsProfileSetup(needsSetup)
      } else {
        // User profile doesn't exist - check for invitation first
        const invitation = await userService.checkInvitation(email)
        setInvitationInfo(invitation)
        setUserProfile(null)
        setNeedsProfileSetup(true)
      }
    } catch (error) {
      console.error('Error loading user profile:', error)
      setInvitationInfo(null)
      setNeedsProfileSetup(true)
    } finally {
      setProfileLoading(false)
    }
  }

  const refreshUserProfile = async () => {
    if (session?.user?.id && session?.user?.email) {
      await loadUserProfile(session.user.id, session.user.email)
    }
  }

  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      setSession(session)
      setLoading(false)
      
      if (session?.user?.id && session?.user?.email) {
        loadUserProfile(session.user.id, session.user.email)
      } else {
        setProfileLoading(false)
      }
    }).catch(error => {
      console.error('Error getting session:', error)
      setLoading(false)
      setProfileLoading(false)
    })

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_event, session) => {
      setSession(session)
      setLoading(false)
      
      if (session?.user?.id && session?.user?.email) {
        loadUserProfile(session.user.id, session.user.email)
      } else {
        setUserProfile(null)
        setInvitationInfo(null)
        setNeedsProfileSetup(false)
        setProfileLoading(false)
      }
    })

    return () => subscription.unsubscribe()
  }, [])

  return (
    <AuthContext.Provider value={{ 
      session, 
      userProfile, 
      invitationInfo,
      loading, 
      profileLoading, 
      needsProfileSetup, 
      refreshUserProfile 
    }}>
      {children}
    </AuthContext.Provider>
  )
}