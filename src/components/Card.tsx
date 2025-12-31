import { ReactNode } from 'react'
import { cn } from '../lib/utils'

interface CardProps extends React.HTMLAttributes<HTMLDivElement> {
  children: ReactNode
  variant?: 'default' | 'highlighted' | 'subtle'
  hover?: boolean
}

export function Card({ 
  children, 
  variant = 'default',
  hover = true,
  className,
  ...props 
}: CardProps) {
  const variants = {
    default: 'bg-white border border-gray-100',
    highlighted: 'bg-gradient-to-br from-blue-50 to-blue-100 border border-blue-200',
    subtle: 'bg-gray-50 border border-gray-200'
  }
  
  return (
    <div
      className={cn(
        'rounded-xl p-6 shadow-sm transition-all',
        hover && 'hover:shadow-md hover:border-gray-200',
        variants[variant],
        className
      )}
      {...props}
    >
      {children}
    </div>
  )
}

export function CardHeader({ 
  children, 
  className,
  ...props 
}: React.HTMLAttributes<HTMLDivElement>) {
  return (
    <div className={cn('mb-4 pb-4 border-b border-gray-200', className)} {...props}>
      {children}
    </div>
  )
}

export function CardContent({ 
  children, 
  className,
  ...props 
}: React.HTMLAttributes<HTMLDivElement>) {
  return (
    <div className={cn('space-y-4', className)} {...props}>
      {children}
    </div>
  )
}

export function CardFooter({ 
  children, 
  className,
  ...props 
}: React.HTMLAttributes<HTMLDivElement>) {
  return (
    <div className={cn('flex gap-3 pt-4 border-t border-gray-200', className)} {...props}>
      {children}
    </div>
  )
}

export default Card
