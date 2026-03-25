@echo off
setlocal
cd /d C:\Users\Admin\smart_ecommerce\django_admin

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

echo Using %PYTHON_CMD% to start Django admin...
%PYTHON_CMD% -m pip install -r ..\fastapi_backend\requirements.txt
if errorlevel 1 goto fail

%PYTHON_CMD% manage.py migrate
if errorlevel 1 goto fail

%PYTHON_CMD% manage.py create_default_admin
if errorlevel 1 goto fail

echo.
echo Django admin is starting on http://127.0.0.1:8001/admin
%PYTHON_CMD% manage.py runserver 127.0.0.1:8001 --noreload
goto end

:fail
echo.
echo Django admin failed to start. Check the error shown above.
pause
exit /b 1

:end
endlocal
