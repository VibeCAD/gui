import 'babylonjs-loaders' // Import loaders for GLB/GLTF support - must be first!
import earcut from 'earcut'
// BabylonJS PolygonMeshBuilder expects a global earcut; assign it here
;(window as any).earcut = earcut
import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import App from './App.tsx'

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
)
