<?php
namespace Pterodactyl\Services\Minecraft\Modpacks;
use GuzzleHttp\Client;
use GuzzleHttp\Exception\TransferException;
use GuzzleHttp\Exception\BadResponseException;
class CurseForgeModpackService extends AbstractModpackService
{
    public const MINECRAFT_GAME_ID    = 432;
    public const MINECRAFT_CLASS_ID   = 4471;
    protected Client $client;
    public function __construct()
    {
        parent::__construct();
        $this->client = new Client([
            'headers'  => [
                'User-Agent' => $this->userAgent,
                'x-api-key'  => config('services.curseforge.api_key', env('CURSEFORGE_API_KEY', '')),
            ],
            'base_uri' => 'https://api.curseforge.com/v1/',
        ]);
    }
    /**
     * Search for modpacks on CurseForge.
     * Signature must match AbstractModpackService: search(searchQuery, pageSize, page).
     */
    public function search(string $searchQuery, int $pageSize, int $page, string $loader = ''): array
    {
        try {
            $response = json_decode($this->client->get('mods/search', [
                'query' => [
                    'gameId'       => self::MINECRAFT_GAME_ID,
                    'classId'      => self::MINECRAFT_CLASS_ID,
                    'searchFilter' => $searchQuery,
                    'pageSize'     => $pageSize,
                    'index'        => ($page - 1) * $pageSize,
                    'sortField'    => 2,     
                    'sortOrder'    => 'desc',
                ],
            ])->getBody(), true);
        } catch (TransferException $e) {
            if ($e instanceof BadResponseException) {
                logger()->error('CurseForge bad response on search.', ['body' => \GuzzleHttp\Psr7\Message::toString($e->getResponse())]);
            }
            return ['data' => [], 'total' => 0];
        }
        $modpacks = [];
        foreach ($response['data'] ?? [] as $mod) {
            $modpacks[] = [
                'id'          => (string) $mod['id'],
                'name'        => $mod['name'],
                'description' => $mod['summary'] ?? null,
                'icon_url'    => $mod['logo']['thumbnailUrl'] ?? $mod['logo']['url'] ?? null,
            ];
        }
        $maximumPage = (int) ((10000 - $pageSize) / $pageSize) + 1;
        $total       = min($maximumPage * $pageSize, $response['pagination']['totalCount'] ?? count($modpacks));
        return [
            'data'  => $modpacks,
            'total' => $total,
        ];
    }
    public function versions(string $modpackId): array
    {
        try {
            $response = json_decode(
                $this->client->get('mods/' . $modpackId . '/files')->getBody(),
                true
            );
        } catch (TransferException $e) {
            if ($e instanceof BadResponseException) {
                logger()->error('CurseForge bad response on versions.', ['body' => \GuzzleHttp\Psr7\Message::toString($e->getResponse())]);
            }
            return [];
        }
        $versions = [];
        foreach ($response['data'] ?? [] as $file) {
            $versions[] = [
                'id'   => (string) $file['id'],
                'name' => $file['displayName'],
            ];
        }
        return $versions;
    }
}
