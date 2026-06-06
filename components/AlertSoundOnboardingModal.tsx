import React, { useEffect, useState } from 'react'
import { Modal, View, Text, TouchableOpacity, StyleSheet, ActivityIndicator } from 'react-native'
import AsyncStorage from '@react-native-async-storage/async-storage'
import { useAudioPlayer } from 'expo-audio'
import { userService } from '../lib/userService'

const ALARM_SOUND = require('../assets/safeloop_alarm.caf')

// One-time prompt, scoped per-user so a sign-out/sign-in on a shared device
// re-prompts a different caregiver if needed.
const promptKey = (userId: string) => `alertSoundPromptShown:${userId}`

interface Props {
  userId: string | undefined
}

export default function AlertSoundOnboardingModal({ userId }: Props) {
  const [visible, setVisible] = useState(false)
  const [saving, setSaving] = useState(false)
  const alarmPlayer = useAudioPlayer(ALARM_SOUND)

  useEffect(() => {
    if (!userId) return
    let cancelled = false
    AsyncStorage.getItem(promptKey(userId)).then((value) => {
      if (!cancelled && !value) setVisible(true)
    })
    return () => { cancelled = true }
  }, [userId])

  const markPromptShown = async () => {
    if (!userId) return
    await AsyncStorage.setItem(promptKey(userId), '1')
  }

  const handleKeepAlarm = async () => {
    if (!userId) return
    setSaving(true)
    try {
      // DB default is already 'alarm' — but write it anyway so the choice is
      // explicit and survives any future migration that changes defaults.
      await userService.setHelpRequestSound(userId, 'alarm')
      await markPromptShown()
      setVisible(false)
    } catch (error) {
      console.error('Error saving alarm preference:', error)
    } finally {
      setSaving(false)
    }
  }

  const handleUseStandard = async () => {
    if (!userId) return
    setSaving(true)
    try {
      await userService.setHelpRequestSound(userId, 'standard')
      await markPromptShown()
      setVisible(false)
    } catch (error) {
      console.error('Error saving standard preference:', error)
    } finally {
      setSaving(false)
    }
  }

  const handlePreview = () => {
    try {
      alarmPlayer.seekTo(0)
      alarmPlayer.play()
      setTimeout(() => {
        try { alarmPlayer.pause() } catch {}
      }, 4000)
    } catch (error) {
      console.error('Error previewing alarm:', error)
    }
  }

  return (
    <Modal visible={visible} animationType="fade" transparent>
      <View style={styles.overlay}>
        <View style={styles.card}>
          <Text style={styles.title}>Loud emergency alerts</Text>
          <Text style={styles.body}>
            When your wearer requests help or a fall is detected, SafeLoop will play a loud alarm so you don't miss it — even if your phone is on the other side of the room.
          </Text>
          <Text style={styles.body}>
            You can switch to a standard notification sound here, or change it anytime in Settings.
          </Text>

          <TouchableOpacity style={styles.previewButton} onPress={handlePreview}>
            <Text style={styles.previewButtonText}>▶ Preview alarm</Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={[styles.primaryButton, saving && styles.buttonDisabled]}
            onPress={handleKeepAlarm}
            disabled={saving}
          >
            {saving ? (
              <ActivityIndicator color="white" />
            ) : (
              <Text style={styles.primaryButtonText}>Use loud alarm (recommended)</Text>
            )}
          </TouchableOpacity>

          <TouchableOpacity
            style={[styles.secondaryButton, saving && styles.buttonDisabled]}
            onPress={handleUseStandard}
            disabled={saving}
          >
            <Text style={styles.secondaryButtonText}>Use standard sound</Text>
          </TouchableOpacity>
        </View>
      </View>
    </Modal>
  )
}

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.5)',
    justifyContent: 'center',
    padding: 20,
  },
  card: {
    backgroundColor: 'white',
    borderRadius: 12,
    padding: 24,
  },
  title: {
    fontSize: 20,
    fontWeight: '700',
    color: '#333',
    marginBottom: 12,
  },
  body: {
    fontSize: 15,
    color: '#444',
    lineHeight: 22,
    marginBottom: 12,
  },
  previewButton: {
    alignSelf: 'flex-start',
    paddingVertical: 8,
    paddingHorizontal: 14,
    borderRadius: 6,
    backgroundColor: '#e3f2fd',
    marginTop: 4,
    marginBottom: 18,
  },
  previewButtonText: {
    fontSize: 14,
    fontWeight: '600',
    color: '#2196F3',
  },
  primaryButton: {
    backgroundColor: '#2196F3',
    paddingVertical: 14,
    borderRadius: 8,
    alignItems: 'center',
    marginBottom: 10,
  },
  primaryButtonText: {
    color: 'white',
    fontSize: 16,
    fontWeight: '600',
  },
  secondaryButton: {
    paddingVertical: 14,
    borderRadius: 8,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#ccc',
  },
  secondaryButtonText: {
    color: '#555',
    fontSize: 16,
    fontWeight: '600',
  },
  buttonDisabled: {
    opacity: 0.5,
  },
})
