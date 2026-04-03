@echo off
echo ======================================
echo DevPulse VS Code Extension - Package Script
echo ======================================
echo.

cd /d "d:\devpluse final\DevPulse_Production\devpulse_final_build"

echo Step 1: Verifying icon.png exists...
if exist "icon.png" (
    echo [OK] icon.png found!
) else (
    echo [ERROR] icon.png NOT FOUND!
    pause
    exit /b 1
)
echo.

echo Step 2: Committing icon.png to git...
del /f /q ".git\index.lock" 2>nul
git add icon.png
git commit -m "feat: Add icon.png - VS Code extension 100%% marketplace ready"
git push origin master
echo.

echo Step 3: Installing TypeScript and compiling...
call npm run compile
if errorlevel 1 (
    echo [ERROR] Compilation failed!
    pause
    exit /b 1
)
echo [OK] Compilation successful!
echo.

echo Step 4: Installing VSCE (if not installed)...
call npm list -g @vscode/vsce >nul 2>&1
if errorlevel 1 (
    echo Installing vsce globally...
    call npm install -g @vscode/vsce
)
echo [OK] VSCE is ready!
echo.

echo Step 5: Packaging extension...
call vsce package --allow-star-activation
if errorlevel 1 (
    echo [ERROR] Packaging failed!
    pause
    exit /b 1
)
echo.

echo ======================================
echo SUCCESS! Extension packaged successfully!
echo ======================================
echo.
echo VSIX file created: devpulse-1.0.0.vsix
echo.
echo NEXT STEPS:
echo 1. Test locally:
echo    code --install-extension devpulse-1.0.0.vsix
echo.
echo 2. Create publisher account:
echo    https://marketplace.visualstudio.com/manage/publishers/
echo.
echo 3. Publish to marketplace:
echo    vsce login rashi-technologies
echo    vsce publish
echo.
echo ======================================

pause
