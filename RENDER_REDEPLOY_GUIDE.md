# Render Backend Redeploy Guide

## Quick Redeploy civicsense-backend-1.onrender.com

### Method 1: Dashboard (Fastest)
1. render.com → Login
2. civicsense-backend-1 → Overview
3. Top-right **Manual Deploy** → Deploy latest commit
4. Wait 2min → https://civicsense-backend-1.onrender.com/api/health ✅

### Method 2: Git Push
```
git add .
git commit -m "Fix login/signup"
git push origin main
```
→ Auto-deploy

### Method 3: Local Test → Deploy
1. Backend local works → rsync code
2. Render dashboard → Connect Git → Deploy

## Wake Render (Signup Fix)
Visit: https://civicsense-backend-1.onrender.com/api/health
→ Wakes 60s → Signup instant

## Verify
curl https://civicsense-backend-1.onrender.com/api/auth/signup -d '{"name":"Test","email":"testrender@gmail.com","password":"test","confirmPassword":"test"}' -H "Content-Type: application/json"

**Redeploy = Instant fresh backend + no sleep issues!** 🚀
