@echo off
setlocal
cd /d "%~dp0"

where node >nul 2>nul
if errorlevel 1 (
  echo Node.js not found. Please install Node.js 24+ from https://nodejs.org/
  pause
  exit /b 1
)

powershell -NoProfile -Command "try { (New-Object Net.Sockets.TcpClient).Connect('127.0.0.1',3000); exit 0 } catch { exit 1 }"
if not errorlevel 1 (
  echo The site is already running. Opening browser...
  start "" "http://127.0.0.1:3000"
  exit /b 0
)

if not exist "server\node_modules" (
  echo Installing server dependencies...
  pushd server
  call npm install --omit=dev
  popd
)

if not exist "client\node_modules" (
  echo Installing client dependencies...
  pushd client
  call npm install
  popd
)

if not exist "client\dist\index.html" (
  echo Building frontend...
  pushd client
  call npm run build
  if errorlevel 1 (
    popd
    echo Frontend build failed. See errors above.
    pause
    exit /b 1
  )
  popd
)

if not exist "server\.env" (
  copy "server\.env.example" "server\.env" >nul
  echo Created server\.env
)

rem Local single-user mode: skip login page
findstr /B /C:"LOCAL_MODE=1" "server\.env" >nul 2>nul
if errorlevel 1 echo LOCAL_MODE=1>>"server\.env"

pushd server
echo Syncing question bank...
call node src/db/seed.js
echo.
echo Starting server. Browser will open http://127.0.0.1:3000 shortly.
start "" /b powershell -NoProfile -Command "Start-Sleep -Seconds 3; Start-Process 'http://127.0.0.1:3000'"
node src/index.js
popd

echo.
echo Server stopped.
pause
