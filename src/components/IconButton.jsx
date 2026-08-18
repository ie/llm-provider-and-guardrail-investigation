import { Button } from './Button'
import { cn } from './utils'

// Square, label-less Button. App names its variants default/subtle, which map onto
// Button's own set.
const VARIANTS = { default: 'secondary', subtle: 'tertiary' }

export function IconButton({ variant = 'default', title, className, ...rest }) {
  return (
    <Button
      variant={VARIANTS[variant] ?? variant}
      title={title}
      aria-label={title}
      className={cn('size-11 gap-0 p-0!', className)}
      {...rest}
    />
  )
}
