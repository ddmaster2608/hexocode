@echo off
rem Goodnut 博客管理台启动器（ANSI/GBK 编码，勿存为 UTF-8）
rem 双击：未运行则启动服务，然后打开浏览器
cd /d "%~dp0.."
netstat -ano | findstr ":4210 " | findstr "LISTENING" >nul
if not errorlevel 1 goto open
echo 正在启动博客管理台...
start "Goodnut Admin Server" /min cmd /c "node admin-ui\server.mjs & echo. & echo 服务已退出，按任意键关闭窗口 & pause >nul"
timeout /t 2 /nobreak >nul
:open
start "" "http://127.0.0.1:4210"
