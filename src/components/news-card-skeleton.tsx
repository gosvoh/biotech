import { cn } from "@/lib/utils";
import { Skeleton } from "./ui/skeleton";

export default function NewsCardSkeleton({
  className,
  ...props
}: React.HTMLAttributes<HTMLDivElement>) {
  return (
    <div
      className={cn(
        "border border-border rounded-2.75xl p-10 space-y-6 w-full",
        className
      )}
      {...props}
    >
      <Skeleton className="w-full aspect-square md:aspect-video" />
      <div className="space-y-4">
        <Skeleton className="h-6 w-24" />
        <Skeleton className="h-12 w-full" />
      </div>
    </div>
  );
}
