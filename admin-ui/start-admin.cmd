@echo off
rem Goodnut 博客管理台 - Windows 启动脚本（ANSI/GBK 编码，勿存为 UTF-8）
rem 双击运行，然后浏览器打开 http://127.0.0.1:4210
cd /d "%~dp0.."
echo 正在启动博客管理台 http://127.0.0.1:4210 ...
node admin-ui\server.mjs
pause
