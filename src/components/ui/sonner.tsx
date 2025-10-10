// Compatibility wrapper to avoid using the external "sonner" lib directly
// We delegate to our internal toast system (shadcn-style) and keep a similar API
import { Toaster as ShadToaster } from "./toaster";
import { toast as baseToast } from "@/hooks/use-toast";

// Minimal shim to support toast.success / toast.error calls used across the app
const toast: any = (opts: any) => baseToast(opts);
toast.success = (message: string) => baseToast({ title: message });
toast.error = (message: string) => baseToast({ title: "Error", description: message });
toast.info = (message: string) => baseToast({ title: message });

const Toaster = () => {
  return <ShadToaster />;
};

export { Toaster, toast };
