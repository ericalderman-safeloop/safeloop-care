# SafeLoop Care

A React Native app built with Expo for iOS and Android that serves as the companion app for SafeLoop Watch. This app allows caregivers to monitor and respond to emergency situations detected by the SafeLoop Watch app.

## Features

- **Cross-platform**: Works on both iOS and Android
- **Authentication**: Apple Sign-In and Google Sign-In via Supabase
- **Real-time monitoring**: Receives alerts from SafeLoop Watch (coming soon)
- **Emergency management**: Handles fall detection and manual help requests (coming soon)

## Setup

### Prerequisites

- Node.js 18+
- Expo CLI
- iOS Simulator (for iOS development)
- Android Studio (for Android development)

### Installation

1. Install dependencies:
```bash
npm install
```

2. Create environment file:
```bash
cp .env.example .env
```

3. Configure your environment variables in `.env`:
- `EXPO_PUBLIC_SUPABASE_URL`: Your Supabase project URL
- `EXPO_PUBLIC_SUPABASE_ANON_KEY`: Your Supabase anon key
- `EXPO_PUBLIC_GOOGLE_WEB_CLIENT_ID`: Your Google OAuth web client ID

4. Update `app.json` with your Google client ID in the plugin configuration

### Running the App

```bash
# Start the development server
npm start

# Run on iOS
npm run ios

# Run on Android
npm run android
```

## Architecture

- **Frontend**: React Native with Expo
- **Backend**: Supabase (database and authentication)
- **Navigation**: React Navigation v6
- **State Management**: React Context API

## Project Structure

```
safeloop-care/
├── screens/          # App screens
├── contexts/         # React contexts
├── lib/             # Utility functions and configurations
├── App.tsx          # Main app component
└── app.json         # Expo configuration
```

## Authentication Setup

### Apple Sign-In
- Configured via `expo-apple-authentication`
- Automatically integrated with Supabase auth

### Google Sign-In
- Configured via `@react-native-google-signin/google-signin`
- Requires Google OAuth setup in Google Cloud Console
- Integrated with Supabase auth

## Future Development

This app will eventually communicate with SafeLoop Server (migrated to Supabase Edge Functions) to:
- Receive real-time fall detection alerts
- Manage emergency contacts
- Handle location tracking
- Coordinate with SafeLoop Watch app