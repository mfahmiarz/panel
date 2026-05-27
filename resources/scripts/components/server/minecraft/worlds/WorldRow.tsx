import React, { useState, useEffect, useRef } from 'react';
import tw from 'twin.macro';
import { ServerContext } from '@/state/server';
import useFlash from '@/plugins/useFlash';
import { Dialog } from '@/components/elements/dialog';
import { Button } from '@/components/elements/button/index';
import Select from '@/components/elements/Select';
import Spinner from '@/components/elements/Spinner';
import { World, WorldProvider, WorldVersion, getWorldVersions, installWorld } from '@/api/server/minecraft/worlds';
interface Props {
    world: World;
    provider: WorldProvider;
    mcVersion: string;
    onInstalled?: (world: World, provider: WorldProvider) => void;
}
export default ({ world, provider, mcVersion, onInstalled }: Props) => {
    const uuid = ServerContext.useStoreState((s) => s.server.data!.uuid);
    const { addFlash, clearFlashes } = useFlash();
    const [open, setOpen] = useState(false);
    const [versions, setVersions] = useState<WorldVersion[]>([]);
    const [selectedVersion, setSelectedVersion] = useState('');
    const [loading, setLoading] = useState(false);
    const [installing, setInstalling] = useState(false);
    const [downloadProgress, setDownloadProgress] = useState(0);
    const [errorText, setErrorText] = useState<string | null>(null);
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
    const openDialog = () => {
        setOpen(true);
        setErrorText(null);
        setDownloadProgress(0);
        if (versions.length > 0) return;
        setLoading(true);
        getWorldVersions(uuid, provider, world.id, mcVersion)
            .then((v) => {
                setVersions(v);
                if (v.length > 0) setSelectedVersion(v[0].id);
            })
            .catch(() => {
                clearFlashes('worlds');
                addFlash({ type: 'error', key: 'worlds', message: 'Failed to load world versions.' });
            })
            .finally(() => setLoading(false));
    };
    const onConfirmed = () => {
        const ver = versions.find((v) => v.id === selectedVersion);
        setInstalling(true);
        setDownloadProgress(0);
        setErrorText(null);
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
            provider,
            world.id,
            selectedVersion,
            '',
            null,
            world.name,
            world.icon_url,
            world.author
        )
            .then(() => {
                window.clearInterval(interval);
                setDownloadProgress(100);
                setTimeout(() => {
                    setOpen(false);
                    onInstalled?.(world, provider);
                    clearFlashes('worlds');
                    addFlash({
                        type: 'success',
                        key: 'worlds',
                        message: `"${world.name}" has been successfully downloaded and extracted into the server directory.`,
                    });
                    setInstalling(false);
                    setDownloadProgress(0);
                }, 1000);
            })
            .catch((err) => {
                window.clearInterval(interval);
                clearFlashes('worlds');
                const msg = err.response?.data?.errors?.[0]?.detail || 'Failed to install world.';
                addFlash({ type: 'error', key: 'worlds', message: msg });
                setErrorText(msg);
                setInstalling(false);
                setDownloadProgress(0);
            });
    };
    const handleClose = () => {
        if (!installing) {
            setOpen(false);
            setErrorText(null);
        }
    };
    return (
        <>
            <Dialog
                open={open}
                onClose={handleClose}
                title={`${world.name}`}
            >
                <div css={tw`flex flex-col gap-4 py-2`}>
                    {errorText && (
                        <div css={tw`p-3 bg-red-900 border border-red-700 text-red-200 text-xs rounded`}>
                            {errorText}
                        </div>
                    )}
                    <div>
                        {loading ? (
                            <p css={tw`text-sm text-neutral-400 mt-1`}>Loading versions…</p>
                        ) : versions.length === 0 ? (
                            <p css={tw`text-sm text-neutral-400 mt-1`}>No versions available.</p>
                        ) : (
                            <div css={tw`w-full`}>
                                <label htmlFor={'world-version'} css={tw`text-xs text-neutral-400 font-semibold mb-1 block`}>Select Version</label>
                                <Select
                                    id={'world-version'}
                                    value={selectedVersion}
                                    onChange={(e) => setSelectedVersion(e.target.value)}
                                    disabled={installing}
                                >
                                    {versions.map((v) => (
                                        <option key={v.id} value={v.id}>
                                            {v.name}
                                        </option>
                                    ))}
                                </Select>
                            </div>
                        )}
                    </div>
                </div>
                <Dialog.Footer>
                    <Button.Text
                        onClick={handleClose}
                        disabled={installing}
                    >
                        Cancel
                    </Button.Text>
                    <Button
                        onClick={onConfirmed}
                        disabled={installing || versions.length === 0 || loading}
                    >
                        {installing ? `Installing... (${downloadProgress.toFixed(0)}%)` : 'Install'}
                    </Button>
                </Dialog.Footer>
            </Dialog>
            <div
                css={tw`flex items-center gap-3 p-3 cursor-pointer hover:bg-neutral-600 transition-colors`}
                onClick={openDialog}
                role={'button'}
            >
                {world.icon_url ? (
                    <img
                        src={world.icon_url}
                        alt={''}
                        css={tw`w-10 h-10 rounded flex-shrink-0 object-cover bg-neutral-600`}
                        onError={(e) => { (e.target as HTMLImageElement).style.display = 'none'; }}
                    />
                ) : (
                    <div css={tw`w-10 h-10 rounded flex-shrink-0 bg-neutral-600`} />
                )}
                <div css={tw`flex-1 min-w-0`}>
                    <p css={tw`text-sm text-neutral-100 truncate`}>{world.name}</p>
                    {world.description && (
                        <p css={tw`text-xs text-neutral-400 truncate mt-0.5`}>{world.description}</p>
                    )}
                </div>
            </div>
        </>
    );
};
