<?php
namespace Pterodactyl\Services\Minecraft\Mods;
use GuzzleHttp\Client;
use GuzzleHttp\Exception\TransferException;
use GuzzleHttp\Exception\BadResponseException;
class ModrinthModService extends AbstractModService
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
    public function search(string $query, int $pageSize, int $page, string $mcVersion = '', string $loader = ''): array
    {
        try {
            $facets_arr = [["project_type:mod"], ["server_side:required","server_side:optional"]];
            if ($mcVersion !== '') {
                $facets_arr[] = ["versions:{$mcVersion}"];
            }
            if ($loader !== '') {
                $facets_arr[] = ["categories:{$loader}"];
            }
            $facets = json_encode($facets_arr);
            $response = json_decode($this->client->get('search', [
                'query' => [
                    'query'  => $query,
                    'facets' => $facets,
                    'index'  => 'relevance',
                    'offset' => ($page - 1) * $pageSize,
                    'limit'  => $pageSize,
                ],
            ])->getBody(), true);
        } catch (TransferException $e) {
            if ($e instanceof BadResponseException) {
                logger()->error('Modrinth bad response on mod search.', ['body' => \GuzzleHttp\Psr7\Message::toString($e->getResponse())]);
            }
            return ['data' => [], 'total' => 0];
        }
        $mods = [];
        foreach ($response['hits'] ?? [] as $hit) {
            $mods[] = [
                'id'          => $hit['project_id'],
                'name'        => $hit['title'],
                'description' => $hit['description'] ?? null,
                'icon_url'    => empty($hit['icon_url']) ? null : $hit['icon_url'],
                'author'      => $hit['author'] ?? null,
                'downloads'   => $hit['downloads'] ?? 0,
            ];
        }
        return [
            'data'  => $mods,
            'total' => $response['total_hits'] ?? count($mods),
        ];
    }
    public function versions(string $modId, string $mcVersion = '', string $loader = ''): array
    {
        try {
            $loaders = ["forge", "fabric", "quilt", "neoforge"];
            if ($loader !== '') {
                $loaders = [$loader];
            }
            $params = ['loaders' => json_encode($loaders)];
            if ($mcVersion !== '') {
                $params['game_versions'] = '["' . $mcVersion . '"]';
            }
            $response = json_decode(
                $this->client->get('project/' . $modId . '/version', ['query' => $params])->getBody(),
                true
            );
        } catch (TransferException $e) {
            return [];
        }
        $versions = [];
        foreach ($response as $v) {
            $file = $v['files'][0] ?? null;
            $versions[] = [
                'id'           => $v['id'],
                'name'         => $v['name'],
                'download_url' => $file['url'] ?? '',
                'filename'     => $file['filename'] ?? null,
            ];
        }
        return $versions;
    }
    public function downloadUrl(string $modId, string $versionId): string
    {
        try {
            $response = json_decode(
                $this->client->get('version/' . $versionId)->getBody(),
                true
            );
            return $response['files'][0]['url'] ?? '';
        } catch (TransferException $e) {
            return '';
        }
    }
}
