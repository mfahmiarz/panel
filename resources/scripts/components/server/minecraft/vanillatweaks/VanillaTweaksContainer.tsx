import React, { useState, useEffect, useMemo } from 'react';
import tw from 'twin.macro';
import { ServerContext } from '@/state/server';
import useFlash from '@/plugins/useFlash';
import ServerContentBlock from '@/components/elements/ServerContentBlock';
import FlashMessageRender from '@/components/FlashMessageRender';
import Spinner from '@/components/elements/Spinner';
import Input from '@/components/elements/Input';
import Label from '@/components/elements/Label';
import Select from '@/components/elements/Select';
import GreyRowBox from '@/components/elements/GreyRowBox';
import { Button } from '@/components/elements/button/index';
import { VanillaTweaksPack, VanillaTweaksType, getPacks, installPacks, getVersions } from '@/api/server/minecraft/vanillatweaks';
const TYPES: { value: VanillaTweaksType; label: string }[] = [
    { value: 'datapacks', label: 'Data Packs' },
    { value: 'resourcepacks', label: 'Resource Packs' },
    { value: 'craftingtweaks', label: 'Crafting Tweaks' },
];
export default () => {
    const uuid = ServerContext.useStoreState((s) => s.server.data!.uuid);
    const { addFlash, clearFlashes } = useFlash();
    const [type, setType] = useState<VanillaTweaksType>('datapacks');
    const [mcVersion, setMcVersion] = useState('');
    const [mcVersions, setMcVersions] = useState<string[]>([]);
    const [subCategory, setSubCategory] = useState<string>('all');
    const [query, setQuery] = useState('');
    const [packs, setPacks] = useState<VanillaTweaksPack[]>([]);
    const [loading, setLoading] = useState(false);
    const [installing, setInstalling] = useState(false);
    const [downloadProgress, setDownloadProgress] = useState(0);
    const [selected, setSelected] = useState<Set<string>>(new Set());
    useEffect(() => {
        getVersions(uuid)
            .then((releases) => {
                setMcVersions(releases);
                if (releases.length > 0 && !releases.includes(mcVersion)) {
                    setMcVersion(releases[0]);
                }
            })
            .catch((err) => console.error('Failed to fetch versions', err));
    }, [uuid]);
    useEffect(() => {
        if (!mcVersion) return;
        setLoading(true);
        setSelected(new Set());
        getPacks(uuid, type, mcVersion)
            .then((data) => {
                setPacks(data);
                setSubCategory('all');
            })
            .catch((err) => {
                clearFlashes('vanillatweaks');
                addFlash({ type: 'error', key: 'vanillatweaks', message: 'Failed to load packs from VanillaTweaks.' });
                setPacks([]);
            })
            .finally(() => setLoading(false));
    }, [uuid, type, mcVersion]);
    const togglePack = (id: string) => {
        const newSelected = new Set(selected);
        if (newSelected.has(id)) {
            newSelected.delete(id);
        } else {
            newSelected.add(id);
        }
        setSelected(newSelected);
    };
    const handleInstall = () => {
        if (selected.size === 0) return;
        setInstalling(true);
        setDownloadProgress(0);
        clearFlashes('vanillatweaks');
        const progressInterval = setInterval(() => {
            setDownloadProgress(prev => (prev < 90 ? prev + 10 : prev));
        }, 500);
        installPacks(uuid, type, mcVersion, Array.from(selected))
            .then(() => {
                setDownloadProgress(100);
                setTimeout(() => {
                    addFlash({
                        type: 'success',
                        key: 'vanillatweaks',
                        message: `Successfully installed ${selected.size} packs. Check your server files.`,
                    });
                    setSelected(new Set());
                }, 500);
            })
            .catch((err) => {
                addFlash({
                    type: 'error',
                    key: 'vanillatweaks',
                    message: 'Failed to install packs.',
                });
            })
            .finally(() => {
                clearInterval(progressInterval);
                setTimeout(() => {
                    setInstalling(false);
                    setDownloadProgress(0);
                }, 500);
            });
    };
    const subCategories = useMemo(() => Array.from(new Set(packs.map((p) => p.category))).sort(), [packs]);
    const filteredPacks = packs.filter((p) => {
        if (subCategory !== 'all' && p.category !== subCategory) return false;
        if (query && !p.name.toLowerCase().includes(query.toLowerCase())) return false;
        return true;
    });
    return (
        <ServerContentBlock title={'VanillaTweaks Installer'}>
            <FlashMessageRender byKey={'vanillatweaks'} css={tw`mb-4`} />
            <div css={tw`flex flex-col lg:flex-row gap-4`}>
                <div css={tw`w-full lg:w-64 lg:order-last flex-shrink-0 lg:sticky lg:top-4 lg:self-start`}>
                    <GreyRowBox css={tw`flex-col items-stretch gap-4 p-4`}>
                        <div css={tw`w-full`}>
                            <Label htmlFor={'pack-type'}>Category</Label>
                            <Select
                                id={'pack-type'}
                                value={type}
                                onChange={(e) => setType(e.target.value as VanillaTweaksType)}
                                css={tw`mt-1`}
                            >
                                {TYPES.map((t) => (
                                    <option key={t.value} value={t.value}>{t.label}</option>
                                ))}
                            </Select>
                        </div>
                        <div css={tw`w-full`}>
                            <Label htmlFor={'pack-subcategory'}>Sub Category</Label>
                            <Select
                                id={'pack-subcategory'}
                                value={subCategory}
                                onChange={(e) => setSubCategory(e.target.value)}
                                css={tw`mt-1`}
                            >
                                <option value={'all'}>All Categories</option>
                                {subCategories.map((c) => (
                                    <option key={c} value={c}>{c}</option>
                                ))}
                            </Select>
                        </div>
                        <div css={tw`w-full`}>
                            <Label htmlFor={'mc-version'}>Minecraft Version</Label>
                            <Select
                                id={'mc-version'}
                                value={mcVersion}
                                onChange={(e) => setMcVersion(e.target.value)}
                                css={tw`mt-1`}
                            >
                                {mcVersions.map((v) => (
                                    <option key={v} value={v}>{v}</option>
                                ))}
                            </Select>
                        </div>
                        <div css={tw`w-full`}>
                            <Label htmlFor={'pack-search'}>Search</Label>
                            <Input
                                id={'pack-search'}
                                type={'text'}
                                placeholder={'Search packs…'}
                                value={query}
                                onChange={(e) => setQuery(e.target.value)}
                                css={tw`mt-1`}
                            />
                        </div>
                        <div css={tw`border-t border-neutral-600 w-full`} />
                        <div css={tw`w-full`}>
                            <Button
                                css={tw`w-full`}
                                disabled={selected.size === 0 || installing}
                                onClick={handleInstall}
                            >
                                {installing ? `Installing... (${downloadProgress}%)` : `Install (${selected.size})`}
                            </Button>
                        </div>
                    </GreyRowBox>
                </div>
                <div css={tw`flex-1 min-w-0`}>
                    {loading ? (
                        <Spinner size={'large'} centered />
                    ) : filteredPacks.length === 0 ? (
                        <p css={tw`text-sm text-neutral-300 text-center`}>
                            No packs found. Try a different search term or version.
                        </p>
                    ) : (
                        <GreyRowBox css={tw`flex-col p-0 overflow-hidden items-stretch`}>
                            <div css={tw`grid grid-cols-1 sm:grid-cols-2 divide-y divide-neutral-600`}>
                                {filteredPacks.map((pack) => (
                                    <div
                                        key={pack.id}
                                        onClick={() => togglePack(pack.id)}
                                        css={[
                                            tw`flex items-center gap-3 p-3 cursor-pointer hover:bg-neutral-600 transition-colors`,
                                            selected.has(pack.id) && tw`bg-neutral-600/50`
                                        ]}
                                    >
                                        {pack.icon_url ? (
                                            <img
                                                src={pack.icon_url}
                                                alt={''}
                                                css={tw`w-10 h-10 rounded flex-shrink-0 object-cover bg-neutral-600`}
                                                onError={(e) => { (e.target as HTMLImageElement).style.display = 'none'; }}
                                            />
                                        ) : (
                                            <div css={tw`w-10 h-10 rounded flex-shrink-0 bg-neutral-600`} />
                                        )}
                                        <div css={tw`flex-1 min-w-0`}>
                                            <p css={[tw`text-sm truncate`, selected.has(pack.id) ? tw`text-yellow-500` : tw`text-neutral-100`]}>{pack.name}</p>
                                            {pack.description && (
                                                <p css={tw`text-xs text-neutral-400 truncate mt-0.5`} title={pack.description}>{pack.description}</p>
                                            )}
                                        </div>
                                    </div>
                                ))}
                            </div>
                        </GreyRowBox>
                    )}
                </div>
            </div>
        </ServerContentBlock>
    );
};
