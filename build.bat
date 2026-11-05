@echo off
title Build PokeSurvivor app.min.js
cd /d "%~dp0"
echo Dang dong goi PokeSurvivor vao app.min.js...
node tools/quick_build.js
pause

