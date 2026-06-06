import React, { useEffect, useRef, useState } from 'react'
import { NavigationContainer, NavigationContainerRef } from '@react-navigation/native'
import { createNativeStackNavigator } from '@react-navigation/native-stack'
import { SafeAreaProvider } from 'react-native-safe-area-context'
import { GoogleSignin } from '@react-native-google-signin/google-signin'
import { ActivityIndicator, View, Text, Alert, Platform } from 'react-native'
import * as SplashScreen from 'expo-splash-screen'
import * as Notifications from 'expo-notifications'
import * as Linking from 'expo-linking'
import AsyncStorage from '@react-native-async-storage/async-storage'
import { AuthProvider, useAuth, PENDING_INVITATION_TOKEN_KEY } from './contexts/AuthContext'
import LoginScreen from './screens/LoginScreen'
import HomeScreen from './screens/HomeScreen'
import ProfileSetupScreen from './screens/ProfileSetupScreen'
import MainMenuScreen from './screens/MainMenuScreen'
import SettingsScreen from './screens/SettingsScreen'
import WearersScreen from './screens/WearersScreen'
import RegisterWearerScreen from './screens/RegisterWearerScreen'
import EditWearerScreen from './screens/EditWearerScreen'
import WearerDetailsScreen from './screens/WearerDetailsScreen'
import CaregiversScreen from './screens/CaregiversScreen'
import InviteCaregiverScreen from './screens/InviteCaregiverScreen'
import HelpRequestDetailScreen from './screens/HelpRequestDetailScreen'
import FallDetectionModeScreen from './screens/FallDetectionModeScreen'
import { RootStackParamList } from './types/navigation'

interface ErrorBoundaryState {
  hasError: boolean
  error: Error | null
}

class ErrorBoundary extends React.Component<{ children: React.ReactNode }, ErrorBoundaryState> {
  constructor(props: { children: React.ReactNode }) {
    super(props)
    this.state = { hasError: false, error: null }
  }

  static getDerivedStateFromError(error: Error): ErrorBoundaryState {
    return { hasError: true, error }
  }

  componentDidCatch(error: Error, errorInfo: React.ErrorInfo) {
    console.error('💥 App Error:', error, errorInfo)
  }

  render() {
    if (this.state.hasError) {
      return (
        <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center', padding: 20 }}>
          <Text style={{ fontSize: 18, color: 'red', marginBottom: 10 }}>Something went wrong</Text>
          <Text style={{ fontSize: 14, color: '#666', textAlign: 'center' }}>
            {this.state.error?.toString() || 'Unknown error'}
          </Text>
        </View>
      )
    }

    return this.props.children
  }
}

const Stack = createNativeStackNavigator<RootStackParamList>()

function AppNavigator({ onReady }: { onReady: () => void }) {
  const { session, loading, profileLoading, needsProfileSetup, userProfile, refreshUserProfile } = useAuth()

  useEffect(() => {
    if (!loading && !profileLoading) onReady()
  }, [loading, profileLoading])
  const navigationRef = useRef<NavigationContainerRef<RootStackParamList>>(null)

  useEffect(() => {
    const handleDeepLink = async (url: string) => {
      const { hostname, queryParams } = Linking.parse(url)
      if (hostname !== 'accept-invitation') return
      const token = queryParams?.token as string | undefined
      if (!token) return

      if (session && userProfile) {
        // Already logged in with a profile — invitation joining to a second account isn't supported yet
        Alert.alert(
          'Invitation Received',
          'You already have an active SafeLoop account. Please contact the person who invited you to update your account access.',
          [{ text: 'OK' }]
        )
      } else {
        // Store token; it will be picked up in AuthContext once the user signs in
        await AsyncStorage.setItem(PENDING_INVITATION_TOKEN_KEY, token)
      }
    }

    // Handle deep link when app was closed (cold start)
    Linking.getInitialURL().then(url => { if (url) handleDeepLink(url) })

    // Handle deep link when app is already open
    const linkSub = Linking.addEventListener('url', ({ url }) => handleDeepLink(url))

    // Handle notification taps. We route to the Dashboard (Home) rather than
    // straight into HelpRequestDetail so the responder has to consciously tap
    // "Provide Assistance" — that button is the only place that flips the
    // help request to responded_to and stamps the responder.
    const subscription = Notifications.addNotificationResponseReceivedListener((response) => {
      const data = response.notification.request.content.data

      if (data.type === 'help_request' && navigationRef.current) {
        navigationRef.current.navigate('Home')
      }
    })

    return () => {
      linkSub.remove()
      Notifications.removeNotificationSubscription(subscription)
    }
  }, [session, userProfile])

  if (loading || profileLoading) {
    return (
      <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center' }}>
        <ActivityIndicator size="large" color="#2196F3" />
        <Text style={{ marginTop: 20, color: '#666' }}>
          {loading ? 'Loading authentication...' : 'Loading profile...'}
        </Text>
      </View>
    )
  }

  return (
    <NavigationContainer ref={navigationRef}>
      <Stack.Navigator screenOptions={{ headerShown: false }}>
        {!session ? (
          <Stack.Screen name="Login" component={LoginScreen} />
        ) : needsProfileSetup ? (
          <Stack.Screen name="ProfileSetup" component={ProfileSetupScreen} />
        ) : (
          <>
            <Stack.Screen name="Home" component={HomeScreen} />
            <Stack.Screen name="MainMenu" component={MainMenuScreen} />
            <Stack.Screen name="Settings" component={SettingsScreen} />
            <Stack.Screen name="Wearers" component={WearersScreen} />
            <Stack.Screen name="RegisterWearer" component={RegisterWearerScreen} />
            <Stack.Screen name="EditWearer" component={EditWearerScreen} />
            <Stack.Screen name="WearerDetails" component={WearerDetailsScreen} />
            <Stack.Screen name="Caregivers" component={CaregiversScreen} />
            <Stack.Screen name="InviteCaregiver" component={InviteCaregiverScreen} />
            <Stack.Screen name="HelpRequestDetail" component={HelpRequestDetailScreen} />
            <Stack.Screen name="FallDetectionMode" component={FallDetectionModeScreen} />
          </>
        )}
      </Stack.Navigator>
    </NavigationContainer>
  )
}

export default function App() {
  const [minDelayElapsed, setMinDelayElapsed] = useState(false)
  const [authReady, setAuthReady] = useState(false)

  useEffect(() => {
    console.log('🚀 SafeLoop Care app launched successfully!')
    GoogleSignin.configure({
      webClientId: '212440927886-nkic15llg9409a2nt23pflo3bjj0rn0g.apps.googleusercontent.com',
      iosClientId: '212440927886-lug7neo6r1iq26t7j9ppn266p22ife36.apps.googleusercontent.com',
    })
    const timer = setTimeout(() => setMinDelayElapsed(true), 2000)
    return () => clearTimeout(timer)
  }, [])

  useEffect(() => {
    if (minDelayElapsed && authReady) {
      SplashScreen.hideAsync()
    }
  }, [minDelayElapsed, authReady])

  return (
    <ErrorBoundary>
      <SafeAreaProvider>
        <AuthProvider>
          <AppNavigator onReady={() => setAuthReady(true)} />
        </AuthProvider>
      </SafeAreaProvider>
    </ErrorBoundary>
  )
}
