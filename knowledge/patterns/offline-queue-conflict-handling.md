# Offline queue: conflicts and expiries
Pure queue logic lives in `src/lib/queueState.ts` so it is testable; `offlineQueue.ts` does the I/O. Flagged items sort first after a drain and pending order is preserved (LED-05).
**Known gaps:** update-only conflict detection, `drainQueue` write race, no retry failure state. See the LED-05 retro backlog.
