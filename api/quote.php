<?php
/**
 * Quote request handler.
 *
 * Order of operations matters: the lead is written to disk BEFORE any email
 * is attempted. If SMTP is down, misconfigured, or the host blocks mail(),
 * the lead still exists on the server and can be recovered from the CSV.
 * A courier business cannot afford to silently drop an inbound request.
 *
 * Responds with JSON when the client asks for it (the fetch path) and with a
 * redirect otherwise (the no-JavaScript path).
 */

declare(strict_types=1);

/* This endpoint returns JSON. A PHP notice or deprecation printed into the
   response body would make that JSON unparseable and the visitor would see a
   failure for a request that actually succeeded. Log problems, never print
   them. (Found the hard way: PHP 8.4 deprecated fputcsv's implicit $escape,
   and the warning corrupted the response.) */
@ini_set('display_errors', '0');
@ini_set('log_errors', '1');
error_reporting(E_ALL);

require_once __DIR__ . '/smtp.php';

const BW_MAX_FIELD = 4000;

/* ---------------------------------------------------------------- helpers */

function bw_wants_json(): bool
{
    $accept = $_SERVER['HTTP_ACCEPT'] ?? '';
    return stripos($accept, 'application/json') !== false;
}

function bw_respond(bool $ok, int $status, string $message, array $fields = []): never
{
    if (bw_wants_json()) {
        http_response_code($status);
        header('Content-Type: application/json; charset=utf-8');
        header('Cache-Control: no-store');
        echo json_encode(
            $ok ? ['ok' => true] : ['ok' => false, 'error' => $message, 'fields' => $fields]
        );
        exit;
    }

    // No-JavaScript path.
    if ($ok) {
        header('Location: /thanks.html', true, 303);
        exit;
    }
    http_response_code($status);
    header('Content-Type: text/html; charset=utf-8');
    $safe = htmlspecialchars($message, ENT_QUOTES, 'UTF-8');
    echo '<!DOCTYPE html><html lang="en"><head><meta charset="utf-8">'
       . '<meta name="viewport" content="width=device-width,initial-scale=1">'
       . '<title>Request not sent | Bridgeway Medical Logistics</title>'
       . '<link rel="stylesheet" href="/assets/css/site.css"></head><body>'
       . '<main id="main" class="section"><div class="wrap">'
       . '<h1>That did not send.</h1>'
       . '<p class="lead">' . $safe . '</p>'
       . '<p>Please call dispatch at <a class="mono" href="tel:+19294545653">(929) 454-5653</a>'
       . ' or email <a href="mailto:Info@bridgewayml.com">Info@bridgewayml.com</a>.</p>'
       . '<p><a href="/#quote">Back to the form</a></p>'
       . '</div></main></body></html>';
    exit;
}

function bw_field(string $key): string
{
    $raw = $_POST[$key] ?? '';
    if (!is_string($raw)) return '';
    $v = str_replace(["\0"], '', $raw);
    $v = trim($v);
    return mb_substr($v, 0, BW_MAX_FIELD);
}

/** Strips CR/LF so a submitted value cannot inject extra mail headers. */
function bw_single_line(string $v): string
{
    return trim(preg_replace('/[\r\n\t]+/', ' ', $v) ?? '');
}

function bw_client_ip(): string
{
    foreach (['HTTP_CF_CONNECTING_IP', 'HTTP_X_FORWARDED_FOR', 'REMOTE_ADDR'] as $k) {
        if (!empty($_SERVER[$k])) {
            $ip = trim(explode(',', (string)$_SERVER[$k])[0]);
            if (filter_var($ip, FILTER_VALIDATE_IP)) return $ip;
        }
    }
    return '0.0.0.0';
}

/* ------------------------------------------------------------------ guards */

if (($_SERVER['REQUEST_METHOD'] ?? 'GET') !== 'POST') {
    bw_respond(false, 405, 'This endpoint only accepts form submissions.');
}

