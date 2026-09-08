import * as THREE from 'three';
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls';
import gsap from 'gsap';

// Scene
const scene = new THREE.Scene();
scene.background = new THREE.Color(0x020308);

// Denser sphere so coastlines and quake spikes stay crisp
const geometry = new THREE.SphereGeometry(3, 256, 256);

const textureLoader = new THREE.TextureLoader();
const earthColorUrls = [
  'https://unpkg.com/three-globe/example/img/earth-blue-marble.jpg',
  'https://threejs.org/examples/textures/planets/earth_atmos_2048.jpg',
  'https://raw.githubusercontent.com/mrdoob/three.js/dev/examples/textures/planets/earth_atmos_2048.jpg',
  'https://upload.wikimedia.org/wikipedia/commons/8/83/Equirectangular_projection_SW.jpg'
];
const earthNormalUrls = [
  'https://threejs.org/examples/textures/planets/earth_normal_2048.jpg',
  'https://raw.githubusercontent.com/mrdoob/three.js/dev/examples/textures/planets/earth_normal_2048.jpg'
];

let earthTexture;
let textureLoaded = false;
let textureAnisotropy = 8;

function applyTextureFilters(texture, isColor) {
  texture.anisotropy = textureAnisotropy;
  texture.minFilter = THREE.LinearMipmapLinearFilter;
  texture.magFilter = THREE.LinearFilter;
  texture.generateMipmaps = true;
  if (isColor && THREE.sRGBEncoding !== undefined) {
    texture.encoding = THREE.sRGBEncoding;
  }
}

function loadTextureWithFallback(urls, onLoad) {
  const tryUrl = (index) => {
    if (index >= urls.length) return;
    textureLoader.load(
      urls[index],
      (texture) => onLoad(texture),
      undefined,
      () => tryUrl(index + 1)
    );
  };
  tryUrl(0);
}

const material = new THREE.MeshStandardMaterial({
  color: 0xffffff,
  roughness: 0.82,
  metalness: 0.06,
  vertexColors: true
});
const mesh = new THREE.Mesh(geometry, material);
scene.add(mesh);

const loadEarthTexture = (urlIndex = 0) => {
  if (urlIndex >= earthColorUrls.length) {
    console.warn('Could not load Earth texture from any source, using default color');
    material.color.set('#1a4a6a');
    return;
  }

  earthTexture = textureLoader.load(
    earthColorUrls[urlIndex],
    () => {
      if (earthTexture) {
        applyTextureFilters(earthTexture, true);
        material.map = earthTexture;
        material.needsUpdate = true;
        textureLoaded = true;
      }
    },
    undefined,
    () => {
      loadEarthTexture(urlIndex + 1);
    }
  );
};

loadTextureWithFallback(earthNormalUrls, (texture) => {
  applyTextureFilters(texture, false);
  material.normalMap = texture;
  material.normalScale = new THREE.Vector2(0.7, 0.7);
  material.needsUpdate = true;
});

const atmosphere = new THREE.Mesh(
  new THREE.SphereGeometry(3.12, 96, 96),
  new THREE.ShaderMaterial({
    vertexShader: `
      varying vec3 vNormal;
      void main() {
        vNormal = normalize(normalMatrix * normal);
        gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
      }
    `,
    fragmentShader: `
      varying vec3 vNormal;
      void main() {
        float intensity = pow(0.55 - dot(vNormal, vec3(0.0, 0.0, 1.0)), 4.4);
        gl_FragColor = vec4(0.28, 0.52, 0.95, 1.0) * intensity;
      }
    `,
    blending: THREE.AdditiveBlending,
    side: THREE.BackSide,
    transparent: true,
    depthWrite: false
  })
);
atmosphere.raycast = () => {};
mesh.add(atmosphere);

const starCount = 1400;
const starPositions = new Float32Array(starCount * 3);
for (let i = 0; i < starCount; i++) {
  const radius = 48 + Math.random() * 36;
  const theta = Math.random() * Math.PI * 2;
  const phi = Math.acos(2 * Math.random() - 1);
  starPositions[i * 3] = radius * Math.sin(phi) * Math.cos(theta);
  starPositions[i * 3 + 1] = radius * Math.sin(phi) * Math.sin(theta);
  starPositions[i * 3 + 2] = radius * Math.cos(phi);
}
const starGeometry = new THREE.BufferGeometry();
starGeometry.setAttribute('position', new THREE.BufferAttribute(starPositions, 3));
scene.add(new THREE.Points(starGeometry, new THREE.PointsMaterial({
  color: 0xdde6ff,
  size: 0.045,
  sizeAttenuation: true,
  depthWrite: false
})));

