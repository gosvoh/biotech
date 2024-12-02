import { cn } from "@/lib/utils";

export default function Divider({ className }: { className?: string }) {
  return <hr className={cn("border-t border-brand3 opacity-10", className)} />;
}
