import { BrowserRouter as Router, Routes, Route } from 'react-router-dom'
import Landing from './pages/landing'
import SignIn from './pages/signin'
import SignUp from './pages/signup'
import BackendCheck from './pages/ui/backendCheck'
import { ThemeProvider } from './context/ThemeContext'
import './App.css'

function App() {
  return (
    <ThemeProvider>
      <Router>
        <Routes>
          <Route path="/" element={<Landing />} />
          <Route path="/backend" element={<BackendCheck />} />
        </Routes>
      </Router>
    </ThemeProvider>
  )
}

export default App
