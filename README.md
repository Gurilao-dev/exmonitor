# ExMonitor

Remote camera monitoring system with enterprise-grade security.

## 🏗️ Project Structure

```
ExMonitor/
├── backend/          # Node.js + Fastify API
├── frontend/         # React + Vite application
└── docs/            # Documentation
```

## 🚀 Quick Start

### Backend Setup

1. Navigate to backend directory:
```bash
cd backend
```

2. Install dependencies:
```bash
npm install
```

3. Configure environment variables:
   - Copy `.env.example` to `.env`
   - Update Firebase credentials
   - Generate JWT secret: `node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"`
   - Generate global password hash: `node -e "const bcrypt = require('bcrypt'); bcrypt.hash('YOUR_PASSWORD', 10).then(console.log)"`

4. Start server:
```bash
npm run dev
```

### Frontend Setup

1. Navigate to frontend directory:
```bash
cd frontend
```

2. Install dependencies:
```bash
npm install
```

3. Configure environment variables:
   - Copy `.env.example` to `.env`
   - Update API URL and Firebase config

4. Start development server:
```bash
npm run dev
```

## 📱 Features

- **Multi-layer Security**: 5-token authentication system
- **WebRTC Streaming**: Real-time camera transmission
- **Device Management**: Register and pair devices
- **Encrypted Communication**: AES-256 + RSA encryption
- **Rate Limiting**: Protection against brute force attacks
- **Responsive Design**: Works on desktop and mobile

## 🔐 Security Architecture

1. **PRE_LOGIN_TOKEN** - Global password validation
2. **REGISTER_REQUEST_TOKEN** - Registration step 1
3. **SESSION_JWT** - User authentication
4. **DEVICE_TOKEN** - Device-specific auth
5. **STREAM_TOKEN** - Temporary streaming authorization

## 📚 API Documentation

See `docs/API.md` for complete API reference.

## 🛠️ Tech Stack

- **Backend**: Node.js, Fastify, Firebase, WebSocket
- **Frontend**: React, Vite, Tailwind CSS, WebRTC
- **Security**: JWT, bcrypt, AES-256, RSA

## 📝 License

Proprietary - All rights reserved
