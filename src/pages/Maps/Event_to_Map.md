┌─────────────────────────────────────────────────────────────┐
│ EVENT CARD (EventsScreen.jsx) │
│ User clicks location icon 📍 │
│ ↓ │
│ navigate('/map?location=Engineering Faculty') │
└─────────────────────────────────────────────────────────────┘
↓
┌─────────────────────────────────────────────────────────────┐
│ MAP PAGE LOADS (MapExtra.jsx) │
│ useEffect reads URL parameter │
│ ↓ │
│ location = "Engineering Faculty" │
└─────────────────────────────────────────────────────────────┘
↓
┌─────────────────────────────────────────────────────────────┐
│ MAPPING LOOKUP (buildingMappings.js) │
│ NAME_TO_SVG["Engineering Faculty"] │
│ ↓ │
│ Returns: "pth_eng" (SVG element ID) │
└─────────────────────────────────────────────────────────────┘
↓
┌─────────────────────────────────────────────────────────────┐
│ HIGHLIGHT FUNCTION (map_module.js) │
│ highlightSelectedBuilding("pth_eng") │
│ ↓ │
│ Calls: setBuildingAccent("pth_eng", "clicked") │
└─────────────────────────────────────────────────────────────┘
↓
┌─────────────────────────────────────────────────────────────┐
│ DOM MANIPULATION (map_module.js) │
│ document.querySelector("#pth_eng") │
│ ↓ │
│ Remove classes: st1, st13, st0 │
│ Add class: st0 (highlighted state) │
└─────────────────────────────────────────────────────────────┘
↓
┌─────────────────────────────────────────────────────────────┐
│ VISUAL RESULT 🎨 │
│ Building appears highlighted on the map │
│ Info sheet opens showing building details │
│ URL parameter is cleared from browser │
└─────────────────────────────────────────────────────────────┘
