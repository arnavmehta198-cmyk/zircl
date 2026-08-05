import { supabase } from '../lib/supabase'
import { getUser, listUsersPage, type UserRecord } from './users'
import type { FeedUser } from '../lib/types'
import { ageFrom, milesBetween } from '../lib/format'
import { blockedEitherDirection } from './social'

// ---------- engagement / affinity (port of EngagementTracker) ----------

interface Record_ { profileId: string; gender: string; age: number; dwell: number; liked: boolean }

export class EngagementTracker {
  private records: Record_[] = []
  constructor(private uid: string) {}

  private static ageBucket(age: number) { return Math.floor(age / 5) }

  log(user: FeedUser, dwell: number, liked: boolean) {
    this.records.push({ profileId: user.id, gender: user.gender, age: user.age, dwell, liked })
    // Fire-and-forget telemetry; never read back (same as iOS).
    void supabase.from('impressions').insert({
      uid: this.uid, profile_id: user.id, gender: user.gender, age: user.age, dwell, liked,
    })
  }

  private score(pred: (r: Record_) => boolean): number {
    const subset = this.records.filter(pred)
    if (subset.length === 0) return 0.5
    const likeRate = subset.filter((r) => r.liked).length / subset.length
    const avgDwell = subset.reduce((s, r) => s + r.dwell, 0) / subset.length
    const dwellScore = Math.min(avgDwell / 8, 1) // 8s == full interest
    return 0.6 * likeRate + 0.4 * dwellScore
  }

  affinity(user: FeedUser): number {
    if (this.records.length === 0) return 0.5
    const gender = this.score((r) => r.gender === user.gender)
    const age = this.score((r) => EngagementTracker.ageBucket(r.age) === EngagementTracker.ageBucket(user.age))
    return 0.5 * gender + 0.5 * age
  }
}

// ---------- deck ----------

const SAMPLES: Omit<FeedUser, 'id' | 'distanceMiles' | 'matchScore' | 'imageURLs'>[] = [
  { name: 'Emily', age: 25, gender: 'female', bio: 'Looking for people who love tennis, good conversations, and spontaneous plans.', hobbies: ['Tennis', 'Movie', 'Food'] },
  { name: 'Marcus', age: 28, gender: 'male', bio: 'Weekend hiker and board-game hoarder. Always down for a coffee and a good story.', hobbies: ['Hiking', 'Board Games', 'Food'] },
  { name: 'Priya', age: 24, gender: 'female', bio: 'Climbing gym regular chasing new routes and better playlists.', hobbies: ['Climbing', 'Art', 'Movie'] },
  { name: 'Jordan', age: 31, gender: 'nonbinary', bio: "Runner, foodie, and reluctant morning person. Let's find the best tacos in town.", hobbies: ['Running', 'Food', 'Movie'] },
  { name: 'Chloe', age: 26, gender: 'female', bio: "Surf when I can, cycle when I can't. Big fan of golden-hour walks.", hobbies: ['Surfing', 'Cycling', 'Art'] },
  { name: 'Diego', age: 29, gender: 'male', bio: 'Pickleball obsessed. Will absolutely challenge you to a friendly match.', hobbies: ['Pickleball', 'Basketball', 'Food'] },
  { name: 'Sara', age: 27, gender: 'female', bio: 'Escape-room strategist and volleyball setter. Team players welcome.', hobbies: ['Escape Rooms', 'Volleyball', 'Movie'] },
  { name: 'Leo', age: 30, gender: 'male', bio: 'Cyclist by day, cinephile by night. Recommend me something to watch.', hobbies: ['Cycling', 'Movie', 'Food'] },
]

export class FeedDeck {
  deck: FeedUser[] = []
  private seenIDs = new Set<string>()
  private blocked = new Set<string>()
  private ownLocation: { lat: number; lon: number } | null = null
  private cursor: string | null = null
  private reachedEnd = false
  private fetching = false
  private generationIndex = 0
  readonly tracker: EngagementTracker

  constructor(private uid: string) { this.tracker = new EngagementTracker(uid) }

