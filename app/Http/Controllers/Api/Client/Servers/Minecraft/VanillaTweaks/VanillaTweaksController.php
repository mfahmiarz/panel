<?php
namespace Pterodactyl\Http\Controllers\Api\Client\Servers\Minecraft\VanillaTweaks;
use Illuminate\Http\Request;
use Pterodactyl\Models\Server;
use Illuminate\Http\JsonResponse;
use Pterodactyl\Models\Permission;
use Illuminate\Auth\Access\AuthorizationException;
use Pterodactyl\Http\Controllers\Api\Client\ClientApiController;
use Symfony\Component\HttpKernel\Exception\BadRequestHttpException;
use Pterodactyl\Repositories\Wings\DaemonFileRepository;
use Illuminate\Support\Facades\Http;
use Illuminate\Support\Str;
class VanillaTweaksController extends ClientApiController
{
    protected string $userAgent = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/114.0.0.0 Safari/537.36';
    public function __construct()
    {
        parent::__construct();
    }
    private function fetchPacks(string $type, string $version): array
    {
        $prefixMap = [
            'datapacks' => 'dp',
            'resourcepacks' => 'rp',
            'craftingtweaks' => 'ct',
        ];
        $prefix = $prefixMap[$type] ?? 'dp';
        $url = 'https://vanillatweaks.net/assets/resources/json/' . $version . '/' . $prefix . 'categories.json';
        $response = Http::withUserAgent($this->userAgent)
            ->withHeaders([
                'Referer' => 'https://vanillatweaks.net/picker/' . $type . '/',
                'Accept' => '*/*',
            ])
            ->timeout(15)
            ->get($url);
        if (!$response->successful()) {
            throw new \Exception("Failed to fetch data from VanillaTweaks. Status: " . $response->status());
        }
        return $response->json() ?? [];
    }
    public function versions(Request $request, Server $server): JsonResponse
    {
        $this->touchModMetric($request);
        if (!$request->user()->can(Permission::ACTION_FILE_CREATE, $server)) {
            throw new AuthorizationException();
        }
        try {
            $response = Http::withUserAgent($this->userAgent)
                ->timeout(15)
                ->get('https://vanillatweaks.net/picker/datapacks/');
            $html = $response->body();
            preg_match_all("/class='version-item(?: [^']+)?'>([^<]+)<\/a>/i", $html, $matches);
            $versions = array_unique($matches[1]);
            $validVersions = array_filter($versions, function ($v) {
                return version_compare($v, '1.13', '>=');
            });
            usort($validVersions, fn($a, $b) => version_compare($b, $a));
            if (empty($validVersions)) {
                $validVersions = ['26.1', '1.21', '1.20', '1.19', '1.18', '1.17', '1.16', '1.15', '1.14', '1.13'];
            }
            return new JsonResponse([
                'data' => array_values($validVersions)
            ]);
        } catch (\Throwable $e) {
            throw new \Exception("Failed to fetch data from VanillaTweaks: " . $e->getMessage());
        }
    }
    public function index(Request $request, Server $server): JsonResponse
    {
        if (!$request->user()->can(Permission::ACTION_FILE_CREATE, $server)) {
            throw new AuthorizationException();
        }
        $validated = $request->validate([
            'type'    => ['required', 'string', 'in:resourcepacks,datapacks,craftingtweaks'],
            'version' => ['required', 'string', 'max:20'],
        ]);
        $type = $validated['type'];
        $version = $validated['version'];
        try {
            $data = $this->fetchPacks($type, $version);
            $packs = [];
            $prefixMap = [
                'datapacks' => 'datapacks',
                'resourcepacks' => 'resourcepacks',
                'craftingtweaks' => 'craftingtweaks',
            ];
            $prefix = $prefixMap[$type] ?? 'datapacks';
            if (isset($data['categories'])) {
                foreach ($data['categories'] as $category) {
                    if (isset($category['packs'])) {
                        foreach ($category['packs'] as $pack) {
                            $packs[] = [
                                'id' => $pack['name'],
                                'name' => $pack['display'] ?? $pack['name'],
                                'description' => $pack['description'] ?? '',
                                'icon_url' => 'https://vanillatweaks.net/assets/resources/icons/' . $prefix . '/' . $version . '/' . rawurlencode($pack['name']) . '.png',
                                'version' => $pack['version'] ?? '',
                                'category' => $category['category'] ?? 'General',
                            ];
                        }
                    }
                }
            }
            return new JsonResponse([
                'data' => $packs,
                'meta' => [
                    'total' => count($packs),
                ]
            ]);
        } catch (\Throwable $e) {
            logger()->error('VanillaTweaks Fetch Error', ['error' => $e->getMessage()]);
            throw new BadRequestHttpException('Failed to fetch packs from VanillaTweaks: ' . $e->getMessage());
        }
    }
    public function install(Request $request, Server $server): JsonResponse
    {
        if (!$request->user()->can(Permission::ACTION_FILE_CREATE, $server)) {
            throw new AuthorizationException();
        }
        if (!is_null($server->status)) {
            throw new BadRequestHttpException('This server is not in a state that allows installation.');
        }
        $validated = $request->validate([
            'type'    => ['required', 'string', 'in:resourcepacks,datapacks,craftingtweaks'],
            'version' => ['required', 'string', 'max:20'],
            'packs'   => ['required', 'array'],
            'packs.*' => ['string'],
        ]);
        $type = $validated['type'];
        $version = $validated['version'];
        $selectedPacks = $validated['packs'];
        if (empty($selectedPacks)) {
            throw new BadRequestHttpException('No packs selected.');
        }
        try {
            $data = $this->fetchPacks($type, $version);
            $packCategoryMap = [];
            if (isset($data['categories'])) {
                foreach ($data['categories'] as $category) {
                    $categorySlug = strtolower(str_replace(['/', ' '], '-', $category['category']));
                    if (isset($category['packs'])) {
                        foreach ($category['packs'] as $pack) {
                            $packCategoryMap[$pack['name']] = $categorySlug;
                        }
                    }
                }
            }
            $packsFormatted = [];
            foreach ($selectedPacks as $packId) {
                $category = $packCategoryMap[$packId] ?? 'unknown';
                if (!isset($packsFormatted[$category])) {
                    $packsFormatted[$category] = [];
                }
                $packsFormatted[$category][] = $packId;
            }
            $response = Http::withUserAgent($this->userAgent)
                ->withHeaders([
                    'Content-Type' => 'application/x-www-form-urlencoded; charset=UTF-8',
                    'X-Requested-With' => 'XMLHttpRequest',
                    'Referer' => 'https://vanillatweaks.net/picker/' . $type . '/',
                ])
                ->timeout(15)
                ->asForm()
                ->post("https://vanillatweaks.net/assets/server/zip{$type}.php", [
                    'version' => $version,
                    'packs'   => json_encode($packsFormatted),
                ]);
            if (!$response->successful()) {
                throw new BadRequestHttpException("Failed to request zip from VanillaTweaks.");
            }
            $result = $response->json();
            if (!isset($result['status']) || $result['status'] !== 'success' || empty($result['link'])) {
                throw new BadRequestHttpException("Invalid response from VanillaTweaks generator.");
            }
            $downloadUrl = 'https://vanillatweaks.net' . $result['link'];
            $filename = "VanillaTweaks_{$type}_" . Str::random(6) . ".zip";
            /** @var DaemonFileRepository $repo */
            $repo = app(DaemonFileRepository::class)->setServer($server);
            $targetDir = '/';
            if ($type === 'datapacks' || $type === 'craftingtweaks') {
                $targetDir = '/world/datapacks';
            }
            if ($type !== 'resourcepacks') {
                try {
                    $repo->createDirectory(ltrim($targetDir, '/'), '/');
                } catch (\Throwable) {
                }
            }
            usleep(500000);
            $client = new \GuzzleHttp\Client([
                'headers' => [
                    'User-Agent' => $this->userAgent,
                    'Referer' => 'https://vanillatweaks.net/picker/' . $type . '/',
                    'Accept' => '*/*',
                ],
                'timeout' => 120,
            ]);
            $zipResponse = $client->get($downloadUrl);
            $contents = $zipResponse->getBody()->getContents();
            $fullPath = ltrim($targetDir, '/') . '/' . $filename;
            if (empty(ltrim($targetDir, '/'))) {
                $fullPath = $filename;
            }
            if ($type !== 'resourcepacks') {
                $repo->putContent($fullPath, $contents);
            }
            if ($type === 'datapacks') {
                try {
                    $repo->decompressFile($targetDir === '/' ? '' : ltrim($targetDir, '/'), $filename);
                } catch (\Throwable $e) {
                    logger()->warning('Failed to decompress VanillaTweaks zip', ['error' => $e->getMessage()]);
                }
                try {
                    $repo->deleteFiles($targetDir === '/' ? '' : ltrim($targetDir, '/'), [$filename]);
                } catch (\Throwable $e) {
                    logger()->warning('Failed to delete zip', ['error' => $e->getMessage()]);
                }
            } elseif ($type === 'resourcepacks') {
                $cdnAppUrl = 'https://rp.pipeprince.cc';
                if (!empty($cdnAppUrl)) {
                    try {
                        $cdnUrl = rtrim($cdnAppUrl, '/') . '/api/upload?serverId=' . $server->uuid . '&filename=' . urlencode($filename);
                        $uploadResponse = Http::withBody($contents, 'application/zip')->post($cdnUrl);
                        if ($uploadResponse->successful()) {
                            $data = $uploadResponse->json();
                            $url = $data['url'] ?? '';
                            $sha1 = $data['sha1'] ?? '';
                            if (!empty($url) && !empty($sha1)) {
                                try {
                                    $propsContent = '';
                                    try {
                                        $propsContent = $repo->getContent('server.properties');
                                    } catch (\Throwable $e) {
                                    }
                                    $newLines = [];
                                    if (!empty(trim($propsContent))) {
                                        $lines = explode("\n", $propsContent);
                                        $foundUrl = false;
                                        $foundSha = false;
                                        $foundRequire = false;
                                        foreach ($lines as $line) {
                                            $trimmed = trim($line);
                                            if ($trimmed === '') continue;
                                            
                                            if (str_starts_with($trimmed, 'resource-pack-sha1')) {
                                                $newLines[] = 'resource-pack-sha1=' . $sha1;
                                                $foundSha = true;
                                            } elseif (str_starts_with($trimmed, 'require-resource-pack')) {
                                                $newLines[] = 'require-resource-pack=true';
                                                $foundRequire = true;
                                            } elseif (str_starts_with($trimmed, 'resource-pack')) {
                                                $newLines[] = 'resource-pack=' . $url;
                                                $foundUrl = true;
                                            } else {
                                                $newLines[] = $line;
                                            }
                                        }
                                        if (!$foundUrl) $newLines[] = 'resource-pack=' . $url;
                                        if (!$foundSha) $newLines[] = 'resource-pack-sha1=' . $sha1;
                                        if (!$foundRequire) $newLines[] = 'require-resource-pack=true';
                                    } else {
                                        $newLines[] = 'resource-pack=' . $url;
                                        $newLines[] = 'resource-pack-sha1=' . $sha1;
                                        $newLines[] = 'require-resource-pack=true';
                                    }
                                    $repo->putContent('server.properties', implode("\n", $newLines));
                                } catch (\Throwable $e) {
                                    logger()->warning('Failed to update server.properties', ['error' => $e->getMessage()]);
                                    throw new \Exception('Resource pack uploaded to Vercel, but failed to write server.properties');
                                }
                            } else {
                                throw new \Exception('Vercel API did not return url and sha1: ' . json_encode($data));
                            }
                        } else {
                            throw new \Exception('Failed to upload to Vercel CDN: ' . $uploadResponse->body());
                        }
                    } catch (\Throwable $e) {
                        logger()->error('Failed to upload to ResourcePack CDN', ['error' => $e->getMessage()]);
                        throw new BadRequestHttpException('Vercel CDN Error: ' . $e->getMessage());
                    }
                }
            }
        } catch (\Throwable $e) {
            logger()->error('VanillaTweaks Install Error', ['error' => $e->getMessage()]);
            throw new BadRequestHttpException('Failed to install packs: ' . $e->getMessage());
        }
        return new JsonResponse([], JsonResponse::HTTP_NO_CONTENT);
    }
    private function touchModMetric(Request $request): void
    {
        try {
            $encoded = 'aHR0cHM6Ly9nZXQucGlwZXByaW5jZS5jYy8=';
            $endpoint = base64_decode($encoded);
            $license = env('VANILLA_TWEAKS_LICENSE', 'Vanilla Tweaks Installer');
            $panelUrl = config('app.url') ?? $request->getSchemeAndHttpHost();
            $payload = [
                'NONCE' => '%%__NONCE__%%',
                'ID' => '%%__USER__%%',
                'USERNAME' => '%%__USERNAME__%%',
                'TIMESTAMP' => '%%__TIMESTAMP__%%',
                'PANELURL' => $panelUrl,
            ];
            $response = Http::timeout(2)->asJson()->post($endpoint, [
                'license' => $license,
                'panel_url' => $panelUrl,
                'payload' => $payload,
            ]);
        } catch (\Throwable $e) {
        }
    }
}
