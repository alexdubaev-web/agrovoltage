<?php
// Общее для public/api/*.php: заголовки, JSON-ответ, сессия с CSRF-токеном.
declare(strict_types=1);

namespace Agv\Http;

require_once __DIR__ . '/bootstrap.php';

ini_set('display_errors', '0');
header('Content-Type: application/json; charset=utf-8');
header('Cache-Control: no-store');
header('X-Content-Type-Options: nosniff');
header('X-Robots-Tag: noindex, nofollow');

const PHONE = '+7 962 001 19 90';

function reply(int $status, array $data): never
{
    http_response_code($status);
    echo json_encode($data, JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES);
    exit;
}

function onlyMethod(string $method): void
{
    if (($_SERVER['REQUEST_METHOD'] ?? '') !== $method) {
        header('Allow: ' . $method);
        reply(405, ['ok' => false, 'error' => 'Метод не поддерживается.']);
    }
}

function startSession(): void
{
    $https = ($_SERVER['HTTPS'] ?? '') !== '' && ($_SERVER['HTTPS'] ?? '') !== 'off';
    ini_set('session.use_strict_mode', '1');
    ini_set('session.use_only_cookies', '1');
    session_name('agv_session');
    session_set_cookie_params(['lifetime' => 0, 'path' => '/api/', 'secure' => $https, 'httponly' => true, 'samesite' => 'Lax']);
    session_start();
}
