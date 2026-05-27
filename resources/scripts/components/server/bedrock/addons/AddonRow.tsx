import React, { useState, useEffect } from 'react';
import tw from 'twin.macro';
import { ServerContext } from '@/state/server';
import useFlash from '@/plugins/useFlash';
import { Dialog } from '@/components/elements/dialog';
import Select from '@/components/elements/Select';
import { Button } from '@/components/elements/button/index';
import { Addon, AddonVersion, getAddonVersions, installAddon, getAddonInstallStatus } from '@/api/server/bedrock/addons';
interface Props {
    addon: Addon;
    onInstalled?: () => void;
}
export default ({ addon, onInstalled }: Props) => {
    const uuid = ServerContext.useStoreState((s) => s.server.data!.uuid);
    const { addFlash, clearFlashes } = useFlash();
    const [open, setOpen] = useState(false);
    const [versions, setVersions] = useState<AddonVersion[]>([]);
    const [selectedVersion, setSelectedVersion] = useState('');
    const [loading, setLoading] = useState(false);
    const [installing, setInstalling] = useState(false);
    const [jobId, setJobId] = useState<string | null>(null);
    const [downloadProgress, setDownloadProgress] = useState(0);
    const [installStatusText, setInstallStatusText] = useState('');
    useEffect(() => {
        if (!jobId) return;
        const interval = setInterval(() => {
            getAddonInstallStatus(uuid, jobId)
                .then((statusData) => {
                    if (!statusData || statusData.status === 'unknown') return;
                    if (statusData.status === 'downloading') {
                        setInstallStatusText('Downloading...');
                        setDownloadProgress(prev => (prev < 50 ? prev + 10 : prev));
                    } else if (statusData.status === 'extracting') {
                        setInstallStatusText('Extracting...');
                        setDownloadProgress(prev => (prev < 90 ? prev + 10 : prev));
                    } else if (statusData.status === 'completed') {
                        clearInterval(interval);
                        setDownloadProgress(100);
                        setInstallStatusText('Completed');
                        setTimeout(() => {
                            setOpen(false);
                            onInstalled?.();
                            clearFlashes('addons');
                            addFlash({ type: 'success', key: 'addons', message: `"${addon.name}" installed successfully.` });
                            setInstalling(false);
                            setJobId(null);
                        }, 1000);
                    } else if (statusData.status === 'failed') {
                        clearInterval(interval);
                        setInstallStatusText('Failed');
                        setInstalling(false);
                        setJobId(null);
                        clearFlashes('addons');
                        addFlash({ type: 'error', key: 'addons', message: statusData.error || 'Installation failed.' });
                    }
                })
                .catch(() => {
                    // Ignore transient errors
                });
        }, 1000);
        return () => clearInterval(interval);
    }, [jobId, uuid, addon.name, onInstalled, addFlash, clearFlashes]);
    const openDialog = () => {
        setOpen(true);
        if (versions.length > 0) return;
        setLoading(true);
        getAddonVersions(uuid, addon.id)
            .then((v) => {
                setVersions(v);
                if (v.length > 0) setSelectedVersion(v[0].id);
            })
            .catch(() => {
                clearFlashes('addons');
                addFlash({ type: 'error', key: 'addons', message: 'Failed to load addon versions.' });
            })
            .finally(() => setLoading(false));
    };
    const onConfirmed = () => {
        if (!selectedVersion) return;
        setInstalling(true);
        setDownloadProgress(10);
        setInstallStatusText('Queued...');
        installAddon(
            uuid,
            addon.id,
            selectedVersion,
            addon.name,
            addon.icon_url,
            addon.author
        )
            .then((res) => {
                setJobId(res.job_id);
            })
            .catch((err) => {
                clearFlashes('addons');
                const msg = err.response?.data?.errors?.[0]?.detail || 'Failed to trigger Bedrock addon installation.';
                addFlash({ type: 'error', key: 'addons', message: msg });
                setInstalling(false);
            });
    };
    const handleClose = () => {
        if (!installing && !jobId) {
            setOpen(false);
        }
    };
    return (
        <>
            <Dialog
                open={open}
                onClose={handleClose}
                title={`Install ${addon.name}`}
            >
                <div css={tw`flex flex-col gap-4 py-2`}>
                    <div>
                        {loading ? (
                            <p css={tw`text-sm text-neutral-400 mt-1`}>Loading versions…</p>
                        ) : versions.length === 0 ? (
                            <p css={tw`text-sm text-neutral-400 mt-1`}>No versions available.</p>
                        ) : (
                            <Select
                                id={'addon-version'}
                                value={selectedVersion}
                                onChange={(e) => setSelectedVersion(e.target.value)}
                                css={tw`mt-1`}
                                disabled={installing}
                            >
                                {versions.map((v) => (
                                    <option key={v.id} value={v.id}>
                                        {v.name}
                                    </option>
                                ))}
                            </Select>
                        )}
                    </div>
                </div>
                <Dialog.Footer>
                    <Button.Text
                        type={'button'}
                        onClick={handleClose}
                        disabled={installing}
                    >
                        Cancel
                    </Button.Text>
                    <Button
                        type={'button'}
                        onClick={onConfirmed}
                        disabled={installing || versions.length === 0}
                    >
                        {installing ? `Installing... ${jobId ? `(${downloadProgress}%)` : ''}` : 'Install'}
                    </Button>
                </Dialog.Footer>
            </Dialog>
            <div
                css={tw`flex items-center gap-3 p-3 cursor-pointer hover:bg-neutral-600 transition-colors`}
                onClick={openDialog}
                role={'button'}
            >
                {addon.icon_url ? (
                    <img
                        src={addon.icon_url}
                        alt={''}
                        css={tw`w-10 h-10 rounded flex-shrink-0 object-cover bg-neutral-600`}
                        onError={(e) => { (e.target as HTMLImageElement).style.display = 'none'; }}
                    />
                ) : (
                    <div css={tw`w-10 h-10 rounded flex-shrink-0 bg-neutral-600`} />
                )}
                <div css={tw`flex-1 min-w-0`}>
                    <p css={tw`text-sm text-neutral-100 truncate`}>{addon.name}</p>
                    {addon.description && (
                        <p css={tw`text-xs text-neutral-400 truncate mt-0.5`}>{addon.description}</p>
                    )}
                </div>
            </div>
        </>
    );
};
