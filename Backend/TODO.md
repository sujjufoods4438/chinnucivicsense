# MongoDB Connection Fix - Steps to Complete

## [ ] 1. Create .env file
Copy `Backend/.env.example` to `Backend/.env` and update MONGODB_URI with your Atlas password.

## [ ] 2. Atlas Setup (if new cluster)
- Go to [MongoDB Atlas](https://cloud.mongodb.com)
- Create free M7 cluster
- Whitelist IP: 0.0.0/0 (for dev)
- Create DB user and get connection string
- Update .env

## [ ] 3. Test connection
```
cd Backend
npm install
npm start
```
Look for "✅ MongoDB connected"

## [ ] 4. Network Test (if still fails)
```
nslookup ac-uerjrrh-shard-00-00.viambc2.mongodb.net
```
If fails, disable VPN/firewall or use mobile hotspot.

## [x] 5. Code Updates Complete (server.js improved, .env.example created)

**Progress: Code ready. User setup pending.**
