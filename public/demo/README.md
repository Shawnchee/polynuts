# public/demo

Render artifacts for the landing-page hero demo. These are generated, not
committed source — produced by the Remotion composition in `/remotion`.

Expected files (created by the render step the lead runs):

| File                          | Produced by                | Used by                         |
| ----------------------------- | -------------------------- | ------------------------------- |
| `polynuts-demo.mp4`           | `npm run render:demo`      | `<HeroDemo>` `<video src>`      |
| `polynuts-demo.gif`           | `npm run render:demo:gif`  | social / README previews        |
| `polynuts-demo-poster.jpg`    | poster frame export*       | `<video poster>` + reduced-motion fallback |

*Poster: export a single still from the composition, e.g.

```bash
npx remotion still PolynutsDemo public/demo/polynuts-demo-poster.jpg --frame=200
```

(frame 200 lands on the WON / payout beat — a strong static thumbnail.)

The full-length renders are run separately by the lead; do not commit the
binaries.
