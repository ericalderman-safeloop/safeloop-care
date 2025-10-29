import React, { useEffect, useRef } from 'react'
import { NavigationContainer } from '@react-navigation/native'
import { createNativeStackNavigator } from '@react-navigation/native-stack'
import { SafeAreaProvider } from 'react-native-safe-area-context'
import { GoogleSignin } from '@react-native-google-signin/google-signin'
import { ActivityIndicator, View, Text } from 'react-native'
import * as Notifications from 'expo-notifications'
import { AuthProvider, useAuth } from './contexts/AuthContext'
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

class ErrorBoundary extends React.Component {
  constructor(props) {
    super(props)
    this.state = { hasError: false, error: null }
  }

  static getDerivedStateFromError(error) {
    return { hasError: true, error }
  }

  componentDidCatch(error, errorInfo) {
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

const Stack = createNativeStackNavigator()

function AppNavigator() {
  const { session, loading, profileLoading, needsProfileSetup } = useAuth()
  const navigationRef = useRef(null)

  useEffect(() => {
    // Handle notification taps to navigate to help request detail
    const subscription = Notifications.addNotificationResponseReceivedListener((response) => {
      const data = response.notification.request.content.data

      // Check if this is a help_request notification
      if (data.type === 'help_request' && data.help_request_id && navigationRef.current) {
        // Navigate to the help request detail screen
        navigationRef.current.navigate('HelpRequestDetail', {
          helpRequestId: data.help_request_id
        })
      }
    })

    return () => {
      Notifications.removeNotificationSubscription(subscription)
    }
  }, [])

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
          </>
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
    <ErrorBoundary>
      <SafeAreaProvider>
        <AuthProvider>
          <AppNavigator />
        </AuthProvider>
      </SafeAreaProvider>
    </ErrorBoundary>
  )
}