// Detection zone overlays - yellow semi-transparent circles at each earthquake location
// Added as child of mesh so they animate and transform with the globe
const detectionZoneGroup = new THREE.Group();
mesh.add(detectionZoneGroup);

// Start loading texture
loadEarthTexture();

// Store original positions for reset
const originalPositions = geometry.attributes.position.array.slice();
const positions = geometry.attributes.position;
const colors = new Float32Array(positions.count * 3);
colors.fill(1);
geometry.setAttribute('color', new THREE.BufferAttribute(colors, 3));

// Sizes
const sizes = {
  width: window.innerWidth,
  height: window.innerHeight
}

const ambientLight = new THREE.AmbientLight(0xc9d2de, 0.55);
scene.add(ambientLight);

const sunLight = new THREE.DirectionalLight(0xfff6ea, 1.15);
sunLight.position.set(8, 5, 9);
scene.add(sunLight);

const fillLight = new THREE.DirectionalLight(0x7f93b3, 0.22);
fillLight.position.set(-7, -2, -5);
scene.add(fillLight);

// Camera
const camera = new THREE.PerspectiveCamera(45, sizes.width/sizes.height, 0.1, 100)
camera.position.z = 20;
scene.add(camera);

// Renderer
const canvas = document.querySelector('.webgl');
const renderer = new THREE.WebGLRenderer({ canvas, antialias: true, powerPreference: 'high-performance' });
renderer.setSize(sizes.width, sizes.height)
renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
if (THREE.sRGBEncoding !== undefined) {
  renderer.outputEncoding = THREE.sRGBEncoding;
}
if (THREE.ACESFilmicToneMapping !== undefined) {
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = 0.92;
}
textureAnisotropy = renderer.capabilities.getMaxAnisotropy();
if (earthTexture) {
  earthTexture.anisotropy = textureAnisotropy;
}
if (material.map) material.map.anisotropy = textureAnisotropy;
if (material.normalMap) material.normalMap.anisotropy = textureAnisotropy;
renderer.render(scene, camera)

// Controls - now with zoom enabled
const controls = new OrbitControls(camera, canvas)
controls.enableDamping = true
controls.enablePan = true
controls.enableZoom = true
controls.minDistance = 5
controls.maxDistance = 50
controls.autoRotate = false;
controls.target.set(0, 0, 0);

// Let the user take over if they drag during a list-focus move
controls.addEventListener('start', () => {
  gsap.killTweensOf(camera.position);
  controls.target.set(0, 0, 0);
});

// Raycaster for hover detection
const raycaster = new THREE.Raycaster();
const mouse = new THREE.Vector2();

// Earthquake data storage
let earthquakeData = [];
// Track frequency and magnitude data per location: { count: number, magnitudeSum: number, lat: number, lon: number, places: string[] }
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

function focusCameraOnLatLon(lat, lon) {
  const locationOnGlobe = latLongToVector3(lat, lon, 3);
  const distance = Math.max(camera.position.length(), controls.minDistance);
  const nextPosition = locationOnGlobe.clone().normalize().multiplyScalar(distance);

  gsap.killTweensOf(camera.position);
  controls.target.set(0, 0, 0);

  gsap.to(camera.position, {
    x: nextPosition.x,
    y: nextPosition.y,
    z: nextPosition.z,
    duration: 1.2,
    ease: "power2.inOut",
    overwrite: true,
    onUpdate: () => {
      controls.target.set(0, 0, 0);
      camera.lookAt(controls.target);
    },
    onComplete: () => {
      controls.target.set(0, 0, 0);
      camera.lookAt(controls.target);
      controls.update();
    }
  });
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

  // Create visible detection zone overlays for easier hover/click
  createDetectionZones();
}

