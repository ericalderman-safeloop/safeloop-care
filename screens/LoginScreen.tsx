import React, { useState } from 'react'
import { View, Text, StyleSheet, TouchableOpacity, Alert, ActivityIndicator } from 'react-native'
import * as AppleAuthentication from 'expo-apple-authentication'
import { GoogleSignin, statusCodes } from '@react-native-google-signin/google-signin'
import { signInWithApple, signInWithGoogle } from '../lib/auth'


import structuredClone from "@ungap/structured-clone";
if (!("structuredClone" in global)) {
  (global as typeof globalThis & { structuredClone?: typeof structuredClone }).structuredClone = structuredClone;
}




export default function LoginScreen() {
  const [googleLoading, setGoogleLoading] = useState(false)

  const handleAppleSignIn = async () => {
    try {
      await signInWithApple()
    } catch (error) {
      Alert.alert('Error', `Failed to sign in with Apple: ${(error as Error).message}`)
    }
  }

  const handleGoogleSignIn = async () => {
    if (googleLoading) return
    setGoogleLoading(true)
    try {
      // Clear any stale sign-in state before starting
      await GoogleSignin.signOut().catch(() => {})
      await signInWithGoogle()
    } catch (error: any) {
      if (error?.code === statusCodes.IN_PROGRESS) {
        // Already signing in, ignore
      } else if (error?.code === statusCodes.SIGN_IN_CANCELLED) {
        // User cancelled, no alert needed
      } else {
        Alert.alert('Error', `Failed to sign in with Google: ${error?.message || 'Unknown error'}`)
      }
    } finally {
      setGoogleLoading(false)
    }
  }


  return (
    <View style={styles.container}>
      <Text style={styles.title}>SafeLoop Care</Text>
      <Text style={styles.subtitle}>Sign in to get started</Text>

      <View style={styles.buttonContainer}>
        <AppleAuthentication.AppleAuthenticationButton
          buttonType={AppleAuthentication.AppleAuthenticationButtonType.SIGN_IN}
          buttonStyle={AppleAuthentication.AppleAuthenticationButtonStyle.BLACK}
          cornerRadius={5}
          style={styles.appleButton}
          onPress={handleAppleSignIn}
        />

        <TouchableOpacity
          style={[styles.googleButton, googleLoading && styles.googleButtonDisabled]}
          onPress={handleGoogleSignIn}
          disabled={googleLoading}
        >
          {googleLoading
            ? <ActivityIndicator color="white" />
            : <Text style={styles.googleButtonText}>Sign in with Google</Text>
          }
        </TouchableOpacity>
      </View>
    </View>
  )
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
    backgroundColor: '#f5f5f5',
  },
  title: {
    fontSize: 32,
    fontWeight: 'bold',
    marginBottom: 10,
    color: '#333',
  },
  subtitle: {
    fontSize: 16,
    color: '#666',
    marginBottom: 40,
  },
  buttonContainer: {
    width: '100%',
    maxWidth: 300,
  },
  appleButton: {
    width: '100%',
    height: 50,
    marginBottom: 15,
  },
  googleButton: {
    backgroundColor: '#4285f4',
    padding: 15,
    borderRadius: 5,
    alignItems: 'center',
  },
  googleButtonDisabled: {
    backgroundColor: '#a0b4f0',
  },
  googleButtonText: {
    color: 'white',
    fontSize: 16,
    fontWeight: '600',
  },
})