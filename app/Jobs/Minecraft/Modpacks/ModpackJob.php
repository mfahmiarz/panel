<?php
namespace Pterodactyl\Jobs\Minecraft\Modpacks;
use Pterodactyl\Models\User;
use Pterodactyl\Models\Server;
use Illuminate\Bus\Queueable;
use Illuminate\Queue\SerializesModels;
use Illuminate\Queue\InteractsWithQueue;
use Illuminate\Contracts\Queue\ShouldQueue;
use Illuminate\Foundation\Bus\Dispatchable;
use Pterodactyl\Services\Servers\ReinstallServerService;
use Pterodactyl\Services\Servers\StartupModificationService;
use Pterodactyl\Repositories\Wings\DaemonFileRepository;
use Pterodactyl\Repositories\Wings\DaemonPowerRepository;
use Pterodactyl\Services\Minecraft\Modpacks\ModpackEggService;
class ModpackJob implements ShouldQueue
{
    use Dispatchable, InteractsWithQueue, Queueable, SerializesModels;
    public int $tries = 1;
    public int $timeout = 600;
    /**
     * Create a new job instance.
     */
    public function __construct(
        public Server $server,
        public string $provider,
        public string $modpackId,
        public string $modpackVersionId,
        public bool $deleteServerFiles = false
    ) {
        $this->queue = 'standard';
    }
    /**
     * Execute the job.
     */
    public function handle(
        ReinstallServerService $reinstallServerService,
        StartupModificationService $startupModificationService,
        DaemonFileRepository $daemonFileRepository,
        DaemonPowerRepository $daemonPowerRepository,
        ModpackEggService $modpackEggService
    ): void {
        if (!is_null($this->server->status)) {
            return;
        }
        $originalEggId = $this->server->egg_id;
        $originalNestId = $this->server->nest_id;
        $originalImage = $this->server->image;
        $originalStartup = $this->server->startup;
        try {
            $daemonPowerRepository->setServer($this->server)->send('kill');
            sleep(2);
        } catch (\Throwable $e) {
        }
        try {
            $installerEgg = $modpackEggService->resolve();
        } catch (\Throwable $e) {
            logger()->error('ModpackJob: Failed to resolve installer egg', ['error' => $e->getMessage()]);
            return;
        }
        if ($this->deleteServerFiles) {
            try {
                $daemonFileRepository->setServer($this->server)->deleteFiles('/', ['*']);
            } catch (\Throwable $e) {
                logger()->error('ModpackJob: File deletion failed', ['error' => $e->getMessage()]);
            }
        }
        try {
            $startupModificationService->setUserLevel(User::USER_LEVEL_ADMIN);
            $startupModificationService->handle($this->server, [
                'egg_id' => $installerEgg->id,
                'environment' => [
                    'MODPACK_PROVIDER' => $this->provider,
                    'MODPACK_ID' => $this->modpackId,
                    'MODPACK_VERSION_ID' => $this->modpackVersionId,
                    'ACCEPT_EULA' => 'true',
                ],
            ]);
            $this->server->refresh();
        } catch (\Throwable $e) {
            logger()->error('ModpackJob: Failed to swap egg and set environment variables', ['error' => $e->getMessage()]);
            return;
        }
        try {
            $reinstallServerService->handle($this->server);
        } catch (\Throwable $e) {
            logger()->error('ModpackJob: Failed to trigger server reinstall', ['error' => $e->getMessage()]);
            try {
                $startupModificationService->handle($this->server, [
                    'egg_id' => $originalEggId,
                    'docker_image' => $originalImage,
                    'startup' => $originalStartup,
                ]);
            } catch (\Throwable $restoreEx) {
            }
            return;
        }
        sleep(10);
        try {
            $startupModificationService->setUserLevel(User::USER_LEVEL_ADMIN);
            $startupModificationService->handle($this->server, [
                'egg_id' => $originalEggId,
                'docker_image' => $originalImage,
                'startup' => $originalStartup,
            ]);
        } catch (\Throwable $e) {
            logger()->error('ModpackJob: Failed to revert server to original egg', ['error' => $e->getMessage()]);
        }
    }
}
