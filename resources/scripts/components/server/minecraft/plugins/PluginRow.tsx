import React, { useState } from 'react';
import tw from 'twin.macro';
import { ServerContext } from '@/state/server';
import useFlash from '@/plugins/useFlash';
import { Dialog } from '@/components/elements/dialog';
import Select from '@/components/elements/Select';
import Input from '@/components/elements/Input';
import Label from '@/components/elements/Label';
import { Plugin, PluginProvider, PluginVersion, getPluginVersions, installPlugin } from '@/api/server/minecraft/plugins';
interface Props {
    plugin: Plugin;
    provider: PluginProvider;
    mcVersion: string;
    loader: string;
    onInstalled?: (plugin: Plugin, provider: PluginProvider) => void;
}
const POLYMART_TOKEN_KEY = 'pterodactyl:polymart:token';
function getPolymartToken(): string {
    try { return localStorage.getItem(POLYMART_TOKEN_KEY) ?? ''; } catch { return ''; }
}
function savePolymartToken(token: string): void {
    try { localStorage.setItem(POLYMART_TOKEN_KEY, token); } catch { }
}
export default ({ plugin, provider, mcVersion, loader, onInstalled }: Props) => {
    const uuid = ServerContext.useStoreState((s) => s.server.data!.uuid);
    const { addFlash, clearFlashes } = useFlash();
    const [open, setOpen] = useState(false);
    const [versions, setVersions] = useState<PluginVersion[]>([]);
    const [selectedVersion, setSelectedVersion] = useState('');
    const [loading, setLoading] = useState(false);
    const [installing, setInstalling] = useState(false);
    const [polymartToken, setPolymartToken] = useState(getPolymartToken);
    const openDialog = () => {
        setOpen(true);
        if (versions.length > 0) return;
        setLoading(true);
        getPluginVersions(uuid, provider, plugin.id, mcVersion, loader)
            .then((v) => {
                setVersions(v);
                if (v.length > 0) setSelectedVersion(v[0].id);
            })
            .catch(() => {
                clearFlashes('plugins');
                addFlash({ type: 'error', key: 'plugins', message: 'Failed to load plugin versions.' });
            })
            .finally(() => setLoading(false));
    };
    const onConfirmed = () => {
        const ver = versions.find((v) => v.id === selectedVersion);
        if (provider === 'polymart') {
            savePolymartToken(polymartToken);
        }
        setInstalling(true);
        const bypassFrontendUrls = provider === 'curseforge' || provider === 'hangar' || provider === 'spigotmc';
        installPlugin(
            uuid,
            provider,
            plugin.id,
            selectedVersion,
            bypassFrontendUrls ? '' : (ver?.download_url ?? ''),
            bypassFrontendUrls ? null : (ver?.filename ?? null),
            provider === 'polymart' ? polymartToken : undefined,
            plugin.name,
            plugin.icon_url,
            plugin.author
        )
            .then(() => {
                setOpen(false);
                onInstalled?.(plugin, provider);
                clearFlashes('plugins');
                addFlash({
                    type: 'success',
                    key: 'plugins',
                    message: `"${plugin.name}" has been successfully installed in the /plugins folder`,
                });
            })
            .catch(() => {
                clearFlashes('plugins');
                addFlash({ type: 'error', key: 'plugins', message: 'Failed to trigger plugin installation.' });
            })
            .finally(() => setInstalling(false));
    };
    return (
        <>
            <Dialog.Confirm
                open={open}
                title={`${plugin.name}`}
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
                                id={'plugin-version'}
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
                    {/* Polymart token */}
                    {provider === 'polymart' && (
                        <div css={tw`bg-neutral-700 rounded p-4 flex flex-col gap-2`}>
                            <Label htmlFor={'polymart-token'}>Polymart API Token (Optional for Free Plugins)</Label>
                            <p css={tw`text-xs text-neutral-400`}>
                                Required for premium plugins. Find your token at{' '}
                                <a
                                    href={'https://polymart.org/account/api'}
                                    target={'_blank'}
                                    rel={'noreferrer'}
                                    css={tw`text-cyan-400 underline`}
                                >
                                    polymart.org/account/api
                                </a>
                                . Free plugins do not require a token to download.
                            </p>
                            <Input
                                id={'polymart-token'}
                                type={'password'}
                                placeholder={'Your Polymart API token (leave blank for free plugins)…'}
                                value={polymartToken}
                                onChange={(e) => setPolymartToken(e.target.value)}
                            />
                        </div>
                    )}
                </div>
            </Dialog.Confirm>
            <div
                css={tw`flex items-center gap-3 p-3 cursor-pointer hover:bg-neutral-600 transition-colors`}
                onClick={openDialog}
                role={'button'}
            >
                {plugin.icon_url ? (
                    <img
                        src={plugin.icon_url}
                        alt={''}
                        css={tw`w-10 h-10 rounded flex-shrink-0 object-cover bg-neutral-600`}
                        onError={(e) => { (e.target as HTMLImageElement).style.display = 'none'; }}
                    />
                ) : (
                    <div css={tw`w-10 h-10 rounded flex-shrink-0 bg-neutral-600`} />
                )}
                <div css={tw`flex-1 min-w-0`}>
                    <p css={tw`text-sm text-neutral-100 truncate`}>{plugin.name}</p>
                    {plugin.description && (
                        <p css={tw`text-xs text-neutral-400 truncate mt-0.5`}>{plugin.description}</p>
                    )}
                </div>
            </div>
        </>
    );
};
