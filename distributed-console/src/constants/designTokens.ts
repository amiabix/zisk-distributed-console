/**
 * Design System Tokens
 * Single source of truth for all visual properties
 * Updated: November 2024
 * Status: Production-ready token system
 */

// ============================================================================
// COLOR PALETTE - Semantic and Systematic
// ============================================================================

export const COLORS = {
  // Primary Brand - Green Theme
  primary: {
    // Darkest to lightest
    950: '#0a2e1f',  // Darkest (unused, but for completeness)
    900: '#0f4a31',
    800: '#136b3d',
    700: '#18875a',
    600: '#1da767',
    500: '#007755',  // Main brand green (keeping original)
    400: '#0ABF83',
    300: '#4ade80',
    200: '#86efac',
    100: '#bbf7d0',
    50: '#f0fdf4',   // Very light
  },

  // Accent - Yellow Warning/Highlight
  accent: {
    950: '#713f12',
    900: '#92400e',
    800: '#b45309',
    700: '#d97706',
    600: '#f59e0b',
    500: '#f4ff00',  // Brand yellow (current)
    400: '#fbbf24',
    300: '#fcd34d',
    200: '#fef08a',
    100: '#fef3c7',
    50: '#fffbeb',
  },

  // Semantic Colors
  error: {
    500: '#ef4444',  // RED
    400: '#f87171',
    300: '#fca5a5',
    100: '#fee2e2',
  },

  success: {
    500: '#10b981',  // GREEN (same as primary 500)
    400: '#6ee7b7',
    300: '#a7f3d0',
    100: '#d1fae5',
  },

  warning: {
    500: '#f59e0b',  // ORANGE-YELLOW
    400: '#fbbf24',
    300: '#fcd34d',
    100: '#fef3c7',
  },

  info: {
    500: '#3b82f6',  // BLUE
    400: '#60a5fa',
    300: '#93c5fd',
    100: '#dbeafe',
  },

  // Neutral Grayscale (for dark theme)
  neutral: {
    // Dark background base
    0: '#000000',
    50: '#f9fafb',
    100: '#f3f4f6',
    200: '#e5e7eb',
    300: '#d1d5db',
    400: '#9ca3af',
    500: '#6b7280',
    600: '#4b5563',    // Main glass background base
    700: '#374151',
    800: '#1f2937',
    900: '#111827',
    950: '#030712',   // Very dark (almost black)
    // Dark theme specific
    dark: {
      50: '#f3f3f2',
      100: '#E7E7E3',
      200: '#B8B8B4',
      300: '#8E8E8a',
      400: '#606060',
      500: '#363636',
      600: '#2D2E3D',
      700: '#1A1A24',
      800: '#0C0C0C',
    },
  },

  // Glassmorphism - Transparency layers
  glass: {
    weak: 'rgba(45, 46, 61, 0.3)',     // 30% opacity
    base: 'rgba(45, 46, 61, 0.5)',     // 50% opacity (DEFAULT)
    strong: 'rgba(45, 46, 61, 0.7)',   // 70% opacity
    solid: 'rgba(45, 46, 61, 0.85)',   // 85% opacity
  },

  // Semantic Glass
  glassGreen: 'rgba(0, 119, 85, 0.25)',  // Green-tinted glass
  glassYellow: 'rgba(244, 255, 0, 0.15)', // Yellow-tinted glass
  glassRed: 'rgba(239, 68, 68, 0.12)',    // Red-tinted glass

  // Borders & Dividers
  border: {
    light: 'rgba(255, 255, 255, 0.05)',
    base: 'rgba(255, 255, 255, 0.1)',
    strong: 'rgba(255, 255, 255, 0.15)',
  },
} as const;

// ============================================================================
// TYPOGRAPHY - Semantic font sizing and weights
// ============================================================================

