import React from 'react'
import ReactDOM from 'react-dom/client'
import App from './App.jsx'
import './index.css'
import.meta.glob('../node_modules/@tmca/lexus-dls/**/*.css', { eager: true })
import { GlobalStylesScope, darkTheme } from '@tmca/lexus-kit'

ReactDOM.createRoot(document.getElementById('root')).render(
  <GlobalStylesScope themeDefinition={darkTheme}>
    <React.StrictMode>
      <App />
    </React.StrictMode>
  </GlobalStylesScope>,
)
