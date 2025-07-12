import { motion } from 'framer-motion';
import Header from '../components/Header';
import Footer from '../components/Footer';
import { useTheme } from '../context/ThemeContext';
import WebSocket from './webrtc';


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

        <motion.div className="w-3/5 mx-auto">
          <div className={`${isDark ? 'bg-gray-800' : 'bg-white'} rounded-2xl shadow-xl overflow-hidden border ${isDark ? 'border-gray-700' : 'border-gray-200'}`}>
            <WebSocket/>
          </div>
        </motion.div>
      </motion.main>
      <Footer />
    </div>
  );
};

export default Landing;