export const TYPOGRAPHY = {
  // Font families
  fontFamily: {
    sans: "'Inter', -apple-system, BlinkMacSystemFont, 'Segoe UI', 'Roboto', sans-serif",
    display: "'IBM Plex Sans', 'Inter', sans-serif",
    mono: "'IBM Plex Mono', ui-monospace, SFMono-Regular, 'SF Mono', Menlo, Consolas, monospace",
  },

  // Font sizes with semantic naming
  fontSize: {
    xs: { size: '0.75rem', lineHeight: '1rem' },      // 12px
    sm: { size: '0.875rem', lineHeight: '1.25rem' },  // 14px
    base: { size: '1rem', lineHeight: '1.5rem' },     // 16px
    lg: { size: '1.125rem', lineHeight: '1.75rem' },  // 18px
    xl: { size: '1.25rem', lineHeight: '1.75rem' },   // 20px
    '2xl': { size: '1.5rem', lineHeight: '2rem' },    // 24px
    '3xl': { size: '1.875rem', lineHeight: '2.25rem' }, // 30px
    '4xl': { size: '2.25rem', lineHeight: '2.5rem' },  // 36px
  },

  // Font weights
  fontWeight: {
    light: 300,
    normal: 400,
    medium: 500,
    semibold: 600,
    bold: 700,
    extrabold: 800,
  },

  // Semantic text styles
  styles: {
    h1: { size: '2.25rem', weight: 700, family: 'display' },      // Large headings
    h2: { size: '1.875rem', weight: 700, family: 'display' },     // Section headings
    h3: { size: '1.5rem', weight: 600, family: 'display' },       // Subsection headings
    h4: { size: '1.25rem', weight: 600, family: 'display' },
    body: { size: '1rem', weight: 400, family: 'sans' },          // Default body text
    bodySmall: { size: '0.875rem', weight: 400, family: 'sans' }, // Secondary text
    caption: { size: '0.75rem', weight: 500, family: 'sans' },    // Labels and captions
    mono: { size: '0.875rem', weight: 400, family: 'mono' },      // Code and IDs
  },
} as const;

// ============================================================================
// SPACING - Systematic spacing scale (4px base unit)
// ============================================================================

export const SPACING = {
  xs: '0.25rem',  // 4px
  sm: '0.5rem',   // 8px
  md: '1rem',     // 16px
  lg: '1.5rem',   // 24px
  xl: '2rem',     // 32px
  '2xl': '3rem',  // 48px
  '3xl': '4rem',  // 64px
} as const;

// Component-level spacing
export const COMPONENT_SPACING = {
  // Padding for different component sizes
  button: {
    sm: { x: '0.5rem', y: '0.375rem' },   // 8px x 6px
    md: { x: '1rem', y: '0.5rem' },       // 16px x 8px (DEFAULT)
    lg: { x: '1.5rem', y: '0.75rem' },    // 24px x 12px
  },

  // Card padding
  card: {
    sm: '0.75rem',  // 12px (compact)
    md: '1rem',     // 16px (DEFAULT)
    lg: '1.5rem',   // 24px (spacious)
  },

  // Gap between grid items
  gap: {
    tight: '0.5rem',  // 8px
    default: '1rem',  // 16px (USE THIS AS DEFAULT)
    relaxed: '1.5rem', // 24px
    loose: '2rem',    // 32px
  },

  // Modal/Overlay insets
  modal: {
    padding: '2rem',       // 32px
    borderRadius: '1rem',  // 16px
  },
} as const;

// ============================================================================
// BORDER RADIUS - Semantic curvature
// ============================================================================

export const BORDER_RADIUS = {
  none: '0px',
  xs: '4px',      // Subtle (inputs)
  sm: '8px',      // Small (small buttons, badges)
  md: '12px',     // Medium (buttons, small cards)
  lg: '16px',     // Large (cards, dropdowns)
  xl: '24px',     // Extra large (modals, main cards)
  full: '9999px', // Pill buttons
} as const;

// Component-level radius
export const COMPONENT_RADIUS = {
  button: BORDER_RADIUS.md,        // 12px
  input: BORDER_RADIUS.xs,         // 4px
  card: BORDER_RADIUS.lg,          // 16px
  modal: BORDER_RADIUS.xl,         // 24px
  container: BORDER_RADIUS.xl,     // 24px
  avatar: BORDER_RADIUS.full,      // Circle
} as const;

