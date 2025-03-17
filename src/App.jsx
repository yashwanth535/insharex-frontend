import { useState } from 'react'
import { BrowserRouter as Router, Routes, Route } from 'react-router-dom'
import Landing from './pages/landing'
import WebSocket from './pages/websocket'
import { ThemeProvider } from './context/ThemeContext'
import './App.css'

function App() {
  return (
    <ThemeProvider>
      <Router>
        <Routes>
          <Route path="/" element={<Landing />} />
          {/* <Route path="/" element={<WebSocket/>}/> */}
        </Routes>
      </Router>
    </ThemeProvider>
  )
}

export default App
