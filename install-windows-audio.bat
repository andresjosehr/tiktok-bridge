@echo off
echo ===============================================
echo    TikTok Bridge - Windows Audio Setup
echo ===============================================
echo.
echo Este script ayudara a instalar ffplay para Windows
echo para mejorar la reproduccion de audio en DinoChrome.
echo.

REM Verificar si ffplay ya esta instalado
ffplay -version >nul 2>&1
if %errorlevel% == 0 (
    echo ✓ ffplay ya esta instalado y funcionando!
    echo.
    goto :END
)

echo × ffplay no encontrado en el sistema
echo.
echo Opciones de instalacion:
echo.
echo 1. Instalar con Chocolatey (recomendado)
echo 2. Instalar con Scoop
echo 3. Descargar manualmente
echo 4. Usar solo Windows Media Player
echo.
set /p choice="Selecciona una opcion (1-4): "

if "%choice%" == "1" goto :CHOCOLATEY
if "%choice%" == "2" goto :SCOOP
if "%choice%" == "3" goto :MANUAL
if "%choice%" == "4" goto :WMPLAYER
goto :INVALID

:CHOCOLATEY
echo.
echo Instalando ffmpeg (incluye ffplay) con Chocolatey...
echo.
choco install ffmpeg -y
if %errorlevel% == 0 (
    echo ✓ ffmpeg instalado correctamente!
) else (
    echo × Error instalando con Chocolatey
    echo   Asegurate de tener Chocolatey instalado: https://chocolatey.org/
)
goto :END

:SCOOP
echo.
echo Instalando ffmpeg con Scoop...
echo.
scoop install ffmpeg
if %errorlevel% == 0 (
    echo ✓ ffmpeg instalado correctamente!
) else (
    echo × Error instalando con Scoop
    echo   Asegurate de tener Scoop instalado: https://scoop.sh/
)
goto :END

:MANUAL
echo.
echo Descarga manual de FFmpeg:
echo.
echo 1. Ve a: https://ffmpeg.org/download.html#build-windows
echo 2. Descarga la version "release builds"
echo 3. Extrae el archivo ZIP
echo 4. Agrega la carpeta "bin" al PATH de Windows
echo 5. Reinicia el terminal y ejecuta: ffplay -version
echo.
echo Alternativamente, puedes copiar ffplay.exe al directorio del proyecto.
goto :END

:WMPLAYER
echo.
echo Configurando para usar solo Windows Media Player...
echo El sistema usara wmplayer.exe como reproductor principal.
echo.
echo NOTA: wmplayer puede no funcionar tan bien como ffplay
echo      para archivos MP3 cortos.
goto :END

:INVALID
echo.
echo Opcion invalida. Ejecuta el script nuevamente.
goto :END

:END
echo.
echo ===============================================
echo Para probar el audio, ejecuta el proyecto y 
echo observa los logs para ver que reproductor usa.
echo ===============================================
echo.
pause