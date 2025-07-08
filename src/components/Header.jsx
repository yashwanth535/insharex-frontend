import { motion } from 'framer-motion'
import { Shield, Clock, Sun, Moon } from 'lucide-react'
import { Link } from 'react-router-dom'
import { useTheme } from '../context/ThemeContext'

const Header = () => {
  const { isDark, toggleTheme } = useTheme()

  return (
    <motion.header 
      initial={{ y: -100, opacity: 0 }}
      animate={{ y: 0, opacity: 1 }}
      transition={{ duration: 0.5 }}
      className={`fixed w-full top-0 z-50 border-b ${
        isDark 
          ? 'bg-gray-900/90 border-gray-800' 
          : 'bg-white/90 border-gray-200'
      } backdrop-blur-md transition-colors duration-200`}
    >
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex justify-between items-center h-16">
          <motion.div 
            whileHover={{ scale: 1.05 }}
            className="flex items-center space-x-3"
          >
            <Link to="/" className="flex items-center space-x-3">
              <img
                src="/share.png"
                alt="ShareX Logo"
                className="h-8 w-8 object-contain"
              />
              <span className={`text-2xl font-bold ${isDark ? 'text-white' : 'text-gray-900'}`}>
                ShareX
              </span>
            </Link>
          </motion.div>
          
          <div className="flex items-center space-x-8">
            <motion.div 
              whileHover={{ y: -2 }}
              className={`hidden md:flex items-center space-x-2 ${
                isDark ? 'text-gray-300' : 'text-gray-600'
              } hover:text-blue-500 transition-colors`}
            >
              <Shield className="h-5 w-5" />
              <span>Secure Sharing</span>
            </motion.div>
            <motion.div 
              whileHover={{ y: -2 }}
              className={`hidden md:flex items-center space-x-2 ${
                isDark ? 'text-gray-300' : 'text-gray-600'
              } hover:text-blue-500 transition-colors`}
            >
              <Clock className="h-5 w-5" />
              <span>24h Storage</span>
            </motion.div>
            <motion.button
              whileHover={{ scale: 1.1 }}
              whileTap={{ scale: 0.9 }}
              onClick={toggleTheme}
              className={`p-2 rounded-full ${
                isDark 
                  ? 'bg-gray-800 text-gray-300 hover:bg-gray-700' 
                  : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
              } transition-colors`}
            >
              {isDark ? <Sun className="h-5 w-5" /> : <Moon className="h-5 w-5" />}
            </motion.button>
          </div>
        </div>
      </div>
    </motion.header>
  )
}

export default Header 