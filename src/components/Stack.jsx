import { cn } from './utils'

const DIRECTIONS = {
    row: 'flex-row',
    'row-reverse': 'flex-row-reverse',
    column: 'flex-col',
    'column-reverse': 'flex-col-reverse',
}

const FLEX_WRAPS = {
    nowrap: 'flex-nowrap',
    wrap: 'flex-wrap',
    'wrap-reverse': 'flex-wrap-reverse',
}

const ALIGN_ITEMS = {
    stretch: 'items-stretch',
    'flex-start': 'items-start',
    center: 'items-center',
    'flex-end': 'items-end',
    baseline: 'items-baseline',
}

const JUSTIFY_CONTENT = {
    'flex-start': 'justify-start',
    center: 'justify-center',
    'flex-end': 'justify-end',
    'space-between': 'justify-between',
    'space-around': 'justify-around',
    'space-evenly': 'justify-evenly',
}

export function Stack({
    component: Component = 'div',
    direction = 'row',
    spacing = 'default',
    flexWrap,
    alignItems,
    justifyContent,
    className,
    children,
    ...rest
}) {
    return (
        <Component
            className={cn(
                'flex',
                DIRECTIONS[direction],
                `gap-${spacing}`,
                FLEX_WRAPS[flexWrap],
                ALIGN_ITEMS[alignItems],
                JUSTIFY_CONTENT[justifyContent],
                className,
            )}
            {...rest}
        >
            {children}
        </Component>
    )
}
