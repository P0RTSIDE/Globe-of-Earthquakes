import * as THREE from 'three';
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls';
import gsap from 'gsap';

// Scene
const scene = new THREE.Scene();
scene.background = new THREE.Color(0x000000);

// Create our sphere with higher resolution for better deformation
const geometry = new THREE.SphereGeometry(3, 128, 128);

// Load Earth texture
const textureLoader = new THREE.TextureLoader();
// Using a reliable Earth texture from a CDN
const earthTextureUrls = [
  'https://threejs.org/examples/textures/planets/earth_atmos_2048.jpg',
  'https://raw.githubusercontent.com/mrdoob/three.js/dev/examples/textures/planets/earth_atmos_2048.jpg',
  'https://upload.wikimedia.org/wikipedia/commons/8/83/Equirectangular_projection_SW.jpg'
];

let earthTexture;
let textureLoaded = false;

// Try to load texture with fallback
const loadEarthTexture = (urlIndex = 0) => {
  if (urlIndex >= earthTextureUrls.length) {
    console.warn('Could not load Earth texture from any source, using default color');
    material.color.set('#1a4a6a');
    return;
  }
  
  earthTexture = textureLoader.load(
    earthTextureUrls[urlIndex],
    () => {
      // Success
      if (earthTexture) {
        earthTexture.colorSpace = THREE.SRGBColorSpace;
        material.map = earthTexture;
        material.needsUpdate = true;
        textureLoaded = true;
        console.log('Earth texture loaded successfully');
      }
    },
    undefined,
    () => {
      // Error - try next URL
      console.warn(`Failed to load texture from ${earthTextureUrls[urlIndex]}, trying next...`);
      loadEarthTexture(urlIndex + 1);
    }
  );
};

// Create material with Earth texture
const material = new THREE.MeshStandardMaterial({
  roughness: 0.8,
  metalness: 0.2,
  vertexColors: true // We'll blend vertex colors with texture
});
const mesh = new THREE.Mesh(geometry, material);
scene.add(mesh);

// Start loading texture
loadEarthTexture();

// Store original positions for reset
const originalPositions = geometry.attributes.position.array.slice();
const positions = geometry.attributes.position;
const colors = new Float32Array(positions.count * 3);

// Sizes
const sizes = {
  width: window.innerWidth,
  height: window.innerHeight
}

// Enhanced lighting
const ambientLight = new THREE.AmbientLight(0xffffff, 0.5);
scene.add(ambientLight);

const pointLight = new THREE.PointLight(0xffffff, 1.5, 100);
pointLight.position.set(10, 10, 10);
scene.add(pointLight);

const pointLight2 = new THREE.PointLight(0xff6b6b, 0.8, 100);
pointLight2.position.set(-10, -10, -10);
scene.add(pointLight2);

// Camera
const camera = new THREE.PerspectiveCamera(45, sizes.width/sizes.height, 0.1, 100)
camera.position.z = 20;
scene.add(camera);

// Renderer
const canvas = document.querySelector('.webgl');
const renderer = new THREE.WebGLRenderer({ canvas, antialias: true });
renderer.setSize(sizes.width, sizes.height)
renderer.setPixelRatio(2);
renderer.render(scene, camera)

// Controls - now with zoom enabled
const controls = new OrbitControls(camera, canvas)
controls.enableDamping = true
controls.enablePan = true
controls.enableZoom = true
controls.minDistance = 5
controls.maxDistance = 50
controls.autoRotate = false;

// Raycaster for hover detection
const raycaster = new THREE.Raycaster();
const mouse = new THREE.Vector2();

// Earthquake data storage
let earthquakeData = [];
// Track frequency and magnitude data per location: { count: number, magnitudeSum: number, lat: number, lon: number }
let locationDataMap = new Map();
// Store all earthquake locations for better hover detection
let allEarthquakeLocations = [];

// Convert lat/long to 3D position on sphere
function latLongToVector3(lat, lon, radius) {
  const phi = (90 - lat) * (Math.PI / 180);
  const theta = (lon + 180) * (Math.PI / 180);
  
  const x = -(radius * Math.sin(phi) * Math.cos(theta));
  const z = radius * Math.sin(phi) * Math.sin(theta);
  const y = radius * Math.cos(phi);
  
  return new THREE.Vector3(x, y, z);
}

