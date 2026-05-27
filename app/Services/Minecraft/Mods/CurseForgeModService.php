<?php
namespace Pterodactyl\Services\Minecraft\Mods;
use GuzzleHttp\Client;
use GuzzleHttp\Exception\TransferException;
use GuzzleHttp\Exception\BadResponseException;
class CurseForgeModService extends AbstractModService
{
    public const MINECRAFT_GAME_ID  = 432;
    public const MODS_CLASS_ID      = 6;
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
    public function search(string $query, int $pageSize, int $page, string $mcVersion = '', string $loader = ''): array
    {
        try {
            $params = [
                'gameId'       => self::MINECRAFT_GAME_ID,
                'classId'      => self::MODS_CLASS_ID,
                'searchFilter' => $query,
                'pageSize'     => $pageSize,
                'index'        => ($page - 1) * $pageSize,
                'sortField'    => 2,
                'sortOrder'    => 'desc',
            ];
            if ($mcVersion !== '') {
                $params['gameVersion'] = $mcVersion;
            }
            $response = json_decode($this->client->get('mods/search', [
                'query' => $params,
            ])->getBody(), true);
        } catch (TransferException $e) {
            if ($e instanceof BadResponseException) {
                logger()->error('CurseForge bad response on mod search.', ['body' => \GuzzleHttp\Psr7\Message::toString($e->getResponse())]);
            }
            return ['data' => [], 'total' => 0];
        }
        $mods = [];
        foreach ($response['data'] ?? [] as $mod) {
            $mods[] = [
                'id'          => (string) $mod['id'],
                'name'        => $mod['name'],
                'description' => $mod['summary'] ?? null,
                'icon_url'    => $mod['logo']['thumbnailUrl'] ?? $mod['logo']['url'] ?? null,
                'author'      => collect($mod['authors'] ?? [])->pluck('name')->implode(', ') ?: null,
                'downloads'   => $mod['downloadCount'] ?? 0,
            ];
        }
        $maximumPage = (int) ((10000 - $pageSize) / $pageSize) + 1;
        $total       = min($maximumPage * $pageSize, $response['pagination']['totalCount'] ?? count($mods));
        return ['data' => $mods, 'total' => $total];
    }
    public function versions(string $modId, string $mcVersion = '', string $loader = ''): array
    {
        try {
            $params = [];
            if ($mcVersion !== '') {
                $params['gameVersion'] = $mcVersion;
            }
            $response = json_decode(
                $this->client->get('mods/' . $modId . '/files', ['query' => $params])->getBody(),
                true
            );
        } catch (TransferException $e) {
            return [];
        }
        $versions = [];
        foreach ($response['data'] ?? [] as $file) {
            $versions[] = [
                'id'           => (string) $file['id'],
                'name'         => $file['displayName'],
                'download_url' => $file['downloadUrl'] ?? '',
                'filename'     => $file['fileName'] ?? null,
            ];
        }
        return $versions;
    }
    public function downloadUrl(string $modId, string $versionId): string
    {
        try {
            $fileResponse = json_decode($this->client->get('mods/' . $modId . '/files/' . $versionId)->getBody(), true);
            $fileData = $fileResponse['data'] ?? [];
            $fileName = $fileData['fileName'] ?? null;
            $downloadUrl = null;
            try {
                $response = json_decode($this->client->get('mods/' . $modId . '/files/' . $versionId . '/download-url')->getBody(), true);
                if (!empty($response['data'])) {
                    $downloadUrl = $response['data'];
                }
            } catch (TransferException $e) {
            }
            if (empty($downloadUrl) && !empty($fileData['downloadUrl'])) {
                $downloadUrl = $fileData['downloadUrl'];
            }
            if (empty($downloadUrl) && $fileName) {
                $fileIdInt = (int) $versionId;
                $firstPart = (int) ($fileIdInt / 1000);
                $secondPart = $fileIdInt % 1000;
                $downloadUrl = "https://mediafiles.forgecdn.net/files/{$firstPart}/{$secondPart}/{$fileName}";
            }
            if (empty($downloadUrl)) {
                return '';
            }
            $downloadUrl = str_replace('edge', 'mediafiles', $downloadUrl);
            $redirectUrl = $this->getRedirectUrl($downloadUrl);
            if ($redirectUrl) {
                $downloadUrl = $redirectUrl;
            }
            return $downloadUrl;
        } catch (TransferException $e) {
            logger()->error('Error resolving CurseForge download URL', ['mod_id' => $modId, 'version_id' => $versionId, 'error' => $e->getMessage()]);
            return '';
        }
    }
}
