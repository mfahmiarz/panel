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
import AddonRow from '@/components/server/bedrock/addons/AddonRow';
import InstalledAddons from '@/components/server/bedrock/addons/InstalledAddons';
import { getAddons } from '@/api/server/bedrock/addons';
const CATEGORY_OPTIONS = [
    { value: 0, label: 'All Categories' },
    { value: 4984, label: 'Addons' },
    { value: 6913, label: 'Maps (World Templates)' },
    { value: 6929, label: 'Texture Packs' },
    { value: 6940, label: 'Scripts (Scenarios)' },
    { value: 6925, label: 'Skins' },
];
const PER_PAGE_OPTIONS = [10, 20, 50];
export default () => {
    const uuid = ServerContext.useStoreState((s) => s.server.data!.uuid);
    const { clearFlashes } = useFlash();
    const [refreshTrigger, setRefreshTrigger] = useState(0);
    const [query, setQuery] = useState('');
    const [inputValue, setInputValue] = useState('');
    const [page, setPage] = useState(1);
    const [perPage, setPerPage] = useState(20);
    const [categoryId, setCategoryId] = useState<number>(0);
    const { data, error, isValidating } = useSWR(
        ['server:bedrock:addons', uuid, query, page, perPage, categoryId],
        () => getAddons(uuid, query, page, perPage, categoryId === 0 ? undefined : categoryId),
        { revalidateOnFocus: false }
    );
    const searchTimeoutRef = useRef<number | null>(null);
    const handleSearch = (e: React.ChangeEvent<HTMLInputElement>) => {
        const value = e.target.value;
        setInputValue(value);
        if (searchTimeoutRef.current) {
            window.clearTimeout(searchTimeoutRef.current);
        }
        searchTimeoutRef.current = window.setTimeout(() => {
            clearFlashes('addons');
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
    const onCategoryChange = (val: number) => {
        clearFlashes('addons');
        setCategoryId(val);
        setPage(1);
    };
    return (
        <ServerContentBlock title={'Addon Installer'}>
            <FlashMessageRender byKey={'addons'} css={tw`mb-4`} />
            <div css={tw`flex flex-col lg:flex-row gap-4`}>
                <div css={tw`w-full lg:w-64 lg:order-last flex-shrink-0 lg:sticky lg:top-4 lg:self-start`}>
                    <GreyRowBox css={tw`flex-col items-stretch gap-4 p-4`}>
                        <div css={tw`w-full`}>
                            <Label htmlFor={'addon-category'}>Category</Label>
                            <Select
                                id={'addon-category'}
                                value={categoryId}
                                onChange={(e) => onCategoryChange(Number(e.target.value))}
                                css={tw`mt-1`}
                            >
                                {CATEGORY_OPTIONS.map((c) => (
                                    <option key={c.value} value={c.value}>{c.label}</option>
                                ))}
                            </Select>
                        </div>
                        <div css={tw`w-full`}>
                            <Label htmlFor={'addon-search'}>Search</Label>
                            <Input
                                id={'addon-search'}
                                type={'text'}
                                placeholder={'Search addons…'}
                                value={inputValue}
                                onChange={handleSearch}
                                css={tw`mt-1`}
                            />
                        </div>
                        <div css={tw`w-full`}>
                            <Label htmlFor={'addon-per-page'}>Per page</Label>
                            <Select
                                id={'addon-per-page'}
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
                        <InstalledAddons
                            onRefreshTriggered={() => setRefreshTrigger((prev) => prev + 1)}
                        />
                    </GreyRowBox>
                </div>
                <div css={tw`flex-1 min-w-0`}>
                    {(!data || isValidating) && !error ? (
                        <Spinner size={'large'} centered />
                    ) : error ? (
                        <p css={tw`text-sm text-neutral-300 text-center`}>
                            Failed to load addons. Check your network or CurseForge API key.
                        </p>
                    ) : (
                        <Pagination data={data!} onPageSelect={setPage}>
                            {({ items }) =>
                                !items.length ? (
                                    <p css={tw`text-sm text-neutral-300 text-center`}>
                                        No addons found. Try a different search term or category.
                                    </p>
                                ) : (
                                    <GreyRowBox css={tw`flex-col p-0 overflow-hidden items-stretch`}>
                                        <div css={tw`grid grid-cols-1 sm:grid-cols-2 divide-y divide-neutral-600`}>
                                            {items.map((addon) => (
                                                <AddonRow
                                                    key={addon.id}
                                                    addon={addon}
                                                    onInstalled={() => setRefreshTrigger((prev) => prev + 1)}
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
