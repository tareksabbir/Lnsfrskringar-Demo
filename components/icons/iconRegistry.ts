/**
 * Canonical icon registry — single source of truth for all block icons.
 *
 * To add a new icon to the system:
 *   1. Add an import + entry here
 *   2. Add an entry in cms/display-templates/_shared/iconChoices.ts
 *   3. Push the updated display templates (config push or MCP)
 *
 * Keys are camelCase and match display template setting values exactly.
 */
import {
  Activity, ArrowRight, ArrowUpRight, Award,
  BarChart2, Calendar, CheckCircle, ChevronRight,
  Clock, Code, Cpu, Database,
  DollarSign, Download, ExternalLink, Eye,
  Gauge, Globe, Headphones, Heart,
  Infinity, Layers, Lightbulb, Lock,
  Mail, MapPin, MessageSquare, Monitor,
  Package, Percent, Play, Plus,
  Rocket, Send, Server, Settings,
  Shield, Sparkles, Star, Target,
  ThumbsUp, Timer, TrendingUp, Trophy,
  UserCheck, Users, Wrench, Zap,
  type LucideIcon,
} from 'lucide-react'

export type { LucideIcon }
export type IconKey = keyof typeof ICON_REGISTRY

export const ICON_REGISTRY: Record<string, LucideIcon> = {
  activity:     Activity,
  arrowRight:   ArrowRight,
  arrowUpRight: ArrowUpRight,
  award:        Award,
  barChart:     BarChart2,
  calendar:     Calendar,
  checkCircle:  CheckCircle,
  chevronRight: ChevronRight,
  clock:        Clock,
  code:         Code,
  cpu:          Cpu,
  database:     Database,
  dollarSign:   DollarSign,
  download:     Download,
  externalLink: ExternalLink,
  eye:          Eye,
  gauge:        Gauge,
  globe:        Globe,
  headphones:   Headphones,
  heart:        Heart,
  infinity:     Infinity,
  layers:       Layers,
  lightbulb:    Lightbulb,
  lock:         Lock,
  mail:         Mail,
  mapPin:       MapPin,
  messageSquare:MessageSquare,
  monitor:      Monitor,
  package:      Package,
  percent:      Percent,
  play:         Play,
  plus:         Plus,
  rocket:       Rocket,
  send:         Send,
  server:       Server,
  settings:     Settings,
  shield:       Shield,
  sparkles:     Sparkles,
  star:         Star,
  target:       Target,
  thumbsUp:     ThumbsUp,
  timer:        Timer,
  trendingUp:   TrendingUp,
  trophy:       Trophy,
  userCheck:    UserCheck,
  users:        Users,
  wrench:       Wrench,
  zap:          Zap,
}
