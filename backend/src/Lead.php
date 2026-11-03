<?php
declare(strict_types=1);

namespace Agv;

/** Проверенная заявка. Формат записи в storage/leads.jsonl — toArray() с kind = "lead". */
final class Lead
{
    public const TYPE_LABELS = [
        'callback' => 'Обратный звонок',
        'service' => 'Заявка на услугу',
        'order' => 'Заказ запчастей',
    ];

    /** @param list<array{slug:string,title:string,price:int|float|null,qty:int}> $items */
    public function __construct(
        public readonly string $id,
        public readonly string $type,
        public readonly string $name,
        public readonly string $phone,
        public readonly string $message,
        public readonly string $service,
        public readonly string $page,
        public readonly array $items,
        public readonly string $consentVersion,
        public readonly string $createdAt,
    ) {
    }

    public function withId(string $id): self
    {
        return new self($id, $this->type, $this->name, $this->phone, $this->message, $this->service,
            $this->page, $this->items, $this->consentVersion, $this->createdAt);
    }

    public function toArray(): array
    {
        return [
            'kind' => 'lead', 'id' => $this->id, 'createdAt' => $this->createdAt, 'type' => $this->type,
            'name' => $this->name, 'phone' => $this->phone, 'message' => $this->message,
            'service' => $this->service, 'page' => $this->page, 'items' => $this->items,
            'consent' => true, 'consentVersion' => $this->consentVersion,
        ];
    }

    public static function fromArray(array $r): self
    {
        return new self((string) $r['id'], (string) $r['type'], (string) $r['name'], (string) $r['phone'],
            (string) ($r['message'] ?? ''), (string) ($r['service'] ?? ''), (string) ($r['page'] ?? ''),
            (array) ($r['items'] ?? []), (string) ($r['consentVersion'] ?? ''), (string) $r['createdAt']);
    }

    public function title(): string
    {
        return (self::TYPE_LABELS[$this->type] ?? 'Заявка') . ' ' . $this->id;
    }

    /** Текст для письма и сообщения в MAX. */
    public function text(): string
    {
        $lines = [$this->title(), 'Имя: ' . $this->name, 'Телефон: ' . $this->phone];
        if ($this->service !== '') {
            $lines[] = 'Услуга: ' . $this->service;
        }
        if ($this->message !== '') {
            $lines[] = 'Сообщение: ' . $this->message;
        }
        if ($this->items) {
            $lines[] = '';
            $lines[] = 'Позиции:';
            $total = 0;
            $onRequest = false;
            foreach ($this->items as $i => $item) {
                $price = $item['price'];
                if ($price === null) {
                    $onRequest = true;
                    $priceText = 'цена по запросу';
                } else {
                    $total += $price * $item['qty'];
                    $priceText = self::money($price) . ' за шт.';
                }
                $lines[] = sprintf('%d. %s (%s) × %d — %s', $i + 1, $item['title'], $item['slug'], $item['qty'], $priceText);
            }
            $lines[] = 'Итого: ' . self::money($total) . ($onRequest ? ' без позиций «по запросу»' : '')
                . '. Цены — из корзины покупателя, требуют подтверждения.';
        }
        $lines[] = '';
        if ($this->page !== '') {
            $lines[] = 'Страница: ' . $this->page;
        }
        $lines[] = 'Принята: ' . date('d.m.Y H:i', strtotime($this->createdAt) ?: time()) . ' (МСК)';
        $lines[] = 'Согласие на обработку ПД: да, версия ' . $this->consentVersion;
        return implode("\n", $lines);
    }

    private static function money(int|float $value): string
    {
        return number_format($value, is_float($value) && floor($value) != $value ? 2 : 0, ',', ' ') . ' ₽';
    }
}
