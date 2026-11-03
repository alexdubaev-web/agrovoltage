<?php
declare(strict_types=1);

namespace Agv;

/**
 * Сообщение в чат через Bot API мессенджера MAX.
 *
 * Документация (сверено 2026-11-03):
 *   https://dev.max.ru/docs-api/methods/POST/messages — POST /messages, получатель в query:
 *     chat_id (чат или канал) или user_id (личный диалог); тело JSON {text (до 4000 символов), format?, notify?}.
 *   https://dev.max.ru/docs-api — токен бота только в заголовке «Authorization: <token>» без «Bearer»,
 *     токен в query больше не принимается. Базовый адрес — https://platform-api2.max.ru
 *     (вместо platform-api.max.ru); сервер использует сертификат Минцифры, его корневой
 *     сертификат должен быть в доверенных на хостинге.
 *
 * Переменные: MAX_BOT_TOKEN, MAX_CHAT_ID (обязательны), MAX_API_URL (необязательно, по умолчанию
 * https://platform-api2.max.ru; в тестах — локальная заглушка).
 */
final class MaxChannel implements Channel
{
    public const DEFAULT_API_URL = 'https://platform-api2.max.ru';
    private const MAX_TEXT = 4000;

    public function __construct(private Config $config, private Logger $logger)
    {
    }

    public function name(): string
    {
        return 'max';
    }

    public function missingSettings(): array
    {
        $missing = [];
        foreach (['MAX_BOT_TOKEN', 'MAX_CHAT_ID'] as $key) {
            if ($this->config->get($key) === '') {
                $missing[] = $key;
            }
        }
        return $missing;
    }

    public function send(Lead $lead): bool
    {
        $chatId = $this->config->get('MAX_CHAT_ID');
        if (!preg_match('/^-?\d{1,20}$/', $chatId)) {
            $this->logger->error('MAX: MAX_CHAT_ID должен быть числом');
            return false;
        }
        $text = $lead->text();
        if (preg_match_all('/./su', $text) > self::MAX_TEXT) {
            $text = implode('', array_slice(preg_split('//u', $text, -1, PREG_SPLIT_NO_EMPTY), 0, self::MAX_TEXT - 1)) . '…';
        }
        $url = rtrim($this->config->get('MAX_API_URL', self::DEFAULT_API_URL), '/') . '/messages?chat_id=' . rawurlencode($chatId);
        $body = json_encode(['text' => $text, 'notify' => true], JSON_UNESCAPED_UNICODE | JSON_THROW_ON_ERROR);
        $headers = ['Authorization: ' . $this->config->get('MAX_BOT_TOKEN'), 'Content-Type: application/json; charset=utf-8'];

        [$status, $error] = function_exists('curl_init') ? $this->viaCurl($url, $headers, $body) : $this->viaStream($url, $headers, $body);
        if ($status >= 200 && $status < 300) {
            return true;
        }
        $this->logger->error(sprintf('MAX: заявка %s не отправлена: %s', $lead->id, $error ?: 'HTTP ' . $status));
        return false;
    }

    /** @return array{int,string} */
    private function viaCurl(string $url, array $headers, string $body): array
    {
        $ch = curl_init($url);
        curl_setopt_array($ch, [
            CURLOPT_POST => true, CURLOPT_POSTFIELDS => $body, CURLOPT_HTTPHEADER => $headers,
            CURLOPT_RETURNTRANSFER => true, CURLOPT_CONNECTTIMEOUT => 5, CURLOPT_TIMEOUT => 10,
        ]);
        curl_exec($ch);
        $status = (int) curl_getinfo($ch, CURLINFO_RESPONSE_CODE);
        $error = curl_error($ch);
        curl_close($ch);
        return [$status, $error];
    }

    /** @return array{int,string} */
    private function viaStream(string $url, array $headers, string $body): array
    {
        $ctx = stream_context_create(['http' => [
            'method' => 'POST', 'header' => implode("\r\n", $headers), 'content' => $body,
            'timeout' => 10, 'ignore_errors' => true,
        ]]);
        $result = @file_get_contents($url, false, $ctx);
        $responseHeaders = function_exists('http_get_last_response_headers')
            ? (http_get_last_response_headers() ?? [])
            : ($http_response_header ?? []);
        $statusLine = $responseHeaders[0] ?? '';
        if ($result === false && $statusLine === '') {
            return [0, 'нет соединения с ' . (parse_url($url, PHP_URL_HOST) ?: 'API')];
        }
        return [preg_match('#^HTTP/\S+\s+(\d{3})#', $statusLine, $m) ? (int) $m[1] : 0, ''];
    }
}
