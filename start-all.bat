@echo off
chcp 65001 >nul
setlocal enabledelayedexpansion

echo ====================================================
echo    Cross-Chain Betting System - Full Startup
echo ====================================================
echo.

REM 配置路径
set PROJECT_ROOT=C:\Users\zhaow\Desktop\cross-chain
set PYTHON_PATH=C:\anaconda\envs\stablediff\python.exe

echo [STEP 1/4] Starting Hardhat Local Node...
echo ====================================================
cd /d "%PROJECT_ROOT%\network"
start "Hardhat Node" cmd /k "npx hardhat node"
timeout /t 5 /nobreak >nul
echo [OK] Hardhat node started on http://localhost:8545
echo.

echo [STEP 2/4] Deploying Smart Contracts...
echo ====================================================
cd /d "%PROJECT_ROOT%\network"
call npx hardhat run scripts/deploy.js --network localhost
if errorlevel 1 (
    echo [ERROR] Contract deployment failed
    pause
    exit /b 1
)
echo [OK] Contracts deployed successfully
echo.

echo [STEP 3/4] Starting Python Relayer Server...
echo ====================================================
cd /d "%PROJECT_ROOT%\relayer-python"
::start "Relayer Server" cmd /k "%PYTHON_PATH% relayer_server.py"
start "Relayer Server" cmd /k "conda run -n stablediff python relayer_server.py"
timeout /t 3 /nobreak >nul
echo [OK] Relayer server starting in conda stablediff environment
echo.

echo [STEP 4/4] Testing System Health...
echo ====================================================
timeout /t 2 /nobreak >nul

REM 测试 Relayer 健康检查
powershell -Command "try { $response = Invoke-RestMethod -Uri 'http://localhost:8080/api/v1/health' -TimeoutSec 5; if ($response.code -eq 0) { Write-Host '[OK] Relayer API is healthy' -ForegroundColor Green } else { Write-Host '[WARN] Relayer responded but status unclear' -ForegroundColor Yellow } } catch { Write-Host '[ERROR] Cannot connect to Relayer API' -ForegroundColor Red }"

echo.
echo ====================================================
echo    System Startup Complete!
echo ====================================================
echo.
echo Services Running:
echo   1. Hardhat Node:     http://localhost:8545
echo   2. Relayer API:      http://localhost:8080
echo   3. Health Check:     http://localhost:8080/api/v1/health
echo.
echo Next Steps:
echo   - Run SDK tests:     cd sdk ^&^& npx ts-node test-integration.ts
echo   - Check logs:        See the opened terminal windows
echo   - Stop services:     Close terminal windows or press Ctrl+C
echo.
echo This window will stay open for monitoring.
echo Close this window when you want to stop everything.
echo ====================================================
echo.
echo Keeping window open... Press Ctrl+C to exit.
cmd /k