// Convert 3D position back to lat/long
function vector3ToLatLong(vector, radius) {
  const phi = Math.acos(vector.y / radius);
  const theta = Math.atan2(vector.z, -vector.x);
  
  const lat = 90 - (phi * 180 / Math.PI);
  const lon = (theta * 180 / Math.PI) - 180;
  
  return { lat, lon };
}

// Get color based on magnitude
function getMagnitudeColor(magnitude) {
  // Scale: 0-3 = blue, 3-5 = yellow, 5-7 = orange, 7+ = red
  if (magnitude < 3) {
    return new THREE.Color(0x4a90e2); // Blue
  } else if (magnitude < 5) {
    return new THREE.Color(0xffd700); // Yellow
  } else if (magnitude < 7) {
    return new THREE.Color(0xff8c00); // Orange
  } else {
    return new THREE.Color(0xff0000); // Red
  }
}

// Deform sphere based on earthquake data
function deformSphere() {
  const radius = 3;
  const positions = geometry.attributes.position;
  const positionArray = positions.array;
  
  // Reset positions and initialize colors to white (so Earth texture shows through)
  for (let i = 0; i < originalPositions.length; i++) {
    positionArray[i] = originalPositions[i];
  }
  
  // Initialize all colors to white (1,1,1) so Earth texture is visible
  for (let i = 0; i < positions.count; i++) {
    const i3 = i * 3;
    colors[i3] = 1.0;     // R
    colors[i3 + 1] = 1.0; // G
    colors[i3 + 2] = 1.0; // B
  }
  
  // Apply deformations based on location data (frequency = height, avg magnitude = color)
  locationDataMap.forEach((data, key) => {
    const lat = data.lat;
    const lon = data.lon;
    const quakePosition = latLongToVector3(lat, lon, radius);
    
    const frequency = data.count;
    const avgMagnitude = data.magnitudeSum / frequency;
    
    // Spike height based on frequency (more earthquakes = taller spike)
    const spikeHeight = Math.min(frequency * 0.2, 1.5); // Max spike height of 1.5
    const influenceRadius = 0.35; // How far the deformation affects
    
    // Find nearby vertices and deform them
    for (let i = 0; i < positions.count; i++) {
      const i3 = i * 3;
      const vertex = new THREE.Vector3(
        positionArray[i3],
        positionArray[i3 + 1],
        positionArray[i3 + 2]
      );
      
      const distance = vertex.distanceTo(quakePosition);
      
      if (distance < influenceRadius) {
        // Calculate deformation amount (stronger near center)
        const influence = 1 - (distance / influenceRadius);
        const deformation = spikeHeight * influence * influence; // Quadratic falloff
        
        // Push vertex outward (spike) - height based on frequency
        const direction = vertex.clone().normalize();
        positionArray[i3] += direction.x * deformation;
        positionArray[i3 + 1] += direction.y * deformation;
        positionArray[i3 + 2] += direction.z * deformation;
        
        // Color based on average magnitude - blend with Earth texture
        const color = getMagnitudeColor(avgMagnitude);
        // Blend earthquake color with white (texture) based on influence
        const colorBlend = 0.75 * influence; // Stronger color near center
        colors[i3] = color.r * colorBlend + (1 - colorBlend);
        colors[i3 + 1] = color.g * colorBlend + (1 - colorBlend);
        colors[i3 + 2] = color.b * colorBlend + (1 - colorBlend);
      }
    }
  });
  
  positions.needsUpdate = true;
  geometry.computeVertexNormals();
  
  // Apply colors
  geometry.setAttribute('color', new THREE.BufferAttribute(colors, 3));
  material.vertexColors = true;
  material.needsUpdate = true;
}

