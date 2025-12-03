# IFC Presence Viewer

Drop an IFC file, view it in a Three.js scene (via React Three Fiber + Drei), and see live pointers for everyone on the same URL. Presence is exchanged through a simple webhook-style endpoint at `/api/presence`.

## Getting Started

1. Install deps:

```bash
npm install
```

2. Ensure the IFC WASM is available to the client:

```bash
mkdir -p public/wasm
cp node_modules/web-ifc/web-ifc.wasm public/wasm/
```

3. Run the dev server:

```bash
npm run dev
```

Open the printed localhost URL. Drop an `.ifc` file into the drop area; the model renders client-side. Share the page URL with teammates—pointer positions are synced every ~1.2s through `/api/presence`.

## Notes

- Presence data is in-memory on the server (clears on restart). Stale cursors are culled after ~15s.
- The `/api/presence` endpoint accepts `POST` with `{ roomId, clientId, pointer: { x, y, color, label } }` and `GET ?roomId=` returns `{ data }`.
- The viewer sets `IFCLoader`'s WASM path to `/wasm/`, so the WASM file must exist there.
