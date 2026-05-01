import { u } from "framer-motion/client";
import L from "leaflet";
import io, { Socket } from "socket.io-client";
import buildingMappings from "../../config/buildingMappings";

// ═══════════════════════════════════════════════════════════════════════════
// 🧪 TESTING CONFIGURATION - FAKE GPS LOCATION
// ═══════════════════════════════════════════════════════════════════════════
// Set USE_FAKE_LOCATION to true to use a simulated location for testing
// Set it to false to use real GPS coordinates
const USE_FAKE_LOCATION = true;

// 📍 Fake location coordinates (must be within map bounds)
// Map bounds: lat 7.252000-7.255500, lng 80.590249-80.593809
// You can adjust these coordinates to test different positions:
const FAKE_LOCATION = {lat: 7.254640,  lng: 80.591170};
  // Other test locations:
  // Engineering Library: lat: 7.253500, lng: 80.591800
  // Department of Computer Engineering: lat: 7.254200, lng: 80.591500
  // Faculty Canteen: lat: 7.253200, lng: 80.592800
// ═══════════════════════════════════════════════════════════════════════════

let map, socket;
const API = 'http://localhost:3001'; // Maps backend server port

let userPosition;
let userMarkerLayer;
function setUserPosition(latLng) {
  // Only update if position actually changed
  if (userPosition && userPosition[0] === latLng[0] && userPosition[1] === latLng[1]) {
    // Position hasn't changed, don't trigger listeners
    return;
  }
  
  userPosition = latLng
  console.log(`user position set to: ${userPosition[0]}, ${userPosition[1]}`)
  gpsListners.forEach((listener) => listener(userPosition))
}

function getUserPosition() {
  console.log(`user position served: ${userPosition[0]}, ${userPosition[1]}`)
  return userPosition;
}

let prevBuildingId = null;

function buildingClick(id) {
  console.log("Building clicked:", id);
  highlightSelectedBuilding(id);
  if (buildingClickListner.length === 0) {
    console.warn("No building click listeners registered.");
    return
  }
  buildingClickListner.forEach(fn => fn(id));
}

function highlightSelectedBuilding(bid) {
  if (prevBuildingId) {  // Remove highlight from previously selected building
    setBuildingAccent(prevBuildingId, "assigned"); 
  } // Reset to normal
  prevBuildingId = bid; // Store current selection
  setBuildingAccent(bid, "clicked"); // Apply highlight
}


window.buildingClick = buildingClick;

function initWebSocket() {
  socket = io(API);
  socket.on('connection')
}

function initMap(map_div) {
  const southWest = L.latLng(7.252000, 80.590249);
  const northEast = L.latLng(7.255500, 80.593809);
  const bounds = L.latLngBounds(southWest, northEast);

  const MsouthWest = L.latLng(7.251000, 80.589249);
  const MnorthEast = L.latLng(7.256500, 80.594809);
  const mapB = L.latLngBounds(MsouthWest, MnorthEast);

  map = L.map(map_div, {
    maxZoom: 22,
    minZoom: 17,
    maxBounds: mapB,
    maxBoundsViscosity: 0.5,
    zoomControl: false,
  }).setView([7.253750, 80.592028], 18);

  map.on("zoomend", function () {
    const zoomLevel = map.getZoom();
    console.log("Current zoom level:", zoomLevel);
  
    // Example: show/hide labels depending on zoom
    if (zoomLevel <= 18) {
      const icons = document.querySelector(`#_x3C_icons_x3E_`);
      if (icons) {
        icons.classList.remove("st5"); // remove previous accent classes
        icons.classList.add("st6");
      }

      const b_name = document.querySelector(`#_x3C_building_name_big_x3E_`);
      if (b_name) {
        b_name.classList.remove("st6"); // remove previous accent classes
        b_name.classList.add("st5");
      }

      const s_name = document.querySelector(`#_x3C_building_name_small_x3E_`);
      if (s_name) {
        s_name.classList.remove("st6"); // remove previous accent classes
        s_name.classList.add("st5");
      }

    } else if (zoomLevel <= 19) {
      const icons = document.querySelector(`#_x3C_icons_x3E_`);
      if (icons) {
        icons.classList.remove("st6"); // remove previous accent classes
        icons.classList.add("st5");
      }

      const b_name = document.querySelector(`#_x3C_building_name_big_x3E_`);
      if (b_name) {
        b_name.classList.remove("st5"); // remove previous accent classes
        b_name.classList.add("st6");
      }

      const s_name = document.querySelector(`#_x3C_building_name_small_x3E_`);
      if (s_name) {
        s_name.classList.remove("st6"); // remove previous accent classes
        s_name.classList.add("st5");
      }
    } else {
      const icons = document.querySelector(`#_x3C_icons_x3E_`);
      if (icons) {
        icons.classList.remove("st6"); // remove previous accent classes
        icons.classList.add("st5");
      }

      const b_name = document.querySelector(`#_x3C_building_name_big_x3E_`);
      if (b_name) {
        b_name.classList.remove("st5"); // remove previous accent classes
        b_name.classList.add("st6");
      }

      const s_name = document.querySelector(`#_x3C_building_name_small_x3E_`);
      if (s_name) {
        s_name.classList.remove("st5"); // remove previous accent classes
        s_name.classList.add("st6");
      }
    }
  });

  // Create custom panes
  map.createPane('routePane');
  map.getPane('routePane').style.zIndex = 650;

  userMarkerLayer = L.layerGroup().addTo(map);

  // Add map background click handler to deselect buildings
  map.on('click', function(e) {
    // Check if the click target is the map background (not a building)
    const clickedElement = e.originalEvent.target;
    
    // If clicked on background (not an SVG building element with ID starting with 'b')
    if (!clickedElement.id || !clickedElement.id.startsWith('b')) {
      console.log("Map background clicked - deselecting building");
      
      // Clear building highlight - set back to "assigned" (normal clickable state)
      if (prevBuildingId) {
        setBuildingAccent(prevBuildingId, "assigned");
        prevBuildingId = null;
      }
      
      // Notify listeners (MapExtra) to close sheet and stop navigation
      mapBackgroundClickListeners.forEach(fn => fn());
    }
  });

  // Load SVG overlay
  fetch(`${API}/map`)
    .then(res => res.text())
    .then(svgText => {
      const parser = new DOMParser();
      const svgDoc = parser.parseFromString(svgText, "image/svg+xml");
      const svgElement = svgDoc.documentElement;
      L.svgOverlay(svgElement, bounds).addTo(map);      
    
    })
    .catch(err => console.error('Error loading SVG:', err));

  map.fitBounds(mapB);

  initWebSocket();

}

