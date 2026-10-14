const result=await Bun.build({entrypoints:["./scripts/vk-worker.ts"],outdir:"./.next",naming:"vk-worker.js",target:"bun",external:["../src/lib/db/client"]});
if(!result.success){for(const log of result.logs)console.error(log);process.exitCode=1;}
export {};
