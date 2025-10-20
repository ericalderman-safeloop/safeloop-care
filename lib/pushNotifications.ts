import messaging from '@react-native-firebase/messaging'
import { Platform } from 'react-native'
import { userService } from './userService'

export class PushNotificationService {
  /**
   * Request permission for push notifications
   * Returns true if permission granted, false otherwise
   */
  static async requestPermission(): Promise<boolean> {
    try {
      const authStatus = await messaging().requestPermission()
      const enabled =
        authStatus === messaging.AuthorizationStatus.AUTHORIZED ||
        authStatus === messaging.AuthorizationStatus.PROVISIONAL

      if (enabled) {
        console.log('✅ Push notification permission granted:', authStatus)
      } else {
        console.log('❌ Push notification permission denied')
      }

      return enabled
    } catch (error) {
      console.error('Error requesting push notification permission:', error)
      return false
    }
  }

  /**
   * Get the device's push notification token
   * Returns the FCM token (works for both iOS and Android)
   */
  static async getToken(): Promise<string | null> {
    try {
      const token = await messaging().getToken()
      console.log('📱 Push notification token:', token)
      return token
    } catch (error) {
      console.error('Error getting push notification token:', error)
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

      // Get the device token
      const token = await this.getToken()
      if (!token) {
        console.log('⚠️ Could not get push notification token')
        return false
      }

      // Save token to user profile based on platform
      if (Platform.OS === 'ios') {
        await userService.updatePushToken(userId, token, undefined)
        console.log('✅ iOS push token saved')
      } else if (Platform.OS === 'android') {
        await userService.updatePushToken(userId, undefined, token)
        console.log('✅ Android push token saved')
      }

      return true
    } catch (error) {
      console.error('Error registering device for push notifications:', error)
      return false
    }
  }

  /**
   * Listen for token refresh events
   * Tokens can change when app is reinstalled or data is cleared
   */
  static onTokenRefresh(userId: string, callback?: (token: string) => void) {
    return messaging().onTokenRefresh(async (token) => {
      console.log('🔄 Push notification token refreshed:', token)

      try {
        // Update token in database
        if (Platform.OS === 'ios') {
          await userService.updatePushToken(userId, token, undefined)
        } else if (Platform.OS === 'android') {
          await userService.updatePushToken(userId, undefined, token)
        }

        if (callback) {
          callback(token)
        }
      } catch (error) {
        console.error('Error updating refreshed push token:', error)
      }
    })
  }

  /**
   * Set up foreground notification handler
   * This displays notifications when app is in foreground
   */
  static onForegroundMessage(callback: (message: any) => void) {
    return messaging().onMessage(async (remoteMessage) => {
      console.log('📨 Foreground push notification received:', remoteMessage)
      callback(remoteMessage)
    })
  }

  /**
   * Handle notification taps (when user taps on notification)
   */
  static onNotificationTap(callback: (message: any) => void) {
    // Handle notification tap when app is in background
    messaging().onNotificationOpenedApp((remoteMessage) => {
      console.log('📲 Notification opened app:', remoteMessage)
      callback(remoteMessage)
    })

    // Handle notification tap when app was quit
    messaging()
      .getInitialNotification()
      .then((remoteMessage) => {
        if (remoteMessage) {
          console.log('📲 Notification opened app from quit state:', remoteMessage)
          callback(remoteMessage)
        }
      })
  }
}
