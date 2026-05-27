<?php
namespace Pterodactyl\Jobs\Minecraft\Mods;
use Illuminate\Foundation\Queue\Queueable;
use Illuminate\Contracts\Queue\ShouldQueue;
use Pterodactyl\Models\Server;
use Pterodactyl\Repositories\Wings\DaemonFileRepository;
use Pterodactyl\Exceptions\Http\Connection\DaemonConnectionException;
class ModJob implements ShouldQueue
{
    use Queueable;
    public int $tries    = 3;
    public int $timeout  = 120;
    public function __construct(
        public Server $server,
        public string $provider,
        public string $modId,
        public string $versionId,
        public string $downloadUrl,
        public string $filename,
        public string $modName = '',
        public string $modIcon = '',
        public string $modAuthor = '',
    ) {
        $this->queue = 'standard';
    }
    /**
     * Execute the mod installation by pulling the JAR into /mods/ via Wings.
     *
     * @throws DaemonConnectionException
     */
    public function handle(DaemonFileRepository $fileRepo): void
    {
        if (!is_null($this->server->status)) {
            return;
        }
        /** @var DaemonFileRepository $repo */
        $repo = $fileRepo->setServer($this->server);
        try {
            $repo->createDirectory('mods', '/');
        } catch (\Throwable) {
        }
        $params = ['foreground' => true];
        if ($this->filename) {
            $params['filename'] = $this->filename;
        }
        $repo->pull($this->downloadUrl, '/mods', $params);
        $manifestPath = '/mods/.installed_mods.json';
        $fileName = $this->filename ?: (basename(parse_url($this->downloadUrl, PHP_URL_PATH)) ?: 'mod.jar');
        try {
            $manifest = [];
            try {
                $content = $repo->getContent($manifestPath);
                $decoded = json_decode($content, true);
                if (is_array($decoded)) {
                    $manifest = $decoded;
                }
            } catch (\Throwable) {
            }
            $oldFileName = null;
            $manifest = array_filter($manifest, function ($entry) use (&$oldFileName) {
                if ((string) ($entry['mod_id'] ?? '') === (string) $this->modId && ($entry['provider'] ?? '') === $this->provider) {
                    $oldFileName = $entry['file_name'] ?? null;
                    return false;
                }
                return true;
            });
            if ($oldFileName && $oldFileName !== $fileName) {
                try {
                    $repo->deleteFiles('/mods', [$oldFileName]);
                } catch (\Throwable) {
                }
            }
            $manifest[] = [
                'mod_id' => $this->modId,
                'provider' => $this->provider,
                'version_id' => $this->versionId,
                'mod_name' => $this->modName,
                'mod_icon' => $this->modIcon,
                'mod_author' => $this->modAuthor,
                'file_name' => $fileName,
                'installed_at' => now()->toIso8601String(),
            ];
            $repo->putContent(
                $manifestPath,
                json_encode(array_values($manifest), JSON_PRETTY_PRINT | JSON_UNESCAPED_SLASHES)
            );
        } catch (\Throwable $e) {
            logger()->warning('Failed to update installed mods manifest', ['error' => $e->getMessage()]);
        }
    }
    public function failed(?\Throwable $exception = null): void
    {
        logger()->error('ModJob failed', [
            'server'   => $this->server->uuid,
            'provider' => $this->provider,
            'mod'      => $this->modId,
            'error'    => $exception?->getMessage(),
        ]);
    }
}
