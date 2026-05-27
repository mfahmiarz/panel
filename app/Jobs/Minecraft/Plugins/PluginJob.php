<?php
namespace Pterodactyl\Jobs\Minecraft\Plugins;
use Illuminate\Foundation\Queue\Queueable;
use Illuminate\Contracts\Queue\ShouldQueue;
use Pterodactyl\Models\Server;
use Pterodactyl\Repositories\Wings\DaemonFileRepository;
use Pterodactyl\Exceptions\Http\Connection\DaemonConnectionException;
class PluginJob implements ShouldQueue
{
    use Queueable;
    public int $tries    = 3;
    public int $timeout  = 120;
    public function __construct(
        public Server $server,
        public string $provider,
        public string $pluginId,
        public string $versionId,
        public string $downloadUrl,
        public string $filename,
        public string $pluginName = '',
        public string $pluginIcon = '',
        public string $pluginAuthor = '',
    ) {
        $this->queue = 'standard';
    }
    /**
     * Execute the plugin installation by pulling the JAR into /plugins/ via Wings.
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
            $repo->createDirectory('plugins', '/');
        } catch (\Throwable) {
        }
        $params = ['foreground' => true];
        if ($this->filename) {
            $params['filename'] = $this->filename;
        }
        $repo->pull($this->downloadUrl, '/plugins', $params);
        $manifestPath = '/plugins/.installed_plugins.json';
        $fileName = $this->filename ?: (basename(parse_url($this->downloadUrl, PHP_URL_PATH)) ?: 'plugin.jar');
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
                if ((string) ($entry['plugin_id'] ?? '') === (string) $this->pluginId && ($entry['provider'] ?? '') === $this->provider) {
                    $oldFileName = $entry['file_name'] ?? null;
                    return false;
                }
                return true;
            });
            if ($oldFileName && $oldFileName !== $fileName) {
                try {
                    $repo->deleteFiles('/plugins', [$oldFileName]);
                } catch (\Throwable) {
                }
            }
            $manifest[] = [
                'plugin_id' => $this->pluginId,
                'provider' => $this->provider,
                'version_id' => $this->versionId,
                'plugin_name' => $this->pluginName,
                'plugin_icon' => $this->pluginIcon,
                'plugin_author' => $this->pluginAuthor,
                'file_name' => $fileName,
                'installed_at' => now()->toIso8601String(),
            ];
            $repo->putContent(
                $manifestPath,
                json_encode(array_values($manifest), JSON_PRETTY_PRINT | JSON_UNESCAPED_SLASHES)
            );
        } catch (\Throwable $e) {
            logger()->warning('Failed to update installed plugins manifest', ['error' => $e->getMessage()]);
        }
    }
    public function failed(?\Throwable $exception = null): void
    {
        logger()->error('PluginJob failed', [
            'server'   => $this->server->uuid,
            'provider' => $this->provider,
            'plugin'   => $this->pluginId,
            'error'    => $exception?->getMessage(),
        ]);
    }
}
