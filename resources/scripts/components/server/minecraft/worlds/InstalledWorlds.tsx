import React, { useEffect, useState, useRef } from 'react';
import tw from 'twin.macro';
import { ServerContext } from '@/state/server';
import useFlash from '@/plugins/useFlash';
import { Dialog } from '@/components/elements/dialog';
import { Button } from '@/components/elements/button/index';
import Spinner from '@/components/elements/Spinner';
import Select from '@/components/elements/Select';
import {
    getInstalledWorlds,
    uninstallWorld,
    getWorldVersions,
    installWorld,
    InstalledWorld,
    WorldVersion,
    WorldProvider,
    setActiveWorld
} from '@/api/server/minecraft/worlds';
interface Props {
    refreshTrigger: number;
    onRefreshTriggered: () => void;
}
export default ({ refreshTrigger, onRefreshTriggered }: Props) => {
    const uuid = ServerContext.useStoreState((s) => s.server.data!.uuid);
    const { addFlash, clearFlashes } = useFlash();
    const [open, setOpen] = useState(false);
    const [loading, setLoading] = useState(false);
    const [worlds, setWorlds] = useState<InstalledWorld[]>([]);
    const [uninstalling, setUninstalling] = useState<string | null>(null);
    const [updatingWorld, setUpdatingWorld] = useState<InstalledWorld | null>(null);
    const [versions, setVersions] = useState<WorldVersion[]>([]);
    const [loadingVersions, setLoadingVersions] = useState(false);
    const [selectedVersion, setSelectedVersion] = useState<string>('');
    const [isUpdating, setIsUpdating] = useState(false);
    const [downloadProgress, setDownloadProgress] = useState(0);
    const [errorText, setErrorText] = useState<string | null>(null);
    const [settingActive, setSettingActive] = useState<string | null>(null);
    const intervalRef = useRef<number | null>(null);
    const clearActiveInterval = () => {
        if (intervalRef.current) {
            window.clearInterval(intervalRef.current);
            intervalRef.current = null;
        }
    };
    useEffect(() => {
        return () => clearActiveInterval();
    }, []);
    const handleSetActive = (world: InstalledWorld) => {
        setSettingActive(world.world_id);
        clearFlashes('worlds');
        setActiveWorld(uuid, world.world_id, world.provider)
            .then(() => {
                addFlash({
                    type: 'success',
                    key: 'worlds',
                    message: `Successfully set "${world.world_name || 'World'}" as the default world in server.properties.`,
                });
                onRefreshTriggered();
                loadInstalled();
            })
            .catch(() => addFlash({ type: 'error', key: 'worlds', message: 'Failed to set world as active.' }))
            .finally(() => setSettingActive(null));
    };
    const loadInstalled = () => {
        setLoading(true);
        getInstalledWorlds(uuid)
            .then((data) => setWorlds(data))
            .catch(() => addFlash({ type: 'error', key: 'worlds', message: 'Failed to load installed worlds.' }))
            .finally(() => setLoading(false));
    };
    useEffect(() => {
        if (open) {
            loadInstalled();
        }
    }, [uuid, open, refreshTrigger]);
    const handleUninstall = (world: InstalledWorld) => {
        setUninstalling(world.world_id);
        clearFlashes('worlds');
        uninstallWorld(uuid, world.world_id, world.provider)
            .then(() => {
                addFlash({
                    type: 'success',
                    key: 'worlds',
                    message: `Successfully removed "${world.world_name || 'World'}" from local records. Note: to delete the actual world folder, please use the File Manager.`,
                });
                onRefreshTriggered();
                loadInstalled();
            })
            .catch(() => addFlash({ type: 'error', key: 'worlds', message: 'Failed to uninstall world.' }))
            .finally(() => setUninstalling(null));
    };
    const startUpdate = (world: InstalledWorld) => {
        setUpdatingWorld(world);
        setErrorText(null);
        setDownloadProgress(0);
        setLoadingVersions(true);
        setVersions([]);
        setSelectedVersion('');
        getWorldVersions(uuid, world.provider as WorldProvider, world.world_id, '')
            .then((v) => {
                setVersions(v);
                if (v.length > 0) {
                    setSelectedVersion(v[0].id);
                }
            })
            .catch(() => addFlash({ type: 'error', key: 'worlds', message: 'Failed to load world versions for update.' }))
            .finally(() => setLoadingVersions(false));
    };
    const handleUpdateConfirm = () => {
        if (!updatingWorld || !selectedVersion) return;
        setIsUpdating(true);
        setDownloadProgress(0);
        setErrorText(null);
        clearFlashes('worlds');
        let currentProgress = 0;
        const interval = window.setInterval(() => {
            setDownloadProgress((prev) => {
                if (prev < 90) {
                    const next = prev + (90 - prev) * 0.12;
                    currentProgress = next;
                    return next;
                }
                return prev;
            });
        }, 1500);
        installWorld(
            uuid,
            updatingWorld.provider as WorldProvider,
            updatingWorld.world_id,
            selectedVersion,
            '',
            null,
            updatingWorld.world_name,
            updatingWorld.world_icon,
            updatingWorld.world_author
        )
            .then(() => {
                window.clearInterval(interval);
                setDownloadProgress(100);
                setTimeout(() => {
                    setUpdatingWorld(null);
                    onRefreshTriggered();
                    loadInstalled();
                    clearFlashes('worlds');
                    addFlash({
                        type: 'success',
                        key: 'worlds',
                        message: `"${updatingWorld?.world_name}" has been successfully updated.`,
                    });
                    setIsUpdating(false);
                    setDownloadProgress(0);
                }, 1000);
            })
            .catch((err) => {
                window.clearInterval(interval);
                clearFlashes('worlds');
                const msg = err.response?.data?.errors?.[0]?.detail || 'Failed to request world update.';
                addFlash({ type: 'error', key: 'worlds', message: msg });
                setErrorText(msg);
                setIsUpdating(false);
                setDownloadProgress(0);
            });
    };
    const handleCloseUpdate = () => {
        if (!isUpdating) {
            setUpdatingWorld(null);
            setErrorText(null);
        }
    };
    return (
        <div css={tw`w-full`}>
            <Button
                onClick={() => setOpen(true)}
                css={tw`w-full`}
            >
                Installed Worlds
            </Button>
            <Dialog
                open={open}
                onClose={() => !uninstalling && setOpen(false)}
                title={'Installed Worlds'}
            >
                {loading && worlds.length === 0 ? (
                    <div css={tw`w-full py-8 flex justify-center`}>
                        <Spinner size={'large'} />
                    </div>
                ) : worlds.length === 0 ? (
                    <p css={tw`text-sm text-neutral-400 py-6 text-center`}>No worlds installed on this server yet.</p>
                ) : (
                    <div css={tw`flex flex-col gap-3 py-2 max-h-[400px] overflow-y-auto`}>
                        {worlds.map((entry) => (
                            <div
                                key={`${entry.provider}:${entry.world_id}`}
                                css={tw`flex items-center justify-between p-3 bg-neutral-800 rounded border border-neutral-700`}
                            >
                                <div css={tw`flex items-center gap-3 min-w-0 flex-1`}>
                                    <div css={tw`relative w-10 h-10 flex-shrink-0`}>
                                        {entry.world_icon ? (
                                            <img
                                                src={entry.world_icon}
                                                alt={''}
                                                css={tw`w-full h-full rounded object-cover bg-neutral-700`}
                                                onError={(e) => { (e.target as HTMLImageElement).style.display = 'none'; }}
                                            />
                                        ) : (
                                            <div css={tw`w-full h-full rounded bg-neutral-700 flex items-center justify-center`}>
                                                <svg css={tw`w-5 h-5 text-neutral-400`} fill='none' stroke='currentColor' viewBox='0 0 24 24'>
                                                    <path strokeLinecap='round' strokeLinejoin='round' strokeWidth={2} d='M3.055 11H5a2 2 0 012 2v1a2 2 0 002 2 2 2 0 012 2v2.945M8 3.935V5.5A2.5 2.5 0 0010.5 8h.5a2 2 0 012 2 2 2 0 002 2h2.5M12 21a9 9 0 100-18 9 9 0 000 18z' />
                                                </svg>
                                            </div>
                                        )}
                                        {entry.is_active && (
                                            <div css={tw`absolute -top-1 -right-1 bg-yellow-500 rounded-full p-0.5 shadow flex items-center justify-center`}>
                                                <svg css={tw`w-2.5 h-2.5 text-neutral-900`} fill='currentColor' viewBox='0 0 20 20'>
                                                    <path d='M9.049 2.927c.3-.921 1.603-.921 1.902 0l1.07 3.292a1 1 0 00.95.69h3.462c.969 0 1.371 1.24.588 1.81l-2.8 2.034a1 1 0 00-.364 1.118l1.07 3.292c.3.921-.755 1.688-1.54 1.118l-2.8-2.034a1 1 0 00-1.175 0l-2.8 2.034c-.784.57-1.838-.197-1.539-1.118l1.07-3.292a1 1 0 00-.364-1.118L2.98 8.72c-.783-.57-.38-1.81.588-1.81h3.461a1 1 0 00.951-.69l1.07-3.292z' />
                                                </svg>
                                            </div>
                                        )}
                                    </div>
                                    <div css={tw`min-w-0 flex-1`}>
                                        <p css={tw`text-sm font-semibold text-neutral-200 truncate`} title={entry.world_name}>
                                            {entry.world_name || `World ${entry.world_id}`}
                                        </p>
                                        <p css={tw`text-xs text-neutral-400 truncate`}>
                                            {entry.provider} • {entry.file_name}
                                        </p>
                                    </div>
                                </div>
                                <div css={tw`flex items-center gap-2 ml-3 flex-shrink-0`}>
                                    {!entry.is_active && (
                                        <Button
                                            size={Button.Sizes.Small}
                                            onClick={() => handleSetActive(entry)}
                                            disabled={settingActive !== null || uninstalling !== null}
                                        >
                                            {settingActive === entry.world_id ? 'Setting...' : 'Set Default'}
                                        </Button>
                                    )}
                                    {entry.has_update && (
                                        <Button
                                            size={Button.Sizes.Small}
                                            onClick={() => startUpdate(entry)}
                                            disabled={uninstalling !== null || settingActive !== null}
                                            css={tw`bg-neutral-600 hover:bg-neutral-500`}
                                        >
                                            Update
                                        </Button>
                                    )}
                                    <Button.Danger
                                        size={Button.Sizes.Small}
                                        onClick={() => handleUninstall(entry)}
                                        disabled={uninstalling !== null || settingActive !== null}
                                    >
                                        {uninstalling === entry.world_id ? 'Removing...' : 'Uninstall'}
                                    </Button.Danger>
                                </div>
                            </div>
                        ))}
                    </div>
                )}
                <Dialog.Footer>
                    <Button.Text
                        onClick={() => setOpen(false)}
                        disabled={uninstalling !== null}
                    >
                        Close
                    </Button.Text>
                </Dialog.Footer>
            </Dialog>
            <Dialog
                open={updatingWorld !== null}
                onClose={handleCloseUpdate}
                title={`Update ${updatingWorld?.world_name || 'World'}`}
            >
                {updatingWorld && (
                    <div css={tw`flex flex-col gap-4 py-2`}>
                        {errorText && (
                            <div css={tw`p-3 bg-red-900 border border-red-700 text-red-200 text-xs rounded`}>
                                {errorText}
                            </div>
                        )}
                        {loadingVersions ? (
                            <div css={tw`w-full py-6 flex justify-center`}>
                                <Spinner size={'large'} />
                            </div>
                        ) : versions.length === 0 ? (
                            <p css={tw`text-sm text-neutral-400 text-center py-4`}>No available versions found for this world.</p>
                        ) : (
                            <div css={tw`w-full`}>
                                <label htmlFor={'update-version'} css={tw`text-xs text-neutral-400 font-semibold mb-1 block`}>Select Version</label>
                                <Select
                                    id={'update-version'}
                                    value={selectedVersion}
                                    onChange={(e) => setSelectedVersion(e.target.value)}
                                    disabled={isUpdating}
                                >
                                    {versions.map((v) => (
                                        <option key={v.id} value={v.id}>
                                            {v.name}
                                        </option>
                                    ))}
                                </Select>
                            </div>
                        )}
                        <Dialog.Footer>
                            <Button.Text
                                onClick={handleCloseUpdate}
                                disabled={isUpdating}
                            >
                                Cancel
                            </Button.Text>
                            <Button
                                onClick={handleUpdateConfirm}
                                disabled={isUpdating || versions.length === 0 || loadingVersions}
                            >
                                {isUpdating ? `Updating... (${downloadProgress.toFixed(0)}%)` : 'Update World'}
                            </Button>
                        </Dialog.Footer>
                    </div>
                )}
            </Dialog>
        </div>
    );
};
