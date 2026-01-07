# Earthquake Globe Visualization

An interactive 3D globe visualization of earthquake data, showing frequency and magnitude through visual deformations on an Earth sphere.

## Features

- 🌍 **Interactive 3D Globe**: Rotate, zoom, and explore earthquake data on a textured Earth sphere
- 📊 **Visual Data Representation**: 
  - Spike height represents earthquake frequency
  - Color coding shows average magnitude
- 📍 **Location Information**: Click on earthquake spikes to see location names and details
- 📋 **Earthquake List**: Browse all earthquakes sorted by magnitude
- 🖱️ **Hover Details**: Hover over spikes for quick information
- 🔄 **Real-time Data**: Fetches latest earthquake data from USGS

## Getting Started

### Prerequisites

- Node.js (v16 or higher)
- npm

### Installation

1. Clone the repository
2. Install dependencies:
   ```bash
   npm install
   ```

3. Start the development server:
   ```bash
   npm run dev
   ```

4. Open your browser to the URL shown in the terminal (typically `http://localhost:5173`)

### Build for Production

```bash
npm run build
```

## Usage

- **Rotate**: Click and drag to rotate the globe
- **Zoom**: Scroll to zoom in/out
- **Hover**: Hover over spikes to see quick information
- **Click**: Click on spikes to see detailed location information
- **Browse**: Use the left sidebar to browse and navigate to specific earthquakes

## Data Source

Earthquake data is provided by the [USGS Earthquake Hazards Program](https://earthquake.usgs.gov/), showing earthquakes of magnitude 4.5+ from the last 30 days.

## Technologies Used

- **Three.js**: 3D graphics and WebGL rendering
- **GSAP**: Animations and transitions
- **Vite**: Build tool and development server

## License

This project is licensed under the MIT License - see the [LICENSE](LICENSE) file for details.

## Acknowledgments

This project uses several open-source libraries and data sources. See [ACKNOWLEDGMENTS.md](ACKNOWLEDGMENTS.md) for a complete list of contributors and resources.

## Contributing

Contributions are welcome! Please feel free to submit a Pull Request.

