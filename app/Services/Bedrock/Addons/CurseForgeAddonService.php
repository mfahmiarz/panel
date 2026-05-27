<?php
namespace Pterodactyl\Services\Bedrock\Addons;
use GuzzleHttp\Client;
use GuzzleHttp\Exception\TransferException;
use GuzzleHttp\Exception\BadResponseException;
class CurseForgeAddonService
{
    public const MINECRAFT_GAME_ID = 78022;
    protected Client $client;
    protected string $userAgent;
    public function __construct()
    {
        $this->userAgent = config('app.name') . '/' . config('app.version', '1.0') . ' (' . url('/') . ')';
        $this->client = new Client([
            'headers'  => [
                'User-Agent' => $this->userAgent,
                'x-api-key'  => config('services.curseforge.api_key', env('CURSEFORGE_API_KEY', '')),
            ],
            'base_uri' => 'https://api.curseforge.com/v1/',
        ]);
    }
    /**
     * Search for Bedrock addons on CurseForge.
     */
    public function search(string $query, int $pageSize, int $page, ?int $categoryId = null): array
    {
        try {
            $params = [
                'gameId'       => self::MINECRAFT_GAME_ID,
                'searchFilter' => $query,
                'pageSize'     => $pageSize,
                'index'        => ($page - 1) * $pageSize,
                'sortField'    => 2,
                'sortOrder'    => 'desc',
            ];
            if ($categoryId) {
                $params['classId'] = $categoryId;
            }
            $response = json_decode($this->client->get('mods/search', [
                'query' => $params,
            ])->getBody(), true);
        } catch (TransferException $e) {
            if ($e instanceof BadResponseException) {
                logger()->error('CurseForge bad response on Bedrock addon search.', ['body' => \GuzzleHttp\Psr7\Message::toString($e->getResponse())]);
            }
            return ['data' => [], 'total' => 0];
        }
        $addons = [];
        foreach ($response['data'] ?? [] as $mod) {
            $addons[] = [
                'id'          => (string) $mod['id'],
                'name'        => $mod['name'],
                'description' => $mod['summary'] ?? null,
                'icon_url'    => $mod['logo']['thumbnailUrl'] ?? $mod['logo']['url'] ?? null,
                'author'      => collect($mod['authors'] ?? [])->pluck('name')->implode(', ') ?: null,
                'downloads'   => $mod['downloadCount'] ?? 0,
            ];
        }
        $maximumPage = (int) ((10000 - $pageSize) / $pageSize) + 1;
        $total       = min($maximumPage * $pageSize, $response['pagination']['totalCount'] ?? count($addons));
        return ['data' => $addons, 'total' => $total];
    }
    /**
     * Get versions for a Bedrock addon.
     */
    public function versions(string $addonId): array
    {
        try {
            $response = json_decode(
                $this->client->get('mods/' . $addonId . '/files')->getBody(),
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
    /**
     * Resolve download URL for a Bedrock addon version.
     */
    public function downloadUrl(string $addonId, string $versionId): string
    {
        try {
            $fileResponse = json_decode($this->client->get('mods/' . $addonId . '/files/' . $versionId)->getBody(), true);
            $fileData = $fileResponse['data'] ?? [];
            $fileName = $fileData['fileName'] ?? null;
            $downloadUrl = null;
            try {
                $response = json_decode($this->client->get('mods/' . $addonId . '/files/' . $versionId . '/download-url')->getBody(), true);
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
            logger()->error('Error resolving CurseForge Bedrock download URL', ['addon_id' => $addonId, 'version_id' => $versionId, 'error' => $e->getMessage()]);
            return '';
        }
    }
    protected function getRedirectUrl(string $url): ?string
    {
        try {
            stream_context_set_default([
                'http' => [
                    'method' => 'HEAD',
                ],
            ]);
            $headers = get_headers($url, 1);
            if ($headers !== false && isset($headers['Location'])) {
                return is_array($headers['Location']) ? array_pop($headers['Location']) : $headers['Location'];
            }
        } catch (\Exception $e) {
            logger()->error('Error following redirect for addon download', ['url' => $url, 'error' => $e->getMessage()]);
        }
        return null;
    }
}
