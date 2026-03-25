@echo off
cd /d C:\Users\Admin\smart_ecommerce\django_admin
py -m pip install django
py manage.py migrate
py manage.py create_default_admin
echo.
echo Django admin setup complete.
echo Open http://127.0.0.1:8001/admin
