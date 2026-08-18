import { cn } from './utils'

// The house emoji always paints in its own colours. Blanking only the fill colour
// leaves `color` intact, so a zero-blur shadow redraws it as a currentColor silhouette.
export function SVGHomeFilled({ className, ...rest }) {
  return (
    <span
      aria-hidden="true"
      className={cn(
        'text-[0.9em] leading-[1] [-webkit-text-fill-color:transparent] [text-shadow:0_0_0_currentColor]',
        className,
      )}
      {...rest}
    >
      🏠
    </span>
  )
}
