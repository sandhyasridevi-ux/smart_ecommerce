@echo off
setlocal
cd /d C:\Users\Admin\smart_ecommerce
set "PYTHONPATH=C:\Users\Admin\smart_ecommerce;%PYTHONPATH%"

set "PYTHON_CMD="
where py >nul 2>nul
if %errorlevel%==0 set "PYTHON_CMD=py"

if not defined PYTHON_CMD (
  where python >nul 2>nul
  if %errorlevel%==0 set "PYTHON_CMD=python"
)

if not defined PYTHON_CMD (
  echo Python launcher not found. Install Python and try again.
  pause
  exit /b 1
)

echo Using %PYTHON_CMD% to start FastAPI...
%PYTHON_CMD% -m pip install -r fastapi_backend\requirements.txt
if errorlevel 1 goto fail

echo.
echo FastAPI is starting on http://127.0.0.1:8000
%PYTHON_CMD% -m uvicorn fastapi_backend.main:app --app-dir C:\Users\Admin\smart_ecommerce --host 127.0.0.1 --port 8000 --reload --reload-dir C:\Users\Admin\smart_ecommerce\fastapi_backend
goto end

:fail
echo.
echo FastAPI failed to start. Check the error shown above.
pause
exit /b 1

:end
endlocal
