'use client';

// Simple toast helper that doesn't do anything
class ToastHelper {
  constructor() {
    this.initialized = true;
  }

  // All methods are no-op functions
  initialize() {
    return null;
  }

  success() {
    return null;
  }

  error() {
    return null;
  }

  warning() {
    return null;
  }

  info() {
    return null;
  }
}

// Singleton instance
export const toastHelper = new ToastHelper();

// Component to initialize the toast helper
export function ToastInitializer() {
  return null;
} 