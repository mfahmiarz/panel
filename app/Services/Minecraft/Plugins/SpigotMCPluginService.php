<?php
namespace Pterodactyl\Services\Minecraft\Plugins;
use GuzzleHttp\Client;
use GuzzleHttp\Exception\TransferException;
use GuzzleHttp\Exception\BadResponseException;
class SpigotMCPluginService extends AbstractPluginService
{
    protected Client $client;
    protected const SPIGET_BASE = 'https://api.spiget.org/v2/';
    public function __construct()
    {
        parent::__construct();
        $this->client = new Client([
            'headers'  => [
                'User-Agent' => $this->userAgent,
                'Accept'     => 'application/json',
            ],
            'base_uri' => self::SPIGET_BASE,
        ]);
    }
    public function search(string $query, int $pageSize, int $page, string $mcVersion = '', string $loader = ''): array
    {
        try {
            if ($query === '') {
                $params = [
                    'size' => $pageSize,
                    'page' => $page,
                    'sort' => '-downloads',
                    'fields' => 'id,name,tag,icon,downloads,testedVersions,premium,author',
                ];
                $response = json_decode($this->client->get('resources', [
                    'query' => $params,
                ])->getBody(), true);
                $items = $response ?? [];
            } else {
                $params = [
                    'field' => 'name',
                    'size'  => $pageSize,
                    'page'  => $page,
                    'sort'  => '-downloads',
                    'fields' => 'id,name,tag,icon,downloads,testedVersions,premium,author',
                ];
                $response = json_decode($this->client->get('search/resources/' . urlencode($query), [
                    'query' => $params,
                ])->getBody(), true);
                $items = $response ?? [];
            }
        } catch (TransferException $e) {
            if ($e instanceof BadResponseException) {
                logger()->error('SpigotMC bad response on plugin search.', ['body' => \GuzzleHttp\Psr7\Message::toString($e->getResponse())]);
            }
            return ['data' => [], 'total' => 0];
        }
        $plugins = [];
        foreach ($items as $resource) {
            if ($mcVersion !== '') {
                $tested = $resource['testedVersions'] ?? [];
                if (!empty($tested) && !in_array($mcVersion, $tested, true)) {
                    $match = false;
                    foreach ($tested as $tv) {
                        if (str_starts_with($tv, $mcVersion)) {
                            $match = true;
                            break;
                        }
                    }
                    if (!$match) continue;
                }
            }
            $icon = null;
            if (!empty($resource['icon']['url'])) {
                $icon = 'https://www.spigotmc.org/' . ltrim($resource['icon']['url'], '/');
            }
            $authorName = null;
            if (!empty($resource['author']['id'])) {
                $authorName = 'Author #' . $resource['author']['id'];
            }
            $plugins[] = [
                'id'          => (string) $resource['id'],
                'name'        => $resource['name'],
                'description' => $resource['tag'] ?? null,
                'icon_url'    => $icon,
                'author'      => $authorName,
                'downloads'   => $resource['downloads'] ?? 0,
            ];
        }
        return [
            'data'  => $plugins,
            'total' => count($plugins) === $pageSize ? ($page * $pageSize) + 1 : ($page - 1) * $pageSize + count($plugins),
        ];
    }
    public function versions(string $pluginId, string $mcVersion = '', string $loader = ''): array
    {
        try {
            $response = json_decode($this->client->get('resources/' . $pluginId . '/versions', [
                'query' => ['size' => 25, 'page' => 1, 'sort' => '-id'],
            ])->getBody(), true);
        } catch (TransferException $e) {
            return [];
        }
        $versions = [];
        foreach ($response ?? [] as $v) {
            $versions[] = [
                'id'           => (string) $v['id'],
                'name'         => $v['name'] ?? 'Version ' . $v['id'],
                'download_url' => self::SPIGET_BASE . 'resources/' . $pluginId . '/versions/' . $v['id'] . '/download',
                'filename'     => null,
            ];
        }
        if (empty($versions)) {
            $versions[] = [
                'id'           => 'latest',
                'name'         => 'Latest',
                'download_url' => self::SPIGET_BASE . 'resources/' . $pluginId . '/download',
                'filename'     => null,
            ];
        }
        return $versions;
    }
    public function downloadUrl(string $pluginId, string $versionId): string
    {
        try {
            $resource = json_decode($this->client->get('resources/' . $pluginId)->getBody(), true);
        } catch (\Exception $e) {
            $resource = [];
        }
        $versionName = 'latest';
        if ($versionId !== 'latest') {
            try {
                $versionData = json_decode($this->client->get('resources/' . $pluginId . '/versions/' . $versionId)->getBody(), true);
                $versionName = $versionData['name'] ?? 'latest';
            } catch (\Exception $e) {
            }
        }
        $externalUrl = $resource['file']['externalUrl'] ?? null;
        $sourceCode = $resource['sourceCodeLink'] ?? null;
        $githubUrl = null;
        if ($externalUrl && str_contains(strtolower($externalUrl), 'github.com')) {
            $githubUrl = $externalUrl;
        } elseif ($sourceCode && str_contains(strtolower($sourceCode), 'github.com')) {
            $githubUrl = $sourceCode;
        }
        if ($githubUrl) {
            $githubBase = preg_replace('/\/releases\/latest\/?$/i', '', $githubUrl);
            $githubBase = rtrim($githubBase, '/');
            if ($versionName !== 'latest') {
                $downloadUrl = $githubBase . '/releases/tag/' . $versionName;
            } else {
                $downloadUrl = $githubBase . '/releases/latest';
            }
            $redirectUrl = $this->getRedirectUrl($downloadUrl);
            if ($redirectUrl) {
                $downloadUrl = $redirectUrl;
            }
            $resolvedUrl = $this->resolveGitHubReleaseJar($downloadUrl);
            if ($resolvedUrl && $resolvedUrl !== $downloadUrl) {
                return $resolvedUrl;
            }
        }
        if (isset($resource['premium']) && $resource['premium']) {
            if (isset($resource['file']['externalUrl'])) {
                $downloadUrl = $resource['file']['externalUrl'];
            } else {
                $downloadUrl = self::SPIGET_BASE . 'resources/' . $pluginId . ($versionId === 'latest' ? '/download' : '/versions/' . $versionId . '/download');
            }
        } else {
            $downloadUrl = self::SPIGET_BASE . 'resources/' . $pluginId . ($versionId === 'latest' ? '/download' : '/versions/' . $versionId . '/download');
        }
        $redirectUrl = $this->getRedirectUrl($downloadUrl);
        return $redirectUrl ?: $downloadUrl;
    }
}
