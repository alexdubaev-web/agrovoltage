<?php
declare(strict_types=1);

namespace Agv;

/** Канал доставки заявки (interfaces.md §5). */
interface Channel
{
    /** Короткое имя для журнала: "mail", "max". */
    public function name(): string;

    /** Имена переменных .env, которых не хватает; пустой список — канал настроен. */
    public function missingSettings(): array;

    /** true — доставлено. Не бросает исключений: сбой — false и запись в app.log. */
    public function send(Lead $lead): bool;
}