// Only trigger hover/click when cursor is within visible gradient (not transparent edges)
// Gradient opacity: 0.55 center, 0.25 @30%, 0.08 @60%, 0 @100% — use inner 50% as active area
const ACTIVE_GRADIENT_FRACTION = 0.5;
const _circleWorldPos = new THREE.Vector3();
const _toCamera = new THREE.Vector3();
const _toPoint = new THREE.Vector3();

// Only detect zones/earthquakes on the camera-facing hemisphere (not the back of the globe)
function isOnVisibleHemisphere(worldPosition) {
  _toCamera.copy(camera.position).normalize();
  _toPoint.copy(worldPosition).normalize();
  return _toCamera.dot(_toPoint) > 0;
}

function isWithinVisibleGradient(intersect) {
  const circle = intersect.object;
  const zoneRadius = circle.userData?.zoneRadius;
  if (zoneRadius == null) return false;
  circle.getWorldPosition(_circleWorldPos);
  const distFromCenter = intersect.point.distanceTo(_circleWorldPos);
  return distFromCenter <= zoneRadius * ACTIVE_GRADIENT_FRACTION;
}

// Create gradient overlay circles - magnitude color strongest at center, fade to transparent at edges
function createMagnitudeGradientTexture(threeColor) {
  const size = 256;
  const canvas = document.createElement('canvas');
  canvas.width = size;
  canvas.height = size;
  const ctx = canvas.getContext('2d');
  const r = Math.round(threeColor.r * 255);
  const g = Math.round(threeColor.g * 255);
  const b = Math.round(threeColor.b * 255);
  const gradient = ctx.createRadialGradient(size / 2, size / 2, 0, size / 2, size / 2, size / 2);
  gradient.addColorStop(0, `rgba(${r}, ${g}, ${b}, 0.55)`);   // Strong at center (earthquake point)
  gradient.addColorStop(0.3, `rgba(${r}, ${g}, ${b}, 0.25)`);
  gradient.addColorStop(0.6, `rgba(${r}, ${g}, ${b}, 0.08)`);
  gradient.addColorStop(1, `rgba(${r}, ${g}, ${b}, 0)`);     // Fully transparent at edge (stays within hitbox)
  ctx.fillStyle = gradient;
  ctx.fillRect(0, 0, size, size);
  return new THREE.CanvasTexture(canvas);
}

