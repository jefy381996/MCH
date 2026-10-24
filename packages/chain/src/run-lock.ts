import { closeSync, openSync, readFileSync, unlinkSync, writeSync } from 'node:fs';

export type RunLock = { ok: true; release(): void } | { ok: false; pid: number };

/** Is a process with this id still running? (Signal 0 only checks; it works on Windows too.) */
function alive(pid: number): boolean {
  try {
    process.kill(pid, 0);
    return true;
  } catch (err) {
    // EPERM: it exists but belongs to someone else.
    return (err as NodeJS.ErrnoException).code === 'EPERM';
  }
}

/**
 * One deploy run at a time per record file. A second window started while
 * the first is still open (even one that has sat at the CREATE prompt for
 * hours) is refused, so two runs can never each make a coin. The lock file
 * holds the owner's process id; a lock left behind by a run that has ended
 * (a crash, a closed window) is taken over. Never judged by age.
 */
export function acquireRunLock(path: string, pid = process.pid): RunLock {
  for (let attempt = 0; attempt < 2; attempt++) {
    try {
      const fd = openSync(path, 'wx');
      writeSync(fd, String(pid));
      closeSync(fd);
      return {
        ok: true,
        release() {
          try {
            if (readFileSync(path, 'utf8').trim() === String(pid)) unlinkSync(path);
          } catch {
            // already gone
          }
        },
      };
    } catch (err) {
      if ((err as NodeJS.ErrnoException).code !== 'EEXIST') throw err;
      const owner = Number.parseInt(readFileSync(path, 'utf8'), 10);
      if (Number.isInteger(owner) && owner !== pid && alive(owner))
        return { ok: false, pid: owner };
      unlinkSync(path); // left by a run that has ended
    }
  }
  throw new Error(`could not take the lock ${path}`);
}
