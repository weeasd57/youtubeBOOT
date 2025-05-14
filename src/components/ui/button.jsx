'use client';

import * as React from 'react';

const Button = React.forwardRef(
  ({ className, variant = 'default', size = 'default', asChild = false, ...props }, ref) => {
    const Comp = asChild ? React.Fragment : 'button';
    
    const variantStyles = {
      default: 'bg-gray-900 text-gray-50 hover:bg-gray-800 dark:bg-gray-50 dark:text-gray-900 dark:hover:bg-gray-200',
      destructive: 'bg-red-500 text-gray-50 hover:bg-red-600 dark:bg-red-600 dark:hover:bg-red-700',
      outline: 'border border-gray-300 bg-transparent hover:bg-gray-100 dark:border-gray-700 dark:hover:bg-gray-800',
      secondary: 'bg-gray-100 text-gray-900 hover:bg-gray-200 dark:bg-gray-700 dark:text-gray-50 dark:hover:bg-gray-600',
      ghost: 'bg-transparent hover:bg-gray-100 dark:hover:bg-gray-800',
      link: 'bg-transparent text-gray-900 underline-offset-4 hover:underline dark:text-gray-50',
    };
    
    const sizeStyles = {
      default: 'h-10 px-4 py-2',
      sm: 'h-9 px-3 rounded-md',
      lg: 'h-11 px-8 rounded-md',
      icon: 'h-10 w-10',
    };

    return (
      <Comp
        className={`inline-flex items-center justify-center rounded-md text-sm font-medium ring-offset-white transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-gray-950 focus-visible:ring-offset-2 disabled:pointer-events-none disabled:opacity-50 dark:ring-offset-gray-950 dark:focus-visible:ring-gray-300 ${variantStyles[variant]} ${sizeStyles[size]} ${className || ''}`}
        ref={ref}
        {...props}
      />
    );
  }
);

Button.displayName = 'Button';

export { Button }; 