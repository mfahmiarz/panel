<?php
namespace Pterodactyl\Services\Minecraft\Modpacks;
use GuzzleHttp\Client;
use GuzzleHttp\Exception\TransferException;
use GuzzleHttp\Exception\BadResponseException;
class VoidsWrathModpackService extends AbstractModpackService
{
    protected Client $client;
    public function __construct()
    {
        parent::__construct();
        $this->client = new Client([
            'headers' => [
                'User-Agent' => $this->userAgent,
            ],
        ]);
    }
    public function search(string $searchQuery, int $pageSize, int $page, string $loader = ''): array
    {
        try {
            $response = json_decode(
                $this->client->get('https://raw.githubusercontent.com/astrooom/minecraft-modpack-index/main/voidswrath-modpacks.json')
                    ->getBody(),
                true
            );
        } catch (TransferException $e) {
            if ($e instanceof BadResponseException) {
                logger()->error('VoidsWrath bad response on search.', ['body' => \GuzzleHttp\Psr7\Message::toString($e->getResponse())]);
            }
            return ['data' => [], 'total' => 0];
        }
        $modpacks = [];
        foreach ($response ?? [] as $pack) {
            $modpacks[] = [
                'id'          => (string) $pack['id'],
                'name'        => $pack['displayName'],
                'description' => $pack['description'] ?? null,
                'icon_url'    => $pack['logo'] ?? null,
            ];
        }
        return [
            'data'  => $modpacks,
            'total' => count($modpacks),
        ];
    }
    public function versions(string $modpackId): array
    {
        return [
            [
                'id'   => 'latest',
                'name' => 'Latest',
            ],
        ];
    }
}
