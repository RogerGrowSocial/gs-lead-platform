'use client'

import { cn } from '@/lib/utils'
import Button from './Button'

interface ErrorStateProps {
  title?: string
  message?: string
  onRetry?: () => void
  retryText?: string
  className?: string
  variant?: 'default' | 'minimal' | 'card'
}

export default function ErrorState({
  title = 'Something went wrong',
  message = 'An unexpected error occurred. Please try again.',
  onRetry,
  retryText = 'Try again',
  className,
  variant = 'default'
}: ErrorStateProps) {
  const icon = (
    <svg 
      className="h-12 w-12 text-red-500" 
      fill="none" 
      viewBox="0 0 24 24" 
      stroke="currentColor"
    >
      <path 
        strokeLinecap="round" 
        strokeLinejoin="round" 
        strokeWidth={2} 
        d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-2.5L13.732 4c-.77-.833-1.964-.833-2.732 0L3.732 16.5c-.77.833.192 2.5 1.732 2.5z" 
      />
    </svg>
  )

  const content = (
    <div className="text-center">
      <div className="flex justify-center mb-4">
        {icon}
      </div>
      <h3 className="text-lg font-medium text-gray-900 mb-2">
        {title}
      </h3>
      <p className="text-sm text-gray-600 mb-6 max-w-md mx-auto">
        {message}
      </p>
      {onRetry && (
        <Button onClick={onRetry} variant="primary">
          {retryText}
        </Button>
      )}
    </div>
  )

  if (variant === 'minimal') {
    return (
      <div className={cn('flex items-center justify-center p-4', className)}>
        <div className="flex items-center space-x-3">
          <svg 
            className="h-5 w-5 text-red-500" 
            fill="none" 
            viewBox="0 0 24 24" 
            stroke="currentColor"
          >
            <path 
              strokeLinecap="round" 
              strokeLinejoin="round" 
              strokeWidth={2} 
              d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" 
            />
          </svg>
          <span className="text-sm text-gray-600">{message}</span>
          {onRetry && (
            <Button onClick={onRetry} variant="ghost" size="sm">
              {retryText}
            </Button>
          )}
        </div>
      </div>
    )
  }

  if (variant === 'card') {
    return (
      <div className={cn('bg-white border border-gray-200 rounded-lg p-8', className)}>
        {content}
      </div>
    )
  }

  return (
    <div className={cn('flex items-center justify-center min-h-64', className)}>
      {content}
    </div>
  )
}

interface EmptyStateProps {
  title?: string
  message?: string
  action?: React.ReactNode
  className?: string
  variant?: 'default' | 'minimal' | 'card'
}

export function EmptyState({
  title = 'No data available',
  message = 'There are no items to display at the moment.',
  action,
  className,
  variant = 'default'
}: EmptyStateProps) {
  const icon = (
    <svg 
      className="h-12 w-12 text-gray-400" 
      fill="none" 
      viewBox="0 0 24 24" 
      stroke="currentColor"
    >
      <path 
        strokeLinecap="round" 
        strokeLinejoin="round" 
        strokeWidth={2} 
        d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" 
      />
    </svg>
  )

  const content = (
    <div className="text-center">
      <div className="flex justify-center mb-4">
        {icon}
      </div>
      <h3 className="text-lg font-medium text-gray-900 mb-2">
        {title}
      </h3>
      <p className="text-sm text-gray-600 mb-6 max-w-md mx-auto">
        {message}
      </p>
      {action}
    </div>
  )

  if (variant === 'minimal') {
    return (
      <div className={cn('flex items-center justify-center p-4', className)}>
        <div className="text-center">
          <p className="text-sm text-gray-500">{message}</p>
          {action && <div className="mt-2">{action}</div>}
        </div>
      </div>
    )
  }

  if (variant === 'card') {
    return (
      <div className={cn('bg-white border border-gray-200 rounded-lg p-8', className)}>
        {content}
      </div>
    )
  }

  return (
    <div className={cn('flex items-center justify-center min-h-64', className)}>
      {content}
    </div>
  )
}
