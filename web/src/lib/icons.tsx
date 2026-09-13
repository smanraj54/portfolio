/**
 * Icon registry.
 *
 * Every icon the site can render is named here. That gives content files a
 * closed `IconName` union — a typo in `content/*.ts` is a build error, not a
 * blank square at runtime — and keeps per-import tree-shaking, so the bundle
 * carries only these glyphs rather than a webfont.
 *
 * lucide-react v1 removed all brand marks (no `Github`, no `Linkedin`), so the
 * two social marks are hand-authored below from simple-icons paths (CC0-1.0).
 */
import {
  Award,
  BookOpen,
  Briefcase,
  Building2,
  Calendar,
  Check,
  ChevronDown,
  ChevronRight,
  CircleAlert,
  CircleCheck,
  Cloud,
  Code,
  Cpu,
  Database,
  Download,
  ExternalLink,
  Gauge,
  Globe,
  GraduationCap,
  Layers,
  LoaderCircle,
  Mail,
  MapPin,
  Menu,
  Moon,
  PanelLeftClose,
  PanelLeftOpen,
  Phone,
  Send,
  Server,
  Sparkles,
  Sun,
  Terminal,
  TrendingUp,
  User,
  Wrench,
  X,
  Zap,
} from 'lucide-react'
import type { SVGProps } from 'react'

type SvgComponent = (props: SVGProps<SVGSVGElement>) => React.ReactNode

/** GitHub mark. Path from simple-icons (CC0-1.0). */
function GithubMark(props: SVGProps<SVGSVGElement>) {
  return (
    <svg viewBox="0 0 24 24" fill="currentColor" {...props}>
      <path d="M12 .297c-6.63 0-12 5.373-12 12 0 5.303 3.438 9.8 8.205 11.385.6.113.82-.258.82-.577 0-.285-.01-1.04-.015-2.04-3.338.724-4.042-1.61-4.042-1.61C4.422 18.07 3.633 17.7 3.633 17.7c-1.087-.744.084-.729.084-.729 1.205.084 1.838 1.236 1.838 1.236 1.07 1.835 2.809 1.305 3.495.998.108-.776.417-1.305.76-1.605-2.665-.3-5.466-1.332-5.466-5.93 0-1.31.465-2.38 1.235-3.22-.135-.303-.54-1.523.105-3.176 0 0 1.005-.322 3.3 1.23.96-.267 1.98-.399 3-.405 1.02.006 2.04.138 3 .405 2.28-1.552 3.285-1.23 3.285-1.23.645 1.653.24 2.873.12 3.176.765.84 1.23 1.91 1.23 3.22 0 4.61-2.805 5.625-5.475 5.92.42.36.81 1.096.81 2.22 0 1.606-.015 2.896-.015 3.286 0 .315.21.69.825.57C20.565 22.092 24 17.592 24 12.297c0-6.627-5.373-12-12-12" />
    </svg>
  )
}

/** LinkedIn mark. Path from simple-icons (CC0-1.0). */
function LinkedinMark(props: SVGProps<SVGSVGElement>) {
  return (
    <svg viewBox="0 0 24 24" fill="currentColor" {...props}>
      <path d="M20.447 20.452h-3.554v-5.569c0-1.328-.027-3.037-1.852-3.037-1.853 0-2.136 1.445-2.136 2.939v5.667H9.351V9h3.414v1.561h.046c.477-.9 1.637-1.85 3.37-1.85 3.601 0 4.267 2.37 4.267 5.455v6.286zM5.337 7.433a2.062 2.062 0 0 1-2.063-2.065 2.064 2.064 0 1 1 2.063 2.065zm1.782 13.019H3.555V9h3.564v11.452zM22.225 0H1.771C.792 0 0 .774 0 1.729v20.542C0 23.227.792 24 1.771 24h20.451C23.2 24 24 23.227 24 22.271V1.729C24 .774 23.2 0 22.222 0h.003z" />
    </svg>
  )
}

/**
 * The registry. Keys are the names content files use.
 * Ordered by role so it reads as a vocabulary rather than an import dump.
 */
export const ICONS = {
  // Section navigation
  about: User,
  education: GraduationCap,
  skills: Wrench,
  experience: Briefcase,
  contact: Mail,

  // Social / contact
  github: GithubMark,
  linkedin: LinkedinMark,
  mail: Mail,
  phone: Phone,
  location: MapPin,
  resume: Download,

  // Skill-group glyphs
  code: Code,
  database: Database,
  cloud: Cloud,
  cpu: Cpu,
  layers: Layers,
  server: Server,
  globe: Globe,
  terminal: Terminal,
  sparkles: Sparkles,
  gauge: Gauge,
  zap: Zap,

  // Content furniture
  calendar: Calendar,
  organization: Building2,
  award: Award,
  book: BookOpen,
  metric: TrendingUp,

  // Controls
  chevronDown: ChevronDown,
  chevronRight: ChevronRight,
  external: ExternalLink,
  send: Send,
  check: Check,
  success: CircleCheck,
  error: CircleAlert,
  spinner: LoaderCircle,
  sun: Sun,
  moon: Moon,
  collapse: PanelLeftClose,
  expand: PanelLeftOpen,
  menu: Menu,
  close: X,
} satisfies Record<string, SvgComponent>

export type IconName = keyof typeof ICONS

export interface IconProps extends Omit<SVGProps<SVGSVGElement>, 'name'> {
  name: IconName
  /** Pixel size for both axes. Defaults to 1em so it tracks font-size. */
  size?: number | string
  /**
   * Accessible name. Omit for decorative icons — they then carry
   * aria-hidden and leave the tab/AT order untouched (§7).
   */
  label?: string
}

/**
 * Renders a registry icon.
 *
 * Decorative by default: with no `label` the glyph is `aria-hidden`, which is
 * what §7 asks for. Pass `label` only when the icon is the sole carrier of
 * meaning; an icon beside visible text should stay decorative.
 */
export function Icon({ name, size = '1em', label, ...rest }: IconProps) {
  const Glyph = ICONS[name]
  const a11y = label
    ? { role: 'img' as const, 'aria-label': label }
    : { 'aria-hidden': true, focusable: false as const }

  return (
    <Glyph
      width={size}
      height={size}
      // lucide glyphs are stroked; the two brand marks are filled and set
      // their own fill, so a shared strokeWidth is safe for both.
      strokeWidth={1.75}
      {...a11y}
      {...rest}
    />
  )
}
