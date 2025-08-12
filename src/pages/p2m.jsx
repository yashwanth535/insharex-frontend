import { useState, useEffect, useRef } from 'react';
import { motion } from 'framer-motion';
import { 
  Users, 
  Upload, 
  Download, 
  Copy, 
  X, 
  Send, 
  MessageCircle,
  FileText,
  UserPlus,
  Lock,
  Unlock,
  Pause,
  Play
} from 'lucide-react';
import Header from '../components/Header';
import Footer from '../components/Footer';
import { useTheme } from '../context/ThemeContext';

const P2M = () => {
  const { isDark } = useTheme();
  const [ws, setWs] = useState(null);
  const [groupId, setGroupId] = useState(null);
  const [isHost, setIsHost] = useState(false);
  const [groupMembers, setGroupMembers] = useState([]);
  const [maxMembers, setMaxMembers] = useState(20);
  const [isGroupOpen, setIsGroupOpen] = useState(true);
  const [joinCode, setJoinCode] = useState('');
  const [chatMessages, setChatMessages] = useState([]);
  const [newMessage, setNewMessage] = useState('');
  const [selectedFile, setSelectedFile] = useState(null);
  const [isSharing, setIsSharing] = useState(false);
  const [sharedTorrents, setSharedTorrents] = useState([]);
  const [wsUrl] = useState(import.meta.env.VITE_WEBSOCKET_URL);
  const fileInputRef = useRef(null);
  
  // WebTorrent clients
  const [hostClient, setHostClient] = useState(null);
  const [downloadClient, setDownloadClient] = useState(null);
  const [activeTorrents, setActiveTorrents] = useState(new Map());
  const [downloadProgress, setDownloadProgress] = useState(new Map());
  const [webtorrentStatus, setWebtorrentStatus] = useState('loading'); // 'loading', 'ready', 'error'
  
  // New states for logs and progress tracking
  const [logs, setLogs] = useState([]);
  const [swarmStatus, setSwarmStatus] = useState({});
  const [completedDownloads, setCompletedDownloads] = useState(new Set());
  const [allFilesCompleted, setAllFilesCompleted] = useState(false);
  
  // Track progress intervals for cleanup
  const progressIntervals = useRef(new Map());

  useEffect(() => {
    connectWebSocket();
    initializeWebTorrent();
    
    return () => {
      cleanupWebTorrent();
      if (ws) {
        ws.close();
      }
    };
  }, []);

  const initializeWebTorrent = () => {
    // Initialize WebTorrent client for downloads
    if (typeof window !== 'undefined') {
      // Try to load WebTorrent from CDN first
      if (window.WebTorrent) {
        const client = new window.WebTorrent();
        setDownloadClient(client);
        setWebtorrentStatus('ready');
        
        // Handle torrent events
        client.on('error', (err) => {
          console.error('WebTorrent error:', err);
        });
        return;
      }

      // Fallback: Try to load from CDN
      const script = document.createElement('script');
      script.src = 'https://cdn.jsdelivr.net/npm/webtorrent@latest/webtorrent.min.js';
      script.onload = () => {
        if (window.WebTorrent) {
          const client = new window.WebTorrent();
          setDownloadClient(client);
          setWebtorrentStatus('ready');
          
          client.on('error', (err) => {
            console.error('WebTorrent error:', err);
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
    if (hostClient) {
      hostClient.destroy();
    }
    if (downloadClient) {
      downloadClient.destroy();
    }
    setActiveTorrents(new Map());
    setDownloadProgress(new Map());
    progressIntervals.current.forEach(clearInterval);
    progressIntervals.current.clear();
  };

  const addLog = (message, type = 'info') => {
    const logEntry = {
      id: Date.now(),
      message,
      type, // 'info', 'success', 'error', 'progress'
      timestamp: new Date().toLocaleTimeString()
    };
    setLogs(prev => [...prev, logEntry]);
  };

  const connectWebSocket = () => {
    const websocket = new WebSocket(wsUrl);
    
    websocket.onopen = () => {
      console.log('Connected to WebSocket server');
      setWs(websocket);
    };

    websocket.onmessage = (event) => {
      const data = JSON.parse(event.data);
      handleWebSocketMessage(data);
    };

    websocket.onclose = () => {
      console.log('Disconnected from WebSocket server');
      setWs(null);
    };

    websocket.onerror = (error) => {
      console.error('WebSocket error:', error);
    };
  };

  const handleWebSocketMessage = (data) => {
    switch (data.type) {
      case 'group-created':
        setGroupId(data.groupId);
        setIsHost(true);
        setGroupMembers([{ id: 'host', isHost: true }]);
        addLog(`Group created: ${data.groupId}`, 'success');
        console.log(`Group created: ${data.groupId}`);
        break;

      case 'group-joined':
        setGroupId(data.groupId);
        setIsHost(false);
        setGroupMembers(prev => [...prev, { id: 'member', isHost: false }]);
        addLog(`Joined group: ${data.groupId}`, 'success');
        console.log(`Joined group: ${data.groupId}`);
        break;

      case 'member-joined':
        setGroupMembers(prev => [...prev, { id: `member-${Date.now()}`, isHost: false }]);
        addLog('New member joined the group', 'info');
        break;

      case 'group-closed':
        setIsGroupOpen(false);
        if (data.reason) {
          addLog(`Group closed: ${data.reason}`, 'error');
        }
        break;

      case 'torrent-shared':
        setSharedTorrents(prev => [...prev, {
          id: Date.now(),
          fileName: data.fileName,
          fileSize: data.fileSize,
          magnetLink: data.magnetLink,
          groupId: data.groupId,
          infoHash: data.infoHash
        }]);
        addLog(`File shared: ${data.fileName}`, 'info');
        break;

      case 'group-chat':
        // Only add actual chat messages, not system messages
        if (data.message && !data.message.startsWith('System:')) {
          setChatMessages(prev => [...prev, {
            id: Date.now(),
            text: data.message,
            sender: data.sender,
            isSystem: false
          }]);
        }
        break;

      default:
        console.log('Unknown message type:', data.type);
    }
  };

  const createGroup = () => {
    if (ws && ws.readyState === WebSocket.OPEN) {
      ws.send(JSON.stringify({
        type: 'create-group',
        maxMembers: parseInt(maxMembers)
      }));
    }
  };

  const joinGroup = () => {
    if (ws && ws.readyState === WebSocket.OPEN && joinCode.trim()) {
      ws.send(JSON.stringify({
        type: 'join-group',
        groupId: joinCode.trim()
      }));
    }
  };

  const closeGroup = () => {
    if (ws && ws.readyState === WebSocket.OPEN && groupId) {
      ws.send(JSON.stringify({
        type: 'close-group',
        groupId
      }));
      setIsGroupOpen(false);
    }
  };

  const sendChatMessage = () => {
    if (newMessage.trim() && ws && ws.readyState === WebSocket.OPEN && groupId) {
      const messageData = {
        id: Date.now(),
        text: newMessage.trim(),
        sender: isHost ? 'Host' : 'Member',
        isSystem: false
      };
      
      // Add message immediately to show it for the sender
      setChatMessages(prev => [...prev, messageData]);
      
      // Send to other members
      ws.send(JSON.stringify({
        type: 'group-chat',
        groupId,
        message: newMessage.trim(),
        sender: isHost ? 'Host' : 'Member'
      }));
      
      setNewMessage('');
    }
  };

  // Tab restriction functionality
  useEffect(() => {
    if (allFilesCompleted) {
      // Allow tab operations when all files are completed
      return;
    }

    const handleBeforeUnload = (e) => {
      if (!allFilesCompleted) {
        e.preventDefault();
        e.returnValue = 'Please wait for all files to be downloaded before closing this tab.';
        return 'Please wait for all files to be downloaded before closing this tab.';
      }
    };

    const handleVisibilityChange = () => {
      if (document.hidden && !allFilesCompleted) {
        // Show warning when tab is minimized/backgrounded
        addLog('Warning: Tab minimized while files are still downloading', 'error');
      }
    };

    window.addEventListener('beforeunload', handleBeforeUnload);
    document.addEventListener('visibilitychange', handleVisibilityChange);

    return () => {
      window.removeEventListener('beforeunload', handleBeforeUnload);
      document.removeEventListener('visibilitychange', handleVisibilityChange);
    };
  }, [allFilesCompleted]);

  const handleFileSelect = (event) => {
    const file = event.target.files[0];
    if (file) {
      setSelectedFile(file);
    }
  };

  const shareFile = async () => {
    if (!selectedFile || !isHost || !groupId) return;

    setIsSharing(true);
    addLog(`Starting to seed file: ${selectedFile.name}`, 'info');
    
    try {
      // Check if WebTorrent is available
      if (typeof window === 'undefined' || !window.WebTorrent) {
        throw new Error('WebTorrent is not available. Please refresh the page and try again.');
      }

      // Initialize WebTorrent client for seeding
      const client = new window.WebTorrent();
      setHostClient(client);

      // Seed the file
      client.seed(selectedFile, (torrent) => {
        console.log('Seeding torrent:', torrent.infoHash);
        console.log('Magnet URI:', torrent.magnetURI);
        
        addLog(`File seeded successfully. Info Hash: ${torrent.infoHash}`, 'success');

        // Store active torrent
        setActiveTorrents(prev => new Map(prev.set(torrent.infoHash, torrent)));

        // Initialize swarm status
        setSwarmStatus(prev => ({
          ...prev,
          [torrent.infoHash]: {
            fileName: selectedFile.name,
            totalSize: selectedFile.size,
            uploadedChunks: 0,
            totalChunks: Math.ceil(selectedFile.size / (16 * 1024)), // 16KB chunks
            progress: 0,
            peers: 0
          }
        }));

        // Send magnet link to group members
        if (ws && ws.readyState === WebSocket.OPEN) {
          ws.send(JSON.stringify({
            type: 'share-torrent',
            groupId,
            magnetLink: torrent.magnetURI,
            fileName: selectedFile.name,
            fileSize: selectedFile.size,
            infoHash: torrent.infoHash
          }));
        }

        // Set up progress monitoring with setInterval for more reliable updates
        const progressInterval = setInterval(() => {
          if (torrent && !torrent.destroyed) {
            const uploadedBytes = torrent.uploaded;
            const uploadedChunks = Math.floor(uploadedBytes / (16 * 1024));
            const progress = Math.min((uploadedBytes / selectedFile.size) * 100, 100);
            
            setSwarmStatus(prev => ({
              ...prev,
              [torrent.infoHash]: {
                ...prev[torrent.infoHash],
                uploadedChunks,
                progress: progress.toFixed(1),
                peers: torrent.numPeers
              }
            }));
            
            // Log progress every 5% or when chunks change significantly
            if (progress % 5 < 1 && progress > 0) {
              addLog(`Upload progress: ${progress.toFixed(1)}% - ${uploadedChunks} chunks (${(uploadedBytes / 1024 / 1024).toFixed(2)} MB)`, 'progress');
            }
          } else {
            clearInterval(progressInterval);
            progressIntervals.current.delete(torrent.infoHash);
          }
        }, 500); // Update every 500ms for more responsive UI
        
        // Store interval for cleanup
        progressIntervals.current.set(torrent.infoHash, progressInterval);

        // Monitor seeding progress
        torrent.on('upload', (bytes) => {
          // This event fires when data is uploaded, but we're using setInterval for consistent updates
          addLog(`Data uploaded: ${(bytes / 1024 / 1024).toFixed(2)} MB`, 'info');
        });

        torrent.on('done', () => {
          addLog('Seeding complete - all chunks uploaded', 'success');
          clearInterval(progressInterval);
          progressIntervals.current.delete(torrent.infoHash);
        });

        // Clean up interval when torrent is destroyed
        torrent.on('close', () => {
          clearInterval(progressInterval);
          progressIntervals.current.delete(torrent.infoHash);
        });

        torrent.on('wire', (wire) => {
          addLog(`New peer connected: ${wire.peerId}`, 'info');
        });

        setSelectedFile(null);
        if (fileInputRef.current) {
          fileInputRef.current.value = '';
        }
        setIsSharing(false);
      });

      client.on('error', (err) => {
        console.error('WebTorrent seeding error:', err);
        addLog(`Seeding error: ${err.message}`, 'error');
        setIsSharing(false);
      });
    } catch (error) {
      console.error('Error sharing file:', error);
      addLog(`Error sharing file: ${error.message}`, 'error');
      setIsSharing(false);
    }
  };

  const downloadTorrent = async (magnetLink, fileName, infoHash) => {
    if (!downloadClient) {
      console.error('Download client not initialized');
      addLog('Download client not ready. Please refresh the page and try again.', 'error');
      return;
    }

    try {
      // Check if already downloading
      if (activeTorrents.has(infoHash)) {
        console.log('Already downloading this torrent');
        addLog('Already downloading this file.', 'info');
        return;
      }

      addLog(`Starting download: ${fileName}`, 'info');

      // Add torrent to download client
      downloadClient.add(magnetLink, (torrent) => {
        console.log('Downloading torrent:', torrent.infoHash);
        
        // Store active torrent
        setActiveTorrents(prev => new Map(prev.set(infoHash, torrent)));

        // Initialize progress tracking
        setDownloadProgress(prev => new Map(prev.set(infoHash, {
          progress: 0,
          downloadSpeed: 0,
          uploadSpeed: 0,
          numPeers: 0,
          timeRemaining: 0
        })));

        // Monitor download progress
        torrent.on('download', (bytes) => {
          const progress = (torrent.progress * 100).toFixed(1);
          const downloadSpeed = (torrent.downloadSpeed / 1024 / 1024).toFixed(2);
          const uploadSpeed = (torrent.uploadSpeed / 1024 / 1024).toFixed(2);
          const numPeers = torrent.numPeers;
          const timeRemaining = torrent.timeRemaining / 1000;

          // Calculate chunks received
          const totalSize = torrent.length;
          const receivedChunks = Math.floor((torrent.downloaded / totalSize) * Math.ceil(totalSize / (16 * 1024)));

          setDownloadProgress(prev => new Map(prev.set(infoHash, {
            progress,
            downloadSpeed,
            uploadSpeed,
            numPeers,
            timeRemaining: timeRemaining > 0 ? timeRemaining : 0
          })));

          // Log progress every 10%
          if (progress % 10 < 1 && progress > 0) {
            addLog(`Download progress: ${progress}% - Received ${receivedChunks} chunks`, 'progress');
          }
        });

        torrent.on('done', () => {
          console.log('Download complete:', fileName);
          addLog(`Download complete: ${fileName}`, 'success');
          
          // Mark as completed
          setCompletedDownloads(prev => new Set([...prev, infoHash]));
          
          // Check if all files are completed
          const allCompleted = sharedTorrents.every(t => 
            completedDownloads.has(t.infoHash) || t.infoHash === infoHash
          );
          
          if (allCompleted) {
            setAllFilesCompleted(true);
            addLog('All files have been downloaded by all members!', 'success');
          }
          
          // Create download link for the file
          torrent.files.forEach((file) => {
            file.getBlobURL((err, url) => {
              if (err) {
                console.error('Error getting blob URL:', err);
                addLog(`Error creating download for ${fileName}`, 'error');
                return;
              }
              
              // Create download link
              const a = document.createElement('a');
              a.href = url;
              a.download = fileName;
              document.body.appendChild(a);
              a.click();
              document.body.removeChild(a);
              
              // Clean up
              URL.revokeObjectURL(url);
            });
          });

          // Remove from active torrents
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
        });

        torrent.on('error', (err) => {
          console.error('Download error:', err);
          addLog(`Download error for ${fileName}: ${err.message}`, 'error');
        });
      });
    } catch (error) {
      console.error('Error downloading torrent:', error);
      addLog(`Failed to start download: ${error.message}`, 'error');
    }
  };

  const pauseTorrent = (infoHash) => {
    const torrent = activeTorrents.get(infoHash);
    if (torrent) {
      torrent.pause();
    }
  };

  const resumeTorrent = (infoHash) => {
    const torrent = activeTorrents.get(infoHash);
    if (torrent) {
      torrent.resume();
    }
  };

  const removeTorrent = (infoHash) => {
    const torrent = activeTorrents.get(infoHash);
    if (torrent) {
      torrent.destroy();
      
      // Clear progress interval
      if (progressIntervals.current.has(infoHash)) {
        clearInterval(progressIntervals.current.get(infoHash));
        progressIntervals.current.delete(infoHash);
      }
      
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

  const copyToClipboard = (text) => {
    navigator.clipboard.writeText(text);
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

  if (!ws) {
    return (
      <div className={`min-h-screen ${isDark ? 'bg-gray-900' : 'bg-gray-50'} flex items-center justify-center`}>
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-500 mx-auto mb-4"></div>
          <p className={isDark ? 'text-gray-300' : 'text-gray-600'}>Connecting to server...</p>
        </div>
      </div>
    );
  }

  return (
    <div className={`min-h-screen ${isDark ? 'bg-gray-900' : 'bg-gray-50'}`}>
      <Header />
      <motion.main 
        initial={{ opacity: 0, y: 20 }} 
        animate={{ opacity: 1, y: 0 }} 
        transition={{ duration: 0.5 }} 
        className="container mx-auto px-4 pt-28 pb-16"
      >
        <div className="max-w-6xl mx-auto">
          <h1 className={`text-4xl font-bold mb-8 text-center ${isDark ? 'text-white' : 'text-gray-900'}`}>
            One to Many File Sharing
          </h1>

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
                  ⚠️ WebTorrent failed to load. File sharing may not work properly.
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
                ✅ WebTorrent ready for file sharing
              </span>
            </motion.div>
          )}

          {/* Swarm Status */}
          {Object.keys(swarmStatus).length > 0 && (
            <motion.div 
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              className={`${isDark ? 'bg-blue-900' : 'bg-blue-50'} border border-blue-200 rounded-lg p-4 mb-6`}
            >
              <h3 className={`text-lg font-semibold mb-3 text-center ${isDark ? 'text-blue-200' : 'text-blue-800'}`}>
                🌐 Swarm Status
              </h3>
              <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-4">
                {Object.entries(swarmStatus).map(([infoHash, status]) => {
                  const torrent = activeTorrents.get(infoHash);
                  return (
                    <div key={infoHash} className={`p-3 rounded-lg ${isDark ? 'bg-blue-800' : 'bg-blue-100'}`}>
                      <h4 className={`font-medium mb-2 ${isDark ? 'text-blue-200' : 'text-blue-800'}`}>
                        {status.fileName}
                      </h4>
                      
                      {/* Magnet Link Display for Host */}
                      {isHost && torrent && (
                        <div className="mb-3">
                          <label className={`block text-xs font-medium mb-1 ${isDark ? 'text-blue-300' : 'text-blue-700'}`}>
                            Magnet Link (for external torrent apps):
                          </label>
                          <div className="flex items-center space-x-2">
                            <input
                              type="text"
                              value={torrent.magnetURI || ''}
                              readOnly
                              className={`flex-1 px-2 py-1 text-xs rounded border ${
                                isDark 
                                  ? 'bg-blue-700 border-blue-600 text-blue-200' 
                                  : 'bg-blue-200 border-blue-300 text-blue-800'
                              }`}
                            />
                            <button
                              onClick={() => copyToClipboard(torrent.magnetURI)}
                              className="p-1 hover:bg-blue-600 rounded"
                              title="Copy magnet link"
                            >
                              <Copy className="h-3 w-3" />
                            </button>
                          </div>
                        </div>
                      )}
                      
                      <div className="space-y-2 text-sm">
                        <div className="flex justify-between">
                          <span className={isDark ? 'text-blue-300' : 'text-blue-700'}>Progress:</span>
                          <span className={isDark ? 'text-blue-200' : 'text-blue-800'}>{status.progress}%</span>
                        </div>
                        <div className="flex justify-between">
                          <span className={isDark ? 'text-blue-300' : 'text-blue-700'}>Chunks:</span>
                          <span className={isDark ? 'text-blue-200' : 'text-blue-800'}>
                            {status.uploadedChunks}/{status.totalChunks}
                          </span>
                        </div>
                        <div className="flex justify-between">
                          <span className={isDark ? 'text-blue-300' : 'text-blue-700'}>Peers:</span>
                          <span className={isDark ? 'text-blue-200' : 'text-blue-800'}>{status.peers}</span>
                        </div>
                        
                        {/* Upload Speed for Host */}
                        {isHost && torrent && (
                          <div className="flex justify-between">
                            <span className={isDark ? 'text-blue-300' : 'text-blue-700'}>Upload Speed:</span>
                            <span className={isDark ? 'text-blue-200' : 'text-blue-800'}>
                              ↑ {((torrent.uploadSpeed || 0) / 1024 / 1024).toFixed(2)} MB/s
                            </span>
                          </div>
                        )}
                        
                        <div className="w-full bg-blue-600 rounded-full h-2">
                          <div 
                            className="bg-green-400 h-2 rounded-full transition-all duration-300"
                            style={{ width: `${status.progress}%` }}
                          ></div>
                        </div>
                        
                        {/* Control Buttons for Host */}
                        {isHost && torrent && (
                          <div className="flex justify-center space-x-2 mt-2">
                            <button
                              onClick={() => torrent.paused ? resumeTorrent(infoHash) : pauseTorrent(infoHash)}
                              className="p-1 hover:bg-blue-600 rounded"
                              title={torrent.paused ? 'Resume' : 'Pause'}
                            >
                              {torrent.paused ? <Play className="h-3 w-3" /> : <Pause className="h-3 w-3" />}
                            </button>
                            <button
                              onClick={() => removeTorrent(infoHash)}
                              className="p-1 hover:bg-blue-600 rounded text-red-300"
                              title="Remove"
                            >
                              <X className="h-3 w-3" />
                            </button>
                          </div>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
              
              {/* Completion Status */}
              <div className="mt-4 pt-4 border-t border-blue-300 text-center">
                <div className="flex justify-center items-center space-x-4">
                  <span className={`${isDark ? 'text-blue-200' : 'text-blue-800'}`}>
                    Files Completed: {completedDownloads.size}/{sharedTorrents.length}
                  </span>
                  {allFilesCompleted && (
                    <span className={`${isDark ? 'text-green-200' : 'text-green-800'} font-semibold`}>
                      🎉 All files completed! You can now close this tab.
                    </span>
                  )}
                </div>
              </div>
            </motion.div>
          )}

          {!groupId ? (
            <div className="grid md:grid-cols-2 gap-8">
              {/* Create Group */}
              <motion.div 
                whileHover={{ scale: 1.02 }}
                className={`${isDark ? 'bg-gray-800' : 'bg-white'} rounded-xl p-6 shadow-lg border ${isDark ? 'border-gray-700' : 'border-gray-200'}`}
              >
                <h2 className={`text-2xl font-semibold mb-4 ${isDark ? 'text-white' : 'text-gray-900'}`}>
                  <Users className="inline mr-2" />
                  Create Group
                </h2>
                <div className="space-y-4">
                  <div>
                    <label className={`block text-sm font-medium mb-2 ${isDark ? 'text-gray-300' : 'text-gray-700'}`}>
                      Max Members
                    </label>
                    <input
                      type="number"
                      min="1"
                      max="50"
                      value={maxMembers}
                      onChange={(e) => setMaxMembers(e.target.value)}
                      className={`w-full px-3 py-2 rounded-lg border ${
                        isDark 
                          ? 'bg-gray-700 border-gray-600 text-white' 
                          : 'bg-white border-gray-300 text-gray-900'
                      } focus:ring-2 focus:ring-blue-500 focus:border-transparent`}
                    />
                  </div>
                  <button
                    onClick={createGroup}
                    className="w-full bg-blue-600 hover:bg-blue-700 text-white font-medium py-2 px-4 rounded-lg transition-colors"
                  >
                    Create Group
                  </button>
                </div>
              </motion.div>

              {/* Join Group */}
              <motion.div 
                whileHover={{ scale: 1.02 }}
                className={`${isDark ? 'bg-gray-800' : 'bg-white'} rounded-xl p-6 shadow-lg border ${isDark ? 'border-gray-700' : 'border-gray-200'}`}
              >
                <h2 className={`text-2xl font-semibold mb-4 ${isDark ? 'text-white' : 'text-gray-900'}`}>
                  <UserPlus className="inline mr-2" />
                  Join Group
                </h2>
                <div className="space-y-4">
                  <div>
                    <label className={`block text-sm font-medium mb-2 ${isDark ? 'text-gray-300' : 'text-gray-700'}`}>
                      Group Code
                    </label>
                    <input
                      type="text"
                      value={joinCode}
                      onChange={(e) => setJoinCode(e.target.value)}
                      placeholder="Enter 6-digit code"
                      className={`w-full px-3 py-2 rounded-lg border ${
                        isDark 
                          ? 'bg-gray-700 border-gray-600 text-white' 
                          : 'bg-white border-gray-300 text-gray-900'
                      } focus:ring-2 focus:ring-blue-500 focus:border-transparent`}
                    />
                  </div>
                  <button
                    onClick={joinGroup}
                    className="w-full bg-green-600 hover:bg-green-700 text-white font-medium py-2 px-4 rounded-lg transition-colors"
                  >
                    Join Group
                  </button>
                </div>
              </motion.div>
            </div>
          ) : (
            <div className="grid lg:grid-cols-3 gap-6">
              {/* Group Info */}
              <div className="lg:col-span-1">
                <motion.div 
                  whileHover={{ scale: 1.02 }}
                  className={`${isDark ? 'bg-gray-800' : 'bg-white'} rounded-xl p-6 shadow-lg border ${isDark ? 'border-gray-700' : 'border-gray-200'} mb-6`}
                >
                  <h3 className={`text-xl font-semibold mb-4 ${isDark ? 'text-white' : 'text-gray-900'}`}>
                    Group Info
                  </h3>
                  <div className="space-y-3">
                    <div className="flex justify-between">
                      <span className={isDark ? 'text-gray-300' : 'text-gray-600'}>Code:</span>
                      <div className="flex items-center space-x-2">
                        <span className={`font-mono font-bold ${isDark ? 'text-blue-400' : 'text-blue-600'}`}>
                          {groupId}
                        </span>
                        <button
                          onClick={() => copyToClipboard(groupId)}
                          className="p-1 hover:bg-gray-600 rounded"
                        >
                          <Copy className="h-4 w-4" />
                        </button>
                      </div>
                    </div>
                    <div className="flex justify-between">
                      <span className={isDark ? 'text-gray-300' : 'text-gray-600'}>Members:</span>
                      <span className={isDark ? 'text-white' : 'text-gray-900'}>
                        {groupMembers.length}/{maxMembers}
                      </span>
                    </div>
                    <div className="flex justify-between">
                      <span className={isDark ? 'text-gray-300' : 'text-gray-600'}>Status:</span>
                      <span className={`flex items-center ${isGroupOpen ? 'text-green-500' : 'text-red-500'}`}>
                        {isGroupOpen ? <Unlock className="h-4 w-4 mr-1" /> : <Lock className="h-4 w-4 mr-1" />}
                        {isGroupOpen ? 'Open' : 'Closed'}
                      </span>
                    </div>
                  </div>
                  
                  {isHost && (
                    <div className="mt-4 pt-4 border-t border-gray-600">
                      <button
                        onClick={closeGroup}
                        disabled={!isGroupOpen}
                        className={`w-full py-2 px-4 rounded-lg font-medium transition-colors ${
                          isGroupOpen
                            ? 'bg-red-600 hover:bg-red-700 text-white'
                            : 'bg-gray-500 text-gray-300 cursor-not-allowed'
                        }`}
                      >
                        Close Group
                      </button>
                    </div>
                  )}
                </motion.div>

                {/* File Sharing (Host Only) */}
                {isHost && (
                  <motion.div 
                    whileHover={{ scale: 1.02 }}
                    className={`${isDark ? 'bg-gray-800' : 'bg-white'} rounded-xl p-6 shadow-lg border ${isDark ? 'border-gray-700' : 'border-gray-200'}`}
                  >
                    <h3 className={`text-xl font-semibold mb-4 ${isDark ? 'text-white' : 'text-gray-900'}`}>
                      <Upload className="inline mr-2" />
                      Share Files
                    </h3>
                    <div className="space-y-4">
                      <input
                        ref={fileInputRef}
                        type="file"
                        onChange={handleFileSelect}
                        className={`w-full px-3 py-2 rounded-lg border ${
                          isDark 
                            ? 'bg-gray-700 border-gray-600 text-white' 
                            : 'bg-white border-gray-300 text-gray-900'
                        }`}
                      />
                      {selectedFile && (
                        <div className={`p-3 rounded-lg ${isDark ? 'bg-gray-700' : 'bg-gray-100'}`}>
                          <p className={`text-sm ${isDark ? 'text-gray-300' : 'text-gray-700'}`}>
                            Selected: {selectedFile.name}
                          </p>
                          <p className={`text-xs ${isDark ? 'text-gray-400' : 'text-gray-500'}`}>
                            Size: {formatFileSize(selectedFile.size)}
                          </p>
                        </div>
                      )}
                      <button
                        onClick={shareFile}
                        disabled={!selectedFile || isSharing || webtorrentStatus !== 'ready'}
                        className={`w-full py-2 px-4 rounded-lg font-medium transition-colors ${
                          selectedFile && !isSharing && webtorrentStatus === 'ready'
                            ? 'bg-blue-600 hover:bg-blue-700 text-white'
                            : 'bg-gray-500 text-gray-300 cursor-not-allowed'
                        }`}
                      >
                        {isSharing ? 'Seeding...' : 'Share File'}
                      </button>
                      
                      {webtorrentStatus !== 'ready' && (
                        <p className={`text-xs text-center ${isDark ? 'text-gray-400' : 'text-gray-500'}`}>
                          WebTorrent client is not ready. Please wait or refresh the page.
                        </p>
                      )}
                    </div>
                  </motion.div>
                )}

                {/* Shared Torrents */}
                {sharedTorrents.length > 0 && (
                  <motion.div 
                    whileHover={{ scale: 1.02 }}
                    className={`${isDark ? 'bg-gray-800' : 'bg-white'} rounded-xl p-6 shadow-lg border ${isDark ? 'border-gray-700' : 'border-gray-200'} mt-6`}
                  >
                    <h3 className={`text-xl font-semibold mb-4 ${isDark ? 'text-white' : 'text-gray-900'}`}>
                      <FileText className="inline mr-2" />
                      Shared Files
                    </h3>
                    <div className="space-y-3">
                      {sharedTorrents.map((torrent) => (
                        <div key={torrent.id} className={`p-3 rounded-lg ${isDark ? 'bg-gray-700' : 'bg-gray-100'}`}>
                          <div className="flex justify-between items-start mb-2">
                            <div>
                              <p className={`font-medium ${isDark ? 'text-white' : 'text-gray-900'}`}>
                                {torrent.fileName}
                              </p>
                              <p className={`text-xs ${isDark ? 'text-gray-400' : 'text-gray-500'}`}>
                                {formatFileSize(torrent.fileSize)}
                              </p>
                            </div>
                            <button
                              onClick={() => downloadTorrent(torrent.magnetLink, torrent.fileName, torrent.infoHash)}
                              className="bg-green-600 hover:bg-green-700 text-white p-2 rounded-lg"
                            >
                              <Download className="h-4 w-4" />
                            </button>
                          </div>
                          <div className="flex items-center space-x-2">
                            <input
                              type="text"
                              value={torrent.magnetLink}
                              readOnly
                              className={`flex-1 px-2 py-1 text-xs rounded border ${
                                isDark 
                                  ? 'bg-gray-600 border-gray-500 text-gray-300' 
                                  : 'bg-gray-200 border-gray-300 text-gray-700'
                              }`}
                            />
                            <button
                              onClick={() => copyToClipboard(torrent.magnetLink)}
                              className="p-1 hover:bg-gray-600 rounded"
                            >
                              <Copy className="h-3 w-3" />
                            </button>
                          </div>
                        </div>
                      ))}
                    </div>
                  </motion.div>
                )}

                {/* Active Downloads (for non-hosts) */}
                {!isHost && activeTorrents.size > 0 && (
                  <motion.div 
                    whileHover={{ scale: 1.02 }}
                    className={`${isDark ? 'bg-gray-800' : 'bg-white'} rounded-xl p-6 shadow-lg border ${isDark ? 'border-gray-700' : 'border-gray-200'} mt-6`}
                  >
                    <h3 className={`text-xl font-semibold mb-4 ${isDark ? 'text-white' : 'text-gray-900'}`}>
                      <Download className="inline mr-2" />
                      Active Downloads
                    </h3>
                    <div className="space-y-3">
                      {Array.from(activeTorrents.entries()).map(([infoHash, torrent]) => {
                        const progress = downloadProgress.get(infoHash);
                        return (
                          <div key={infoHash} className={`p-3 rounded-lg ${isDark ? 'bg-gray-700' : 'bg-gray-100'}`}>
                            <div className="flex justify-between items-center mb-2">
                              <span className={`text-sm font-medium ${isDark ? 'text-white' : 'text-gray-900'}`}>
                                {torrent.name || 'Unknown File'}
                              </span>
                              <div className="flex space-x-1">
                                <button
                                  onClick={() => torrent.paused ? resumeTorrent(infoHash) : pauseTorrent(infoHash)}
                                  className="p-1 hover:bg-gray-600 rounded"
                                >
                                  {torrent.paused ? <Play className="h-3 w-3" /> : <Pause className="h-3 w-3" />}
                                </button>
                                <button
                                  onClick={() => removeTorrent(infoHash)}
                                  className="p-1 hover:bg-gray-600 rounded text-red-400"
                                >
                                  <X className="h-3 w-3" />
                                </button>
                              </div>
                            </div>
                            
                            {progress && (
                              <div className="space-y-2">
                                <div className="flex justify-between text-xs">
                                  <span className={isDark ? 'text-gray-300' : 'text-gray-600'}>
                                    Progress: {progress.progress}%
                                  </span>
                                  <span className={isDark ? 'text-gray-300' : 'text-gray-600'}>
                                    {progress.numPeers} peers
                                  </span>
                                </div>
                                
                                <div className="w-full bg-gray-600 rounded-full h-2">
                                  <div 
                                    className="bg-blue-600 h-2 rounded-full transition-all duration-300"
                                    style={{ width: `${progress.progress}%` }}
                                  ></div>
                                </div>
                                
                                <div className="flex justify-between text-xs">
                                  <span className={isDark ? 'text-gray-400' : 'text-gray-500'}>
                                    ↓ {progress.downloadSpeed} MB/s
                                  </span>
                                  <span className={isDark ? 'text-gray-400' : 'text-gray-500'}>
                                    ↑ {progress.uploadSpeed} MB/s
                                  </span>
                                </div>
                                
                                {progress.timeRemaining > 0 && (
                                  <div className="text-xs text-center">
                                    <span className={isDark ? 'text-gray-400' : 'text-gray-500'}>
                                      ETA: {formatTime(progress.timeRemaining)}
                                    </span>
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
              </div>

              {/* Chat */}
              <div className="lg:col-span-1">
                <motion.div 
                  whileHover={{ scale: 1.02 }}
                  className={`${isDark ? 'bg-gray-800' : 'bg-white'} rounded-xl shadow-lg border ${isDark ? 'border-gray-700' : 'border-gray-200'} h-96 flex flex-col`}
                >
                  <div className={`p-4 border-b ${isDark ? 'border-gray-700' : 'border-gray-200'}`}>
                    <h3 className={`text-xl font-semibold ${isDark ? 'text-white' : 'text-gray-900'}`}>
                      <MessageCircle className="inline mr-2" />
                      Group Chat
                    </h3>
                  </div>
                  
                  <div className="flex-1 overflow-y-auto p-4 space-y-3">
                    {chatMessages.length === 0 ? (
                      <p className={`text-center ${isDark ? 'text-gray-400' : 'text-gray-500'}`}>
                        No messages yet. Start the conversation!
                      </p>
                    ) : (
                      chatMessages.map((message) => (
                        <div
                          key={message.id}
                          className={`p-3 rounded-lg ${
                            message.isSystem
                              ? `${isDark ? 'bg-gray-700' : 'bg-gray-100'} ${isDark ? 'text-gray-300' : 'text-gray-600'} text-center text-sm`
                              : `${isDark ? 'bg-blue-600' : 'bg-blue-100'} ${isDark ? 'text-white' : 'text-blue-900'}`
                          }`}
                        >
                          {!message.isSystem && (
                            <div className="text-xs opacity-75 mb-1">
                              {message.sender}
                            </div>
                          )}
                          {message.text}
                        </div>
                      ))
                    )}
                  </div>
                  
                  <div className={`p-4 border-t ${isDark ? 'border-gray-700' : 'border-gray-200'}`}>
                    <div className="flex space-x-2">
                      <input
                        type="text"
                        value={newMessage}
                        onChange={(e) => setNewMessage(e.target.value)}
                        onKeyPress={(e) => e.key === 'Enter' && sendChatMessage()}
                        placeholder="Type your message..."
                        className={`flex-1 px-3 py-2 rounded-lg border ${
                          isDark 
                            ? 'bg-gray-700 border-gray-600 text-white' 
                            : 'bg-white border-gray-300 text-gray-900'
                        } focus:ring-2 focus:ring-blue-500 focus:border-transparent`}
                      />
                      <button
                        onClick={sendChatMessage}
                        className="bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-lg transition-colors"
                      >
                        <Send className="h-4 w-4" />
                      </button>
                    </div>
                  </div>
                </motion.div>
              </div>

              {/* Logs */}
              <div className="lg:col-span-1">
                <motion.div 
                  whileHover={{ scale: 1.02 }}
                  className={`${isDark ? 'bg-gray-800' : 'bg-white'} rounded-xl shadow-lg border ${isDark ? 'border-gray-700' : 'border-gray-200'} h-96 flex flex-col`}
                >
                  <div className={`p-4 border-b ${isDark ? 'border-gray-700' : 'border-gray-200'}`}>
                    <h3 className={`text-xl font-semibold ${isDark ? 'text-white' : 'text-gray-900'}`}>
                      📋 Activity Logs
                    </h3>
                  </div>
                  
                  <div className="flex-1 overflow-y-auto p-4 space-y-2">
                    {logs.length === 0 ? (
                      <p className={`text-center ${isDark ? 'text-gray-400' : 'text-gray-500'}`}>
                        No activity yet
                      </p>
                    ) : (
                      logs.slice(-20).map((log) => (
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
            </div>
          )}
        </div>
      </motion.main>
      <Footer />
    </div>
  );
};

export default P2M;
