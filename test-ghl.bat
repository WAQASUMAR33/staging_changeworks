@echo off
REM GHL API Key Test Script (Batch)
REM 
REM This script tests GHL API keys to check if they can create sub-accounts.
REM 
REM Usage:
REM   test-ghl.bat "your_api_key_here"
REM   test-ghl.bat "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9..."

if "%~1"=="" (
    echo.
    echo 🔑 GHL API Key Test Script (Batch)
    echo ========================================
    echo.
    echo 📖 Usage:
    echo    test-ghl.bat "your_api_key_here"
    echo    test-ghl.bat "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9..."
    echo.
    echo 📝 Examples:
    echo    test-ghl.bat "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9..."
    echo    test-ghl.bat "pit-f397ad9f-cf11-49b8-a791-658b934ec3f6"
    echo.
    echo 🔑 Key Types:
    echo    • Personal Access Token: ~50 chars, pit-xxxxxxxx format
    echo    • Location API Key: ~200-300 chars, JWT format
    echo    • Agency API Key: 250+ chars, JWT format (CAN create sub-accounts)
    echo.
    pause
    exit /b 1
)

REM Check if PowerShell is available
powershell -Command "Get-Host" >nul 2>&1
if %errorlevel% neq 0 (
    echo ❌ Error: PowerShell is not available
    echo Please install PowerShell to run this script
    pause
    exit /b 1
)

REM Run the PowerShell script
powershell -ExecutionPolicy Bypass -File "test-ghl.ps1" -ApiKey "%~1"

REM Check the exit code
if %errorlevel% equ 0 (
    echo.
    echo ✅ Test completed successfully
) else (
    echo.
    echo ❌ Test failed
)

pause
