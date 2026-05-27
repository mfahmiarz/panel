<?php
namespace Pterodactyl\Services\Minecraft\Modpacks;
use GuzzleHttp\Pool;
use GuzzleHttp\Client;
use GuzzleHttp\Psr7\Request;
use GuzzleHttp\Psr7\Response;
use GuzzleHttp\Exception\TransferException;
use GuzzleHttp\Exception\BadResponseException;
class FeedTheBeastModpackService extends AbstractModpackService
{
    protected Client $client;
    public function __construct()
    {
        parent::__construct();
        $this->client = new Client([
            'base_uri' => 'https://api.feed-the-beast.com/v1/modpacks/public/modpack/',
            'headers'  => [
                'User-Agent' => $this->userAgent,
            ],
        ]);
    }
    public function search(string $searchQuery, int $pageSize, int $page, string $loader = ''): array
    {
        $uri = (empty($searchQuery) ? 'popular/installs/' : 'search/') . $pageSize;
        try {
            $response = json_decode($this->client->get($uri, [
                'query' => ['term' => $searchQuery],
            ])->getBody(), true);
        } catch (TransferException $e) {
            if ($e instanceof BadResponseException) {
                logger()->error('FTB bad response on search.', ['body' => \GuzzleHttp\Psr7\Message::toString($e->getResponse())]);
            }
            return ['data' => [], 'total' => 0];
        }
        if (!isset($response['packs'])) {
            return ['data' => [], 'total' => 0];
        }
        $requests = [];
        foreach ($response['packs'] as $packId) {
            if ($packId == 81) {
                continue; 
            }
            $requests[] = new Request('GET', (string) $packId);
        }
        $modpacks = [];
        $pool = new Pool($this->client, $requests, [
            'concurrency' => 5,
            'fulfilled'   => function (Response $response, $index) use (&$modpacks) {
                if ($response->getStatusCode() !== 200) {
                    return;
                }
                $pack = json_decode($response->getBody(), true);
                if (($pack['status'] ?? '') === 'error') {
                    return;
                }
                $iconUrl = null;
                foreach ($pack['art'] ?? [] as $art) {
                    if ($art['type'] === 'square') {
                        $iconUrl = $art['url'];
                        break;
                    }
                }
                $modpacks[$index] = [
                    'id'          => (string) $pack['id'],
                    'name'        => $pack['name'],
                    'description' => $pack['description'] ?? null,
                    'icon_url'    => $iconUrl,
                ];
            },
        ]);
        $pool->promise()->wait();
        ksort($modpacks);
        return [
            'data'  => array_values($modpacks),
            'total' => count($modpacks),
        ];
    }
    public function versions(string $modpackId): array
    {
        try {
            $response = json_decode($this->client->get($modpackId)->getBody(), true);
        } catch (TransferException $e) {
            if ($e instanceof BadResponseException) {
                logger()->error('FTB bad response on versions.', ['body' => \GuzzleHttp\Psr7\Message::toString($e->getResponse())]);
            }
            return [];
        }
        $versions = [];
        foreach ($response['versions'] ?? [] as $v) {
            $versions[] = [
                'id'   => (string) $v['id'],
                'name' => $v['name'],
            ];
        }
        return array_reverse($versions); 
    }
}
