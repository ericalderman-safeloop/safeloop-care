import React from 'react'
import { View, Text, StyleSheet, TouchableOpacity, Alert } from 'react-native'
import * as AppleAuthentication from 'expo-apple-authentication'
import { signInWithApple, signInWithGoogle } from '../lib/auth'


import structuredClone from "@ungap/structured-clone";
if (!("structuredClone" in global)) {
  (global as typeof globalThis & { structuredClone?: typeof structuredClone }).structuredClone = structuredClone;
}




export default function LoginScreen() {
  const handleAppleSignIn = async () => {
    try {
      await signInWithApple()
    } catch (error) {
      console.error('LoginScreen Apple Sign-In error:', error)
      Alert.alert('Error', `Failed to sign in with Apple: ${error.message}`)
    }
  }

  const handleGoogleSignIn = async () => {
    try {
      await signInWithGoogle()
    } catch (error) {
      Alert.alert('Error', 'Failed to sign in with Google')
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

        <TouchableOpacity style={styles.googleButton} onPress={handleGoogleSignIn}>
          <Text style={styles.googleButtonText}>Sign in with Google</Text>
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
  googleButtonText: {
    color: 'white',
    fontSize: 16,
    fontWeight: '600',
  },
})