import React, { useState } from 'react';
import tw from 'twin.macro';
import { ServerContext } from '@/state/server';
import useFlash from '@/plugins/useFlash';
import { Dialog } from '@/components/elements/dialog';
import Select from '@/components/elements/Select';
import Switch from '@/components/elements/Switch';
import { Modpack, ModpackProvider, ModpackVersion, getModpackVersions, installModpack } from '@/api/server/minecraft/modpacks';
interface Props {
    modpack: Modpack;
    provider: ModpackProvider;
    onInstalled?: (modpack: Modpack, provider: ModpackProvider) => void;
}
export default ({ modpack, provider, onInstalled }: Props) => {
    const uuid = ServerContext.useStoreState((s) => s.server.data!.uuid);
    const { addFlash } = useFlash();
    const [open, setOpen] = useState(false);
    const [versions, setVersions] = useState<ModpackVersion[]>([]);
    const [selectedVersion, setSelectedVersion] = useState('');
    const [deleteFiles, setDeleteFiles] = useState(false);
    const [loading, setLoading] = useState(false);
    const [installing, setInstalling] = useState(false);
    const openDialog = () => {
        setOpen(true);
        if (versions.length > 0) return;
        setLoading(true);
        getModpackVersions(uuid, provider, modpack.id)
            .then((v) => {
                setVersions(v);
                if (v.length > 0) setSelectedVersion(v[0].id);
            })
            .catch(() => addFlash({ type: 'error', key: 'modpacks', message: 'Failed to load versions.' }))
            .finally(() => setLoading(false));
    };
    const onConfirmed = () => {
        setInstalling(true);
        installModpack(uuid, provider, modpack.id, selectedVersion, deleteFiles)
            .then(() => {
                setOpen(false);
                onInstalled?.(modpack, provider);
                addFlash({
                    type: 'success',
                    key: 'modpacks',
                    message: `Installation of "${modpack.name}" has been triggered. Check the Console tab for progress.`,
                });
            })
            .catch(() => addFlash({ type: 'error', key: 'modpacks', message: 'Failed to trigger installation.' }))
            .finally(() => setInstalling(false));
    };
    return (
        <>
            <Dialog.Confirm
                open={open}
                title={`${modpack.name}`}
                confirm={'Install'}
                onClose={() => !installing && setOpen(false)}
                onConfirmed={onConfirmed}
            >
                <div css={tw`flex flex-col gap-4`}>
                    <div>
                        {loading ? (
                            <p css={tw`text-sm text-neutral-400 mt-1`}>Loading versions…</p>
                        ) : versions.length === 0 ? (
                            <p css={tw`text-sm text-neutral-400 mt-1`}>No versions available.</p>
                        ) : (
                            <Select
                                id={'modpack-version'}
                                value={selectedVersion}
                                onChange={(e) => setSelectedVersion(e.target.value)}
                                css={tw`mt-1`}
                            >
                                {versions.map((v) => (
                                    <option key={v.id} value={v.id}>
                                        {v.name}
                                    </option>
                                ))}
                            </Select>
                        )}
                    </div>
                    <div css={tw`mt-1 bg-neutral-700 p-4 rounded`}>
                        <Switch
                            name={'delete-files'}
                            label={'Delete all files'}
                            description={'Wipes the entire server directory before the modpack is installed.'}
                            defaultChecked={false}
                            onChange={(e) => setDeleteFiles(e.target.checked)}
                        />
                    </div>
                </div>
            </Dialog.Confirm>
            <div
                css={tw`flex items-center gap-3 p-3 cursor-pointer hover:bg-neutral-600 transition-colors`}
                onClick={openDialog}
                role={'button'}
            >
                {modpack.icon_url ? (
                    <img
                        src={modpack.icon_url}
                        alt={''}
                        css={tw`w-10 h-10 rounded flex-shrink-0 object-cover bg-neutral-600`}
                        onError={(e) => { (e.target as HTMLImageElement).style.display = 'none'; }}
                    />
                ) : (
                    <div css={tw`w-10 h-10 rounded flex-shrink-0 bg-neutral-600`} />
                )}
                <div css={tw`flex-1 min-w-0`}>
                    <p css={tw`text-sm text-neutral-100 truncate`}>{modpack.name}</p>
                    {modpack.description && (
                        <p css={tw`text-xs text-neutral-400 truncate mt-0.5`}>{modpack.description}</p>
                    )}
                </div>
            </div>
        </>
    );
};
