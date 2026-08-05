// Mirrors the Swift models exactly so the web app reads/writes the same
// Firestore documents as the iOS app. Field names are load-bearing.

export const HOBBIES = [
  'Tennis', 'Pickleball', 'Surfing', 'Basketball', 'Cycling', 'Climbing',
  'Art', 'Escape Rooms', 'Board Games', 'Movies', 'Hiking', 'Running', 'Volleyball',
] as const
export type Hobby = (typeof HOBBIES)[number]

export type PlanTier = 'free' | 'premium'

export type MessageKind = 'text' | 'photo' | 'sticker' | 'gif' | 'poll' | 'video' | 'event' | 'file' | 'audio'

/** Quoted-message summary carried on a reply — enough to render the quote block without a second fetch. */
export interface ReplyRef {
  id: string
  senderID: string
  senderName: string
  preview: string
}

export const REPORT_REASONS = [
  'Spam', 'Harassment or abuse', 'Inappropriate content', 'Fake profile', 'Other',
] as const
export type ReportReason = (typeof REPORT_REASONS)[number]

/** users/{uid} */
export interface UserProfile {
  name: string
  dateOfBirth: Date
  bio: string
  photoURL: string | null
  hobbies: string[]
  latitude: number | null
  longitude: number | null
  notificationsEnabled: boolean
  onboardingComplete: boolean
  createdAt: Date
  plan?: PlanTier
}

/** Feed view-model. Not a stored document — assembled client-side. */
export interface FeedUser {
  id: string
  name: string
  age: number
  gender: 'male' | 'female' | 'nonbinary' | 'unknown'
  distanceMiles: number
  bio: string
  hobbies: string[]
  matchScore: number
  imageURLs: string[]
}

/** conversations/{sortedPairId} */
export interface Conversation {
  id: string
  otherID: string
  otherName: string
  otherPhotoURL: string | null
  lastMessage: string
  lastTimestamp: Date
  isUnread: boolean
}

/** Supabase `messages` table, filtered by conversation_id or club_id. */
export interface ChatMessage {
  id: string
  senderID: string
  text: string
  timestamp: Date
  kind: MessageKind
  photoURL?: string | null
  gifURL?: string | null
  sticker?: string | null
  pollOptions: string[]
  pollVotes: Record<string, string>
  scheduledFor?: Date | null
  videoURL?: string | null
  eventTitle?: string | null
  eventLocation?: string | null
  eventDate?: Date | null
  eventAttendance: Record<string, string>
  /** emoji -> uids who reacted with it. One active emoji per uid across the whole map. */
  reactions: Record<string, string[]>
  replyTo?: ReplyRef | null
  fileName?: string | null
  fileSize?: number | null
  fileURL?: string | null
  audioURL?: string | null
  audioDurationSec?: number | null
}

/** clubs/{auto} */
export interface Club {
  id: string
  name: string
  hobby: string
  creatorID: string
  memberIDs: string[]
  createdAt: Date
  isAdminControlled: boolean
  adminIDs: string[]
  bannedIDs: string[]
}

export interface ClubMember {
  id: string
  name: string
  photoURL: string | null
}

/** events/{auto} — 1:1 scheduled meetups */
export interface ScheduledEvent {
  id: string
  creatorID: string
  creatorFirstName: string
  creatorLastName: string
  creatorEmail: string
  creatorPhone: string
  inviteeID: string
  inviteeName: string
  hobby: string
  locationName: string
  date: Date
  status: 'pending' | 'accepted' | 'declined'
  createdAt: Date
}

export interface FollowRequest {
  id: string
  from: string
  to: string
  status: 'pending' | 'accepted'
  createdAt: Date
}

export interface ViewedPerson {
  id: string
  name: string
  age: number
  photoURL: string | null
  bio: string
  hobbies: string[]
}

/** Free-plan caps — must match FreePlanLimits in UsageTracker.swift */
export const FreePlanLimits = {
  dailyMessages: 5,
  dailyFollowRequests: 3,
  monthlyEvents: 2,
  clubMessageHistory: 15,
} as const
