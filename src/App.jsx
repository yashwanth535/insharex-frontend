import { BrowserRouter as Router, Routes, Route } from 'react-router-dom'
import Landing from './pages/landing'
import SignIn from './pages/signin'
import SignUp from './pages/signup'
import BackendCheck from './pages/ui/backendCheck'
import { ThemeProvider } from './context/ThemeContext'
import './App.css'
import P2P from './pages/p2p'
import P2M from './pages/p2m'
import DownloadPage from './pages/download'
import TorrentDownloader from './pages/BitTorrentDownloader'
function App() {
  return (
    <ThemeProvider>
      <Router>
        <Routes>
          <Route path="/" element={<Landing />} />
          <Route path="/backend" element={<BackendCheck />} />
          <Route path = '/p2p' element={<P2P/>}/>
          <Route path = '/p2m' element={<P2M/>} />
          <Route path = '/download' element={<DownloadPage/>} />
          <Route path = '/torrent' element={<TorrentDownloader/>} />
        </Routes>
      </Router>
    </ThemeProvider>
  )
}

export default App
