import { useState, useEffect, useRef } from 'react';
import { Upload, Download, FileUp, Users, Send, RefreshCw, Copy, Check } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { useTheme } from '../context/ThemeContext';
import Chat from '../components/Chat';

const wsurl = import.meta.env.VITE_WEBSOCKET_URL;
const ws = new WebSocket(wsurl);

const FileShare = () => {
  const { isDark } = useTheme();
  const [roomId, setRoomId] = useState('');
  const [peerConnected, setPeerConnected] = useState(false);
  const [file, setFile] = useState(null);
  const [status, setStatus] = useState('');
  const [sendProgress, setSendProgress] = useState(0);
  const [receiveProgress, setReceiveProgress] = useState(0);
  const [processingTime, setProcessingTime] = useState(0);
  const [isDownloading, setIsDownloading] = useState(false);
  const [receivingFileName, setReceivingFileName] = useState('');
  const [isReceiver, setIsReceiver] = useState(false);
  const [fileReady, setFileReady] = useState(false);
  const [isRoomCreator, setIsRoomCreator] = useState(false);
  const [copiedRoomId, setCopiedRoomId] = useState(false);

  // WebRTC refs
  const peerConnectionRef = useRef(null);
  const dataChannelRef = useRef(null);
  const wsRef = useRef(null);
  const fileInputRef = useRef(null);
  const receivedChunksRef = useRef([]);
  const receivedFileSizeRef = useRef(0);
  const receivedMimeTypeRef = useRef('application/octet-stream');
  const totalChunksRef = useRef(0);
  const receivedChunksCountRef = useRef(0);
  const sendingFileMetaRef = useRef(null);

  // Constants
  const CHUNK_SIZE = 1024 * 256; // 256KB

  // Initialize WebSocket connection for signaling
  useEffect(() => {
    wsRef.current = ws;
    if (ws.readyState !== 1) {
      ws.onopen = () => {
        console.log('[WebSocket] Connection established');
      };
    }
    ws.onerror = (e) => {
      console.error('[WebSocket] Error:', e);
    };
    ws.onclose = (e) => {
      console.warn('[WebSocket] Closed:', e);
    };
    return () => {
      if (wsRef.current) {
        wsRef.current.onmessage = null;
      }
    };
  }, []);

  // WebRTC: Create PeerConnection and DataChannel
  const setupPeerConnection = (isInitiator) => {
    console.log('[WebRTC] Setting up PeerConnection. Initiator:', isInitiator);
    const pc = new RTCPeerConnection({
      iceServers: [
        { urls: 'stun:stun.l.google.com:19302' },
      ],
    });
    peerConnectionRef.current = pc;

    if (isInitiator) {
      const dc = pc.createDataChannel('file');
      dataChannelRef.current = dc;
      console.log('[WebRTC] DataChannel created by initiator');
      setupDataChannelEvents(dc);
    } else {
      pc.ondatachannel = (event) => {
        dataChannelRef.current = event.channel;
        console.log('[WebRTC] DataChannel received by non-initiator');
        setupDataChannelEvents(event.channel);
      };
    }

    pc.onicecandidate = (event) => {
      if (event.candidate) {
        console.log('[WebRTC] ICE candidate:', event.candidate);
        wsRef.current.send(JSON.stringify({
          type: 'signal',
          roomId,
          candidate: event.candidate,
        }));
      }
    };
    pc.oniceconnectionstatechange = () => {
      console.log('[WebRTC] ICE connection state:', pc.iceConnectionState);
    };
  };

  // DataChannel events for file transfer
  const setupDataChannelEvents = (dc) => {
    dc.binaryType = 'arraybuffer';
    dc.onopen = () => {
      console.log('[WebRTC] DataChannel open');
      setPeerConnected(true);
      setStatus('Peer connected! You can now share files.');
    };
    dc.onclose = () => {
      console.warn('[WebRTC] DataChannel closed');
      setPeerConnected(false);
      setStatus('Peer disconnected.');
    };
    dc.onerror = (e) => {
      console.error('[WebRTC] DataChannel error:', e);
      setStatus('DataChannel error: ' + e.message);
    };
    dc.onmessage = (event) => {
      if (typeof event.data === 'string') {
        // Meta info
        const meta = JSON.parse(event.data);
        if (meta.type === 'file-meta') {
          console.log('[WebRTC] Received file meta:', meta);
          receivedChunksRef.current = [];
          receivedFileSizeRef.current = meta.fileSize;
          totalChunksRef.current = meta.totalChunks;
          receivedChunksCountRef.current = 0;
          receivedMimeTypeRef.current = meta.mimeType || 'application/octet-stream';
          setReceivingFileName(meta.fileName);
          setStatus(`Receiving: ${meta.fileName}`);
          setReceiveProgress(0);
          setIsReceiver(true);
          setFileReady(false);
        }
      } else {
        // File chunk
        receivedChunksRef.current.push(new Uint8Array(event.data));
        receivedChunksCountRef.current++;
        const progress = Math.floor((receivedChunksCountRef.current / totalChunksRef.current) * 100);
        setReceiveProgress(progress);
        if (progress % 10 === 0) {
          console.log(`[WebRTC] Receiving file: ${progress}%`);
        }
        if (progress === 100) {
          setStatus('File received successfully! Click to download.');
          setFileReady(true);
          console.log('[WebRTC] File received completely.');
        }
      }
    };
  };

  // Signaling message handler
  useEffect(() => {
    if (!wsRef.current) return;
    const handleMessage = async (event) => {
      try {
        const data = JSON.parse(event.data);
        console.log('[WebSocket] Message received:', data);
        switch (data.type) {
          case 'room-created':
            setRoomId(data.roomId);
            setStatus('Room created. Share this code with others to join.');
            break;
          case 'peer-joined':
            setupPeerConnection(isRoomCreator);
            if (isRoomCreator) {
              // Create offer
              const offer = await peerConnectionRef.current.createOffer();
              await peerConnectionRef.current.setLocalDescription(offer);
              wsRef.current.send(JSON.stringify({
                type: 'signal',
                roomId,
                sdp: offer,
              }));
              console.log('[WebRTC] Sent SDP offer');
            }
            break;
          case 'signal':
            if (data.sdp) {
              if (data.sdp.type === 'offer') {
                setupPeerConnection(false);
                await peerConnectionRef.current.setRemoteDescription(new RTCSessionDescription(data.sdp));
                const answer = await peerConnectionRef.current.createAnswer();
                await peerConnectionRef.current.setLocalDescription(answer);
                wsRef.current.send(JSON.stringify({
                  type: 'signal',
                  roomId,
                  sdp: answer,
                }));
                console.log('[WebRTC] Received offer, sent answer');
              } else if (data.sdp.type === 'answer') {
                await peerConnectionRef.current.setRemoteDescription(new RTCSessionDescription(data.sdp));
                console.log('[WebRTC] Received answer, set remote description');
              }
            } else if (data.candidate) {
              await peerConnectionRef.current.addIceCandidate(new RTCIceCandidate(data.candidate));
              console.log('[WebRTC] Added ICE candidate');
            }
            break;
          case 'chat-message':
            // Log chat message
            console.log('[Chat] Received chat message:', data);
            break;
          default:
            // Chat and other messages handled elsewhere
            break;
        }
      } catch (error) {
        console.error('[WebSocket] Error processing signaling message:', error);
      }
    };
    wsRef.current.onmessage = handleMessage;
    return () => {
      if (wsRef.current) {
        wsRef.current.onmessage = null;
      }
    };
  }, [roomId, isRoomCreator]);

  const createRoom = () => {
    if (!wsRef.current || wsRef.current.readyState !== 1) {
      setStatus('Error: WebSocket not connected. Please refresh the page.');
      return;
    }
    wsRef.current.send(JSON.stringify({ type: 'create-room' }));
    setIsReceiver(false);
    setIsRoomCreator(true);
    resetFileState();
  };

  const joinRoom = () => {
    if (!roomId.trim()) {
      setStatus('Please enter a room code.');
      return;
    }
    if (!wsRef.current || wsRef.current.readyState !== 1) {
      setStatus('Error: WebSocket not connected. Please refresh the page.');
      return;
    }
    wsRef.current.send(JSON.stringify({ type: 'join-room', roomId }));
    setIsReceiver(true);
    setIsRoomCreator(false);
    resetFileState();
  };

  const resetFileState = () => {
    setReceiveProgress(0);
    setSendProgress(0);
    setStatus('');
    setFileReady(false);
    receivedChunksRef.current = [];
    receivedChunksCountRef.current = 0;
    totalChunksRef.current = 0;
    receivedFileSizeRef.current = 0;
  };

  const handleFileChange = (e) => {
    if (e.target.files[0]) {
      setFile(e.target.files[0]);
      setSendProgress(0);
      setStatus('');
    }
  };

  // Send file over WebRTC DataChannel
  const sendFile = async () => {
    if (!file || !peerConnected || !dataChannelRef.current) {
      return;
    }
    setIsReceiver(false);
    const totalChunks = Math.ceil(file.size / CHUNK_SIZE);
    const meta = {
      type: 'file-meta',
      fileName: file.name,
      fileSize: file.size,
      mimeType: file.type || 'application/octet-stream',
      totalChunks,
    };
    dataChannelRef.current.send(JSON.stringify(meta));

    let offset = 0;
    let chunkIndex = 0;
    const dc = dataChannelRef.current;
    const THRESHOLD = 1 * 1024 * 1024; // 1MB
    let stopped = false;

    async function sendNextChunk() {
      if (stopped) return;
      if (chunkIndex >= totalChunks) {
        setStatus('File sent successfully!');
        return;
      }
      if (dc.bufferedAmount > THRESHOLD) {
        return;
      }
      const end = Math.min(offset + CHUNK_SIZE, file.size);
      try {
        const chunk = await file.slice(offset, end).arrayBuffer();
        dc.send(chunk);
      } catch (err) {
        setStatus('Error sending file: ' + err.message);
        stopped = true;
        return;
      }
      offset = end;
      chunkIndex++;
      const progress = Math.floor((chunkIndex / totalChunks) * 100);
      setSendProgress(progress);
      setTimeout(sendNextChunk, 0);
    }

    dc.bufferedAmountLowThreshold = THRESHOLD;
    dc.onbufferedamountlow = () => {
      if (!stopped) {
        sendNextChunk();
      }
    };

    sendNextChunk();
  };

  // Add countdown to downloadReceivedFile
  const [countdown, setCountdown] = useState(0);

  const downloadReceivedFile = () => {
    setIsDownloading(true);
    const estimatedTime = Math.max(1, Math.ceil(receivedFileSizeRef.current / (1024 * 1024) * 0.1));
    setProcessingTime(estimatedTime);
    setCountdown(estimatedTime);

    // Countdown timer
    let timer = estimatedTime;
    const interval = setInterval(() => {
      timer--;
      setCountdown(timer);
      if (timer <= 0) {
        clearInterval(interval);
      }
    }, 1000);

    setTimeout(() => {
      try {
        let totalLength = 0;
        receivedChunksRef.current.forEach(chunk => {
          if (chunk) totalLength += chunk.length;
        });
        const combinedArray = new Uint8Array(totalLength);
        let offset = 0;
        receivedChunksRef.current.forEach(chunk => {
          if (chunk) {
            combinedArray.set(chunk, offset);
            offset += chunk.length;
          }
        });
        const fileBlob = new Blob([combinedArray], { type: receivedMimeTypeRef.current });
        const element = document.createElement('a');
        element.href = URL.createObjectURL(fileBlob);
        element.download = receivingFileName || 'downloaded_file';
        document.body.appendChild(element);
        element.click();
        setTimeout(() => {
          URL.revokeObjectURL(element.href);
          document.body.removeChild(element);
        }, 100);
        setIsDownloading(false);
        setStatus('File downloaded successfully!');
        setCountdown(0);
      } catch (error) {
        setStatus('Error downloading file: ' + error.message);
        setIsDownloading(false);
        setCountdown(0);
      }
    }, estimatedTime * 1000);
  };

  // Helper function to format file size
  const formatFileSize = (bytes) => {
    if (bytes < 1024) return bytes + ' bytes';
    else if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(2) + ' KB';
    else if (bytes < 1024 * 1024 * 1024) return (bytes / (1024 * 1024)).toFixed(2) + ' MB';
    else return (bytes / (1024 * 1024 * 1024)).toFixed(2) + ' GB';
  };

  const copyRoomCode = async () => {
    try {
      await navigator.clipboard.writeText(roomId);
      setCopiedRoomId(true);
      setTimeout(() => {
        setCopiedRoomId(false);
      }, 2000);
    } catch (err) {
      console.error('Failed to copy room code:', err);
      const textArea = document.createElement('textarea');
      textArea.value = roomId;
      document.body.appendChild(textArea);
      textArea.select();
      document.execCommand('copy');
      document.body.removeChild(textArea);
      setCopiedRoomId(true);
      setTimeout(() => {
        setCopiedRoomId(false);
      }, 2000);
    }
  };

  const handleRoomCodeKeyPress = (e) => {
    if (e.key === 'Enter') {
      joinRoom();
    }
  };

  return (
    <div className={`w-full p-8 ${isDark ? 'bg-gray-800' : 'bg-white'} rounded-2xl shadow-lg border ${isDark ? 'border-gray-700' : 'border-gray-200'}`}>
      <div className="mb-8 text-center">
        <h2 className={`text-2xl font-bold ${isDark ? 'text-white' : 'text-gray-800'}`}>P2P File Sharing</h2>
        <p className={`${isDark ? 'text-gray-300' : 'text-gray-600'} mt-2`}>Transfer files directly to another device</p>
      </div>
      <AnimatePresence>
        {status && (
          <motion.div 
            initial={{ opacity: 0, y: -10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0 }}
            className={`mb-6 p-4 rounded-xl text-sm ${
              status.includes('successfully') 
                ? 'bg-green-100 text-green-800 dark:bg-green-900/20 dark:text-green-400' 
                : status.includes('Error') 
                  ? 'bg-red-100 text-red-800 dark:bg-red-900/20 dark:text-red-400'
                  : 'bg-blue-100 text-blue-800 dark:bg-blue-900/20 dark:text-blue-400'
            }`}
          >
            {status}
          </motion.div>
        )}
      </AnimatePresence>
      {!peerConnected && (
        <div className="space-y-6">
          <motion.div 
            className={`p-6 ${isDark ? 'bg-blue-900/20' : 'bg-blue-50'} rounded-xl shadow-sm border ${isDark ? 'border-blue-800' : 'border-blue-200'}`}
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
          >
            <div className="flex items-center space-x-3 mb-4">
              <Users className="h-6 w-6 text-blue-500 dark:text-blue-400" />
              <h3 className={`text-xl font-semibold ${isDark ? 'text-white' : 'text-gray-800'}`}>Create or Join Room</h3>
            </div>
            <button 
              onClick={createRoom} 
              className="w-full mb-4 bg-blue-500 hover:bg-blue-600 text-white font-medium py-4 px-6 rounded-xl transition duration-200 flex items-center justify-center space-x-2"
            >
              <Users className="h-5 w-5" />
              <span>Create New Room</span>
            </button>
            {roomId && isRoomCreator && (
              <motion.div 
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                className={`mb-4 p-4 ${isDark ? 'bg-gray-700' : 'bg-white'} rounded-xl border ${isDark ? 'border-blue-800' : 'border-blue-200'}`}
              >
                <p className={`${isDark ? 'text-gray-300' : 'text-gray-600'} mb-2 text-sm`}>Share this code with others:</p>
                <div className="flex items-center space-x-3">
                  <div className="text-lg font-mono font-bold text-blue-600 dark:text-blue-400 bg-gray-100 dark:bg-gray-800 px-3 py-2 rounded-lg">
                    {roomId}
                  </div>
                  <button
                    onClick={copyRoomCode}
                    className={`p-2 rounded-lg transition-all duration-200 hover:scale-110 ${
                      copiedRoomId
                        ? isDark 
                          ? 'bg-green-600 text-white' 
                          : 'bg-green-500 text-white'
                        : isDark 
                          ? 'bg-gray-600 text-gray-300 hover:bg-gray-500 hover:text-white' 
                          : 'bg-gray-200 text-gray-600 hover:bg-gray-300 hover:text-gray-800'
                    }`}
                    title={copiedRoomId ? "Copied!" : "Copy room code"}
                  >
                    {copiedRoomId ? (
                      <Check className="h-4 w-4" />
                    ) : (
                      <Copy className="h-4 w-4" />
                    )}
                  </button>
                </div>
              </motion.div>
            )}
            {!isRoomCreator && (
              <div className="mt-4">
                <label className={`block text-sm font-medium ${isDark ? 'text-gray-300' : 'text-gray-700'} mb-2`}>Join Existing Room</label>
                <div className="flex space-x-3">
                  <input 
                    type="text" 
                    placeholder="Enter Room Code" 
                    value={roomId} 
                    onChange={(e) => setRoomId(e.target.value)}
                    onKeyPress={handleRoomCodeKeyPress}
                    className={`flex-1 border ${isDark ? 'border-gray-600 bg-gray-700 text-white' : 'border-gray-300 bg-white text-gray-900'} rounded-xl px-4 py-3 focus:outline-none focus:ring-2 focus:ring-blue-500`}
                  />
                  <button 
                    onClick={joinRoom} 
                    className="bg-green-500 hover:bg-green-600 text-white font-medium py-3 px-6 rounded-xl transition duration-200"
                  >
                    Join
                  </button>
                </div>
                <p className={`text-xs mt-2 ${isDark ? 'text-gray-400' : 'text-gray-500'}`}>
                  Tip: Press Enter after typing the room code to join quickly
                </p>
              </div>
            )}
          </motion.div>
        </div>
      )}
      {peerConnected && (
        <div className="grid grid-cols-1 lg:grid-cols-5 gap-6" style={{ minHeight: '400px', maxHeight: '450px' }}>
          {/* File Transfer Section - Takes 60% of the space (3/5) */}
          <div className="lg:col-span-3">
            <div className={`h-full ${isDark ? 'bg-gray-900/50' : 'bg-gray-50'} rounded-xl border ${isDark ? 'border-gray-700' : 'border-gray-200'} p-6`}>
              {!isReceiver && (
                <motion.div 
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  className="h-full flex flex-col"
                >
                  <div className="flex items-center space-x-3 mb-4">
                    <Upload className="h-6 w-6 text-blue-500 dark:text-blue-400" />
                    <h3 className={`text-xl font-semibold ${isDark ? 'text-white' : 'text-gray-800'}`}>Send File</h3>
                  </div>
                  <div className="flex-1 flex flex-col">
                    <div 
                      onClick={() => fileInputRef.current.click()}
                      className={`flex-1 border-2 border-dashed ${isDark ? 'border-blue-700' : 'border-blue-300'} rounded-xl p-6 cursor-pointer ${isDark ? 'hover:bg-blue-800/20' : 'hover:bg-blue-100'} transition duration-200 flex flex-col items-center justify-center`}
                    >
                      <FileUp className="h-10 w-10 text-blue-400 dark:text-blue-500 mb-2" />
                      <p className="text-blue-600 dark:text-blue-400 font-medium">Select a file to share</p>
                      <p className={`${isDark ? 'text-gray-400' : 'text-gray-500'} text-sm mt-1`}>Click to browse your files</p>
                      <input 
                        ref={fileInputRef}
                        type="file" 
                        onChange={handleFileChange} 
                        className="hidden" 
                      />
                    </div>
                    {file && (
                      <div className="mt-4 space-y-3">
                        <div className={`p-3 ${isDark ? 'bg-gray-800' : 'bg-white'} rounded-lg border ${isDark ? 'border-gray-700' : 'border-gray-200'}`}>
                          <p className={`font-medium ${isDark ? 'text-white' : 'text-gray-800'}`}>{file.name}</p>
                          <p className={`text-sm ${isDark ? 'text-gray-400' : 'text-gray-600'}`}>{formatFileSize(file.size)}</p>
                        </div>
                        {sendProgress > 0 && sendProgress < 100 && (
                          <div className="space-y-2">
                            <div className="flex justify-between text-sm">
                              <span className={isDark ? 'text-gray-300' : 'text-gray-600'}>Sending...</span>
                              <span className={isDark ? 'text-gray-300' : 'text-gray-600'}>{sendProgress}%</span>
                            </div>
                            <div className={`w-full bg-gray-200 rounded-full h-2 ${isDark ? 'bg-gray-700' : 'bg-gray-200'}`}>
                              <div className="bg-blue-600 h-2 rounded-full transition-all duration-300" style={{ width: `${sendProgress}%` }}></div>
                            </div>
                          </div>
                        )}
                        <button 
                          onClick={sendFile}
                          disabled={sendProgress > 0 && sendProgress < 100}
                          className={`w-full py-3 px-4 rounded-xl font-medium transition duration-200 ${
                            sendProgress > 0 && sendProgress < 100
                              ? isDark ? 'bg-gray-700 text-gray-400' : 'bg-gray-200 text-gray-400'
                              : 'bg-blue-500 hover:bg-blue-600 text-white'
                          }`}
                        >
                          {sendProgress > 0 && sendProgress < 100 ? 'Sending...' : 'Send File'}
                        </button>
                      </div>
                    )}
                  </div>
                </motion.div>
              )}
              {isReceiver && (
                <motion.div 
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  className="h-full flex flex-col"
                >
                  <div className="flex items-center space-x-3 mb-4">
                    <Download className="h-6 w-6 text-green-500 dark:text-green-400" />
                    <h3 className={`text-xl font-semibold ${isDark ? 'text-white' : 'text-gray-800'}`}>Receive File</h3>
                  </div>
                  <div className="flex-1 flex flex-col">
                    {!fileReady ? (
                      <div className={`flex-1 border-2 border-dashed ${isDark ? 'border-green-700' : 'border-green-300'} rounded-xl p-6 flex flex-col items-center justify-center`}>
                        <Download className="h-10 w-10 text-green-400 dark:text-green-500 mb-2" />
                        <p className="text-green-600 dark:text-green-400 font-medium">Waiting for file...</p>
                        <p className={`${isDark ? 'text-gray-400' : 'text-gray-500'} text-sm mt-1`}>File will appear here when received</p>
                        {receiveProgress > 0 && receiveProgress < 100 && (
                          <div className="mt-4 w-full space-y-2">
                            <div className="flex justify-between text-sm">
                              <span className={isDark ? 'text-gray-300' : 'text-gray-600'}>Receiving...</span>
                              <span className={isDark ? 'text-gray-300' : 'text-gray-600'}>{receiveProgress}%</span>
                            </div>
                            <div className={`w-full bg-gray-200 rounded-full h-2 ${isDark ? 'bg-gray-700' : 'bg-gray-200'}`}>
                              <div className="bg-green-600 h-2 rounded-full transition-all duration-300" style={{ width: `${receiveProgress}%` }}></div>
                            </div>
                          </div>
                        )}
                      </div>
                    ) : (
                      <div className="flex-1 flex flex-col items-center justify-center">
                        <div className={`p-6 ${isDark ? 'bg-gray-800' : 'bg-white'} rounded-xl border ${isDark ? 'border-gray-700' : 'border-gray-200'} text-center`}>
                          <FileUp className="h-12 w-12 text-green-500 dark:text-green-400 mx-auto mb-3" />
                          <p className={`font-medium ${isDark ? 'text-white' : 'text-gray-800'} mb-1`}>{receivingFileName}</p>
                          <p className={`text-sm ${isDark ? 'text-gray-400' : 'text-gray-600'} mb-4`}>{formatFileSize(receivedFileSizeRef.current)}</p>
                          <button 
                            onClick={downloadReceivedFile}
                            disabled={isDownloading}
                            className={`w-full py-3 px-4 rounded-xl font-medium transition duration-200 ${
                              isDownloading
                                ? isDark ? 'bg-gray-700 text-gray-400' : 'bg-gray-200 text-gray-400'
                                : 'bg-green-500 hover:bg-green-600 text-white'
                            }`}
                          >
                            {isDownloading ? (countdown > 0 ? `Processing... (${countdown}s)` : 'Processing...') : 'Download File'}
                          </button>
                        </div>
                      </div>
                    )}
                  </div>
                </motion.div>
              )}
            </div>
          </div>
          {/* Chat Section - Takes 40% of the space (2/5) */}
          <div className="lg:col-span-2">
            <div className={`h-full ${isDark ? 'bg-gray-900/50' : 'bg-gray-50'} rounded-xl border ${isDark ? 'border-gray-700' : 'border-gray-200'} overflow-hidden`}>
              <Chat 
                roomId={roomId} 
                wsRef={wsRef} 
                isConnected={peerConnected} 
              />
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default FileShare;