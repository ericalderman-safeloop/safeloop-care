import React, { useState, useEffect } from 'react'
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ScrollView,
  ActivityIndicator,
  Alert,
} from 'react-native'
import { NativeStackScreenProps } from '@react-navigation/native-stack'
import { RootStackParamList } from '../types/navigation'
import { userService } from '../lib/userService'

type Props = NativeStackScreenProps<RootStackParamList, 'FallDetectionMode'>

type Mode = 'apple' | 'custom'

const MODES: {
  id: Mode
  title: string
  subtitle: string
  how: string
  pros: string[]
  cons: string[]
}[] = [
  {
    id: 'apple',
    title: 'Apple Fall Detection',
    subtitle: 'Default — recommended for most wearers',
    how: "Uses Apple's built-in fall detection hardware and algorithm. When a fall is detected, Apple shows a 30-second countdown on the watch. If the wearer doesn't respond, Apple's service calls 911 and SafeLoop sends an alert to caregivers.",
    pros: [
      'Battery efficient — no impact on watch battery life',
      "Powered by Apple's dedicated fall detection hardware",
      'Battle-tested across millions of Apple Watch users',
    ],
    cons: [
      'Cannot customize detection sensitivity',
      'Not available in all regions',
      'In Mexico, calls 911, speaks to emergency services in Watch language (might be English)',
      'In countries without E911/ALI support (e.g. Mexico), the wearer\'s location is read out as raw Lat/Long coordinates, in Watch language'
    ],
  },
  {
    id: 'custom',
    title: 'SafeLoop Proprietary Detection',
    subtitle: 'For more control of fall detection sensitivity and response flow',
    how: "SafeLoop's own fall detection algorithm runs continuously on the watch using raw accelerometer data. When a fall is detected, SafeLoop shows its own 30-second countdown directly. If the wearer doesn't respond, caregivers are alerted.",
    pros: [
      'Avoids calling local 911 services directly, which can be unreliable in some regions',
      'Can be customized with per-wearer sensitivity settings',
      'Simpler experience only shows SafeLoop\'s own countdown (not Apple\'s alerts',
    ],
    cons: [
      'Increases battery drain by ~30–50% (18-hour watch becomes ~10–13 hours)',
      'Shows a green workout indicator near the watch crown',
      'Algorithm is less proven than Apple\'s hardware detection',
    ],
  },
]

