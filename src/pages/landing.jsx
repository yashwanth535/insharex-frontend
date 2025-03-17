import { motion } from 'framer-motion';
import Header from '../components/Header';
import Footer from '../components/Footer';
import { useTheme } from '../context/ThemeContext';
import UploadFile from '../components/UploadFile';
import DownloadFile from '../components/DownloadFile'; // Import new component
import WebSocket from './temp';

const Landing = () => {
  const { isDark } = useTheme();

  return (
    <div className={`min-h-screen ${isDark ? 'bg-gray-900' : 'bg-gray-50'}`}>
      <Header />
      <motion.main initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.5 }} className="container mx-auto px-4 pt-28 pb-16">
        <motion.div className="max-w-4xl mx-auto text-center mb-16">
          <h1 className={`text-6xl font-bold mb-6 ${isDark ? 'text-white' : 'text-gray-900'}`}>
            Share Files <span className={isDark ? 'text-blue-400' : 'text-blue-500'}>Instantly</span>
          </h1>
          <p className={`text-xl ${isDark ? 'text-gray-300' : 'text-gray-600'}`}>
            Secure file sharing with a simple 6-digit code. No registration required.
          </p>
        </motion.div>

        <motion.div className="max-w-5xl mx-auto">
          <div className={`${isDark ? 'bg-gray-800' : 'bg-white'} rounded-2xl shadow-xl overflow-hidden grid md:grid-cols-2 divide-y md:divide-y-0 md:divide-x ${isDark ? 'divide-gray-700' : 'divide-gray-200'}`}>
            {/* <UploadFile />
            <DownloadFile /> */}
            <WebSocket/>
          </div>
        </motion.div>
      </motion.main>
      <Footer />
    </div>
  );
};

export default Landing;