$configPath = __DIR__ . '/config.php';
if (!is_file($configPath)) {
    // Deliberately explicit: this is a deployment mistake, not a visitor error,
    // and it must be loud enough that it gets noticed immediately.
    error_log('bridgeway: api/config.php is missing. Copy config.example.php to config.php.');
    bw_respond(false, 500, 'The form is not finished being set up on the server.');
}
$cfg = require $configPath;

/* Honeypot: a field positioned off-screen that no human ever fills. */
if (bw_field('website') !== '') {
    // Answer as if it worked. A bot told it failed will simply retry.
    bw_respond(true, 200, 'ok');
}

/* Timing: the hidden value is stamped by JavaScript at render time. Absent
   means no JS, which is legitimate, so only enforce when it is present. */
$renderedAt = (int)bw_field('rendered_at');
$minSeconds = (int)($cfg['min_seconds'] ?? 3);
if ($renderedAt > 0 && (time() - $renderedAt) < $minSeconds) {
    bw_respond(true, 200, 'ok');
}

/* --------------------------------------------------------------- validate */

$data = [
    'facility'      => bw_single_line(bw_field('facility')),
    'name'          => bw_single_line(bw_field('name')),
    'email'         => bw_single_line(bw_field('email')),
    'phone'         => bw_single_line(bw_field('phone')),
    'pickup'        => bw_single_line(bw_field('pickup')),
    'dropoff'       => bw_single_line(bw_field('dropoff')),
    'facility_type' => bw_single_line(bw_field('facility_type')),
    'service'       => bw_single_line(bw_field('service')),
    'temperature'   => bw_single_line(bw_field('temperature')),
    'frequency'     => bw_single_line(bw_field('frequency')),
    'details'       => bw_field('details'),
];

$errors = [];
if (mb_strlen($data['facility']) < 2) $errors['facility'] = 'Enter the facility name.';
if (mb_strlen($data['name']) < 2)     $errors['name']     = 'Enter your name.';
if (!filter_var($data['email'], FILTER_VALIDATE_EMAIL)) {
    $errors['email'] = 'Enter a valid email address.';
}
if (strlen(preg_replace('/\D/', '', $data['phone']) ?? '') < 10) {
    $errors['phone'] = 'Enter a phone number with at least 10 digits.';
}
// Both addresses are required: a courier run cannot be quoted from one end.
if (mb_strlen($data['pickup']) < 4)  $errors['pickup']  = 'Enter the pickup address.';
if (mb_strlen($data['dropoff']) < 4) $errors['dropoff'] = 'Enter the delivery address.';
if ($errors) {
    bw_respond(false, 422, 'Please correct the highlighted fields.', $errors);
}

/* ------------------------------------------------------------- rate limit */

$leadDir = (string)($cfg['lead_dir'] ?? (__DIR__ . '/../_leads'));
if (!is_dir($leadDir)) {
    @mkdir($leadDir, 0750, true);
}

$ip = bw_client_ip();
$maxPerHour = (int)($cfg['max_per_hour'] ?? 6);
$throttleFile = $leadDir . '/.throttle.json';
$now = time();

if (is_writable($leadDir) || is_writable($throttleFile)) {
    $seen = [];
    if (is_file($throttleFile)) {
        $decoded = json_decode((string)@file_get_contents($throttleFile), true);
        if (is_array($decoded)) $seen = $decoded;
    }
    // Drop anything older than an hour, for every IP, so the file cannot grow
    // without bound.
    foreach ($seen as $key => $stamps) {
        $kept = array_values(array_filter((array)$stamps, fn($t) => ($now - (int)$t) < 3600));
        if ($kept) { $seen[$key] = $kept; } else { unset($seen[$key]); }
    }
    if (count($seen[$ip] ?? []) >= $maxPerHour) {
        bw_respond(false, 429, 'Too many requests from this connection. Please call dispatch instead.');
    }
    $seen[$ip][] = $now;
    @file_put_contents($throttleFile, json_encode($seen), LOCK_EX);
}

/* ------------------------------------------------------- write lead first */

