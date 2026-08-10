import { cn } from './utils'

const WIDTHS = {
    full: 'max-w-full',
    '6col': 'max-w-6col',
    '8col': 'max-w-8col',
    '10col': 'max-w-10col',
    '12col': 'max-w-12col',
}

export function ContentBlockInnerContainer({
    width = '12col',
    className,
    children,
    ...rest
}) {
    return (
        <div className={cn('mx-auto w-full', WIDTHS[width], className)} {...rest}>
            {children}
        </div>
    )
}
