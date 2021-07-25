import { log } from "./module.js";

/*
 * Generator to iterate grid points under a line.
 * This version handles lines in 3d.
 *   It assumes elevation movement by the set grid distance. 
 * @param {x: Number, y: Number, z: Number} origin Origination point
 * @param {x: Number, y: Number, z: Number} destination Destination point
 * @return Iterator, which in turn 
 *   returns [row, col, elevation] for each grid point under the line.
 */
export function * iterateGridUnder3dLine(generator, origin, destination) {  
  let prior_elevation = origin.z || 0;
  const end_elevation = destination.z || 0;
  const direction = prior_elevation <= end_elevation ? 1 : -1;
  const elevation_increment = canvas.scene.data.gridDistance * canvas.scene.data.grid;
  log(`elevation: ${prior_elevation}[prior], ${end_elevation}[end], ${direction}[direction], ${elevation_increment}[increment]`);
  //log(generator);
  let last_row, last_col;  

  for(const res of generator) {
    // step down in elevation if necessary
    log(res);
    //const {value, done} = res;
    const [row, col] = res;
    [last_row, last_col] = res;
    
    if(prior_elevation != end_elevation) {
      const remainder = Math.abs(prior_elevation - end_elevation);
      const step_elevation = Math.min(remainder, elevation_increment);
      prior_elevation += step_elevation * direction;
      
    }
    yield [row, col, prior_elevation];
  }
  
  // more elevation? increment straight down.
  const MAX_ITERATIONS = 1000; // to avoid infinite loops
  let iteration = 0;
  while(prior_elevation != end_elevation && iteration < MAX_ITERATIONS) {
    iteration += 1;
    const remainder = Math.abs(prior_elevation - end_elevation);
    const step_elevation = Math.min(remainder, elevation_increment);
    log(`elevation: ${prior_elevation}[prior], ${end_elevation}[end], ${step_elevation}[step]`);
    prior_elevation += step_elevation * direction;
    
    yield [last_row, last_col, prior_elevation];
  } 
}

// needed for libWrapper
export function iterateGridUnder3dLine_wrapper(wrapped, origin, destination) {
  log(`iterateGrid origin, destination`, origin, destination);
  return iterateGridUnder3dLine(wrapped(origin, destination), origin, destination);
}

 /*
  * Calculate a new point by projecting the elevated point back onto the 2-D surface
  * If the movement on the plane is represented by moving from point A to point B,
  *   and you also move 'height' distance orthogonal to the plane, the distance is the
  *   hypotenuse of the triangle formed by A, B, and C, where C is orthogonal to B.
  *   Project by rotating the vertical triangle 90º, then calculate the new point C. 
  * For gridded maps, project A such that A <-> projected_A is straight on the grid.
  * @param {{x: number, y: number, z: number}} A
  * @param {{x: number, y: number, z: number}} B
  
  */
export function projectElevatedPoint(A, B) {
  if(window.libRuler.RulerUtilities.pointsAlmostEqual(A, B)) return {A: A, B: B};
  if(B.z === undefined || B.z === NaN) B.z = A.z;
  if(A.z === undefined || A.z === NaN) A.z = B.z;
  if(A.z === B.z) return {A: A, B: B};

  switch(canvas.grid.type) {
    case CONST.GRID_TYPES.GRIDLESS: return projectGridless(A, B);
    case CONST.GRID_TYPES.SQUARE: return projectSquareGrid(A, B);
    case CONST.GRID_TYPES.HEXODDR: 
    case CONST.GRID_TYPES.HEXEVENR: return projectEast(A, B); 
    case CONST.GRID_TYPES.HEXODDQ:
    case CONST.GRID_TYPES.HEXEVENQ: return projectSouth(A, B);
  }
  
  // catch-all 
  return projectGridless(A, B);
}

 /*
  * Project A and B in a square grid. 
  * move A vertically or horizontally by the total height different
  * If the points are already on a line, don't change B.
  * So if B is to the west or east, set A to the south.
  * Otherwise, set A to the east and B to the south.
  * Represents the 90º rotation of the right triangle from height
  */
projectSquareGrid(A, B) {
  // if the points are already on a line, don't change B.
  // Otherwise, set A to the east and B to the south
  // Represents the 90º rotation of the right triangle from height
  const height = Math.abs(A.z - B.z);
  let projected_A, projected_B;
    
  if(almostEqual(A.x, B.x)) {
    // points are on vertical line
    // set A to the east
    // B is either north or south from A
    // (quicker than calling projectEast b/c no distance calc req'd)
    projected_A = {x: A.x + height, y: A.y}; // east
    projected_B = B;
  } else if(almostEqual(A.y, B.y)) {
    // points are on horizontal line
    // B is either west or east from A
    // set A to the south
    // (quicker than calling projectSouth b/c no distance calc req'd)
    projected_A = {x: A.x, y: A.y + height}; // south
    projected_B = B;
  } else {
    // set B to point south, A pointing east
    { projected_A, projected_B } = projectEast(A, B, height);
  }
  
  log(`Projecting Square: A: (${A.x}, ${A.y}, ${A.z})->(${projected_A.x}, ${projected_A.y}); B: (${B.x}, ${B.y}, ${B.z})->(${projected_B.x}, ${projected_B.y})`);
  
  return {A: projected_A, B: projected_B};
}

