// Survey calculation functions for API usage
function parseFloatSafe(s) {
  const f = parseFloat(s);
  if (isNaN(f)) throw new Error('Invalid input');
  return f;
}

// ---------- Bearings/Azimuth ----------
// Bearings are like N45°E, S10°W, etc.
// Azimuth is 0-360 from North, clockwise, in degrees

function bearingToAzimuth(bearing) {
  // Expects e.g. "N45.5E" or "S10W"
  bearing = bearing.trim().toUpperCase();
  let degPart = bearing.replace(/[NSEW]/g, '').replace('°', '');
  let deg = parseFloat(degPart);

  if (/^N.*E$/.test(bearing)) return deg;
  if (/^S.*E$/.test(bearing)) return 180 - deg;
  if (/^S.*W$/.test(bearing)) return 180 + deg;
  if (/^N.*W$/.test(bearing)) return 360 - deg;
  throw new Error('Invalid bearing');
}
function azimuthToBearing(az) {
  az = az % 360;
  if (az < 0) az += 360;
  let quad, deg;
  if (az >= 0 && az < 90) { quad = "N"; deg = az; return `N${deg.toFixed(2)}°E`; }
  if (az >= 90 && az < 180) { quad = "S"; deg = 180 - az; return `S${deg.toFixed(2)}°E`; }
  if (az >= 180 && az < 270) { quad = "S"; deg = az - 180; return `S${deg.toFixed(2)}°W`; }
  if (az >= 270 && az < 360) { quad = "N"; deg = 360 - az; return `N${deg.toFixed(2)}°W`; }
  return 'Invalid';
}
// ---------------------------------------

// Calculate dN/dE given bearing/azimuth and distance
function bearingDistanceToDelta(bearing, dist) {
  let az = typeof bearing === 'number' ? bearing : bearingToAzimuth(bearing);
  let azRad = az * Math.PI / 180;
  let dE = dist * Math.sin(azRad);
  let dN = dist * Math.cos(azRad);
  return { dN, dE };
}

// Calculate Coordinates from Start, Bearing, Distance
function calculateCoordinates(inputs) {
  // inputs: [{bearing, distance}], startX, startY
  let { startX, startY, legs } = inputs;
  let pts = [{ x: startX, y: startY }];
  let curX = startX, curY = startY;
  for (let leg of legs) {
    const { dN, dE } = bearingDistanceToDelta(leg.bearing, leg.distance);
    curX += dE;
    curY += dN;
    pts.push({ x: curX, y: curY });
  }
  return pts;
}

// From coordinates, calculate bearings and distances
function coordinatesToBearingDistance(points) {
  // points: [{x, y}]
  let legs = [];
  for (let i = 1; i < points.length; ++i) {
    let dx = points[i].x - points[i - 1].x;
    let dy = points[i].y - points[i - 1].y;
    let dist = Math.sqrt(dx * dx + dy * dy);
    let az = (Math.atan2(dx, dy) * 180 / Math.PI + 360) % 360;
    let bearing = azimuthToBearing(az);
    legs.push({ from: i - 1, to: i, distance: dist, azimuth: az, bearing });
  }
  return legs;
}

// Traverse Closure and Error
function traverseClosure(points) {
  // points: [{x, y}]
  let misclose_x = points[points.length - 1].x - points[0].x;
  let misclose_y = points[points.length - 1].y - points[0].y;
  let misclose = Math.sqrt(misclose_x ** 2 + misclose_y ** 2);
  let perpError = misclose;
  let closurePct = (misclose /
    points.slice(1).reduce((sum, p, idx) => {
      let dx = p.x - points[idx].x;
      let dy = p.y - points[idx].y;
      return sum + Math.sqrt(dx * dx + dy * dy);
    }, 0)) * 100;
  return {
    misclose_x, misclose_y, misclose,
    closurePct
  }
}

// Compass Rule Adjustment
function compassRule(points) {
  // Adjusts coordinates so that closure error is distributed
  let n = points.length - 1;
  let sumDx = points[points.length - 1].x - points[0].x;
  let sumDy = points[points.length - 1].y - points[0].y;
  let L = [];
  let totalLen = 0;
  for(let i=1;i<points.length;++i){
    let dx = points[i].x - points[i-1].x;
    let dy = points[i].y - points[i-1].y;
    let len = Math.sqrt(dx*dx + dy*dy);
    L.push(len); totalLen += len;
  }
  let adjPts = [{...points[0]}];
  let sumLatErr = -sumDy;
  let sumDepErr = -sumDx;
  let adjX = points[0].x, adjY = points[0].y;
  for(let i=1;i<points.length;++i){
    let dX = points[i].x - points[i-1].x;
    let dY = points[i].y - points[i-1].y;
    let len = L[i-1];
    let dLatErr = sumLatErr * len / totalLen;
    let dDepErr = sumDepErr * len / totalLen;
    adjX += dX + dDepErr;
    adjY += dY + dLatErr;
    adjPts.push({x: adjX, y: adjY});
  }
  return adjPts;
}

// Traverse Area by coordinate method (Shoelace)
function traverseArea(points) {
  let area = 0;
  for (let i = 0; i < points.length - 1; ++i) {
    area += points[i].x * points[i + 1].y - points[i + 1].x * points[i].y;
  }
  area = Math.abs(area) / 2;
  return area;
}


module.exports = {
  bearingToAzimuth, azimuthToBearing,
  bearingDistanceToDelta, calculateCoordinates,
  coordinatesToBearingDistance,
  traverseClosure, compassRule, traverseArea
};
