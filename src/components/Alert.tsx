import { ReactNode } from 'react'
import { cn } from '../lib/utils'

interface AlertProps {
  variant?: 'success' | 'error' | 'warning' | 'info'
  title?: string
  children: ReactNode
  className?: string
  icon?: ReactNode
}

export function Alert({ 
  variant = 'info',
  title,
  children,
  className,
  icon
}: AlertProps) {
  const variants = {
    success: {
      bg: 'bg-green-50',
      border: 'border-green-200',
      icon: '✓',
      text: 'text-green-800'
    },
    error: {
      bg: 'bg-red-50',
      border: 'border-red-200',
      icon: '⚠',
      text: 'text-red-800'
    },
    warning: {
      bg: 'bg-yellow-50',
      border: 'border-yellow-200',
      icon: '⚠',
      text: 'text-yellow-800'
    },
    info: {
      bg: 'bg-blue-50',
      border: 'border-blue-200',
      icon: 'ℹ',
      text: 'text-blue-800'
    }
  }
  
  const v = variants[variant]
  
  return (
    <div className={cn(
      'rounded-lg border p-4 flex gap-3',
      v.bg,
      v.border,
      className
    )}>
      <div className={cn('flex-shrink-0 mt-0.5 font-bold text-lg', v.text)}>
        {icon || v.icon}
      </div>
      <div className={cn('flex-1', v.text)}>
        {title && <h3 className="font-semibold mb-1">{title}</h3>}
        {typeof children === 'string' ? <p className="text-sm">{children}</p> : children}
      </div>
    </div>
  )
}

export default Alert
