import { cn } from "@/lib/utils";

export default function Tag({
  className,
  children,
  active,
  ...props
}: React.HTMLAttributes<HTMLDivElement> & {
  active?: boolean;
}) {
  return (
    <div
      className={cn(
        "text-base md:text-lg xl:text-xl",
        "border rounded-lg cursor-pointer transition-colors",
        "p-[10px] border-day-base-static-bg-stroke-60 text-day-base-static-bg-stroke-60",
        active ? "text-black border-accent" : "",
        "hover:border-accent",
        className
      )}
      {...props}
    >
      #{children}
    </div>
  );
}
