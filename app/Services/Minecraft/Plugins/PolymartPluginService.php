<?php
namespace Pterodactyl\Services\Minecraft\Plugins;
use GuzzleHttp\Client;
use GuzzleHttp\Exception\TransferException;
use GuzzleHttp\Exception\BadResponseException;
class PolymartPluginService extends AbstractPluginService
{
    protected Client $client;
    public function __construct()
    {
        parent::__construct();
        $this->client = new Client([
            'headers'  => [
                'User-Agent' => $this->userAgent,
                'Accept'     => 'application/json',
            ],
            'base_uri' => 'https://api.polymart.org/v1/',
        ]);
    }
    public function search(string $query, int $pageSize, int $page, string $mcVersion = '', string $loader = ''): array
    {
        try {
            $params = [
                'query'  => $query,
                'limit'  => $pageSize,
                'offset' => ($page - 1) * $pageSize,
                'type'   => 'plugin',
                'sort'   => 'downloads',
            ];
            if ($mcVersion !== '') {
                $params['version'] = $mcVersion;
            }
            $response = json_decode($this->client->get('search', [
                'query' => $params,
            ])->getBody(), true);
        } catch (TransferException $e) {
            if ($e instanceof BadResponseException) {
                logger()->error('Polymart bad response on plugin search.', ['body' => \GuzzleHttp\Psr7\Message::toString($e->getResponse())]);
            }
            return ['data' => [], 'total' => 0];
        }
        $plugins = [];
        $resources = $response['response']['result'] ?? [];
        foreach ($resources as $resource) {
            $price = $resource['price'] ?? '0.00';
            $isFree = ($price === '0.00' || $price === 0 || empty($price));
            $pricePrefix = $isFree ? '[Free] ' : '[' . ($resource['currency'] ?? 'USD') . ' ' . $price . '] ';
            $plugins[] = [
                'id'          => (string) $resource['id'],
                'name'        => $resource['title'],
                'description' => $pricePrefix . ($resource['subtitle'] ?? ''),
                'icon_url'    => $resource['thumbnailURL'] ?? $resource['thumbnail'] ?? null,
                'author'      => $resource['owner']['name'] ?? null,
                'downloads'   => $resource['stats']['downloads'] ?? $resource['downloads'] ?? 0,
            ];
        }
        $total = $response['response']['total'] ?? count($plugins);
        return ['data' => $plugins, 'total' => (int) $total];
    }
    public function versions(string $pluginId, string $mcVersion = '', string $loader = ''): array
    {
        return [
            [
                'id'           => 'latest',
                'name'         => 'Latest',
                'download_url' => '',   
                'filename'     => null,
            ],
        ];
    }
    public function downloadUrl(string $pluginId, string $versionId, string $apiToken = ''): string
    {
        if ($apiToken) {
            return 'https://api.polymart.org/v1/getDownload/?resource_id=' . $pluginId . '&api_token=' . urlencode($apiToken);
        }
        return 'https://api.polymart.org/v1/getDownload/?resource_id=' . $pluginId;
    }
    /**
     * Polymart-specific download URL with token support.
     */
    public function downloadUrlWithToken(string $pluginId, string $apiToken = ''): string
    {
        return $this->downloadUrl($pluginId, 'latest', $apiToken);
    }
}
