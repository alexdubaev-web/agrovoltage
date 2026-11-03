<?php
declare(strict_types=1);

namespace Agv;

/** Тихий отказ: ловушка заполнена или форма заполнена быстрее MIN_FILL_MS. */
final class SpamRejected extends \RuntimeException
{
}

/** Ошибки по полям, тексты — для посетителя. */
final class ValidationFailed extends \RuntimeException
{
    /** @param array<string,string> $errors */
    public function __construct(public readonly array $errors)
    {
        parent::__construct('validation failed');
    }
}

/** Проверка тела POST /api/lead.php (interfaces.md §5). */
final class LeadValidator
{
    public const MIN_FILL_MS = 3000;

    /** @throws SpamRejected|ValidationFailed */
    public static function validate(array $d, ?int $nowMs = null): Lead
    {
        $nowMs ??= (int) floor(microtime(true) * 1000);

        $website = $d['website'] ?? '';
        if (!is_string($website) || trim($website) !== '') {
            throw new SpamRejected('honeypot');
        }
        $startedAt = $d['startedAt'] ?? null;
        if (!is_int($startedAt) && !is_float($startedAt)) {
            throw new SpamRejected('no startedAt');
        }
        $elapsed = $nowMs - (int) $startedAt;
        if ($elapsed >= 0 && $elapsed < self::MIN_FILL_MS) {
            throw new SpamRejected('too fast');
        }

        $errors = [];
        $type = $d['type'] ?? '';
        if (!is_string($type) || !isset(Lead::TYPE_LABELS[$type])) {
            $errors['type'] = 'Неизвестный тип заявки. Обновите страницу.';
            $type = 'callback';
        }

        $name = self::text($d['name'] ?? '', 100);
        if ($name === null) {
            $errors['name'] = 'Имя не длиннее 100 символов.';
        } elseif ($name === '') {
            $errors['name'] = 'Укажите имя.';
        }

        $phone = self::phone($d['phone'] ?? '');
        if ($phone === null) {
            $errors['phone'] = 'Укажите телефон в формате +7 (999) 123-45-67.';
        }

        $message = self::text($d['message'] ?? '', 2000, true);
        if ($message === null) {
            $errors['message'] = 'Сообщение не длиннее 2000 символов.';
        }
        $service = self::text($d['service'] ?? '', 200) ?? '';
        $page = self::text($d['page'] ?? '', 500) ?? '';
        if ($page !== '' && !str_starts_with($page, '/')) {
            $page = '';
        }

        if (($d['consent'] ?? null) !== true) {
            $errors['consent'] = 'Нужно согласие на обработку персональных данных.';
        }
        $consentVersion = self::text($d['consentVersion'] ?? '', 20);
        if ($consentVersion === null || $consentVersion === '') {
            $errors['consent'] ??= 'Не указана версия согласия. Обновите страницу.';
        }

        $items = [];
        if ($type === 'order') {
            $items = self::items($d['items'] ?? null);
            if ($items === null) {
                $errors['items'] = 'Проверьте позиции заказа: корзина пуста или изменилась. Обновите страницу корзины.';
            }
        }

        if ($errors) {
            throw new ValidationFailed($errors);
        }
        return new Lead('', $type, $name, $phone, $message, $service, $page, $items ?? [], $consentVersion, date('c'));
    }

    /** Строка без управляющих символов. null — неверный тип или длина. */
    private static function text(mixed $v, int $max, bool $multiline = false): ?string
    {
        if ($v === null) {
            return '';
        }
        if (!is_string($v) || !preg_match('//u', $v)) {
            return null;
        }
        $v = preg_replace($multiline ? '/[\x00-\x08\x0B\x0C\x0E-\x1F\x7F]/u' : '/[\x00-\x1F\x7F]/u', $multiline ? '' : ' ', $v);
        $v = trim($v);
        // Без mbstring: на части хостингов и в локальном PHP его нет.
        return preg_match_all('/./su', $v) > $max ? null : $v;
    }

    /** Российский номер → «+7 (962) 001-19-90». */
    public static function phone(mixed $v): ?string
    {
        if (!is_string($v) || strlen($v) > 30 || !preg_match('/^[+\d\s()\-.]+$/', $v)) {
            return null;
        }
        $digits = preg_replace('/\D/', '', $v);
        if (strlen($digits) === 10 && $digits[0] === '9') {
            $digits = '7' . $digits;
        }
        if (strlen($digits) === 11 && $digits[0] === '8') {
            $digits = '7' . substr($digits, 1);
        }
        if (strlen($digits) !== 11 || $digits[0] !== '7' || !in_array($digits[1], ['3', '4', '8', '9'], true)) {
            return null;
        }
        return sprintf('+7 (%s) %s-%s-%s', substr($digits, 1, 3), substr($digits, 4, 3), substr($digits, 7, 2), substr($digits, 9, 2));
    }

    private static function items(mixed $raw): ?array
    {
        if (!is_array($raw) || !array_is_list($raw) || count($raw) === 0 || count($raw) > 100) {
            return null;
        }
        $out = [];
        foreach ($raw as $item) {
            if (!is_array($item)) {
                return null;
            }
            $slug = $item['slug'] ?? null;
            $title = self::text($item['title'] ?? null, 200);
            $price = $item['price'] ?? null;
            $qty = $item['qty'] ?? null;
            if (!is_string($slug) || !preg_match('/^[a-z0-9][a-z0-9-]{0,99}$/', $slug) || $title === null || $title === ''
                || !($price === null || ((is_int($price) || is_float($price)) && $price >= 0 && $price < 1e9))
                || !is_int($qty) || $qty < 1 || $qty > 999) {
                return null;
            }
            $out[] = ['slug' => $slug, 'title' => $title, 'price' => $price, 'qty' => $qty];
        }
        return $out;
    }
}
