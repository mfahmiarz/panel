<?php
namespace Pterodactyl\Services\Minecraft\Modpacks;
use GuzzleHttp\Client;
use Illuminate\Support\Facades\Cache;
use GuzzleHttp\Exception\TransferException;
use GuzzleHttp\Exception\BadResponseException;
class TechnicModpackService extends AbstractModpackService
{
    protected Client $client;
    public function __construct()
    {
        parent::__construct();
        $this->client = new Client([
            'headers'  => [
                'User-Agent' => $this->userAgent,
            ],
            'base_uri' => 'https://api.technicpack.net/',
        ]);
    }
    public function search(string $searchQuery, int $pageSize, int $page, string $loader = ''): array
    {
        try {
            $response = json_decode($this->client->get('search', [
                'query' => [
                    'q'     => empty($searchQuery) ? 'Technic' : $searchQuery,
                    'build' => $this->getBuild(),
                ],
            ])->getBody(), true);
        } catch (TransferException $e) {
            if ($e instanceof BadResponseException) {
                logger()->error('Technic bad response on search.', ['body' => \GuzzleHttp\Psr7\Message::toString($e->getResponse())]);
            }
            return ['data' => [], 'total' => 0];
        }
        $modpacks = [];
        foreach ($response['modpacks'] ?? [] as $pack) {
            $modpacks[] = [
                'id'          => $pack['slug'],
                'name'        => $pack['name'],
                'description' => null,
                'icon_url'    => $pack['iconUrl'] ?? null,
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
    /**
     * Fetch a valid launcher build number from Technic (cached 1 hour).
     * This is required by the Technic search API as the `build` parameter.
     */
    protected function getBuild(): string|int
    {
        return Cache::remember('technic-build', 3600, function () {
            try {
                $response = json_decode($this->client->get('launcher/version/stable4')->getBody(), true);
                return $response['build'] ?? 822;
            } catch (TransferException $e) {
                if ($e instanceof BadResponseException) {
                    logger()->error('Technic bad response fetching build.', ['body' => \GuzzleHttp\Psr7\Message::toString($e->getResponse())]);
                }
                return 822;
            }
        });
    }
}
