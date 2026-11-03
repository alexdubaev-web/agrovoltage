<?php
declare(strict_types=1);

namespace Agv;

/**
 * storage/leads.jsonl — журнал только на дописывание. Строки двух видов:
 *   {"kind":"lead", "id":"AGV-YYYYMMDD-NNNN", ...}            — заявка, пишется до отправки;
 *   {"kind":"delivery", "id":..., "at":..., "channels":{"mail":"sent|failed|skipped","max":...}}
 * Последняя строка delivery по id — текущий статус доставки.
 */
final class Journal
{
    private string $file;
    private string $counterFile;

    public function __construct(private string $dir)
    {
        if (!is_dir($dir) && !@mkdir($dir, 0775, true) && !is_dir($dir)) {
            throw new \RuntimeException('storage недоступен');
        }
        $this->file = $dir . '/leads.jsonl';
        $this->counterFile = $dir . '/counter.json';
    }

    /** Присваивает номер AGV-YYYYMMDD-NNNN (счётчик по дням, МСК) и пишет заявку. */
    public function add(Lead $lead): Lead
    {
        $fh = fopen($this->counterFile, 'c+');
        if ($fh === false || !flock($fh, LOCK_EX)) {
            throw new \RuntimeException('счётчик недоступен');
        }
        try {
            $state = json_decode((string) stream_get_contents($fh), true);
            $day = date('Ymd');
            $n = (is_array($state) && ($state['day'] ?? '') === $day) ? (int) $state['n'] + 1 : 1;
            $lead = $lead->withId(sprintf('AGV-%s-%04d', $day, $n));
            $this->append($lead->toArray());
            ftruncate($fh, 0);
            rewind($fh);
            fwrite($fh, json_encode(['day' => $day, 'n' => $n]));
            fflush($fh);
        } finally {
            flock($fh, LOCK_UN);
            fclose($fh);
        }
        return $lead;
    }

    /** @param array<string,string> $channels */
    public function markDelivery(string $id, array $channels): void
    {
        $this->append(['kind' => 'delivery', 'id' => $id, 'at' => date('c'), 'channels' => $channels]);
    }

    /** Заявки и их последний статус доставки: list<array{lead:Lead, channels:?array}>. */
    public function all(): array
    {
        if (!is_file($this->file)) {
            return [];
        }
        $leads = [];
        $status = [];
        foreach (file($this->file, FILE_IGNORE_NEW_LINES | FILE_SKIP_EMPTY_LINES) as $line) {
            $r = json_decode($line, true);
            if (!is_array($r) || !isset($r['id'])) {
                continue;
            }
            if (($r['kind'] ?? '') === 'lead') {
                $leads[$r['id']] = $r;
            } elseif (($r['kind'] ?? '') === 'delivery') {
                $status[$r['id']] = (array) $r['channels'];
            }
        }
        $out = [];
        foreach ($leads as $id => $r) {
            $out[] = ['lead' => Lead::fromArray($r), 'channels' => $status[$id] ?? null];
        }
        return $out;
    }

    private function append(array $record): void
    {
        $line = json_encode($record, JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES | JSON_THROW_ON_ERROR) . "\n";
        if (file_put_contents($this->file, $line, FILE_APPEND | LOCK_EX) !== strlen($line)) {
            throw new \RuntimeException('журнал недоступен для записи');
        }
    }
}
