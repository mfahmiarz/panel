<?php
namespace Pterodactyl\Services\Minecraft\Modpacks;
use GuzzleHttp\Client;
use GuzzleHttp\RequestOptions;
use GuzzleHttp\Exception\TransferException;
use GuzzleHttp\Exception\BadResponseException;
class ATLauncherModpackService extends AbstractModpackService
{
    protected Client $client;
    public function __construct()
    {
        parent::__construct();
        $this->client = new Client([
            'base_uri' => 'https://api.atlauncher.com/v2/',
            'headers'  => [
                'User-Agent' => $this->userAgent,
            ],
        ]);
    }
    public function search(string $searchQuery, int $pageSize, int $page, string $loader = ''): array
    {
        /*
         * The installer resolves packs by safeName on NodeCDN:
         *   https://download.nodecdn.net/containers/atl/packs/{safeName}/versions/{version}/Configs.json
         *
         * So we MUST return safeName as the modpack ID, not the numeric integer ID.
         */
        if (!empty($searchQuery)) {
            $gql   = 'query { searchPacks(first: ' . $pageSize . ', query: "' . addslashes($searchQuery) . '") { id safeName name description websiteUrl } }';
            $index = 'searchPacks';
        } else {
            $gql   = 'query { packs(first: ' . $pageSize . ') { id safeName name description websiteUrl } }';
            $index = 'packs';
        }
        try {
            $response = json_decode($this->client->post('graphql', [
                RequestOptions::JSON => ['query' => $gql],
            ])->getBody(), true);
        } catch (TransferException $e) {
            if ($e instanceof BadResponseException) {
                logger()->error('ATLauncher bad response on search.', ['body' => \GuzzleHttp\Psr7\Message::toString($e->getResponse())]);
            }
            return ['data' => [], 'total' => 0];
        }
        if (!isset($response['data'][$index])) {
            return ['data' => [], 'total' => 0];
        }
        $modpacks = [];
        foreach ($response['data'][$index] as $pack) {
            $safeName = $pack['safeName'];
            $modpacks[] = [
                'id'          => $safeName,
                'name'        => $pack['name'],
                'description' => $pack['description'] ?? null,
                'icon_url'    => 'https://cdn.atlcdn.net/images/packs/' . strtolower($safeName) . '.png',
            ];
        }
        return [
            'data'  => $modpacks,
            'total' => count($modpacks),
        ];
    }
    public function versions(string $modpackId): array
    {
        /*
         * $modpackId is now a safeName (e.g. "SkyFactory4").
         * Query versions using safeName.
         */
        $gql = 'query { pack(pack: { safeName: "' . addslashes($modpackId) . '" }) { versions(first: 100) { version } } }';
        try {
            $response = json_decode($this->client->post('graphql', [
                RequestOptions::JSON => ['query' => $gql],
            ])->getBody(), true);
        } catch (TransferException $e) {
            if ($e instanceof BadResponseException) {
                logger()->error('ATLauncher bad response on versions.', ['body' => \GuzzleHttp\Psr7\Message::toString($e->getResponse())]);
            }
            return [];
        }
        $versions = [];
        foreach ($response['data']['pack']['versions'] ?? [] as $v) {
            $versions[] = [
                'id'   => $v['version'],
                'name' => $v['version'],
            ];
        }
        return $versions;
    }
}
