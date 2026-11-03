<?php
declare(strict_types=1);

namespace Agv;

use PHPMailer\PHPMailer\PHPMailer;

require_once __DIR__ . '/../vendor/phpmailer/src/Exception.php';
require_once __DIR__ . '/../vendor/phpmailer/src/PHPMailer.php';
require_once __DIR__ . '/../vendor/phpmailer/src/SMTP.php';

/**
 * Письмо через SMTP (PHPMailer). Переменные: SMTP_HOST, SMTP_PORT, SMTP_USER, SMTP_PASSWORD,
 * SMTP_SECURE (ssl | tls | пусто — STARTTLS, если сервер предлагает), MAIL_FROM, MAIL_TO.
 * Обязательны SMTP_HOST и MAIL_TO; MAIL_FROM по умолчанию = SMTP_USER.
 */
final class MailChannel implements Channel
{
    public function __construct(private Config $config, private Logger $logger)
    {
    }

    public function name(): string
    {
        return 'mail';
    }

    public function missingSettings(): array
    {
        $missing = [];
        foreach (['SMTP_HOST', 'MAIL_TO'] as $key) {
            if ($this->config->get($key) === '') {
                $missing[] = $key;
            }
        }
        if ($this->from() === '') {
            $missing[] = 'MAIL_FROM';
        }
        return $missing;
    }

    private function from(): string
    {
        $from = $this->config->get('MAIL_FROM', $this->config->get('SMTP_USER'));
        return filter_var($from, FILTER_VALIDATE_EMAIL) ? $from : '';
    }

    public function send(Lead $lead): bool
    {
        try {
            $secure = strtolower($this->config->get('SMTP_SECURE'));
            $port = (int) $this->config->get('SMTP_PORT', $secure === 'ssl' ? '465' : '587');
            if ($secure === '' && $port === 465) {
                $secure = 'ssl';
            }
            $m = new PHPMailer(true);
            $m->isSMTP();
            $m->Host = $this->config->get('SMTP_HOST');
            $m->Port = $port;
            $m->SMTPSecure = in_array($secure, ['ssl', 'tls'], true) ? $secure : '';
            $m->SMTPAutoTLS = $secure !== 'none';
            $user = $this->config->get('SMTP_USER');
            if ($user !== '') {
                $m->SMTPAuth = true;
                $m->Username = $user;
                $m->Password = $this->config->get('SMTP_PASSWORD');
            }
            $m->Timeout = 10;
            $m->SMTPDebug = 0;
            $m->CharSet = PHPMailer::CHARSET_UTF8;
            $m->setFrom($this->from(), 'Сайт АГРОВОЛЬТАЖ');
            foreach (preg_split('/[,;\s]+/', $this->config->get('MAIL_TO'), -1, PREG_SPLIT_NO_EMPTY) as $to) {
                $m->addAddress($to);
            }
            $m->Subject = $lead->title() . ($lead->name !== '' ? ' — ' . $lead->name : '');
            $m->Body = $lead->text();
            $m->isHTML(false);
            $m->send();
            return true;
        } catch (\Throwable $e) {
            $this->logger->error(sprintf('Почта: заявка %s не отправлена: %s', $lead->id, $e->getMessage()));
            return false;
        }
    }
}
