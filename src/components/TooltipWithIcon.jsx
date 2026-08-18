import { TooltipPopup } from './TooltipPopup'
import { cn } from './utils'

// Reveal is CSS-only: the wrapper is the group, the bubble is absolute so it never
// shifts layout. The fixed-width wrapper gives TooltipPopup's max-w-[80%] a sane
// containing block.
export function TooltipWithIcon({
  label = 'More information',
  className,
  children,
  ...rest
}) {
  return (
    <div className={cn('group relative inline-flex', className)} {...rest}>
      <button
        type="button"
        aria-label={label}
        className="cursor-pointer text-fg-muted hover:text-fg focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent"
      >
        <svg
          viewBox="0 0 16 16"
          fill="none"
          stroke="currentColor"
          strokeLinecap="round"
          aria-hidden="true"
          className="size-4"
        >
          <circle cx="8" cy="8" r="7" />
          <path d="M8 7.5v4M8 4.5h.01" />
        </svg>
      </button>
      <div className="pointer-events-none invisible absolute top-full right-0 z-10 w-[18rem] pt-4xs opacity-0 transition-opacity group-hover:visible group-hover:opacity-100 group-focus-within:visible group-focus-within:opacity-100 motion-reduce:transition-none">
        <TooltipPopup pointerPosition="top-right">{children}</TooltipPopup>
      </div>
    </div>
  )
}
