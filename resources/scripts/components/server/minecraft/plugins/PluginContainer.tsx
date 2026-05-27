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
import PluginRow from '@/components/server/minecraft/plugins/PluginRow';
import InstalledPlugins from '@/components/server/minecraft/plugins/InstalledPlugins';
import { getPlugins, Plugin, PluginProvider } from '@/api/server/minecraft/plugins';
import { Button } from '@/components/elements/button/index';
const PROVIDERS: { value: PluginProvider; label: string }[] = [
    { value: 'modrinth', label: 'Modrinth' },
    { value: 'curseforge', label: 'CurseForge' },
    { value: 'hangar', label: 'Hangar (PaperMC)' },
    { value: 'spigotmc', label: 'SpigotMC' },
    { value: 'polymart', label: 'Polymart' },
];
const PER_PAGE_OPTIONS = [10, 20, 50];
export default () => {
    const uuid = ServerContext.useStoreState((s) => s.server.data!.uuid);
    const { clearFlashes } = useFlash();
    const [refreshTrigger, setRefreshTrigger] = useState(0);
    const [provider, setProvider] = useState<PluginProvider>('modrinth');
    const [query, setQuery] = useState('');
    const [inputValue, setInputValue] = useState('');
    const [page, setPage] = useState(1);
    const [perPage, setPerPage] = useState(20);
    const [mcVersion, setMcVersion] = useState('');
    const [mcVersions, setMcVersions] = useState<string[]>([]);
    const [loader, setLoader] = useState('');
    const [loaders, setLoaders] = useState<any[]>([]);
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
            });
        fetch('https://api.modrinth.com/v2/tag/loader')
            .then((res) => res.json())
            .then((data) => {
                if (Array.isArray(data)) {
                    setLoaders(data);
                }
            })
            .catch((err) => {
                console.error('Failed to fetch Modrinth plugin loaders', err);
            });
    }, []);
    const { data, error, isValidating } = useSWR(
        ['server:plugins', uuid, provider, query, page, perPage, mcVersion, loader],
        () => getPlugins(uuid, provider, query, page, perPage, mcVersion, loader),
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
            clearFlashes('plugins');
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
    const onProviderChange = (value: PluginProvider) => {
        clearFlashes('plugins');
        setProvider(value);
        setPage(1);
        setQuery('');
        setInputValue('');
        setLoader('');
    };
    const onVersionChange = (v: string) => {
        clearFlashes('plugins');
        setMcVersion(v);
        setPage(1);
    };
    const generatePolymartLoginUrl = (): string => {
        const host = window.location.host;
        const protocol = window.location.protocol;
        const returnUrl = `${protocol}//${host}/api/client/servers/${uuid}/minecraft-plugins/link-back`;
        const nonce = Array.from({ length: 16 }, () => Math.random().toString(36)[2] || '0').join('');
        const state = Array.from({ length: 96 }, () => Math.floor(Math.random() * 16).toString(16)).join('');
        const payload = {
            return_url: returnUrl,
            service: host,
            nonce: nonce,
            state: state,
            id: '0',
            expires: null
        };
        const base64Payload = btoa(JSON.stringify(payload));
        const key = `A${base64Payload}.9mCsy_qgmuurb-cf.CSDF`;
        return `https://voxel.shop/login?r=${encodeURIComponent(`/account/link?_cf_should_force_cache=//guest&key=${key}`)}`;
    };
    const onInstalled = (plugin: Plugin, prov: PluginProvider) => {
        setRefreshTrigger((prev) => prev + 1);
    };
    return (
        <ServerContentBlock title={'Plugin Installer'}>
            <FlashMessageRender byKey={'plugins'} css={tw`mb-4`} />
            <div css={tw`flex flex-col lg:flex-row gap-4`}>
                {/* ── Sidebar ────────────────────────────────────────────── */}
                <div css={tw`w-full lg:w-64 lg:order-last flex-shrink-0 lg:sticky lg:top-4 lg:self-start`}>
                    <GreyRowBox css={tw`flex-col items-stretch gap-4 p-4`}>
                        {/* Provider */}
                        <div css={tw`w-full`}>
                            <Label htmlFor={'plugin-provider'}>Provider</Label>
                            <Select
                                id={'plugin-provider'}
                                value={provider}
                                onChange={(e) => onProviderChange(e.target.value as PluginProvider)}
                                css={tw`mt-1`}
                            >
                                {PROVIDERS.map((p) => (
                                    <option key={p.value} value={p.value}>{p.label}</option>
                                ))}
                            </Select>
                        </div>
                        {/* Minecraft Version Filter */}
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
                        {/* Plugin Loader Filter */}
                        {provider === 'modrinth' && (
                            <div css={tw`w-full`}>
                                <Label htmlFor={'mc-loader'}>Plugin Loader</Label>
                                <Select
                                    id={'mc-loader'}
                                    value={loader}
                                    onChange={(e) => {
                                        clearFlashes('plugins');
                                        setLoader(e.target.value);
                                        setPage(1);
                                    }}
                                    css={tw`mt-1`}
                                >
                                    <option value={''}>All Loaders</option>
                                    {loaders
                                        .filter((l: any) => l.supported_project_types.includes('plugin'))
                                        .map((l: any) => (
                                            <option key={l.name} value={l.name}>{l.name.charAt(0).toUpperCase() + l.name.slice(1)}</option>
                                        ))
                                    }
                                </Select>
                            </div>
                        )}
                        {/* Search */}
                        <div css={tw`w-full`}>
                            <Label htmlFor={'plugin-search'}>Search</Label>
                            <Input
                                id={'plugin-search'}
                                type={'text'}
                                placeholder={'Search plugins…'}
                                value={inputValue}
                                onChange={handleSearch}
                                css={tw`mt-1`}
                            />
                        </div>
                        {/* Per page */}
                        <div css={tw`w-full`}>
                            <Label htmlFor={'plugin-per-page'}>Per page</Label>
                            <Select
                                id={'plugin-per-page'}
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
                        {/* Polymart notice */}
                        {provider === 'polymart' && (
                            <>
                                <Button
                                    onClick={() => { window.location.href = generatePolymartLoginUrl(); }}
                                    css={tw`w-full`}
                                >
                                    Login Polymart
                                </Button>
                            </>
                        )}
                        <InstalledPlugins
                            refreshTrigger={refreshTrigger}
                            onRefreshTriggered={() => setRefreshTrigger((prev) => prev + 1)}
                        />
                    </GreyRowBox>
                </div>
                {/* ── Results ────────────────────────────────────────────── */}
                <div css={tw`flex-1 min-w-0`}>
                    {(!data || isValidating) && !error ? (
                        <Spinner size={'large'} centered />
                    ) : error ? (
                        <p css={tw`text-sm text-neutral-300 text-center`}>
                            Failed to load plugins. Check your network or provider configuration.
                        </p>
                    ) : (
                        <Pagination data={data!} onPageSelect={setPage}>
                            {({ items }) =>
                                !items.length ? (
                                    <p css={tw`text-sm text-neutral-300 text-center`}>
                                        No plugins found. Try a different search term or provider.
                                    </p>
                                ) : (
                                    <GreyRowBox css={tw`flex-col p-0 overflow-hidden items-stretch`}>
                                        <div css={tw`grid grid-cols-1 sm:grid-cols-2 divide-y divide-neutral-600`}>
                                            {items.map((plugin) => (
                                                <PluginRow
                                                    key={`${plugin.id}`}
                                                    plugin={plugin}
                                                    provider={provider}
                                                    mcVersion={mcVersion}
                                                    loader={loader}
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
