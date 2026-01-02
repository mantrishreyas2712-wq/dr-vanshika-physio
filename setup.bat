@echo off
setlocal
title Dr. Vanshika Naik - Project Setup

echo ==========================================
echo   Dr. Vanshika Naik - Physiotherapy Website
echo   Automated Setup Script
echo ==========================================
echo.

:: Check for Node.js
where node >nul 2>nul
if %errorlevel% neq 0 (
    echo [!] Node.js is NOT installed.
    echo [*] Attempting to install Node.js (LTS) via Winget...
    echo.
    where winget >nul 2>nul
    if %errorlevel% neq 0 (
        echo [X] Winget is not available. Please install Node.js manually from https://nodejs.org/
        pause
        exit /b 1
    )
    
    :: Install Node.js
    winget install -e --id OpenJS.NodeJS
    
    if %errorlevel% neq 0 (
        echo [X] Installation failed. Please install Node.js manually.
        pause
        exit /b 1
    )
    
    echo.
    echo [!] Node.js installed! 
    echo [!] You may need to RESTART this script or your computer for changes to take effect.
    echo.
    pause
    exit /b 0
) else (
    echo [OK] Node.js is installed.
)

:: Install Dependencies
echo.
echo [*] Installing project dependencies...
call npm install
if %errorlevel% neq 0 (
    echo [X] Failed to install dependencies.
    pause
    exit /b 1
)

:: Start Server
echo.
echo [OK] Setup complete!
echo [*] Starting the server...
echo.
echo    Open http://localhost:3000 in your browser
echo.

call npm start

pause
