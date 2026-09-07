import { motion } from 'framer-motion';
import { Users, Globe, Download, ArrowRight, Zap, Shield, Lock } from 'lucide-react';
import Header from '../components/Header';
import Footer from '../components/Footer';
import { useTheme } from '../context/ThemeContext';

const Landing = () => {
  const { isDark } = useTheme();

  const modes = [
    {
      icon: Users,
      title: 'One to One',
      description: 'Share files directly between two devices, peer to peer.',
      accent: 'blue',
      path: '/p2p',
    },
    {
      icon: Globe,
      title: 'One to Many',
      description: 'Broadcast files to multiple recipients at once.',
      accent: 'emerald',
      path: '/p2m',
    },
    {
      icon: Download,
      title: 'Torrent Downloader',
      description: 'Pull files from magnet links using WebTorrent.',
      accent: 'purple',
      path: '/torrent',
    },
  ];

  const accentStyles = {
    blue: {
      icon: isDark ? 'text-blue-400' : 'text-blue-600',
      iconBg: isDark ? 'bg-blue-500/10' : 'bg-blue-50',
      border: isDark ? 'hover:border-blue-500/60' : 'hover:border-blue-400',
      glow: 'hover:shadow-blue-500/20',
    },
    emerald: {
      icon: isDark ? 'text-emerald-400' : 'text-emerald-600',
      iconBg: isDark ? 'bg-emerald-500/10' : 'bg-emerald-50',
      border: isDark ? 'hover:border-emerald-500/60' : 'hover:border-emerald-400',
      glow: 'hover:shadow-emerald-500/20',
    },
    purple: {
      icon: isDark ? 'text-purple-400' : 'text-purple-600',
      iconBg: isDark ? 'bg-purple-500/10' : 'bg-purple-50',
      border: isDark ? 'hover:border-purple-500/60' : 'hover:border-purple-400',
      glow: 'hover:shadow-purple-500/20',
    },
  };

  const features = [
    { icon: Zap, text: 'No sign-up, no waiting' },
    { icon: Lock, text: 'Encrypted, peer-to-peer transfer' },
    { icon: Shield, text: 'Files never touch our servers' },
  ];

  return (
    <div className={`min-h-screen ${isDark ? 'bg-gray-900' : 'bg-gray-50'}`}>
      <Header />

      <motion.main
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5 }}
        className="container mx-auto px-4 sm:px-6 pt-24 sm:pt-28 pb-16"
      >
        {/* Hero */}
        <motion.div className="max-w-3xl mx-auto text-center mb-10 sm:mb-16">
          <div
            className={`inline-flex items-center gap-2 px-3 py-1 rounded-full text-xs sm:text-sm font-medium mb-5 ${
              isDark ? 'bg-blue-500/10 text-blue-400 border border-blue-500/20' : 'bg-blue-50 text-blue-600 border border-blue-100'
            }`}
          >
            <span className="w-1.5 h-1.5 rounded-full bg-blue-500 animate-pulse" />
            No account needed
          </div>

          <h1
            className={`text-4xl sm:text-5xl md:text-6xl font-bold leading-tight mb-5 ${
              isDark ? 'text-white' : 'text-gray-900'
            }`}
          >
            Share files{' '}
            <span
              className={`bg-clip-text text-transparent bg-gradient-to-r ${
                isDark ? 'from-blue-400 to-cyan-300' : 'from-blue-600 to-cyan-500'
              }`}
            >
              instantly
            </span>
          </h1>

          <p className={`text-base sm:text-lg md:text-xl ${isDark ? 'text-gray-300' : 'text-gray-600'} px-2`}>
            InShareX moves files directly between devices with a simple 6-digit
            code, over an encrypted WebRTC connection. No registration, no
            upload wait.
          </p>

          <div className="flex flex-wrap justify-center gap-3 sm:gap-4 mt-6">
            {features.map((f, i) => (
              <div
                key={i}
                className={`flex items-center gap-1.5 text-xs sm:text-sm px-3 py-1.5 rounded-full ${
                  isDark ? 'bg-gray-800 text-gray-300 border border-gray-700' : 'bg-white text-gray-600 border border-gray-200'
                }`}
              >
                <f.icon className="w-3.5 h-3.5" />
                {f.text}
              </div>
            ))}
          </div>
        </motion.div>

        {/* Mode cards */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5, delay: 0.15 }}
          className="w-full max-w-5xl mx-auto"
        >
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 sm:gap-6">
            {modes.map((mode, i) => {
              const accent = accentStyles[mode.accent];
              const Icon = mode.icon;
              return (
                <motion.button
                  key={mode.title}
                  initial={{ opacity: 0, y: 15 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ duration: 0.4, delay: 0.2 + i * 0.08 }}
                  whileHover={{ y: -4 }}
                  whileTap={{ scale: 0.98 }}
                  onClick={() => (window.location.href = mode.path)}
                  className={`group relative text-left p-5 sm:p-6 rounded-2xl border transition-all duration-300 shadow-sm hover:shadow-lg ${accent.glow} ${
                    isDark ? 'bg-gray-800 border-gray-700' : 'bg-white border-gray-200'
                  } ${accent.border}`}
                >
                  <div className={`w-12 h-12 rounded-xl flex items-center justify-center mb-4 ${accent.iconBg}`}>
                    <Icon className={`w-6 h-6 ${accent.icon}`} />
                  </div>

                  <h3 className={`text-lg font-semibold mb-1.5 ${isDark ? 'text-white' : 'text-gray-900'}`}>
                    {mode.title}
                  </h3>
                  <p className={`text-sm leading-relaxed ${isDark ? 'text-gray-400' : 'text-gray-600'}`}>
                    {mode.description}
                  </p>

                  <div
                    className={`mt-4 flex items-center gap-1 text-sm font-medium ${accent.icon} opacity-0 group-hover:opacity-100 transition-opacity duration-300`}
                  >
                    Get started
                    <ArrowRight className="w-4 h-4 transition-transform duration-300 group-hover:translate-x-1" />
                  </div>
                </motion.button>
              );
            })}
          </div>
        </motion.div>
      </motion.main>

      <Footer />
    </div>
  );
};

export default Landing;