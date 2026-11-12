@echo off
setlocal
cd /d "%~dp0"

where node >nul 2>nul
if errorlevel 1 (
  echo Node.js not found.
  pause
  exit /b 1
)

rem Server must be stopped: SQLite file cannot be copied while in use
powershell -NoProfile -Command "try { (New-Object Net.Sockets.TcpClient).Connect('127.0.0.1',3000); exit 0 } catch { exit 1 }"
if not errorlevel 1 (
  echo The site is still running. Close the server window first, then run this again.
  pause
  exit /b 1
)

if not exist "server\data\app.db" (
  echo No database found at server\data\app.db
  pause
  exit /b 1
)

echo Flushing database...
pushd server
call node --input-type=module -e "import db from './src/db/index.js'; db.exec('PRAGMA wal_checkpoint(TRUNCATE)');"
popd

git add server/data/app.db
git diff --cached --quiet
if not errorlevel 1 (
  echo No progress changes to upload.
) else (
  for /f "tokens=1-3 delims=/- " %%a in ('powershell -NoProfile -Command "Get-Date -Format ''yyyy-MM-dd HH:mm''"') do set STAMP=%%a %%b %%c
  git commit -m "data: sync progress at %STAMP%"
  if errorlevel 1 (
    echo Commit failed.
    pause
    exit /b 1
  )
)

echo Uploading to remote...
git push origin master
if errorlevel 1 (
  echo.
  echo Push failed. The remote has newer data.
  echo Run: git pull   then run this script again.
  pause
  exit /b 1
)

echo.
echo Progress uploaded.
pause
