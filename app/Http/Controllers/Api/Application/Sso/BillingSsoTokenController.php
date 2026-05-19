<?php

namespace Pterodactyl\Http\Controllers\Api\Application\Sso;

use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Cache;
use Illuminate\Support\Facades\Hash;
use Illuminate\Support\Str;
use Pterodactyl\Http\Controllers\Api\Application\ApplicationApiController;
use Pterodactyl\Models\User;

class BillingSsoTokenController extends ApplicationApiController
{
    public function issue(Request $request): JsonResponse
    {
        $request->validate([
            'email' => 'required|email',
            'server_uuid' => 'nullable|string|max:191',
            'ip_address' => 'nullable|ip',
            'first_name' => 'nullable|string|max:191',
            'last_name' => 'nullable|string|max:191',
        ]);

        if (!$this->isEnabled()) {
            return response()->json([
                'success' => false,
                'error' => 'Billing SSO is disabled.',
            ]);
        }

        $email = Str::lower((string) $request->input('email'));
        $user = User::query()->where('email', $email)->first();

        if (!$user) {
            if (!$this->isAutoCreateEnabled()) {
                return response()->json([
                    'success' => false,
                    'error' => 'User not found and auto-create is disabled.',
                ]);
            }

            $user = $this->createUser(
                $email,
                $request->input('first_name'),
                $request->input('last_name')
            );
        }

        $token = Str::random(64);

        Cache::put($this->cacheKey($token), [
            'user_id' => $user->id,
            'server_uuid' => $request->input('server_uuid'),
            'ip_address' => $request->input('ip_address'),
        ], now()->addMinutes($this->tokenTtlMinutes()));

        return response()->json([
            'success' => true,
            'data' => [
                'token' => $token,
                'expires_at' => now()->addMinutes($this->tokenTtlMinutes())->toIso8601String(),
            ],
        ]);
    }

    private function createUser(string $email, ?string $firstName = null, ?string $lastName = null): User
    {
        $localPart = Str::before($email, '@');
        $usernameBase = Str::of($localPart)
            ->lower()
            ->replaceMatches('/[^a-z0-9]/', '')
            ->limit(30, '')
            ->toString();

        if ($usernameBase === '') {
            $usernameBase = 'user';
        }

        $user = new User();
        $user->forceFill([
            'uuid' => (string) Str::uuid(),
            'email' => $email,
            'username' => $this->generateUniqueUsername($usernameBase),
            'name_first' => $firstName ?: 'Billing',
            'name_last' => $lastName ?: 'User',
            'password' => Hash::make(Str::random(64)),
            'language' => 'en',
            'root_admin' => false,
        ]);
        $user->saveOrFail();

        return $user;
    }

    private function generateUniqueUsername(string $base): string
    {
        $candidate = $base;
        while (User::query()->where('username', $candidate)->exists()) {
            $suffix = '_' . Str::lower(Str::random(5));
            $candidate = Str::of($base)->limit(191 - strlen($suffix), '')->toString() . $suffix;
        }

        return $candidate;
    }

    private function cacheKey(string $token): string
    {
        return 'billing_sso:token:' . $token;
    }

    private function isEnabled(): bool
    {
        return (bool) config('sso.billing.enabled', false);
    }

    private function isAutoCreateEnabled(): bool
    {
        return (bool) config('sso.billing.auto_create', false);
    }

    private function tokenTtlMinutes(): int
    {
        return max((int) config('sso.billing.token_ttl', 5), 1);
    }
}