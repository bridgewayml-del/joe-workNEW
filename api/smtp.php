<?php
/**
 * Minimal SMTP sender. No Composer, no vendored library, nothing to keep
 * updated. Supports implicit SSL (port 465) and STARTTLS (port 587) with
 * AUTH LOGIN, which is what Hostinger and every other shared host offers.
 *
 * Returns true on success. On failure returns false and writes the reason
 * into $error so the caller can log it.
 */

function bw_smtp_send(array $cfg, string $toEmail, string $subject, string $body, string $replyTo, ?string &$error = null): bool
{
    $error = null;
    $host   = $cfg['smtp_host'] ?? '';
    $port   = (int)($cfg['smtp_port'] ?? 465);
    $secure = strtolower((string)($cfg['smtp_secure'] ?? 'ssl'));
    $user   = $cfg['smtp_user'] ?? '';
    $pass   = $cfg['smtp_pass'] ?? '';

    if ($host === '' || $user === '' || $pass === '') {
        $error = 'smtp not configured';
        return false;
    }

    $transport = ($secure === 'ssl') ? 'ssl://' . $host : 'tcp://' . $host;
    $context = stream_context_create([
        'ssl' => ['verify_peer' => true, 'verify_peer_name' => true, 'SNI_enabled' => true],
    ]);

    $fp = @stream_socket_client(
        $transport . ':' . $port,
        $errNo, $errStr, 15, STREAM_CLIENT_CONNECT, $context
    );
    if (!$fp) {
        $error = 'connect failed: ' . $errStr;
        return false;
    }
    stream_set_timeout($fp, 15);

    // Reads a full SMTP reply, including multi-line 250-... responses.
    $read = function () use ($fp): string {
        $out = '';
        while (($line = fgets($fp, 1024)) !== false) {
            $out .= $line;
            if (strlen($line) < 4 || $line[3] !== '-') break;
        }
        return $out;
    };
    $cmd = function (string $line) use ($fp, $read): string {
        fwrite($fp, $line . "\r\n");
        return $read();
    };
    $code = fn(string $reply): int => (int)substr(trim($reply), 0, 3);

    $fail = function (string $why) use ($fp, &$error): bool {
        $error = $why;
        @fclose($fp);
        return false;
    };

    if ($code($read()) !== 220)                        return $fail('no greeting');

    $ehloHost = $_SERVER['SERVER_NAME'] ?? 'localhost';
    if ($code($cmd('EHLO ' . $ehloHost)) !== 250)      return $fail('ehlo rejected');

    if ($secure === 'tls') {
        if ($code($cmd('STARTTLS')) !== 220)           return $fail('starttls refused');
        if (!@stream_socket_enable_crypto($fp, true, STREAM_CRYPTO_METHOD_TLS_CLIENT)) {
            return $fail('tls handshake failed');
        }
        if ($code($cmd('EHLO ' . $ehloHost)) !== 250)  return $fail('ehlo after tls rejected');
    }

    if ($code($cmd('AUTH LOGIN')) !== 334)             return $fail('auth login unsupported');
    if ($code($cmd(base64_encode($user))) !== 334)     return $fail('username rejected');
    if ($code($cmd(base64_encode($pass))) !== 235)     return $fail('authentication failed');

    $from = $cfg['notify_from'] ?? $user;
    if ($code($cmd('MAIL FROM:<' . $from . '>')) !== 250)   return $fail('mail from rejected');
    if ($code($cmd('RCPT TO:<' . $toEmail . '>')) !== 250)  return $fail('recipient rejected');
    if ($code($cmd('DATA')) !== 354)                        return $fail('data refused');

    $fromName = bw_mime_header((string)($cfg['notify_name'] ?? 'Website'));
    $headers = [
        'From: ' . $fromName . ' <' . $from . '>',
        'To: <' . $toEmail . '>',
        'Reply-To: <' . $replyTo . '>',
        'Subject: ' . bw_mime_header($subject),
        'Date: ' . date('r'),
        'Message-ID: <' . bin2hex(random_bytes(12)) . '@' . ($_SERVER['SERVER_NAME'] ?? 'localhost') . '>',
        'MIME-Version: 1.0',
        'Content-Type: text/plain; charset=UTF-8',
        'Content-Transfer-Encoding: 8bit',
        'X-Mailer: bridgeway-site',
    ];

    // Dot-stuffing: a line consisting of a single "." would end DATA early.
    $normalised = preg_replace("/\r\n|\r|\n/", "\r\n", $body);
    $stuffed = preg_replace('/^\./m', '..', $normalised);

    fwrite($fp, implode("\r\n", $headers) . "\r\n\r\n" . $stuffed . "\r\n.\r\n");
    if ($code($read()) !== 250)                        return $fail('message rejected at DATA end');

    $cmd('QUIT');
    @fclose($fp);
    return true;
}

/** RFC 2047 encode a header value only when it contains non-ASCII. */
function bw_mime_header(string $value): string
{
    $clean = preg_replace('/[\r\n]+/', ' ', $value);
    if (preg_match('/^[\x20-\x7E]*$/', $clean)) {
        return $clean;
    }
    return '=?UTF-8?B?' . base64_encode($clean) . '?=';
}
