import { useState, useRef, useEffect } from 'react';
import { Send, MessageCircle, Copy, Check } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { useTheme } from '../context/ThemeContext';

const Chat = ({ roomId, wsRef, isConnected }) => {
  const { isDark } = useTheme();
  const [messages, setMessages] = useState([]);
  const [newMessage, setNewMessage] = useState('');
  const [isChatOpen, setIsChatOpen] = useState(false);
  const [copiedMessageId, setCopiedMessageId] = useState(null);
  const messagesEndRef = useRef(null);
  const messagesContainerRef = useRef(null);
  const inputRef = useRef(null);

  // Custom scroll function that doesn't affect page scroll
  const scrollToBottom = () => {
    if (messagesContainerRef.current) {
      messagesContainerRef.current.scrollTop = messagesContainerRef.current.scrollHeight;
    }
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages]);

  useEffect(() => {
    if (!wsRef.current) return;

    const handleMessage = (event) => {
      try {
        const data = JSON.parse(event.data);
        if (data.type === 'chat-message') {
          setMessages(prev => [...prev, {
            id: Date.now(),
            text: data.message,
            sender: data.sender,
            timestamp: data.timestamp,
            isOwn: false
          }]);
        }
      } catch (error) {
        console.error('Error processing chat message:', error);
      }
    };

    wsRef.current.addEventListener('message', handleMessage);
    return () => {
      wsRef.current?.removeEventListener('message', handleMessage);
    };
  }, [wsRef]);

  const sendMessage = (e) => {
    e.preventDefault(); // Prevent form submission
    e.stopPropagation(); // Stop event bubbling
    
    if (!newMessage.trim() || !wsRef.current || !isConnected) return;

    const messageData = {
      type: 'chat-message',
      roomId,
      message: newMessage.trim()
    };

    wsRef.current.send(JSON.stringify(messageData));

    // Add message to local state
    setMessages(prev => [...prev, {
      id: Date.now(),
      text: newMessage.trim(),
      sender: 'You',
      timestamp: new Date().toISOString(),
      isOwn: true
    }]);

    setNewMessage('');
    
    // Focus back to input after sending
    setTimeout(() => {
      inputRef.current?.focus();
    }, 100);
  };

  const copyMessage = async (messageText, messageId) => {
    try {
      await navigator.clipboard.writeText(messageText);
      setCopiedMessageId(messageId);
      
      // Reset the copied state after 2 seconds
      setTimeout(() => {
        setCopiedMessageId(null);
      }, 2000);
    } catch (err) {
      console.error('Failed to copy message:', err);
      // Fallback for older browsers
      const textArea = document.createElement('textarea');
      textArea.value = messageText;
      document.body.appendChild(textArea);
      textArea.select();
      document.execCommand('copy');
      document.body.removeChild(textArea);
      
      setCopiedMessageId(messageId);
      setTimeout(() => {
        setCopiedMessageId(null);
      }, 2000);
    }
  };

  const formatTime = (timestamp) => {
    return new Date(timestamp).toLocaleTimeString([], { 
      hour: '2-digit', 
      minute: '2-digit' 
    });
  };

  if (!isConnected) return null;

  return (
    <div className="h-full relative">
      {/* Chat Header - Fixed at top */}
      <div className={`absolute top-0 left-0 right-0 z-10 p-3 border-b ${isDark ? 'border-gray-700 bg-gray-900' : 'border-gray-200 bg-gray-50'}`}>
        <div className="flex items-center justify-between">
          <div>
            <h3 className={`font-semibold text-sm ${isDark ? 'text-white' : 'text-gray-800'}`}>
              Chat
            </h3>
            <p className={`text-xs ${isDark ? 'text-gray-400' : 'text-gray-600'}`}>
              Room: {roomId}
            </p>
          </div>
          <button
            onClick={() => setIsChatOpen(!isChatOpen)}
            className={`p-1.5 rounded-lg transition-colors ${
              isChatOpen
                ? isDark 
                  ? 'bg-blue-600 text-white' 
                  : 'bg-blue-500 text-white'
                : isDark 
                  ? 'bg-gray-700 text-gray-400 hover:text-white' 
                  : 'bg-gray-200 text-gray-600 hover:text-gray-800'
            }`}
          >
            <MessageCircle className="h-3 w-3" />
          </button>
        </div>
      </div>

      {/* Chat Content */}
      <AnimatePresence>
        {isChatOpen && (
          <motion.div
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: 'auto' }}
            exit={{ opacity: 0, height: 0 }}
            className="h-full"
          >
            {/* Messages - Fixed position with scroll */}
            <div 
              ref={messagesContainerRef}
              className="absolute top-12 bottom-16 left-0 right-0 overflow-y-auto p-3 space-y-2"
              style={{ 
                height: 'calc(100% - 112px)',
                maxHeight: 'calc(100% - 112px)'
              }}
            >
              {messages.length === 0 ? (
                <div className={`text-center py-4 ${isDark ? 'text-gray-400' : 'text-gray-500'}`}>
                  <MessageCircle className="h-6 w-6 mx-auto mb-1 opacity-50" />
                  <p className="text-xs">No messages yet</p>
                </div>
              ) : (
                <>
                  {messages.map((message) => (
                    <div
                      key={message.id}
                      className={`flex items-start gap-2 ${message.isOwn ? 'justify-end' : 'justify-start'}`}
                    >
                      {/* Copy Button - Left side for sender messages */}
                      {message.isOwn && (
                        <button
                          onClick={() => copyMessage(message.text, message.id)}
                          className={`flex-shrink-0 p-1 rounded-md transition-all duration-200 hover:scale-110 ${
                            copiedMessageId === message.id
                              ? isDark 
                                ? 'bg-green-600 text-white' 
                                : 'bg-green-500 text-white'
                              : isDark 
                                ? 'bg-gray-600 text-gray-300 hover:bg-gray-500 hover:text-white' 
                                : 'bg-gray-200 text-gray-600 hover:bg-gray-300 hover:text-gray-800'
                          }`}
                          title={copiedMessageId === message.id ? "Copied!" : "Copy message"}
                        >
                          {copiedMessageId === message.id ? (
                            <Check className="h-3 w-3" />
                          ) : (
                            <Copy className="h-3 w-3" />
                          )}
                        </button>
                      )}
                      
                      <div className={`max-w-32 px-2 py-1.5 rounded-lg text-xs ${
                        message.isOwn
                          ? isDark 
                            ? 'bg-blue-600 text-white' 
                            : 'bg-blue-500 text-white'
                          : isDark 
                            ? 'bg-gray-700 text-white' 
                            : 'bg-gray-200 text-gray-800'
                      }`}>
                        <p className="text-xs font-medium mb-0.5">
                          {message.sender}
                        </p>
                        <p className="break-words leading-tight">{message.text}</p>
                        <p className={`text-xs mt-0.5 ${
                          message.isOwn 
                            ? 'text-blue-100' 
                            : isDark ? 'text-gray-400' : 'text-gray-600'
                        }`}>
                          {formatTime(message.timestamp)}
                        </p>
                      </div>
                      
                      {/* Copy Button - Right side for received messages */}
                      {!message.isOwn && (
                        <button
                          onClick={() => copyMessage(message.text, message.id)}
                          className={`flex-shrink-0 p-1 rounded-md transition-all duration-200 hover:scale-110 ${
                            copiedMessageId === message.id
                              ? isDark 
                                ? 'bg-green-600 text-white' 
                                : 'bg-green-500 text-white'
                              : isDark 
                                ? 'bg-gray-600 text-gray-300 hover:bg-gray-500 hover:text-white' 
                                : 'bg-gray-200 text-gray-600 hover:bg-gray-300 hover:text-gray-800'
                          }`}
                          title={copiedMessageId === message.id ? "Copied!" : "Copy message"}
                        >
                          {copiedMessageId === message.id ? (
                            <Check className="h-3 w-3" />
                          ) : (
                            <Copy className="h-3 w-3" />
                          )}
                        </button>
                      )}
                    </div>
                  ))}
                  <div ref={messagesEndRef} />
                </>
              )}
            </div>

            {/* Message Input - Fixed at bottom */}
            <div className={`absolute bottom-0 left-0 right-0 z-10 p-3 border-t ${isDark ? 'border-gray-700 bg-gray-900' : 'border-gray-200 bg-gray-50'}`}>
              <form onSubmit={sendMessage} className="flex space-x-2">
                <input
                  ref={inputRef}
                  type="text"
                  value={newMessage}
                  onChange={(e) => setNewMessage(e.target.value)}
                  placeholder="Type..."
                  className={`flex-1 px-2 py-1.5 rounded-lg border text-xs ${
                    isDark 
                      ? 'bg-gray-700 border-gray-600 text-white placeholder-gray-400' 
                      : 'bg-white border-gray-300 text-gray-900 placeholder-gray-500'
                  } focus:outline-none focus:ring-1 focus:ring-blue-500`}
                />
                <button
                  type="submit"
                  disabled={!newMessage.trim()}
                  className={`p-1.5 rounded-lg transition-colors ${
                    newMessage.trim()
                      ? isDark 
                        ? 'bg-blue-600 hover:bg-blue-700 text-white' 
                        : 'bg-blue-500 hover:bg-blue-600 text-white'
                      : isDark 
                        ? 'bg-gray-700 text-gray-500' 
                        : 'bg-gray-200 text-gray-400'
                  }`}
                >
                  <Send className="h-3 w-3" />
                </button>
              </form>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Chat Closed State */}
      {!isChatOpen && (
        <div className={`h-full flex items-center justify-center ${isDark ? 'bg-gray-800' : 'bg-gray-50'}`}>
          <button
            onClick={() => setIsChatOpen(true)}
            className={`p-3 rounded-lg transition-colors ${
              isDark 
                ? 'bg-gray-700 hover:bg-gray-600 text-gray-400 hover:text-white' 
                : 'bg-gray-200 hover:bg-gray-300 text-gray-600 hover:text-gray-800'
            }`}
          >
            <MessageCircle className="h-5 w-5 mb-1" />
            <p className="text-xs">Open Chat</p>
          </button>
        </div>
      )}
    </div>
  );
};

export default Chat; 