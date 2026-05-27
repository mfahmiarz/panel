<?php
namespace Pterodactyl\Services\Minecraft\Modpacks;
use GuzzleHttp\Client;
use GuzzleHttp\Exception\TransferException;
use GuzzleHttp\Exception\BadResponseException;
class ModrinthModpackService extends AbstractModpackService
{
    protected Client $client;
    public function __construct()
    {
        parent::__construct();
        $this->client = new Client([
            'headers'  => ['User-Agent' => $this->userAgent],
            'base_uri' => 'https://api.modrinth.com/v2/',
        ]);
    }
    public function search(string $searchQuery, int $pageSize, int $page, string $loader = ''): array
    {
        try {
            $facets_arr = [["project_type:modpack"], ["server_side!=unsupported"]];
            if ($loader !== '') {
                $facets_arr[] = ["categories:{$loader}"];
            }
            $facets = json_encode($facets_arr);
            $response = json_decode($this->client->get('search', [
                'query' => [
                    'query'  => $searchQuery,
                    'facets' => $facets,
                    'index'  => 'relevance',
                    'offset' => ($page - 1) * $pageSize,
                    'limit'  => $pageSize,
                ],
            ])->getBody(), true);
        } catch (TransferException $e) {
            if ($e instanceof BadResponseException) {
                logger()->error('Modrinth bad response on search.', ['body' => \GuzzleHttp\Psr7\Message::toString($e->getResponse())]);
            }
            return ['data' => [], 'total' => 0];
        }
        $modpacks = [];
        foreach ($response['hits'] ?? [] as $hit) {
            $modpacks[] = [
                'id'          => $hit['project_id'],
                'name'        => $hit['title'],
                'description' => $hit['description'] ?? null,
                'icon_url'    => empty($hit['icon_url']) ? null : $hit['icon_url'],
            ];
        }
        return [
            'data'  => $modpacks,
            'total' => $response['total_hits'] ?? count($modpacks),
        ];
    }
    public function versions(string $modpackId): array
    {
        try {
            $response = json_decode(
                $this->client->get('project/' . $modpackId . '/version')->getBody(),
                true
            );
        } catch (TransferException $e) {
            if ($e instanceof BadResponseException) {
                logger()->error('Modrinth bad response on versions.', ['body' => \GuzzleHttp\Psr7\Message::toString($e->getResponse())]);
            }
            return [];
        }
        $versions = [];
        foreach ($response as $v) {
            $versions[] = [
                'id'   => $v['id'],
                'name' => $v['name'],
            ];
        }
        return $versions;
    }
}
