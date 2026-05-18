import React from 'react'
import { View, Image, TouchableOpacity, Text, StyleSheet, Alert } from 'react-native'
import * as ImagePicker from 'expo-image-picker'

interface WearerPhotoPickerProps {
  photoUri?: string | null
  wearerName?: string
  onPhotoChange: (uri: string | null) => void
  disabled?: boolean
}

export default function WearerPhotoPicker({ photoUri, wearerName, onPhotoChange, disabled }: WearerPhotoPickerProps) {
  const initials = wearerName
    ? wearerName.trim().split(/\s+/).map(n => n[0]).join('').slice(0, 2).toUpperCase()
    : '?'

  const handlePress = () => {
    if (disabled) return
    const options: any[] = [
      { text: 'Take Photo', onPress: launchCamera },
      { text: 'Choose from Library', onPress: launchLibrary },
    ]
    if (photoUri) {
      options.push({ text: 'Remove Photo', style: 'destructive' as const, onPress: () => onPhotoChange(null) })
    }
    options.push({ text: 'Cancel', style: 'cancel' })
    Alert.alert('Wearer Photo', 'Choose a photo source', options)
  }

  const launchCamera = async () => {
    const { status } = await ImagePicker.requestCameraPermissionsAsync()
    if (status !== 'granted') {
      Alert.alert('Permission Required', 'Camera access is needed to take a photo.')
      return
    }
    const result = await ImagePicker.launchCameraAsync({
      allowsEditing: true,
      aspect: [1, 1],
      quality: 0.8,
    })
    if (!result.canceled) onPhotoChange(result.assets[0].uri)
  }

  const launchLibrary = async () => {
    const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync()
    if (status !== 'granted') {
      Alert.alert('Permission Required', 'Photo library access is needed to choose a photo.')
      return
    }
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ['images'],
      allowsEditing: true,
      aspect: [1, 1],
      quality: 0.8,
    })
    if (!result.canceled) onPhotoChange(result.assets[0].uri)
  }

  return (
    <TouchableOpacity style={styles.container} onPress={handlePress} disabled={disabled} activeOpacity={0.8}>
      {photoUri ? (
        <Image source={{ uri: photoUri }} style={styles.photo} />
      ) : (
        <View style={styles.placeholder}>
          <Text style={styles.initials}>{initials}</Text>
        </View>
      )}
      {!disabled && (
        <View style={styles.editBadge}>
          <Text style={styles.editBadgeText}>📷</Text>
        </View>
      )}
    </TouchableOpacity>
  )
}

const styles = StyleSheet.create({
  container: {
    width: 100,
    height: 100,
    alignSelf: 'center',
    marginBottom: 24,
  },
  photo: {
    width: 100,
    height: 100,
    borderRadius: 50,
    backgroundColor: '#e0e0e0',
  },
  placeholder: {
    width: 100,
    height: 100,
    borderRadius: 50,
    backgroundColor: '#e3f2fd',
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 2,
    borderColor: '#2196F3',
    borderStyle: 'dashed',
  },
  initials: {
    fontSize: 32,
    fontWeight: 'bold',
    color: '#2196F3',
  },
  editBadge: {
    position: 'absolute',
    bottom: 0,
    right: 0,
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: '#2196F3',
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 2,
    borderColor: 'white',
  },
  editBadgeText: {
    fontSize: 15,
  },
})
