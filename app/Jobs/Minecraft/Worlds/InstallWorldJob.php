<?php
namespace Pterodactyl\Jobs\Minecraft\Worlds;
use Pterodactyl\Models\Server;
use Illuminate\Bus\Queueable;
use Illuminate\Queue\SerializesModels;
use Illuminate\Queue\InteractsWithQueue;
use Illuminate\Contracts\Queue\ShouldQueue;
use Illuminate\Foundation\Bus\Dispatchable;
use Pterodactyl\Repositories\Wings\DaemonFileRepository;
use Pterodactyl\Services\Minecraft\Worlds\CurseForgeWorldService;
use Illuminate\Support\Facades\Cache;
use GuzzleHttp\Client;
class InstallWorldJob implements ShouldQueue
{
    use Dispatchable, InteractsWithQueue, Queueable, SerializesModels;
    public int $tries = 1;
    public int $timeout = 600;
    public string $jobIdentifier;
    public function __construct(
        public Server $server,
        public string $provider,
        public string $worldId,
        public string $versionId,
        public ?string $downloadUrl = null,
        public ?string $filename = null,
        public ?string $worldName = null,
        public ?string $worldIcon = null,
        public ?string $worldAuthor = null
    ) {
        $this->jobIdentifier = 'mc_world_' . uniqid();
        $this->queue = 'standard';
    }
    public function getJobIdentifier(): string
    {
        return $this->jobIdentifier;
    }
    public function handle(DaemonFileRepository $repo): void
    {
        $repo->setServer($this->server);
        $downloadUrl = $this->downloadUrl ?? '';
        $filename = $this->filename ?? '';
        Cache::put("minecraft_world_download:{$this->jobIdentifier}", [
            'download_id' => $this->jobIdentifier,
            'filename' => $filename ?: 'world.zip',
            'server_id' => $this->server->id,
            'status' => 'downloading',
            'decompressed' => false,
            'error' => null
        ], 3600);
        try {
            if (empty($downloadUrl)) {
                $service = app(CurseForgeWorldService::class);
                $downloadUrl = $service->downloadUrl($this->worldId, $this->versionId);
            }
            if (empty($downloadUrl)) {
                throw new \Exception('Could not resolve download URL.');
            }
            if (empty($filename)) {
                $filename = basename(parse_url($downloadUrl, PHP_URL_PATH)) ?: null;
            }
            if (empty($filename)) {
                $filename = $this->worldName ? str_replace(' ', '_', $this->worldName) . '.zip' : 'world.zip';
            }
            if (!str_ends_with(strtolower($filename), '.zip')) {
                $filename .= '.zip';
            }
            Cache::put("minecraft_world_download:{$this->jobIdentifier}", [
                'download_id' => $this->jobIdentifier,
                'filename' => $filename,
                'server_id' => $this->server->id,
                'status' => 'downloading',
                'decompressed' => false,
                'error' => null
            ], 3600);
            $client = new Client([
                'headers' => [
                    'User-Agent' => 'Mozilla/5.0 (X11; Linux x86_64; rv:127.0) Gecko/20100101 Firefox/127.0',
                    'Accept' => '*/*',
                ],
                'allow_redirects' => [
                    'max'             => 10,
                    'strict'          => true,
                    'referer'         => true,
                    'track_redirects' => true,
                ],
                'timeout' => 180,
            ]);
            $response = $client->get($downloadUrl);
            $contents = $response->getBody()->getContents();
            $contentDisposition = $response->getHeaderLine('Content-Disposition');
            if ($contentDisposition && preg_match('/filename=["\']?([^"\';]+)/i', $contentDisposition, $matches)) {
                $filename = basename($matches[1]);
                if (!str_ends_with(strtolower($filename), '.zip')) {
                    $filename .= '.zip';
                }
            }
            $repo->putContent($filename, $contents);
            $repo->decompressFile('/', $filename);
            $repo->deleteFiles('/', [$filename]);
            $manifestPath = '/.installed_worlds.json';
            $manifest = [];
            try {
                $content = $repo->getContent($manifestPath);
                $decoded = json_decode($content, true);
                if (is_array($decoded)) {
                    $manifest = $decoded;
                }
            } catch (\Throwable) {
            }
            $manifest = array_filter($manifest, function ($entry) {
                return !((string) ($entry['world_id'] ?? '') === (string) $this->worldId && ($entry['provider'] ?? '') === $this->provider);
            });
            $manifest[] = [
                'world_id' => $this->worldId,
                'provider' => $this->provider,
                'version_id' => $this->versionId,
                'world_name' => $this->worldName ?? '',
                'world_icon' => $this->worldIcon ?? '',
                'world_author' => $this->worldAuthor ?? '',
                'file_name' => $filename,
                'installed_at' => now()->toIso8601String(),
            ];
            $repo->putContent(
                $manifestPath,
                json_encode(array_values($manifest), JSON_PRETTY_PRINT | JSON_UNESCAPED_SLASHES)
            );
            Cache::forget("world_latest:{$this->provider}:{$this->worldId}");
            Cache::put("minecraft_world_download:{$this->jobIdentifier}", [
                'download_id' => $this->jobIdentifier,
                'filename' => $filename,
                'server_id' => $this->server->id,
                'status' => 'completed',
                'decompressed' => true,
                'error' => null
            ], 3600);
        } catch (\Throwable $e) {
            logger()->error('Failed to download or decompress world via background job', [
                'server' => $this->server->uuid,
                'provider' => $this->provider,
                'world_id' => $this->worldId,
                'error' => $e->getMessage()
            ]);
            Cache::put("minecraft_world_download:{$this->jobIdentifier}", [
                'download_id' => $this->jobIdentifier,
                'filename' => $filename ?: 'world.zip',
                'server_id' => $this->server->id,
                'status' => 'failed',
                'decompressed' => false,
                'error' => $e->getMessage()
            ], 3600);
        }
    }
}
