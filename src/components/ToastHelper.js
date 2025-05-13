'use client';

import { useToast } from '@/components/ui/toast';
import { useEffect } from 'react';

// Simple toast helper that doesn't require hooks
let toastHelperInstance = null;

class ToastHelper {
  constructor() {
    this.addToast = null;
    this.initialized = false;
  }

  initialize(addToastFunction) {
    this.addToast = addToastFunction;
    this.initialized = true;
  }

  success(message, duration = 5000) {
    if (!this.initialized) {
      console.warn('Toast not initialized. Falling back to alert');
      alert(message);
      return;
    }
    return this.addToast(message, 'success', duration);
  }

  error(message, duration = 5000) {
    if (!this.initialized) {
      console.warn('Toast not initialized. Falling back to alert');
      alert(message);
      return;
    }
    return this.addToast(message, 'error', duration);
  }

  warning(message, duration = 5000) {
    if (!this.initialized) {
      console.warn('Toast not initialized. Falling back to alert');
      alert(message);
      return;
    }
    return this.addToast(message, 'warning', duration);
  }

  info(message, duration = 5000) {
    if (!this.initialized) {
      console.warn('Toast not initialized. Falling back to alert');
      alert(message);
      return;
    }
    return this.addToast(message, 'info', duration);
  }
}

// Singleton instance
export const toastHelper = toastHelperInstance || new ToastHelper();

// Component to initialize the toast helper
export function ToastInitializer() {
  const { addToast } = useToast();
  
  // Use useEffect to initialize the toast helper after the component has mounted
  useEffect(() => {
    if (!toastHelper.initialized && addToast) {
      toastHelper.initialize(addToast);
    }
  }, [addToast]);
  
  return null;
} 