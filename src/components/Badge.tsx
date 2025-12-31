import type { ReactNode } from 'react'
import { cn } from '../lib/utils'

interface BadgeProps {
  variant?: 'default' | 'success' | 'warning' | 'error' | 'info'
  children: ReactNode
  className?: string
}

export function Badge({ 
  variant = 'default',
  children,
  className
}: BadgeProps) {
  const variants = {
    default: 'bg-gray-200 text-gray-800',
    success: 'bg-green-100 text-green-800',
    warning: 'bg-yellow-100 text-yellow-800',
    error: 'bg-red-100 text-red-800',
    info: 'bg-blue-100 text-blue-800'
  }
  
  return (
    <span className={cn(
      'inline-flex items-center rounded-full px-3 py-1 text-sm font-medium',
      variants[variant],
      className
    )}>
      {children}
    </span>
  )
}

export default Badge
