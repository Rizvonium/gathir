/**
 * Gathir generative pattern art (Skia). Design-time twins live in design/pattern-lab/.
 * Geometry is pure and shared 1:1 with the lab; components take colours from useTheme().
 */
export { PatternHeader, type PatternHeaderProps } from './PatternHeader';
export { KaniWeaveBackground, type KaniWeaveBackgroundProps } from './KaniWeaveBackground';
export { PatternPlaceholder, type PatternPlaceholderProps } from './PatternPlaceholder';
export { ThreadWeaveLogo, type ThreadWeaveLogoProps } from './ThreadWeaveLogo';
export { ChinarLeaves, type ChinarLeavesProps } from './ChinarLeaves';
export { PaisleyConfetti, type PaisleyConfettiProps } from './PaisleyConfetti';
export { LoomEmptyState, type LoomEmptyStateProps } from './LoomEmptyState';
export { patternInks, inkAt } from './inks';
export { productInitials } from './placeholderArt';
export { usePatternLoop, type PatternLoopState } from './usePatternLoop';
export { useAppActive } from './useAppActive';
export { useReducedMotionLive } from './useReducedMotionLive';
export * as patternGeometry from './geometry';
