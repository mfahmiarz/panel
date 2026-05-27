import React, { useState, useEffect } from 'react';
import tw from 'twin.macro';
import { ServerContext } from '@/state/server';
import useFlash from '@/plugins/useFlash';
import ServerContentBlock from '@/components/elements/ServerContentBlock';
import FlashMessageRender from '@/components/FlashMessageRender';
import Spinner from '@/components/elements/Spinner';
import GreyRowBox from '@/components/elements/GreyRowBox';
import Input from '@/components/elements/Input';
import Label from '@/components/elements/Label';
import Select from '@/components/elements/Select';
import VersionRow from './VersionRow';
import { getCurrentBedrock, CurrentBedrockData, MINECRAFT_BLOCKS } from '@/api/server/bedrock/versions';
import Tooltip from '@/components/elements/tooltip/Tooltip';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { faExclamationTriangle, faSkull } from '@fortawesome/free-solid-svg-icons';
export default () => {
    const uuid = ServerContext.useStoreState((s) => s.server.data!.uuid);
    const { clearFlashes, addFlash } = useFlash();
    const [loadingTypes, setLoadingTypes] = useState(true);
    const [types, setTypes] = useState<any[]>([]);
    const [loadingCurrent, setLoadingCurrent] = useState(true);
    const [currentJar, setCurrentJar] = useState<CurrentBedrockData | null>(null);
    const [query, setQuery] = useState('');
    const [filter, setFilter] = useState('all');
    const fetchCurrentJar = () => {
        setLoadingCurrent(true);
        getCurrentBedrock(uuid)
            .then(setCurrentJar)
            .catch(() => setCurrentJar({ software: 'Unknown', version: 'Unknown', build: 'Unknown' }))
            .finally(() => setLoadingCurrent(false));
    };
    useEffect(() => {
        clearFlashes('versions');
        fetchCurrentJar();
        fetch('https://bedrockbuilds.pipeprince.cc/api/v1/versions.json')
            .then(res => res.json())
            .then(data => {
                if (data.success && data.data) {
                    const rawVersions = data.data as any[];
                    const parentGroups: { [key: string]: { builds: any[]; isPreview: boolean } } = {};
                    rawVersions.forEach(v => {
                        const buildIsPreview = !!(v.scraped_preview && v.preview_server_version && v.preview_server_version !== 'N/A');
                        let fullVer = buildIsPreview ? v.preview_server_version : v.server_version;
                        if (!fullVer || fullVer === 'N/A') {
                            fullVer = v.version_number;
                        }
                        if (!fullVer) return;
                        const parts = fullVer.split('.');
                        const parent = parts.length >= 2 ? `${parts[0]}.${parts[1]}` : fullVer;
                        const key = parent;
                        if (!parentGroups[key]) {
                            parentGroups[key] = { builds: [], isPreview: buildIsPreview };
                        }
                        parentGroups[key].builds.push(v);
                        if (!buildIsPreview) {
                            parentGroups[key].isPreview = false;
                        }
                    });
                    const sortedParents = Object.keys(parentGroups).sort((a, b) => {
                        const aMatch = a.match(/(\d+)(?:\.(\d+))?/);
                        const bMatch = b.match(/(\d+)(?:\.(\d+))?/);
                        if (!aMatch || !bMatch) return 0;
                        const aMajor = parseInt(aMatch[1], 10);
                        const bMajor = parseInt(bMatch[1], 10);
                        if (aMajor !== bMajor) return bMajor - aMajor;
                        const aMinor = aMatch[2] ? parseInt(aMatch[2], 10) : 0;
                        const bMinor = bMatch[2] ? parseInt(bMatch[2], 10) : 0;
                        return bMinor - aMinor;
                    });
                    const constructedTypes = sortedParents.map((parent, index) => {
                        const group = parentGroups[parent];
                        const iconUrl = MINECRAFT_BLOCKS[index % MINECRAFT_BLOCKS.length];
                        return {
                            type: `bedrock-${parent}`,
                            name: `Bedrock ${parent}`,
                            icon: iconUrl,
                            color: '#47a22a',
                            description: `Minecraft Bedrock Dedicated Server binaries for major version ${parent}.`,
                            experimental: false,
                            builds: group.builds.length,
                            versions: {
                                minecraft: 1,
                                project: group.builds.length
                            },
                            rawBuilds: group.builds
                        };
                    });
                    setTypes(constructedTypes);
                } else {
                    addFlash({ type: 'error', key: 'versions', message: 'Failed to load software types.' });
                }
            })
            .catch(() => addFlash({ type: 'error', key: 'versions', message: 'Failed to load software types.' }))
            .finally(() => setLoadingTypes(false));
    }, []);
    const filteredTypes = types.filter(t => {
        if (query) {
            return t.name.toLowerCase().includes(query.toLowerCase()) ||
                (t.description && t.description.toLowerCase().includes(query.toLowerCase()));
        }
        return true;
    });
    return (
        <ServerContentBlock title={'Version Changer'}>
            <FlashMessageRender byKey={'versions'} css={tw`mb-4`} />
            <div css={tw`flex flex-col lg:flex-row gap-4`}>
                <div css={tw`w-full lg:w-64 lg:order-last flex-shrink-0 lg:sticky lg:top-4 lg:self-start`}>
                    <GreyRowBox css={tw`flex-col items-stretch gap-4 p-4`}>
                        <div css={tw`w-full`}>
                            <Label htmlFor={'type-filter'}>Filter</Label>
                            <Select
                                id={'type-filter'}
                                value={filter}
                                onChange={(e) => setFilter(e.target.value)}
                                css={tw`mt-1`}
                            >
                                <option value={'all'}>All</option>
                                <option value={'stable'}>Stable</option>
                                <option value={'preview'}>Preview</option>
                            </Select>
                        </div>
                        <div css={tw`w-full`}>
                            <Label htmlFor={'software-search'}>Search</Label>
                            <Input
                                id={'software-search'}
                                type={'text'}
                                placeholder={'Search software…'}
                                value={query}
                                onChange={(e) => setQuery(e.target.value)}
                                css={tw`mt-1`}
                            />
                        </div>
                        <div css={tw`border-t border-neutral-600 w-full`} />
                        <div css={tw`w-full`}>
                            <Label>Current Version</Label>
                            {loadingCurrent ? (
                                <div css={tw`flex items-center gap-2 mt-2`}>
                                    <Spinner size={'small'} />
                                    <span css={tw`text-xs text-neutral-400`}>Reading bedrock_server</span>
                                </div>
                            ) : currentJar ? (
                                (() => {
                                    const currentSoftwareType = types.find(t => {
                                        const versionParts = currentJar.version.split('.');
                                        const parent = versionParts.length >= 2 ? `${versionParts[0]}.${versionParts[1]}` : currentJar.version;
                                        return t.name.includes(parent);
                                    });
                                    return (
                                        <div css={tw`mt-3 flex flex-col gap-2`}>
                                            <div css={tw`flex items-center gap-3`}>
                                                {currentSoftwareType?.icon ? (
                                                    <img
                                                        src={currentSoftwareType.icon}
                                                        alt={''}
                                                        css={tw`w-10 h-10 rounded flex-shrink-0 object-cover`}
                                                        onError={(e) => { (e.target as HTMLImageElement).style.display = 'none'; }}
                                                    />
                                                ) : (
                                                    <div css={tw`w-10 h-10 rounded flex-shrink-0 bg-neutral-600 flex items-center justify-center`}>
                                                        <span css={tw`text-neutral-400 uppercase`}>{currentJar.software ? currentJar.software.charAt(0) : 'U'}</span>
                                                    </div>
                                                )}
                                                <div css={tw`flex-1 min-w-0`}>
                                                    <p css={tw`text-sm text-neutral-100 flex items-center gap-1.5`}>
                                                        <span>{currentSoftwareType ? currentSoftwareType.name : (currentJar.software || 'Unknown')}</span>
                                                        {currentSoftwareType?.experimental && (
                                                            <Tooltip content={'Experimental'}>
                                                                <span css={tw`text-yellow-500`}>
                                                                    <FontAwesomeIcon icon={faExclamationTriangle} />
                                                                </span>
                                                            </Tooltip>
                                                        )}
                                                        {currentSoftwareType?.deprecated && (
                                                            <Tooltip content={'Deprecated'}>
                                                                <span css={tw`text-red-500`}>
                                                                    <FontAwesomeIcon icon={faSkull} />
                                                                </span>
                                                            </Tooltip>
                                                        )}
                                                    </p>
                                                    <p
                                                        css={tw`text-xs text-neutral-400 truncate`}
                                                        title={`${currentJar.version || 'Unknown'}${currentJar.build && currentJar.build !== currentJar.version && currentJar.build !== 'Unknown' ? ` — ${currentJar.build}` : ''}`}
                                                    >
                                                        {currentJar.version || 'Unknown'}
                                                        {currentJar.build && currentJar.build !== currentJar.version && currentJar.build !== 'Unknown' ? ` — ${currentJar.build}` : ''}
                                                    </p>
                                                </div>
                                            </div>
                                        </div>
                                    );
                                })()
                            ) : (
                                <p css={tw`mt-1 text-sm text-neutral-400`}>Unknown</p>
                            )}
                        </div>
                    </GreyRowBox>
                    <a
                        href={'https://bedrockbuilds.pipeprince.cc'}
                        target={'_blank'}
                        rel={'noreferrer'}
                        css={tw`mt-4 flex items-center justify-center gap-2 p-3 bg-neutral-800 border border-neutral-700 hover:bg-neutral-700 transition-colors rounded-md text-xs text-neutral-400 hover:text-neutral-200 no-underline select-none`}
                    >
                        <img
                            src={'https://bedrockbuilds.pipeprince.cc/assets/logo.png'}
                            alt={'BedrockBuilds Logo'}
                            css={tw`w-5 h-5 object-cover rounded`}
                        />
                        <span>Powered by BedrockBuilds</span>
                    </a>
                </div>
                <div css={tw`flex-1 min-w-0`}>
                    {loadingTypes ? (
                        <Spinner size={'large'} centered />
                    ) : filteredTypes.length === 0 ? (
                        <p css={tw`text-sm text-neutral-300 text-center`}>
                            No software types found matching your criteria.
                        </p>
                    ) : (
                        <GreyRowBox css={tw`flex-col p-0 overflow-hidden items-stretch`}>
                            <div css={tw`grid grid-cols-1 sm:grid-cols-3 divide-y divide-neutral-600`}>
                                {filteredTypes.map((software) => (
                                    <VersionRow
                                        key={software.type}
                                        software={software}
                                        filter={filter}
                                        onInstalled={fetchCurrentJar}
                                    />
                                ))}
                            </div>
                        </GreyRowBox>
                    )}
                </div>
            </div>
        </ServerContentBlock>
    );
};