async function buildingToNode(id) {
  return await buildingMappings.mapSvgIdToNodeId(id);
}

// Store route layers for proper cleanup
let routeLayers = [];

function clearRoute() {
  console.log("Clearing all route layers...");
  
  // Clear all previous route layers properly
  routeLayers.forEach(layer => {
    try {
      if (map.hasLayer(layer)) {
        map.removeLayer(layer);
      }
    } catch (e) {
      console.warn("Error removing layer:", e);
    }
  });
  routeLayers = [];

  // Also clear the pane as fallback
  const routePane = map.getPane('routePane');
  if (routePane) {
    routePane.querySelectorAll('path, circle, polygon').forEach(el => {
      try {
        el.remove();
      } catch (e) {
        console.warn("Error removing element:", e);
      }
    });
  }
}

function drawRoute(result) {

  console.log("drawRoute called with:", result);

  // Always clear previous routes first
  clearRoute();

  if (result) {
    // Create and store route layers for proper cleanup later
    const snappedMarker = L.circleMarker(result.snappedAt, { 
      radius: 8, 
      color: 'orange', 
      pane: 'routePane' 
    }).addTo(map).bindTooltip('Snapped');
    
    const routeLine = L.polyline(result.routeCoords, { 
      color: '#254E6A', 
      weight: 5, 
      pane: 'routePane' 
    }).addTo(map);
    
    const endMarker = L.circleMarker(result.routeCoords.at(-1), { 
      radius: 7, 
      color: '#254E6A', 
      pane: 'routePane' 
    }).addTo(map).bindTooltip('end');

    // Store layers for cleanup
    routeLayers = [snappedMarker, routeLine, endMarker];
    
    //map.fitBounds(result.routeCoords);
    
    setTimeout(() => {
      map.invalidateSize(); 
    }, 50);

    // Disabled auto-centering to allow free panning
    // if (result.snappedAt) {
    //   setTimeout(() => {
    //     focus(result.snappedAt); 
    //   }, 700);
    // }
  } else {
    // Just clear, no new route to draw
    console.log("No result provided, route cleared");
  }

}

let userMarker = null;

function drawMarker(latLng) {
  if(userMarker){
    userMarker.remove();
    userMarker = null;
  }
  if(latLng){
    const svgIcon = L.divIcon({
      html: `
        <svg xmlns="http://www.w3.org/2000/svg" width="32" height="32" viewBox="0 0 18 32">
          <path fill="#264f6b" d="M15.85,14.46,8.9,23.14,2,14.46a8.9,8.9,0,1,1,13.9,0Z"/>
          <circle fill="#faf9f4" cx="8.9" cy="8.9" r="3.75"/>
        </svg>
      `,
      className: "custom-svg-marker",        // prevents Leaflet default styles
      iconSize: [32, 32],   // fixed size (doesn't scale with zoom)
      iconAnchor: [16, 32], // bottom center = marker tip
    });
    
    // Add marker
    userMarker = L.marker(latLng, { icon: svgIcon }).addTo(userMarkerLayer).bindTooltip('You are here');
    
  }
}

