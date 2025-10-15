@echo off
REM GHL Account Creation Test Script (Batch)
REM 
REM This script tests GHL API keys by attempting to create a real sub-account.
REM 
REM Usage:
REM   test-ghl-create-account.bat "your_api_key_here"
REM   test-ghl-create-account.bat "your_api_key_here" --cleanup

if "%~1"=="" (
    echo.
    echo 🏢 GHL Account Creation Test Script (Batch)
    echo ==============================================
    echo.
    echo 📖 Usage:
    echo    test-ghl-create-account.bat "your_api_key_here"
    echo    test-ghl-create-account.bat "your_api_key_here" --cleanup
    echo.
    echo 📝 Examples:
    echo    test-ghl-create-account.bat "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9..."
    echo    test-ghl-create-account.bat "pit-f397ad9f-cf11-49b8-a791-658b934ec3f6" --cleanup
    echo.
    echo 🔑 Key Types:
    echo    • Personal Access Token: ~50 chars, pit-xxxxxxxx format
    echo    • Location API Key: ~200-300 chars, JWT format
    echo    • Agency API Key: 250+ chars, JWT format (CAN create sub-accounts)
    echo.
    echo ⚠️  Important:
    echo    • This script creates REAL GHL accounts
    echo    • Use --cleanup flag to automatically delete test accounts
    echo    • Test accounts are created with unique timestamps
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

REM Check for cleanup flag
if "%~2"=="--cleanup" (
    powershell -ExecutionPolicy Bypass -File "test-ghl-create-account.ps1" -ApiKey "%~1" -Cleanup
) else (
    powershell -ExecutionPolicy Bypass -File "test-ghl-create-account.ps1" -ApiKey "%~1"
)

REM Check the exit code
if %errorlevel% equ 0 (
    echo.
    echo ✅ Test completed successfully
) else (
    echo.
    echo ❌ Test failed
)

pause
