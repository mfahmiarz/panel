<?php

use Pterodactyl\Enum\ResourceLimit;
use Illuminate\Support\Facades\Route;
use Pterodactyl\Http\Controllers\Api\Client;
use Pterodactyl\Http\Middleware\Activity\ServerSubject;
use Pterodactyl\Http\Middleware\Activity\AccountSubject;
use Pterodactyl\Http\Middleware\RequireTwoFactorAuthentication;
use Pterodactyl\Http\Middleware\Api\Client\Server\ResourceBelongsToServer;
use Pterodactyl\Http\Middleware\Api\Client\Server\AuthenticateServerAccess;

/*
|--------------------------------------------------------------------------
| Client Control API
|--------------------------------------------------------------------------
|
| Endpoint: /api/client
|
*/
Route::get('/', [Client\ClientController::class, 'index'])->name('api:client.index');
Route::get('/permissions', [Client\ClientController::class, 'permissions']);

Route::get('/server-orders', [Client\ClientController::class, 'getServerOrders'])->name('api:client.server-orders.index');
Route::put('/server-orders', [Client\ClientController::class, 'updateServerOrder'])->name('api:client.server-orders.update');

Route::prefix('/account')->middleware(AccountSubject::class)->group(function () {
    Route::prefix('/')->withoutMiddleware(RequireTwoFactorAuthentication::class)->group(function () {
        Route::get('/', [Client\AccountController::class, 'index'])->name('api:client.account');
        Route::get('/two-factor', [Client\TwoFactorController::class, 'index']);
        Route::post('/two-factor', [Client\TwoFactorController::class, 'store']);
        Route::post('/two-factor/disable', [Client\TwoFactorController::class, 'delete']);
    });

    Route::put('/profile', [Client\AccountController::class, 'updateProfileInformation'])->name('api:client.account.update-profile');
    Route::put('/email', [Client\AccountController::class, 'updateEmail'])->name('api:client.account.update-email');
    Route::put('/password', [Client\AccountController::class, 'updatePassword'])->name('api:client.account.update-password');
    Route::put('/language', [Client\AccountController::class, 'updateLanguage'])->name('api:client.account.update-language');

    Route::get('/activity', Client\ActivityLogController::class)->name('api:client.account.activity');

    Route::get('/api-keys', [Client\ApiKeyController::class, 'index']);
    Route::post('/api-keys', [Client\ApiKeyController::class, 'store']);
    Route::delete('/api-keys/{identifier}', [Client\ApiKeyController::class, 'delete']);

    Route::prefix('/ssh-keys')->group(function () {
        Route::get('/', [Client\SSHKeyController::class, 'index']);
        Route::post('/', [Client\SSHKeyController::class, 'store']);
        Route::post('/remove', [Client\SSHKeyController::class, 'delete']);
    });
});

