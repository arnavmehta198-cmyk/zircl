import { motion, useReducedMotion } from 'motion/react'
import { EASE } from './ui'

/** Masked slide-up reveal for a page's main heading — runs once on mount. */
export function RevealHeading({ children, className = '', delay = 0 }: {
  children: string; className?: string; delay?: number
}) {
  const reduce = useReducedMotion()
  return (
    <span className={`inline-block overflow-hidden pb-[0.12em] -mb-[0.12em] ${className}`}>
      <motion.span
        className="inline-block"
        initial={reduce ? { opacity: 0 } : { y: '110%' }}
        animate={reduce ? { opacity: 1 } : { y: 0 }}
        transition={{ delay, duration: 0.55, ease: [0.16, 1, 0.3, 1] }}
      >
        {children}
      </motion.span>
    </span>
  )
}

/** Fade-and-rise reveal for a subheading — trails just behind the heading mask. */
export function RevealSub({ children, className = '', delay = 0.12 }: {
  children: React.ReactNode; className?: string; delay?: number
}) {
  const reduce = useReducedMotion()
  return (
    <motion.p
      className={className}
      initial={reduce ? { opacity: 0 } : { opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay, duration: 0.45, ease: EASE }}
    >
      {children}
    </motion.p>
  )
}