function createDetectionZones() {
  const radius = 3;
  const zoneRadius = 0.5; // 3D units - size of the clickable/hoverable area
  const zoneOffset = 0.08; // Slightly above sphere surface to avoid z-fighting

  const circleGeometry = new THREE.CircleGeometry(zoneRadius, 32);

  while (detectionZoneGroup.children.length > 0) {
    detectionZoneGroup.remove(detectionZoneGroup.children[0]);
  }
  locationDataMap.forEach((data, key) => {
    const avgMagnitude = data.magnitudeSum / data.count;
    const magnitudeColor = getMagnitudeColor(avgMagnitude);
    const gradientTexture = createMagnitudeGradientTexture(magnitudeColor);
    gradientTexture.needsUpdate = true;

    const zoneMaterial = new THREE.MeshBasicMaterial({
      map: gradientTexture,
      transparent: true,
      opacity: 1,
      side: THREE.DoubleSide,
      depthWrite: false,
    });

    const pos = latLongToVector3(data.lat, data.lon, radius);
    const circle = new THREE.Mesh(circleGeometry, zoneMaterial);
    circle.position.copy(pos).multiplyScalar(1 + zoneOffset / radius);
    circle.lookAt(pos.clone().multiplyScalar(2)); // Face outward from sphere
    circle.renderOrder = 1; // Render on top for visibility
    circle.userData = { locationData: data, key, zoneRadius };
    detectionZoneGroup.add(circle);
  });
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
        // Store unique place names
        if (quake.place && !existing.places.includes(quake.place)) {
          existing.places.push(quake.place);
        }
      } else {
        locationDataMap.set(key, {
          count: 1,
          magnitudeSum: quake.magnitude,
          lat: roundedLat,
          lon: roundedLon,
          places: quake.place ? [quake.place] : []
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
      if (quake.place && !existing.places.includes(quake.place)) {
        existing.places.push(quake.place);
      }
    } else {
      locationDataMap.set(key, {
        count: 1,
        magnitudeSum: quake.magnitude,
        lat: roundedLat,
        lon: roundedLon,
        places: quake.place ? [quake.place] : []
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
    listContent.innerHTML = '<div class="list-empty">No recent events to show</div>';
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
      focusCameraOnLatLon(lat, lon);
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
  const infoDiv = document.querySelector('#infoWindow .window-body');
  if (infoDiv) {
    const totalQuakes = earthquakeData.length;
    const maxMagnitude = Math.max(...earthquakeData.map(q => q.magnitude));
    const avgMagnitude = (earthquakeData.reduce((sum, q) => sum + q.magnitude, 0) / totalQuakes).toFixed(1);
    
    infoDiv.innerHTML = `
      <div class="info-item">
        <span class="label">Earthquakes</span>
        <span class="value">${totalQuakes}</span>
      </div>
      <div class="info-item">
        <span class="label">Strongest</span>
        <span class="value">${maxMagnitude.toFixed(1)}</span>
      </div>
      <div class="info-item">
        <span class="label">Average</span>
        <span class="value">${avgMagnitude}</span>
      </div>
      <div class="legend">
        <div class="legend-item"><span class="legend-color" style="background: #4a90e2;"></span> Below 3.0</div>
        <div class="legend-item"><span class="legend-color" style="background: #ffd700;"></span> 3.0 to 5.0</div>
        <div class="legend-item"><span class="legend-color" style="background: #ff8c00;"></span> 5.0 to 7.0</div>
        <div class="legend-item"><span class="legend-color" style="background: #ff0000;"></span> 7.0 and above</div>
      <div class="legend-note">Taller spikes mean more quakes at that spot. Color is average strength.</div>
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
  renderer.setSize(sizes.width, sizes.height);
  
  // Recalculate instructions position on resize
  if (windowManager) {
    windowManager.adjustInstructionsPosition();
  }
});

// Hover tooltip functionality
const tooltip = document.getElementById('hoverTooltip');
const tooltipContent = tooltip.querySelector('.tooltip-content');
let hoveredLocation = null;

function updateTooltip(event) {
  // Update mouse position
  mouse.x = (event.clientX / sizes.width) * 2 - 1;
  mouse.y = -(event.clientY / sizes.height) * 2 + 1;
  
  // Update raycaster - check detection zones first, then sphere
  raycaster.setFromCamera(mouse, camera);
  const allTargets = [...detectionZoneGroup.children, mesh];
  const intersects = raycaster.intersectObjects(allTargets);
  
  let closestLocation = null;
  
  // If we hit a detection zone within visible gradient and on camera-facing side, use it
  const zoneHit = intersects.find(i => {
    if (!i.object.userData?.locationData || !isWithinVisibleGradient(i)) return false;
    i.object.getWorldPosition(_circleWorldPos);
    return isOnVisibleHemisphere(_circleWorldPos);
  });
  if (zoneHit) {
    closestLocation = { key: zoneHit.object.userData.key, data: zoneHit.object.userData.locationData };
  } else if (intersects.length > 0 && intersects[0].object === mesh) {
    // Fallback: only when ray hits globe first — only consider earthquakes on visible hemisphere
    const intersectPoint = intersects[0].point;
    const radius = 3;
    const { lat, lon } = vector3ToLatLong(intersectPoint, radius);
    let minDistance = Infinity;
    const maxSearchDistance = 8.0; 
    
    locationDataMap.forEach((data, key) => {
      const location3D = latLongToVector3(data.lat, data.lon, radius);
      if (!isOnVisibleHemisphere(location3D)) return; // Skip earthquakes on back of globe
      const distance3D = intersectPoint.distanceTo(location3D);
      const angularDistance = Math.sqrt(
        Math.pow(data.lat - lat, 2) + Math.pow(data.lon - lon, 2)
      );
      const distance = Math.min(distance3D * 10, angularDistance);
      
      if (distance < minDistance && angularDistance < maxSearchDistance) {
        minDistance = distance;
        closestLocation = { key, data };
      }
    });
  }
  
  if (closestLocation) {
      const { data } = closestLocation;
      const avgMagnitude = data.magnitudeSum / data.count;
      const frequency = data.count;
      
      // Update tooltip content
      tooltipContent.innerHTML = `
        <div class="tooltip-title">
          <svg class="mark" aria-hidden="true"><use href="#mark-spike"></use></svg>
          <span>Location</span>
        </div>
        <div class="tooltip-row">
          <span class="tooltip-label">Latitude</span>
          <span class="tooltip-value">${data.lat.toFixed(2)}°</span>
        </div>
        <div class="tooltip-row">
          <span class="tooltip-label">Longitude</span>
          <span class="tooltip-value">${data.lon.toFixed(2)}°</span>
        </div>
        <div class="tooltip-row">
          <span class="tooltip-label">Quakes here</span>
          <span class="tooltip-value">${frequency}</span>
        </div>
        <div class="tooltip-row">
          <span class="tooltip-label">Average strength</span>
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
}

// Location modal functionality
const locationModal = document.getElementById('locationModal');
const modalBody = document.getElementById('modalBody');
const modalClose = document.getElementById('modalClose');

function escapeHtml(text) {
  return String(text)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

function formatPlaceName(places, lat, lon) {
  const fallback = `${Math.abs(lat).toFixed(2)}°${lat >= 0 ? 'N' : 'S'}, ${Math.abs(lon).toFixed(2)}°${lon >= 0 ? 'E' : 'W'}`;
  if (!places || places.length === 0) {
    return { title: fallback, extras: [] };
  }

  const regions = [];
  const seen = new Set();
  places.forEach((place) => {
    const regionMatch = String(place).match(/\bof\s+(.+)$/i);
    const region = (regionMatch ? regionMatch[1] : place).trim();
    const key = region.toLowerCase();
    if (region && !seen.has(key)) {
      seen.add(key);
      regions.push({
        name: region,
        near: Boolean(regionMatch)
      });
    }
  });

  if (regions.length === 0) {
    return { title: fallback, extras: [] };
  }

  const title = regions[0].near ? `Near ${regions[0].name}` : regions[0].name;
  const extras = regions.slice(1).map((region) => (
    region.near ? `Also near ${region.name}` : region.name
  ));
  return { title, extras };
}

function showLocationModal(locationData) {
  const avgMagnitude = locationData.magnitudeSum / locationData.count;
  const frequency = locationData.count;
  const latDir = locationData.lat >= 0 ? 'N' : 'S';
  const lonDir = locationData.lon >= 0 ? 'E' : 'W';
  const coords = `${Math.abs(locationData.lat).toFixed(2)}°${latDir}, ${Math.abs(locationData.lon).toFixed(2)}°${lonDir}`;
  const { title, extras } = formatPlaceName(locationData.places, locationData.lat, locationData.lon);
  const extrasHtml = extras.length
    ? `<p class="location-extras">${extras.map((item) => escapeHtml(item)).join('<br>')}</p>`
    : '';
  
  modalBody.innerHTML = `
    <h2 class="location-place">${escapeHtml(title)}</h2>
    <p class="location-coords">${escapeHtml(coords)}</p>
    ${extrasHtml}
    <div class="location-stats">
      <div class="location-stat">
        <span class="location-stat-label">Quakes here</span>
        <span class="location-stat-value">${frequency}</span>
      </div>
      <div class="location-stat">
        <span class="location-stat-label">Average strength</span>
        <span class="location-stat-value">${avgMagnitude.toFixed(1)}</span>
      </div>
    </div>
  `;
  
  const card = locationModal.querySelector('.modal-content');
  locationModal.style.display = 'flex';
  gsap.fromTo(locationModal, { opacity: 0 }, { opacity: 1, duration: 0.18 });
  gsap.fromTo(card, { opacity: 0, y: 14 }, { opacity: 1, y: 0, duration: 0.28, ease: "power2.out" });
}

function hideLocationModal() {
  gsap.to(locationModal, {
    opacity: 0,
    duration: 0.2,
    onComplete: () => {
      locationModal.style.display = 'none';
    }
  });
}

// Track if user is dragging to prevent click during drag
let isDragging = false;
let dragStartTime = 0;

canvas.addEventListener('mousedown', () => {
  isDragging = false;
  dragStartTime = Date.now();
});

canvas.addEventListener('mousemove', () => {
  if (Date.now() - dragStartTime > 100) {
    isDragging = true;
  }
});

// Click handler for earthquake locations
function handleEarthquakeClick(event) {
  // Only trigger if not dragging (quick click, not drag)
  if (isDragging) {
    isDragging = false;
    return;
  }
  
  // Update mouse position
  mouse.x = (event.clientX / sizes.width) * 2 - 1;
  mouse.y = -(event.clientY / sizes.height) * 2 + 1;
  
  // Update raycaster - check detection zones first, then sphere
  raycaster.setFromCamera(mouse, camera);
  const allTargets = [...detectionZoneGroup.children, mesh];
  const intersects = raycaster.intersectObjects(allTargets);
  
  let closestLocation = null;
  const zoneHit = intersects.find(i => {
    if (!i.object.userData?.locationData || !isWithinVisibleGradient(i)) return false;
    i.object.getWorldPosition(_circleWorldPos);
    return isOnVisibleHemisphere(_circleWorldPos);
  });
  if (zoneHit) {
    closestLocation = { data: zoneHit.object.userData.locationData };
  } else if (intersects.length > 0 && intersects[0].object === mesh) {
    const intersectPoint = intersects[0].point;
    const radius = 3;
    const { lat, lon } = vector3ToLatLong(intersectPoint, radius);
    let minDistance = Infinity;
    const maxSearchDistance = 8.0;
    
    locationDataMap.forEach((data, key) => {
      const location3D = latLongToVector3(data.lat, data.lon, radius);
      if (!isOnVisibleHemisphere(location3D)) return; // Skip earthquakes on back of globe
      const distance3D = intersectPoint.distanceTo(location3D);
      const angularDistance = Math.sqrt(
        Math.pow(data.lat - lat, 2) + Math.pow(data.lon - lon, 2)
      );
      const distance = Math.min(distance3D * 10, angularDistance);
      
      if (distance < minDistance && angularDistance < maxSearchDistance) {
        minDistance = distance;
        closestLocation = { key, data };
      }
    });
  }
  
  if (closestLocation) {
    showLocationModal(closestLocation.data);
  }
  
  isDragging = false;
}

// Mouse move event for hover
window.addEventListener('mousemove', updateTooltip);

// Click event for location info
canvas.addEventListener('click', handleEarthquakeClick);

// Close modal handlers
modalClose.addEventListener('click', hideLocationModal);
locationModal.addEventListener('click', (e) => {
  if (e.target === locationModal) {
    hideLocationModal();
  }
});

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

// Window Management System
class WindowManager {
  constructor() {
    this.windows = {
      info: {
        element: document.getElementById('infoWindow'),
        button: document.getElementById('toggleInfoBtn'),
        closeBtn: document.getElementById('closeInfoBtn'),
        defaultPosition: { top: '20%', right: '4rem' }
      },
      list: {
        element: document.getElementById('listWindow'),
        button: document.getElementById('toggleListBtn'),
        closeBtn: document.getElementById('closeListBtn'),
        defaultPosition: { left: '1rem', top: '50%', transform: 'translateY(-50%)' }
      },
      data: {
        element: document.getElementById('dataWindow'),
        button: document.getElementById('toggleDataBtn'),
        closeBtn: document.getElementById('closeDataBtn'),
        defaultPosition: { bottom: '1rem', right: '1rem' }
      }
    };
    
    this.init();
  }
  
  init() {
    // Initialize all windows as closed
    Object.keys(this.windows).forEach(key => {
      const window = this.windows[key];
      window.isOpen = false;
      
      // Set default positions
      this.setDefaultPosition(window);
      
      // Add event listeners
      window.button.addEventListener('click', () => this.toggleWindow(key));
      window.closeBtn.addEventListener('click', () => this.closeWindow(key));
    });
  }
  
  setDefaultPosition(window) {
    const pos = window.defaultPosition;
    Object.keys(pos).forEach(key => {
      if (key === 'transform') {
        window.element.style.transform = pos[key];
      } else {
        window.element.style[key] = pos[key];
      }
    });
  }
  
  openWindow(key) {
    const window = this.windows[key];
    if (!window || window.isOpen) return;
    
    window.isOpen = true;
    window.element.classList.add('active');
    window.button.classList.add('active');
    
    // Bring to front
    this.bringToFront(window.element);
    
    // Adjust instructions position if list window is opened
    this.adjustInstructionsPosition();
  }
  
  closeWindow(key) {
    const window = this.windows[key];
    if (!window || !window.isOpen) return;
    
    window.isOpen = false;
    window.element.classList.remove('active');
    window.button.classList.remove('active');
    
    // Adjust instructions position if list window is closed
    this.adjustInstructionsPosition();
  }
  
  adjustInstructionsPosition() {
    const instructions = document.querySelector('.instructions');
    if (!instructions) return;
    
    const listWindow = this.windows.list.element;
    const isListOpen = listWindow.classList.contains('active');
    
    if (isListOpen) {
      // Get list window position and width
      const listRect = listWindow.getBoundingClientRect();
      const listRight = listRect.right;
      const instructionsWidth = instructions.offsetWidth || 280;
      const margin = 20; // Margin between list and instructions
      
      // Position instructions to the right of list window, but stay in viewport
      const newLeft = listRight + margin;
      const maxLeft = window.innerWidth - instructionsWidth - margin;
      const finalLeft = Math.min(newLeft, maxLeft);
      
      // Position vertically to avoid overlap - place near bottom but above list window bottom
      const listBottom = listRect.bottom;
      const instructionsHeight = instructions.offsetHeight || 100;
      const bottomSpace = window.innerHeight - listBottom;
      
      if (bottomSpace < instructionsHeight + margin) {
        // Not enough space below list, position above list bottom
        instructions.style.bottom = `${window.innerHeight - listBottom + margin}px`;
        instructions.style.top = 'auto';
      } else {
        // Enough space, keep at bottom
        instructions.style.bottom = '1rem';
        instructions.style.top = 'auto';
      }
      
      instructions.style.left = `${finalLeft}px`;
    } else {
      // Reset to default bottom-left position
      instructions.style.bottom = '1rem';
      instructions.style.top = 'auto';
      instructions.style.left = '1rem';
    }
  }
  
  toggleWindow(key) {
    const window = this.windows[key];
    if (!window) return;
    
    if (window.isOpen) {
      this.closeWindow(key);
    } else {
      this.openWindow(key);
    }
  }
  
  bringToFront(element) {
    // Get all draggable windows
    const allWindows = document.querySelectorAll('.draggable-window.active');
    let maxZ = 100;
    
    allWindows.forEach(win => {
      const z = parseInt(window.getComputedStyle(win).zIndex) || 100;
      maxZ = Math.max(maxZ, z);
    });
    
    element.style.zIndex = maxZ + 1;
  }
}

// Initialize window manager after DOM is loaded
let windowManager;
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', () => {
    windowManager = new WindowManager();
    windowManager.openWindow('info');
    windowManager.adjustInstructionsPosition();
    initInstructionsClose();
    initAcknowledgmentsModal();
  });
} else {
  windowManager = new WindowManager();
  windowManager.openWindow('info');
  windowManager.adjustInstructionsPosition();
  initInstructionsClose();
  initAcknowledgmentsModal();
}

function initInstructionsClose() {
  const instructionsWindow = document.getElementById('instructionsWindow');
  const closeInstructionsBtn = document.getElementById('closeInstructionsBtn');
  const toggleInstructBtn = document.getElementById('toggleInstructBtn');
  
  if (closeInstructionsBtn && instructionsWindow) {
    closeInstructionsBtn.addEventListener('click', () => {
      instructionsWindow.style.display = 'none';
      if (toggleInstructBtn) {
        toggleInstructBtn.classList.remove('active');
      }
    });
  }
  
  if (toggleInstructBtn && instructionsWindow) {
    toggleInstructBtn.addEventListener('click', () => {
      const isHidden = instructionsWindow.style.display === 'none';
      instructionsWindow.style.display = isHidden ? 'block' : 'none';
      toggleInstructBtn.classList.toggle('active', !isHidden);
    });
  }
}

function initAcknowledgmentsModal() {
  const ackModal = document.getElementById('acknowledgmentsModal');
  const showAckBtn = document.getElementById('showAcknowledgmentsBtn');
  const closeAckBtn = document.getElementById('closeAckModalBtn');
  const ackContent = document.getElementById('acknowledgmentsContent');
  
  const acknowledgmentsHTML = `
    <p>This project would not be possible without the following open-source libraries, data providers, and resources:</p>
    
    <h2>Libraries & Frameworks</h2>
    
    <h3>Three.js</h3>
    <ul>
      <li><strong>Repository</strong>: <a href="https://github.com/mrdoob/three.js" target="_blank">https://github.com/mrdoob/three.js</a></li>
      <li><strong>License</strong>: MIT License</li>
      <li><strong>Purpose</strong>: 3D graphics rendering and WebGL functionality</li>
      <li><strong>Contributors</strong>: The Three.js community and contributors</li>
    </ul>
    
    <h3>GSAP (GreenSock Animation Platform)</h3>
    <ul>
      <li><strong>Repository</strong>: <a href="https://github.com/greensock/GSAP" target="_blank">https://github.com/greensock/GSAP</a></li>
      <li><strong>License</strong>: Standard "No Charge" License</li>
      <li><strong>Purpose</strong>: Smooth animations and transitions</li>
      <li><strong>Contributors</strong>: GreenSock team</li>
    </ul>
    
    <h3>Vite</h3>
    <ul>
      <li><strong>Repository</strong>: <a href="https://github.com/vitejs/vite" target="_blank">https://github.com/vitejs/vite</a></li>
      <li><strong>License</strong>: MIT License</li>
      <li><strong>Purpose</strong>: Build tool and development server</li>
      <li><strong>Contributors</strong>: Vite team and contributors</li>
    </ul>
    
    <h2>Data Sources</h2>
    
    <h3>USGS Earthquake Hazards Program</h3>
    <ul>
      <li><strong>Website</strong>: <a href="https://earthquake.usgs.gov/" target="_blank">https://earthquake.usgs.gov/</a></li>
      <li><strong>API</strong>: <a href="https://earthquake.usgs.gov/earthquakes/feed/v1.0/" target="_blank">https://earthquake.usgs.gov/earthquakes/feed/v1.0/</a></li>
      <li><strong>Data</strong>: Public domain earthquake data</li>
      <li><strong>Purpose</strong>: Real-time and historical earthquake data</li>
      <li><strong>Note</strong>: Data is provided without warranty. The USGS makes no warranty, expressed or implied, regarding the accuracy of the data.</li>
    </ul>
    
    <h2>Resources</h2>
    
    <h3>Earth Texture</h3>
      <p>The globe uses an equirectangular Earth map plus a terrain map from the Three.js examples set. Color imagery prefers a Blue Marble source, then the Three.js Earth atmosphere map, then a Wikimedia Commons projection. Earthquake spikes and magnitude colors are drawn on top of that map.</p>
    
    <h3>Fonts</h3>
    <ul>
      <li><strong>Barlow</strong> and <strong>Barlow Semi Condensed</strong>: Google Fonts (OFL)</li>
    </ul>
    
    <h2>Special Thanks</h2>
    <ul>
      <li>The Three.js community for excellent documentation and examples</li>
      <li>USGS for providing free, accessible earthquake data</li>
      <li>All open-source contributors who make projects like this possible</li>
    </ul>
    
    <hr style="border: 1px solid rgba(255, 255, 255, 0.2); margin: 2rem 0;">
    
    <p><em>This project is built on the shoulders of giants. We are grateful to all the developers, researchers, and organizations who have contributed to the open-source ecosystem and made this visualization possible.</em></p>
  `;
  
  if (showAckBtn && ackModal && ackContent) {
    ackContent.innerHTML = acknowledgmentsHTML;
    
    showAckBtn.addEventListener('click', () => {
      const card = ackModal.querySelector('.modal-content');
      ackModal.style.display = 'flex';
      gsap.fromTo(ackModal, { opacity: 0 }, { opacity: 1, duration: 0.18 });
      gsap.fromTo(card, { opacity: 0, y: 14 }, { opacity: 1, y: 0, duration: 0.28, ease: "power2.out" });
    });
    
    closeAckBtn.addEventListener('click', () => {
      gsap.to(ackModal, {
        opacity: 0,
        duration: 0.2,
        onComplete: () => {
          ackModal.style.display = 'none';
        }
      });
    });
    
    ackModal.addEventListener('click', (e) => {
      if (e.target === ackModal) {
        gsap.to(ackModal, {
          opacity: 0,
          duration: 0.2,
          onComplete: () => {
            ackModal.style.display = 'none';
          }
        });
      }
    });
  }
}