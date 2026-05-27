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
import VersionRow from '@/components/server/minecraft/versions/VersionRow';
import { getCurrentJar, CurrentJarData } from '@/api/server/minecraft/versions';
import Tooltip from '@/components/elements/tooltip/Tooltip';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { faExclamationTriangle, faSkull } from '@fortawesome/free-solid-svg-icons';
export default () => {
    const uuid = ServerContext.useStoreState((s) => s.server.data!.uuid);
    const { clearFlashes, addFlash } = useFlash();
    const [loadingTypes, setLoadingTypes] = useState(true);
    const [types, setTypes] = useState<any[]>([]);
    const [loadingCurrent, setLoadingCurrent] = useState(true);
    const [currentJar, setCurrentJar] = useState<CurrentJarData | null>(null);
    const [query, setQuery] = useState('');
    const [filter, setFilter] = useState('all');
    const fetchCurrentJar = () => {
        setLoadingCurrent(true);
        getCurrentJar(uuid)
            .then(setCurrentJar)
            .catch(() => setCurrentJar({ software: 'Unknown', version: 'Unknown', build: 'Unknown' } as any))
            .finally(() => setLoadingCurrent(false));
    };
    useEffect(() => {
        clearFlashes('versions');
        fetchCurrentJar();
        fetch('https://versions.mcjars.app/api/v2/types')
            .then(res => res.json())
            .then(data => {
                if (data.success && data.types) {
                    const allTypes: any[] = [];
                    Object.values(data.types).forEach((category: any) => {
                        Object.keys(category).forEach((key) => {
                            allTypes.push({
                                type: key,
                                ...category[key]
                            });
                        });
                    });
                    setTypes(allTypes);
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
                                <option value={'snapshot'}>Snapshot</option>
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
                                    <span css={tw`text-xs text-neutral-400`}>Reading server.jar</span>
                                </div>
                            ) : currentJar ? (
                                (() => {
                                    const currentSoftwareType = types.find(t => t.name.toLowerCase() === currentJar.software.toLowerCase() || t.type.toLowerCase() === currentJar.software.toLowerCase());
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
                                                        <span css={tw`text-neutral-400 uppercase`}>{currentJar.software.charAt(0)}</span>
                                                    </div>
                                                )}
                                                <div css={tw`flex-1 min-w-0`}>
                                                    <p css={tw`text-sm text-neutral-100 flex items-center gap-1.5`}>
                                                        <span>{currentSoftwareType ? currentSoftwareType.name : currentJar.software}</span>
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
                                                        title={`${currentJar.version}${currentJar.build && currentJar.build !== currentJar.version && currentJar.build !== 'Unknown' ? ` — ${currentJar.build}` : ''}`}
                                                    >
                                                        {currentJar.version}
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
                        href={'https://mcjars.app'}
                        target={'_blank'}
                        rel={'noreferrer'}
                        css={tw`mt-4 flex items-center justify-center gap-2 p-3 bg-neutral-800 border border-neutral-700 hover:bg-neutral-700 transition-colors rounded-md text-xs text-neutral-400 hover:text-neutral-200 no-underline select-none`}
                    >
                        <img
                            src={'https://s3.mcjars.app/icons/vanilla.png'}
                            alt={'MCJars Logo'}
                            css={tw`w-5 h-5 object-cover rounded`}
                        />
                        <span>Powered by MCJars</span>
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
