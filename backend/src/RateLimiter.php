<?php
declare(strict_types=1);

namespace Agv;

/** Не больше $limit принятых заявок с одного IP за $window секунд. IP хранится только хешем. */
final class RateLimiter
{
    public function __construct(private string $file, private int $limit, private int $window)
    {
    }

    /** true — можно принять заявку, попытка учтена; false — лимит исчерпан. */
    public function hit(string $ip): bool
    {
        $fh = fopen($this->file, 'c+');
        if ($fh === false || !flock($fh, LOCK_EX)) {
            throw new \RuntimeException('лимит недоступен');
        }
        try {
            $now = time();
            $data = json_decode((string) stream_get_contents($fh), true);
            $data = is_array($data) ? $data : [];
            foreach ($data as $k => $hits) {
                $data[$k] = array_values(array_filter((array) $hits, fn ($t) => $t > $now - $this->window));
                if (!$data[$k]) {
                    unset($data[$k]);
                }
            }
            $key = hash('sha256', 'agv|' . $ip);
            $allowed = count($data[$key] ?? []) < $this->limit;
            if ($allowed) {
                $data[$key][] = $now;
            }
            ftruncate($fh, 0);
            rewind($fh);
            fwrite($fh, json_encode($data));
            fflush($fh);
            return $allowed;
        } finally {
            flock($fh, LOCK_UN);
            fclose($fh);
        }
    }
}
