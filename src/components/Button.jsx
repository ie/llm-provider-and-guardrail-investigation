import { cn } from './utils'

const BASE =
    'inline-flex min-h-11 cursor-pointer items-center justify-center gap-3xs px-s py-3xs text-sm uppercase tracking-[0.2em] transition-colors focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent aria-disabled:cursor-not-allowed aria-disabled:opacity-50 disabled:cursor-not-allowed disabled:opacity-50'

const VARIANTS = {
    primary: 'border border-fg bg-fg text-canvas hover:bg-transparent hover:text-fg',
    secondary: 'border border-line text-fg hover:border-fg',
    tertiary: 'text-fg underline-offset-4 hover:underline',
    'hero-primary': 'border border-fg bg-fg text-canvas hover:bg-transparent hover:text-fg',
    'hero-secondary': 'border border-fg text-fg hover:bg-fg hover:text-canvas',
}

export function Button({
    variant = 'primary',
    component: Component = 'button',
    isDisabled,
    icon,
    className,
    children,
    ...rest
}) {
    return (
        <Component
            aria-disabled={isDisabled || undefined}
            disabled={Component === 'button' ? isDisabled : undefined}
            className={cn(BASE, VARIANTS[variant], className)}
            {...rest}
        >
            {icon}
            {children}
        </Component>
    )
}
