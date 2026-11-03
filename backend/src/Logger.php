<?php
declare(strict_types=1);

namespace Agv;

/** storage/app.log: служебные события без персональных данных и без значений секретов. */
final class Logger
{
    public function __construct(private string $file, private array $secrets = [])
    {
    }

    public function info(string $message): void
    {
        $this->write('INFO', $message);
    }

    public function error(string $message): void
    {
        $this->write('ERROR', $message);
    }

    private function write(string $level, string $message): void
    {
        foreach ($this->secrets as $secret) {
            $message = str_replace($secret, '***', $message);
        }
        $message = preg_replace('/[\r\n]+/', ' ', $message);
        $dir = dirname($this->file);
        if (!is_dir($dir)) {
            @mkdir($dir, 0775, true);
        }
        @file_put_contents($this->file, sprintf("[%s] %s %s\n", date('c'), $level, $message), FILE_APPEND | LOCK_EX);
    }
}
