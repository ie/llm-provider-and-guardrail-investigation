import { forwardRef, useId } from 'react'

import { cn } from './utils'

export const Select = forwardRef(function Select(
    {
        label,
        options = [],
        placeholder,
        disabled,
        errorMessage,
        description,
        className,
        ...rest
    },
    ref,
) {
    const id = useId()
    const hasError = !!errorMessage

    return (
        <div
            className={cn(
                'flex w-full min-w-40 flex-col gap-4xs',
                disabled && 'pointer-events-none opacity-50',
                className,
            )}
        >
            {label && (
                <label
                    htmlFor={id}
                    className="text-xs uppercase tracking-[0.2em] text-fg-muted"
                >
                    {label}
                </label>
            )}
            <div
                className={cn(
                    'relative border-b',
                    hasError ? 'border-danger' : 'border-line focus-within:border-fg',
                )}
            >
                <select
                    id={id}
                    ref={ref}
                    disabled={disabled}
                    aria-invalid={hasError || undefined}
                    aria-describedby={hasError ? `${id}-error` : undefined}
                    className="w-full cursor-pointer appearance-none bg-transparent py-3xs pr-s text-sm text-fg outline-none"
                    {...rest}
                >
                    {placeholder && (
                        <option value="" hidden>
                            {placeholder}
                        </option>
                    )}
                    {options.map((option) => (
                        <option
                            key={option.value}
                            value={option.value}
                            disabled={option.disabled}
                            className="bg-surface text-fg"
                        >
                            {option.label}
                        </option>
                    ))}
                </select>
                <svg
                    aria-hidden="true"
                    viewBox="0 0 16 16"
                    className="pointer-events-none absolute right-0 top-1/2 size-4 -translate-y-1/2 fill-current"
                >
                    <path d="M2 5l6 6 6-6z" />
                </svg>
            </div>
            {description && !hasError && (
                <p className="text-xs text-fg-muted">{description}</p>
            )}
            {hasError && (
                <p id={`${id}-error`} className="text-xs text-danger">
                    {errorMessage}
                </p>
            )}
        </div>
    )
})
