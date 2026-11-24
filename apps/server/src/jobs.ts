// The server's jobs (docs/plan/02 section 1: Trash and history thinning now, backups later): a
// small scheduler that main.ts starts. Each job has its own name and timer and runs one run at a
// time, the first a minute after the start, then every `everyMs`; each run logs one line.
import { log } from './log.ts'

export interface Job {
  name: string
  everyMs: number
  // What the run did, for its log line.
  run: () => Record<string, unknown> | Promise<Record<string, unknown>>
}

// The first runs wait this long, so a starting server answers requests first.
const firstMs = 60 * 1000

const timers = new Map<string, NodeJS.Timeout>()

async function runJob(job: Job): Promise<void> {
  const started = Date.now()
  try {
    const result = await job.run()
    log.info({ job: job.name, ms: Date.now() - started, ...result }, 'job done')
  } catch (error) {
    log.error({ err: error, job: job.name, ms: Date.now() - started }, 'job failed')
  }
}

// The next run starts `delayMs` after the end of the last one, unless the jobs stopped meanwhile.
function schedule(job: Job, delayMs: number): void {
  const timer = setTimeout(() => {
    void runJob(job).then(() => {
      if (timers.get(job.name) === timer) {
        schedule(job, job.everyMs)
      }
    })
  }, delayMs)
  // A waiting job does not keep the process alive.
  timer.unref()
  timers.set(job.name, timer)
}

// One job per name: starting a name twice is a mistake in the code.
export function startJobs(jobs: Job[]): void {
  for (const job of jobs) {
    if (timers.has(job.name)) {
      throw new Error(`The job "${job.name}" is already started.`)
    }
    schedule(job, firstMs)
    log.info({ job: job.name, everyMs: job.everyMs }, 'job scheduled')
  }
}

// When the server closes; a run under way finishes, and no other starts.
export function stopJobs(): void {
  for (const timer of timers.values()) {
    clearTimeout(timer)
  }
  timers.clear()
}
