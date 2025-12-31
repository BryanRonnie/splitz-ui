import { cn } from '../lib/utils'

interface StepIndicatorProps {
  currentStep: 'upload' | 'review' | 'split'
  steps?: string[]
}

export function StepIndicator({ currentStep, steps = ['Upload', 'Review', 'Split'] }: StepIndicatorProps) {
  const stepOrder = ['upload', 'review', 'split']
  const currentIndex = stepOrder.indexOf(currentStep)
  
  return (
    <div className="flex items-center justify-center gap-2 sm:gap-4 py-6">
      {steps.map((step, idx) => {
        const isActive = idx === currentIndex
        const isCompleted = idx < currentIndex
        
        return (
          <div key={step} className="flex items-center">
            {/* Step circle */}
            <div className={cn(
              'flex h-10 w-10 items-center justify-center rounded-full font-semibold text-sm transition-all',
              isActive && 'bg-blue-600 text-white shadow-lg scale-110',
              isCompleted && 'bg-green-600 text-white',
              !isActive && !isCompleted && 'bg-gray-200 text-gray-600'
            )}>
              {isCompleted ? '✓' : idx + 1}
            </div>
            
            {/* Step label */}
            <div className="ml-3 hidden sm:block">
              <p className={cn(
                'text-sm font-medium transition-colors',
                isActive && 'text-blue-600',
                isCompleted && 'text-green-600',
                !isActive && !isCompleted && 'text-gray-600'
              )}>
                {step}
              </p>
            </div>
            
            {/* Connector line */}
            {idx < steps.length - 1 && (
              <div className={cn(
                'ml-2 hidden h-1 w-6 rounded-full sm:block transition-colors',
                idx < currentIndex ? 'bg-green-600' : 'bg-gray-300'
              )} />
            )}
          </div>
        )
      })}
    </div>
  )
}

export default StepIndicator