export default function FallDetectionModeScreen({ navigation, route }: Props) {
  const { wearerId } = route.params
  const [currentMode, setCurrentMode] = useState<Mode>('apple')
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    loadMode()
  }, [wearerId])

  const loadMode = async () => {
    try {
      const wearer = await userService.getWearerById(wearerId)
      setCurrentMode(wearer.fall_detection_mode ?? 'apple')
    } catch (error) {
      console.error('Failed to load fall detection mode:', error)
    } finally {
      setLoading(false)
    }
  }

  const handleSelect = async (mode: Mode) => {
    if (mode === currentMode) return

    setSaving(true)
    try {
      await userService.setFallDetectionMode(wearerId, mode)
      setCurrentMode(mode)

      const modeName = mode === 'apple' ? 'Apple Fall Detection' : 'SafeLoop Proprietary Detection'
      Alert.alert('Saved', `Fall detection mode changed to ${modeName}. The watch will apply this setting on its next launch.`)
    } catch (error: any) {
      Alert.alert('Error', error.message || 'Failed to save. Please try again.')
    } finally {
      setSaving(false)
    }
  }

  if (loading) {
    return (
      <View style={styles.container}>
        <View style={styles.header}>
          <TouchableOpacity style={styles.backButton} onPress={() => navigation.goBack()}>
            <Text style={styles.backButtonText}>← Back</Text>
          </TouchableOpacity>
          <Text style={styles.headerTitle}>Fall Detection Mode</Text>
        </View>
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color="#2196F3" />
        </View>
      </View>
    )
  }

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <TouchableOpacity style={styles.backButton} onPress={() => navigation.goBack()}>
          <Text style={styles.backButtonText}>← Back</Text>
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Fall Detection Mode</Text>
      </View>

      <ScrollView style={styles.content} contentContainerStyle={styles.contentInner}>
        <Text style={styles.description}>
          Choose how SafeLoop detects falls on this wearer's Apple Watch. This setting applies to this wearer only.
        </Text>

        {MODES.map((mode) => {
          const isSelected = currentMode === mode.id
          return (
            <TouchableOpacity
              key={mode.id}
              style={[styles.card, isSelected && styles.cardSelected]}
              onPress={() => handleSelect(mode.id)}
              disabled={saving}
              activeOpacity={0.85}
            >
              <View style={styles.cardHeader}>
                <View style={styles.cardTitleRow}>
                  <Text style={[styles.cardTitle, isSelected && styles.cardTitleSelected]}>
                    {mode.title}
                  </Text>
                  {isSelected && (
                    <View style={styles.selectedBadge}>
                      <Text style={styles.selectedBadgeText}>✓ Active</Text>
                    </View>
                  )}
                </View>
                <Text style={styles.cardSubtitle}>{mode.subtitle}</Text>
              </View>

              <View style={styles.divider} />

              <Text style={styles.sectionLabel}>How it works</Text>
              <Text style={styles.howText}>{mode.how}</Text>

              <Text style={styles.sectionLabel}>Advantages</Text>
              {mode.pros.map((pro, i) => (
                <View key={i} style={styles.bulletRow}>
                  <Text style={styles.bulletPro}>✓</Text>
                  <Text style={styles.bulletText}>{pro}</Text>
                </View>
              ))}

              <Text style={[styles.sectionLabel, { marginTop: 12 }]}>Limitations</Text>
              {mode.cons.map((con, i) => (
                <View key={i} style={styles.bulletRow}>
                  <Text style={styles.bulletCon}>✗</Text>
                  <Text style={styles.bulletText}>{con}</Text>
                </View>
              ))}

              {!isSelected && (
                <View style={styles.selectButtonWrapper}>
                  {saving ? (
                    <ActivityIndicator color="#2196F3" />
                  ) : (
                    <Text style={styles.selectButtonText}>Tap to select</Text>
                  )}
                </View>
              )}
            </TouchableOpacity>
          )
        })}

        <Text style={styles.footer}>
          Changes take effect the next time the watch app launches. The wearer does not need to take any action.
        </Text>
      </ScrollView>
    </View>
  )
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f5f5f5',
  },
  header: {
    backgroundColor: '#2196F3',
    paddingTop: 50,
    paddingBottom: 20,
    paddingHorizontal: 20,
    flexDirection: 'row',
    alignItems: 'center',
  },
  backButton: {
    marginRight: 15,
  },
  backButtonText: {
    color: 'white',
    fontSize: 16,
    fontWeight: '600',
  },
  headerTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    color: 'white',
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  content: {
    flex: 1,
  },
  contentInner: {
    padding: 16,
    paddingBottom: 32,
  },
  description: {
    fontSize: 15,
    color: '#555',
    marginBottom: 20,
    lineHeight: 22,
  },
  card: {
    backgroundColor: 'white',
    borderRadius: 12,
    padding: 18,
    marginBottom: 16,
    borderWidth: 2,
    borderColor: '#e0e0e0',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.06,
    shadowRadius: 4,
    elevation: 2,
  },
  cardSelected: {
    borderColor: '#2196F3',
    backgroundColor: '#f0f8ff',
  },
  cardHeader: {
    marginBottom: 12,
  },
  cardTitleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    flexWrap: 'wrap',
    gap: 8,
    marginBottom: 4,
  },
  cardTitle: {
    fontSize: 17,
    fontWeight: '700',
    color: '#222',
    flex: 1,
  },
  cardTitleSelected: {
    color: '#1565C0',
  },
  selectedBadge: {
    backgroundColor: '#2196F3',
    borderRadius: 12,
    paddingHorizontal: 10,
    paddingVertical: 3,
  },
  selectedBadgeText: {
    color: 'white',
    fontSize: 12,
    fontWeight: '700',
  },
  cardSubtitle: {
    fontSize: 13,
    color: '#777',
    fontStyle: 'italic',
  },
  divider: {
    height: 1,
    backgroundColor: '#eee',
    marginBottom: 12,
  },
  sectionLabel: {
    fontSize: 13,
    fontWeight: '700',
    color: '#444',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
    marginBottom: 8,
  },
  howText: {
    fontSize: 14,
    color: '#555',
    lineHeight: 20,
    marginBottom: 14,
  },
  bulletRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    marginBottom: 5,
  },
  bulletPro: {
    fontSize: 13,
    color: '#388E3C',
    fontWeight: '700',
    marginRight: 8,
    marginTop: 1,
    width: 14,
  },
  bulletCon: {
    fontSize: 13,
    color: '#C62828',
    fontWeight: '700',
    marginRight: 8,
    marginTop: 1,
    width: 14,
  },
  bulletText: {
    fontSize: 14,
    color: '#444',
    lineHeight: 20,
    flex: 1,
  },
  selectButtonWrapper: {
    marginTop: 16,
    alignItems: 'center',
  },
  selectButtonText: {
    fontSize: 14,
    color: '#2196F3',
    fontWeight: '600',
  },
  footer: {
    fontSize: 13,
    color: '#888',
    textAlign: 'center',
    lineHeight: 19,
    marginTop: 8,
    fontStyle: 'italic',
  },
})
