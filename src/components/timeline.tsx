import { cn } from "@/lib/utils";

export default function Timeline({
  steps,
}: {
  steps: { date: string; text: string }[];
}) {
  return (
    <div className="relative pt-4">
      <div
        className={cn(
          "absolute -left-1 top-0 bottom-0 w-10 bg-gradient-to-b from-background via-transparent to-background z-[1]",
          "xl:left-1/2 xl:-translate-x-1/2"
        )}
      />
      <div
        className={cn(
          "absolute left-0 top-0 bottom-0 w-2 rounded-full bg-accent",
          "xl:left-1/2 xl:-translate-x-1/2"
        )}
      />
      <div className="max-xl:space-y-6">
        {steps.map(({ date, text }, i) => (
          <div
            key={`timeline-step-${i}`}
            className={cn(
              "max-xl:ml-[58px]",
              "flex flex-col gap-2 md:gap-4 relative xl:max-w-[calc(50%-29px)]",
              "before:content-[''] before:absolute before:top-0 before:-left-[58px]",
              "before:w-[36px] before:h-[36px] before:rounded-full before:bg-accent",
              "before:-z-[1] before:-translate-x-1/4",
              "after:content-[''] after:absolute after:top-0 after:-left-[58px]",
              "after:w-[18px] after:h-[36px] after:bg-background after:-z-[1] after:-translate-x-[60%]",
              "md:before:top-6 md:after:top-6",
              i % 2 === 0
                ? cn(
                    "xl:text-right xl:mr-auto xl:before:left-auto xl:after:left-auto",
                    "xl:before:-right-[54px] xl:after:-right-[56px] xl:pr-4"
                  )
                : cn(
                    "xl:text-left xl:ml-auto xl:before:-left-[36px] xl:after:-left-[36px] xl:pl-4"
                  )
            )}
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
