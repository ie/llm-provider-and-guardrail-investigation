import { cn } from './utils'

// Tailwind ships no icons. U+2302 is the closest monochrome house glyph and inherits
// currentColor like real icon markup.
export function SVGHome({ className, ...rest }) {
  return (
    <span
      aria-hidden="true"
      className={cn('text-[1.75em] leading-[1]', className)}
      {...rest}
    >
      ⌂
    </span>
  )
}
