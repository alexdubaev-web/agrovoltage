<?php
// Роутер встроенного сервера PHP для `npm run dev`: статика из dist/,
// PHP-файлы выполняются, неизвестный адрес — страница 404.
$root = realpath(__DIR__ . '/../dist');
$uri = urldecode(parse_url($_SERVER['REQUEST_URI'], PHP_URL_PATH) ?? '/');
$path = realpath($root . $uri);

$hidden = preg_match('#/\.#', $uri) === 1;

if (!$hidden && $path !== false && str_starts_with($path, $root)) {
    if (is_dir($path)) {
        if (!str_ends_with($uri, '/')) {
            header('Location: ' . $uri . '/', true, 301);
            return true;
        }
        if (is_file($path . '/index.html')) {
            header('Content-Type: text/html; charset=utf-8');
            readfile($path . '/index.html');
            return true;
        }
    } elseif (is_file($path)) {
        return false; // встроенный сервер отдаст файл или выполнит .php
    }
}

http_response_code(404);
header('Content-Type: text/html; charset=utf-8');
if (is_file($root . '/404.html')) {
    readfile($root . '/404.html');
}
return true;
