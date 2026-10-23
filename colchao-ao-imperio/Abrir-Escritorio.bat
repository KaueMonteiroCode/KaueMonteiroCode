@echo off
cd /d "%~dp0"
title Escritorio dos Robos
where node >/dev/null 2>/dev/null || (echo Instale o Node.js em https://nodejs.org e abra de novo. & pause & exit /b)
if defined ANTHROPIC_API_KEY if not exist node_modules\@anthropic-ai\sdk call npm install --omit=dev
start "" http://localhost:4317
node office-server\server.mjs
pause
