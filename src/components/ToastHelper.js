'use client';

import { useToast } from '@/components/ui/toast';
import { useEffect } from 'react';

// Simple toast helper that doesn't require hooks
let toastHelperInstance = null;

class ToastHelper {
  constructor() {
    this.addToast = null;
    this.initialized = true; // Always consider initialized
  }

  initialize(addToastFunction) {
    // Do nothing
    this.initialized = true;
  }

  success(message, duration = 5000) {
    // No-op function
    return null;
  }

  error(message, duration = 5000) {
    // No-op function
    return null;
  }

  warning(message, duration = 5000) {
    // No-op function
    return null;
  }

  info(message, duration = 5000) {
    // No-op function
    return null;
  }
}

// Singleton instance
export const toastHelper = toastHelperInstance || new ToastHelper();

// Component to initialize the toast helper
export function ToastInitializer() {
  // No need to do anything anymore
  return null;
} 