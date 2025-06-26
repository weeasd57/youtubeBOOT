/**
 * Reusable loading state components with accessibility and performance optimizations
 */

import React, { memo } from 'react';
import { Loader2, Upload, Download, RefreshCw, Zap } from 'lucide-react';

interface LoadingSpinnerProps {
  size?: 'sm' | 'md' | 'lg' | 'xl';
  color?: 'primary' | 'secondary' | 'success' | 'warning' | 'error';
  className?: string;
  'aria-label'?: string;
}

interface LoadingSkeletonProps {
  width?: string | number;
  height?: string | number;
  className?: string;
  rounded?: boolean;
}

interface LoadingButtonProps {
  isLoading: boolean;
  children: React.ReactNode;
  loadingText?: string;
  disabled?: boolean;
  className?: string;
  onClick?: () => void;
  type?: 'button' | 'submit' | 'reset';
}

interface LoadingOverlayProps {
  isVisible: boolean;
  message?: string;
  children?: React.ReactNode;
  className?: string;
}

interface ProgressBarProps {
  progress: number;
  showPercentage?: boolean;
  color?: 'primary' | 'secondary' | 'success' | 'warning' | 'error';
  className?: string;
  'aria-label'?: string;
}

// Size configurations
const sizeClasses = {
  sm: 'w-4 h-4',
  md: 'w-6 h-6',
  lg: 'w-8 h-8',
  xl: 'w-12 h-12'
};

// Color configurations
const colorClasses = {
  primary: 'text-blue-600 dark:text-blue-400',
  secondary: 'text-gray-600 dark:text-gray-400',
  success: 'text-green-600 dark:text-green-400',
  warning: 'text-yellow-600 dark:text-yellow-400',
  error: 'text-red-600 dark:text-red-400'
};

// Basic loading spinner
export const LoadingSpinner = memo<LoadingSpinnerProps>(({
  size = 'md',
  color = 'primary',
  className = '',
  'aria-label': ariaLabel = 'Loading'
}) => (
  <div
    className={`inline-flex items-center justify-center ${className}`}
    role="status"
    aria-label={ariaLabel}
  >
    <Loader2 
      className={`animate-spin ${sizeClasses[size]} ${colorClasses[color]}`}
      aria-hidden="true"
    />
    <span className="sr-only">{ariaLabel}</span>
  </div>
));

LoadingSpinner.displayName = 'LoadingSpinner';

// Skeleton loader for content placeholders
export const LoadingSkeleton = memo<LoadingSkeletonProps>(({
  width = '100%',
  height = '1rem',
  className = '',
  rounded = false
}) => (
  <div
    className={`animate-pulse bg-gray-200 dark:bg-gray-700 ${
      rounded ? 'rounded-full' : 'rounded'
    } ${className}`}
    style={{ width, height }}
    aria-hidden="true"
  />
));

LoadingSkeleton.displayName = 'LoadingSkeleton';

// Loading button with spinner
export const LoadingButton = memo<LoadingButtonProps>(({
  isLoading,
  children,
  loadingText = 'Loading...',
  disabled = false,
  className = '',
  onClick,
  type = 'button'
}) => (
  <button
    type={type}
    onClick={onClick}
    disabled={disabled || isLoading}
    className={`inline-flex items-center justify-center gap-2 transition-all duration-200 ${
      isLoading || disabled 
        ? 'opacity-50 cursor-not-allowed' 
        : 'hover:opacity-90'
    } ${className}`}
    aria-disabled={disabled || isLoading}
  >
    {isLoading && (
      <LoadingSpinner 
        size="sm" 
        aria-label="Processing request"
      />
    )}
    {isLoading ? loadingText : children}
  </button>
));

LoadingButton.displayName = 'LoadingButton';

// Full-screen loading overlay
export const LoadingOverlay = memo<LoadingOverlayProps>(({
  isVisible,
  message = 'Loading...',
  children,
  className = ''
}) => {
  if (!isVisible) return null;

  return (
    <div
      className={`fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm ${className}`}
      role="dialog"
      aria-modal="true"
      aria-label="Loading"
    >
      <div className="bg-white dark:bg-gray-800 rounded-lg p-6 shadow-xl max-w-sm w-full mx-4">
        <div className="flex flex-col items-center space-y-4">
          <LoadingSpinner size="lg" />
          <p className="text-gray-700 dark:text-gray-300 text-center font-medium">
            {message}
          </p>
          {children}
        </div>
      </div>
    </div>
  );
});

LoadingOverlay.displayName = 'LoadingOverlay';

