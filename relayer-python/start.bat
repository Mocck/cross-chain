@echo off
chcp 65001 >nul
echo ====================================================
echo    Cross-Chain Relayer - Quick Start
echo ====================================================
echo.

set SCRIPT_DIR=%~dp0

echo [CHECK] Checking conda environment...
where conda >nul 2>&1
if errorlevel 1 (
    echo [ERROR] Conda not found in PATH
    echo Please install Anaconda/Miniconda or add it to PATH
    pause
    exit /b 1
)

echo [OK] Conda found
echo.

echo [CHECK] Checking config file...
if not exist "%SCRIPT_DIR%config.yaml" (
    echo [ERROR] config.yaml not found
    pause
    exit /b 1
)

echo [OK] Config file found
echo.

echo [START] Starting Relayer server in conda stablediff environment...
echo Press Ctrl+C to stop
echo.

cd /d "%SCRIPT_DIR%"
conda run -n stablediff python relayer_server.py

pause
