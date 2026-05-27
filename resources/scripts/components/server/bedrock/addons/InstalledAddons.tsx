import React, { useEffect, useState, useRef } from 'react';
import { BedrockPack, BedrockPacksData, getPacks, savePacks, setDefaultWorld, deletePack, getPackIconUrl } from '@/api/server/bedrock/addons';
import { ServerContext } from '@/state/server';
import useFlash from '@/plugins/useFlash';
import { Button } from '@/components/elements/button';
import { Dialog } from '@/components/elements/dialog';
import Spinner from '@/components/elements/Spinner';
import { CheckIcon, TrashIcon, MenuIcon, ColorSwatchIcon, CodeIcon, GlobeIcon, StarIcon } from '@heroicons/react/outline';
interface InstalledAddonsProps {
    onRefreshTriggered: () => void;
}
export default ({ onRefreshTriggered }: InstalledAddonsProps) => {
    const uuid = ServerContext.useStoreState((state) => state.server.data!.uuid);
    const [open, setOpen] = useState(false);
    const { addFlash, clearFlashes } = useFlash();
    const [loadingPacks, setLoadingPacks] = useState(false);
    const [packsData, setPacksData] = useState<BedrockPacksData | null>(null);
    const [activeBP, setActiveBP] = useState<BedrockPack[]>([]);
    const [activeRP, setActiveRP] = useState<BedrockPack[]>([]);
    const [activeTab, setActiveTab] = useState<'behavior' | 'resource' | 'worlds'>('behavior');
    const [draggedIndex, setDraggedIndex] = useState<number | null>(null);
    const [dragOverIndex, setDragOverIndex] = useState<number | null>(null);
    const dragNode = useRef<HTMLDivElement | null>(null);
    const [savingPacks, setSavingPacks] = useState(false);
    const [settingDefault, setSettingDefault] = useState<string | null>(null);
    const [deleting, setDeleting] = useState<string | null>(null);
    const [hasChanges, setHasChanges] = useState(false);
    useEffect(() => {
        if (open) fetchAllData();
    }, [open]);
    const fetchAllData = () => {
        setLoadingPacks(true);
        getPacks(uuid)
            .then((packs) => {
                setPacksData(packs);
                const processTab = (installed: BedrockPack[], activeConfigs: any[]) => {
                    const activeList: BedrockPack[] = [];
                    (activeConfigs || []).forEach(ac => {
                        let pack = undefined;
                        if (ac.path) {
                            const folderName = ac.path.split('/').pop();
                            pack = installed.find(p => p.folder_name === folderName);
                        }
                        if (!pack) {
                            pack = installed.find(p => p.uuid === ac.pack_id && ac.pack_id !== '');
                        }
                        if (pack && !activeList.some(p => p.folder_name === pack.folder_name)) {
                            activeList.push(pack);
                        }
                    });
                    installed.forEach(pack => {
                        if (!activeList.some(p => p.folder_name === pack.folder_name)) {
                            activeList.push(pack);
                        }
                    });
                    return activeList;
                };
                setActiveBP(processTab(packs.behavior_packs, packs.active_behavior_packs));
                setActiveRP(processTab(packs.resource_packs, packs.active_resource_packs));
                setHasChanges(false);
            })
            .catch((err) => {
                console.error(err);
                addFlash({ type: 'error', key: 'addons', message: 'Failed to load packs.' });
            })
            .finally(() => setLoadingPacks(false));
    };
    const handleDeletePack = (type: 'behavior' | 'resource' | 'world', folder: string, name: string) => {
        setDeleting(folder);
        clearFlashes('addons');
        deletePack(uuid, type, folder)
            .then(() => {
                addFlash({
                    type: 'success',
                    key: 'addons',
                    message: `Successfully deleted "${name}".`,
                });
                onRefreshTriggered();
                fetchAllData();
            })
            .catch(() => addFlash({ type: 'error', key: 'addons', message: 'Failed to delete pack.' }))
            .finally(() => setDeleting(null));
    };
    const swapItems = (fromIndex: number, toIndex: number) => {
        const list = activeTab === 'behavior' ? [...activeBP] : [...activeRP];
        [list[fromIndex], list[toIndex]] = [list[toIndex], list[fromIndex]];
        if (activeTab === 'behavior') setActiveBP(list);
        else setActiveRP(list);
        setHasChanges(true);
    };
    const handleDragStart = (e: React.DragEvent<HTMLDivElement>, index: number) => {
        setDraggedIndex(index);
        dragNode.current = e.currentTarget;
        const dragImage = document.createElement('div');
        dragImage.style.opacity = '0';
        document.body.appendChild(dragImage);
        e.dataTransfer.setDragImage(dragImage, 0, 0);
        setTimeout(() => document.body.removeChild(dragImage), 0);
        e.dataTransfer.effectAllowed = 'move';
    };
    const handleDragEnter = (index: number) => {
        if (draggedIndex === null || draggedIndex === index) return;
        swapItems(draggedIndex, index);
        setDraggedIndex(index);
        setDragOverIndex(index);
    };
    const handleDragOver = (e: React.DragEvent) => {
        e.preventDefault();
        e.dataTransfer.dropEffect = 'move';
    };
    const handleDragEnd = () => {
        setDraggedIndex(null);
        setDragOverIndex(null);
        dragNode.current = null;
    };
    const handleSavePacks = () => {
        setSavingPacks(true);
        clearFlashes('addons');
        const payloadBP = activeBP.map(p => ({
            pack_id: p.uuid,
            version: p.version ? p.version.split('.').map(Number) : [1, 0, 0],
            name: p.name,
            path: `behavior_packs/${p.folder_name}`,
            has_icon: p.has_icon
        }));
        const payloadRP = activeRP.map(p => ({
            pack_id: p.uuid,
            version: p.version ? p.version.split('.').map(Number) : [1, 0, 0],
            name: p.name,
            path: `resource_packs/${p.folder_name}`,
            has_icon: p.has_icon
        }));
        savePacks(uuid, payloadBP, payloadRP)
            .then(() => {
                addFlash({ type: 'success', key: 'addons', message: 'Priority updated successfully.' });
                setHasChanges(false);
                fetchAllData();
            })
            .catch(() => {
                addFlash({ type: 'error', key: 'addons', message: 'Failed to update priority.' });
            })
            .finally(() => setSavingPacks(false));
    };
    const handleSaveWorld = (worldName: string) => {
        setSettingDefault(worldName);
        clearFlashes('addons');
        setDefaultWorld(uuid, worldName)
            .then(() => {
                addFlash({ type: 'success', key: 'addons', message: `"${worldName}" set as default world. Restart server to apply.` });
                fetchAllData();
            })
            .catch(() => {
                addFlash({ type: 'error', key: 'addons', message: 'Failed to set default world.' });
            })
            .finally(() => setSettingDefault(null));
    };
    const renderPackRow = (pack: BedrockPack, type: 'behavior' | 'resource', index: number) => {
        const targetDir = type === 'behavior' ? 'behavior_packs' : 'resource_packs';
        return (
            <div
                key={pack.folder_name}
                draggable
                onDragStart={(e) => handleDragStart(e, index)}
                onDragEnter={() => handleDragEnter(index)}
                onDragOver={handleDragOver}
                onDragEnd={handleDragEnd}
                style={{
                    transition: 'transform 0.2s ease, opacity 0.2s ease',
                    opacity: draggedIndex === index ? 0.5 : 1,
                }}
                className={`bg-neutral-700 rounded p-3 flex items-center gap-3 cursor-grab active:cursor-grabbing hover:bg-neutral-600`}
            >
                <div className='text-neutral-500 hover:text-neutral-300'>
                    <MenuIcon className='w-5 h-5' />
                </div>
                <div
                    className={`w-10 h-10 rounded flex items-center justify-center overflow-hidden shrink-0 ${type === 'behavior' ? 'bg-orange-500/20' : 'bg-blue-500/20'
                        }`}
                >
                    {pack.has_icon ? (
                        <img
                            src={getPackIconUrl(uuid, `/${targetDir}/${pack.folder_name}`)}
                            alt={pack.name}
                            className='w-10 h-10 object-cover'
                            onError={(e) => {
                                e.currentTarget.style.display = 'none';
                                e.currentTarget.nextElementSibling?.classList.remove('hidden');
                            }}
                        />
                    ) : null}
                    <div className={`${pack.has_icon ? 'hidden' : ''}`}>
                        {type === 'behavior' ? (
                            <CodeIcon className='w-5 h-5 text-orange-400' />
                        ) : (
                            <ColorSwatchIcon className='w-5 h-5 text-blue-400' />
                        )}
                    </div>
                </div>
                <div className='flex-1 min-w-0'>
                    <p className='text-neutral-100 font-medium truncate flex items-center gap-2'>
                        {pack.name}
                    </p>
                    <p className='text-neutral-400 text-xs truncate'>
                        v{pack.version} • {pack.folder_name}
                    </p>
                </div>
                <div className='flex items-center gap-2'>
                    <span className='text-xs text-neutral-500 bg-neutral-800 px-2 py-1 rounded hidden sm:inline-block'>
                        #{index + 1}
                    </span>
                    <button
                        onClick={(e) => {
                            e.stopPropagation();
                            handleDeletePack(type, pack.folder_name, pack.name);
                        }}
                        disabled={deleting !== null}
                        className='text-red-400 hover:text-red-300 disabled:opacity-50 p-2 hover:bg-red-500/10 rounded transition-colors'
                        title='Delete addon'
                    >
                        {deleting === pack.folder_name ? (
                            <Spinner size='small' />
                        ) : (
                            <TrashIcon className='w-5 h-5' />
                        )}
                    </button>
                </div>
            </div>
        );
    };
    return (
        <div className='w-full'>
            <Button
                type={'button'}
                onClick={() => setOpen(true)}
                className='w-full'
            >
                Installed Addons
            </Button>
            <Dialog open={open} onClose={() => !deleting && !savingPacks && !settingDefault && setOpen(false)} title='Manage Addons'>
                <div className='flex border-b border-neutral-700 mb-4'>
                    <button
                        onClick={() => setActiveTab('behavior')}
                        className={`flex items-center gap-2 px-4 py-2 text-sm transition-colors ${activeTab === 'behavior'
                            ? 'text-neutral-200 border-b-2 border-neutral-400 outline-none'
                            : 'text-neutral-400 hover:text-neutral-200 outline-none'
                            }`}
                    >
                        <CodeIcon className='w-4 h-4' />
                        Behavior ({packsData?.behavior_packs.length || 0})
                    </button>
                    <button
                        onClick={() => setActiveTab('resource')}
                        className={`flex items-center gap-2 px-4 py-2 text-sm transition-colors ${activeTab === 'resource'
                            ? 'text-neutral-200 border-b-2 border-neutral-400 outline-none'
                            : 'text-neutral-400 hover:text-neutral-200 outline-none'
                            }`}
                    >
                        <ColorSwatchIcon className='w-4 h-4' />
                        Resource ({packsData?.resource_packs.length || 0})
                    </button>
                    <button
                        onClick={() => setActiveTab('worlds')}
                        className={`flex items-center gap-2 px-4 py-2 text-sm transition-colors ${activeTab === 'worlds'
                            ? 'text-neutral-200 border-b-2 border-neutral-400 outline-none'
                            : 'text-neutral-400 hover:text-neutral-200 outline-none'
                            }`}
                    >
                        <GlobeIcon className='w-4 h-4' />
                        Worlds ({packsData?.worlds.length || 0})
                    </button>
                </div>
                {loadingPacks ? (
                    <div className='flex justify-center py-8'>
                        <Spinner size='large' />
                    </div>
                ) : activeTab === 'worlds' ? (
                    <div className='h-80 overflow-y-auto pr-1'>
                        {(!packsData || packsData.worlds.length === 0) ? (
                            <div className='text-center py-8 text-neutral-500'>
                                <GlobeIcon className='w-12 h-12 mx-auto opacity-50 mb-2' />
                                <p>No worlds found.</p>
                            </div>
                        ) : (
                            <div className='space-y-2'>
                                {packsData.worlds.map((worldName) => {
                                    const isDefault = packsData.default_world === worldName;
                                    return (
                                        <div key={worldName} className='bg-neutral-700 rounded p-3 flex items-center gap-3'>
                                            <div className='w-10 h-10 rounded flex items-center justify-center bg-green-500/20'>
                                                <GlobeIcon className='w-5 h-5 text-green-400' />
                                            </div>
                                            <div className='flex-1 min-w-0'>
                                                <div className='flex items-center gap-2'>
                                                    <p className='text-neutral-100 font-medium truncate'>
                                                        {worldName}
                                                    </p>
                                                    {isDefault && (
                                                        <span className='text-xs bg-green-500/20 text-green-400 px-2 py-0.5 rounded flex items-center gap-1'>
                                                            <CheckIcon className='w-3 h-3' />
                                                            Default
                                                        </span>
                                                    )}
                                                </div>
                                            </div>
                                            <div className='flex items-center gap-1'>
                                                {!isDefault && (
                                                    <button
                                                        onClick={() => handleSaveWorld(worldName)}
                                                        disabled={settingDefault !== null || deleting !== null}
                                                        className='text-yellow-400 hover:text-yellow-300 disabled:opacity-50 p-2 hover:bg-yellow-500/10 rounded transition-colors'
                                                        title='Set as default'
                                                    >
                                                        {settingDefault === worldName ? (
                                                            <Spinner size='small' />
                                                        ) : (
                                                            <StarIcon className='w-5 h-5' />
                                                        )}
                                                    </button>
                                                )}
                                                <button
                                                    onClick={() => handleDeletePack('world', worldName, worldName)}
                                                    disabled={deleting !== null || settingDefault !== null || isDefault}
                                                    className='text-red-400 hover:text-red-300 disabled:opacity-50 disabled:cursor-not-allowed p-2 hover:bg-red-500/10 rounded transition-colors'
                                                    title={isDefault ? 'Cannot delete default world' : 'Delete world'}
                                                >
                                                    {deleting === worldName ? (
                                                        <Spinner size='small' />
                                                    ) : (
                                                        <TrashIcon className='w-5 h-5' />
                                                    )}
                                                </button>
                                            </div>
                                        </div>
                                    );
                                })}
                            </div>
                        )}
                    </div>
                ) : (
                    <div className='h-80 overflow-y-auto pr-1 flex flex-col gap-6'>
                        {packsData && activeTab === 'behavior' && (
                            <div>
                                <div className="space-y-2">
                                    {activeBP.length === 0 && <p className="text-xs text-neutral-500 italic px-2">No behavior packs found.</p>}
                                    {activeBP.map((pack, idx) => renderPackRow(pack, 'behavior', idx))}
                                </div>
                            </div>
                        )}
                        {packsData && activeTab === 'resource' && (
                            <div>
                                <div className="space-y-2">
                                    {activeRP.length === 0 && <p className="text-xs text-neutral-500 italic px-2">No resource packs found.</p>}
                                    {activeRP.map((pack, idx) => renderPackRow(pack, 'resource', idx))}
                                </div>
                            </div>
                        )}
                    </div>
                )}
                <Dialog.Footer>
                    <Button.Text onClick={() => setOpen(false)}>Close</Button.Text>
                    {hasChanges && (
                        <Button onClick={handleSavePacks} disabled={savingPacks}>
                            {savingPacks ? (
                                <span className='flex items-center'>
                                    <Spinner size='small' />
                                    <span className='ml-2'>Applying...</span>
                                </span>
                            ) : (
                                'Apply'
                            )}
                        </Button>
                    )}
                </Dialog.Footer>
            </Dialog>
        </div>
    );
};
