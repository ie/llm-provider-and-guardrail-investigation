import { cn } from './utils'

const VARIANTS = {
    h1: 'text-5xl font-light tracking-tight',
    h2: 'text-4xl font-light tracking-tight',
    h3: 'text-3xl font-light tracking-tight',
    h4: 'text-2xl font-light',
    h5: 'text-xl font-light',
    h6: 'text-lg font-light',
    s1: 'text-lg',
    s2: 'text-base',
    b1: 'text-base',
    b2: 'text-sm',
    c1: 'text-xs text-fg-muted',
    d1: 'text-xs text-fg-muted',
    p1: 'text-2xl',
    l1: 'text-sm uppercase tracking-[0.2em]',
    l2: 'text-xs uppercase tracking-[0.2em]',
    superscript: 'text-[0.625rem] uppercase tracking-[0.2em] text-fg-muted align-super',
    textLink: 'underline underline-offset-4 hover:no-underline',
}

const DEFAULT_TAGS = {
    h1: 'h1',
    h2: 'h2',
    h3: 'h3',
    h4: 'h4',
    h5: 'h5',
    h6: 'h6',
    superscript: 'sup',
    textLink: 'a',
}

const FONT_WEIGHTS = {
    book: 'font-light',
    regular: 'font-normal',
    bold: 'font-bold',
}

export function Typography({
    variant = 'b1',
    component,
    isIndented,
    fontWeight,
    className,
    children,
    ...rest
}) {
    const Component = component ?? DEFAULT_TAGS[variant] ?? 'p'

    return (
        <Component
            className={cn(
                VARIANTS[variant],
                FONT_WEIGHTS[fontWeight],
                isIndented && 'pl-xs',
                className,
            )}
            {...rest}
        >
            {children}
        </Component>
    )
}
