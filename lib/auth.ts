import { supabase } from './supabase'
import * as AppleAuthentication from 'expo-apple-authentication'
import { GoogleSignin } from '@react-native-google-signin/google-signin'

export async function signInWithApple() {
  try {
    const credential = await AppleAuthentication.signInAsync({
      requestedScopes: [
        AppleAuthentication.AppleAuthenticationScope.FULL_NAME,
        AppleAuthentication.AppleAuthenticationScope.EMAIL,
      ],
    })

    if (credential.identityToken) {
      const { data, error } = await supabase.auth.signInWithIdToken({
        provider: 'apple',
        token: credential.identityToken,
      })

      if (error) throw error

      // Update user profile with name if this is first sign in and we have the name
      if (data.user && credential.email && credential.fullName) {
        const { givenName, familyName } = credential.fullName
        if (givenName || familyName) {
          await supabase.auth.updateUser({
            data: {
              full_name: [givenName, familyName].filter(Boolean).join(' '),
            }
          })
        }
      }

      return data
    } else {
      throw new Error('No identityToken.')
    }
  } catch (error) {
    console.error('Apple Sign-In error:', error)
    throw error
  }
}

export async function signInWithGoogle() {
  try {
    await GoogleSignin.hasPlayServices()
    const userInfo = await GoogleSignin.signIn()

    if (userInfo.data?.idToken) {
      const { data, error } = await supabase.auth.signInWithIdToken({
        provider: 'google',
        token: userInfo.data.idToken,
        nonce: userInfo.data.serverAuthCode,
      })
      if (error) throw error
      return data
    } else {
      throw new Error('No ID token present!')
    }
  } catch (error) {
    console.error('Google Sign-In error:', error)
    throw error
  }
}

export async function signOut() {
  try {
    const { error } = await supabase.auth.signOut()
    if (error) throw error
  } catch (error) {
    console.error('Sign out error:', error)
    throw error
  }
}