import * as Notifications from 'expo-notifications'
import * as Device from 'expo-device'
import Constants from 'expo-constants'
import { Platform } from 'react-native'
import { userService } from './userService'

// Configure how notifications are displayed when app is in foreground
Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowAlert: true,
    shouldPlaySound: true,
    shouldSetBadge: true,
    shouldShowBanner: true,
    shouldShowList: true,
  }),
})

export class PushNotificationService {
  /**
   * Request permission for push notifications
   * Returns true if permission granted, false otherwise
   */
  static async requestPermission(): Promise<boolean> {
    try {
      // On Android, notifications are allowed by default
      if (Platform.OS === 'android') {
        await Notifications.setNotificationChannelAsync('emergency', {
          name: 'Emergency Alerts',
          importance: Notifications.AndroidImportance.MAX,
          vibrationPattern: [0, 250, 250, 250],
          lightColor: '#FF0000',
          sound: 'default',
        })
      }

      const { status: existingStatus } = await Notifications.getPermissionsAsync()
      let finalStatus = existingStatus

      if (existingStatus !== 'granted') {
        const { status } = await Notifications.requestPermissionsAsync()
        finalStatus = status
      }

      if (finalStatus !== 'granted') {
        console.log('❌ Push notification permission denied')
        return false
      }

      console.log('✅ Push notification permission granted')
      return true
    } catch (error) {
      console.error('Error requesting push notification permission:', error)
      return false
    }
  }

  /**
   * Get the device's Expo Push Token
   */
  static async getExpoPushToken(): Promise<string | null> {
    try {
      // Try to get project ID from config, fallback to undefined
      const projectId = Constants.expoConfig?.extra?.eas?.projectId

      const token = await Notifications.getExpoPushTokenAsync(
        projectId ? { projectId } : undefined
      )

      console.log('📱 Expo Push Token:', token.data)
      return token.data
    } catch (error) {
      console.error('Error getting Expo push token:', error)
      return null
    }
  }

  /**
   * Register this device for push notifications
   * - Requests permission
   * - Gets device token
   * - Saves token to user profile
   */
  static async registerDevice(userId: string): Promise<boolean> {
    try {
      // Request permission first
      const hasPermission = await this.requestPermission()
      if (!hasPermission) {
        console.log('⚠️ Push notification permission not granted')
        return false
      }

      // Get the Expo push token
      const token = await this.getExpoPushToken()
      if (!token) {
        console.log('⚠️ Could not get Expo push token')
        return false
      }

      // Save token to user profile
      // Store in both fields for now (we'll use expo_push_token column)
      await userService.updatePushToken(userId, token, token)
      console.log('✅ Expo push token saved')

      return true
    } catch (error) {
      console.error('Error registering device for push notifications:', error)
      return false
    }
  }

  /**
   * Set up foreground notification handler
   */
  static setupNotificationListeners(
    onNotificationReceived?: (notification: Notifications.Notification) => void,
    onNotificationTapped?: (response: Notifications.NotificationResponse) => void
  ) {
    // Handle notifications received while app is in foreground
    const receivedListener = Notifications.addNotificationReceivedListener((notification) => {
      console.log('📨 Foreground notification received:', notification)
      if (onNotificationReceived) {
        onNotificationReceived(notification)
      }
    })

    // Handle notification taps
    const responseListener = Notifications.addNotificationResponseReceivedListener((response) => {
      console.log('📲 Notification tapped:', response)
      if (onNotificationTapped) {
        onNotificationTapped(response)
      }
    })

    // Return cleanup function
    return () => {
      Notifications.removeNotificationSubscription(receivedListener)
      Notifications.removeNotificationSubscription(responseListener)
    }
  }
}
