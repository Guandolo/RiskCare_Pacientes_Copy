import * as React from "react";

// Minimal shim to avoid multiple-React hook issues from @radix-ui/react-tooltip
// Provides API-compatible exports used in our app and third-party components.

export const Provider: React.FC<React.PropsWithChildren<{ delayDuration?: number }>> = ({ children }) => (
  <>{children}</>
);

export const Root: React.FC<React.PropsWithChildren<{ open?: boolean; defaultOpen?: boolean }>> = ({ children }) => (
  <>{children}</>
);

export const Trigger = React.forwardRef<HTMLButtonElement, React.ButtonHTMLAttributes<HTMLButtonElement> & { asChild?: boolean }>(
  ({ asChild, children, ...props }, ref) => {
    if (asChild && React.isValidElement(children)) {
      return React.cloneElement(children as any, { ref, ...props });
    }
    return (
      <button ref={ref} {...props}>
        {children}
      </button>
    );
  },
);
Trigger.displayName = "TooltipTrigger";

export const Content = React.forwardRef<HTMLDivElement, React.HTMLAttributes<HTMLDivElement> & { side?: any; align?: any; sideOffset?: number; alignOffset?: number }>(
  ({ children, ...props }, ref) => (
    <div ref={ref} hidden role="tooltip" {...props}>
      {children}
    </div>
  ),
);
Content.displayName = "TooltipContent";

// Named aliases used by shadcn patterns
export const TooltipProvider = Provider;
export const Tooltip = Root;
export const TooltipTrigger = Trigger;
export const TooltipContent = Content;

export default {
  Provider,
  Root,
  Trigger,
  Content,
  TooltipProvider,
  Tooltip,
  TooltipTrigger,
  TooltipContent,
};