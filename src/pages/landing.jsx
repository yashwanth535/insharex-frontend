import { motion } from 'framer-motion';
import Header from '../components/Header';
import Footer from '../components/Footer';
import { useTheme } from '../context/ThemeContext';


const Landing = () => {
  const { isDark } = useTheme();

  return (
    <div className={`min-h-screen ${isDark ? 'bg-gray-900' : 'bg-gray-50'}`}>
      <Header />
      <motion.main 
        initial={{ opacity: 0, y: 20 }} 
        animate={{ opacity: 1, y: 0 }} 
        transition={{ duration: 0.5 }} 
        className="container mx-auto px-4 pt-28 pb-16"
      >
        <motion.div className="max-w-4xl mx-auto text-center mb-16">
          <h1 className={`text-6xl font-bold mb-6 ${isDark ? 'text-white' : 'text-gray-900'}`}>
            InShareX: Share Files <span className={isDark ? 'text-blue-400' : 'text-blue-500'}>Instantly</span>
          </h1>
          <p className={`text-xl ${isDark ? 'text-gray-300' : 'text-gray-600'}`}>
            InShareX provides secure peer-to-peer file sharing with a simple 6-digit code. No registration required.
          </p>
          <p className={`text-lg mt-4 ${isDark ? 'text-gray-400' : 'text-gray-500'}`}>
            InShareX - The fastest way to share files directly between devices using WebRTC technology.
          </p>
        </motion.div>

        <motion.div className="w-4/5 mx-auto">
          <div className={`${isDark ? 'bg-gray-800' : 'bg-white'} rounded-2xl shadow-xl overflow-hidden border ${isDark ? 'border-gray-700' : 'border-gray-200'} p-8`}>
            <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6 max-w-6xl mx-auto">
              {/* One to One Button */}
              <motion.button
                whileHover={{ scale: 1.05 }}
                whileTap={{ scale: 0.95 }}
                onClick={() => window.location.href = '/p2p'}
                className={`p-6 rounded-xl border-2 transition-all duration-300 ${
                  isDark 
                    ? 'bg-gray-700 border-blue-500 hover:bg-blue-600 hover:border-blue-400' 
                    : 'bg-blue-50 border-blue-500 hover:bg-blue-500 hover:border-blue-600'
                } group`}
              >
                <div className="text-center">
                  <div className={`text-4xl mb-3 ${isDark ? 'text-blue-400' : 'text-blue-600'}`}>
                    👥
                  </div>
                  <h3 className={`text-xl font-semibold mb-2 ${isDark ? 'text-white' : 'text-gray-900'}`}>
                    One to One
                  </h3>
                  <p className={`text-sm ${isDark ? 'text-gray-300' : 'text-gray-600'}`}>
                    Share files directly between two devices
                  </p>
                </div>
              </motion.button>

              {/* One to Many Button */}
              <motion.button
                whileHover={{ scale: 1.05 }}
                whileTap={{ scale: 0.95 }}
                onClick={() => window.location.href = '/p2m'}
                className={`p-6 rounded-xl border-2 transition-all duration-300 ${
                  isDark 
                    ? 'bg-gray-700 border-green-500 hover:bg-green-600 hover:border-green-400' 
                    : 'bg-green-50 border-green-500 hover:bg-green-500 hover:border-green-600'
                } group`}
              >
                <div className="text-center">
                  <div className={`text-4xl mb-3 ${isDark ? 'text-green-400' : 'text-green-600'}`}>
                    🌐
                  </div>
                  <h3 className={`text-xl font-semibold mb-2 ${isDark ? 'text-white' : 'text-gray-900'}`}>
                    One to Many
                  </h3>
                  <p className={`text-sm ${isDark ? 'text-gray-300' : 'text-gray-600'}`}>
                    Share files with multiple recipients
                  </p>
                </div>
              </motion.button>

              <motion.button
                whileHover={{ scale: 1.05 }}
                whileTap={{ scale: 0.95 }}
                onClick={() => window.location.href = '/torrent'}
                className={`p-6 rounded-xl border-2 transition-all duration-300 ${
                  isDark 
                    ? 'bg-gray-700 border-purple-500 hover:bg-purple-600 hover:border-purple-400' 
                    : 'bg-purple-50 border-purple-500 hover:bg-purple-500 hover:border-purple-600'
                } group`}
              >
                <div className="text-center">
                  <div className={`text-4xl mb-3 ${isDark ? 'text-purple-400' : 'text-purple-600'}`}>
                    ⬇️
                  </div>
                  <h3 className={`text-xl font-bold mb-2 ${isDark ? 'text-white' : 'text-gray-900'}`}>
                    Torrent Downloader
                  </h3>
                  <p className={`text-sm ${isDark ? 'text-gray-300' : 'text-gray-600'}`}>
                    Download files from magnet links using WebTorrent
                  </p>
                </div>
              </motion.button>
            </div>
          </div>
        </motion.div>
      </motion.main>
      <Footer />
    </div>
  );
};

export default Landing;