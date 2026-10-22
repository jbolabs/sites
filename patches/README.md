The EmDash 1.1.0 patch renders appearance controls inside the existing account popover, exposes stable header hooks, and gives the phone menu toggle two hamburger bars; keep it until upstream offers equivalent header customization. The sidebar header owns its toggle and brand, the unused footer is removed, and the shell enables Kumo resizing.

After editing a patch, run `bun install`: it re-applies the patch and re-stamps `patches/` (`scripts/stamp-patches.ts`) so Vite rebuilds its dependency cache.
