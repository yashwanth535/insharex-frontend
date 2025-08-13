import React, { useState, useRef, useEffect, useCallback } from "react";
import Header from "../components/Header";
import Footer from "../components/Footer";
import { useTheme } from "../context/ThemeContext";
import { motion } from "framer-motion";

export default function TorrentDownloader() {
  const { isDark } = useTheme();
  const [magnetURI, setMagnetURI] = useState("");
  const [status, setStatus] = useState("");
  const [downloadStats, setDownloadStats] = useState(null);
  const [isDownloading, setIsDownloading] = useState(false);
  const [logs, setLogs] = useState([]);
  
  const wsRef = useRef(null);
  const fileWritersRef = useRef({}); // { fileIndex: writer }
  const downloadStatsRef = useRef({
    totalChunksReceived: 0,
    totalBytesReceived: 0,
    filesCompleted: 0,
    startTime: null,
    chunksPerFile: {}
  });

  const addLog = useCallback((message, type = 'info') => {
    const timestamp = new Date().toLocaleTimeString();
    const logEntry = `[${timestamp}] ${message}`;
    console.log(`[Browser] ${logEntry}`);
    
    setLogs(prev => [...prev.slice(-49), { message: logEntry, type, timestamp }]); // Keep last 50 logs
  }, []);

  const formatBytes = useCallback((bytes) => {
    if (bytes === 0) return '0 B';
    const k = 1024;
    const sizes = ['B', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
  }, []);

  const updateStats = useCallback(() => {
    const stats = downloadStatsRef.current;
    const duration = stats.startTime ? (Date.now() - stats.startTime) / 1000 : 0;
    const avgSpeed = duration > 0 ? stats.totalBytesReceived / duration : 0;
    
    setDownloadStats({
      chunksReceived: stats.totalChunksReceived,
      bytesReceived: stats.totalBytesReceived,
      filesCompleted: stats.filesCompleted,
      duration,
      avgSpeed,
      chunksPerFile: { ...stats.chunksPerFile }
    });
  }, []);

  useEffect(() => {
    addLog("Torrent Downloader page mounted");
    
    return () => {
      // Cleanup on unmount
      if (wsRef.current) {
        wsRef.current.close();
      }
      Object.values(fileWritersRef.current).forEach(async (writer) => {
        try {
          await writer.close();
        } catch (err) {
          console.error("Error closing file writer:", err);
        }
      });
    };
  }, [addLog]);

  const handleDownload = async () => {
    if (!magnetURI.trim()) {
      alert("Please enter a magnet URI");
      return;
    }

    if (isDownloading) {
      addLog("Download already in progress", "warning");
      return;
    }

    try {
      addLog("🗂️ Requesting user to select download directory...");
      const dirHandle = await window.showDirectoryPicker();
      addLog(`📁 Directory selected: ${dirHandle.name}`);

      setIsDownloading(true);
      downloadStatsRef.current = {
        totalChunksReceived: 0,
        totalBytesReceived: 0,
        filesCompleted: 0,
        startTime: Date.now(),
        chunksPerFile: {}
      };

      addLog("🔌 Connecting to WebSocket server...");
      wsRef.current = new WebSocket(import.meta.env.VITE_WEBTORRENT_SOCKET_URL);
      wsRef.current.binaryType = "arraybuffer";

      wsRef.current.onopen = () => {
        addLog("✅ Connected to server. Requesting torrent...");
        setStatus("Connected. Requesting torrent...");
        wsRef.current.send(
          JSON.stringify({
            type: "start-torrent",
            magnetURI: magnetURI.trim(),
            fileIndexes: [] // all files
          })
        );
      };

      wsRef.current.onmessage = async (event) => {
        try {
          if (typeof event.data === "string") {
            const msg = JSON.parse(event.data);
            await handleTextMessage(msg, dirHandle);
          } else {
            await handleCombinedMessage(event.data, dirHandle);
          }
        } catch (err) {
          addLog(`❌ Error processing message: ${err.message}`, "error");
          console.error("Message processing error:", err);
        }
      };

      wsRef.current.onerror = (err) => {
        const errorMsg = `WebSocket error: ${err.message || err}`;
        addLog(`❌ ${errorMsg}`, "error");
        setStatus(errorMsg);
        setIsDownloading(false);
      };

      wsRef.current.onclose = (event) => {
        const closeMsg = `Connection closed (Code: ${event.code}, Reason: ${event.reason || 'Unknown'})`;
        addLog(`🔌 ${closeMsg}`);
        setStatus(closeMsg);
        setIsDownloading(false);
        
        // Final stats
        const stats = downloadStatsRef.current;
        const duration = (Date.now() - stats.startTime) / 1000;
        const avgSpeed = duration > 0 ? stats.totalBytesReceived / duration : 0;
        addLog(`📊 Final stats: ${stats.totalChunksReceived} chunks, ${formatBytes(stats.totalBytesReceived)}, Avg speed: ${formatBytes(avgSpeed)}/s`);
      };

    } catch (err) {
      console.error("Download initiation error:", err);
      const errorMsg = `Error: ${err.message}`;
      addLog(`❌ ${errorMsg}`, "error");
      setStatus(errorMsg);
      setIsDownloading(false);
    }
  };

  const handleCombinedMessage = async (data, dirHandle) => {
    try {
      const buffer = new Uint8Array(data);
      const separator = '\n---CHUNK-DATA---\n';
      const separatorBytes = new TextEncoder().encode(separator);
      
      // Find the separator
      let separatorIndex = -1;
      for (let i = 0; i <= buffer.length - separatorBytes.length; i++) {
        let match = true;
        for (let j = 0; j < separatorBytes.length; j++) {
          if (buffer[i + j] !== separatorBytes[j]) {
            match = false;
            break;
          }
        }
        if (match) {
          separatorIndex = i;
          break;
        }
      }

      if (separatorIndex === -1) {
        addLog("⚠️ No separator found in combined message", "warning");
        return;
      }

      // Extract metadata and chunk data
      const metadataBuffer = buffer.slice(0, separatorIndex);
      const chunkBuffer = buffer.slice(separatorIndex + separatorBytes.length);
      
      const metadataStr = new TextDecoder().decode(metadataBuffer);
      const message = JSON.parse(metadataStr);
      
      if (message.type === "chunk-with-data") {
        const metadata = message.metadata;
        
        // Verify chunk size
        if (chunkBuffer.length !== message.dataSize) {
          addLog(`⚠️ Chunk size mismatch: expected ${message.dataSize}, got ${chunkBuffer.length}`, "warning");
        }

        // Write chunk to file
        const writer = fileWritersRef.current[metadata.fileIndex];
        if (writer) {
          try {
            await writer.write(chunkBuffer);
            
            // Send acknowledgment to server
            if (wsRef.current && wsRef.current.readyState === WebSocket.OPEN) {
              wsRef.current.send(JSON.stringify({
                type: "chunk-ack",
                chunkId: message.chunkId
              }));
            }
            
            // Update statistics
            downloadStatsRef.current.totalChunksReceived++;
            downloadStatsRef.current.totalBytesReceived += chunkBuffer.length;
            
            const fileStats = downloadStatsRef.current.chunksPerFile[metadata.fileIndex];
            if (fileStats) {
              fileStats.chunksReceived++;
              fileStats.bytesReceived += chunkBuffer.length;
              
              // Log every 500 chunks or at completion
              if (fileStats.chunksReceived % 500 === 0 || fileStats.bytesReceived === fileStats.size) {
                const progress = ((fileStats.bytesReceived / fileStats.size) * 100).toFixed(1);
                addLog(`📦 File ${metadata.fileIndex} (${metadata.fileName}): Chunk ${metadata.chunkNumber} received - ${progress}% (${formatBytes(fileStats.bytesReceived)}/${formatBytes(fileStats.size)})`);
              }
            }
            
            // Update UI stats periodically
            if (downloadStatsRef.current.totalChunksReceived % 100 === 0) {
              updateStats();
            }
            
          } catch (err) {
            addLog(`❌ Error writing chunk ${metadata.chunkNumber} for ${metadata.fileName}: ${err.message}`, "error");
          }
        } else {
          addLog(`⚠️ No writer found for file index ${metadata.fileIndex} (${metadata.fileName})`, "warning");
        }
      }
    } catch (err) {
      addLog(`❌ Error processing combined message: ${err.message}`, "error");
      console.error("Combined message processing error:", err);
    }
  };

  const handleTextMessage = async (msg, dirHandle) => {
    switch (msg.type) {
      case "torrent-ready":
        addLog(`🎉 Torrent ready: ${msg.name} (${msg.files.length} files, ${formatBytes(msg.totalSize)})`);
        if (msg.initialProgress !== undefined) {
          addLog(`📊 Initial download progress: ${(msg.initialProgress * 100).toFixed(2)}%`);
        }
        setStatus(`Torrent ready: ${msg.name} (${msg.files.length} files)`);
        
        // Initialize file stats
        msg.files.forEach(file => {
          downloadStatsRef.current.chunksPerFile[file.index] = {
            name: file.name,
            size: file.length,
            chunksReceived: 0,
            bytesReceived: 0,
            completed: false
          };
        });
        
        // Add a small delay to ensure all file writers are ready before server starts streaming
        setTimeout(() => {
          addLog("✅ Ready to receive file streams");
        }, 200);
        break;

      case "file-start": {
        addLog(`📄 Starting file: ${msg.name} (${formatBytes(msg.size)})`);
        setStatus(`Starting: ${msg.name}`);
        
        try {
          // Sanitize filename for file system
          const sanitizedName = msg.name.replace(/[<>:"/\\|?*]/g, '_');
          const fileHandle = await dirHandle.getFileHandle(sanitizedName, { create: true });
          const writable = await fileHandle.createWritable();
          fileWritersRef.current[msg.index] = writable;
          addLog(`✅ File writer created for: ${sanitizedName}`);
        } catch (err) {
          addLog(`❌ Failed to create file writer for ${msg.name}: ${err.message}`, "error");
        }
        break;
      }

      case "file-end": {
        const writable = fileWritersRef.current[msg.index];
        if (writable) {
          try {
            await writable.close();
            delete fileWritersRef.current[msg.index];
            downloadStatsRef.current.filesCompleted++;
            downloadStatsRef.current.chunksPerFile[msg.index].completed = true;
            
            const fileStats = msg.stats || {};
            addLog(`✅ File completed: ${msg.name} (${fileStats.chunks || 0} chunks, ${formatBytes(fileStats.bytes || 0)})`);
            updateStats();
          } catch (err) {
            addLog(`❌ Error closing file ${msg.name}: ${err.message}`, "error");
          }
        }
        setStatus(`Completed file: ${msg.name}`);
        break;
      }

      case "progress":
        let progressMsg = `Progress: ${msg.progress.toFixed(2)}% | ${formatBytes(msg.downloaded)} | Speed: ${formatBytes(msg.speed)}/s | Peers: ${msg.peers || 0}`;
        if (msg.timeRemaining && msg.timeRemaining > 0) {
          progressMsg += ` | ETA: ${(msg.timeRemaining / 1000).toFixed(1)}s`;
        }
        if (msg.bufferSize) {
          progressMsg += ` | Buffer: ${msg.bufferSize}`;
        }
        if (msg.pendingAcks) {
          progressMsg += ` | Pending ACKs: ${msg.pendingAcks}`;
        }
        setStatus(progressMsg);
        
        // Log progress every 10%
        if (msg.progress % 10 < 0.1) {
          addLog(`📊 ${progressMsg}`);
        }
        break;

      case "torrent-complete-local":
        addLog("🎉 Torrent fully downloaded!");
        addLog(`📊 Server stats: ${msg.stats?.chunksSent || 0} chunks sent, ${formatBytes(msg.stats?.bytesSent || 0)} transferred`);
        setStatus("✅ Torrent fully downloaded!");
        setIsDownloading(false);
        updateStats();
        
        if (wsRef.current) {
          wsRef.current.close();
        }
        break;

      case "file-error":
        addLog(`❌ File error: ${msg.name} - ${msg.error}`, "error");
        break;

      case "error":
        addLog(`❌ Server error: ${msg.message}`, "error");
        setStatus(`Error: ${msg.message}`);
        setIsDownloading(false);
        break;

      default:
        addLog(`❓ Unknown message type: ${msg.type}`);
        console.log("Unknown message", msg);
    }
  };

  const clearLogs = () => {
    setLogs([]);
    addLog("Logs cleared");
  };

  return (
    <div className={`min-h-screen ${isDark ? "bg-gray-900" : "bg-gray-50"}`}>
      <Header />
      <motion.main
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.4 }}
        className="container mx-auto px-4 pt-28 pb-16"
      >
        <div className="max-w-6xl mx-auto">
          <h2 className={`text-3xl font-bold mb-6 text-center ${isDark ? "text-white" : "text-gray-900"}`}>
            Torrent Downloader
          </h2>

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {/* Download Section */}
            <div
              className={`rounded-2xl shadow-xl p-6 border ${
                isDark
                  ? "bg-gray-800 border-gray-700"
                  : "bg-white border-gray-200"
              }`}
            >
              <h3 className={`text-xl font-semibold mb-4 ${isDark ? "text-white" : "text-gray-900"}`}>
                Download Control
              </h3>
              
              <textarea
                value={magnetURI}
                onChange={(e) => setMagnetURI(e.target.value)}
                placeholder="Paste magnet URI here..."
                rows={3}
                className={`w-full p-3 rounded-lg border focus:outline-none focus:ring-2 mb-4 resize-none ${
                  isDark
                    ? "bg-gray-700 border-gray-600 text-white placeholder-gray-400 focus:ring-blue-500"
                    : "bg-gray-50 border-gray-300 text-gray-900 placeholder-gray-500 focus:ring-blue-400"
                }`}
              />

              <button
                onClick={handleDownload}
                disabled={isDownloading || !magnetURI.trim()}
                className={`w-full py-3 rounded-lg font-semibold transition-colors mb-4 ${
                  isDownloading || !magnetURI.trim()
                    ? "bg-gray-400 text-gray-600 cursor-not-allowed"
                    : isDark
                    ? "bg-blue-600 hover:bg-blue-500 text-white"
                    : "bg-blue-500 hover:bg-blue-600 text-white"
                }`}
              >
                {isDownloading ? "⏳ Downloading..." : "🚀 Start Download"}
              </button>

              {status && (
                <div
                  className={`p-3 rounded-lg whitespace-pre-line text-sm ${
                    isDark 
                      ? "bg-gray-700 text-gray-300" 
                      : "bg-gray-100 text-gray-600"
                  }`}
                >
                  <div className="font-mono">{status}</div>
                </div>
              )}

              {/* Download Statistics */}
              {downloadStats && (
                <div className={`mt-4 p-3 rounded-lg text-sm ${
                  isDark ? "bg-gray-700" : "bg-gray-100"
                }`}>
                  <h4 className={`font-semibold mb-2 ${isDark ? "text-white" : "text-gray-900"}`}>
                    📊 Download Statistics
                  </h4>
                  <div className={`space-y-1 font-mono text-xs ${isDark ? "text-gray-300" : "text-gray-600"}`}>
                    <div>Chunks received: {downloadStats.chunksReceived.toLocaleString()}</div>
                    <div>Data received: {formatBytes(downloadStats.bytesReceived)}</div>
                    <div>Files completed: {downloadStats.filesCompleted}</div>
                    <div>Duration: {downloadStats.duration.toFixed(1)}s</div>
                    <div>Avg speed: {formatBytes(downloadStats.avgSpeed)}/s</div>
                  </div>
                </div>
              )}
            </div>

            {/* Logs Section */}
            <div
              className={`rounded-2xl shadow-xl p-6 border ${
                isDark
                  ? "bg-gray-800 border-gray-700"
                  : "bg-white border-gray-200"
              }`}
            >
              <div className="flex justify-between items-center mb-4">
                <h3 className={`text-xl font-semibold ${isDark ? "text-white" : "text-gray-900"}`}>
                  📋 Activity Logs ({logs.length})
                </h3>
                <button
                  onClick={clearLogs}
                  className={`px-3 py-1 rounded text-xs font-medium transition-colors ${
                    isDark
                      ? "bg-gray-700 hover:bg-gray-600 text-gray-300"
                      : "bg-gray-200 hover:bg-gray-300 text-gray-700"
                  }`}
                >
                  Clear
                </button>
              </div>

              <div
                className={`h-96 overflow-y-auto border rounded-lg p-3 space-y-1 ${
                  isDark
                    ? "bg-gray-900 border-gray-600"
                    : "bg-gray-50 border-gray-300"
                }`}
              >
                {logs.length === 0 ? (
                  <div className={`text-center text-sm ${isDark ? "text-gray-400" : "text-gray-500"}`}>
                    No activity yet...
                  </div>
                ) : (
                  logs.map((log, index) => (
                    <div
                      key={index}
                      className={`text-xs font-mono break-all ${
                        log.type === 'error'
                          ? 'text-red-400'
                          : log.type === 'warning'
                          ? 'text-yellow-400'
                          : isDark
                          ? 'text-gray-300'
                          : 'text-gray-700'
                      }`}
                    >
                      {log.message}
                    </div>
                  ))
                )}
              </div>

              {/* File Statistics */}
              {downloadStats && Object.keys(downloadStats.chunksPerFile).length > 0 && (
                <div className="mt-4">
                  <h4 className={`font-semibold mb-2 text-sm ${isDark ? "text-white" : "text-gray-900"}`}>
                    📁 File Progress
                  </h4>
                  <div className={`max-h-32 overflow-y-auto space-y-1 text-xs ${isDark ? "text-gray-300" : "text-gray-600"}`}>
                    {Object.entries(downloadStats.chunksPerFile).map(([fileIndex, stats]) => (
                      <div key={fileIndex} className="font-mono">
                        <div className="truncate">
                          {stats.completed ? "✅" : "⏳"} {stats.name}
                        </div>
                        <div className="text-xs opacity-75">
                          {stats.chunksReceived.toLocaleString()} chunks, {formatBytes(stats.bytesReceived)}/{formatBytes(stats.size)}
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      </motion.main>
      <Footer />
    </div>
  );
}