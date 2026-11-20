@echo off
setlocal
cd /d "%~dp0"

rem Find the installed Temurin JDK 17 when JAVA_HOME is not configured.
if not defined JAVA_HOME (
  for /d %%J in ("C:\Program Files\Eclipse Adoptium\jdk-17*") do (
    if exist "%%~fJ\bin\java.exe" set "JAVA_HOME=%%~fJ"
  )
)
if defined JAVA_HOME if exist "%JAVA_HOME%\bin\java.exe" set "PATH=%JAVA_HOME%\bin;%PATH%"
where java >nul 2>nul || (echo Java JDK 17+ not found. Install Temurin JDK 17 or newer.& pause & exit /b 1)

rem Find the Maven installation used by this project setup if it is not on PATH.
where mvn >nul 2>nul || if exist "%USERPROFILE%\Downloads\Apache-Maven\apache-maven-3.9.11\bin\mvn.cmd" set "PATH=%USERPROFILE%\Downloads\Apache-Maven\apache-maven-3.9.11\bin;%PATH%"
where mvn >nul 2>nul || (echo Maven not found. Install Maven or add its bin folder to PATH.& pause & exit /b 1)

mvn -B -ntp spring-boot:run
pause
