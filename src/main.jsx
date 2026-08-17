import React from 'react'
import ReactDOM from 'react-dom/client'
import App from './App.jsx'
import './index.css'
// DLS tokens load from the linked package on local only; absent in deployments.
// Lazy glob keeps the imports inside the branch so builds drop them.
if (import.meta.env.DEV) {
    Object.values(import.meta.glob('../node_modules/@tmca/lexus-dls/**/*.css')).forEach((load) => load())
}

ReactDOM.createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>,
)