// ============================================================================
// SHADOWS - Depth hierarchy
// ============================================================================

export const SHADOWS = {
  // Elevation-based shadows
  none: 'none',
  xs: '0 1px 2px 0 rgba(0, 0, 0, 0.05)',
  sm: '0 1px 3px 0 rgba(0, 0, 0, 0.1), 0 1px 2px 0 rgba(0, 0, 0, 0.06)',
  md: '0 4px 6px -1px rgba(0, 0, 0, 0.1), 0 2px 4px -1px rgba(0, 0, 0, 0.06)',
  lg: '0 10px 15px -3px rgba(0, 0, 0, 0.1), 0 4px 6px -2px rgba(0, 0, 0, 0.05)',
  xl: '0 20px 25px -5px rgba(0, 0, 0, 0.1), 0 10px 10px -5px rgba(0, 0, 0, 0.04)',
  '2xl': '0 25px 50px -12px rgba(0, 0, 0, 0.25)',

  // Glow effects (light emission)
  glowGreen: '0 0 20px rgba(0, 119, 85, 0.5), 0 0 40px rgba(0, 119, 85, 0.25)',
  glowYellow: '0 0 20px rgba(244, 255, 0, 0.5), 0 0 40px rgba(244, 255, 0, 0.25)',
  glowRed: '0 0 20px rgba(239, 68, 68, 0.5), 0 0 40px rgba(239, 68, 68, 0.25)',

  // Inner shadows (for glass effect)
  innerGlass: 'inset 0 1px 0 0 rgba(255, 255, 255, 0.05)',
  innerGlassStrong: 'inset 0 1px 0 0 rgba(255, 255, 255, 0.08)',
} as const;

// ============================================================================
// ANIMATIONS & TRANSITIONS - Consistent timing
// ============================================================================

export const ANIMATIONS = {
  // Transition timing
  duration: {
    fast: '150ms',      // Micro-interactions
    normal: '300ms',    // DEFAULT - Standard transitions
    slow: '500ms',      // Emphasis
    verySlow: '800ms',  // Hero animations
  },

  easing: {
    linear: 'linear',
    easeIn: 'cubic-bezier(0.4, 0, 1, 1)',
    easeOut: 'cubic-bezier(0, 0, 0.2, 1)',
    easeInOut: 'cubic-bezier(0.4, 0, 0.2, 1)',
    custom: 'cubic-bezier(0.4, 0, 0.6, 1)',
  },

  // Keyframe animations
  keyframes: {
    // Fade effects
    fadeIn: 'fadeIn 300ms ease-out',
    fadeOut: 'fadeOut 300ms ease-in',

    // Pulse effects
    pulseCyan: 'pulse-cyan 2s cubic-bezier(0.4, 0, 0.6, 1) infinite',

    // Shimmer for active state
    shimmer: 'shimmer 2s infinite',

    // Gradient animation
    gradientShift: 'gradient-shift 3s ease infinite',

    // Scale effects
    scaleIn: 'scale-in 200ms ease-out',
  },
} as const;

// ============================================================================
// GLASS MORPHISM - Unified glass effect system
// ============================================================================

