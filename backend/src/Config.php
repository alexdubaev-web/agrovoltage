<?php
declare(strict_types=1);

namespace Agv;

/**
 * Настройки из .env в корне проекта. Переменная окружения процесса важнее файла.
 * AGV_ENV_FILE и AGV_STORAGE_DIR подменяют путь к .env и к storage/ (нужно тестам).
 */
final class Config
{
    public const SECRET_KEYS = ['SMTP_USER', 'SMTP_PASSWORD', 'MAX_BOT_TOKEN'];

    /** @param array<string,string> $values */
    private function __construct(private array $values, private string $storageDir)
    {
    }

    public static function load(string $root): self
    {
        $envFile = self::env('AGV_ENV_FILE') ?: $root . '/.env';
        $values = is_file($envFile) ? self::parse((string) file_get_contents($envFile)) : [];
        foreach ([...array_keys($values), 'SMTP_HOST', 'SMTP_PORT', 'SMTP_USER', 'SMTP_PASSWORD', 'SMTP_SECURE',
            'MAIL_FROM', 'MAIL_TO', 'MAX_BOT_TOKEN', 'MAX_CHAT_ID', 'MAX_API_URL'] as $key) {
            $fromProcess = self::env($key);
            if ($fromProcess !== null) {
                $values[$key] = $fromProcess;
            }
        }
        $storage = self::env('AGV_STORAGE_DIR') ?: $root . '/storage';
        return new self($values, rtrim($storage, '/\\'));
    }

    public static function fromArray(array $values, string $storageDir): self
    {
        return new self(array_map('strval', $values), $storageDir);
    }

    private static function env(string $key): ?string
    {
        $v = getenv($key);
        return $v === false ? null : $v;
    }

    /** @return array<string,string> */
    private static function parse(string $text): array
    {
        $out = [];
        foreach (preg_split('/\R/', $text) as $line) {
            $line = trim($line);
            if ($line === '' || $line[0] === '#' || !str_contains($line, '=')) {
                continue;
            }
            [$k, $v] = array_map('trim', explode('=', $line, 2));
            if (strlen($v) >= 2 && ($v[0] === '"' || $v[0] === "'") && $v[-1] === $v[0]) {
                $v = substr($v, 1, -1);
            }
            if (preg_match('/^[A-Z][A-Z0-9_]*$/', $k)) {
                $out[$k] = $v;
            }
        }
        return $out;
    }

    public function get(string $key, string $default = ''): string
    {
        $v = trim($this->values[$key] ?? '');
        return $v === '' ? $default : $v;
    }

    public function storageDir(): string
    {
        return $this->storageDir;
    }

    /** Значения секретов — чтобы вычищать их из журнала ошибок. */
    public function secretValues(): array
    {
        return array_values(array_filter(array_map(fn ($k) => $this->get($k), self::SECRET_KEYS), fn ($v) => strlen($v) >= 4));
    }
}