function setBuildingAccent(buildingId ,accent) {
  let cls = "";
  switch(accent) {
    case "unassigned":
      cls = "st1"; // Default style
      break;
    case "assigned":
      cls = "st13"; // Normal building style
      break;
    case "clicked":
      cls = "st0"; // HIGHLIGHTED style (selected)
      break;
    default:
      console.warn(`Unknown accent type: ${accent}`);
      return;
  }
  const building = document.querySelector(`#${buildingId}`);
if (building) {
  building.classList.remove("st1", "st13", "st0");  // Remove all previuos accent classes
  building.classList.add(cls); // Add new class
} else {
  console.warn("Building not found:", buildingId);
}

}



let buildingClickListner = [];

// Add a listener and return a function to remove it
function addBuildingClickListner(listener) {
  buildingClickListner.push(listener);
  console.log("Added building click listener. Total:", buildingClickListner.length);

  // Return an "unsubscribe" function
  return () => {
    removeBuildingClickListner(listener);
  };
}

function removeBuildingClickListner(listener) {
  const index = buildingClickListner.indexOf(listener);
  if (index !== -1) {
    buildingClickListner.splice(index, 1);
  }
}

let mapBackgroundClickListeners = [];

// Add a listener for map background clicks (deselect events)
function addMapBackgroundClickListener(listener) {
  mapBackgroundClickListeners.push(listener);
  console.log("Added map background click listener. Total:", mapBackgroundClickListeners.length);

  // Return an "unsubscribe" function
  return () => {
    const index = mapBackgroundClickListeners.indexOf(listener);
    if (index !== -1) {
      mapBackgroundClickListeners.splice(index, 1);
    }
  };
}

let gpsListners = [];
function addGpsListner(listener) {
  gpsListners.push(listener);
  return () => {
    removeGpsListner(listener);
  };
}

function removeGpsListner(listener) {
  const index = buildingClickListner.indexOf(listener);
  if (index !== -1) {
    buildingClickListner.splice(index, 1);
  }
}

let watchId;
function startGPS() {
  if (USE_FAKE_LOCATION) {
    // 🧪 Use fake location for testing
    console.log(`🧪 Using fake GPS location: ${FAKE_LOCATION.lat}, ${FAKE_LOCATION.lng}`);
    setUserPosition([FAKE_LOCATION.lat, FAKE_LOCATION.lng]);
    
    // Update every few seconds to simulate movement
    watchId = setInterval(() => {
      console.log(`🧪 Fake GPS update: ${FAKE_LOCATION.lat}, ${FAKE_LOCATION.lng}`);
      setUserPosition([FAKE_LOCATION.lat, FAKE_LOCATION.lng]);
    }, 2000);
  } else if (navigator.geolocation) {
    // 📡 Watch real position continuously
    watchId = navigator.geolocation.watchPosition(
      (position) => {
        const lat = position.coords.latitude;
        const lng = position.coords.longitude;
        console.log(`📡 Updated location: ${lat}, ${lng}`);
        setUserPosition([lat, lng]); // update state -> rerender
      },
      (error) => {
        console.error('GPS error:', error);
        // fallback
        console.warn('⚠️ GPS failed, using fallback location');
        setUserPosition([7.252310, 80.592530]);
      },
      {
        enableHighAccuracy: true,  // better accuracy
        maximumAge: 0,             // don't use cached
        timeout: 5000              // fail after 5s
      }
    );
  } else {
    console.warn('⚠️ Geolocation not supported, using default location');
    setUserPosition([7.252310, 80.592530]);
  }
}

function sendMessage(type, data) {
  socket.emit(type, data);
}

function addMessageListner(type, listner) {
  socket.on(type, listner);
  return () => {
    socket.off(type, listner); // cleanup on unmount
    console.log(`Removed message listener for type: ${type}`);
  };
}

function stopGps() {
  if (USE_FAKE_LOCATION) {
    // Clear interval for fake location
    clearInterval(watchId);
    console.log("🧪 Fake GPS tracking stopped.");
  } else {
    // Clear real GPS watch
    navigator.geolocation.clearWatch(watchId);
    console.log("📡 GPS tracking stopped.");
  }
}

function focus(latLng) {
  map.setView(latLng, map.getZoom(), { animate: true, duration: 1.0 });
  
}

export {
  map, 
  initMap, 
  setUserPosition, 
  getUserPosition, 
  buildingToNode, 
  drawRoute,
  clearRoute,
  addBuildingClickListner,
  addMapBackgroundClickListener,
  addGpsListner, 
  startGPS, 
  stopGps, 
  drawMarker, 
  addMessageListner, 
  sendMessage,
  setBuildingAccent,
  focus,
  highlightSelectedBuilding
};





