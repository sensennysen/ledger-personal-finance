# Do not cap the data before a view that ranks it
`groupExpensesByCategory` defaults to `limit = 8` for the old Home pie. When Home learned to rank above 12 categories (`rollupBreakdown`), the ranked view could never trigger, and no test noticed, because the unit tests fed the roll-up directly (LED-149).
**Why:** a limit at the data layer decides what the view can show. A component that groups a tail into "Other" needs the tail.
**How:**
- Give a view that ranks or rolls up the full list, and let it cut.
- After changing what a view accepts, look at where its input is built, not only at the view. The live check with 30 categories found this.
- Uncapping widens other consumers of the same list: Home's details dialog now lists every category, not eight.
