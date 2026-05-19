<?php

namespace Pterodactyl\Http\Controllers\Auth;

use Illuminate\Http\RedirectResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Cache;
use Illuminate\Support\Facades\Event;
use Pterodactyl\Events\Auth\DirectLogin;
use Pterodactyl\Models\Server;
use Pterodactyl\Models\Subuser;
use Pterodactyl\Models\User;

class BillingSsoLoginController extends AbstractLoginController
{
    public function login(Request $request): RedirectResponse
    {
        $request->validate([
            'token' => 'required|string|size:64',
            'server' => 'nullable|string|max:191',
        ]);

        if (!(bool) config('sso.billing.enabled', false)) {
            return redirect('/auth/login');
        }

        $payload = Cache::pull($this->cacheKey((string) $request->query('token')));
        if (!$payload || !isset($payload['user_id'])) {
            return redirect('/auth/login');
        }

        $user = User::query()->find($payload['user_id']);
        if (!$user) {
            return redirect('/auth/login');
        }

        $originIp = $payload['ip_address'] ?? null;
        if ((bool) config('sso.billing.strict_ip', false) && $originIp && $originIp !== $request->ip()) {
            return redirect('/auth/login');
        }

        $guard = $this->auth->guard();
        $currentUser = $guard->user();

        if ($currentUser && $currentUser->id !== $user->id) {
            $guard->logout();
            $request->session()->invalidate();
            $request->session()->regenerateToken();
        }

        $request->session()->regenerate();
        $guard->login($user, true);
        Event::dispatch(new DirectLogin($user, true));

        $serverIdentifier = $request->query('server') ?: ($payload['server_uuid'] ?? null);
        if (!$serverIdentifier) {
            return redirect('/');
        }

        $server = Server::query()
            ->where('uuid', $serverIdentifier)
            ->orWhere('uuidShort', $serverIdentifier)
            ->first();

        if (!$server || !$this->userCanAccessServer($user, $server)) {
            return redirect('/');
        }

        return redirect('/server/' . $server->uuidShort);
    }

    private function userCanAccessServer(User $user, Server $server): bool
    {
        if ($server->owner_id === $user->id) {
            return true;
        }

        return Subuser::query()
            ->where('server_id', $server->id)
            ->where('user_id', $user->id)
            ->exists();
    }

    private function cacheKey(string $token): string
    {
        return 'billing_sso:token:' . $token;
    }
}