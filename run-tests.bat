@echo off
cd /d c:\Users\arivu\OneDrive\Desktop\uber\server
node test-all-conditions.js > test-results.txt 2>&1
type test-results.txt
pause
