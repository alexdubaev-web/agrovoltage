<?php
// Точка входа бэкенда заявок. Подключается из public/api/*.php и backend/console.php.
// backend/ и storage/ лежат вне веб-корня (interfaces.md §5, §6).
declare(strict_types=1);

namespace Agv;

const PROJECT_ROOT = __DIR__ . '/..';

require_once __DIR__ . '/src/Config.php';
require_once __DIR__ . '/src/Logger.php';
require_once __DIR__ . '/src/Lead.php';
require_once __DIR__ . '/src/LeadValidator.php';
require_once __DIR__ . '/src/Journal.php';
require_once __DIR__ . '/src/RateLimiter.php';
require_once __DIR__ . '/src/Channel.php';
require_once __DIR__ . '/src/MailChannel.php';
require_once __DIR__ . '/src/MaxChannel.php';
require_once __DIR__ . '/src/LeadService.php';

date_default_timezone_set('Europe/Moscow');

function app(): LeadService
{
    static $service = null;
    if ($service === null) {
        $config = Config::load(PROJECT_ROOT);
        $logger = new Logger($config->storageDir() . '/app.log', $config->secretValues());
        $service = new LeadService(
            new Journal($config->storageDir()),
            new RateLimiter($config->storageDir() . '/ratelimit.json', 5, 900),
            [new MailChannel($config, $logger), new MaxChannel($config, $logger)],
            $logger,
        );
    }
    return $service;
}
