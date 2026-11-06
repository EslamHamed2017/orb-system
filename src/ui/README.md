# ORB UI boundary

`src/ui` contains reusable Material Design 3 presentation components and bilingual Arabic RTL / English LTR interaction primitives. It may import exported domain capabilities from `src/modules` and technical primitives from `src/platform`.

UI code must not import `src/app`. Route composition, request entry points, and framework-owned page files remain in `src/app`; domain rules remain in `src/modules`. UI components must not hide business edits, invent domain policy, or expose deferred navigation and controls.
