# A failed read is not an empty list
Never render a fetch error as "no data".
**Why:** users read it as data loss (LED-12).
**How:** use `resolveLoadState({ loading, error, hasData })`; error beats empty, and with data on screen show a stale-error banner.
