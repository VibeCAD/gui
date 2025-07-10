# Floor Snapping & Wall Collision Test Procedure

## Test Setup
1. Start the application
2. Create a custom room with the following features:
   - Draw a square or rectangular room
   - Add at least one interior wall
   - Name it "Test Room"

## Test 1: Floor Snapping
**Expected behavior:** Objects snap to floor when entering room

1. Create a cube (Create → Primitives → Cube)
2. Position it above the room
3. Drag it down into the room
4. **VERIFY:** 
   - Cube snaps to floor immediately when entering room bounds
   - Bottom of cube sits exactly on floor (no gap, no clipping)
   - Console shows: "🔒 Object is now floor-locked in room"

## Test 2: Floor Movement Constraint
**Expected behavior:** Floor-locked objects can only move horizontally

1. With cube floor-locked in room
2. Try to drag it upward (Y-axis)
3. **VERIFY:**
   - Cube stays on floor, cannot be lifted
   - Can still move freely in X and Z directions
   - Cube slides along floor surface

## Test 3: Wall Collision - Exterior Walls
**Expected behavior:** Objects cannot pass through walls

1. With cube on floor
2. Drag it toward an exterior wall
3. **VERIFY:**
   - Cube stops when its edge touches the wall
   - Cannot push cube through wall
   - Can slide along wall edge

## Test 4: Wall Collision - Interior Walls
**Expected behavior:** Interior walls also block movement

1. Position cube near interior wall
2. Try to drag through interior wall
3. **VERIFY:**
   - Same behavior as exterior walls
   - Movement blocked at wall boundary

## Test 5: Different Object Shapes
**Expected behavior:** All shapes work correctly

1. Test with:
   - Sphere: Should rest on floor at lowest point
   - Cylinder: Should stand upright on floor
   - Torus: Should rest on floor at lowest point
2. **VERIFY:** Each shape:
   - Snaps correctly to floor
   - Cannot pass through walls
   - No clipping issues

## Test 6: Unlocking Behavior
**Expected behavior:** Objects unlock when leaving room

1. Drag floor-locked object outside room bounds
2. **VERIFY:**
   - Console shows: "🔓 Object is no longer floor-locked"
   - Can now move object vertically again
   - Object behaves normally outside room

## Test 7: Edge Cases

### 7.1 Large Objects
1. Scale a cube to be larger than room opening
2. Try to move it into room
3. **VERIFY:** Movement blocked at doorway

### 7.2 Multiple Rooms
1. Create two adjacent rooms
2. Move object from one room to another
3. **VERIFY:** 
   - Unlocks when leaving first room
   - Re-locks when entering second room
   - Respects each room's floor height

### 7.3 Partial Entry
1. Position object partially in room
2. **VERIFY:**
   - Only locks when center enters room
   - Smooth transition

## Common Issues & Solutions

### Issue: Object clips through floor
- **Cause:** Bounding box calculation error
- **Fix:** Implemented proper bounding box detection

### Issue: Object passes through walls
- **Cause:** Vertex-only collision detection
- **Fix:** Now uses full bounding box collision

### Issue: Object jumps when entering room
- **Cause:** Incorrect floor height calculation
- **Fix:** Smooth snapping to exact floor level

## Performance Notes
- Collision detection runs during drag operations only
- Bounding box calculations are cached when possible
- Smooth 60+ FPS maintained during interactions 