/*
|--------------------------------------------------------------------------
| Client Control API
|--------------------------------------------------------------------------
|
| Endpoint: /api/client/servers/{server}
|
*/
Route::group([
    'prefix' => '/servers/{server}',
    'middleware' => [
        ServerSubject::class,
        AuthenticateServerAccess::class,
        ResourceBelongsToServer::class,
    ],
], function () {
    Route::get('/', [Client\Servers\ServerController::class, 'index'])->name('api:client:server.view');
    Route::middleware([ResourceLimit::Websocket->middleware()])
        ->get('/websocket', Client\Servers\WebsocketController::class)
        ->name('api:client:server.ws');
    Route::get('/resources', Client\Servers\ResourceUtilizationController::class)->name('api:client:server.resources');
    Route::get('/activity', Client\Servers\ActivityLogController::class)->name('api:client:server.activity');

    Route::post('/command', [Client\Servers\CommandController::class, 'index']);
    Route::post('/power', [Client\Servers\PowerController::class, 'index']);

    Route::group(['prefix' => '/databases'], function () {
        Route::get('/', [Client\Servers\DatabaseController::class, 'index']);
        Route::middleware([ResourceLimit::Database->middleware()])
            ->post('/', [Client\Servers\DatabaseController::class, 'store']);
        Route::post('/{database}/rotate-password', [Client\Servers\DatabaseController::class, 'rotatePassword']);
        Route::delete('/{database}', [Client\Servers\DatabaseController::class, 'delete']);
    });

    Route::group(['prefix' => '/files'], function () {
        Route::get('/list', [Client\Servers\FileController::class, 'directory']);
        Route::get('/contents', [Client\Servers\FileController::class, 'contents']);
        Route::get('/download', [Client\Servers\FileController::class, 'download']);
        Route::put('/rename', [Client\Servers\FileController::class, 'rename']);
        Route::post('/copy', [Client\Servers\FileController::class, 'copy']);
        Route::post('/write', [Client\Servers\FileController::class, 'write']);
        Route::post('/compress', [Client\Servers\FileController::class, 'compress']);
        Route::post('/decompress', [Client\Servers\FileController::class, 'decompress']);
        Route::post('/delete', [Client\Servers\FileController::class, 'delete']);
        Route::post('/create-folder', [Client\Servers\FileController::class, 'create']);
        Route::post('/chmod', [Client\Servers\FileController::class, 'chmod']);
        Route::middleware([ResourceLimit::FilePull->middleware()])
            ->post('/pull', [Client\Servers\FileController::class, 'pull']);
        Route::get('/upload', Client\Servers\FileUploadController::class);
    });

    Route::group(['prefix' => '/schedules'], function () {
        Route::get('/', [Client\Servers\ScheduleController::class, 'index']);
        Route::middleware([ResourceLimit::Schedule->middleware()])
            ->post('/', [Client\Servers\ScheduleController::class, 'store']);
        Route::get('/{schedule}', [Client\Servers\ScheduleController::class, 'view']);
        Route::post('/{schedule}', [Client\Servers\ScheduleController::class, 'update']);
        Route::post('/{schedule}/execute', [Client\Servers\ScheduleController::class, 'execute']);
        Route::delete('/{schedule}', [Client\Servers\ScheduleController::class, 'delete']);

        Route::post('/{schedule}/tasks', [Client\Servers\ScheduleTaskController::class, 'store']);
        Route::post('/{schedule}/tasks/{task}', [Client\Servers\ScheduleTaskController::class, 'update']);
        Route::delete('/{schedule}/tasks/{task}', [Client\Servers\ScheduleTaskController::class, 'delete']);
    });

    Route::group(['prefix' => '/network'], function () {
        Route::get('/allocations', [Client\Servers\NetworkAllocationController::class, 'index']);
        Route::middleware([ResourceLimit::Allocation->middleware()])
            ->post('/allocations', [Client\Servers\NetworkAllocationController::class, 'store']);
        Route::post('/allocations/{allocation}', [Client\Servers\NetworkAllocationController::class, 'update']);
        Route::post('/allocations/{allocation}/primary', [Client\Servers\NetworkAllocationController::class, 'setPrimary']);
        Route::delete('/allocations/{allocation}', [Client\Servers\NetworkAllocationController::class, 'delete']);
    });

    Route::group(['prefix' => '/users'], function () {
        Route::get('/', [Client\Servers\SubuserController::class, 'index']);
        Route::middleware([ResourceLimit::Subuser->middleware()])
            ->post('/', [Client\Servers\SubuserController::class, 'store']);
        Route::get('/{user}', [Client\Servers\SubuserController::class, 'view']);
        Route::post('/{user}', [Client\Servers\SubuserController::class, 'update']);
        Route::delete('/{user}', [Client\Servers\SubuserController::class, 'delete']);
    });

    Route::group(['prefix' => '/backups'], function () {
        Route::get('/', [Client\Servers\BackupController::class, 'index']);
        Route::post('/', [Client\Servers\BackupController::class, 'store']);
        Route::get('/{backup}', [Client\Servers\BackupController::class, 'view']);
        Route::get('/{backup}/download', [Client\Servers\BackupController::class, 'download']);
        Route::post('/{backup}/lock', [Client\Servers\BackupController::class, 'toggleLock']);
        Route::middleware([ResourceLimit::Backup->middleware()])
            ->post('/{backup}/restore', [Client\Servers\BackupController::class, 'restore']);
        Route::delete('/{backup}', [Client\Servers\BackupController::class, 'delete']);
    });

    Route::group(['prefix' => '/startup'], function () {
        Route::get('/', [Client\Servers\StartupController::class, 'index']);
        Route::put('/variable', [Client\Servers\StartupController::class, 'update']);
    });

    Route::group(['prefix' => '/minecraft/modpacks'], function () {
        Route::get('/', [Client\Servers\Minecraft\Modpacks\ModpackController::class, 'index']);
        Route::get('/versions', [Client\Servers\Minecraft\Modpacks\ModpackController::class, 'versions']);
        Route::post('/install', [Client\Servers\Minecraft\Modpacks\ModpackController::class, 'install']);
    });

    Route::group(['prefix' => '/minecraft/plugins'], function () {
        Route::get('/', [Client\Servers\Minecraft\Plugins\PluginController::class, 'index']);
        Route::get('/versions', [Client\Servers\Minecraft\Plugins\PluginController::class, 'versions']);
        Route::post('/install', [Client\Servers\Minecraft\Plugins\PluginController::class, 'install']);
        Route::get('/installed', [Client\Servers\Minecraft\Plugins\PluginController::class, 'installed']);
        Route::delete('/installed/{plugin_id}', [Client\Servers\Minecraft\Plugins\PluginController::class, 'uninstall']);
    });

    Route::group(['prefix' => '/minecraft/mods'], function () {
        Route::get('/', [Client\Servers\Minecraft\Mods\ModController::class, 'index']);
        Route::get('/versions', [Client\Servers\Minecraft\Mods\ModController::class, 'versions']);
        Route::post('/install', [Client\Servers\Minecraft\Mods\ModController::class, 'install']);
        Route::get('/installed', [Client\Servers\Minecraft\Mods\ModController::class, 'installed']);
        Route::delete('/installed/{mod_id}', [Client\Servers\Minecraft\Mods\ModController::class, 'uninstall']);
    });

    Route::group(['prefix' => '/minecraft/worlds'], function () {
        Route::get('/', [Client\Servers\Minecraft\Worlds\WorldController::class, 'index']);
        Route::get('/versions', [Client\Servers\Minecraft\Worlds\WorldController::class, 'versions']);
        Route::post('/install', [Client\Servers\Minecraft\Worlds\WorldController::class, 'install']);
        Route::get('/installed', [Client\Servers\Minecraft\Worlds\WorldController::class, 'installed']);
        Route::post('/installed/active', [Client\Servers\Minecraft\Worlds\WorldController::class, 'setActive']);
        Route::delete('/installed/{world_id}', [Client\Servers\Minecraft\Worlds\WorldController::class, 'uninstall']);
    });

    Route::group(['prefix' => '/minecraft/vanillatweaks'], function () {
        Route::get('/', [Client\Servers\Minecraft\VanillaTweaks\VanillaTweaksController::class, 'index']);
        Route::get('/versions', [Client\Servers\Minecraft\VanillaTweaks\VanillaTweaksController::class, 'versions']);
        Route::post('/install', [Client\Servers\Minecraft\VanillaTweaks\VanillaTweaksController::class, 'install']);
    });

    Route::group(['prefix' => '/minecraft/versions'], function () {
        Route::get('/current', [Client\Servers\Minecraft\Versions\VersionController::class, 'current']);
        Route::post('/install', [Client\Servers\Minecraft\Versions\VersionController::class, 'install']);
    });

    Route::group(['prefix' => '/bedrock/versions'], function () {
        Route::get('/current', [Client\Servers\Bedrock\Versions\VersionController::class, 'current']);
        Route::post('/install', [Client\Servers\Bedrock\Versions\VersionController::class, 'install']);
    });

    Route::group(['prefix' => '/bedrock/addons'], function () {
        Route::get('/', [Client\Servers\Bedrock\Addons\AddonController::class, 'index']);
        Route::get('/versions', [Client\Servers\Bedrock\Addons\AddonController::class, 'versions']);
        Route::post('/install', [Client\Servers\Bedrock\Addons\AddonController::class, 'install']);
        Route::get('/install-status', [Client\Servers\Bedrock\Addons\AddonController::class, 'installStatus']);
        Route::get('/icon', [Client\Servers\Bedrock\Addons\AddonController::class, 'icon']);
        Route::post('/delete', [Client\Servers\Bedrock\Addons\AddonController::class, 'deletePack']);
        Route::get('/packs', [Client\Servers\Bedrock\Addons\AddonController::class, 'getPacks']);
        Route::post('/packs', [Client\Servers\Bedrock\Addons\AddonController::class, 'savePacks']);
        Route::post('/world', [Client\Servers\Bedrock\Addons\AddonController::class, 'setWorld']);
    });

    Route::group(['prefix' => '/bedrock/config'], function () {
        Route::get('/properties', [Client\Servers\Bedrock\Config\ConfigController::class, 'getProperties']);
        Route::post('/properties', [Client\Servers\Bedrock\Config\ConfigController::class, 'saveProperties']);
        Route::get('/worlds', [Client\Servers\Bedrock\Config\ConfigController::class, 'getWorlds']);
        Route::get('/experiments', [Client\Servers\Bedrock\Config\ConfigController::class, 'getExperiments']);
        Route::post('/experiments', [Client\Servers\Bedrock\Config\ConfigController::class, 'saveExperiments']);
        Route::get('/experiments/available', [Client\Servers\Bedrock\Config\ConfigController::class, 'getAvailableExperiments']);
        Route::get('/world-settings', [Client\Servers\Bedrock\Config\ConfigController::class, 'getWorldSettings']);
        Route::post('/world-settings', [Client\Servers\Bedrock\Config\ConfigController::class, 'saveWorldSettings']);
        Route::get('/raw-nbt', [Client\Servers\Bedrock\Config\ConfigController::class, 'getRawNbt']);
        Route::get('/verify-leveldat', [Client\Servers\Bedrock\Config\ConfigController::class, 'verifyLevelDat']);
    });

    Route::group(['prefix' => '/settings'], function () {
        Route::post('/rename', [Client\Servers\SettingsController::class, 'rename']);
        Route::post('/reinstall', [Client\Servers\SettingsController::class, 'reinstall']);
        Route::put('/docker-image', [Client\Servers\SettingsController::class, 'dockerImage']);
    });
});
