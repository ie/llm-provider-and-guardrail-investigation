import { cn } from './utils'
import { lightTheme } from './theme'

export function GlobalStylesScope({
    themeDefinition = lightTheme,
    className,
    children,
    ...rest
}) {
    return (
        <div
            data-theme={themeDefinition.name}
            className={cn('min-h-screen bg-canvas text-fg antialiased', className)}
            {...rest}
        >
            {children}
        </div>
    )
}
