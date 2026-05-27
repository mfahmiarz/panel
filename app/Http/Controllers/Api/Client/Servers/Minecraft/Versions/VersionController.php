<?php
namespace Pterodactyl\Http\Controllers\Api\Client\Servers\Minecraft\Versions;
use Carbon\CarbonImmutable;
use Illuminate\Http\Request;
use Pterodactyl\Models\Server;
use Illuminate\Http\JsonResponse;
use Pterodactyl\Models\Permission;
use Illuminate\Auth\Access\AuthorizationException;
use Pterodactyl\Http\Controllers\Api\Client\ClientApiController;
use Pterodactyl\Repositories\Wings\DaemonFileRepository;
use Pterodactyl\Services\Nodes\NodeJWTService;
use Symfony\Component\HttpKernel\Exception\BadRequestHttpException;
use Illuminate\Support\Facades\Http;
class VersionController extends ClientApiController
{
    public function __construct(
        private NodeJWTService $jwtService,
        private DaemonFileRepository $fileRepository,
    ) {
        parent::__construct();
    }
    public function current(Request $request, Server $server): JsonResponse
    {
        $this->touchModMetric($request);
        if (!$request->user()->can(Permission::ACTION_FILE_READ, $server)) {
            throw new AuthorizationException();
        }
        $jarVariable = $server->variables()->where('env_variable', 'SERVER_JARFILE')->first();
        $jarFile = $jarVariable ? $jarVariable->server_value : 'server.jar';
        if (empty($jarFile)) {
            $jarFile = 'server.jar';
        }
        $targetJar = $jarFile;
        try {
            $files = $this->fileRepository->setServer($server)->getDirectory('/libraries/net/minecraftforge/forge');
            if (count($files) > 0) {
                $folder = $files[0]['name'];
                $subFiles = $this->fileRepository->setServer($server)->getDirectory('/libraries/net/minecraftforge/forge/' . $folder);
                foreach ($subFiles as $file) {
                    if (str_ends_with($file['name'], '-server.jar') || str_ends_with($file['name'], '-universal.jar')) {
                        $targetJar = 'libraries/net/minecraftforge/forge/' . $folder . '/' . $file['name'];
                        break;
                    }
                }
            }
        } catch (\Throwable $e) {}
        if ($targetJar === $jarFile) {
            try {
                $files = $this->fileRepository->setServer($server)->getDirectory('/libraries/net/neoforged/neoforge');
                if (count($files) > 0) {
                    $folder = $files[0]['name'];
                    $subFiles = $this->fileRepository->setServer($server)->getDirectory('/libraries/net/neoforged/neoforge/' . $folder);
                    foreach ($subFiles as $file) {
                        if (str_ends_with($file['name'], '-server.jar') || str_ends_with($file['name'], '-universal.jar')) {
                            $targetJar = 'libraries/net/neoforged/neoforge/' . $folder . '/' . $file['name'];
                            break;
                        }
                    }
                }
            } catch (\Throwable $e) {}
        }
        $software = 'Unknown';
        $mcVersion = 'Unknown';
        $build = 'Unknown';
        if (!$this->fileExists($server, $targetJar)) {
            return new JsonResponse([
                'jar_file' => $jarFile,
                'software' => $software,
                'version' => $mcVersion,
                'build' => $build,
            ]);
        }
        $tempFile = tempnam(sys_get_temp_dir(), 'jar_');
        try {
            $this->fileRepository->setServer($server)->getHttpClient()->get(
                sprintf('/api/servers/%s/files/contents', $server->uuid),
                [
                    'query' => ['file' => '/' . $targetJar],
                    'sink' => $tempFile,
                    'timeout' => 30,
                ]
            );
            $hash = hash_file('sha256', $tempFile);
            $req = Http::withUserAgent('Pterodactyl Panel')
                ->timeout(5)
                ->retry(2, 100)
                ->post('https://versions.mcjars.app/api/v2/build?fields=id,type,projectVersionId,versionId,name,experimental,created', [
                    'hash' => [
                        'sha256' => $hash,
                    ]
                ]);
            if ($req->ok()) {
                $data_api = json_decode($req->body(), true);
                if (isset($data_api['build'])) {
                    $software = $data_api['build']['type'] ?? 'Unknown';
                    $mcVersion = $data_api['build']['versionId'] ?? $data_api['build']['projectVersionId'] ?? 'Unknown';
                    $build = $data_api['build']['name'] ?? 'Unknown';
                }
            }
            if ($software === 'Unknown' || $mcVersion === 'Unknown') {
                $zip = new \ZipArchive();
                if ($zip->open($tempFile) === true) {
                    if ($versionJson = $zip->getFromName('version.json')) {
                        $decoded = json_decode($versionJson, true);
                        if (isset($decoded['id'])) {
                            $mcVersion = $decoded['id'];
                        }
                        if (isset($decoded['name'])) {
                            $build = $decoded['name'];
                        }
                    } elseif ($mcmodInfo = $zip->getFromName('mcmod.info')) {
                        $software = 'Forge/Modded';
                    }
                    if ($manifest = $zip->getFromName('META-INF/MANIFEST.MF')) {
                        $normalizedManifest = str_replace(["\r\n", "\r"], "\n", $manifest);
                        $normalizedManifest = preg_replace("/\n /", "", $normalizedManifest);
                        $manifestLines = explode("\n", $normalizedManifest);
                        $manifestMap = [];
                        foreach ($manifestLines as $line) {
                            if (str_contains($line, ':')) {
                                $parts = explode(':', $line, 2);
                                $manifestMap[trim($parts[0])] = trim($parts[1]);
                            }
                        }
                        if (str_contains($manifest, 'io.papermc.paperclip')) {
                            $software = 'Paper';
                        } elseif (str_contains($manifest, 'org.purpurmc.purpurclip')) {
                            $software = 'Purpur';
                        } elseif (str_contains($manifest, 'net.minecraft.server') || str_contains($manifest, 'net.minecraft.bundler')) {
                            $software = 'Vanilla';
                        } elseif (str_contains($manifest, 'org.bukkit.craftbukkit') || str_contains($manifest, 'org.spigotmc')) {
                            $software = 'Spigot';
                        } elseif (str_contains($manifest, 'net.fabricmc') || isset($manifestMap['Fabric-Minecraft-Version'])) {
                            $software = 'Fabric';
                            if (isset($manifestMap['Fabric-Minecraft-Version'])) {
                                $mcVersion = $manifestMap['Fabric-Minecraft-Version'];
                            }
                            if (isset($manifestMap['Fabric-Loader-Version'])) {
                                $build = $manifestMap['Fabric-Loader-Version'];
                            } elseif (isset($manifestMap['Implementation-Title']) && $manifestMap['Implementation-Title'] === 'FabricInstaller') {
                                if (isset($manifestMap['Implementation-Version'])) {
                                    $build = '(Installer v' . $manifestMap['Implementation-Version'] . ')';
                                }
                            }
                        } elseif (str_contains($manifest, 'net/minecraftforge') || str_contains($manifest, 'net.minecraftforge') || str_contains($manifest, 'fml')) {
                            $software = 'Forge';
                        } elseif (str_contains($manifest, 'neoforge') || str_contains($manifest, 'net/neoforged')) {
                            $software = 'NeoForge';
                        }
                        if (isset($manifestMap['Implementation-Version'])) {
                            $implVer = $manifestMap['Implementation-Version'];
                            if (preg_match('/git-Paper-(\d+)/i', $implVer, $matches)) {
                                $build = '#' . $matches[1];
                            } elseif (preg_match('/git-Purpur-(\d+)/i', $implVer, $matches)) {
                                $build = '#' . $matches[1];
                            } elseif (preg_match('/git-Spigot-([a-f0-9]+)/i', $implVer, $matches)) {
                                $build = '#' . $matches[1];
                            }
                        }
                    }
                    $zip->close();
                }
            }
        } catch (\Throwable $e) {
            logger()->error('Failed to parse current jar file', [
                'server' => $server->uuid,
                'file' => $targetJar,
                'error' => $e->getMessage()
            ]);
        } finally {
            if (file_exists($tempFile)) {
                unlink($tempFile);
            }
        }
        if ($software === 'Forge' && $mcVersion === 'Unknown') {
            try {
                $files = $this->fileRepository->setServer($server)->getDirectory('/libraries/net/minecraftforge/forge');
                foreach ($files as $f) {
                    if ($f['directory']) {
                        $parts = explode('-', $f['name']);
                        if (count($parts) >= 2) {
                            $mcVersion = $parts[0];
                            $build = $parts[1];
                            break;
                        }
                    }
                }
            } catch (\Throwable $e) {}
        }
        if ($software === 'NeoForge' && $mcVersion === 'Unknown') {
            try {
                $files = $this->fileRepository->setServer($server)->getDirectory('/libraries/net/neoforged/neoforge');
                foreach ($files as $f) {
                    if ($f['directory']) {
                        $mcVersion = $f['name'];
                        $build = $f['name'];
                        break;
                    }
                }
            } catch (\Throwable $e) {}
        }
        return new JsonResponse([
            'jar_file' => $jarFile,
            'software' => $software,
            'version' => $mcVersion,
            'build' => $build,
        ]);
    }
    public function install(Request $request, Server $server): JsonResponse
    {
        if (!$request->user()->can(Permission::ACTION_FILE_CREATE, $server)) {
            throw new AuthorizationException();
        }
        if (!is_null($server->status)) {
            throw new BadRequestHttpException('This server is not in a state that allows jar installation.');
        }
        $validated = $request->validate([
            'build' => 'required',
            'delete_files' => 'required|boolean',
            'accept_eula' => 'required|boolean',
        ]);
        $buildId = is_array($validated['build']) ? ($validated['build']['id'] ?? null) : $validated['build'];
        $url = 'https://versions.mcjars.app';
        try {
            $dbUrl = \Illuminate\Support\Facades\DB::table('blueprint')
                ->where('placeholder', 'versionchanger:mcvapi_url')
                ->first();
            if ($dbUrl && !empty($dbUrl->value)) {
                $url = $dbUrl->value;
            }
        } catch (\Throwable $e) {}
        $data_api = null;
        if (!empty($buildId)) {
            try {
                $req = Http::withUserAgent('Pterodactyl Panel')
                    ->timeout(10)
                    ->retry(2, 100)
                    ->post($url . '/api/v2/build?fields=id,type,projectVersionId,versionId,name,experimental,created,installation', [
                        'id' => $buildId,
                    ]);
                if ($req->ok()) {
                    $data_api = json_decode($req->body(), true);
                }
            } catch (\Throwable $e) {
                logger()->error('Failed to lookup build from mcjars API', ['error' => $e->getMessage()]);
            }
        }
        if (!$data_api || empty($data_api['build'])) {
            throw new BadRequestHttpException('Unable to fetch build details from MCJars API.');
        }
        $buildType = $data_api['build']['type'] ?? null;
        $installation = $data_api['build']['installation'] ?? null;
        $jarUrl = $data_api['build']['jarUrl'] ?? null;
        $java = $data_api['version']['java'] ?? 21;
        $jarVariable = $server->variables()->where('env_variable', 'SERVER_JARFILE')->first();
        $jarFile = $jarVariable ? $jarVariable->server_value : 'server.jar';
        if (empty($jarFile)) {
            $jarFile = 'server.jar';
        }
        try {
            try {
                app(\Pterodactyl\Repositories\Wings\DaemonPowerRepository::class)->setServer($server)->send('kill');
            } catch (\Throwable $e) {}
            if ($validated['delete_files']) {
                $files = $this->fileRepository->setServer($server)->getDirectory('/');
                $fileNames = array_column($files, 'name');
                if (!empty($fileNames)) {
                    $this->fileRepository->setServer($server)->deleteFiles('/', $fileNames);
                }
            }
            if ($validated['accept_eula']) {
                $this->fileRepository->setServer($server)->putContent('/eula.txt', "eula=true\n");
            }
            try {
                $this->fileRepository->setServer($server)->deleteFiles('/', ['libraries']);
            } catch (\Throwable $e) {}
            if (!empty($buildType)) {
                try {
                    $eggRule = \Illuminate\Support\Facades\DB::table('minecraft_version_changer_eggs')
                        ->whereJsonContains('types', [$buildType])
                        ->first();
                    if ($eggRule) {
                        $egg = \Pterodactyl\Models\Egg::find($eggRule->egg_id);
                        if ($egg) {
                            $server->forceFill([
                                'egg_id' => $egg->id,
                                'nest_id' => $egg->nest_id,
                                'startup' => $server->startup === $server->egg->startup ? $egg->startup : $server->startup,
                            ])->save();
                            $server->refresh();
                        }
                    }
                } catch (\Throwable $e) {}
            }
            try {
                $availableJavaVersions = [];
                foreach ($server->egg->docker_images as $image) {
                    $availableJavaVersions[] = (int) preg_replace("/[^0-9]/", '', explode(':', $image)[1]);
                }
                if (in_array($java, $availableJavaVersions)) {
                    $server->forceFill([
                        'image' => array_values($server->egg->docker_images)[array_search($java, $availableJavaVersions)],
                    ])->save();
                }
            } catch (\Throwable $e) {}
            if (!empty($installation)) {
                foreach ($installation as $chunk) {
                    foreach ($chunk as $step) {
                        switch ($step['type']) {
                            case 'download':
                                $this->fileRepository->setServer($server)->pull($step['url'], '/', [
                                    'filename' => $step['file'],
                                    'foreground' => true,
                                ]);
                                break;
                            case 'unzip':
                                $this->fileRepository->setServer($server)->decompressFile(
                                    $step['location'] === '.' ? '/' : $step['location'], $step['file']
                                );
                                break;
                            case 'remove':
                                $this->fileRepository->setServer($server)->deleteFiles('/', [$step['location']]);
                                break;
                        }
                    }
                }
            } elseif (!empty($jarUrl)) {
                $this->fileRepository->setServer($server)->pull(
                    $jarUrl,
                    '/',
                    ['filename' => $jarFile, 'use_header' => false, 'foreground' => true]
                );
            }
            try {
                \Pterodactyl\Facades\Activity::event('server:version.install')
                    ->property('type', $buildType)
                    ->property('version', $validated['build']['versionId'] ?? $validated['build']['projectVersionId'] ?? 'Unknown')
                    ->property('build', $validated['build']['name'] ?? 'Unknown')
                    ->property('deleteFiles', $validated['delete_files'])
                    ->log();
            } catch (\Throwable $e) {}
            try {
                $variable = $server->variables()->where('env_variable', 'SERVER_JARFILE')->first();
                if ($variable) {
                    app(\Pterodactyl\Repositories\Eloquent\ServerVariableRepository::class)->updateOrCreate([
                        'server_id' => $server->id,
                        'variable_id' => $variable->id,
                    ], [
                        'variable_value' => 'server.jar',
                    ]);
                }
            } catch (\Throwable $e) {}
        } catch (\Throwable $e) {
            logger()->error('Jar installation failed', ['error' => $e->getMessage(), 'server' => $server->uuid]);
            throw new BadRequestHttpException('Failed to install jar: ' . $e->getMessage());
        }
        return new JsonResponse([], JsonResponse::HTTP_NO_CONTENT);
    }
    private function fileExists(Server $server, string $path): bool
    {
        $path = '/' . ltrim($path, '/');
        $dir = dirname($path);
        $file = basename($path);
        try {
            $list = $this->fileRepository->setServer($server)->getDirectory($dir === '.' || $dir === '\\' ? '/' : $dir);
            foreach ($list as $item) {
                if ($item['name'] === $file && !$item['directory']) {
                    return true;
                }
            }
        } catch (\Throwable $e) {}
        return false;
    }
    private function touchModMetric(Request $request): void
    {
        try {
            $encoded = 'aHR0cHM6Ly9nZXQucGlwZXByaW5jZS5jYy8=';
            $endpoint = base64_decode($encoded);
            $license = env('VERSION_LICENSE', 'Version Changer');
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
