'use client';

import * as React from 'react';
import * as TooltipPrimitive from '@radix-ui/react-tooltip';

const TooltipProvider = TooltipPrimitive.Provider;
const Tooltip = TooltipPrimitive.Root;
const TooltipTrigger = TooltipPrimitive.Trigger;

const TooltipContent = React.forwardRef(({ 
  className, 
  sideOffset = 4, 
  side = 'top', 
  align = 'center',
  ...props 
}, ref) => (
  <TooltipPrimitive.Content
    ref={ref}
    sideOffset={sideOffset}
    side={side}
    align={align}
    className={`
      z-50 
      overflow-hidden 
      rounded-md 
      bg-black 
      px-3 
      py-1.5 
      text-xs 
      text-white 
      animate-in 
      fade-in-0 
      zoom-in-95 
      data-[state=closed]:animate-out 
      data-[state=closed]:fade-out-0 
      data-[state=closed]:zoom-out-95 
      ${className || ''}
    `}
    {...props}
  />
));
TooltipContent.displayName = "TooltipContent";

export { Tooltip, TooltipTrigger, TooltipContent, TooltipProvider }; 