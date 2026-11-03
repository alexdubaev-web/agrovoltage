<?php
// Служебные команды. Запуск: php backend/console.php resend
//   resend — повторно отправляет заявки, у которых какой-то канал в статусе failed
//            или статус доставки не записан (например, процесс оборвался).
declare(strict_types=1);

if (PHP_SAPI !== 'cli') {
    http_response_code(404);
    exit;
}

require_once __DIR__ . '/bootstrap.php';

$command = $argv[1] ?? '';
if ($command !== 'resend') {
    fwrite(STDERR, "Использование: php backend/console.php resend\n");
    exit(2);
}

$stats = Agv\app()->resend();
printf("Проверено заявок: %d, доставлено: %d, снова не удалось: %d\n", $stats['checked'], $stats['sent'], $stats['failed']);
exit($stats['failed'] > 0 ? 1 : 0);
