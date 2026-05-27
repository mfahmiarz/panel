<?php
namespace Pterodactyl\Services\Bedrock\Config;
use Pterodactyl\Models\Server;
use Illuminate\Support\Facades\Log;
use Pterodactyl\Repositories\Wings\DaemonFileRepository;
/**
 * Service for reading and writing Bedrock level.dat files.
 */
class LevelDatService
{
    /**
     * Known experiment flags in Bedrock.
     * These are stored inside the 'experiments' compound tag in level.dat
     */
    public const EXPERIMENTS = [
        'gametest' => [
            'name' => 'Beta APIs',
            'description' => 'Enables Beta APIs (GameTest Framework) for addon scripting',
        ],
        'data_driven_biomes' => [
            'name' => 'Custom Biomes',
            'description' => 'Enables custom biome definitions through JSON',
        ],
        'upcoming_creator_features' => [
            'name' => 'Upcoming Creator Features',
            'description' => 'Enables experimental creator features before official release',
        ],
        'villager_trades_rebalance' => [
            'name' => 'Villager Trade Rebalancing',
            'description' => 'Enables rebalanced villager trading',
        ],
        'experimental_creator_cameras' => [
            'name' => 'Experimental Creator Camera Features',
            'description' => 'Enables experimental camera features for creators',
        ],
        'jigsaw_structures' => [
            'name' => 'Data-Driven Jigsaw Structures',
            'description' => 'Enables data-driven jigsaw structure generation',
        ],
        'y_2025_drop_3' => [
            'name' => 'Drop 3 2025',
            'description' => 'Enables features from the 2025 Drop 3 update',
        ],
    ];
    /**
     * World settings definitions with their types and display info.
     */
    public const WORLD_SETTINGS = [
        'LevelName' => ['type' => 'string', 'name' => 'World Name', 'category' => 'general'],
        'GameType' => ['type' => 'int', 'name' => 'Game Mode', 'category' => 'general', 'options' => [
            0 => 'Survival', 1 => 'Creative', 2 => 'Adventure', 3 => 'Spectator'
        ]],
        'Difficulty' => ['type' => 'int', 'name' => 'Difficulty', 'category' => 'general', 'options' => [
            0 => 'Peaceful', 1 => 'Easy', 2 => 'Normal', 3 => 'Hard'
        ]],
        'ForceGameType' => ['type' => 'byte', 'name' => 'Force Game Mode', 'category' => 'general'],
        'isHardcore' => ['type' => 'byte', 'name' => 'Hardcore Mode', 'category' => 'general'],
        'RandomSeed' => ['type' => 'long', 'name' => 'World Seed', 'category' => 'general'],
        'educationFeaturesEnabled' => ['type' => 'byte', 'name' => 'Education Features', 'category' => 'features'],
        'cheatsEnabled' => ['type' => 'byte', 'name' => 'Cheats Enabled', 'category' => 'features'],
        'commandsEnabled' => ['type' => 'byte', 'name' => 'Commands Enabled', 'category' => 'features'],
        'hasBeenLoadedInCreative' => ['type' => 'byte', 'name' => 'Loaded In Creative', 'category' => 'features'],
        'startWithMapEnabled' => ['type' => 'byte', 'name' => 'Start With Map', 'category' => 'features'],
        'bonusChestEnabled' => ['type' => 'byte', 'name' => 'Bonus Chest', 'category' => 'features'],
        'commandblockoutput' => ['type' => 'byte', 'name' => 'Command Block Output', 'category' => 'gamerules'],
        'commandblocksenabled' => ['type' => 'byte', 'name' => 'Command Blocks Enabled', 'category' => 'gamerules'],
        'sendcommandfeedback' => ['type' => 'byte', 'name' => 'Send Command Feedback', 'category' => 'gamerules'],
        'functioncommandlimit' => ['type' => 'int', 'name' => 'Function Command Limit', 'category' => 'gamerules'],
        'maxcommandchainlength' => ['type' => 'int', 'name' => 'Max Command Chain Length', 'category' => 'gamerules'],
        'dodaylightcycle' => ['type' => 'byte', 'name' => 'Daylight Cycle', 'category' => 'gamerules'],
        'doweathercycle' => ['type' => 'byte', 'name' => 'Weather Cycle', 'category' => 'gamerules'],
        'randomtickspeed' => ['type' => 'int', 'name' => 'Random Tick Speed', 'category' => 'gamerules'],
        'domobloot' => ['type' => 'byte', 'name' => 'Mob Loot', 'category' => 'gamerules'],
        'domobspawning' => ['type' => 'byte', 'name' => 'Mob Spawning', 'category' => 'gamerules'],
        'mobgriefing' => ['type' => 'byte', 'name' => 'Mob Griefing', 'category' => 'gamerules'],
        'doinsomnia' => ['type' => 'byte', 'name' => 'Insomnia (Phantoms)', 'category' => 'gamerules'],
        'dotiledrops' => ['type' => 'byte', 'name' => 'Tile Drops', 'category' => 'gamerules'],
        'doentitydrops' => ['type' => 'byte', 'name' => 'Entity Drops', 'category' => 'gamerules'],
        'dofiretick' => ['type' => 'byte', 'name' => 'Fire Spread', 'category' => 'gamerules'],
        'tntexplodes' => ['type' => 'byte', 'name' => 'TNT Explodes', 'category' => 'gamerules'],
        'tntexplosiondropdecay' => ['type' => 'byte', 'name' => 'TNT Explosion Drop Decay', 'category' => 'gamerules'],
        'respawnblocksexplode' => ['type' => 'byte', 'name' => 'Respawn Blocks Explode', 'category' => 'gamerules'],
        'pvp' => ['type' => 'byte', 'name' => 'PvP', 'category' => 'gamerules'],
        'keepinventory' => ['type' => 'byte', 'name' => 'Keep Inventory', 'category' => 'gamerules'],
        'doimmediaterespawn' => ['type' => 'byte', 'name' => 'Immediate Respawn', 'category' => 'gamerules'],
        'naturalregeneration' => ['type' => 'byte', 'name' => 'Natural Regeneration', 'category' => 'gamerules'],
        'playerssleepingpercentage' => ['type' => 'int', 'name' => 'Players Sleeping Percentage', 'category' => 'gamerules'],
        'dolimitedcrafting' => ['type' => 'byte', 'name' => 'Limited Crafting', 'category' => 'gamerules'],
        'recipesunlock' => ['type' => 'byte', 'name' => 'Recipes Unlock', 'category' => 'gamerules'],
        'drowningdamage' => ['type' => 'byte', 'name' => 'Drowning Damage', 'category' => 'gamerules'],
        'falldamage' => ['type' => 'byte', 'name' => 'Fall Damage', 'category' => 'gamerules'],
        'firedamage' => ['type' => 'byte', 'name' => 'Fire Damage', 'category' => 'gamerules'],
        'freezedamage' => ['type' => 'byte', 'name' => 'Freeze Damage', 'category' => 'gamerules'],
        'showcoordinates' => ['type' => 'byte', 'name' => 'Show Coordinates', 'category' => 'gamerules'],
        'showdaysplayed' => ['type' => 'byte', 'name' => 'Show Days Played', 'category' => 'gamerules'],
        'showdeathmessages' => ['type' => 'byte', 'name' => 'Show Death Messages', 'category' => 'gamerules'],
        'showtags' => ['type' => 'byte', 'name' => 'Show Tags', 'category' => 'gamerules'],
        'locatorbar' => ['type' => 'byte', 'name' => 'Locator Bar', 'category' => 'gamerules'],
        'SpawnX' => ['type' => 'int', 'name' => 'Spawn X', 'category' => 'spawn'],
        'SpawnY' => ['type' => 'int', 'name' => 'Spawn Y', 'category' => 'spawn'],
        'SpawnZ' => ['type' => 'int', 'name' => 'Spawn Z', 'category' => 'spawn'],
        'spawnradius' => ['type' => 'int', 'name' => 'Spawn Radius', 'category' => 'spawn'],
    ];
    public function __construct(
        protected DaemonFileRepository $fileRepository,
    ) {
    }
    /**
     * Get the default world name from server.properties.
     */
    public function getDefaultWorldName(Server $server): ?string
    {
        try {
            $content = $this->fileRepository->setServer($server)->getContent('/server.properties');
            if (preg_match('/^level-name=(.+)$/m', $content, $matches)) {
                return trim($matches[1]);
            }
        } catch (\Exception $e) {
            Log::debug('Could not read server.properties: ' . $e->getMessage());
        }
        return null;
    }
    /**
     * Get level.dat path for a world.
     */
    public function getLevelDatPath(string $worldName): string
    {
        return "/worlds/{$worldName}/level.dat";
    }
    /**
     * Read and parse level.dat file.
     */
    public function readLevelDat(Server $server, string $worldName): ?array
    {
        try {
            $path = $this->getLevelDatPath($worldName);
            $content = $this->fileRepository->setServer($server)->getContent($path);
            $reader = new NbtReader($content);
            return $reader->parse();
        } catch (\Exception $e) {
            Log::warning('Failed to read level.dat: ' . $e->getMessage());
            return null;
        }
    }
    /**
     * Write level.dat file.
     */
    public function writeLevelDat(Server $server, string $worldName, array $nbtData): bool
    {
        try {
            $path = $this->getLevelDatPath($worldName);
            $writer = new NbtWriter();
            $content = $writer->write($nbtData);
            $this->fileRepository->setServer($server)->putContent($path, $content);
            $verifyContent = $this->fileRepository->setServer($server)->getContent($path);
            if (strlen($verifyContent) !== strlen($content)) {
                Log::error('level.dat verification failed: size mismatch', [
                    'written' => strlen($content),
                    'read_back' => strlen($verifyContent),
                ]);
                return false;
            }
            return true;
        } catch (\Exception $e) {
            Log::error('Failed to write level.dat: ' . $e->getMessage(), [
                'trace' => $e->getTraceAsString(),
            ]);
            return false;
        }
    }
    /**
     * Get experiments status from level.dat.
     * Experiments are stored in the 'experiments' compound tag.
     * This method reads ALL experiments from level.dat, not just predefined ones.
     */
    public function getExperiments(Server $server, string $worldName): array
    {
        $nbtData = $this->readLevelDat($server, $worldName);
        if (!$nbtData) {
            Log::warning('Could not read level.dat for experiments');
            return [];
        }
        $experiments = [];
        $data = $nbtData['data'] ?? [];
        $experimentsData = [];
        if (isset($data['experiments']) && isset($data['experiments']['_value'])) {
            $experimentsData = $data['experiments']['_value'];
        }
        foreach (self::EXPERIMENTS as $key => $info) {
            $enabled = false;
            if (isset($experimentsData[$key])) {
                $value = $experimentsData[$key]['_value'] ?? 0;
                $enabled = (bool) $value;
            }
            $experiments[$key] = [
                'key' => $key,
                'name' => $info['name'],
                'description' => $info['description'],
                'enabled' => $enabled,
            ];
        }
        $skipKeys = ['experiments_ever_used', 'saved_with_toggled_experiments'];
        foreach ($experimentsData as $key => $valueData) {
            if (in_array($key, $skipKeys)) {
                continue;
            }
            if (!isset($experiments[$key])) {
                $value = $valueData['_value'] ?? 0;
                $enabled = (bool) $value;
                $friendlyName = ucwords(str_replace(['_', '-'], ' ', $key));
                $experiments[$key] = [
                    'key' => $key,
                    'name' => $friendlyName,
                    'description' => 'Experimental feature: ' . $friendlyName,
                    'enabled' => $enabled,
                ];
            }
        }
        return $experiments;
    }
    /**
     * Update experiments in level.dat.
     * Experiments are stored in the 'experiments' compound tag.
     * Supports both predefined and dynamically discovered experiments.
     */
    public function updateExperiments(Server $server, string $worldName, array $experimentUpdates): bool
    {
        $nbtData = $this->readLevelDat($server, $worldName);
        if (!$nbtData) {
            Log::error('Could not read level.dat for updating experiments');
            return false;
        }
        $hasEnabledExperiments = false;
        if (!isset($nbtData['data']['experiments'])) {
            $nbtData['data']['experiments'] = [
                '_type' => NbtReader::TAG_COMPOUND,
                '_value' => [],
            ];
        }
        $experimentsData = &$nbtData['data']['experiments']['_value'];
        $skipKeys = ['experiments_ever_used', 'saved_with_toggled_experiments'];
        foreach ($experimentUpdates as $key => $enabled) {
            if (in_array($key, $skipKeys)) {
                continue;
            }
            $experimentsData[$key] = [
                '_type' => NbtReader::TAG_BYTE,
                '_value' => $enabled ? 1 : 0,
            ];
            if ($enabled) {
                $hasEnabledExperiments = true;
            }
        }
        foreach ($experimentsData as $key => $valueData) {
            if (in_array($key, $skipKeys)) {
                continue;
            }
            if (($valueData['_value'] ?? 0)) {
                $hasEnabledExperiments = true;
                break;
            }
        }
        $experimentsData['experiments_ever_used'] = [
            '_type' => NbtReader::TAG_BYTE,
            '_value' => $hasEnabledExperiments ? 1 : 0,
        ];
        $experimentsData['saved_with_toggled_experiments'] = [
            '_type' => NbtReader::TAG_BYTE,
            '_value' => $hasEnabledExperiments ? 1 : 0,
        ];
        $result = $this->writeLevelDat($server, $worldName, $nbtData);
        if ($result) {
            $verifyData = $this->readLevelDat($server, $worldName);
            if ($verifyData) {
                $verifyExperiments = $verifyData['data']['experiments']['_value'] ?? [];
            }
        }
        return $result;
    }
    /**
     * Get world settings from level.dat.
     */
    public function getWorldSettings(Server $server, string $worldName): array
    {
        $nbtData = $this->readLevelDat($server, $worldName);
        if (!$nbtData) {
            return [];
        }
        $settings = [];
        $data = $nbtData['data'] ?? [];
        foreach (self::WORLD_SETTINGS as $key => $info) {
            if (isset($data[$key])) {
                $settings[$key] = [
                    'key' => $key,
                    'value' => $data[$key]['_value'] ?? null,
                    'nbt_type' => $data[$key]['_type'] ?? null,
                    'name' => $info['name'],
                    'type' => $info['type'],
                    'category' => $info['category'],
                    'options' => $info['options'] ?? null,
                ];
            }
        }
        return $settings;
    }
    /**
     * Update world settings in level.dat.
     */
    public function updateWorldSettings(Server $server, string $worldName, array $settingsUpdates): bool
    {
        $nbtData = $this->readLevelDat($server, $worldName);
        if (!$nbtData) {
            Log::error('Could not read level.dat for updating settings');
            return false;
        }
        foreach ($settingsUpdates as $key => $value) {
            if (!isset(self::WORLD_SETTINGS[$key])) {
                continue;
            }
            $info = self::WORLD_SETTINGS[$key];
            $nbtType = match ($info['type']) {
                'byte' => NbtReader::TAG_BYTE,
                'short' => NbtReader::TAG_SHORT,
                'int' => NbtReader::TAG_INT,
                'long' => NbtReader::TAG_LONG,
                'float' => NbtReader::TAG_FLOAT,
                'double' => NbtReader::TAG_DOUBLE,
                'string' => NbtReader::TAG_STRING,
                default => NbtReader::TAG_INT,
            };
            $typedValue = match ($info['type']) {
                'byte' => (int) $value,
                'short' => (int) $value,
                'int' => (int) $value,
                'long' => (int) $value,
                'float' => (float) $value,
                'double' => (float) $value,
                'string' => (string) $value,
                default => $value,
            };
            $nbtData['data'][$key] = [
                '_type' => $nbtType,
                '_value' => $typedValue,
            ];
        }
        $result = $this->writeLevelDat($server, $worldName, $nbtData);
        if ($result) {
            $verifyData = $this->readLevelDat($server, $worldName);
        }
        return $result;
    }
    /**
     * Get all raw NBT data from level.dat for debugging.
     */
    public function getRawData(Server $server, string $worldName): ?array
    {
        return $this->readLevelDat($server, $worldName);
    }
}