function projectSouth(A, B, height, distance) {
  if(height === undefined) height = A.z - B.z;
    
  if(distance === undefined) distance = window.libRuler.RulerUtilities.calculateDistance({x: A.x, y: A.y}, 
                                                                {x: B.x, y: B.y}); 
                                                                
  // set A pointing south; B pointing west
  projected_A = {x: A.x, y: A.y + height};
  projected_B = {x: A.x - distance, y: A.y};    
  
  log(`Projecting South: A: (${A.x}, ${A.y}, ${A.z})->(${projected_A.x}, ${projected_A.y}); B: (${B.x}, ${B.y}, ${B.z})->(${projected_B.x}, ${projected_B.y})`);
                                                           
  
  return {A: projected_A, B: projected_B};
}

function projectEast(A, B, height, distance) {
  if(height === undefined) height = A.z - B.z;
  if(distance === undefined) distance = window.libRuler.RulerUtilities.calculateDistance({x: A.x, y: A.y}, 
                                                                {x: B.x, y: B.y}); 
                                                                
  // set A pointing east; B pointing south
  projected_A = {x: A.x + height, y: A.y};
  projected_B = {x: A.x, y: A.y + distance};   
  
  log(`Projecting East: A: (${A.x}, ${A.y}, ${A.z})->(${projected_A.x}, ${projected_A.y}); B: (${B.x}, ${B.y}, ${B.z})->(${projected_B.x}, ${projected_B.y})`);
                                                            
  
  return {A: projected_A, B: projected_B};
}


/**
 * Calculate a new point by projecting the elevated point back onto the 2-D surface
 * If the movement on the plane is represented by moving from point A to point B,
 *   and you also move 'height' distance orthogonal to the plane, the distance is the
 *   hypotenuse of the triangle formed by A, B, and C, where C is orthogonal to B.
 *   Project by rotating the vertical triangle 90º, then calculate the new point C. 
 *
 * Cx = { height * (By - Ay) / dist(A to B) } + Bx
 * Cy = { height * (Bx - Ax) / dist(A to B) } + By
 * @param {{x: number, y: number}} A
 * @param {{x: number, y: number}} B
 */
export function projectGridless(A, B, height, distance) {
  if(height === undefined) height = A.z - B.z;
  if(distance === undefined) distance = window.libRuler.RulerUtilities.calculateDistance({x: A.x, y: A.y}, 
                                                                {x: B.x, y: B.y}); 

  const projected_x = A.x + ((height / distance) * (B.y - A.y));
  const projected_y = A.y - ((height / distance) * (B.x - A.x));
  
  log(`Projecting Gridless: A: (${A.x}, ${A.y}, ${A.z})->(${projected_A.x}, ${projected_A.y}); B: (${B.x}, ${B.y}, ${B.z})->(${projected_B.x}, ${projected_B.y})`);
  

  return { A: { x: projected_x, y: projected_y },
           B: { x: B.x, y: B.y };
}

 /*
  * Calculate the distance between two points in {x,y,z} dimensions.
  * @param {PIXI.Point} A   Point in {x, y, z} format.
  * @param {PIXI.Point} B   Point in {x, y, z} format.
  * @return The distance between the two points.
  */
export function calculate3dDistance(wrapped, A, B, EPSILON = 1e-6) {
  if(A.z === undefined) A.z = 0;
  if(B.z === undefined) B.z = 0;
  
  const dz = Math.abs(B.z - A.z);  
  if(dz < EPSILON) { return wrapped(A, B, EPSILON); }
  
  const dy = Math.abs(B.y - A.y);
  if(dy < EPSILON) { return wrapped({x: A.x, y: A.z}, {x: B.x, y: B.z}, EPSILON); }
    
  const dx = Math.abs(B.x - A.x);
  if(dx < EPSILON) { return wrapped({x: A.z, y: A.y}, {x: B.z, y: B.y}, EPSILON); }
  
  return Math.hypot(dz, dy, dx);
}


 /*
  * Test if two points are almost equal, given a small error window.
  * @param {PIXI.Point} p1  Point in {x, y, z} format. z optional
  * @param {PIXI.Point} p2  Point in {x, y, z} format. 
  * @return {Boolean} True if the points are within the error of each other 
  */
export function points3dAlmostEqual(wrapped, p1, p2, EPSILON = 1e-6) {
  const 2d_equal = wrapped(p1, p2, EPSILON);
  if(!2d_equal) return false;
  
  if(p1.z === undefined || 
     p2.z === undefined || 
     p1.z === NaN || 
     p2.z === NaN) return true;
  
  return window.libRuler.RulerUtilities.almostEqual(p1.z, p2.z, EPSILON);
}

