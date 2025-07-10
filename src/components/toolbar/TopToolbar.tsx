import { useSceneStore } from '../../state/sceneStore'
import { Vector3 } from 'babylonjs'
import type { ParametricWallParams, SceneObject } from '../../types/types'

  const createParametricWall = () => {
    const { addObject, addParametricWall, setSelectedObjectId, sceneInitialized } = useSceneStore.getState()
    if (!sceneInitialized) return
    const newId = `parametric-wall-${Date.now()}`
    const position = new Vector3(Math.random() * 4 - 2, 1.5, Math.random() * 4 - 2)
    const color = '#8B4513'
    const params: ParametricWallParams = {
      id: newId,
      width: 5,
      height: 3,
      depth: 0.2,
      color,
      openings: [],
      position,
      rotation: new Vector3(0, 0, 0)
    }
    addParametricWall(params)
    const newObj: SceneObject = {
      id: newId,
      type: 'parametric-wall',
      position,
      scale: new Vector3(1, 1, 1),
      rotation: new Vector3(0, 0, 0),
      color,
      isNurbs: false
    }
    addObject(newObj)
    setSelectedObjectId(newId)
  }
