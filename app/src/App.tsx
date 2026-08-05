import { lazy, Suspense, type ReactNode } from 'react'
import { Navigate, Route, Routes } from 'react-router-dom'
import { useApp } from './context/AppContext'
import { Spinner } from './components/ui'
import GlobalBackground from './components/GlobalBackground'

import WelcomeScreen from './screens/WelcomeScreen'
import LoginScreen from './screens/LoginScreen'
import SignUpScreen from './screens/SignUpScreen'
import PrivacyPolicyScreen from './screens/PrivacyPolicyScreen'
import OnboardingScreen from './screens/OnboardingScreen'
import FeedScreen from './screens/FeedScreen'
import PersonProfileScreen from './screens/PersonProfileScreen'
import ClubsScreen from './screens/ClubsScreen'
import ClubDetailScreen from './screens/ClubDetailScreen'
import ClubChatScreen from './screens/ClubChatScreen'
import MessagesScreen from './screens/MessagesScreen'
import ChatScreen from './screens/ChatScreen'
import ScheduleScreen from './screens/ScheduleScreen'
import CalendarScreen from './screens/CalendarScreen'
// maplibre-gl is ~800kb — code-split so only the Activities page pays for it.
const ActivitiesScreen = lazy(() => import('./screens/ActivitiesScreen'))
import ProfileScreen from './screens/ProfileScreen'
import EditProfileScreen from './screens/EditProfileScreen'
import AlgorithmSettingsScreen from './screens/AlgorithmSettingsScreen'
import FriendsScreen from './screens/FriendsScreen'
import RecentlyViewedScreen from './screens/RecentlyViewedScreen'
import PremiumScreen from './screens/PremiumScreen'

function FullPageSpinner() {
  return (
    <div className="h-full flex items-center justify-center">
      <Spinner className="text-accent w-8 h-8" />
    </div>
  )
}

function Routed({ children }: { children: ReactNode }) {
  return (
    <>
      <GlobalBackground />
      {children}
    </>
  )
}

export default function App() {
  const { user, loadingAuth, hasCompletedOnboarding } = useApp()

  if (loadingAuth) return <Routed><FullPageSpinner /></Routed>

  // Signed out — the welcome/auth flow.
  if (!user) {
    return (
      <Routed>
        <Routes>
          <Route path="/welcome" element={<WelcomeScreen />} />
          <Route path="/login" element={<LoginScreen />} />
          <Route path="/signup" element={<SignUpScreen />} />
          <Route path="/privacy" element={<PrivacyPolicyScreen />} />
          <Route path="*" element={<Navigate to="/welcome" replace />} />
        </Routes>
      </Routed>
    )
  }

  // Signed in but we don't yet know whether onboarding finished.
  if (hasCompletedOnboarding === null) return <Routed><FullPageSpinner /></Routed>

  if (hasCompletedOnboarding === false) {
    return (
      <Routed>
        <Routes>
          <Route path="/onboarding" element={<OnboardingScreen />} />
          <Route path="*" element={<Navigate to="/onboarding" replace />} />
        </Routes>
      </Routed>
    )
  }

  return (
    <Routed>
      <Routes>
        <Route path="/feed" element={<FeedScreen />} />
        <Route path="/person/:id" element={<PersonProfileScreen />} />
        <Route path="/clubs" element={<ClubsScreen />} />
        <Route path="/clubs/:id" element={<ClubDetailScreen />} />
        <Route path="/clubs/:id/chat" element={<ClubChatScreen />} />
        <Route path="/messages" element={<MessagesScreen />} />
        <Route path="/chat/:otherID" element={<ChatScreen />} />
        <Route path="/schedule" element={<ScheduleScreen />} />
        <Route path="/calendar" element={<CalendarScreen />} />
        <Route path="/activities" element={<Suspense fallback={<FullPageSpinner />}><ActivitiesScreen /></Suspense>} />
        <Route path="/profile" element={<ProfileScreen />} />
        <Route path="/profile/edit" element={<EditProfileScreen />} />
        <Route path="/profile/algorithm" element={<AlgorithmSettingsScreen />} />
        <Route path="/profile/friends" element={<FriendsScreen />} />
        <Route path="/profile/recent" element={<RecentlyViewedScreen />} />
        <Route path="/privacy" element={<PrivacyPolicyScreen />} />
        <Route path="/premium" element={<PremiumScreen />} />
        <Route path="*" element={<Navigate to="/feed" replace />} />
      </Routes>
    </Routed>
  )
}
