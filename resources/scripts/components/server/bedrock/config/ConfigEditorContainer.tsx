import React, { useEffect, useState, useRef } from 'react';
import tw from 'twin.macro';
import { ServerContext } from '@/state/server';
import ServerContentBlock from '@/components/elements/ServerContentBlock';
import FlashMessageRender from '@/components/FlashMessageRender';
import useFlash from '@/plugins/useFlash';
import Spinner from '@/components/elements/Spinner';
import Label from '@/components/elements/Label';
import Input from '@/components/elements/Input';
import Switch from '@/components/elements/Switch';
import Select from '@/components/elements/Select';
import GreyRowBox from '@/components/elements/GreyRowBox';
import {
    getProperties,
    saveProperties,
    getWorlds,
    getExperiments,
    saveExperiments,
    getWorldSettings,
    saveWorldSettings,
    getStartupVariables,
    updateStartupVariable,
    World,
    Experiment,
    WorldSetting,
} from '@/api/server/bedrock/config';
import { ServerEggVariable } from '@/api/server/types';
type TabType = 'startup' | 'properties' | 'experiments' | 'world-settings';
export default () => {
    const uuid = ServerContext.useStoreState((state) => state.server.data!.uuid);
    const { clearFlashes, clearAndAddHttpError, addFlash } = useFlash();
    const [activeTab, setActiveTab] = useState<TabType>('startup');
    const [propertiesContent, setPropertiesContent] = useState<Record<string, string>>({});
    const [propertiesLoading, setPropertiesLoading] = useState(true);
    const [search, setSearch] = useState('');
    const [isSaving, setIsSaving] = useState(false);
    const [lastSaved, setLastSaved] = useState<Date | null>(null);
    const saveTimeoutRef = useRef<NodeJS.Timeout | null>(null);
    const isFirstLoad = useRef(true);
    const [worlds, setWorlds] = useState<World[]>([]);
    const [selectedWorld, setSelectedWorld] = useState<string>('');
    const [experiments, setExperiments] = useState<Record<string, Experiment>>({});
    const [experimentsLoading, setExperimentsLoading] = useState(false);
    const [experimentsSaving, setExperimentsSaving] = useState(false);
    const [experimentsLastSaved, setExperimentsLastSaved] = useState<Date | null>(null);
    const experimentsFirstLoad = useRef(true);
    const experimentsSaveTimeout = useRef<NodeJS.Timeout | null>(null);
    const [worldSettings, setWorldSettings] = useState<Record<string, WorldSetting>>({});
    const [worldSettingsLoading, setWorldSettingsLoading] = useState(false);
    const [worldSettingsSaving, setWorldSettingsSaving] = useState(false);
    const [worldSettingsLastSaved, setWorldSettingsLastSaved] = useState<Date | null>(null);
    const worldSettingsFirstLoad = useRef(true);
    const worldSettingsSaveTimeout = useRef<NodeJS.Timeout | null>(null);
    const [startupVariables, setStartupVariables] = useState<ServerEggVariable[]>([]);
    const [startupLoading, setStartupLoading] = useState(false);
    const [startupSaving, setStartupSaving] = useState<string | null>(null);
    const loadProperties = () => {
        setPropertiesLoading(true);
        clearFlashes('bedrock-config');
        getProperties(uuid)
            .then((data) => {
                if (data.success) {
                    setPropertiesContent(data.content);
                    isFirstLoad.current = true;
                } else {
                    addFlash({
                        key: 'bedrock-config',
                        type: 'warning',
                        message: data.error || 'server.properties not found',
                    });
                }
            })
            .catch((error) => clearAndAddHttpError({ key: 'bedrock-config', error }))
            .finally(() => setPropertiesLoading(false));
    };
    const loadWorlds = () => {
        getWorlds(uuid)
            .then((data) => {
                if (data.success) {
                    setWorlds(data.worlds);
                    if (data.default_world && !selectedWorld) {
                        setSelectedWorld(data.default_world);
                    } else if (data.worlds.length > 0 && !selectedWorld) {
                        setSelectedWorld(data.worlds[0].name);
                    }
                }
            })
            .catch((error) => console.error('Failed to load worlds:', error));
    };
    const loadExperiments = (worldName: string) => {
        if (!worldName) return;
        setExperimentsLoading(true);
        experimentsFirstLoad.current = true;
        getExperiments(uuid, worldName)
            .then((data) => {
                if (data.success) {
                    setExperiments(data.experiments);
                } else {
                    addFlash({
                        key: 'bedrock-config',
                        type: 'error',
                        message: data.error || 'Failed to load experiments',
                    });
                }
            })
            .catch((error) => clearAndAddHttpError({ key: 'bedrock-config', error }))
            .finally(() => setExperimentsLoading(false));
    };
    const loadWorldSettings = (worldName: string) => {
        if (!worldName) return;
        setWorldSettingsLoading(true);
        worldSettingsFirstLoad.current = true;
        getWorldSettings(uuid, worldName)
            .then((data) => {
                if (data.success) {
                    setWorldSettings(data.settings);
                } else {
                    addFlash({
                        key: 'bedrock-config',
                        type: 'error',
                        message: data.error || 'Failed to load world settings',
                    });
                }
            })
            .catch((error) => clearAndAddHttpError({ key: 'bedrock-config', error }))
            .finally(() => setWorldSettingsLoading(false));
    };
    const loadStartupVariables = () => {
        setStartupLoading(true);
        getStartupVariables(uuid)
            .then((data) => {
                setStartupVariables(data.variables);
            })
            .catch((error) => {
                console.error('Failed to load startup variables:', error);
                clearAndAddHttpError({ key: 'bedrock-config', error });
            })
            .finally(() => setStartupLoading(false));
    };
    const handleStartupVariableChange = (envVariable: string, value: string) => {
        setStartupSaving(envVariable);
        updateStartupVariable(uuid, envVariable, value)
            .then((data) => {
                if (data.variable && data.variable.serverValue !== undefined) {
                    setStartupVariables((prev) =>
                        prev.map((v) => (v.envVariable === envVariable ? data.variable! : v))
                    );
                } else {
                    setStartupVariables((prev) =>
                        prev.map((v) => (v.envVariable === envVariable ? { ...v, serverValue: value } : v))
                    );
                }
            })
            .catch((error) => {
                clearAndAddHttpError({ key: 'bedrock-config', error });
            })
            .finally(() => setStartupSaving(null));
    };
    useEffect(() => {
        loadProperties();
        loadWorlds();
        loadStartupVariables();
    }, [uuid]);
    useEffect(() => {
        if (selectedWorld && activeTab === 'experiments') {
            loadExperiments(selectedWorld);
        }
        if (selectedWorld && activeTab === 'world-settings') {
            loadWorldSettings(selectedWorld);
        }
    }, [selectedWorld, activeTab]);
    useEffect(() => {
        if (isFirstLoad.current || activeTab !== 'properties') {
            if (isFirstLoad.current) isFirstLoad.current = false;
            return;
        }
        if (saveTimeoutRef.current) clearTimeout(saveTimeoutRef.current);
        setIsSaving(true);
        saveTimeoutRef.current = setTimeout(() => {
            saveProperties(uuid, propertiesContent, null)
                .then(() => {
                    setLastSaved(new Date());
                    setIsSaving(false);
                })
                .catch((error) => {
                    console.error('Auto-save failed:', error);
                    setIsSaving(false);
                });
        }, 1000);
        return () => {
            if (saveTimeoutRef.current) clearTimeout(saveTimeoutRef.current);
        };
    }, [propertiesContent, uuid, activeTab]);
    const handleExperimentToggle = (key: string, enabled: boolean) => {
        setExperiments((prev) => ({
            ...prev,
            [key]: { ...prev[key], enabled },
        }));
    };
    const handleWorldSettingChange = (key: string, value: any) => {
        setWorldSettings((prev) => ({
            ...prev,
            [key]: { ...prev[key], value },
        }));
    };
    useEffect(() => {
        if (experimentsFirstLoad.current || experimentsLoading || Object.keys(experiments).length === 0) {
            if (experimentsFirstLoad.current && Object.keys(experiments).length > 0) {
                experimentsFirstLoad.current = false;
            }
            return;
        }
        if (experimentsSaveTimeout.current) clearTimeout(experimentsSaveTimeout.current);
        setExperimentsSaving(true);
        experimentsSaveTimeout.current = setTimeout(() => {
            const experimentUpdates: Record<string, boolean> = {};
            Object.entries(experiments).forEach(([key, exp]) => {
                experimentUpdates[key] = exp.enabled;
            });
            saveExperiments(uuid, selectedWorld, experimentUpdates)
                .then((data) => {
                    if (data.success) {
                        setExperimentsLastSaved(new Date());
                    } else {
                        console.error('Failed to auto-save experiments:', data.error);
                    }
                })
                .catch(console.error)
                .finally(() => setExperimentsSaving(false));
        }, 1000);
        return () => {
            if (experimentsSaveTimeout.current) clearTimeout(experimentsSaveTimeout.current);
        };
    }, [experiments, uuid, selectedWorld]);
    useEffect(() => {
        if (worldSettingsFirstLoad.current || worldSettingsLoading || Object.keys(worldSettings).length === 0) {
            if (worldSettingsFirstLoad.current && Object.keys(worldSettings).length > 0) {
                worldSettingsFirstLoad.current = false;
            }
            return;
        }
        if (worldSettingsSaveTimeout.current) clearTimeout(worldSettingsSaveTimeout.current);
        setWorldSettingsSaving(true);
        worldSettingsSaveTimeout.current = setTimeout(() => {
            const settingsUpdates: Record<string, any> = {};
            Object.entries(worldSettings).forEach(([key, setting]) => {
                settingsUpdates[key] = setting.value;
            });
            saveWorldSettings(uuid, selectedWorld, settingsUpdates)
                .then((data) => {
                    if (data.success) {
                        setWorldSettingsLastSaved(new Date());
                    } else {
                        console.error('Failed to auto-save world settings:', data.error);
                    }
                })
                .catch(console.error)
                .finally(() => setWorldSettingsSaving(false));
        }, 1000);
        return () => {
            if (worldSettingsSaveTimeout.current) clearTimeout(worldSettingsSaveTimeout.current);
        };
    }, [worldSettings, uuid, selectedWorld]);
    const SELECT_OPTIONS: Record<string, { value: string; label: string }[]> = {
        difficulty: [
            { value: 'peaceful', label: 'Peaceful' },
            { value: 'easy', label: 'Easy' },
            { value: 'normal', label: 'Normal' },
            { value: 'hard', label: 'Hard' },
        ],
        gamemode: [
            { value: 'survival', label: 'Survival' },
            { value: 'creative', label: 'Creative' },
            { value: 'adventure', label: 'Adventure' },
        ],
        'default-player-permission-level': [
            { value: 'visitor', label: 'Visitor' },
            { value: 'member', label: 'Member' },
            { value: 'operator', label: 'Operator' },
        ],
        'server-authoritative-movement': [
            { value: 'client-auth', label: 'Client Auth' },
            { value: 'server-auth', label: 'Server Auth' },
            { value: 'server-auth-with-rewind', label: 'Server Auth with Rewind' },
        ],
        'chat-restriction': [
            { value: 'None', label: 'None' },
            { value: 'Dropped', label: 'Dropped' },
            { value: 'Disabled', label: 'Disabled' },
        ],
        'compression-algorithm': [
            { value: 'zlib', label: 'Zlib' },
            { value: 'snappy', label: 'Snappy' },
        ],
    };
    const STARTUP_VARIABLE_INFO: Record<string, { friendlyName: string; description: string }> = {
        SERVER_NAME: { friendlyName: 'Server Name', description: 'The name displayed in the server list' },
        GAMEMODE: {
            friendlyName: 'Game Mode',
            description: 'Default game mode for new players (survival, creative, adventure)',
        },
        DIFFICULTY: { friendlyName: 'Difficulty', description: 'World difficulty (peaceful, easy, normal, hard)' },
        MAX_PLAYERS: { friendlyName: 'Max Players', description: 'Maximum number of players allowed' },
        ONLINE_MODE: { friendlyName: 'Online Mode', description: 'Require Xbox Live authentication' },
        ALLOW_CHEATS: { friendlyName: 'Allow Cheats', description: 'Enable cheats and commands' },
        VIEW_DISTANCE: { friendlyName: 'View Distance', description: 'Maximum view distance in chunks' },
        TICK_DISTANCE: { friendlyName: 'Tick Distance', description: 'World tick distance from players' },
        LEVEL_NAME: { friendlyName: 'Level Name', description: 'Name of the world folder' },
        LEVEL_SEED: { friendlyName: 'Level Seed', description: 'World generation seed' },
        DEFAULT_PERMISSION: {
            friendlyName: 'Default Permission',
            description: 'Default permission level for new players',
        },
        SERVER_PORT: { friendlyName: 'Server Port', description: 'IPv4 port for the server' },
        SERVER_PORTV6: { friendlyName: 'Server Port (IPv6)', description: 'IPv6 port for the server' },
    };
    const renderStartupVariablesEditor = () => {
        if (startupLoading) {
            return (
                <div css={tw`flex justify-center py-8`}>
                    <Spinner size={'large'} />
                </div>
            );
        }
        if (startupVariables.length === 0) {
            return (
                <GreyRowBox css={tw`justify-center text-neutral-400 p-8`}>
                    <p>No startup variables found.</p>
                </GreyRowBox>
            );
        }
        return (
            <div css={tw`space-y-4`}>
                <GreyRowBox css={tw`flex-col p-0 overflow-hidden items-stretch`}>
                    <div css={tw`grid grid-cols-1 sm:grid-cols-2 divide-y sm:divide-y-0 sm:gap-px bg-neutral-600`}>
                        {startupVariables
                            .filter((variable) => {
                                if (!search) return true;
                                const info = STARTUP_VARIABLE_INFO[variable.envVariable] || {
                                    friendlyName: variable.name,
                                    description: variable.description,
                                };
                                const searchLower = search.toLowerCase();
                                return (
                                    variable.envVariable.toLowerCase().includes(searchLower) ||
                                    variable.name.toLowerCase().includes(searchLower) ||
                                    info.friendlyName.toLowerCase().includes(searchLower) ||
                                    info.description.toLowerCase().includes(searchLower)
                                );
                            })
                            .map((variable) => {
                                const info = STARTUP_VARIABLE_INFO[variable.envVariable] || {
                                    friendlyName: variable.name,
                                    description: variable.description,
                                };
                                const isSaving = startupSaving === variable.envVariable;
                                return (
                                    <div key={variable.envVariable} css={tw`flex flex-col items-start p-4 bg-neutral-700`}>
                                        <div css={tw`flex w-full mb-1`}>
                                            <Label css={tw`mb-0 truncate`} title={variable.envVariable}>
                                                {info.friendlyName}
                                            </Label>
                                            {isSaving && <Spinner size={'small'} />}
                                        </div>
                                        <div css={tw`w-full`}>
                                            {variable.isEditable ? (
                                                variable.rules.includes('boolean') ||
                                                    variable.serverValue === 'true' ||
                                                    variable.serverValue === 'false' ? (
                                                    <div css={tw`flex items-center`}>
                                                        <Switch
                                                            name={variable.envVariable}
                                                            defaultChecked={variable.serverValue === 'true'}
                                                            onChange={() => {
                                                                if (!isSaving) {
                                                                    handleStartupVariableChange(
                                                                        variable.envVariable,
                                                                        variable.serverValue === 'true' ? 'false' : 'true'
                                                                    );
                                                                }
                                                            }}
                                                        />
                                                    </div>
                                                ) : variable.envVariable === 'GAMEMODE' ? (
                                                    <Select
                                                        value={variable.serverValue || ''}
                                                        onChange={(e) =>
                                                            handleStartupVariableChange(
                                                                variable.envVariable,
                                                                e.target.value
                                                            )
                                                        }
                                                        disabled={isSaving}
                                                    >
                                                        <option value='survival'>Survival</option>
                                                        <option value='creative'>Creative</option>
                                                        <option value='adventure'>Adventure</option>
                                                    </Select>
                                                ) : variable.envVariable === 'DIFFICULTY' ? (
                                                    <Select
                                                        value={variable.serverValue || ''}
                                                        onChange={(e) =>
                                                            handleStartupVariableChange(
                                                                variable.envVariable,
                                                                e.target.value
                                                            )
                                                        }
                                                        disabled={isSaving}
                                                    >
                                                        <option value='peaceful'>Peaceful</option>
                                                        <option value='easy'>Easy</option>
                                                        <option value='normal'>Normal</option>
                                                        <option value='hard'>Hard</option>
                                                    </Select>
                                                ) : variable.envVariable === 'DEFAULT_PERMISSION' ? (
                                                    <Select
                                                        value={variable.serverValue || ''}
                                                        onChange={(e) =>
                                                            handleStartupVariableChange(
                                                                variable.envVariable,
                                                                e.target.value
                                                            )
                                                        }
                                                        disabled={isSaving}
                                                    >
                                                        <option value='visitor'>Visitor</option>
                                                        <option value='member'>Member</option>
                                                        <option value='operator'>Operator</option>
                                                    </Select>
                                                ) : (
                                                    <Input
                                                        type={variable.rules.includes('numeric') ? 'number' : 'text'}
                                                        value={variable.serverValue ?? ''}
                                                        onChange={(e) => {
                                                            const newValue = e.target?.value ?? '';
                                                            setStartupVariables((prev) =>
                                                                prev.map((v) =>
                                                                    v.envVariable === variable.envVariable
                                                                        ? { ...v, serverValue: newValue }
                                                                        : v
                                                                )
                                                            );
                                                        }}
                                                        onBlur={() => {
                                                            const currentVar = startupVariables.find(
                                                                (v) => v.envVariable === variable.envVariable
                                                            );
                                                            if (
                                                                currentVar &&
                                                                currentVar.serverValue !== variable.defaultValue
                                                            ) {
                                                                handleStartupVariableChange(
                                                                    variable.envVariable,
                                                                    currentVar.serverValue ?? ''
                                                                );
                                                            }
                                                        }}
                                                        disabled={isSaving}
                                                    />
                                                )
                                            ) : (
                                                <div css={tw`bg-neutral-800 rounded px-3 py-2 text-neutral-400`}>
                                                    {variable.serverValue}
                                                    <span css={tw`text-xs ml-2 text-neutral-500`}>(Read-only)</span>
                                                </div>
                                            )}
                                        </div>
                                    </div>
                                );
                            })}
                    </div>
                </GreyRowBox>
            </div>
        );
    };
    const renderPropertiesEditor = () => {
        if (propertiesLoading) {
            return (
                <div css={tw`flex justify-center py-8`}>
                    <Spinner size={'large'} />
                </div>
            );
        }
        if (Object.keys(propertiesContent).length === 0) {
            return (
                <GreyRowBox css={tw`justify-center text-neutral-400 p-8`}>
                    <p>server.properties not found.</p>
                    <p css={tw`text-sm mt-2`}>Start the server once to generate the configuration file.</p>
                </GreyRowBox>
            );
        }
        const filteredKeys = Object.entries(propertiesContent).filter(([key]) => {
            return key.toLowerCase().includes(search.toLowerCase());
        });
        if (filteredKeys.length === 0) {
            return <GreyRowBox css={tw`justify-center text-neutral-400 p-8`}>No matching settings found.</GreyRowBox>;
        }
        return (
            <GreyRowBox css={tw`flex-col p-0 overflow-hidden items-stretch`}>
                <div css={tw`grid grid-cols-1 sm:grid-cols-2 divide-y sm:divide-y-0 sm:gap-px bg-neutral-600`}>
                    {filteredKeys.map(([key, value]) => (
                        <div key={key} className="group" css={tw`flex flex-col items-start p-4 bg-neutral-700`}>
                            <div css={tw`flex items-center justify-between w-full mb-2`}>
                                <Label css={tw`mb-0 truncate`} title={key}>
                                    {key.replace(/-|_/g, ' ').toUpperCase()}
                                </Label>
                            </div>
                            <div css={tw`w-full`}>
                                {value === 'true' || value === 'false' ? (
                                    <div css={tw`flex items-center mt-2`}>
                                        <Switch
                                            name={key}
                                            defaultChecked={value === 'true'}
                                            onChange={() => {
                                                setPropertiesContent({
                                                    ...propertiesContent,
                                                    [key]: value === 'true' ? 'false' : 'true',
                                                });
                                            }}
                                        />
                                        <span css={tw`ml-3 text-xs uppercase font-bold text-neutral-400`}>
                                            {value === 'true' ? 'Enabled' : 'Disabled'}
                                        </span>
                                    </div>
                                ) : SELECT_OPTIONS[key] ? (
                                    <Select
                                        value={value}
                                        onChange={(e) =>
                                            setPropertiesContent({ ...propertiesContent, [key]: e.target.value })
                                        }
                                    >
                                        {!SELECT_OPTIONS[key].find((opt) => opt.value === value) && (
                                            <option value={value}>{value}</option>
                                        )}
                                        {SELECT_OPTIONS[key].map((opt) => (
                                            <option key={opt.value} value={opt.value}>
                                                {opt.label}
                                            </option>
                                        ))}
                                    </Select>
                                ) : !isNaN(Number(value)) && value !== '' ? (
                                    <Input
                                        type={'number'}
                                        value={value}
                                        onChange={(e) =>
                                            setPropertiesContent({ ...propertiesContent, [key]: e.target.value })
                                        }
                                    />
                                ) : (
                                    <Input
                                        value={value}
                                        onChange={(e) =>
                                            setPropertiesContent({ ...propertiesContent, [key]: e.target.value })
                                        }
                                    />
                                )}
                            </div>
                        </div>
                    ))}
                </div>
            </GreyRowBox>
        );
    };
    const renderExperimentsEditor = () => {
        if (worlds.length === 0) {
            return (
                <GreyRowBox css={tw`justify-center text-neutral-400 p-8`}>
                    <p>No worlds found.</p>
                    <p css={tw`text-sm mt-2`}>Start the server once to generate a world.</p>
                </GreyRowBox>
            );
        }
        if (experimentsLoading) {
            return (
                <div css={tw`flex justify-center py-8`}>
                    <Spinner size={'large'} />
                </div>
            );
        }
        const experimentList = Object.values(experiments);
        return (
            <div css={tw`space-y-4`}>
                {experimentList.length === 0 ? (
                    <GreyRowBox css={tw`justify-center text-neutral-400 p-8`}>
                        <p>Could not read experiments from level.dat.</p>
                        <p css={tw`text-sm mt-2`}>Make sure the world has been loaded at least once.</p>
                    </GreyRowBox>
                ) : (
                    <GreyRowBox css={tw`flex-col p-0 overflow-hidden items-stretch`}>
                        <div css={tw`grid grid-cols-1 sm:grid-cols-2 divide-y sm:divide-y-0 sm:gap-px bg-neutral-600`}>
                            {experimentList
                                .filter((exp) => {
                                    if (!search) return true;
                                    const searchLower = search.toLowerCase();
                                    return (
                                        exp.key.toLowerCase().includes(searchLower) ||
                                        exp.name.toLowerCase().includes(searchLower) ||
                                        exp.description.toLowerCase().includes(searchLower)
                                    );
                                })
                                .map((exp) => (
                                    <div key={exp.key} css={tw`flex items-center justify-between p-4 bg-neutral-700`}>
                                        <div css={tw`flex-1 min-w-0 mr-4`}>
                                            <p css={tw`text-neutral-100 font-medium`}>{exp.name}</p>
                                            <p css={tw`text-neutral-400 text-xs mt-1`}>{exp.description}</p>
                                        </div>
                                        <Switch
                                            name={exp.key}
                                            defaultChecked={exp.enabled}
                                            onChange={() => handleExperimentToggle(exp.key, !exp.enabled)}
                                        />
                                    </div>
                                ))}
                        </div>
                    </GreyRowBox>
                )}
            </div>
        );
    };
    const renderWorldSettingsEditor = () => {
        if (worlds.length === 0) {
            return (
                <GreyRowBox css={tw`justify-center text-neutral-400 p-8`}>
                    <p>No worlds found.</p>
                    <p css={tw`text-sm mt-2`}>Start the server once to generate a world.</p>
                </GreyRowBox>
            );
        }
        if (worldSettingsLoading) {
            return (
                <div css={tw`flex justify-center py-8`}>
                    <Spinner size={'large'} />
                </div>
            );
        }
        const settingsList = Object.values(worldSettings);
        const filteredSettings = settingsList.filter((setting) => {
            if (!search) return true;
            const searchLower = search.toLowerCase();
            return setting.key.toLowerCase().includes(searchLower) || setting.name.toLowerCase().includes(searchLower);
        });
        const categories = {
            general: { name: 'General', settings: [] as WorldSetting[] },
            features: { name: 'World Features', settings: [] as WorldSetting[] },
            gamerules: { name: 'Game Rules', settings: [] as WorldSetting[] },
            spawn: { name: 'Spawn Settings', settings: [] as WorldSetting[] },
        };
        filteredSettings.forEach((setting) => {
            const cat = setting.category as keyof typeof categories;
            if (categories[cat]) {
                categories[cat].settings.push(setting);
            }
        });
        return (
            <div css={tw`space-y-6`}>
                {settingsList.length === 0 ? (
                    <GreyRowBox css={tw`justify-center text-neutral-400 p-8`}>
                        <p>Could not read world settings from level.dat.</p>
                        <p css={tw`text-sm mt-2`}>Make sure the world has been loaded at least once.</p>
                    </GreyRowBox>
                ) : (
                    Object.entries(categories).map(([catKey, cat]) => {
                        if (cat.settings.length === 0) return null;
                        return (
                            <div key={catKey}>
                                <h3 css={tw`text-lg font-medium text-neutral-200 mb-3`}>{cat.name}</h3>
                                <GreyRowBox css={tw`flex-col p-0 overflow-hidden items-stretch`}>
                                    <div css={tw`grid grid-cols-1 sm:grid-cols-2 divide-y sm:divide-y-0 sm:gap-px bg-neutral-600`}>
                                        {cat.settings.map((setting) => (
                                            <div key={setting.key} css={tw`flex flex-col items-start p-4 bg-neutral-700`}>
                                                <div css={tw`flex items-center justify-between w-full mb-2`}>
                                                    <Label css={tw`mb-0`}>{setting.name}</Label>
                                                </div>
                                                <div css={tw`w-full`}>
                                                    {setting.type === 'byte' ? (
                                                        <div css={tw`flex items-center`}>
                                                            <Switch
                                                                name={setting.key}
                                                                defaultChecked={setting.value === 1}
                                                                onChange={() =>
                                                                    handleWorldSettingChange(
                                                                        setting.key,
                                                                        setting.value === 1 ? 0 : 1
                                                                    )
                                                                }
                                                            />
                                                            <span css={tw`ml-3 text-xs uppercase font-bold text-neutral-400`}>
                                                                {setting.value === 1 ? 'Enabled' : 'Disabled'}
                                                            </span>
                                                        </div>
                                                    ) : setting.options ? (
                                                        <Select
                                                            value={String(setting.value)}
                                                            onChange={(e) =>
                                                                handleWorldSettingChange(
                                                                    setting.key,
                                                                    parseInt(e.target.value)
                                                                )
                                                            }
                                                        >
                                                            {Object.entries(setting.options).map(([val, label]) => (
                                                                <option key={val} value={val}>
                                                                    {label}
                                                                </option>
                                                            ))}
                                                        </Select>
                                                    ) : setting.type === 'string' ? (
                                                        <Input
                                                            value={setting.value || ''}
                                                            onChange={(e) =>
                                                                handleWorldSettingChange(setting.key, e.target.value)
                                                            }
                                                        />
                                                    ) : (
                                                        <Input
                                                            type='number'
                                                            value={setting.value ?? ''}
                                                            onChange={(e) =>
                                                                handleWorldSettingChange(setting.key, e.target.value)
                                                            }
                                                        />
                                                    )}
                                                </div>
                                            </div>
                                        ))}
                                    </div>
                                </GreyRowBox>
                            </div>
                        );
                    })
                )}
            </div>
        );
    };
    return (
        <ServerContentBlock title={'Config Editor'}>
            <FlashMessageRender byKey={'bedrock-config'} css={tw`mb-4`} />
            <div css={tw`flex flex-col lg:flex-row gap-4`}>
                <div css={tw`w-full lg:w-64 lg:order-last flex-shrink-0 lg:sticky lg:top-4 lg:self-start`}>
                    <GreyRowBox css={tw`flex-col items-stretch gap-4 p-4`}>
                        <div css={tw`w-full`}>
                            <Label>Section</Label>
                            <Select value={activeTab} onChange={(e) => setActiveTab(e.target.value as TabType)} css={tw`mt-1`}>
                                <option value={'startup'}>Startup Variables</option>
                                <option value={'properties'}>Server Properties</option>
                                <option value={'experiments'}>Experiments</option>
                                <option value={'world-settings'}>World Settings</option>
                            </Select>
                        </div>
                        {activeTab !== 'startup' && (
                            <div css={tw`w-full`}>
                                <Label>Search Settings</Label>
                                <Input
                                    type={'search'}
                                    placeholder={'Search...'}
                                    value={search}
                                    onChange={(e) => setSearch(e.target.value)}
                                    css={tw`mt-1`}
                                />
                            </div>
                        )}
                        {(activeTab === 'experiments' || activeTab === 'world-settings') && worlds.length > 0 && (
                            <div css={tw`w-full`}>
                                <Label>Select World</Label>
                                <Select value={selectedWorld} onChange={(e) => setSelectedWorld(e.target.value)} css={tw`mt-1`}>
                                    {worlds.map((world) => (
                                        <option key={world.name} value={world.name}>
                                            {world.name} {world.is_default ? '(Default)' : ''}
                                        </option>
                                    ))}
                                </Select>
                            </div>
                        )}
                    </GreyRowBox>
                </div>
                <div css={tw`flex-1 min-w-0`}>
                    {activeTab === 'startup' && renderStartupVariablesEditor()}
                    {activeTab === 'properties' && renderPropertiesEditor()}
                    {activeTab === 'experiments' && renderExperimentsEditor()}
                    {activeTab === 'world-settings' && renderWorldSettingsEditor()}
                </div>
            </div>
        </ServerContentBlock>
    );
};
