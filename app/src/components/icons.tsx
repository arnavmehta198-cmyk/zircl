// Single icon source: Lucide. The `Icon.*` names are the app's semantic layer
// so screens name what a glyph means, not which library drew it.
import {
  Rss, Users, MessageCircle, CalendarPlus, Calendar as CalendarIcon, Map, User, Sparkles,
  Menu as MenuIcon, Bell, Search, ChevronLeft, ChevronRight, Plus, X, Send, MoreHorizontal,
  Lock, MapPin, Heart, Check, Camera, Trash2, Shield, SlidersHorizontal, Clock, LogOut,
  Flag, Ban, Image as ImageIcon, Video, Smile, BarChart3, Film, History as HistoryIcon,
  Info, ImagePlus, Paperclip, Mic, Play, Pause, Download, Reply, Copy, Link2, Globe,
  Languages, type LucideIcon,
} from 'lucide-react'

interface IconProps { className?: string; size?: number }

/** Wraps a Lucide icon so call sites keep the `size`/`className` shape they already use. */
const wrap = (C: LucideIcon) => ({ className, size = 20 }: IconProps) => (
  <C className={className} size={size} strokeWidth={1.75} aria-hidden />
)

export const Icon = {
  Feed: wrap(Rss),
  Clubs: wrap(Users),
  Messages: wrap(MessageCircle),
  Schedule: wrap(CalendarPlus),
  Calendar: wrap(CalendarIcon),
  Activities: wrap(Map),
  Profile: wrap(User),
  Premium: wrap(Sparkles),
  Menu: wrap(MenuIcon),
  Bell: wrap(Bell),
  Search: wrap(Search),
  ChevronLeft: wrap(ChevronLeft),
  ChevronRight: wrap(ChevronRight),
  Plus: wrap(Plus),
  Close: wrap(X),
  Send: wrap(Send),
  More: wrap(MoreHorizontal),
  Lock: wrap(Lock),
  Pin: wrap(MapPin),
  Heart: wrap(Heart),
  Check: wrap(Check),
  Camera: wrap(Camera),
  Trash: wrap(Trash2),
  Shield: wrap(Shield),
  Sliders: wrap(SlidersHorizontal),
  Clock: wrap(Clock),
  Logout: wrap(LogOut),
  Flag: wrap(Flag),
  Ban: wrap(Ban),
  Image: wrap(ImageIcon),
  Video: wrap(Video),
  Smile: wrap(Smile),
  Poll: wrap(BarChart3),
  Gif: wrap(Film),
  Users: wrap(Users),
  History: wrap(HistoryIcon),
  Info: wrap(Info),
  ImagePlus: wrap(ImagePlus),
  Attach: wrap(Paperclip),
  Mic: wrap(Mic),
  Play: wrap(Play),
  Pause: wrap(Pause),
  Download: wrap(Download),
  Reply: wrap(Reply),
  Copy: wrap(Copy),
  Link: wrap(Link2),
  Globe: wrap(Globe),
  Language: wrap(Languages),
}