// Fetch earthquake data from USGS API
async function fetchEarthquakeData() {
  try {
    // Fetch last 30 days of significant earthquakes (magnitude 4.5+)
    const response = await fetch('https://earthquake.usgs.gov/earthquakes/feed/v1.0/summary/4.5_month.geojson');
    const data = await response.json();
    
    earthquakeData = data.features.map(feature => ({
      lat: feature.geometry.coordinates[1],
      lon: feature.geometry.coordinates[0],
      magnitude: feature.properties.mag,
      place: feature.properties.place,
      time: feature.properties.time
    }));
    
    // Build location data map (round coordinates to group nearby earthquakes)
    // Tracks both frequency (count) and magnitude sum for average calculation
    locationDataMap.clear();
    earthquakeData.forEach(quake => {
      const roundedLat = Math.round(quake.lat * 2) / 2;
      const roundedLon = Math.round(quake.lon * 2) / 2;
      const key = `${roundedLat},${roundedLon}`;
      const existing = locationDataMap.get(key);
      if (existing) {
        existing.count += 1;
        existing.magnitudeSum += quake.magnitude;
      } else {
        locationDataMap.set(key, {
          count: 1,
          magnitudeSum: quake.magnitude,
          lat: roundedLat,
          lon: roundedLon
        });
      }
    });
    
    updateInfoDisplay();
    deformSphere();
    
    console.log(`Loaded ${earthquakeData.length} earthquakes`);
  } catch (error) {
    console.error('Error fetching earthquake data:', error);
    // Fallback to sample data
    createSampleData();
  }
}

// Create sample earthquake data if API fails
function createSampleData() {
  const sampleQuakes = [
    { lat: 36.5, lon: -121.0, magnitude: 6.2, place: 'California, USA' },
    { lat: 35.7, lon: 139.7, magnitude: 5.8, place: 'Tokyo, Japan' },
    { lat: -6.2, lon: 106.8, magnitude: 7.1, place: 'Jakarta, Indonesia' },
    { lat: 19.4, lon: -155.3, magnitude: 5.5, place: 'Hawaii, USA' },
    { lat: 40.7, lon: -74.0, magnitude: 4.8, place: 'New York, USA' },
    { lat: 51.5, lon: -0.1, magnitude: 4.9, place: 'London, UK' },
    { lat: -33.9, lon: 151.2, magnitude: 5.2, place: 'Sydney, Australia' },
    { lat: 25.0, lon: 121.5, magnitude: 6.5, place: 'Taipei, Taiwan' },
    { lat: 28.6, lon: 77.2, magnitude: 5.3, place: 'New Delhi, India' },
    { lat: -12.0, lon: -77.0, magnitude: 5.7, place: 'Lima, Peru' },
  ];
  
  earthquakeData = sampleQuakes;
  
  // Build location data map for sample data
  locationDataMap.clear();
  earthquakeData.forEach(quake => {
    const roundedLat = Math.round(quake.lat * 2) / 2;
    const roundedLon = Math.round(quake.lon * 2) / 2;
    const key = `${roundedLat},${roundedLon}`;
    const existing = locationDataMap.get(key);
    if (existing) {
      existing.count += 1;
      existing.magnitudeSum += quake.magnitude;
    } else {
      locationDataMap.set(key, {
        count: 1,
        magnitudeSum: quake.magnitude,
        lat: roundedLat,
        lon: roundedLon
      });
    }
  });
  
  updateInfoDisplay();
  deformSphere();
}

// Format date for display
function formatDate(timestamp) {
  if (!timestamp) return 'Unknown';
  const date = new Date(timestamp);
  const now = new Date();
  const diffMs = now - date;
  const diffMins = Math.floor(diffMs / 60000);
  const diffHours = Math.floor(diffMs / 3600000);
  const diffDays = Math.floor(diffMs / 86400000);
  
  if (diffMins < 60) {
    return `${diffMins} min ago`;
  } else if (diffHours < 24) {
    return `${diffHours} hour${diffHours > 1 ? 's' : ''} ago`;
  } else if (diffDays < 7) {
    return `${diffDays} day${diffDays > 1 ? 's' : ''} ago`;
  } else {
    return date.toLocaleDateString();
  }
}

// Get magnitude color for list items
function getMagnitudeColorClass(magnitude) {
  if (magnitude < 3) return 'mag-low';
  if (magnitude < 5) return 'mag-medium';
  if (magnitude < 7) return 'mag-high';
  return 'mag-extreme';
}