  async bootstrap() {
    this.blocked = await blockedEitherDirection(this.uid)
    const own = await getUser(this.uid)
    if (own && typeof own.latitude === 'number' && typeof own.longitude === 'number') {
      this.ownLocation = { lat: own.latitude, lon: own.longitude }
    }

    let initial = await this.fetchReal(15)
    if (initial.length < 6) initial = initial.concat(this.generate(10))
    this.deck = this.rank(this.dedupe(initial))
  }

  private mapUser(x: UserRecord): FeedUser | null {
    if (x.id === this.uid || this.blocked.has(x.id)) return null
    if (x.onboardingComplete !== true || !x.name) return null

    let distance = 1.0
    if (typeof x.latitude === 'number' && typeof x.longitude === 'number' && this.ownLocation) {
      distance = milesBetween(this.ownLocation.lat, this.ownLocation.lon, x.latitude, x.longitude)
    }

    return {
      id: x.id,
      name: x.name,
      age: ageFrom(x.dateOfBirth),
      gender: 'unknown', // gender is never stored on the user row
      distanceMiles: distance,
      bio: x.bio ?? '',
      hobbies: x.hobbies,
      matchScore: Math.floor(Math.random() * 22) + 76, // cosmetic only, 76...97
      imageURLs: x.photoURL ? [x.photoURL] : [],
    }
  }

  private async fetchReal(n: number): Promise<FeedUser[]> {
    if (this.reachedEnd) return []
    const { rows, nextCursor } = await listUsersPage(this.cursor, n)
    this.cursor = nextCursor
    if (rows.length < n) this.reachedEnd = true
    return rows.map((x) => this.mapUser(x)).filter((u): u is FeedUser => u !== null)
  }

  /** Endless filler so the deck never runs dry while the user base is small. */
  private generate(count: number): FeedUser[] {
    const batch: FeedUser[] = []
    for (let offset = 0; offset < count; offset++) {
      const index = this.generationIndex + offset
      const t = SAMPLES[index % SAMPLES.length]
      const base = ((index * 7) % 68) + 1
      batch.push({
        ...t,
        id: `gen-${index}`,
        distanceMiles: (index % 24) * 0.4 + 0.5,
        matchScore: Math.max(60, 98 - (index % 39)),
        imageURLs: [base, (base % 70) + 1, ((base + 9) % 70) + 1].map((i) => `https://i.pravatar.cc/400?img=${i}`),
      })
    }
    this.generationIndex += count
    return batch
  }

  private dedupe(users: FeedUser[]): FeedUser[] {
    return users.filter((u) => {
      if (this.seenIDs.has(u.id)) return false
      this.seenIDs.add(u.id)
      return true
    })
  }

  private rank(users: FeedUser[]): FeedUser[] {
    return [...users].sort((a, b) => this.tracker.affinity(b) - this.tracker.affinity(a))
  }

  async replenish() {
    if (this.fetching) return
    this.fetching = true
    try {
      let more = this.reachedEnd ? [] : await this.fetchReal(15)
      if (more.length < 6) more = more.concat(this.generate(10))
      const fresh = this.dedupe(more)
      if (fresh.length) this.deck = this.rank(this.deck.concat(fresh))
    } finally {
      this.fetching = false
    }
  }

  /** Removes the top card; caller handles the follow request for a right swipe. */
  pop(user: FeedUser, dwellSeconds: number, liked: boolean) {
    this.tracker.log(user, dwellSeconds, liked)
    this.deck = this.rank(this.deck.filter((u) => u.id !== user.id))
    if (this.deck.length <= 4) void this.replenish()
  }
}

export function filterDeck(deck: FeedUser[], search: string): FeedUser[] {
  const q = search.trim().toLowerCase()
  if (!q) return deck
  return deck.filter(
    (u) =>
      u.name.toLowerCase().includes(q) ||
      u.hobbies.some((h) => h.toLowerCase().includes(q)) ||
      `${Math.max(1, Math.ceil(u.distanceMiles))} miles away`.includes(q),
  )
}
