# lime constructs

Shipping container planner. Design a layout in 3D, add openings, get a costed quote.

Built with Expo and React Native, one codebase for phone and desktop, and no 3D library: the scene is a small hand written projector and painter's sort renderer in `src/geo.ts`.

## Run

```
npm install
npx expo start
```

Press `w` for the browser, scan the QR for the phone.

## What it does

- 8 unit types from 10 ft to 45 ft high cube, plus 4 starter presets
- Orbit, zoom, plan view, tap to select
- Move, rotate, stack a level, duplicate, delete
- Doors, sliders, bi-folds, windows and clerestories cut real holes in the walls
- Shell colours, per unit pricing, live estimate with labour and VAT
- Support check: flags a stacked unit with nothing underneath it, and units overlapping on the same level

## Layout

`src/geo.ts` projection and scene build, `src/data.ts` unit types and rates, `src/quote.ts` costing, `src/Planner.tsx` app state, `src/components` viewport, panels and sheets.
