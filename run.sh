#!/usr/bin/env bash
set -euo pipefail
cd "$(dirname "$0")"
if ! command -v java >/dev/null 2>&1; then
  echo "Java не найден. Установи JDK 17 или новее."
  exit 1
fi
if ! command -v mvn >/dev/null 2>&1; then
  echo "Maven не найден. Установи Maven или открой проект в IDE с Maven."
  exit 1
fi
java -version
mvn -B -ntp spring-boot:run
