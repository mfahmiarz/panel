import React, { useEffect, useState } from 'react';
import tw from 'twin.macro';
import { ServerContext } from '@/state/server';
import useFlash from '@/plugins/useFlash';
import { Dialog } from '@/components/elements/dialog';
import { Button } from '@/components/elements/button/index';
import Spinner from '@/components/elements/Spinner';
import Select from '@/components/elements/Select';
import {
    getInstalledPlugins,
    uninstallPlugin,
    getPluginVersions,
    installPlugin,
    InstalledPlugin,
    PluginVersion,
    PluginProvider
} from '@/api/server/minecraft/plugins';
interface Props {
    refreshTrigger: number;
    onRefreshTriggered: () => void;
}
export default ({ refreshTrigger, onRefreshTriggered }: Props) => {
    const uuid = ServerContext.useStoreState((s) => s.server.data!.uuid);
    const { addFlash, clearFlashes } = useFlash();
    const [open, setOpen] = useState(false);
    const [loading, setLoading] = useState(false);
    const [plugins, setPlugins] = useState<InstalledPlugin[]>([]);
    const [uninstalling, setUninstalling] = useState<string | null>(null);
    const [updatingPlugin, setUpdatingPlugin] = useState<InstalledPlugin | null>(null);
    const [versions, setVersions] = useState<PluginVersion[]>([]);
    const [loadingVersions, setLoadingVersions] = useState(false);
    const [selectedVersion, setSelectedVersion] = useState<string>('');
    const [isUpdating, setIsUpdating] = useState(false);
    const loadInstalled = () => {
        setLoading(true);
        getInstalledPlugins(uuid)
            .then((data) => setPlugins(data))
            .catch(() => addFlash({ type: 'error', key: 'plugins', message: 'Failed to load installed plugins.' }))
            .finally(() => setLoading(false));
    };
    useEffect(() => {
        if (open) {
            loadInstalled();
        }
    }, [uuid, open, refreshTrigger]);
    const handleUninstall = (plugin: InstalledPlugin) => {
        setUninstalling(plugin.plugin_id);
        clearFlashes('plugins');
        uninstallPlugin(uuid, plugin.plugin_id, plugin.provider)
            .then(() => {
                addFlash({
                    type: 'success',
                    key: 'plugins',
                    message: `Successfully uninstalled "${plugin.plugin_name || 'Plugin'}".`,
                });
                onRefreshTriggered();
                loadInstalled();
            })
            .catch(() => addFlash({ type: 'error', key: 'plugins', message: 'Failed to uninstall plugin.' }))
            .finally(() => setUninstalling(null));
    };
    const startUpdate = (plugin: InstalledPlugin) => {
        setUpdatingPlugin(plugin);
        setLoadingVersions(true);
        setVersions([]);
        setSelectedVersion('');
        getPluginVersions(uuid, plugin.provider as PluginProvider, plugin.plugin_id, '', '')
            .then((v) => {
                setVersions(v);
                if (v.length > 0) {
                    setSelectedVersion(v[0].id);
                }
            })
            .catch(() => addFlash({ type: 'error', key: 'plugins', message: 'Failed to load plugin versions for update.' }))
            .finally(() => setLoadingVersions(false));
    };
    const handleUpdateConfirm = () => {
        if (!updatingPlugin || !selectedVersion) return;
        setIsUpdating(true);
        clearFlashes('plugins');
        const ver = versions.find((v) => v.id === selectedVersion);
        const bypassFrontendUrls = updatingPlugin.provider === 'curseforge' || updatingPlugin.provider === 'hangar' || updatingPlugin.provider === 'spigotmc';
        installPlugin(
            uuid,
            updatingPlugin.provider as PluginProvider,
            updatingPlugin.plugin_id,
            selectedVersion,
            bypassFrontendUrls ? '' : (ver?.download_url ?? ''),
            ver?.filename ?? null,
            undefined,
            updatingPlugin.plugin_name,
            updatingPlugin.plugin_icon,
            updatingPlugin.plugin_author
        )
            .then(() => {
                addFlash({
                    type: 'success',
                    key: 'plugins',
                    message: `"${updatingPlugin.plugin_name}" update has been queued. The old file will be deleted and the new version will be downloaded shortly.`,
                });
                setUpdatingPlugin(null);
                onRefreshTriggered();
                loadInstalled();
            })
            .catch(() => addFlash({ type: 'error', key: 'plugins', message: 'Failed to request plugin update.' }))
            .finally(() => setIsUpdating(false));
    };
    return (
        <div css={tw`w-full`}>
            <Button
                type={'button'}
                onClick={() => setOpen(true)}
                css={tw`w-full`}
            >
                Installed Plugins
            </Button>
            <Dialog
                open={open}
                onClose={() => !uninstalling && setOpen(false)}
                title={'Installed Plugins'}
            >
                {loading && plugins.length === 0 ? (
                    <div css={tw`w-full py-8 flex justify-center`}>
                        <Spinner size={'large'} />
                    </div>
                ) : plugins.length === 0 ? (
                    <p css={tw`text-sm text-neutral-400 py-6 text-center`}>No plugins installed on this server yet.</p>
                ) : (
                    <div css={tw`flex flex-col gap-3 py-2 max-h-[400px] overflow-y-auto`}>
                        {plugins.map((entry) => (
                            <div
                                key={`${entry.provider}:${entry.plugin_id}`}
                                css={tw`flex items-center justify-between p-3 bg-neutral-800 rounded border border-neutral-700`}
                            >
                                <div css={tw`flex items-center gap-3 min-w-0 flex-1`}>
                                    {entry.plugin_icon ? (
                                        <img
                                            src={entry.plugin_icon}
                                            alt={''}
                                            css={tw`w-10 h-10 rounded flex-shrink-0 object-cover bg-neutral-700`}
                                            onError={(e) => { (e.target as HTMLImageElement).style.display = 'none'; }}
                                        />
                                    ) : (
                                        <div css={tw`w-10 h-10 rounded flex-shrink-0 bg-neutral-700 flex items-center justify-center`}>
                                            <svg css={tw`w-5 h-5 text-neutral-400`} fill='none' stroke='currentColor' viewBox='0 0 24 24'>
                                                <path strokeLinecap='round' strokeLinejoin='round' strokeWidth={2} d='M20 7l-8-4-8 4m16 0l-8 4m8-4v10l-8 4m0-10L4 7m8 4v10M4 7v10l8 4' />
                                            </svg>
                                        </div>
                                    )}
                                    <div css={tw`min-w-0 flex-1`}>
                                        <p css={tw`text-sm font-semibold text-neutral-200 truncate`} title={entry.plugin_name}>
                                            {entry.plugin_name || `Plugin ${entry.plugin_id}`}
                                        </p>
                                        <p css={tw`text-xs text-neutral-400 truncate`}>
                                            {entry.provider} • {entry.file_name}
                                        </p>
                                    </div>
                                </div>
                                <div css={tw`flex items-center gap-2 ml-3 flex-shrink-0`}>
                                    {entry.has_update && (
                                        <Button
                                            size={Button.Sizes.Small}
                                            type={'button'}
                                            onClick={() => startUpdate(entry)}
                                            disabled={uninstalling !== null}
                                            css={tw`bg-neutral-600 hover:bg-neutral-500`}
                                        >
                                            Update
                                        </Button>
                                    )}
                                    <Button.Danger
                                        size={Button.Sizes.Small}
                                        type={'button'}
                                        onClick={() => handleUninstall(entry)}
                                        disabled={uninstalling !== null}
                                    >
                                        {uninstalling === entry.plugin_id ? 'Removing...' : 'Uninstall'}
                                    </Button.Danger>
                                </div>
                            </div>
                        ))}
                    </div>
                )}
                <Dialog.Footer>
                    <Button.Text
                        type={'button'}
                        onClick={() => setOpen(false)}
                        disabled={uninstalling !== null}
                    >
                        Close
                    </Button.Text>
                </Dialog.Footer>
            </Dialog>
            {/* Update Dialog Modal */}
            <Dialog
                open={updatingPlugin !== null}
                onClose={() => !isUpdating && setUpdatingPlugin(null)}
                title={`Update ${updatingPlugin?.plugin_name || 'Plugin'}`}
            >
                {updatingPlugin && (
                    <div css={tw`flex flex-col gap-4 py-2`}>
                        {loadingVersions ? (
                            <div css={tw`w-full py-6 flex justify-center`}>
                                <Spinner size={'large'} />
                            </div>
                        ) : versions.length === 0 ? (
                            <p css={tw`text-sm text-neutral-400 text-center py-4`}>No available versions found for this plugin.</p>
                        ) : (
                            <div css={tw`w-full`}>
                                <Select
                                    id={'update-version'}
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
                            </div>
                        )}
                        <Dialog.Footer>
                            <Button.Text
                                type={'button'}
                                onClick={() => setUpdatingPlugin(null)}
                                disabled={isUpdating}
                            >
                                Cancel
                            </Button.Text>
                            <Button
                                type={'button'}
                                onClick={handleUpdateConfirm}
                                disabled={isUpdating || versions.length === 0}
                            >
                                {isUpdating ? 'Updating...' : 'Update Plugin'}
                            </Button>
                        </Dialog.Footer>
                    </div>
                )}
            </Dialog>
        </div>
    );
};