export const GLASS = {
  // Base glass effect
  base: {
    background: COLORS.glass.base,
    backdropFilter: 'blur(24px) saturate(180%)',
    border: `1px solid ${COLORS.border.base}`,
    boxShadow: `0 8px 32px 0 rgba(0, 0, 0, 0.4), ${SHADOWS.innerGlass}`,
  },

  // Weak glass (subtle)
  weak: {
    background: COLORS.glass.weak,
    backdropFilter: 'blur(16px) saturate(180%)',
    border: `1px solid ${COLORS.border.light}`,
    boxShadow: `0 4px 16px 0 rgba(0, 0, 0, 0.3), ${SHADOWS.innerGlass}`,
  },

  // Strong glass (elevated)
  strong: {
    background: COLORS.glass.strong,
    backdropFilter: 'blur(32px) saturate(180%)',
    border: `1px solid ${COLORS.border.strong}`,
    boxShadow: `0 12px 40px 0 rgba(0, 0, 0, 0.5), ${SHADOWS.innerGlassStrong}`,
  },

  // Solid glass (almost opaque)
  solid: {
    background: COLORS.glass.solid,
    backdropFilter: 'blur(40px) saturate(180%)',
    border: `1px solid ${COLORS.border.strong}`,
    boxShadow: `0 20px 50px 0 rgba(0, 0, 0, 0.6), ${SHADOWS.innerGlassStrong}`,
  },

  // Colored glass variants
  green: {
    background: COLORS.glassGreen,
    backdropFilter: 'blur(24px) saturate(180%)',
    border: '1px solid rgba(0, 255, 124, 0.3)',
    boxShadow: `${SHADOWS.glowGreen}, ${SHADOWS.innerGlass}`,
  },

  yellow: {
    background: COLORS.glassYellow,
    backdropFilter: 'blur(24px) saturate(180%)',
    border: '1px solid rgba(244, 255, 0, 0.3)',
    boxShadow: `${SHADOWS.glowYellow}, ${SHADOWS.innerGlass}`,
  },

  red: {
    background: COLORS.glassRed,
    backdropFilter: 'blur(24px) saturate(180%)',
    border: '1px solid rgba(239, 68, 68, 0.3)',
    boxShadow: `${SHADOWS.glowRed}, ${SHADOWS.innerGlass}`,
  },
} as const;

// ============================================================================
// COMPONENT VARIANTS - Pre-built component patterns
// ============================================================================

export const COMPONENTS = {
  button: {
    primary: {
      background: COLORS.primary[500],
      color: COLORS.neutral.dark[50],
      hover: COLORS.primary[600],
      active: COLORS.primary[700],
      disabled: COLORS.neutral[400],
    },

    secondary: {
      background: COLORS.glass.base,
      color: COLORS.neutral.dark[200],
      hover: COLORS.glass.strong,
      active: COLORS.glass.strong,
      disabled: COLORS.neutral[400],
      border: COLORS.border.base,
    },

    accent: {
      background: COLORS.accent[500],
      color: COLORS.neutral.dark[800],
      hover: COLORS.accent[600],
      active: COLORS.accent[700],
      disabled: COLORS.neutral[400],
    },

    danger: {
      background: COLORS.error[500],
      color: COLORS.neutral.dark[50],
      hover: COLORS.error[600],
      active: COLORS.error[700],
      disabled: COLORS.neutral[400],
    },
  },

  card: {
    default: {
      ...GLASS.base,
      padding: COMPONENT_SPACING.card.md,
      borderRadius: COMPONENT_RADIUS.card,
    },

    elevated: {
      ...GLASS.strong,
      padding: COMPONENT_SPACING.card.lg,
      borderRadius: COMPONENT_RADIUS.card,
    },

    compact: {
      ...GLASS.weak,
      padding: COMPONENT_SPACING.card.sm,
      borderRadius: COMPONENT_RADIUS.card,
    },
  },

  input: {
    background: COLORS.glass.base,
    color: COLORS.neutral.dark[50],
    border: COLORS.border.base,
    placeholder: COLORS.neutral[500],
    focus: COLORS.border.strong,
    disabled: COLORS.neutral[700],
    borderRadius: COMPONENT_RADIUS.input,
  },
} as const;

// ============================================================================
// RESPONSIVE BREAKPOINTS
// ============================================================================

export const BREAKPOINTS = {
  xs: '320px',
  sm: '640px',
  md: '768px',
  lg: '1024px',
  xl: '1280px',
  '2xl': '1536px',
} as const;

// ============================================================================
// Z-INDEX HIERARCHY
// ============================================================================

export const Z_INDEX = {
  base: 0,
  dropdown: 10,
  sticky: 20,
  fixed: 30,
  backdrop: 40,
  modal: 50,
  tooltip: 60,
  notification: 70,
} as const;

