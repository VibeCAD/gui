# Floor Snapping and Wall Collision Guide

## Overview
This feature ensures that objects placed within custom rooms behave realistically:
- Objects automatically snap to the floor when they enter a room
- Once floor-locked, objects can only move along the floor (no vertical movement)
- Objects cannot pass through walls
- Objects cannot clip through the floor

## How It Works

### Floor Locking
When an object enters a custom room and has any vertex below the top of the walls (2 units high):
1. The object becomes "floor-locked" 🔒
2. It automatically snaps down so its lowest point rests on the floor
3. Vertical movement (Y-axis) is disabled

### Movement Constraints
While floor-locked:
- Objects can only move horizontally (X and Z axes)
- Movement stops when any vertex would touch a wall
- The object maintains contact with the floor at all times

### Unlocking
Objects become unlocked when:
- They are moved completely outside the room boundaries
- They are lifted above the wall height (only possible from outside)

## Testing the Feature

1. **Create a Custom Room**
   - Click Create → Custom → Custom Room
   - Draw a room shape with walls

2. **Add an Object**
   - Add any primitive (cube, sphere, etc.)
   - Place it above the room

3. **Test Floor Snapping**
   - Drag the object into the room
   - Watch it snap to the floor when it enters
   - Notice the console message: "🔒 Object is now floor-locked"

4. **Test Wall Collision**
   - Try dragging the object into a wall
   - Movement will stop at the wall boundary
   - Console shows: "🚫 Movement blocked by wall"

5. **Test Unlocking**
   - Drag the object outside the room
   - It becomes unlocked: "🔓 Object is no longer floor-locked"
   - You can now move it vertically again

## Technical Details

### Room Detection
- Uses bounding box intersection to detect when objects enter rooms
- Checks object position against room boundaries in real-time

### Vertex-Based Collision
- Calculates all mesh vertices in world space
- Checks each vertex against wall boundaries
- Prevents any vertex from penetrating walls

### Floor Height Calculation
- Dynamically finds the floor mesh of each room
- Calculates the exact floor height
- Snaps objects to maintain contact with floor surface

### Grid Snapping Integration
- Room-specific grid snapping still works
- Objects snap to the room's grid while maintaining floor lock
- Grid size is preserved from room creation 