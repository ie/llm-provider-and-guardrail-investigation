import { cn } from './utils'

// Container flow places the pointer on the named edge; the pointer itself is a
// rotated square tucked under the bubble.
const POSITIONS = {
    'top-left': ['flex-col-reverse items-start', '-mb-1.5'],
    'top-right': ['flex-col-reverse items-end', '-mb-1.5'],
    'top-middle': ['flex-col-reverse items-center', '-mb-1.5'],
    'bottom-left': ['flex-col items-start', '-mt-1.5'],
    'bottom-right': ['flex-col items-end', '-mt-1.5'],
    'bottom-middle': ['flex-col items-center', '-mt-1.5'],
    'middle-left': ['flex-row-reverse items-center self-end', '-mr-1.5'],
    'middle-top-left': ['flex-row-reverse items-start self-end', '-mr-1.5'],
    'middle-bottom-left': ['flex-row-reverse items-end self-end', '-mr-1.5'],
    'middle-right': ['flex-row items-center self-start', '-ml-1.5'],
    'middle-top-right': ['flex-row items-start self-start', '-ml-1.5'],
    'middle-bottom-right': ['flex-row items-end self-start', '-ml-1.5'],
}

export function TooltipPopup({
    pointerPosition = 'top-middle',
    ariaLabel,
    className,
    children,
    ...rest
}) {
    const [containerClass, pointerClass] = POSITIONS[pointerPosition]

    return (
        <div
            role="tooltip"
            aria-label={ariaLabel}
            className={cn('flex w-fit max-w-[80%]', containerClass, className)}
            {...rest}
        >
            <div className="rounded-lg bg-surface px-xs py-3xs text-sm text-fg">
                {children}
            </div>
            <div className={cn('size-3 rotate-45 bg-surface', pointerClass)} />
        </div>
    )
}
