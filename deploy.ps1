# Выкладка доработок CRM (сущности, шахматка) из папки espo\ в работающий контейнер.
#
# Запуск из этой папки, CRM должна быть запущена (docker compose up -d):
#   .\deploy.ps1
#
# Скрипт только добавляет и перезаписывает файлы, ничего не удаляет и базу не трогает.
# После выкладки обнови страницу CRM в браузере (Ctrl+F5).

$ErrorActionPreference = 'Stop'
$root = Split-Path -Parent $MyInvocation.MyCommand.Path
$container = 'espocrm'
$html = '/var/www/html'

function Invoke-Docker {
    & docker @args
    if ($LASTEXITCODE -ne 0) { throw "docker $($args -join ' ') завершился с кодом $LASTEXITCODE" }
}

Write-Host 'Копирую серверную часть (custom/Espo/Custom)...'
Invoke-Docker exec $container mkdir -p "$html/custom/Espo/Custom" "$html/client/custom/src"
Invoke-Docker cp "$root\espo\custom\Espo\Custom\." "${container}:$html/custom/Espo/Custom/"

Write-Host 'Копирую клиентскую часть (client/custom/src)...'
Invoke-Docker cp "$root\espo\client\custom\src\." "${container}:$html/client/custom/src/"

Invoke-Docker exec $container chown -R www-data:www-data "$html/custom/Espo/Custom" "$html/client/custom"

Write-Host 'Пересобираю метаданные и чищу кеш...'
Invoke-Docker exec -u www-data $container php command.php rebuild
Invoke-Docker exec -u www-data $container php command.php clear-cache

Write-Host 'Готово. Обнови страницу CRM в браузере (Ctrl+F5).'
