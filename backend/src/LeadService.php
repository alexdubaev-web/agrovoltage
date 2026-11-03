<?php
declare(strict_types=1);

namespace Agv;

final class RateLimited extends \RuntimeException
{
}

/**
 * Порядок (interfaces.md §5): проверка → запись в журнал → отправка в каналы → отметка статуса.
 * Каналы независимы: сбой одного не мешает другому, заявка уже в журнале.
 */
final class LeadService
{
    /** @param list<Channel> $channels */
    public function __construct(
        private Journal $journal,
        private RateLimiter $limiter,
        private array $channels,
        private Logger $logger,
    ) {
    }

    /** @throws SpamRejected|ValidationFailed|RateLimited */
    public function accept(array $data, string $ip): Lead
    {
        try {
            $lead = LeadValidator::validate($data);
        } catch (SpamRejected $e) {
            $this->logger->info('Отклонена как спам (' . $e->getMessage() . '), в журнал не записана');
            throw $e;
        }
        if (!$this->limiter->hit($ip)) {
            $this->logger->info('Лимит заявок с одного IP исчерпан');
            throw new RateLimited();
        }
        return $this->journal->add($lead);
    }

    /**
     * Отправляет заявку в каналы. $previous — прошлый статус: повторяются только каналы со статусом
     * failed (null — все каналы). Возвращает и записывает в журнал итог: канал → sent | failed | skipped.
     */
    public function deliver(Lead $lead, ?array $previous = null): array
    {
        $result = $previous ?? [];
        foreach ($this->channels as $channel) {
            $name = $channel->name();
            if ($previous !== null && ($previous[$name] ?? 'failed') !== 'failed') {
                continue;
            }
            $missing = $channel->missingSettings();
            if ($missing) {
                // Недоставленная заявка остаётся в очереди повтора, даже если настройки убрали.
                $result[$name] = ($previous[$name] ?? '') === 'failed' ? 'failed' : 'skipped';
                $this->logger->info(sprintf('Канал %s не настроен (нет %s), пропущен', $name, implode(', ', $missing)));
                continue;
            }
            $result[$name] = $channel->send($lead) ? 'sent' : 'failed';
        }
        if (!in_array('sent', $result, true) && !in_array('failed', $result, true)) {
            $this->logger->info(sprintf('Заявка %s: режим «только журнал», каналы не настроены', $lead->id));
        }
        $this->journal->markDelivery($lead->id, $result);
        return $result;
    }

    /** Повторная отправка: заявки без статуса и каналы со статусом failed. */
    public function resend(): array
    {
        $stats = ['checked' => 0, 'sent' => 0, 'failed' => 0];
        foreach ($this->journal->all() as ['lead' => $lead, 'channels' => $channels]) {
            $pending = $channels === null ? null : array_filter($channels, fn ($s) => $s === 'failed');
            if ($channels !== null && !$pending) {
                continue;
            }
            $stats['checked']++;
            $result = $this->deliver($lead, $channels);
            foreach ($result as $name => $state) {
                if ($channels === null || ($channels[$name] ?? '') === 'failed') {
                    if ($state === 'sent') {
                        $stats['sent']++;
                    } elseif ($state === 'failed') {
                        $stats['failed']++;
                    }
                }
            }
        }
        return $stats;
    }
}