// Update earthquake list sidebar
function updateEarthquakeList() {
  const listContent = document.getElementById('listContent');
  const listCount = document.getElementById('listCount');
  
  if (!listContent || !listCount) return;
  
  // Sort earthquakes by magnitude (highest first)
  const sortedQuakes = [...earthquakeData].sort((a, b) => b.magnitude - a.magnitude);
  
  listCount.textContent = sortedQuakes.length;
  
  if (sortedQuakes.length === 0) {
    listContent.innerHTML = '<div class="list-empty">No earthquake data available</div>';
    return;
  }
  
  // Create list items
  listContent.innerHTML = sortedQuakes.map(quake => {
    const magColorClass = getMagnitudeColorClass(quake.magnitude);
    const timeAgo = formatDate(quake.time);
    const latDir = quake.lat >= 0 ? 'N' : 'S';
    const lonDir = quake.lon >= 0 ? 'E' : 'W';
    
    return `
      <div class="list-item ${magColorClass}" data-lat="${quake.lat}" data-lon="${quake.lon}">
        <div class="list-item-header">
          <span class="list-magnitude">${quake.magnitude.toFixed(1)}</span>
          <span class="list-time">${timeAgo}</span>
        </div>
        <div class="list-location">${quake.place || `${Math.abs(quake.lat).toFixed(2)}°${latDir}, ${Math.abs(quake.lon).toFixed(2)}°${lonDir}`}</div>
        <div class="list-coords">${Math.abs(quake.lat).toFixed(2)}°${latDir}, ${Math.abs(quake.lon).toFixed(2)}°${lonDir}</div>
      </div>
    `;
  }).join('');
  
  // Add click handlers to list items to highlight on globe
  listContent.querySelectorAll('.list-item').forEach(item => {
    item.addEventListener('click', () => {
      const lat = parseFloat(item.dataset.lat);
      const lon = parseFloat(item.dataset.lon);
      
      // Find camera position to look at this location
      const targetPosition = latLongToVector3(lat, lon, 3);
      const distance = camera.position.length();
      const lookAtPosition = targetPosition.clone().normalize().multiplyScalar(distance);
      
      // Animate camera to look at this location
      gsap.to(camera.position, {
        x: lookAtPosition.x,
        y: lookAtPosition.y,
        z: lookAtPosition.z,
        duration: 1.5,
        ease: "power2.inOut",
        onUpdate: () => {
          camera.lookAt(targetPosition);
          controls.target.copy(targetPosition);
        }
      });
    });
    
    item.addEventListener('mouseenter', () => {
      item.style.backgroundColor = 'rgba(255, 255, 255, 0.1)';
    });
    
    item.addEventListener('mouseleave', () => {
      item.style.backgroundColor = '';
    });
  });
}

// Update info display
function updateInfoDisplay() {
  const infoDiv = document.querySelector('.earthquake-info');
  if (infoDiv) {
    const totalQuakes = earthquakeData.length;
    const maxMagnitude = Math.max(...earthquakeData.map(q => q.magnitude));
    const avgMagnitude = (earthquakeData.reduce((sum, q) => sum + q.magnitude, 0) / totalQuakes).toFixed(1);
    
    infoDiv.innerHTML = `
      <div class="info-item">
        <span class="label">Total Earthquakes:</span>
        <span class="value">${totalQuakes}</span>
      </div>
      <div class="info-item">
        <span class="label">Max Magnitude:</span>
        <span class="value">${maxMagnitude.toFixed(1)}</span>
      </div>
      <div class="info-item">
        <span class="label">Avg Magnitude:</span>
        <span class="value">${avgMagnitude}</span>
      </div>
      <div class="legend">
        <div class="legend-item"><span class="legend-color" style="background: #4a90e2;"></span> Avg < 3.0</div>
        <div class="legend-item"><span class="legend-color" style="background: #ffd700;"></span> Avg 3.0-5.0</div>
        <div class="legend-item"><span class="legend-color" style="background: #ff8c00;"></span> Avg 5.0-7.0</div>
        <div class="legend-item"><span class="legend-color" style="background: #ff0000;"></span> Avg 7.0+</div>
      <div class="legend-note">Height = Frequency | Color = Avg Magnitude</div>
      </div>
    `;
  }
  
  // Also update the earthquake list
  updateEarthquakeList();
}

// Resize handler
window.addEventListener('resize', () => {
  sizes.width = window.innerWidth;
  sizes.height = window.innerHeight;
  camera.aspect = sizes.width / sizes.height;
  camera.updateProjectionMatrix();
  renderer.setSize(sizes.width, sizes.height)
});

