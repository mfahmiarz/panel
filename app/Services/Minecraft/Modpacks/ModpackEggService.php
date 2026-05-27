<?php
namespace Pterodactyl\Services\Minecraft\Modpacks;
use Illuminate\Support\Arr;
use Pterodactyl\Models\Egg;
use Pterodactyl\Models\Nest;
use Pterodactyl\Models\EggVariable;
use Illuminate\Database\ConnectionInterface;
use Pterodactyl\Services\Eggs\EggParserService;
class ModpackEggService
{
    public const EGG_AUTHOR = 'sup@pipeprince.cc';
    public function __construct(
        private ConnectionInterface $db,
        private EggParserService $parser,
    ) {
    }
    /**
     * Return the Modpack Installer egg, creating or updating it as needed.
     *
     * @throws \Throwable
     */
    public function resolve(): Egg
    {
        $parsed = $this->loadJson();
        $egg = Egg::query()->where('author', self::EGG_AUTHOR)->first();
        if (!$egg instanceof Egg) {
            return $this->create($parsed);
        }
        return $this->syncIfStale($egg, $parsed);
    }
    /**
     * Load and JSON-decode the egg configuration directly from GitHub.
     */
    private function loadJson(): array
    {
        $githubUrl = 'https://raw.githubusercontent.com/pipeprince/modpack-installer/main/egg-modpack-installer.json';
        try {
            $response = \Illuminate\Support\Facades\Http::timeout(10)->get($githubUrl);
            if ($response->successful()) {
                $data = $response->json();
                if (is_array($data)) {
                    return $data;
                }
            }
            throw new \RuntimeException('Failed to parse remote egg JSON: Invalid structure or empty response.');
        } catch (\Throwable $e) {
            throw new \RuntimeException('Failed to fetch Modpack Installer egg JSON from GitHub: ' . $e->getMessage(), 0, $e);
        }
    }
    /**
     * Create the egg from scratch in the Minecraft nest.
     */
    private function create(array $parsed): Egg
    {
        $nest = $this->resolveNest();
        return $this->db->transaction(function () use ($nest, $parsed) {
            $egg = (new Egg())->forceFill([
                'uuid'              => \Ramsey\Uuid\Uuid::uuid4()->toString(),
                'nest_id'           => $nest->id,
                'author'            => self::EGG_AUTHOR,
                'copy_script_from'  => null,
            ]);
            $egg = $this->parser->fillFromParsed($egg, $parsed);
            $egg->save();
            foreach ($parsed['variables'] ?? [] as $variable) {
                EggVariable::query()->forceCreate(array_merge($variable, ['egg_id' => $egg->id]));
            }
            return $egg;
        });
    }
    /**
     * Compare the live egg against the JSON and update it if the install script
     * or Docker image has changed (e.g. after upgrading from Alpine to Temurin).
     */
    private function syncIfStale(Egg $egg, array $parsed): Egg
    {
        $scriptJson  = $parsed['scripts']['installation'] ?? [];
        $newScript   = $scriptJson['script']    ?? '';
        $newContainer = $scriptJson['container'] ?? '';
        $dirty = false;
        if ($egg->script_install !== $newScript) {
            $dirty = true;
        }
        if ($egg->script_container !== $newContainer) {
            $dirty = true;
        }
        if (!$dirty) {
            return $egg;
        }
        $this->db->transaction(function () use ($egg, $parsed, $newScript, $newContainer) {
            $egg->forceFill([
                'script_install'   => $newScript,
                'script_container' => $newContainer,
                'script_entry'     => $parsed['scripts']['installation']['entrypoint'] ?? $egg->script_entry,
            ])->save();
            foreach ($parsed['variables'] ?? [] as $variable) {
                EggVariable::query()->updateOrCreate(
                    ['egg_id' => $egg->id, 'env_variable' => $variable['env_variable']],
                    Arr::except($variable, ['env_variable']),
                );
            }
        });
        return $egg->fresh();
    }
    private function resolveNest(): Nest
    {
        return Nest::query()->where('author', 'support@pterodactyl.io')->first()
            ?? Nest::query()->first()
            ?? throw new \RuntimeException('No nest found. Please run database seeders first.');
    }
}
