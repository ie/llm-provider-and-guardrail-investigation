import { cn } from './utils'

const PADDINGS = {
    none: 'px-none py-none gap-none',
    less: 'px-xs py-s gap-s',
    default: 'px-s py-l gap-l',
    more: 'px-m py-2xl gap-2xl',
}

export function ContentBlock({
    component: Component = 'div',
    p = 'default',
    className,
    children,
    ...rest
}) {
    return (
        <Component className={cn('w-full max-w-full bg-canvas text-fg', className)} {...rest}>
            <div className={cn('flex w-full flex-col items-center', PADDINGS[p])}>
                {children}
            </div>
        </Component>
    )
}
