'use client';

import * as React from 'react';

// Create general Tabs context
const TabsContext = React.createContext({
  value: undefined,
  onChange: () => {},
});

const Tabs = React.forwardRef(({ className, defaultValue, value: controlledValue, onValueChange, children, ...props }, ref) => {
  const [uncontrolledValue, setUncontrolledValue] = React.useState(defaultValue);
  
  // Use controlled value if provided, otherwise use internal value
  const value = controlledValue !== undefined ? controlledValue : uncontrolledValue;
  
  // When value changes, update the uncontrolled state and call onValueChange if provided
  const onChange = React.useCallback(
    (newValue) => {
      if (controlledValue === undefined) {
        setUncontrolledValue(newValue);
      }
      
      if (onValueChange) {
        onValueChange(newValue);
      }
    },
    [controlledValue, onValueChange]
  );
  
  return (
    <TabsContext.Provider value={{ value, onChange }}>
      <div ref={ref} className={`${className || ''}`} {...props}>
        {children}
      </div>
    </TabsContext.Provider>
  );
});
Tabs.displayName = 'Tabs';

const TabsList = React.forwardRef(({ className, ...props }, ref) => (
  <div
    ref={ref}
    className={`inline-flex h-10 items-center justify-center rounded-md bg-gray-100 p-1 text-gray-500 dark:bg-gray-800 dark:text-gray-400 ${className || ''}`}
    {...props}
  />
));
TabsList.displayName = 'TabsList';

const TabsTrigger = React.forwardRef(({ className, value, ...props }, ref) => {
  const context = React.useContext(TabsContext);
  const active = context.value === value;
  
  return (
  <button
    ref={ref}
    className={`inline-flex items-center justify-center whitespace-nowrap rounded-sm px-3 py-1.5 text-sm font-medium ring-offset-white transition-all focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-gray-950 focus-visible:ring-offset-2 disabled:pointer-events-none disabled:opacity-50 dark:ring-offset-gray-950 dark:focus-visible:ring-gray-300 ${active ? 'bg-white text-gray-950 shadow-sm dark:bg-gray-950 dark:text-gray-50' : 'text-gray-500 hover:text-gray-900 dark:text-gray-400 dark:hover:text-gray-50'} ${className || ''}`}
      onClick={() => context.onChange(value)}
    {...props}
  />
  );
});
TabsTrigger.displayName = 'TabsTrigger';

const TabsContent = React.forwardRef(({ className, value, ...props }, ref) => {
  const context = React.useContext(TabsContext);
  const active = context.value === value;
  
  if (!active) return null;
  
  return (
  <div
    ref={ref}
    role="tabpanel"
      className={`mt-2 ring-offset-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-gray-950 focus-visible:ring-offset-2 dark:ring-offset-gray-950 dark:focus-visible:ring-gray-300 ${className || ''}`}
    {...props}
  />
  );
});
TabsContent.displayName = 'TabsContent';

export { Tabs, TabsList, TabsTrigger, TabsContent }; 