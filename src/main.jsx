import React from 'react'
import ReactDOM from 'react-dom/client'
import App from './App.jsx'
import './index.css'
import { GlobalStylesScope, darkTheme } from '@components'

ReactDOM.createRoot(document.getElementById('root')).render(
    <GlobalStylesScope themeDefinition={darkTheme}>
        <React.StrictMode>
            <App />
        </React.StrictMode>
    </GlobalStylesScope>,
)
