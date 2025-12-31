import { cn } from '../lib/utils'
import { ReactNode } from 'react'

interface HeaderProps {
  title: string
  subtitle?: string
  icon?: ReactNode
}

export function Header({ title, subtitle, icon }: HeaderProps) {
  return (
    <div className="border-b border-gray-200 bg-gradient-to-r from-blue-50 to-indigo-50 py-8 sm:py-12">
      <div className="mx-auto max-w-6xl px-4 sm:px-6">
        <div className="flex items-start gap-4">
          {icon && (
            <div className="flex-shrink-0 rounded-lg bg-blue-600 p-3 text-white text-2xl">
              {icon}
            </div>
          )}
          <div className="flex-1">
            <h1 className="text-3xl sm:text-4xl font-bold text-gray-900 tracking-tight">
              {title}
            </h1>
            {subtitle && (
              <p className="mt-2 text-lg text-gray-600">
                {subtitle}
              </p>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}

export default Header
