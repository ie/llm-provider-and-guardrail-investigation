import { cn } from './utils'

export function FormSection({ className, children, ...rest }) {
    return (
        <div className={cn('rounded-3xl bg-surface p-s', className)} {...rest}>
            {children}
        </div>
    )
}
