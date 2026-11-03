<?php
// GET /api/token.php → {"token":"..."}; токен живёт в сессии PHP (interfaces.md §5).
declare(strict_types=1);

namespace Agv\Http;

require_once __DIR__ . '/../../backend/http.php';

onlyMethod('GET');
try {
    startSession();
    $_SESSION['csrf'] ??= bin2hex(random_bytes(32));
    $token = $_SESSION['csrf'];
    session_write_close();
    reply(200, ['token' => $token]);
} catch (\Throwable $e) {
    reply(500, ['ok' => false, 'error' => 'Форма временно недоступна. Позвоните: ' . PHONE]);
}
