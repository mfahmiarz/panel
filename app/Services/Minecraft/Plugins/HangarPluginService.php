<?php
namespace Pterodactyl\Services\Minecraft\Plugins;
use GuzzleHttp\Client;
use GuzzleHttp\Exception\TransferException;
use GuzzleHttp\Exception\BadResponseException;
class HangarPluginService extends AbstractPluginService
{
    protected Client $client;
    public function __construct()
    {
        parent::__construct();
        $this->client = new Client([
            'headers'  => ['User-Agent' => $this->userAgent],
            'base_uri' => 'https://hangar.papermc.io/api/v1/',
        ]);
    }
    public function search(string $query, int $pageSize, int $page, string $mcVersion = '', string $loader = ''): array
    {
        try {
            $params = [
                'q'       => $query,
                'limit'   => $pageSize,
                'offset'  => ($page - 1) * $pageSize,
                'sort'    => '-stars',
            ];
            if ($mcVersion !== '') {
                $params['version'] = $mcVersion;
            }
            $response = json_decode($this->client->get('projects', [
                'query' => $params,
            ])->getBody(), true);
        } catch (TransferException $e) {
            if ($e instanceof BadResponseException) {
                logger()->error('Hangar bad response on plugin search.', ['body' => \GuzzleHttp\Psr7\Message::toString($e->getResponse())]);
            }
            return ['data' => [], 'total' => 0];
        }
        $plugins = [];
        foreach ($response['result'] ?? [] as $project) {
            $plugins[] = [
                'id'          => $project['namespace']['slug'],
                'name'        => $project['name'],
                'description' => $project['description'] ?? null,
                'icon_url'    => $project['avatarUrl'] ?? null,
                'author'      => $project['namespace']['owner'] ?? null,
                'downloads'   => $project['stats']['downloads'] ?? 0,
            ];
        }
        return [
            'data'  => $plugins,
            'total' => $response['pagination']['count'] ?? count($plugins),
        ];
    }
    public function versions(string $pluginId, string $mcVersion = '', string $loader = ''): array
    {
        try {
            $params = [
                'limit'  => 25,
                'offset' => 0,
            ];
            if ($mcVersion !== '') {
                $params['platform']        = 'PAPER';
                $params['platformVersion'] = $mcVersion;
            }
            $response = json_decode($this->client->get(
                'projects/' . urlencode($pluginId) . '/versions',
                ['query' => $params]
            )->getBody(), true);
        } catch (TransferException $e) {
            return [];
        }
        $versions = [];
        foreach ($response['result'] ?? [] as $v) {
            $downloadUrl = '';
            $filename    = null;
            $downloads = $v['downloads'] ?? [];
            $platform  = $downloads['PAPER'] ?? $downloads['WATERFALL'] ?? $downloads['VELOCITY'] ?? reset($downloads);
            if (is_array($platform)) {
                $downloadUrl = $platform['downloadUrl'] ?? '';
                $filename    = basename($downloadUrl) ?: null;
            }
            $versions[] = [
                'id'           => $v['name'],
                'name'         => $v['name'],
                'download_url' => $downloadUrl,
                'filename'     => $filename,
            ];
        }
        return $versions;
    }
    public function downloadUrl(string $pluginId, string $versionId): string
    {
        try {
            $platform = 'PAPER';
            try {
                $response = json_decode($this->client->get('projects/' . $pluginId . '/versions/' . $versionId)->getBody(), true);
                if (isset($response['downloads'])) {
                    foreach (['PAPER', 'VELOCITY', 'WATERFALL'] as $p) {
                        if (isset($response['downloads'][$p])) {
                            $platform = $p;
                            break;
                        }
                    }
                }
                if (isset($response['downloads'][$platform])) {
                    $downloadInfo = $response['downloads'][$platform];
                    $downloadUrl = $downloadInfo['downloadUrl'] ?? $downloadInfo['externalUrl'] ?? null;
                    if ($downloadUrl) {
                        $downloadUrl = $this->resolveGitHubReleaseJar($downloadUrl);
                        $redirectUrl = $this->getRedirectUrl($downloadUrl);
                        return $redirectUrl ?: $downloadUrl;
                    }
                }
            } catch (\Exception $e) {
            }
            $downloadUrl = 'https://hangar.papermc.io/api/v1/projects/' . $pluginId . '/versions/' . $versionId . '/download';
            $downloadUrl = $this->resolveGitHubReleaseJar($downloadUrl);
            $redirectUrl = $this->getRedirectUrl($downloadUrl);
            return $redirectUrl ?: $downloadUrl;
        } catch (\Exception $e) {
            logger()->error('Error resolving Hangar download URL', ['plugin_id' => $pluginId, 'version_id' => $versionId, 'error' => $e->getMessage()]);
            $fallbackUrl = 'https://hangar.papermc.io/api/v1/projects/' . $pluginId . '/versions/' . $versionId . '/download';
            return $this->resolveGitHubReleaseJar($fallbackUrl);
        }
    }
}
