import { NativeStackNavigationProp } from '@react-navigation/native-stack'

export type RootStackParamList = {
  Login: undefined
  ProfileSetup: undefined
  Home: undefined
  MainMenu: undefined
  Settings: undefined
  Wearers: undefined
  RegisterWearer: undefined
  EditWearer: { wearerId: string }
  WearerDetails: { wearerId: string }
  Caregivers: undefined
  InviteCaregiver: undefined
  HelpRequestDetail: { helpRequestId: string }
}

export type AppNavigationProp = NativeStackNavigationProp<RootStackParamList>
