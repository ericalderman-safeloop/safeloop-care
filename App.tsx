import React, { useEffect } from 'react'
import { NavigationContainer } from '@react-navigation/native'
import { createNativeStackNavigator } from '@react-navigation/native-stack'
import { SafeAreaProvider } from 'react-native-safe-area-context'
import { GoogleSignin } from '@react-native-google-signin/google-signin'
import { ActivityIndicator, View, Text } from 'react-native'
import { AuthProvider, useAuth } from './contexts/AuthContext'
import LoginScreen from './screens/LoginScreen'
import HomeScreen from './screens/HomeScreen'
import ProfileSetupScreen from './screens/ProfileSetupScreen'
import MainMenuScreen from './screens/MainMenuScreen'
import SettingsScreen from './screens/SettingsScreen'
import WearersScreen from './screens/WearersScreen'
import RegisterWearerScreen from './screens/RegisterWearerScreen'
import EditWearerScreen from './screens/EditWearerScreen'
import CaregiversScreen from './screens/CaregiversScreen'
import InviteCaregiverScreen from './screens/InviteCaregiverScreen'

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
    <NavigationContainer>
      <Stack.Navigator screenOptions={{ headerShown: false }}>
        {!session ? (
          <Stack.Screen name="Login" component={LoginScreen} />
        ) : needsProfileSetup ? (
          <Stack.Screen name="ProfileSetup" component={ProfileSetupScreen} />
        ) : (
          <>
            <Stack.Screen name="MainMenu" component={MainMenuScreen} />
            <Stack.Screen name="Home" component={HomeScreen} />
            <Stack.Screen name="Settings" component={SettingsScreen} />
            <Stack.Screen name="Wearers" component={WearersScreen} />
            <Stack.Screen name="RegisterWearer" component={RegisterWearerScreen} />
            <Stack.Screen name="EditWearer" component={EditWearerScreen} />
            <Stack.Screen name="Caregivers" component={CaregiversScreen} />
            <Stack.Screen name="InviteCaregiver" component={InviteCaregiverScreen} />
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
