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
        "text-base md:text-xl",
        "border rounded-lg cursor-pointer transition-colors",
        "p-[10px] border-typo-secondary text-typo-secondary",
        active ? "text-black border-brand3" : "",
        "hover:border-brand3",
        className
      )}
      {...props}
    >
      #{children}
    </div>
  );
}
