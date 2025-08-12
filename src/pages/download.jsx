import { useState, useEffect, useRef } from 'react';
import { motion } from 'framer-motion';
import { 
  Download, 
  Copy, 
  X, 
  Pause, 
  Play, 
  FileText,
  Link,
  AlertCircle,
  CheckCircle,
  Clock
} from 'lucide-react';
import Header from '../components/Header';
import Footer from '../components/Footer';
import { useTheme } from '../context/ThemeContext';

const DownloadPage = () => {
  const { isDark } = useTheme();
  const [magnetLink, setMagnetLink] = useState('');
  const [isDownloading, setIsDownloading] = useState(false);
  const [downloadClient, setDownloadClient] = useState(null);
  const [webtorrentStatus, setWebtorrentStatus] = useState('loading'); // 'loading', 'ready', 'error'
  const [activeTorrents, setActiveTorrents] = useState(new Map());
  const [downloadProgress, setDownloadProgress] = useState(new Map());
  const [logs, setLogs] = useState([]);
  const [copied, setCopied] = useState(false);
  const [fileSystemSupported, setFileSystemSupported] = useState(false);
  const [logFilter, setLogFilter] = useState('all'); // 'all', 'info', 'progress', 'success', 'error'

  useEffect(() => {
    initializeWebTorrent();
    checkFileSystemSupport();
    
    return () => {
      cleanupWebTorrent();
    };
  }, []);

  const checkFileSystemSupport = () => {
    const supported = 'showSaveFilePicker' in window && 'showDirectoryPicker' in window;
    setFileSystemSupported(supported);
    if (!supported) {
      addLog('⚠️ File System Access API not supported. File downloads may not work properly.', 'error');
    }
  };

  const initializeWebTorrent = () => {
    if (typeof window !== 'undefined') {
      if (window.WebTorrent) {
        const client = new window.WebTorrent();
        setDownloadClient(client);
        setWebtorrentStatus('ready');
        
        client.on('error', (err) => {
          console.error('WebTorrent error:', err);
          addLog(`WebTorrent error: ${err.message}`, 'error');
        });
        return;
      }

      const script = document.createElement('script');
      script.src = 'https://cdn.jsdelivr.net/npm/webtorrent@latest/webtorrent.min.js';
      script.onload = () => {
        if (window.WebTorrent) {
          const client = new window.WebTorrent();
          setDownloadClient(client);
          setWebtorrentStatus('ready');
          
          client.on('error', (err) => {
            console.error('WebTorrent error:', err);
            addLog(`WebTorrent error: ${err.message}`, 'error');
          });
        } else {
          console.error('WebTorrent failed to load from CDN');
          setWebtorrentStatus('error');
        }
      };
      script.onerror = () => {
        console.error('Failed to load WebTorrent from CDN');
        setWebtorrentStatus('error');
      };
      document.head.appendChild(script);
    }
  };

  const cleanupWebTorrent = () => {
    if (downloadClient) {
      downloadClient.destroy();
    }
    setActiveTorrents(new Map());
    setDownloadProgress(new Map());
  };

  const addLog = (message, type = 'info') => {
    const logEntry = {
      id: Date.now(),
      message,
      type,
      timestamp: new Date().toLocaleTimeString()
    };
    setLogs(prev => [...prev, logEntry]);
  };

  const startDownload = async () => {
    if (!magnetLink.trim() || !downloadClient) {
      addLog('Please enter a valid magnet link and ensure WebTorrent is ready', 'error');
      return;
    }

    try {
      const startTime = Date.now();
      setIsDownloading(true);
      addLog(`Starting download from magnet link...`, 'info');

      // Add torrent to download client
      downloadClient.add(magnetLink, async (torrent) => {
        const torrentStartTime = Date.now();
        console.log('Downloading torrent:', torrent.infoHash);
        addLog(`Download started: ${torrent.name || 'Unknown File'}`, 'success');
        addLog(`Torrent info: ${torrent.files.length} file(s), Total size: ${formatFileSize(torrent.length)}`, 'info');
        
        // Store active torrent
        setActiveTorrents(prev => new Map(prev.set(torrent.infoHash, torrent)));

        // Initialize progress tracking
        setDownloadProgress(prev => new Map(prev.set(torrent.infoHash, {
          progress: 0,
          downloadSpeed: 0,
          uploadSpeed: 0,
          numPeers: 0,
          timeRemaining: 0,
          downloaded: 0,
          totalSize: torrent.length,
          fileName: torrent.name || 'Unknown File'
        })));

        // --- File System Access API integration starts here ---
        addLog(`Setting up file system access for ${torrent.files.length} file(s)...`, 'info');
        
        // Handle multiple files in the torrent
        if (torrent.files.length === 1) {
          // Single file torrent - ask user where to save
          addLog(`Single file detected: ${torrent.files[0].name} (${formatFileSize(torrent.files[0].length)})`, 'info');
          await handleSingleFileDownload(torrent, torrent.files[0]);
        } else if (torrent.files.length > 1) {
          // Multiple files torrent - ask user to pick directory
          addLog(`Multiple files detected: ${torrent.files.length} files`, 'info');
          torrent.files.forEach((file, index) => {
            addLog(`  File ${index + 1}: ${file.name} (${formatFileSize(file.length)})`, 'info');
          });
          await handleMultipleFilesDownload(torrent);
        } else {
          addLog('No files found in torrent.', 'error');
          setIsDownloading(false);
          return;
        }

        // Monitor download progress
        torrent.on('download', (bytes) => {
          const progress = (torrent.progress * 100).toFixed(1);
          const downloadSpeed = (torrent.downloadSpeed / 1024 / 1024).toFixed(2);
          const uploadSpeed = (torrent.uploadSpeed / 1024 / 1024).toFixed(2);
          const numPeers = torrent.numPeers;
          const timeRemaining = torrent.timeRemaining / 1000;
          const downloaded = torrent.downloaded;

          setDownloadProgress(prev => new Map(prev.set(torrent.infoHash, {
            progress,
            downloadSpeed,
            uploadSpeed,
            numPeers,
            timeRemaining: timeRemaining > 0 ? timeRemaining : 0,
            downloaded,
            totalSize: torrent.length,
            fileName: torrent.name || 'Unknown File'
          })));

          // Log progress every 5% for large files, every 10% for smaller ones
          const logThreshold = torrent.length > 100 * 1024 * 1024 ? 5 : 10; // 100MB threshold
          if (progress % logThreshold < 1 && progress > 0) {
            addLog(`Download progress: ${progress}% - ${(downloaded / 1024 / 1024).toFixed(2)} MB / ${(torrent.length / 1024 / 1024).toFixed(2)} MB`, 'progress');
          }
        });

        torrent.on('done', () => {
          const totalTime = Date.now() - torrentStartTime;
          console.log('Download complete:', torrent.name);
          addLog(`Download complete: ${torrent.name}`, 'success');
          addLog(`Total download time: ${(totalTime / 1000).toFixed(1)} seconds`, 'success');
          addLog(`Average speed: ${(torrent.length / 1024 / 1024 / (totalTime / 1000)).toFixed(2)} MB/s`, 'success');
          setIsDownloading(false);
        });

        torrent.on('error', (err) => {
          console.error('Download error:', err);
          addLog(`Download error: ${err.message}`, 'error');
          setIsDownloading(false);
        });

        torrent.on('wire', (wire) => {
          addLog(`New peer connected: ${wire.peerId}`, 'info');
        });

        torrent.on('noPeers', () => {
          addLog('No peers available for this torrent', 'warning');
        });

        torrent.on('metadata', () => {
          const metadataTime = Date.now() - torrentStartTime;
          addLog(`Torrent metadata received in ${metadataTime}ms`, 'info');
        });
      });

      // Clear magnet link input
      setMagnetLink('');
      
    } catch (error) {
      console.error('Error starting download:', error);
      addLog(`Failed to start download: ${error.message}`, 'error');
      setIsDownloading(false);
    }
  };

  // Handle single file download with File System Access API
  const handleSingleFileDownload = async (torrent, file) => {
    try {
      const fileStartTime = Date.now();
      addLog(`Starting single file download setup for: ${file.name}`, 'info');
      
      // Ask user where to save the file
      let fileHandle;
      try {
        addLog(`Opening file save dialog for: ${file.name}...`, 'info');
        const dialogStartTime = Date.now();
        
        fileHandle = await window.showSaveFilePicker({
          suggestedName: file.name,
          types: [{
            description: 'Torrent file',
            accept: { [file._mimeType || 'application/octet-stream']: ['.' + file.name.split('.').pop()] }
          }]
        });
        
        const dialogTime = Date.now() - dialogStartTime;
        addLog(`File save dialog completed in ${dialogTime}ms`, 'success');
        
      } catch (err) {
        if (err.name === 'AbortError') {
          addLog('File save canceled by user.', 'info');
        } else {
          addLog(`Error opening file picker: ${err.message}`, 'error');
        }
        setIsDownloading(false);
        return;
      }

      // Create writable stream to write data directly to disk
      addLog(`Creating writable stream for file: ${file.name}...`, 'info');
      const streamStartTime = Date.now();
      
      const writable = await fileHandle.createWritable();
      
      const streamTime = Date.now() - streamStartTime;
      addLog(`Writable stream created in ${streamTime}ms`, 'success');
      addLog(`Saving file to: ${file.name}`, 'info');

      // Use file.createReadStream to get a readable stream of the torrent file,
      // then pipe to writable stream chunk by chunk
      addLog(`Setting up file read stream...`, 'info');
      const stream = file.createReadStream();

      // We need to convert readable stream (Node style) to async iterator to pipe manually
      const reader = stream[Symbol.asyncIterator]();

      async function writeChunks() {
        try {
          let totalBytesWritten = 0;
          let chunkCount = 0;
          const writeStartTime = Date.now();
          
          addLog(`Starting to write file chunks...`, 'info');
          
          while (true) {
            const { done, value } = await reader.next();
            if (done) break;
            
            await writable.write(value);
            totalBytesWritten += value.length;
            chunkCount++;
            
            // Log progress every 50MB for large files
            if (totalBytesWritten % (50 * 1024 * 1024) < value.length && totalBytesWritten > 0) {
              const progress = ((totalBytesWritten / file.length) * 100).toFixed(1);
              addLog(`File write progress: ${progress}% - ${(totalBytesWritten / 1024 / 1024).toFixed(2)} MB written`, 'progress');
            }
          }
          
          await writable.close();
          
          const totalWriteTime = Date.now() - writeStartTime;
          const writeSpeed = (totalBytesWritten / 1024 / 1024 / (totalWriteTime / 1000)).toFixed(2);
          
          addLog(`File saved successfully: ${file.name}`, 'success');
          addLog(`Write stats: ${chunkCount} chunks, ${(totalBytesWritten / 1024 / 1024).toFixed(2)} MB in ${(totalWriteTime / 1000).toFixed(1)}s (${writeSpeed} MB/s)`, 'success');

          // Remove torrent from active lists
          setActiveTorrents(prev => {
            const newMap = new Map(prev);
            newMap.delete(torrent.infoHash);
            return newMap;
          });
          setDownloadProgress(prev => {
            const newMap = new Map(prev);
            newMap.delete(torrent.infoHash);
            return newMap;
          });

        } catch (err) {
          console.error('Error writing file:', err);
          addLog(`Error writing file: ${err.message}`, 'error');
          setIsDownloading(false);
        }
      }

      const totalSetupTime = Date.now() - fileStartTime;
      addLog(`File download setup completed in ${totalSetupTime}ms`, 'info');
      
      writeChunks();

    } catch (error) {
      console.error('Error in single file download:', error);
      addLog(`Error setting up file download: ${error.message}`, 'error');
      setIsDownloading(false);
    }
  };

  // Handle multiple files download with directory picker
  const handleMultipleFilesDownload = async (torrent) => {
    try {
      const multiStartTime = Date.now();
      addLog(`Starting multiple files download setup...`, 'info');
      
      // Ask user to pick a directory for multiple files
      let directoryHandle;
      try {
        addLog('Please select a folder where you want to save the files (avoid system folders)', 'info');
        addLog(`Opening directory picker for ${torrent.files.length} files...`, 'info');
        
        const pickerStartTime = Date.now();
        directoryHandle = await window.showDirectoryPicker({
          startIn: 'downloads' // Start in downloads folder by default
        });
        
        const pickerTime = Date.now() - pickerStartTime;
        addLog(`Directory picker completed in ${pickerTime}ms`, 'success');
        
      } catch (err) {
        if (err.name === 'AbortError') {
          addLog('Directory selection canceled by user.', 'info');
        } else if (err.name === 'NotAllowedError') {
          addLog('Access denied to selected directory. Please choose a different folder.', 'error');
        } else if (err.message.includes('system files')) {
          addLog('Cannot access system folders. Please choose a regular folder like Desktop, Downloads, or create a new folder.', 'error');
        } else {
          addLog(`Error opening directory picker: ${err.message}`, 'error');
        }
        setIsDownloading(false);
        return;
      }

      addLog(`Selected directory for download`, 'success');

      // Create a map to store file handles and writable streams
      const fileHandles = new Map();
      const writableStreams = new Map();

      // Set up file handles for all files in the torrent
      addLog(`Preparing ${torrent.files.length} files for download...`, 'info');
      const prepStartTime = Date.now();
      
      for (const file of torrent.files) {
        try {
          const filePrepStart = Date.now();
          addLog(`Preparing file: ${file.name} (${formatFileSize(file.length)})...`, 'info');
          
          const fileHandle = await directoryHandle.getFileHandle(file.name, { create: true });
          const writable = await fileHandle.createWritable();
          
          fileHandles.set(file.name, fileHandle);
          writableStreams.set(file.name, writable);
          
          const filePrepTime = Date.now() - filePrepStart;
          addLog(`Prepared file: ${file.name} in ${filePrepTime}ms`, 'success');
          
        } catch (err) {
          addLog(`Error preparing file ${file.name}: ${err.message}`, 'error');
        }
      }
      
      const totalPrepTime = Date.now() - prepStartTime;
      addLog(`All files prepared in ${totalPrepTime}ms`, 'success');

      // Monitor torrent progress and write chunks as they arrive
      torrent.on('download', (bytes) => {
        // Write available chunks to files
        torrent.files.forEach(async (file) => {
          if (file.done) return; // Skip if file is complete
          
          const writable = writableStreams.get(file.name);
          if (!writable) return;

          try {
            // Get the file's pieces and write them
            const stream = file.createReadStream();
            const reader = stream[Symbol.asyncIterator]();

            while (true) {
              const { done, value } = await reader.next();
              if (done) break;
              await writable.write(value);
            }
          } catch (err) {
            // Ignore errors for incomplete files
          }
        });
      });

      // When torrent is done, close all writable streams
      torrent.on('done', async () => {
        addLog('Closing all file streams...', 'info');
        const closeStartTime = Date.now();
        
        for (const [fileName, writable] of writableStreams) {
          try {
            await writable.close();
            addLog(`File completed: ${fileName}`, 'success');
          } catch (err) {
            addLog(`Error closing file ${fileName}: ${err.message}`, 'error');
          }
        }

        const closeTime = Date.now() - closeStartTime;
        addLog(`All streams closed in ${closeTime}ms`, 'success');

        // Clear the maps
        fileHandles.clear();
        writableStreams.clear();
      });

      const totalSetupTime = Date.now() - multiStartTime;
      addLog(`Multiple files download setup completed in ${totalSetupTime}ms`, 'info');

    } catch (error) {
      console.error('Error in multiple files download:', error);
      addLog(`Error setting up multiple files download: ${error.message}`, 'error');
      setIsDownloading(false);
    }
  };

  const pauseTorrent = (infoHash) => {
    const torrent = activeTorrents.get(infoHash);
    if (torrent) {
      torrent.pause();
      addLog(`Paused download: ${torrent.name}`, 'info');
    }
  };

  const resumeTorrent = (infoHash) => {
    const torrent = activeTorrents.get(infoHash);
    if (torrent) {
      torrent.resume();
      addLog(`Resumed download: ${torrent.name}`, 'info');
    }
  };

  const removeTorrent = (infoHash) => {
    const torrent = activeTorrents.get(infoHash);
    if (torrent) {
      torrent.destroy();
      addLog(`Removed download: ${torrent.name}`, 'info');
      
      setActiveTorrents(prev => {
        const newMap = new Map(prev);
        newMap.delete(infoHash);
        return newMap;
      });
      
      setDownloadProgress(prev => {
        const newMap = new Map(prev);
        newMap.delete(infoHash);
        return newMap;
      });
    }
  };

  const copyToClipboard = async (text) => {
    try {
      await navigator.clipboard.writeText(text);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch (err) {
      console.error('Failed to copy:', err);
    }
  };

  const formatFileSize = (bytes) => {
    if (bytes === 0) return '0 Bytes';
    const k = 1024;
    const sizes = ['Bytes', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
  };

  const formatTime = (seconds) => {
    if (seconds === 0) return '∞';
    const hours = Math.floor(seconds / 3600);
    const minutes = Math.floor((seconds % 3600) / 60);
    const secs = Math.floor(seconds % 60);
    
    if (hours > 0) {
      return `${hours}h ${minutes}m ${secs}s`;
    } else if (minutes > 0) {
      return `${minutes}m ${secs}s`;
    } else {
      return `${secs}s`;
    }
  };

  return (
    <div className={`min-h-screen ${isDark ? 'bg-gray-900' : 'bg-gray-50'}`}>
      <Header />
      <motion.main 
        initial={{ opacity: 0, y: 20 }} 
        animate={{ opacity: 1, y: 0 }} 
        transition={{ duration: 0.5 }} 
        className="container mx-auto px-4 pt-28 pb-16"
      >
        <div className="max-w-4xl mx-auto">
          <h1 className={`text-4xl font-bold mb-8 text-center ${isDark ? 'text-white' : 'text-gray-900'}`}>
            Torrent Downloader
          </h1>

          {/* HTTPS Requirement Note */}
          {window.location.protocol !== 'https:' && (
            <motion.div 
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              className={`${isDark ? 'bg-orange-900' : 'bg-orange-50'} border border-orange-200 rounded-lg p-4 mb-6 text-center`}
            >
              <div className="flex items-center justify-center space-x-2">
                <AlertCircle className="h-5 w-5 text-orange-600" />
                <span className={`${isDark ? 'text-orange-200' : 'text-orange-800'}`}>
                  ℹ️ File System Access API requires HTTPS. For local development, use localhost or deploy to HTTPS.
                </span>
              </div>
            </motion.div>
          )}

          {/* WebTorrent Status Indicator */}
          {webtorrentStatus === 'loading' && (
            <motion.div 
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              className={`${isDark ? 'bg-blue-900' : 'bg-blue-50'} border border-blue-200 rounded-lg p-4 mb-6 text-center`}
            >
              <div className="flex items-center justify-center space-x-2">
                <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-blue-600"></div>
                <span className={`${isDark ? 'text-blue-200' : 'text-blue-800'}`}>
                  Loading WebTorrent client...
                </span>
              </div>
            </motion.div>
          )}

          {webtorrentStatus === 'error' && (
            <motion.div 
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              className={`${isDark ? 'bg-red-900' : 'bg-red-50'} border border-red-200 rounded-lg p-4 mb-6 text-center`}
            >
              <div className="flex items-center justify-center space-x-2">
                <span className={`${isDark ? 'text-red-200' : 'text-red-800'}`}>
                  ⚠️ WebTorrent failed to load. Please refresh the page and try again.
                </span>
                <button
                  onClick={() => {
                    setWebtorrentStatus('loading');
                    initializeWebTorrent();
                  }}
                  className={`px-3 py-1 rounded text-sm ${isDark ? 'bg-red-700 hover:bg-red-600' : 'bg-red-600 hover:bg-red-700'} text-white`}
                >
                  Retry
                </button>
              </div>
            </motion.div>
          )}

          {webtorrentStatus === 'ready' && (
            <motion.div 
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              className={`${isDark ? 'bg-green-900' : 'bg-green-50'} border border-green-200 rounded-lg p-4 mb-6 text-center`}
            >
              <span className={`${isDark ? 'text-green-200' : 'text-green-800'}`}>
                ✅ WebTorrent ready for downloads
              </span>
            </motion.div>
          )}

          {/* Performance Monitoring */}
          {webtorrentStatus === 'ready' && (
            <motion.div 
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              className={`${isDark ? 'bg-purple-900' : 'bg-purple-50'} border border-purple-200 rounded-lg p-4 mb-6`}
            >
              <h3 className={`text-lg font-semibold mb-3 text-center ${isDark ? 'text-purple-200' : 'text-purple-800'}`}>
                📊 Performance Monitor
              </h3>
              <div className="grid md:grid-cols-3 gap-4 text-sm">
                <div className="text-center">
                  <div className={`font-medium ${isDark ? 'text-purple-300' : 'text-purple-700'}`}>
                    🚀 WebTorrent Status
                  </div>
                  <div className={isDark ? 'text-purple-200' : 'text-purple-600'}>
                    {webtorrentStatus === 'ready' ? 'Ready' : 'Loading...'}
                  </div>
                </div>
                <div className="text-center">
                  <div className={`font-medium ${isDark ? 'text-purple-300' : 'text-purple-700'}`}>
                    💾 File System API
                  </div>
                  <div className={isDark ? 'text-purple-200' : 'text-purple-600'}>
                    {fileSystemSupported ? 'Supported' : 'Not Supported'}
                  </div>
                </div>
                <div className="text-center">
                  <div className={`font-medium ${isDark ? 'text-purple-300' : 'text-purple-700'}`}>
                    🔒 HTTPS Required
                  </div>
                  <div className={isDark ? 'text-purple-200' : 'text-purple-600'}>
                    {window.location.protocol === 'https:' ? 'Yes' : 'No'}
                  </div>
                </div>
              </div>
              <div className="mt-3 p-2 bg-opacity-20 rounded text-xs text-center">
                                 <span className={isDark ? 'text-purple-300' : 'text-purple-700'}>
                   💡 Large files (&gt;300MB) may take longer to set up. Check logs for detailed progress.
                 </span>
              </div>
            </motion.div>
          )}

          {/* File System Access API Warning */}
          {!fileSystemSupported && (
            <motion.div 
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              className={`${isDark ? 'bg-yellow-900' : 'bg-yellow-50'} border border-yellow-200 rounded-lg p-4 mb-6 text-center`}
            >
              <div className="flex items-center justify-center space-x-2">
                <AlertCircle className="h-5 w-5 text-yellow-600" />
                <span className={`${isDark ? 'text-yellow-200' : 'text-yellow-800'}`}>
                  ⚠️ File System Access API not supported in this browser. 
                  File downloads may not work properly. Please use a modern browser like Chrome/Edge.
                </span>
              </div>
            </motion.div>
          )}

          {/* Magnet Link Input */}
          <motion.div 
            whileHover={{ scale: 1.02 }}
            className={`${isDark ? 'bg-gray-800' : 'bg-white'} rounded-xl p-6 shadow-lg border ${isDark ? 'border-gray-700' : 'border-gray-200'} mb-6`}
          >
            <h2 className={`text-2xl font-semibold mb-4 ${isDark ? 'text-white' : 'text-gray-900'}`}>
              <Link className="inline mr-2" />
              Enter Magnet Link
            </h2>
            <div className="space-y-4">
              <div>
                <label className={`block text-sm font-medium mb-2 ${isDark ? 'text-gray-300' : 'text-gray-700'}`}>
                  Magnet Link
                </label>
                <textarea
                  value={magnetLink}
                  onChange={(e) => setMagnetLink(e.target.value)}
                  placeholder="magnet:?xt=urn:btih:..."
                  rows={3}
                  className={`w-full px-3 py-2 rounded-lg border ${
                    isDark 
                      ? 'bg-gray-700 border-gray-600 text-white' 
                      : 'bg-white border-gray-300 text-gray-900'
                  } focus:ring-2 focus:ring-blue-500 focus:border-transparent resize-none`}
                />
              </div>
              <button
                onClick={startDownload}
                disabled={!magnetLink.trim() || isDownloading || webtorrentStatus !== 'ready' || !fileSystemSupported}
                className={`w-full py-3 px-6 rounded-lg font-medium transition-colors ${
                  magnetLink.trim() && !isDownloading && webtorrentStatus === 'ready' && fileSystemSupported
                    ? 'bg-blue-600 hover:bg-blue-700 text-white'
                    : 'bg-gray-500 text-gray-300 cursor-not-allowed'
                }`}
              >
                {isDownloading ? (
                  <span className="flex items-center justify-center">
                    <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white mr-2"></div>
                    Starting Download...
                  </span>
                ) : (
                  <span className="flex items-center justify-center">
                    <Download className="mr-2 h-5 w-5" />
                    Start Download
                  </span>
                )}
              </button>
              
              {!fileSystemSupported && (
                <p className={`text-xs text-center ${isDark ? 'text-yellow-400' : 'text-yellow-600'}`}>
                  File System Access API not supported. Please use Chrome/Edge for file downloads.
                </p>
              )}
              
              {/* Directory Selection Help */}
              <div className={`p-3 rounded-lg ${isDark ? 'bg-blue-900' : 'bg-blue-50'} border ${isDark ? 'border-blue-700' : 'border-blue-200'}`}>
                <h4 className={`text-sm font-medium mb-2 ${isDark ? 'text-blue-200' : 'text-blue-800'}`}>
                  💡 Directory Selection Tips:
                </h4>
                <ul className={`text-xs space-y-1 ${isDark ? 'text-blue-300' : 'text-blue-700'}`}>
                  <li>• <strong>✅ Good choices:</strong> Desktop, Downloads, Documents, or any folder you created</li>
                  <li>• <strong>❌ Avoid:</strong> System folders (Windows, Program Files), root drives (C:\), or protected locations</li>
                  <li>• <strong>🔒 Security:</strong> The browser will only allow access to user-selected, safe directories</li>
                </ul>
              </div>
            </div>
          </motion.div>

          {/* Active Downloads */}
          {activeTorrents.size > 0 && (
            <motion.div 
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              className={`${isDark ? 'bg-gray-800' : 'bg-white'} rounded-xl p-6 shadow-lg border ${isDark ? 'border-gray-700' : 'border-gray-200'} mb-6`}
            >
              <h3 className={`text-xl font-semibold mb-4 ${isDark ? 'text-white' : 'text-gray-900'}`}>
                <Download className="inline mr-2" />
                Active Downloads
              </h3>
              <div className="space-y-4">
                {Array.from(activeTorrents.entries()).map(([infoHash, torrent]) => {
                  const progress = downloadProgress.get(infoHash);
                  return (
                    <div key={infoHash} className={`p-4 rounded-lg ${isDark ? 'bg-gray-700' : 'bg-gray-100'}`}>
                      <div className="flex justify-between items-center mb-3">
                        <div className="flex items-center space-x-2">
                          <FileText className="h-5 w-5 text-blue-500" />
                          <span className={`text-lg font-medium ${isDark ? 'text-white' : 'text-gray-900'}`}>
                            {progress?.fileName || torrent.name || 'Unknown File'}
                          </span>
                        </div>
                        <div className="flex space-x-2">
                          <button
                            onClick={() => torrent.paused ? resumeTorrent(infoHash) : pauseTorrent(infoHash)}
                            className={`p-2 rounded-lg transition-colors ${
                              torrent.paused 
                                ? 'bg-green-600 hover:bg-green-700 text-white' 
                                : 'bg-yellow-600 hover:bg-yellow-700 text-white'
                            }`}
                            title={torrent.paused ? 'Resume' : 'Pause'}
                          >
                            {torrent.paused ? <Play className="h-4 w-4" /> : <Pause className="h-4 w-4" />}
                          </button>
                          <button
                            onClick={() => removeTorrent(infoHash)}
                            className="p-2 bg-red-600 hover:bg-red-700 text-white rounded-lg transition-colors"
                            title="Remove"
                          >
                            <X className="h-4 w-4" />
                          </button>
                        </div>
                      </div>
                      
                      {progress && (
                        <div className="space-y-3">
                          {/* Progress Bar */}
                          <div className="space-y-2">
                            <div className="flex justify-between text-sm">
                              <span className={isDark ? 'text-gray-300' : 'text-gray-600'}>
                                Progress: {progress.progress}%
                              </span>
                              <span className={isDark ? 'text-gray-300' : 'text-gray-600'}>
                                {progress.numPeers} peers
                              </span>
                            </div>
                            
                            <div className="w-full bg-gray-600 rounded-full h-3">
                              <div 
                                className="bg-blue-600 h-3 rounded-full transition-all duration-300"
                                style={{ width: `${progress.progress}%` }}
                              ></div>
                            </div>
                          </div>
                          
                          {/* Stats Grid */}
                          <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
                            <div className="text-center">
                              <div className={`font-medium ${isDark ? 'text-blue-300' : 'text-blue-700'}`}>
                                ↓ {progress.downloadSpeed} MB/s
                              </div>
                              <div className={isDark ? 'text-gray-400' : 'text-gray-500'}>Download</div>
                            </div>
                            <div className="text-center">
                              <div className={`font-medium ${isDark ? 'text-green-300' : 'text-green-700'}`}>
                                ↑ {progress.uploadSpeed} MB/s
                              </div>
                              <div className={isDark ? 'text-gray-400' : 'text-gray-500'}>Upload</div>
                            </div>
                            <div className="text-center">
                              <div className={`font-medium ${isDark ? 'text-purple-300' : 'text-purple-700'}`}>
                                {formatFileSize(progress.downloaded)}
                              </div>
                              <div className={isDark ? 'text-gray-400' : 'text-gray-500'}>Downloaded</div>
                            </div>
                            <div className="text-center">
                              <div className={`font-medium ${isDark ? 'text-orange-300' : 'text-orange-700'}`}>
                                {formatFileSize(progress.totalSize)}
                              </div>
                              <div className={isDark ? 'text-gray-400' : 'text-gray-500'}>Total Size</div>
                            </div>
                          </div>
                          
                          {/* ETA */}
                          {progress.timeRemaining > 0 && (
                            <div className="text-center">
                              <div className="flex items-center justify-center space-x-2">
                                <Clock className="h-4 w-4 text-gray-500" />
                                <span className={`text-sm ${isDark ? 'text-gray-300' : 'text-gray-600'}`}>
                                  ETA: {formatTime(progress.timeRemaining)}
                                </span>
                              </div>
                            </div>
                          )}
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            </motion.div>
          )}

          {/* Activity Logs */}
          <motion.div 
            whileHover={{ scale: 1.02 }}
            className={`${isDark ? 'bg-gray-800' : 'bg-white'} rounded-xl shadow-lg border ${isDark ? 'border-gray-700' : 'border-gray-200'}`}
          >
            <div className={`p-4 border-b ${isDark ? 'border-gray-700' : 'border-gray-200'}`}>
              <div className="flex justify-between items-center">
                <h3 className={`text-xl font-semibold ${isDark ? 'text-white' : 'text-gray-900'}`}>
                  📋 Activity Logs
                </h3>
                
                {/* Log Filter Controls */}
                <div className="flex space-x-2">
                  {['all', 'info', 'progress', 'success', 'error'].map((filter) => (
                    <button
                      key={filter}
                      onClick={() => setLogFilter(filter)}
                      className={`px-3 py-1 rounded-full text-xs font-medium transition-colors ${
                        logFilter === filter
                          ? 'bg-blue-600 text-white'
                          : isDark
                          ? 'bg-gray-700 text-gray-300 hover:bg-gray-600'
                          : 'bg-gray-200 text-gray-700 hover:bg-gray-300'
                      }`}
                    >
                      {filter === 'all' ? 'All' : filter.charAt(0).toUpperCase() + filter.slice(1)}
                    </button>
                  ))}
                </div>
              </div>
            </div>
            
            <div className="h-64 overflow-y-auto p-4 space-y-2">
              {logs.length === 0 ? (
                <p className={`text-center ${isDark ? 'text-gray-400' : 'text-gray-500'}`}>
                  No activity yet. Start a download to see logs here.
                </p>
              ) : (
                logs
                  .filter(log => logFilter === 'all' || log.type === logFilter)
                  .slice(-20)
                  .map((log) => (
                  <div
                    key={log.id}
                    className={`p-2 rounded text-xs ${
                      log.type === 'error' 
                        ? `${isDark ? 'bg-red-900' : 'bg-red-100'} ${isDark ? 'text-red-200' : 'text-red-800'}`
                        : log.type === 'success'
                        ? `${isDark ? 'bg-green-900' : 'bg-green-100'} ${isDark ? 'text-green-200' : 'text-green-800'}`
                        : log.type === 'progress'
                        ? `${isDark ? 'bg-blue-900' : 'bg-blue-100'} ${isDark ? 'text-blue-200' : 'text-blue-800'}`
                        : `${isDark ? 'bg-gray-700' : 'bg-gray-100'} ${isDark ? 'text-gray-300' : 'text-gray-700'}`
                    }`}
                  >
                    <div className="flex justify-between items-start">
                      <span className="flex-1">{log.message}</span>
                      <span className="ml-2 opacity-75">{log.timestamp}</span>
                    </div>
                  </div>
                ))
              )}
            </div>
          </motion.div>
        </div>
      </motion.main>
      <Footer />
    </div>
  );
};

export default DownloadPage;
