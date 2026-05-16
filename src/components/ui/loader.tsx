import { cn } from "@/lib/utils";

export function AppLoader({ className }: { className?: string }) {
  return (
    <div className={cn("flex items-center justify-center gap-1.5", className)}>
      <div className="h-2.5 w-2.5 animate-bounce rounded-full bg-primary [animation-delay:-0.3s]"></div>
      <div className="h-2.5 w-2.5 animate-bounce rounded-full bg-primary [animation-delay:-0.15s]"></div>
      <div className="h-2.5 w-2.5 animate-bounce rounded-full bg-primary"></div>
    </div>
  );
}
