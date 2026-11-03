<?php
// POST /api/lead.php — приём заявки (контракт interfaces.md §5).
declare(strict_types=1);

namespace Agv\Http;

use Agv\RateLimited;
use Agv\SpamRejected;
use Agv\ValidationFailed;

require_once __DIR__ . '/../../backend/http.php';

const MAX_BODY = 65536;

onlyMethod('POST');

startSession();
$expected = $_SESSION['csrf'] ?? '';
session_write_close();
$given = $_SERVER['HTTP_X_CSRF_TOKEN'] ?? '';
if (!is_string($expected) || $expected === '' || !is_string($given) || !hash_equals($expected, $given)) {
    reply(403, ['ok' => false, 'error' => 'Сессия устарела. Обновите страницу и отправьте заявку ещё раз.']);
}

$raw = (string) file_get_contents('php://input', false, null, 0, MAX_BODY + 1);
$data = strlen($raw) > MAX_BODY ? null : json_decode($raw, true);
if (!is_array($data) || array_is_list($data)) {
    reply(400, ['ok' => false, 'error' => 'Не удалось прочитать заявку. Обновите страницу.']);
}

try {
    $service = \Agv\app();
    $lead = $service->accept($data, (string) ($_SERVER['REMOTE_ADDR'] ?? 'unknown'));
} catch (SpamRejected) {
    // Тихий отказ: бот видит успех, в журнал ничего не пишется.
    reply(200, ['ok' => true, 'id' => sprintf('AGV-%s-%04d', date('Ymd'), random_int(1, 9999))]);
} catch (ValidationFailed $e) {
    reply(422, ['ok' => false, 'errors' => $e->errors]);
} catch (RateLimited) {
    header('Retry-After: 900');
    reply(429, ['ok' => false, 'error' => 'Слишком много заявок подряд. Попробуйте через 15 минут или позвоните: ' . PHONE]);
} catch (\Throwable $e) {
    error_log('lead.php: ' . get_class($e));
    reply(500, ['ok' => false, 'error' => 'Не удалось принять заявку. Позвоните: ' . PHONE]);
}

// Заявка уже в журнале. На FastCGI отвечаем сразу, рассылка идёт после ответа.
$response = json_encode(['ok' => true, 'id' => $lead->id], JSON_UNESCAPED_UNICODE);
if (function_exists('fastcgi_finish_request')) {
    http_response_code(200);
    echo $response;
    fastcgi_finish_request();
    $service->deliver($lead);
    exit;
}
try {
    $service->deliver($lead);
} catch (\Throwable $e) {
    error_log('lead.php deliver: ' . get_class($e)); // статус не отмечен — console.php resend подхватит
}
http_response_code(200);
echo $response;
