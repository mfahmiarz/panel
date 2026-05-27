<?php
namespace Pterodactyl\Services\Minecraft\Mods;
abstract class AbstractModService
{
    protected string $userAgent;
    public function __construct()
    {
        $this->userAgent = config('app.name') . '/' . config('app.version', '1.0') . ' (' . url('/') . ')';
    }
    /**
     * Search for mods on the provider.
     * Returns ['data' => [...], 'total' => int]
     */
    abstract public function search(string $query, int $pageSize, int $page, string $mcVersion = '', string $loader = ''): array;
    /**
     * Get downloadable versions for a specific mod.
     * Returns [['id' => '...', 'name' => '...', 'download_url' => '...'], ...]
     */
    abstract public function versions(string $modId, string $mcVersion = '', string $loader = ''): array;
    /**
     * Resolve the direct download URL for a given mod + version.
     */
    abstract public function downloadUrl(string $modId, string $versionId): string;
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
            logger()->error('Error following redirect for mod download', ['url' => $url, 'error' => $e->getMessage()]);
        }
        return null;
    }
    protected function resolveGitHubReleaseJar(string $url): string
    {
        if (preg_match('/github\.com\/([^\/]+)\/([^\/]+)\/releases\/(tag|latest)\/?([^\/]+)?/i', $url, $matches)) {
            $owner = $matches[1];
            $repo = $matches[2];
            $type = strtolower($matches[3]);
            $tag = $matches[4] ?? '';
            try {
                $client = new \GuzzleHttp\Client([
                    'headers' => [
                        'User-Agent' => $this->userAgent,
                        'Accept'     => 'application/json',
                    ],
                ]);
                $response = null;
                if ($type === 'latest' || $tag === '') {
                    $apiUrl = "https://api.github.com/repos/{$owner}/{$repo}/releases/latest";
                    $response = json_decode($client->get($apiUrl)->getBody()->getContents(), true);
                } else {
                    $apiUrl = "https://api.github.com/repos/{$owner}/{$repo}/releases/tags/{$tag}";
                    try {
                        $response = json_decode($client->get($apiUrl)->getBody()->getContents(), true);
                    } catch (\Exception $tagException) {
                        $apiUrl = "https://api.github.com/repos/{$owner}/{$repo}/releases/latest";
                        $response = json_decode($client->get($apiUrl)->getBody()->getContents(), true);
                    }
                }
                foreach ($response['assets'] ?? [] as $asset) {
                    if (str_ends_with(strtolower($asset['name'] ?? ''), '.jar')) {
                        return $asset['browser_download_url'];
                    }
                }
            } catch (\Exception $e) {
                logger()->error('Failed to resolve GitHub release jar from API', ['url' => $url, 'error' => $e->getMessage()]);
            }
        }
        return $url;
    }
}
