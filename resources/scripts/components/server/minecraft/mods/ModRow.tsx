import React, { useState } from 'react';
import tw from 'twin.macro';
import { ServerContext } from '@/state/server';
import useFlash from '@/plugins/useFlash';
import { Dialog } from '@/components/elements/dialog';
import Select from '@/components/elements/Select';
import { Mod, ModProvider, ModVersion, getModVersions, installMod } from '@/api/server/minecraft/mods';
interface Props {
    mod: Mod;
    provider: ModProvider;
    mcVersion: string;
    loader: string;
    onInstalled?: (mod: Mod, provider: ModProvider) => void;
}
export default ({ mod, provider, mcVersion, loader, onInstalled }: Props) => {
    const uuid = ServerContext.useStoreState((s) => s.server.data!.uuid);
    const { addFlash, clearFlashes } = useFlash();
    const [open, setOpen] = useState(false);
    const [versions, setVersions] = useState<ModVersion[]>([]);
    const [selectedVersion, setSelectedVersion] = useState('');
    const [loading, setLoading] = useState(false);
    const [installing, setInstalling] = useState(false);
    const openDialog = () => {
        setOpen(true);
        if (versions.length > 0) return;
        setLoading(true);
        getModVersions(uuid, provider, mod.id, mcVersion, loader)
            .then((v) => {
                setVersions(v);
                if (v.length > 0) setSelectedVersion(v[0].id);
            })
            .catch(() => {
                clearFlashes('mods');
                addFlash({ type: 'error', key: 'mods', message: 'Failed to load mod versions.' });
            })
            .finally(() => setLoading(false));
    };
    const onConfirmed = () => {
        const ver = versions.find((v) => v.id === selectedVersion);
        setInstalling(true);
        const bypassFrontendUrls = provider === 'curseforge';
        installMod(
            uuid,
            provider,
            mod.id,
            selectedVersion,
            bypassFrontendUrls ? '' : (ver?.download_url ?? ''),
            bypassFrontendUrls ? null : (ver?.filename ?? null),
            mod.name,
            mod.icon_url,
            mod.author
        )
            .then(() => {
                setOpen(false);
                onInstalled?.(mod, provider);
                clearFlashes('mods');
                addFlash({
                    type: 'success',
                    key: 'mods',
                    message: `"${mod.name}" has been successfully installed in the /mods folder`,
                });
            })
            .catch(() => {
                clearFlashes('mods');
                addFlash({ type: 'error', key: 'mods', message: 'Failed to trigger mod installation.' });
            })
            .finally(() => setInstalling(false));
    };
    return (
        <>
            <Dialog.Confirm
                open={open}
                title={`${mod.name}`}
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
                                id={'mod-version'}
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
                </div>
            </Dialog.Confirm>
            <div
                css={tw`flex items-center gap-3 p-3 cursor-pointer hover:bg-neutral-600 transition-colors`}
                onClick={openDialog}
                role={'button'}
            >
                {mod.icon_url ? (
                    <img
                        src={mod.icon_url}
                        alt={''}
                        css={tw`w-10 h-10 rounded flex-shrink-0 object-cover bg-neutral-600`}
                        onError={(e) => { (e.target as HTMLImageElement).style.display = 'none'; }}
                    />
                ) : (
                    <div css={tw`w-10 h-10 rounded flex-shrink-0 bg-neutral-600`} />
                )}
                <div css={tw`flex-1 min-w-0`}>
                    <p css={tw`text-sm text-neutral-100 truncate`}>{mod.name}</p>
                    {mod.description && (
                        <p css={tw`text-xs text-neutral-400 truncate mt-0.5`}>{mod.description}</p>
                    )}
                </div>
            </div>
        </>
    );
};
