import React from 'react'
import ReactDOM from 'react-dom/client'
import App from './App.jsx'
import.meta.glob(
    '../node_modules/@tmca/lexus-dls/**/*.css',
    { eager: true },
)

ReactDOM.createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>,
)
