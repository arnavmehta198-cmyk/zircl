import {
  Zap, Waves, CircleDot, Bike, Mountain, Palette, Puzzle, Dices, Clapperboard,
  Footprints, Volleyball, UtensilsCrossed, Sparkles, Target, type LucideIcon,
} from 'lucide-react'

// Lucide glyph per hobby — emoji-as-icon is banned across the app.
const ICONS: Record<string, LucideIcon> = {
  tennis: Zap,
  pickleball: Target,
  surfing: Waves,
  basketball: CircleDot,
  cycling: Bike,
  climbing: Mountain,
  art: Palette,
  'escape rooms': Puzzle,
  'board games': Dices,
  movie: Clapperboard,
  movies: Clapperboard,
  hiking: Mountain,
  running: Footprints,
  volleyball: Volleyball,
  food: UtensilsCrossed,
}

export function hobbyIcon(hobby: string, size = 14) {
  const C = ICONS[hobby.trim().toLowerCase()] ?? Sparkles
  return <C size={size} strokeWidth={1.75} aria-hidden />
}
