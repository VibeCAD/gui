import { useEffect, useRef, useState } from 'react'
import { Engine, Scene, ArcRotateCamera, Vector3, HemisphericLight, MeshBuilder, StandardMaterial, Color3, Mesh } from 'babylonjs'
import OpenAI from 'openai'
import './App.css'

interface SceneObject {
  id: string
  type: string
  position: Vector3
  scale: Vector3
  rotation: Vector3
  color: string
  mesh?: Mesh
}

function App() {
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const sceneRef = useRef<Scene | null>(null)
  const engineRef = useRef<Engine | null>(null)
  const [textInput, setTextInput] = useState('')
  const [sceneObjects, setSceneObjects] = useState<SceneObject[]>([])
  const [isLoading, setIsLoading] = useState(false)
  const [apiKey, setApiKey] = useState('')
  const [showApiKeyInput, setShowApiKeyInput] = useState(true)
  const [responseLog, setResponseLog] = useState<string[]>([])
  const [sceneInitialized, setSceneInitialized] = useState(false)

  // Initialize OpenAI client
  const openai = apiKey ? new OpenAI({ apiKey, dangerouslyAllowBrowser: true }) : null

  const initializeBabylonScene = () => {
    if (!canvasRef.current || sceneInitialized) return

    try {
      const canvas = canvasRef.current
      const engine = new Engine(canvas, true)
      const scene = new Scene(engine)
      
      engineRef.current = engine
      sceneRef.current = scene

      // Create camera
      const camera = new ArcRotateCamera('camera', -Math.PI / 2, Math.PI / 2.5, 10, Vector3.Zero(), scene)
      camera.attachControl(canvas, true)

      // Create light
      const light = new HemisphericLight('light', new Vector3(0, 1, 0), scene)
      light.intensity = 0.7

      // Create initial cube
      const cube = MeshBuilder.CreateBox('cube', { size: 2 }, scene)
      cube.position.y = 1
      const material = new StandardMaterial('cubeMaterial', scene)
      material.diffuseColor = Color3.FromHexString('#ff6b6b')
      cube.material = material

      // Create ground
      const ground = MeshBuilder.CreateGround('ground', { width: 10, height: 10 }, scene)
      const groundMaterial = new StandardMaterial('groundMaterial', scene)
      groundMaterial.diffuseColor = new Color3(0.5, 0.5, 0.5)
      ground.material = groundMaterial

      // Initialize scene objects
      setSceneObjects([
        {
          id: 'cube-1',
          type: 'cube',
          position: new Vector3(0, 1, 0),
          scale: new Vector3(1, 1, 1),
          rotation: new Vector3(0, 0, 0),
          color: '#ff6b6b',
          mesh: cube
        },
        {
          id: 'ground-1',
          type: 'ground',
          position: new Vector3(0, 0, 0),
          scale: new Vector3(10, 1, 10),
          rotation: new Vector3(0, 0, 0),
          color: '#808080',
          mesh: ground
        }
      ])

      // Animation loop
      engine.runRenderLoop(() => {
        scene.render()
      })

      // Handle resize
      const handleResize = () => {
        engine.resize()
      }
      window.addEventListener('resize', handleResize)

      setSceneInitialized(true)

      // Cleanup function
      return () => {
        window.removeEventListener('resize', handleResize)
        engine.dispose()
      }
    } catch (error) {
      console.error('Error initializing Babylon.js scene:', error)
    }
  }

  useEffect(() => {
    if (!showApiKeyInput && !sceneInitialized) {
      // Small delay to ensure canvas is rendered
      const timer = setTimeout(() => {
        initializeBabylonScene()
      }, 100)
      return () => clearTimeout(timer)
    }
  }, [showApiKeyInput, sceneInitialized])

  useEffect(() => {
    return () => {
      if (engineRef.current) {
        engineRef.current.dispose()
      }
    }
  }, [])

  const describeScene = (): string => {
    const description = sceneObjects.map(obj => {
      if (obj.type === 'ground') return null
      return `${obj.type} "${obj.id}" at position (${obj.position.x.toFixed(1)}, ${obj.position.y.toFixed(1)}, ${obj.position.z.toFixed(1)}) with color ${obj.color}`
    }).filter(Boolean).join(', ')
    
    return `Current scene contains: ${description || 'just a ground plane'}`
  }

  const executeSceneCommand = (command: any) => {
    if (!sceneRef.current) return

    const scene = sceneRef.current
    
    try {
      switch (command.action) {
        case 'move':
          setSceneObjects(prev => {
            const newObjects = [...prev]
            const moveObj = newObjects.find(obj => obj.id === command.objectId)
            if (moveObj && moveObj.mesh) {
              moveObj.mesh.position = new Vector3(command.x, command.y, command.z)
              moveObj.position = new Vector3(command.x, command.y, command.z)
            }
            return newObjects
          })
          break

        case 'color':
          setSceneObjects(prev => {
            const newObjects = [...prev]
            const colorObj = newObjects.find(obj => obj.id === command.objectId)
            if (colorObj && colorObj.mesh && colorObj.mesh.material) {
              const material = colorObj.mesh.material as StandardMaterial
              material.diffuseColor = Color3.FromHexString(command.color)
              colorObj.color = command.color
            }
            return newObjects
          })
          break

        case 'scale':
          setSceneObjects(prev => {
            const newObjects = [...prev]
            const scaleObj = newObjects.find(obj => obj.id === command.objectId)
            if (scaleObj && scaleObj.mesh) {
              scaleObj.mesh.scaling = new Vector3(command.x, command.y, command.z)
              scaleObj.scale = new Vector3(command.x, command.y, command.z)
            }
            return newObjects
          })
          break

        case 'create':
          const newId = `${command.type}-${Date.now()}`
          let newMesh: Mesh
          
          if (command.type === 'cube') {
            newMesh = MeshBuilder.CreateBox(newId, { size: command.size || 2 }, scene)
          } else if (command.type === 'sphere') {
            newMesh = MeshBuilder.CreateSphere(newId, { diameter: command.size || 2 }, scene)
          } else if (command.type === 'cylinder') {
            newMesh = MeshBuilder.CreateCylinder(newId, { diameter: command.size || 2, height: command.height || 2 }, scene)
          } else {
            return
          }

          newMesh.position = new Vector3(command.x || 0, command.y || 1, command.z || 0)
          const newMaterial = new StandardMaterial(`${newId}-material`, scene)
          newMaterial.diffuseColor = Color3.FromHexString(command.color || '#3498db')
          newMesh.material = newMaterial

          const newObj: SceneObject = {
            id: newId,
            type: command.type,
            position: new Vector3(command.x || 0, command.y || 1, command.z || 0),
            scale: new Vector3(1, 1, 1),
            rotation: new Vector3(0, 0, 0),
            color: command.color || '#3498db',
            mesh: newMesh
          }

          setSceneObjects(prev => [...prev, newObj])
          break

        case 'delete':
          console.log('Deleting object with ID:', command.objectId)
          setSceneObjects(prev => {
            const deleteObj = prev.find(obj => obj.id === command.objectId)
            console.log('Found object to delete:', deleteObj)
            if (deleteObj && deleteObj.mesh) {
              console.log('Disposing mesh:', deleteObj.mesh.name)
              deleteObj.mesh.dispose()
              const newObjects = prev.filter(obj => obj.id !== command.objectId)
              console.log('Objects after deletion:', newObjects.map(obj => obj.id))
              return newObjects
            } else {
              console.log('Object not found or no mesh to dispose')
              return prev
            }
          })
          break
      }
    } catch (error) {
      console.error('Error executing scene command:', error)
    }
  }

  const handleSubmitPrompt = async () => {
    if (!openai || !textInput.trim()) return

    setIsLoading(true)
    try {
      const sceneDescription = describeScene()
      const systemPrompt = `You are a 3D scene manipulation assistant. You can modify a Babylon.js scene based on natural language commands.

Current scene: ${sceneDescription}

Available actions:
1. move: Move an object to x,y,z coordinates
2. color: Change object color (use hex colors)
3. scale: Scale an object by x,y,z factors
4. create: Create new objects (cube, sphere, cylinder)
5. delete: Remove an object

Respond ONLY with valid JSON containing an array of commands. Example:
[{"action": "move", "objectId": "cube-1", "x": 2, "y": 1, "z": 0}]
[{"action": "color", "objectId": "cube-1", "color": "#00ff00"}]
[{"action": "create", "type": "sphere", "x": 3, "y": 2, "z": 1, "color": "#ff0000", "size": 1.5}]

Object IDs currently in scene: ${sceneObjects.map(obj => obj.id).join(', ')}`

      const response = await openai.chat.completions.create({
        model: 'gpt-3.5-turbo',
        messages: [
          { role: 'system', content: systemPrompt },
          { role: 'user', content: textInput }
        ],
        temperature: 0.1,
        max_tokens: 500
      })

      const aiResponse = response.choices[0]?.message?.content
      if (aiResponse) {
        setResponseLog(prev => [...prev, `User: ${textInput}`, `AI: ${aiResponse}`])
        
        try {
          // Clean the AI response by removing markdown code blocks
          let cleanedResponse = aiResponse.trim()
          
          // Remove markdown code blocks
          cleanedResponse = cleanedResponse.replace(/```json\s*/g, '')
          cleanedResponse = cleanedResponse.replace(/```\s*/g, '')
          cleanedResponse = cleanedResponse.trim()
          
          console.log('Cleaned AI response:', cleanedResponse)
          
          const commands = JSON.parse(cleanedResponse)
          if (Array.isArray(commands)) {
            console.log('Executing commands:', commands)
            commands.forEach(command => executeSceneCommand(command))
          } else {
            console.log('Executing single command:', commands)
            executeSceneCommand(commands)
          }
        } catch (parseError) {
          console.error('Error parsing AI response:', parseError)
          console.error('Original response:', aiResponse)
          const errorMessage = parseError instanceof Error ? parseError.message : 'Unknown parsing error'
          setResponseLog(prev => [...prev, `Error: Could not parse AI response - ${errorMessage}`])
        }
      }
    } catch (error) {
      console.error('Error calling OpenAI API:', error)
      setResponseLog(prev => [...prev, `Error: ${error instanceof Error ? error.message : 'Unknown error'}`])
    } finally {
      setIsLoading(false)
      setTextInput('')
    }
  }

  const handleContinue = () => {
    if (apiKey.trim()) {
      setShowApiKeyInput(false)
    }
  }

  const clearAllObjects = () => {
    setSceneObjects(prev => {
      const objectsToDelete = prev.filter(obj => obj.type !== 'ground')
      console.log('Clearing all objects:', objectsToDelete.map(obj => obj.id))
      
      // Dispose all meshes
      objectsToDelete.forEach(obj => {
        if (obj.mesh) {
          console.log('Disposing mesh:', obj.mesh.name)
          obj.mesh.dispose()
        }
      })
      
      // Keep only the ground
      const remainingObjects = prev.filter(obj => obj.type === 'ground')
      console.log('Remaining objects after clear:', remainingObjects.map(obj => obj.id))
      return remainingObjects
    })
  }

  if (showApiKeyInput) {
    return (
      <div className="api-key-setup">
        <div className="api-key-container">
          <h2>VibeCad - AI Scene Manipulation</h2>
          <p>Enter your OpenAI API Key to enable AI-powered 3D scene manipulation:</p>
          <input
            type="password"
            value={apiKey}
            onChange={(e) => setApiKey(e.target.value)}
            placeholder="sk-..."
            className="api-key-input"
            onKeyPress={(e) => {
              if (e.key === 'Enter') {
                handleContinue()
              }
            }}
          />
          <button 
            onClick={handleContinue}
            disabled={!apiKey.trim()}
            className="api-key-submit"
          >
            Continue
          </button>
          <p className="api-key-note">
            Your API key is stored locally and never sent to our servers.
          </p>
        </div>
      </div>
    )
  }

  return (
    <div className="app-container">
      <canvas ref={canvasRef} className="babylon-canvas" />
      <div className="toolbar">
        <div className="toolbar-content">
          <h3>VibeCad AI Controls</h3>
          
          {!sceneInitialized && (
            <div className="loading-indicator">
              <p>Initializing 3D scene...</p>
            </div>
          )}
          
          <div className="control-group">
            <label htmlFor="ai-prompt">AI Command:</label>
            <textarea
              id="ai-prompt"
              value={textInput}
              onChange={(e) => setTextInput(e.target.value)}
              placeholder="Try: 'move the cube to the right', 'make the cube blue', 'create a red sphere above the cube'"
              className="text-input"
              disabled={isLoading || !sceneInitialized}
            />
            <button 
              onClick={handleSubmitPrompt}
              disabled={isLoading || !textInput.trim() || !sceneInitialized}
              className="submit-button"
            >
              {isLoading ? 'Processing...' : 'Execute Command'}
            </button>
          </div>

          <div className="control-group">
            <label>Scene Objects:</label>
            <div className="scene-objects">
              {sceneObjects.filter(obj => obj.type !== 'ground').map(obj => (
                <div key={obj.id} className="scene-object">
                  <span className="object-type">{obj.type}</span>
                  <span className="object-id">{obj.id}</span>
                  <div className="object-color" style={{ backgroundColor: obj.color }}></div>
                </div>
              ))}
              {sceneObjects.filter(obj => obj.type !== 'ground').length === 0 && (
                <div className="no-objects">No objects in scene</div>
              )}
            </div>
            <button 
              onClick={clearAllObjects}
              className="clear-all-button"
              disabled={sceneObjects.filter(obj => obj.type !== 'ground').length === 0}
            >
              Clear All Objects
            </button>
          </div>

          <div className="control-group">
            <label>AI Response Log:</label>
            <div className="response-log">
              {responseLog.slice(-6).map((log, index) => (
                <div key={index} className={`log-entry ${log.startsWith('User:') ? 'user' : log.startsWith('AI:') ? 'ai' : 'error'}`}>
                  {log}
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}

export default App
