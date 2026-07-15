@echo off
echo Killing old node processes...
taskkill /F /IM node.exe >nul 2>&1

echo ===================================================
echo   1. Starting BACKEND (Port 3001) in new window
echo ===================================================
start "PaperTradeX BACKEND" cmd /k "cd backend && echo Installing... && npm install && echo Starting Server... && npm start"

echo.
echo Waiting 5 seconds...
timeout /t 5 >nul

echo ===================================================
echo   2. Starting FRONTEND (Port 3000) in new window
echo ===================================================
echo If this fails, check the Frontend window for errors.
start "PaperTradeX FRONTEND" cmd /k "cd frontend && echo Installing... && npm install && echo Starting Next.js... && npm run dev"

echo.
echo DONE. Two windows should open.
echo Backend: http://localhost:3001
echo Frontend: http://localhost:3000
pause
