@echo off
echo Starting Cloudflare Quick Tunnel (try.cloudflare.com) for TableEdge...
echo Frontend (Vite): http://localhost:5173
echo Backend (FastAPI API Proxy): http://localhost:5173/api -> http://127.0.0.1:8000
echo.
"C:\Program Files (x86)\cloudflared\cloudflared.exe" tunnel --url http://localhost:5173
pause
