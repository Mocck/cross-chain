@echo off
chcp 65001 >nul
setlocal enabledelayedexpansion

echo ====================================================
echo    Cross-Chain Dual-Node Startup
echo    Chain A (31337) on :8545 / Chain B (31338) on :8546
echo ====================================================
echo.

set PROJECT_ROOT=%~dp0..

echo [STEP 1/4] Starting Chain A (31337, Port 8545)...
set HARDHAT_CHAIN_ID=31337
start "Hardhat-31337" cmd /c "cd /d %PROJECT_ROOT%\network && npx hardhat node --port 8545"
echo [OK] Chain A starting...
timeout /t 3 /nobreak >nul

echo [STEP 2/4] Starting Chain B (31338, Port 8546)...
set HARDHAT_CHAIN_ID=31338
start "Hardhat-31338" cmd /c "cd /d %PROJECT_ROOT%\network && npx hardhat node --port 8546"
echo [OK] Chain B starting...
timeout /t 5 /nobreak >nul

echo [STEP 3/4] Deploying to Chain A (31337)...
cd /d "%PROJECT_ROOT%\network"
call npx hardhat run scripts/deploy.js --network localhost
if errorlevel 1 (
    echo [ERROR] Deployment to Chain A failed
    pause
    exit /b 1
)
echo [OK] Chain A deployed
echo.

echo [STEP 4/4] Deploying to Chain B (31338)...
call npx hardhat run scripts/deploy.js --network localhostB
if errorlevel 1 (
    echo [ERROR] Deployment to Chain B failed
    pause
    exit /b 1
)
echo [OK] Chain B deployed
echo.

echo ====================================================
echo    Deployment Complete!
echo ====================================================
echo   Chain A (31337): http://localhost:8545
echo   Chain B (31338): http://localhost:8546
echo   Addresses: network\deployed-addresses.json
echo ====================================================
pause
