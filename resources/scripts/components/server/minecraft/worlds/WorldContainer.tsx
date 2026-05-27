import React, { useState, useEffect, useRef } from 'react';
import tw from 'twin.macro';
import useSWR from 'swr';
import { ServerContext } from '@/state/server';
import useFlash from '@/plugins/useFlash';
import ServerContentBlock from '@/components/elements/ServerContentBlock';
import FlashMessageRender from '@/components/FlashMessageRender';
import Spinner from '@/components/elements/Spinner';
import Input from '@/components/elements/Input';
import Label from '@/components/elements/Label';
import Select from '@/components/elements/Select';
import GreyRowBox from '@/components/elements/GreyRowBox';
import Pagination from '@/components/elements/Pagination';
import WorldRow from '@/components/server/minecraft/worlds/WorldRow';
import InstalledWorlds from '@/components/server/minecraft/worlds/InstalledWorlds';
import { getWorlds, World, WorldProvider } from '@/api/server/minecraft/worlds';
const PER_PAGE_OPTIONS = [10, 20, 50];
export default () => {
    const uuid = ServerContext.useStoreState((s) => s.server.data!.uuid);
    const { clearFlashes } = useFlash();
    const [refreshTrigger, setRefreshTrigger] = useState(0);
    const [provider] = useState<WorldProvider>('curseforge');
    const [query, setQuery] = useState('');
    const [inputValue, setInputValue] = useState('');
    const [page, setPage] = useState(1);
    const [perPage, setPerPage] = useState(20);
    const [mcVersion, setMcVersion] = useState('');
    const [mcVersions, setMcVersions] = useState<string[]>([]);
    useEffect(() => {
        fetch('https://api.modrinth.com/v2/tag/game_version')
            .then((res) => res.json())
            .then((data) => {
                if (Array.isArray(data)) {
                    const releases = data
                        .filter((v: any) => v.version_type === 'release')
                        .map((v: any) => v.version);
                    setMcVersions(releases);
                }
            })
            .catch((err) => {
                console.error('Failed to fetch game versions', err);
            });
    }, []);
    const { data, error, isValidating } = useSWR(
        ['server:worlds', uuid, provider, query, page, perPage, mcVersion],
        () => getWorlds(uuid, provider, query, page, perPage, mcVersion),
        { revalidateOnFocus: false },
    );
    const searchTimeoutRef = useRef<number | null>(null);
    const handleSearch = (e: React.ChangeEvent<HTMLInputElement>) => {
        const value = e.target.value;
        setInputValue(value);
        if (searchTimeoutRef.current) {
            window.clearTimeout(searchTimeoutRef.current);
        }
        searchTimeoutRef.current = window.setTimeout(() => {
            clearFlashes('worlds');
            setQuery(value);
            setPage(1);
        }, 500);
    };
    useEffect(() => {
        return () => {
            if (searchTimeoutRef.current) {
                window.clearTimeout(searchTimeoutRef.current);
            }
        };
    }, []);
    const onVersionChange = (v: string) => {
        clearFlashes('worlds');
        setMcVersion(v);
        setPage(1);
    };
    const onInstalled = (world: World, prov: WorldProvider) => {
        setRefreshTrigger((prev) => prev + 1);
    };
    return (
        <ServerContentBlock title={'World Installer'}>
            <FlashMessageRender byKey={'worlds'} css={tw`mb-4`} />
            <div css={tw`flex flex-col lg:flex-row gap-4`}>
                <div css={tw`w-full lg:w-64 lg:order-last flex-shrink-0 lg:sticky lg:top-4 lg:self-start`}>
                    <GreyRowBox css={tw`flex-col items-stretch gap-4 p-4`}>
                        <div css={tw`w-full`}>
                            <Label htmlFor={'mc-version'}>Minecraft Version</Label>
                            <Select
                                id={'mc-version'}
                                value={mcVersion}
                                onChange={(e) => onVersionChange(e.target.value)}
                                css={tw`mt-1`}
                            >
                                <option value={''}>All Versions</option>
                                {mcVersions.map((v) => (
                                    <option key={v} value={v}>{v}</option>
                                ))}
                            </Select>
                        </div>
                        <div css={tw`w-full`}>
                            <Label htmlFor={'world-search'}>Search</Label>
                            <Input
                                id={'world-search'}
                                type={'text'}
                                placeholder={'Search worlds…'}
                                value={inputValue}
                                onChange={handleSearch}
                                css={tw`mt-1`}
                            />
                        </div>
                        <div css={tw`w-full`}>
                            <Label htmlFor={'world-per-page'}>Per page</Label>
                            <Select
                                id={'world-per-page'}
                                value={perPage}
                                onChange={(e) => { setPerPage(Number(e.target.value)); setPage(1); }}
                                css={tw`mt-1`}
                            >
                                {PER_PAGE_OPTIONS.map((n) => (
                                    <option key={n} value={n}>{n}</option>
                                ))}
                            </Select>
                        </div>
                        <div css={tw`border-t border-neutral-600 w-full`} />
                        <InstalledWorlds
                            refreshTrigger={refreshTrigger}
                            onRefreshTriggered={() => setRefreshTrigger((prev) => prev + 1)}
                        />
                    </GreyRowBox>
                </div>
                <div css={tw`flex-1 min-w-0`}>
                    {(!data || isValidating) && !error ? (
                        <Spinner size={'large'} centered />
                    ) : error ? (
                        <p css={tw`text-sm text-neutral-300 text-center`}>
                            Failed to load worlds. Check your network or provider configuration.
                        </p>
                    ) : (
                        <Pagination data={data!} onPageSelect={setPage}>
                            {({ items }) =>
                                !items.length ? (
                                    <p css={tw`text-sm text-neutral-300 text-center`}>
                                        No worlds found. Try a different search term.
                                    </p>
                                ) : (
                                    <GreyRowBox css={tw`flex-col p-0 overflow-hidden items-stretch`}>
                                        <div css={tw`grid grid-cols-1 sm:grid-cols-2 divide-y divide-neutral-600`}>
                                            {items.map((world) => (
                                                <WorldRow
                                                    key={`${world.id}`}
                                                    world={world}
                                                    provider={provider}
                                                    mcVersion={mcVersion}
                                                    onInstalled={onInstalled}
                                                />
                                            ))}
                                        </div>
                                    </GreyRowBox>
                                )
                            }
                        </Pagination>
                    )}
                </div>
            </div>
        </ServerContentBlock>
    );
};
