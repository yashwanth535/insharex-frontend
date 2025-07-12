# InShareX - Peer-to-Peer File Sharing Platform

A modern, real-time file sharing application built with WebRTC technology for direct peer-to-peer file transfers. InShareX provides secure, fast, and efficient file sharing without the need for cloud storage intermediaries.

## 🌐 Live Demo

**Visit the application:** [https://insharex.yashwanth.site](https://insharex.yashwanth.site)

## 🚀 Features

- **Direct File Transfer**: Peer-to-peer file sharing using WebRTC
- **Real-time Chat**: Built-in messaging during file sharing sessions
- **Room-based Sharing**: Create and join sharing rooms with unique codes
- **Progress Tracking**: Real-time upload/download progress with time estimates
- **Cross-platform**: Works on desktop and mobile browsers
- **No File Size Limits**: Transfer files of any size directly between peers
- **Secure**: End-to-end encrypted file transfers
- **Offline Capable**: Works without server dependency after connection
- **Modern UI**: Beautiful, responsive design with dark/light theme support

## 🏗️ Architecture

InShareX consists of three main components:

### 1. **Frontend** (`/frontend`)
- React 19 + Vite application
- WebRTC peer connection handling
- Real-time chat interface
- Modern UI with Tailwind CSS and Framer Motion

### 2. **Backend** (`/backend`)
- Node.js + Express server
- File upload API (Supabase integration)
- MongoDB database for metadata
- RESTful API endpoints

### 3. **WebSocket Server** (`/websocket`)
- Real-time signaling server
- WebRTC connection management
- Room creation and management
- Chat message relay

## 🛠️ Tech Stack

### Frontend
- **React 19** - Latest React with concurrent features
- **Vite** - Fast build tool and development server
- **Tailwind CSS 4** - Utility-first CSS framework
- **Framer Motion** - Smooth animations and transitions
- **WebRTC** - Peer-to-peer file transfer
- **WebSocket** - Real-time communication

### Backend
- **Node.js** - JavaScript runtime
- **Express** - Web framework
- **MongoDB** - Database for metadata
- **Supabase** - Cloud storage for file uploads
- **Multer** - File upload handling

### WebSocket Server
- **Node.js** - JavaScript runtime
- **Express** - HTTP server
- **ws** - WebSocket library
- **CORS** - Cross-origin resource sharing

## 📋 Prerequisites

- Node.js (v18 or higher)
- npm or yarn
- Modern browser with WebRTC support
- MongoDB Atlas account (for backend)
- Supabase account (for file storage)

## 🚀 Quick Start

### Option 1: Use the Live Demo
Visit [https://insharex.yashwanth.site](https://insharex.yashwanth.site) to start sharing files immediately.

### Option 2: Local Development

1. **Clone the repository:**
   ```bash
   git clone <repository-url>
   cd insharex
   ```

2. **Start Backend Server:**
   ```bash
   cd backend
   npm install
   # Create .env file with your configuration
   npm start
   ```

3. **Start WebSocket Server:**
   ```bash
   cd websocket
   npm install
   # Create .env file with your configuration
   npm start
   ```

4. **Start Frontend:**
   ```bash
   cd frontend
   npm install
   # Create .env file with your configuration
   npm run dev
   ```

5. **Open your browser:**
   Navigate to `http://localhost:5173`

## 🔧 Environment Configuration

### Backend (.env)
```env
PORT=3000
MONGODB_URI=your_mongodb_atlas_connection_string
FRONTEND_URL=http://localhost:5173
SUPABASE_URL=your_supabase_project_url
SUPABASE_ANON_KEY=your_supabase_anon_key
SUPABASE_SERVICE_ROLE_KEY=your_supabase_service_role_key
```

### WebSocket (.env)
```env
WS_PORT=4000
FRONTEND_URL=http://localhost:5173
```

### Frontend (.env)
```env
VITE_BACKEND_URL=http://localhost:3000
VITE_WEBSOCKET_URL=ws://localhost:4000
```

## 📖 How It Works

### File Sharing Process

1. **Create Room**: User creates a sharing room and receives a unique 6-digit code
2. **Share Code**: Share the room code with the recipient
3. **Join Room**: Recipient joins the room using the code
4. **Establish Connection**: WebRTC peer connection is established via signaling server
5. **Transfer Files**: Files are transferred directly between peers in chunks
6. **Real-time Chat**: Users can chat during file transfer

### WebRTC Signaling Flow

```
Peer A                    Signaling Server                    Peer B
  |                           |                                |
  |-- create-room ----------->|                                |
  |<-- room-created ----------|                                |
  |                           |                                |
  |                           |<-- join-room ------------------|
  |<-- peer-joined -----------|<-- peer-joined ----------------|
  |                           |                                |
  |-- SDP offer ------------>|                                |
  |                           |-- SDP offer ------------------>|
  |                           |<-- SDP answer -----------------|
  |<-- SDP answer -----------|                                |
  |                           |                                |
  |-- ICE candidate -------->|                                |
  |                           |-- ICE candidate --------------->|
  |                           |<-- ICE candidate ---------------|
  |<-- ICE candidate --------|                                |
  |                           |                                |
  |<======== Direct P2P Connection ========>|                  |
```

## 🎯 Use Cases

- **Large File Sharing**: Transfer files too large for email
- **Secure Sharing**: End-to-end encrypted file transfers
- **Offline Sharing**: Share files without internet dependency
- **Team Collaboration**: Real-time file sharing with chat
- **Cross-platform**: Share between different devices and browsers

## 🔒 Security Features

- **End-to-End Encryption**: Files are transferred directly between peers
- **No Server Storage**: Files don't pass through servers (except for signaling)
- **CORS Protection**: Restricts connections to allowed origins
- **Input Validation**: Validates all user inputs
- **Secure WebRTC**: Uses STUN servers for NAT traversal

## 📱 Browser Support

- Chrome 88+
- Firefox 85+
- Safari 14+
- Edge 88+

## 🚀 Deployment

### Production URLs
- **Frontend**: [https://insharex.yashwanth.site](https://insharex.yashwanth.site)
- **Backend**: Configure your backend URL
- **WebSocket**: Configure your WebSocket URL

### Deployment Platforms
- **Frontend**: Vercel, Netlify, or any static hosting
- **Backend**: Vercel, Railway, Heroku, or any Node.js hosting
- **WebSocket**: Railway, Heroku, or any WebSocket-compatible hosting

## 📊 Performance

- **Direct Transfer**: No server bandwidth usage for file transfer
- **Chunked Transfer**: 256KB chunks for reliable large file transfer
- **Progress Tracking**: Real-time progress with time estimates
- **Resume Support**: Automatic retry on connection issues
- **Memory Efficient**: Streams files without loading entire file into memory

## 🐛 Troubleshooting

### Common Issues

1. **WebRTC Connection Failed**
   - Check firewall settings
   - Verify STUN server availability
   - Ensure both peers are online

2. **Room Not Found**
   - Verify room code is correct
   - Check if room was cleaned up due to disconnect
   - Ensure WebSocket server is running

3. **File Transfer Issues**
   - Check file size and type
   - Verify stable internet connection
   - Monitor browser console for errors

## 🤝 Contributing

1. Fork the repository
2. Create a feature branch
3. Make your changes
4. Test thoroughly
5. Submit a pull request

### Development Guidelines

- Follow React and Node.js best practices
- Add proper error handling
- Include comprehensive logging
- Test WebRTC connections thoroughly
- Document new features

## 📄 License

This project is licensed under the MIT License.

## 🆘 Support

- **Live Demo**: [https://insharex.yashwanth.site](https://insharex.yashwanth.site)
- **Documentation**: Check individual component READMEs
- **Issues**: Open an issue on GitHub
- **Questions**: Check the troubleshooting sections

## 🙏 Acknowledgments

- WebRTC technology for peer-to-peer communication
- React team for the amazing framework
- Tailwind CSS for the utility-first styling
- Supabase for cloud storage integration
- MongoDB for database services

---

**Built with ❤️ for seamless file sharing**

**Live Demo:** [https://insharex.yashwanth.site](https://insharex.yashwanth.site) 