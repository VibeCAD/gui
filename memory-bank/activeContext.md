# Active Context - AI Room Integration

## 🎯 NEW APPROACH: Following Align Function Pattern

After analyzing the `align` function, I've identified why room floor positioning isn't working and have a better solution.

## 🔍 **Align Function Analysis**

### How Align Works:
1. **AI Service Role**: Simply generates align commands, no position calculations
2. **Scene Manager Role**: Handles actual positioning using mesh data
3. **Command Structure**: `{action: 'align', objectId: 'obj', relativeToObject: 'ref', edge: 'north'}`
4. **Key Success Factors**:
   - **Separation of concerns**: AI generates, Scene Manager executes
   - **Reliable positioning**: Scene Manager has access to actual mesh bounding boxes
   - **No manual coordinates**: No complex Y-positioning calculations

### Why Our Current Approach Fails:
- ❌ **Complex positioning logic in AI service** instead of Scene Manager
- ❌ **Manual Y-coordinate calculations** without access to actual mesh data
- ❌ **Trying to calculate room floor positions** before objects exist
- ❌ **Missing integration** with Scene Manager's positioning systems

## 🚀 **New Solution: 'place-on-floor' Action**

### **Proposed Command Structure:**
```typescript
{
  action: 'place-on-floor',
  objectId: 'cube-123',
  relativeToObject: 'bedroom-room',
  snapToGrid: true
}
```

### **Implementation Plan:**

#### Task 11: Create 'place-on-floor' Action
- Add `'place-on-floor'` to `SceneCommand` action type
- Add `snapToGrid?: boolean` property
- Similar to align but for floor positioning

#### Task 12: Update AI Service Commands
- Generate `place-on-floor` commands for room placement
- Remove complex positioning logic from AI service
- Let Scene Manager handle actual positioning

#### Task 13: Scene Manager Integration
- Implement `place-on-floor` execution in Scene Manager
- Use actual mesh bounding boxes for precise positioning
- Integrate with existing grid snapping utilities

### **Updated Room Command Flow:**
1. **User**: "put a cube in the bedroom"
2. **AI Service**: `[{action: 'create', type: 'cube'}, {action: 'place-on-floor', objectId: 'cube-123', relativeToObject: 'bedroom'}]`
3. **Scene Manager**: 
   - Creates cube at default position
   - Executes `place-on-floor` with access to actual mesh data
   - Positions cube flush with room floor using bounding boxes
   - Applies grid snapping with room's grid info

### **Benefits of This Approach:**
- ✅ **Follows proven align pattern** 
- ✅ **Reliable positioning** using actual mesh data
- ✅ **Separation of concerns** - AI generates, Scene Manager executes
- ✅ **Grid snapping integration** handled by Scene Manager
- ✅ **No complex coordinate calculations** in AI service

## 📋 **Next Steps:**
1. Implement `place-on-floor` action type
2. Update AI service to generate place-on-floor commands
3. Implement Scene Manager execution logic
4. Test with actual room scenarios

This approach mirrors the successful align function pattern and should resolve the floor positioning issues by letting the Scene Manager handle the actual positioning with access to real mesh data. 