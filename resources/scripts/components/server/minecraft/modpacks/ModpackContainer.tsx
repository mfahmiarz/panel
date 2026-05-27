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
import ModpackRow from '@/components/server/minecraft/modpacks/ModpackRow';
import RecentModpacks, { useRecentModpacks } from '@/components/server/minecraft/modpacks/RecentModpacks';
import { getModpacks, Modpack, ModpackProvider } from '@/api/server/minecraft/modpacks';
const PROVIDERS: { value: ModpackProvider; label: string }[] = [
    { value: 'modrinth', label: 'Modrinth' },
    { value: 'curseforge', label: 'CurseForge' },
    { value: 'feedthebeast', label: 'Feed The Beast' },
    { value: 'atlauncher', label: 'ATLauncher' },
    { value: 'technic', label: 'Technic' },
    { value: 'voidswrath', label: 'VoidsWrath' },
];
const PER_PAGE_OPTIONS = [10, 20, 50];
export default () => {
    const uuid = ServerContext.useStoreState((s) => s.server.data!.uuid);
    const { clearFlashes } = useFlash();
    const { recent, addRecent } = useRecentModpacks(uuid);
    const [provider, setProvider] = useState<ModpackProvider>('modrinth');
    const [query, setQuery] = useState('');
    const [page, setPage] = useState(1);
    const [perPage, setPerPage] = useState(20);
    const [inputValue, setInputValue] = useState('');
    const [loader, setLoader] = useState('');
    const [loaders, setLoaders] = useState<any[]>([]);
    const { data, error, isValidating } = useSWR(
        ['server:modpacks', uuid, provider, query, page, perPage, loader],
        () => getModpacks(uuid, provider, query, page, perPage, loader),
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
            clearFlashes('modpacks');
            setQuery(value);
            setPage(1);
        }, 500);
    };
    useEffect(() => {
        fetch('https://api.modrinth.com/v2/tag/loader')
            .then((res) => res.json())
            .then((data) => {
                if (Array.isArray(data)) {
                    setLoaders(data);
                }
            })
            .catch((err) => {
                console.error('Failed to fetch Modrinth modpack loaders', err);
            });
        return () => {
            if (searchTimeoutRef.current) {
                window.clearTimeout(searchTimeoutRef.current);
            }
        };
    }, []);
    const onProviderChange = (value: ModpackProvider) => {
        clearFlashes('modpacks');
        setProvider(value);
        setPage(1);
        setQuery('');
        setInputValue('');
        setLoader('');
    };
    const onInstalled = (modpack: Modpack, prov: ModpackProvider) => addRecent(modpack, prov);
    return (
        <ServerContentBlock title={'Modpack Installer'}>
            <FlashMessageRender byKey={'modpacks'} css={tw`mb-4`} />
            <div css={tw`flex flex-col lg:flex-row gap-4`}>
                <div css={tw`w-full lg:w-64 lg:order-last flex-shrink-0 lg:sticky lg:top-4 lg:self-start`}>
                    <GreyRowBox css={tw`flex-col items-stretch gap-4 p-4`}>
                        <div css={tw`w-full`}>
                            <Label htmlFor={'modpack-provider'}>Provider</Label>
                            <Select
                                id={'modpack-provider'}
                                value={provider}
                                onChange={(e) => onProviderChange(e.target.value as ModpackProvider)}
                                css={tw`mt-1`}
                            >
                                {PROVIDERS.map((p) => (
                                    <option key={p.value} value={p.value}>{p.label}</option>
                                ))}
                            </Select>
                        </div>
                        {provider === 'modrinth' && (
                            <div css={tw`w-full`}>
                                <Label htmlFor={'modpack-loader'}>Loader</Label>
                                <Select
                                    id={'modpack-loader'}
                                    value={loader}
                                    onChange={(e) => {
                                        clearFlashes('modpacks');
                                        setLoader(e.target.value);
                                        setPage(1);
                                    }}
                                    css={tw`mt-1`}
                                >
                                    <option value={''}>All Loaders</option>
                                    {loaders
                                        .filter((l: any) => l.supported_project_types.includes('modpack'))
                                        .map((l: any) => (
                                            <option key={l.name} value={l.name}>{l.name.charAt(0).toUpperCase() + l.name.slice(1)}</option>
                                        ))
                                    }
                                </Select>
                            </div>
                        )}
                        <div css={tw`w-full`}>
                            <Label htmlFor={'modpack-search'}>Search</Label>
                            <Input
                                id={'modpack-search'}
                                type={'text'}
                                placeholder={'Search modpacks…'}
                                value={inputValue}
                                onChange={handleSearch}
                                css={tw`mt-1`}
                            />
                        </div>
                        <div css={tw`w-full`}>
                            <Label htmlFor={'modpack-per-page'}>Per page</Label>
                            <Select
                                id={'modpack-per-page'}
                                value={perPage}
                                onChange={(e) => { setPerPage(Number(e.target.value)); setPage(1); }}
                                css={tw`mt-1`}
                            >
                                {PER_PAGE_OPTIONS.map((n) => (
                                    <option key={n} value={n}>{n}</option>
                                ))}
                            </Select>
                        </div>
                        {recent.length > 0 && (
                            <>
                                <div css={tw`border-t border-neutral-600 w-full`} />
                                <RecentModpacks recent={recent} />
                            </>
                        )}
                    </GreyRowBox>
                </div>
                <div css={tw`flex-1 min-w-0`}>
                    {(!data || isValidating) && !error ? (
                        <Spinner size={'large'} centered />
                    ) : error ? (
                        <p css={tw`text-sm text-neutral-300 text-center`}>
                            Failed to load modpacks. Check your network or provider configuration.
                        </p>
                    ) : (
                        <Pagination data={data!} onPageSelect={setPage}>
                            {({ items }) =>
                                !items.length ? (
                                    <p css={tw`text-sm text-neutral-300 text-center`}>
                                        No modpacks found. Try a different search term.
                                    </p>
                                ) : (
                                    <GreyRowBox css={tw`flex-col p-0 overflow-hidden items-stretch`}>
                                        <div css={tw`grid grid-cols-1 sm:grid-cols-2 divide-y divide-neutral-600`}>
                                            {items.map((modpack) => (
                                                <ModpackRow
                                                    key={modpack.id}
                                                    modpack={modpack}
                                                    provider={provider}
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
