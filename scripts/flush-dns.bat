@echo off
echo ===================================
echo Supabase Connection Troubleshooter
echo ===================================
echo.
echo This script will help fix DNS resolution issues with Supabase.
echo.

REM Check for administrator privileges
net session >nul 2>&1
if %errorLevel% neq 0 (
    echo ERROR: This script requires administrator privileges.
    echo Please right-click on this file and select "Run as administrator".
    echo.
    pause
    exit /b 1
)

echo Step 1: Flushing DNS cache...
ipconfig /flushdns
echo.

echo Step 2: Registering DNS...
ipconfig /registerdns
echo.

echo Step 3: Resetting Winsock catalog...
netsh winsock reset
echo.

echo Step 4: Resetting TCP/IP stack...
netsh int ip reset
echo.

echo Step 5: Clearing NetBIOS cache...
nbtstat -R
echo.

echo Step 6: Releasing and renewing IP address...
ipconfig /release
ipconfig /renew
echo.

echo Step 7: Testing connection to Supabase...
ping ycucolbmqjqzhfgiteih.supabase.co
echo.

echo ===================================
echo Troubleshooting complete!
echo.
echo If you still experience connection issues:
echo 1. Try changing your DNS settings to Google DNS (8.8.8.8, 8.8.4.4)
echo 2. Check your firewall settings
echo 3. Restart your computer
echo 4. Verify your Supabase URL in .env.local file
echo.

pause 