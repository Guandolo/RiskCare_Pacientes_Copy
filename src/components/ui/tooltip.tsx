import * as React from "react";
import { cn } from "@/lib/utils";

// Lightweight, no-dependency Tooltip shims to avoid React instance conflicts
// API-compatible with our usage: Tooltip, TooltipTrigger, TooltipContent, TooltipProvider

type TooltipRootProps = React.HTMLAttributes<HTMLDivElement> & {
  open?: boolean;
  defaultOpen?: boolean;
};

const Tooltip: React.FC<React.PropsWithChildren<TooltipRootProps>> = ({ children }) => (
  <>{children}</>
);

const TooltipProvider: React.FC<React.PropsWithChildren<{ delayDuration?: number }>> = ({ children }) => (
  <>{children}</>
);

// Accept common Radix-like props for compatibility
type TooltipContentProps = React.HTMLAttributes<HTMLDivElement> & {
  side?: "top" | "bottom" | "left" | "right";
  sideOffset?: number;
  align?: "start" | "center" | "end";
  alignOffset?: number;
};

const TooltipTrigger = React.forwardRef<HTMLButtonElement, React.ButtonHTMLAttributes<HTMLButtonElement> & { asChild?: boolean }>(
  ({ className, children, asChild, ...props }, ref) => {
    if (asChild && React.isValidElement(children)) {
      return React.cloneElement(children as any, { ref, ...props });
    }
    return (
      <button ref={ref} className={cn(className)} {...props}>
        {children}
      </button>
    );
  },
);
TooltipTrigger.displayName = "TooltipTrigger";

const TooltipContent = React.forwardRef<HTMLDivElement, TooltipContentProps>(
  ({ className, children, ...props }, ref) => {
    // No-op visual content to avoid crashes; could be enhanced later
    return (
      <div ref={ref} className={cn("hidden", className)} role="tooltip" {...props}>
        {children}
      </div>
    );
  },
);
TooltipContent.displayName = "TooltipContent";

export { Tooltip, TooltipTrigger, TooltipContent, TooltipProvider };