$logged = false;
$csv = $leadDir . '/leads-' . date('Y-m') . '.csv';
$isNew = !is_file($csv);

$fh = @fopen($csv, 'a');
if ($fh) {
    if (flock($fh, LOCK_EX)) {
        /* $escape is passed explicitly: PHP 8.4 deprecated relying on its
           default, and '' is the RFC 4180 behaviour spreadsheets expect. */
        if ($isNew) {
            fputcsv($fh, ['received_utc', 'facility', 'name', 'email', 'phone',
                          'pickup', 'dropoff', 'facility_type', 'service',
                          'temperature', 'frequency', 'details', 'ip'], ',', '"', '');
        }
        fputcsv($fh, [
            gmdate('Y-m-d H:i:s'),
            $data['facility'], $data['name'], $data['email'], $data['phone'],
            $data['pickup'], $data['dropoff'], $data['facility_type'],
            $data['service'], $data['temperature'], $data['frequency'],
            $data['details'], $ip,
        ], ',', '"', '');
        fflush($fh);
        flock($fh, LOCK_UN);
        $logged = true;
    }
    fclose($fh);
}
if (!$logged) {
    error_log('bridgeway: could not write lead CSV at ' . $csv . ' - check permissions on lead_dir.');
}

/* -------------------------------------------------------------- send mail */

$to = (string)($cfg['notify_to'] ?? '');
$subject = 'Quote request: ' . $data['facility'];

$opt = fn(string $v): string => $v !== '' ? $v : '(not given)';
$lines = [
    'New quote request from the Bridgeway website.',
    '',
    'Facility:      ' . $data['facility'],
    'Contact:       ' . $data['name'],
    'Email:         ' . $data['email'],
    'Phone:         ' . $data['phone'],
    '',
    'PICKUP:        ' . $data['pickup'],
    'DELIVERY:      ' . $data['dropoff'],
    '',
    'Facility type: ' . $opt($data['facility_type']),
    'Service:       ' . $opt($data['service']),
    'Temperature:   ' . $opt($data['temperature']),
    'Volume/freq:   ' . $opt($data['frequency']),
    '',
    'Handling notes:',
    $data['details'] !== '' ? $data['details'] : '(none)',
    '',
    str_repeat('-', 56),
    'Received ' . gmdate('Y-m-d H:i:s') . ' UTC from ' . $ip,
];
$body = implode("\n", $lines);

$sent = false;
$mailError = null;

if ($to !== '' && filter_var($to, FILTER_VALIDATE_EMAIL)) {
    if (!empty($cfg['smtp_host'])) {
        $sent = bw_smtp_send($cfg, $to, $subject, $body, $data['email'], $mailError);
    }
    if (!$sent) {
        // Fallback. Works on Hostinger but is filtered more often, which is
        // exactly why the CSV above is written first.
        $from = (string)($cfg['notify_from'] ?? ('no-reply@' . ($_SERVER['SERVER_NAME'] ?? 'localhost')));
        $headers = implode("\r\n", [
            'From: ' . bw_mime_header((string)($cfg['notify_name'] ?? 'Website')) . ' <' . $from . '>',
            'Reply-To: <' . $data['email'] . '>',
            'MIME-Version: 1.0',
            'Content-Type: text/plain; charset=UTF-8',
        ]);
        $sent = @mail($to, bw_mime_header($subject), $body, $headers, '-f' . $from);
        if (!$sent && $mailError === null) $mailError = 'mail() returned false';
    }
}

if (!$sent) {
    error_log('bridgeway: notification email failed (' . ($mailError ?? 'unknown') . '). Lead logged: ' . ($logged ? 'yes' : 'NO'));
}

/* If the email failed but the lead is safely on disk, the visitor has still
   succeeded. Telling them otherwise would produce a duplicate submission for
   a problem only the site owner can fix. If BOTH failed, say so, because then
   the request really is lost and they need to phone. */
if (!$sent && !$logged) {
    bw_respond(false, 500, 'We could not record your request.');
}

bw_respond(true, 200, 'ok');
