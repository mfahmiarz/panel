<?php
namespace Pterodactyl\Services\Minecraft\Worlds;
abstract class AbstractWorldService
{
    protected string $userAgent;
    public function __construct()
    {
        $this->userAgent = config('app.name') . '/' . config('app.version', '1.0') . ' (' . url('/') . ')';
    }
    /**
     * Search for worlds on the provider.
     * Returns ['data' => [...], 'total' => int]
     */
    abstract public function search(string $query, int $pageSize, int $page, string $mcVersion = ''): array;
    /**
     * Get downloadable versions for a specific world.
     * Returns [['id' => '...', 'name' => '...', 'download_url' => '...'], ...]
     */
    abstract public function versions(string $worldId, string $mcVersion = ''): array;
    /**
     * Resolve the direct download URL for a given world + version.
     */
    abstract public function downloadUrl(string $worldId, string $versionId): string;
    /**
     * Follow redirects for a URL using HEAD request to find the actual direct download URL.
     */
    protected function getRedirectUrl(string $url): ?string
    {
        try {
            stream_context_set_default([
                'http' => [
                    'method' => 'HEAD',
                ],
            ]);
            $headers = get_headers($url, 1);
            if ($headers !== false && isset($headers['Location'])) {
                return is_array($headers['Location']) ? array_pop($headers['Location']) : $headers['Location'];
            }
        } catch (\Exception $e) {
            logger()->error('Error following redirect for world download', ['url' => $url, 'error' => $e->getMessage()]);
        }
        return null;
    }
}
