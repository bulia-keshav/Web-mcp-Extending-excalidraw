# Working agreement

1. Read `excalidraw-webmcp-plan.md` before making changes. It is the spec.
2. Build one phase at a time. Do not merge phases.
3. Flag any deviation from the plan before coding it.
4. Before using any `@excalidraw/excalidraw` or `mermaid-to-excalidraw` API,
   verify it against the installed package's own type declarations in
   `node_modules/@excalidraw/excalidraw/dist/types/` — the published docs lag
   behind the package and several parameters have been renamed
   (e.g. `commitToHistory` -> `captureUpdate`).
5. The deployed build is the source of truth, not `npm run dev`. Anything that
   only works locally is not done. Always `npm run build` before claiming
   something works.