// Hover tooltip functionality
const tooltip = document.getElementById('hoverTooltip');
const tooltipContent = tooltip.querySelector('.tooltip-content');
let hoveredLocation = null;

function updateTooltip(event) {
  // Update mouse position
  mouse.x = (event.clientX / sizes.width) * 2 - 1;
  mouse.y = -(event.clientY / sizes.height) * 2 + 1;
  
  // Update raycaster
  raycaster.setFromCamera(mouse, camera);
  
  // Check for intersection with the sphere
  const intersects = raycaster.intersectObject(mesh);
  
  if (intersects.length > 0) {
    const intersectPoint = intersects[0].point;
    const radius = 3;
    const { lat, lon } = vector3ToLatLong(intersectPoint, radius);
    
    // Find the closest earthquake location using better distance calculation
    // Account for sphere curvature by using 3D distance from spike positions
    let closestLocation = null;
    let minDistance = Infinity;
    const maxSearchDistance = 5.0; // Increased from 2.0 degrees for better reliability
    
    locationDataMap.forEach((data, key) => {
      // Calculate 3D distance on sphere surface for more accurate matching
      const location3D = latLongToVector3(data.lat, data.lon, radius);
      const distance3D = intersectPoint.distanceTo(location3D);
      
      // Also check angular distance as fallback
      const angularDistance = Math.sqrt(
        Math.pow(data.lat - lat, 2) + Math.pow(data.lon - lon, 2)
      );
      
      // Use the smaller of the two distances, weighted towards 3D distance
      const distance = Math.min(distance3D * 10, angularDistance);
      
      if (distance < minDistance && angularDistance < maxSearchDistance) {
        minDistance = distance;
        closestLocation = { key, data };
      }
    });
    
    if (closestLocation) {
      const { data } = closestLocation;
      const avgMagnitude = data.magnitudeSum / data.count;
      const frequency = data.count;
      
      // Update tooltip content
      tooltipContent.innerHTML = `
        <div class="tooltip-title">📍 Earthquake Location</div>
        <div class="tooltip-row">
          <span class="tooltip-label">Latitude:</span>
          <span class="tooltip-value">${data.lat.toFixed(2)}°</span>
        </div>
        <div class="tooltip-row">
          <span class="tooltip-label">Longitude:</span>
          <span class="tooltip-value">${data.lon.toFixed(2)}°</span>
        </div>
        <div class="tooltip-row">
          <span class="tooltip-label">Frequency:</span>
          <span class="tooltip-value">${frequency} earthquake${frequency > 1 ? 's' : ''}</span>
        </div>
        <div class="tooltip-row">
          <span class="tooltip-label">Avg Magnitude:</span>
          <span class="tooltip-value">${avgMagnitude.toFixed(1)}</span>
        </div>
      `;
      
      // Position tooltip near mouse, but keep it on screen
      let left = event.clientX + 15;
      let top = event.clientY + 15;
      
      // Keep tooltip within viewport
      if (left + 250 > window.innerWidth) {
        left = event.clientX - 265;
      }
      if (top + 200 > window.innerHeight) {
        top = event.clientY - 200;
      }
      
      tooltip.style.left = `${left}px`;
      tooltip.style.top = `${top}px`;
      tooltip.style.display = 'block';
      hoveredLocation = closestLocation;
    } else {
      tooltip.style.display = 'none';
      hoveredLocation = null;
    }
  } else {
    tooltip.style.display = 'none';
    hoveredLocation = null;
  }
}

// Mouse move event for hover
window.addEventListener('mousemove', updateTooltip);

// Hide tooltip when mouse leaves canvas
canvas.addEventListener('mouseleave', () => {
  tooltip.style.display = 'none';
  hoveredLocation = null;
});

// Animation loop
const loop = () => {
  controls.update()
  renderer.render(scene, camera);
  window.requestAnimationFrame(loop);
}
loop();

// Initial animation
const tl = gsap.timeline({defaults: {duration: 1 }});
tl.fromTo(mesh.scale, { z:0, x:0, y:0 }, { z:1, x:1, y:1});
tl.fromTo('nav', { y: '-100%' }, { y: '0%' });
tl.fromTo('.title', { opacity: 0 }, { opacity: 1 });

// Load earthquake data
fetchEarthquakeData();