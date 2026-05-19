<?php

return [
    'billing' => [
        'enabled' => (bool) env('SSO_BILLING_ENABLED', false),
        'auto_create' => (bool) env('SSO_BILLING_AUTO_CREATE', false),
        'token_ttl' => (int) env('SSO_BILLING_TOKEN_TTL', 5),
        'strict_ip' => (bool) env('SSO_BILLING_STRICT_IP', false),
    ],
];