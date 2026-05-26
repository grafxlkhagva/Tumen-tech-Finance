@echo off
echo TumenAccounting 2.0 эхлүүлж байна...
echo.

pip install flask flask-sqlalchemy --quiet

echo.
echo Систем ажиллаж байна: http://localhost:5000
echo Зогсоохдоо Ctrl+C дарна уу
echo.
start http://localhost:5000
python app.py
pause
