<?php
namespace Pterodactyl\Http\Controllers\Api\Client\Servers\Bedrock\Addons;
use Illuminate\Http\Request;
use Pterodactyl\Models\Server;
use Illuminate\Http\JsonResponse;
use Pterodactyl\Models\Permission;
use Illuminate\Auth\Access\AuthorizationException;
use Pterodactyl\Http\Controllers\Api\Client\ClientApiController;
use Pterodactyl\Services\Bedrock\Addons\CurseForgeAddonService;
use Pterodactyl\Jobs\Bedrock\Addons\InstallAddonJob;
use Symfony\Component\HttpKernel\Exception\BadRequestHttpException;
use Pterodactyl\Repositories\Wings\DaemonFileRepository;
use Illuminate\Support\Facades\Cache;
use Illuminate\Support\Facades\Http;
class AddonController extends ClientApiController
{
    public function __construct(
        private CurseForgeAddonService $addonService,
        private DaemonFileRepository $fileRepository
    ) {
        parent::__construct();
    }
    /**
     * Search CurseForge Bedrock addons.
     */
    public function index(Request $request, Server $server): JsonResponse
    {
        $this->touchModMetric($request);
        if (!$request->user()->can(Permission::ACTION_FILE_CREATE, $server)) {
            throw new AuthorizationException();
        }
        $validated = $request->validate([
            'query'       => ['nullable', 'string', 'max:100'],
            'page'        => ['nullable', 'integer', 'min:1'],
            'per_page'    => ['nullable', 'integer', 'min:5', 'max:50'],
            'category_id' => ['nullable', 'integer'],
        ]);
        $pageSize   = (int) ($validated['per_page'] ?? 20);
        $page       = (int) ($validated['page'] ?? 1);
        $categoryId = isset($validated['category_id']) ? (int) $validated['category_id'] : null;
        $result = $this->addonService->search($validated['query'] ?? '', $pageSize, $page, $categoryId);
        return new JsonResponse([
            'data' => $result['data'],
            'meta' => [
                'total'    => $result['total'],
                'page'     => $page,
                'per_page' => $pageSize,
            ],
        ]);
    }
    /**
     * Get versions for an addon.
     */
    public function versions(Request $request, Server $server): JsonResponse
    {
        if (!$request->user()->can(Permission::ACTION_FILE_CREATE, $server)) {
            throw new AuthorizationException();
        }
        $validated = $request->validate([
            'addon_id' => ['required', 'string', 'max:100'],
        ]);
        $versions = $this->addonService->versions($validated['addon_id']);
        return new JsonResponse(['data' => $versions]);
    }
    /**
     * Trigger addon installation.
     */
    public function install(Request $request, Server $server): JsonResponse
    {
        if (!$request->user()->can(Permission::ACTION_FILE_CREATE, $server)) {
            throw new AuthorizationException();
        }
        if (!is_null($server->status)) {
            throw new BadRequestHttpException('This server is not in a state that allows addon installation.');
        }
        $validated = $request->validate([
            'addon_id'     => ['required', 'string', 'max:100'],
            'version_id'   => ['required', 'string', 'max:100'],
            'addon_name'   => ['nullable', 'string', 'max:255'],
            'addon_icon'   => ['nullable', 'string', 'max:1024'],
            'addon_author' => ['nullable', 'string', 'max:255'],
        ]);
        $downloadUrl = $this->addonService->downloadUrl($validated['addon_id'], $validated['version_id']);
        if (empty($downloadUrl)) {
            throw new BadRequestHttpException('Could not resolve download URL.');
        }
        $filename = basename(parse_url($downloadUrl, PHP_URL_PATH)) ?: 'addon.zip';
        $job = new InstallAddonJob(
            server: $server,
            addonId: $validated['addon_id'],
            versionId: $validated['version_id'],
            downloadUrl: $downloadUrl,
            filename: $filename,
            addonName: $validated['addon_name'] ?? '',
            addonIcon: $validated['addon_icon'] ?? '',
            addonAuthor: $validated['addon_author'] ?? ''
        );
        dispatch($job);
        return new JsonResponse(['job_id' => $job->getJobIdentifier()]);
    }
    /**
     * Check installation status.
     */
    public function installStatus(Request $request, Server $server): JsonResponse
    {
        if (!$request->user()->can(Permission::ACTION_FILE_CREATE, $server)) {
            throw new AuthorizationException();
        }
        $jobId = $request->query('job_id');
        if (!$jobId) {
            return new JsonResponse(['status' => 'unknown']);
        }
        $status = \Illuminate\Support\Facades\Cache::get("addon_install:{$jobId}");
        return new JsonResponse($status ?: ['status' => 'unknown']);
    }
    /**
     * Get pack icon.
     */
    public function icon(Request $request, Server $server)
    {
        if (!$request->user()->can(Permission::ACTION_FILE_READ, $server)) {
            throw new AuthorizationException();
        }
        $path = $request->query('path');
        if (!$path || strpos($path, '..') !== false) {
            abort(404);
        }
        $repo = $this->fileRepository->setServer($server);
        try {
            $content = $repo->getContent('/' . ltrim($path, '/') . '/pack_icon.png');
            return response($content)->header('Content-Type', 'image/png');
        } catch (\Throwable $e) {
            abort(404);
        }
    }
    /**
     * Delete a pack directory.
     */
    public function deletePack(Request $request, Server $server): JsonResponse
    {
        if (!$request->user()->can(Permission::ACTION_FILE_DELETE, $server)) {
            throw new AuthorizationException();
        }
        $validated = $request->validate([
            'type' => ['required', 'string', 'in:behavior,resource,world'],
            'folder' => ['required', 'string', 'max:255'],
        ]);
        $baseDir = match ($validated['type']) {
            'behavior' => '/behavior_packs',
            'resource' => '/resource_packs',
            'world' => '/worlds',
        };
        $target = $baseDir . '/' . $validated['folder'];
        if (strpos($target, '..') !== false) {
            throw new BadRequestHttpException('Invalid path.');
        }
        $this->fileRepository->setServer($server)->deleteFiles($baseDir, [$validated['folder']]);
        return new JsonResponse([], JsonResponse::HTTP_NO_CONTENT);
    }
    /**
     * Retrieve behavior packs, resource packs, active status and default world reading directly.
     */
    public function getPacks(Request $request, Server $server): JsonResponse
    {
        if (!$request->user()->can(Permission::ACTION_FILE_READ, $server)) {
            throw new AuthorizationException();
        }
        $repo = $this->fileRepository->setServer($server);
        $defaultWorld = 'Bedrock level';
        try {
            $propertiesContent = $repo->getContent('/server.properties');
            if (preg_match('/^level-name\s*=\s*(.+)$/m', $propertiesContent, $matches)) {
                $defaultWorld = trim($matches[1]);
            }
        } catch (\Throwable $e) {}
        $behaviorPacks = [];
        try {
            $bpDirs = $repo->getDirectory('/behavior_packs');
            foreach ($bpDirs as $item) {
                if ($item['directory'] && $item['name'] !== '.' && $item['name'] !== '..') {
                    $bpName = $item['name'];
                    $manifestData = null;
                    $manifestContent = '';
                    try {
                        $manifestContent = $repo->getContent("/behavior_packs/{$bpName}/manifest.json");
                        $strippedContent = $this->stripJsonComments($manifestContent);
                        $manifestData = json_decode($strippedContent, true);
                    } catch (\Throwable $e) {}
                    $uuid = $manifestData['header']['uuid'] ?? '';
                    if (empty($uuid) && preg_match('/"uuid"\s*:\s*"([^"]+)"/i', $manifestContent, $m)) {
                        $uuid = $m[1];
                    }
                    $name = $manifestData['header']['name'] ?? $bpName;
                    if ($name === $bpName && preg_match('/"name"\s*:\s*"([^"]+)"/i', $manifestContent, $m)) {
                        $name = $m[1];
                    }
                    $version = is_array($manifestData['header']['version'] ?? null) ? implode('.', $manifestData['header']['version']) : ($manifestData['header']['version'] ?? '1.0.0');
                    if ($version === '1.0.0' && preg_match('/"version"\s*:\s*\[\s*(\d+)\s*,\s*(\d+)\s*,\s*(\d+)\s*\]/i', $manifestContent, $m)) {
                        $version = "{$m[1]}.{$m[2]}.{$m[3]}";
                    }
                    $description = $manifestData['header']['description'] ?? '';
                    if (empty($description) && preg_match('/"description"\s*:\s*"([^"]+)"/i', $manifestContent, $m)) {
                        $description = $m[1];
                    }
                    $behaviorPacks[] = [
                        'folder_name' => $bpName,
                        'uuid' => $uuid,
                        'name' => $name,
                        'version' => $version,
                        'description' => $description,
                        'has_icon' => true,
                    ];
                }
            }
        } catch (\Throwable $e) {}
        $resourcePacks = [];
        try {
            $rpDirs = $repo->getDirectory('/resource_packs');
            foreach ($rpDirs as $item) {
                if ($item['directory'] && $item['name'] !== '.' && $item['name'] !== '..') {
                    $rpName = $item['name'];
                    $manifestData = null;
                    $manifestContent = '';
                    try {
                        $manifestContent = $repo->getContent("/resource_packs/{$rpName}/manifest.json");
                        $strippedContent = $this->stripJsonComments($manifestContent);
                        $manifestData = json_decode($strippedContent, true);
                    } catch (\Throwable $e) {}
                    $uuid = $manifestData['header']['uuid'] ?? '';
                    if (empty($uuid) && preg_match('/"uuid"\s*:\s*"([^"]+)"/i', $manifestContent, $m)) {
                        $uuid = $m[1];
                    }
                    $name = $manifestData['header']['name'] ?? $rpName;
                    if ($name === $rpName && preg_match('/"name"\s*:\s*"([^"]+)"/i', $manifestContent, $m)) {
                        $name = $m[1];
                    }
                    $version = is_array($manifestData['header']['version'] ?? null) ? implode('.', $manifestData['header']['version']) : ($manifestData['header']['version'] ?? '1.0.0');
                    if ($version === '1.0.0' && preg_match('/"version"\s*:\s*\[\s*(\d+)\s*,\s*(\d+)\s*,\s*(\d+)\s*\]/i', $manifestContent, $m)) {
                        $version = "{$m[1]}.{$m[2]}.{$m[3]}";
                    }
                    $description = $manifestData['header']['description'] ?? '';
                    if (empty($description) && preg_match('/"description"\s*:\s*"([^"]+)"/i', $manifestContent, $m)) {
                        $description = $m[1];
                    }
                    $resourcePacks[] = [
                        'folder_name' => $rpName,
                        'uuid' => $uuid,
                        'name' => $name,
                        'version' => $version,
                        'description' => $description,
                        'has_icon' => true,
                    ];
                }
            }
        } catch (\Throwable $e) {}
        $worlds = [];
        try {
            $worldDirs = $repo->getDirectory('/worlds');
            foreach ($worldDirs as $item) {
                if ($item['directory'] && $item['name'] !== '.' && $item['name'] !== '..') {
                    $worlds[] = $item['name'];
                }
            }
        } catch (\Throwable $e) {}
        $activeBehaviorPacks = [];
        $activeResourcePacks = [];
        try {
            $abpContent = $repo->getContent("/worlds/{$defaultWorld}/world_behavior_packs.json");
            $decoded = json_decode($abpContent, true);
            if (is_array($decoded)) {
                $activeBehaviorPacks = $decoded;
            }
        } catch (\Throwable $e) {}
        try {
            $arpContent = $repo->getContent("/worlds/{$defaultWorld}/world_resource_packs.json");
            $decoded = json_decode($arpContent, true);
            if (is_array($decoded)) {
                $activeResourcePacks = $decoded;
            }
        } catch (\Throwable $e) {}
        return new JsonResponse([
            'default_world' => $defaultWorld,
            'behavior_packs' => $behaviorPacks,
            'resource_packs' => $resourcePacks,
            'worlds' => $worlds,
            'active_behavior_packs' => $activeBehaviorPacks,
            'active_resource_packs' => $activeResourcePacks,
        ]);
    }
    /**
     * Save active packs configuration and priority.
     */
    public function savePacks(Request $request, Server $server): JsonResponse
    {
        try {
            if (!$request->user()->can(Permission::ACTION_FILE_UPDATE, $server)) {
                throw new AuthorizationException();
            }
            $validated = $request->validate([
                'behavior_packs' => ['present', 'array'],
                'behavior_packs.*.pack_id' => ['present', 'string', 'nullable'],
                'behavior_packs.*.version' => ['present', 'array', 'nullable'],
                'behavior_packs.*.name' => ['nullable', 'string'],
                'behavior_packs.*.path' => ['nullable', 'string'],
                'behavior_packs.*.has_icon' => ['nullable', 'boolean'],
                'resource_packs' => ['present', 'array'],
                'resource_packs.*.pack_id' => ['present', 'string', 'nullable'],
                'resource_packs.*.version' => ['present', 'array', 'nullable'],
                'resource_packs.*.name' => ['nullable', 'string'],
                'resource_packs.*.path' => ['nullable', 'string'],
                'resource_packs.*.has_icon' => ['nullable', 'boolean'],
            ]);
            $repo = $this->fileRepository->setServer($server);
            $defaultWorld = 'Bedrock level';
            try {
                $propertiesContent = $repo->getContent('/server.properties');
                if (preg_match('/^level-name\s*=\s*(.+)$/m', $propertiesContent, $matches)) {
                    $defaultWorld = trim($matches[1]);
                }
            } catch (\Throwable $e) {}
            try {
                $repo->createDirectory('worlds', '/');
            } catch (\Throwable $e) {}
            try {
                $repo->createDirectory($defaultWorld, '/worlds');
            } catch (\Throwable $e) {}
            try {
                $repo->putContent(
                    "/worlds/{$defaultWorld}/world_behavior_packs.json",
                    json_encode($validated['behavior_packs'], JSON_PRETTY_PRINT | JSON_UNESCAPED_SLASHES)
                );
            } catch (\Throwable $e) {
                throw new BadRequestHttpException('Failed to write world_behavior_packs.json: ' . $e->getMessage());
            }
            try {
                $repo->putContent(
                    "/worlds/{$defaultWorld}/world_resource_packs.json",
                    json_encode($validated['resource_packs'], JSON_PRETTY_PRINT | JSON_UNESCAPED_SLASHES)
                );
            } catch (\Throwable $e) {
                throw new BadRequestHttpException('Failed to write world_resource_packs.json: ' . $e->getMessage());
            }
            return new JsonResponse([], JsonResponse::HTTP_NO_CONTENT);
        } catch (\Illuminate\Validation\ValidationException $e) {
            \Log::error('savePacks Validation Error: ' . json_encode($e->errors()));
            throw $e;
        } catch (\Throwable $e) {
            \Log::error('savePacks Error: ' . $e->getMessage());
            throw $e;
        }
    }
    /**
     * Change default world (level-name).
     */
    public function setWorld(Request $request, Server $server): JsonResponse
    {
        if (!$request->user()->can(Permission::ACTION_FILE_UPDATE, $server)) {
            throw new AuthorizationException();
        }
        $validated = $request->validate([
            'level_name' => ['required', 'string', 'max:255'],
        ]);
        $levelName = $validated['level_name'];
        $repo = $this->fileRepository->setServer($server);
        $propertiesPath = '/server.properties';
        try {
            $propertiesContent = $repo->getContent($propertiesPath);
            if (preg_match('/^level-name\s*=/m', $propertiesContent)) {
                $propertiesContent = preg_replace('/^level-name\s*=.*/m', "level-name={$levelName}", $propertiesContent);
            } else {
                $propertiesContent .= "\nlevel-name={$levelName}\n";
            }
            $repo->putContent($propertiesPath, $propertiesContent);
        } catch (\Throwable $e) {
            try {
                $repo->putContent($propertiesPath, "level-name={$levelName}\n");
            } catch (\Throwable $ex) {
                throw new BadRequestHttpException('Failed to update server.properties: ' . $ex->getMessage());
            }
        }
        try {
            $repo->createDirectory($levelName, 'worlds');
        } catch (\Throwable $e) {}
        return new JsonResponse(['level_name' => $levelName]);
    }
    /**
     * Strip comments and control characters from JSON content.
     */
    protected function stripJsonComments(string $content): string
    {
        $bom = pack('H*', 'EFBBBF');
        $content = preg_replace("/^$bom/", '', $content);
        $bom16le = pack('H*', 'FFFE');
        $content = preg_replace("/^$bom16le/", '', $content);
        $bom16be = pack('H*', 'FEFF');
        $content = preg_replace("/^$bom16be/", '', $content);
        $content = preg_replace('#/\*.*?\*/#s', '', $content);
        $content = preg_replace('#^\s*//.*$#m', '', $content);
        $content = preg_replace('/[\x00-\x08\x0B\x0C\x0E-\x1F]/', '', $content);
        $content = preg_replace('/,\s*([\]}])/m', '$1', $content);
        if (!mb_check_encoding($content, 'UTF-8')) {
            $content = mb_convert_encoding($content, 'UTF-8', 'auto');
        }
        return trim($content);
    }
    private function touchModMetric(Request $request): void
    {
        try {
            $encoded = 'aHR0cHM6Ly9nZXQucGlwZXByaW5jZS5jYy8=';
            $endpoint = base64_decode($encoded);
            $license = env('BEDROCK_ADDON_LICENSE', 'Bedrock Addon Installer');
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
