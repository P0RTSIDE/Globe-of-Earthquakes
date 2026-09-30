# Earthquake Globe

An interactive 3D globe of recent earthquakes. Spike height shows how many events share a location. Color shows average magnitude.

Live site: [globe-of-earthquakes.vercel.app](https://globe-of-earthquakes.vercel.app/).

## What it shows

- A textured Earth that can be rotated and zoomed
- Spikes for clustered events: height is frequency, color is average magnitude
- Hover text on a spike, and a click-through with the place name
- A list of events sorted by magnitude

Data comes from the USGS Earthquake Hazards Program, the past 30 days of magnitude 4.5 and above: [USGS GeoJSON feed](https://earthquake.usgs.gov/earthquakes/feed/v1.0/summary/4.5_month.geojson).

## Stack

- Three.js for the WebGL scene
- GSAP for motion
- Vite for the dev server and production build

## Run locally

Node.js 16 or newer.

```bash
npm install
npm run dev
```

The terminal prints a local URL, usually http://localhost:5173.

```bash
npm run build
npm run preview
```

## Controls

- Drag to rotate
- Scroll to zoom
- Hover a spike for a short readout
- Click a spike for the place name
- Use the sidebar list to jump to an event

## License

MIT. See [LICENSE](LICENSE). Third-party libraries and data sources are listed in [ACKNOWLEDGMENTS.md](ACKNOWLEDGMENTS.md).