// Progress bar component
export const ProgressBar = memo<ProgressBarProps>(({
  progress,
  showPercentage = true,
  color = 'primary',
  className = '',
  'aria-label': ariaLabel = 'Progress'
}) => {
  const clampedProgress = Math.max(0, Math.min(100, progress));
  
  const progressColorClasses = {
    primary: 'bg-blue-600',
    secondary: 'bg-gray-600',
    success: 'bg-green-600',
    warning: 'bg-yellow-600',
    error: 'bg-red-600'
  };

  return (
    <div className={`w-full ${className}`}>
      <div className="flex justify-between items-center mb-1">
        <span className="text-sm font-medium text-gray-700 dark:text-gray-300">
          {ariaLabel}
        </span>
        {showPercentage && (
          <span className="text-sm font-medium text-gray-700 dark:text-gray-300">
            {Math.round(clampedProgress)}%
          </span>
        )}
      </div>
      <div 
        className="w-full bg-gray-200 dark:bg-gray-700 rounded-full h-2"
        role="progressbar"
        aria-valuenow={clampedProgress}
        aria-valuemin={0}
        aria-valuemax={100}
        aria-label={`${ariaLabel}: ${Math.round(clampedProgress)}% complete`}
      >
        <div
          className={`h-2 rounded-full transition-all duration-300 ease-out ${progressColorClasses[color]}`}
          style={{ width: `${clampedProgress}%` }}
        />
      </div>
    </div>
  );
});

ProgressBar.displayName = 'ProgressBar';

// Specialized loading states for different operations
export const UploadingState = memo<{ progress?: number; fileName?: string }>(({
  progress,
  fileName
}) => (
  <div className="flex items-center space-x-3 p-4 bg-blue-50 dark:bg-blue-900/20 rounded-lg">
    <Upload className="w-5 h-5 text-blue-600 dark:text-blue-400 animate-pulse" />
    <div className="flex-1">
      <p className="text-sm font-medium text-blue-900 dark:text-blue-100">
        Uploading {fileName ? `"${fileName}"` : 'file'}...
      </p>
      {typeof progress === 'number' && (
        <ProgressBar 
          progress={progress} 
          color="primary" 
          className="mt-2"
          aria-label="Upload progress"
        />
      )}
    </div>
  </div>
));

UploadingState.displayName = 'UploadingState';

export const DownloadingState = memo<{ progress?: number; fileName?: string }>(({
  progress,
  fileName
}) => (
  <div className="flex items-center space-x-3 p-4 bg-green-50 dark:bg-green-900/20 rounded-lg">
    <Download className="w-5 h-5 text-green-600 dark:text-green-400 animate-pulse" />
    <div className="flex-1">
      <p className="text-sm font-medium text-green-900 dark:text-green-100">
        Downloading {fileName ? `"${fileName}"` : 'file'}...
      </p>
      {typeof progress === 'number' && (
        <ProgressBar 
          progress={progress} 
          color="success" 
          className="mt-2"
          aria-label="Download progress"
        />
      )}
    </div>
  </div>
));

DownloadingState.displayName = 'DownloadingState';

export const ProcessingState = memo<{ message?: string }>(({
  message = 'Processing...'
}) => (
  <div className="flex items-center space-x-3 p-4 bg-yellow-50 dark:bg-yellow-900/20 rounded-lg">
    <Zap className="w-5 h-5 text-yellow-600 dark:text-yellow-400 animate-pulse" />
    <p className="text-sm font-medium text-yellow-900 dark:text-yellow-100">
      {message}
    </p>
  </div>
));

ProcessingState.displayName = 'ProcessingState';

export const RefreshingState = memo<{ message?: string }>(({
  message = 'Refreshing data...'
}) => (
  <div className="flex items-center space-x-3 p-4 bg-gray-50 dark:bg-gray-800 rounded-lg">
    <RefreshCw className="w-5 h-5 text-gray-600 dark:text-gray-400 animate-spin" />
    <p className="text-sm font-medium text-gray-900 dark:text-gray-100">
      {message}
    </p>
  </div>
));

RefreshingState.displayName = 'RefreshingState';

// Card skeleton for loading lists
export const CardSkeleton = memo(() => (
  <div className="p-4 border border-gray-200 dark:border-gray-700 rounded-lg space-y-3">
    <LoadingSkeleton height="1.5rem" width="60%" />
    <LoadingSkeleton height="1rem" width="100%" />
    <LoadingSkeleton height="1rem" width="80%" />
    <div className="flex space-x-2">
      <LoadingSkeleton height="2rem" width="4rem" rounded />
      <LoadingSkeleton height="2rem" width="4rem" rounded />
    </div>
  </div>
));

CardSkeleton.displayName = 'CardSkeleton';

// Table skeleton for loading tables
export const TableSkeleton = memo<{ rows?: number; columns?: number }>(({
  rows = 5,
  columns = 4
}) => (
  <div className="space-y-3">
    {/* Header */}
    <div className="flex space-x-4">
      {Array.from({ length: columns }).map((_, i) => (
        <LoadingSkeleton key={i} height="1.5rem" width="25%" />
      ))}
    </div>
    {/* Rows */}
    {Array.from({ length: rows }).map((_, rowIndex) => (
      <div key={rowIndex} className="flex space-x-4">
        {Array.from({ length: columns }).map((_, colIndex) => (
          <LoadingSkeleton key={colIndex} height="1rem" width="25%" />
        ))}
      </div>
    ))}
  </div>
));

TableSkeleton.displayName = 'TableSkeleton';

export default {
  LoadingSpinner,
  LoadingSkeleton,
  LoadingButton,
  LoadingOverlay,
  ProgressBar,
  UploadingState,
  DownloadingState,
  ProcessingState,
  RefreshingState,
  CardSkeleton,
  TableSkeleton
};