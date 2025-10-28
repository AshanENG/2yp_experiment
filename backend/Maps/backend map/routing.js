const turf = require('@turf/turf');
const pool = require('./db');

// Cache for navigation data
let cachedNodes = null;
let cachedEdges = null;
let usingFallback = false;

// Load from database or fallback to path.json
async function loadNavigationData() {
  if (cachedNodes && cachedEdges) {
    return { nodes: cachedNodes, edges: cachedEdges };
  }

  try {
    // Try to fetch from database
    const [nodesResult, edgesResult] = await Promise.all([
      pool.query('SELECT node_index, latitude, longitude FROM navigation_nodes ORDER BY node_index ASC'),
      pool.query('SELECT edge_code as id, from_node as "from", to_node as "to", path_coordinates as coords FROM navigation_edges ORDER BY edge_id ASC')
    ]);

    cachedNodes = nodesResult.rows.map(row => ({
      lat: parseFloat(row.latitude),
      lng: parseFloat(row.longitude)
    }));

    cachedEdges = edgesResult.rows.map(row => ({
      id: row.id,
      from: row.from,
      to: row.to,
      coords: row.coords
    }));

    console.log(`✅ Routing loaded from database: ${cachedNodes.length} nodes, ${cachedEdges.length} edges`);
    usingFallback = false;
  } catch (error) {
    console.warn('⚠️ Database unavailable, falling back to path.json:', error.message);
    // Fallback to hardcoded path.json
    const pathData = require('./path.json');
    cachedNodes = pathData.nodes;
    cachedEdges = pathData.edges;
    usingFallback = true;
    console.log(`📁 Routing loaded from path.json: ${cachedNodes.length} nodes, ${cachedEdges.length} edges`);
  }

  // Calculate edge lengths
  cachedEdges.forEach(e => {
    const line = turf.lineString(e.coords.map(([lat,lng]) => [lng, lat]));
    e.lengthM = turf.length(line, { units: 'meters' });
  });

  return { nodes: cachedNodes, edges: cachedEdges };
}


  // --------------------------------------------------
  // 3) Dijkstra with int indices
  // --------------------------------------------------
  function buildAdjacency(nodes, edges) {
    const adj = Array.from({length:nodes.length}, ()=>[]);
    edges.forEach(e => {
      adj[e.from].push({to:e.to, weight:e.lengthM});
      adj[e.to].push({to:e.from, weight:e.lengthM});
    });
    return adj;
  }

  function dijkstra(adj, start, goal) {
    const n = adj.length;
    const dist = new Array(n).fill(Infinity);
    const prev = new Array(n).fill(null);
    const visited = new Array(n).fill(false);

    dist[start] = 0;
    for (let count=0; count<n; count++) {
      let u=-1, best=Infinity;
      for (let i=0; i<n; i++) {
        if (!visited[i] && dist[i]<best) { best=dist[i]; u=i; }
      }
      if (u===-1) break;
      if (u===goal) break;
      visited[u]=true;

      for (const {to, weight} of adj[u]) {
        if (visited[to]) continue;
        const alt=dist[u]+weight;
        if (alt<dist[to]) { dist[to]=alt; prev[to]=u; }
      }
    }

    const path=[];
    let cur=goal;
    while (cur!==null) { path.unshift(cur); cur=prev[cur]; }
    return (path[0]===start)? path : [];
  }

  // --------------------------------------------------
  // 4) Snap to nearest edge
  // --------------------------------------------------
  function nearestPointOnEdge(lat, lng, edges, nodes) {
    const pt = turf.point([lng,lat]);
    let best=null;
    edges.forEach(e=>{
      const line=turf.lineString(e.coords.map(([lt,lg])=>[lg,lt]));
      const snap=turf.nearestPointOnLine(line, pt, {units:'meters'});
      if (!best||snap.properties.dist<best.snap.properties.dist) {
        best={edge:e,line,snap};
      }
    });

    const startPt=turf.point([nodes[best.edge.from].lng,nodes[best.edge.from].lat]);
    const endPt=turf.point([nodes[best.edge.to].lng,nodes[best.edge.to].lat]);
    const snapPt=best.snap;

    const slice1=turf.lineSlice(startPt,snapPt,best.line);
    const slice2=turf.lineSlice(snapPt,endPt,best.line);
    const d1=turf.length(slice1,{units:'meters'});
    const d2=turf.length(slice2,{units:'meters'});

    return {
      edge:best.edge,
      line:best.line,
      snapLatLng:[snapPt.geometry.coordinates[1],snapPt.geometry.coordinates[0]],
      distToStartM:d1,
      distToEndM:d2
    };
  }

  // --------------------------------------------------
  // 5) Route with a virtual node (now async)
  // --------------------------------------------------
  async function routeFromArbitraryPoint(userLatLng, destNode) {
    // Load navigation data (from DB or fallback to path.json)
    const { nodes, edges } = await loadNavigationData();
    
    const snap=nearestPointOnEdge(userLatLng[0],userLatLng[1],edges,nodes);
    const {edge,line,snapLatLng,distToStartM,distToEndM}=snap;

    const vId=nodes.length; // next index
    const tmpNodes=nodes.concat([{lat:snapLatLng[0],lng:snapLatLng[1]}]);

    const tmpEdges=edges.slice();
    tmpEdges.push({from:vId,to:edge.from,coords:[],lengthM:distToStartM});
    tmpEdges.push({from:vId,to:edge.to,  coords:[],lengthM:distToEndM});

    const adj=buildAdjacency(tmpNodes,tmpEdges);
    const path=dijkstra(adj,vId,destNode);
    if(!path.length) return null;

    const coordsOut=[];
    function appendCoords(latlngs){
      if(coordsOut.length===0){
        coordsOut.push(...latlngs);
      } else {
        const last=coordsOut[coordsOut.length-1];
        const first=latlngs[0];
        if(last[0]===first[0]&&last[1]===first[1]){
          coordsOut.push(...latlngs.slice(1));
        } else coordsOut.push(...latlngs);
      }
    }

    const nextNode=path[1];
    const snapPt=turf.point([snapLatLng[1],snapLatLng[0]]);
    const sNodePt=turf.point([nodes[edge.from].lng,nodes[edge.from].lat]);
    const eNodePt=turf.point([nodes[edge.to].lng,  nodes[edge.to].lat]);
    let firstSlice=(nextNode===edge.from)?
      turf.lineSlice(snapPt,sNodePt,line):
      turf.lineSlice(snapPt,eNodePt,line);
    appendCoords(firstSlice.geometry.coordinates.map(([lng,lat])=>[lat,lng]));

    for(let i=1;i<path.length-1;i++){
      const u=path[i],v=path[i+1];
      const e=edges.find(E=>(E.from===u&&E.to===v)||(E.from===v&&E.to===u));
      if(!e) continue;
      const poly=(e.from===u&&e.to===v)?e.coords:e.coords.slice().reverse();
      appendCoords(poly);
    }

    return {path, snappedAt:snapLatLng, routeCoords:coordsOut};
  }

//   const result=routeFromArbitraryPoint(userLatLng,dest);

  module.exports =  routeFromArbitraryPoint;