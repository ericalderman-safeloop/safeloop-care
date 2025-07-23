import { supabase } from './supabase'
import * as AppleAuthentication from 'expo-apple-authentication'
import { GoogleSignin } from '@react-native-google-signin/google-signin'

export async function signInWithApple() {
  try {
    console.log('Starting Apple Sign-In...')
    const credential = await AppleAuthentication.signInAsync({
      requestedScopes: [
        AppleAuthentication.AppleAuthenticationScope.FULL_NAME,
        AppleAuthentication.AppleAuthenticationScope.EMAIL,
      ],
    })
    
    console.log('Apple credential received:', {
      user: credential.user,
      email: credential.email,
      fullName: credential.fullName,
      hasIdentityToken: !!credential.identityToken,
      hasAuthorizationCode: !!credential.authorizationCode,
    })
    
    if (credential.identityToken) {
      console.log('Sending identity token to Supabase...')
      const { data, error } = await supabase.auth.signInWithIdToken({
        provider: 'apple',
        token: credential.identityToken,
      })
      console.log('Supabase response:', { data, error })
      if (error) throw error
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
    console.log('Starting Google Sign-In...')
    await GoogleSignin.hasPlayServices()
    const userInfo = await GoogleSignin.signIn()
    
    console.log('Google userInfo received:', {
      hasData: !!userInfo.data,
      hasIdToken: !!userInfo.data?.idToken,
      user: userInfo.data?.user,
      serverAuthCode: userInfo.data?.serverAuthCode,
    })
    
    if (userInfo.data?.idToken) {
      console.log('Sending Google ID token to Supabase...')
      const { data, error } = await supabase.auth.signInWithIdToken({
        provider: 'google',
        token: userInfo.data.idToken,
        nonce: userInfo.data.serverAuthCode,
      })
      console.log('Supabase response:', { data, error })
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