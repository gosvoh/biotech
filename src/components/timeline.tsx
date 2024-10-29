import { cn } from "@/lib/utils";

export default function Timeline({
  steps,
}: {
  steps: { date: string; text: string }[];
}) {
  return (
    <div className="relative pt-4">
      <div className="absolute left-0 top-0 bottom-0 w-10 bg-gradient-to-b from-background via-transparent to-background z-[1]" />
      <div
        className={cn(
          "absolute left-0 top-0 bottom-0 w-2 rounded-full",
          "bg-accent"
        )}
      />
      <div className="ml-[58px] space-y-6">
        {steps.map(({ date, text }, i) => (
          <div
            key={`timeline-step-${i}`}
            className="flex flex-col gap-2 relative half-circle"
          >
            <p className="text-typo-secondary font-bold text-3xl md:text-5xl">
              {date} <span className="text-2xl md:text-3xl">год</span>
            </p>
            <p className="text-sm md:text-xl">{text}</p>
          </div>
        ))}
      </div>
    </div>
  );
}
