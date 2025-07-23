import React, { useEffect } from 'react'
import { NavigationContainer } from '@react-navigation/native'
import { createNativeStackNavigator } from '@react-navigation/native-stack'
import { SafeAreaProvider } from 'react-native-safe-area-context'
import { GoogleSignin } from '@react-native-google-signin/google-signin'
import { AuthProvider, useAuth } from './contexts/AuthContext'
import LoginScreen from './screens/LoginScreen'
import HomeScreen from './screens/HomeScreen'

const Stack = createNativeStackNavigator()

function AppNavigator() {
  const { session, loading } = useAuth()

  if (loading) {
    return null
  }

  return (
    <NavigationContainer>
      <Stack.Navigator screenOptions={{ headerShown: false }}>
        {session ? (
          <Stack.Screen name="Home" component={HomeScreen} />
        ) : (
          <Stack.Screen name="Login" component={LoginScreen} />
        )}
      </Stack.Navigator>
    </NavigationContainer>
  )
}

export default function App() {
  useEffect(() => {
    console.log('🚀 SafeLoop Care app launched successfully!')
    GoogleSignin.configure({
      webClientId: '212440927886-i1db0p430ibtgi00r0e2savaplnaqlle.apps.googleusercontent.com',
      iosClientId: '212440927886-lug7neo6r1iq26t7j9ppn266p22ife36.apps.googleusercontent.com',
    })
  }, [])

  return (
    <SafeAreaProvider>
      <AuthProvider>
        <AppNavigator />
      </AuthProvider>
    </SafeAreaProvider>
  )
}
