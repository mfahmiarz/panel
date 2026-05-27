import React, { useState, useEffect } from 'react';
import tw from 'twin.macro';
import { ServerContext } from '@/state/server';
import useFlash from '@/plugins/useFlash';
import { Dialog } from '@/components/elements/dialog';
import Select from '@/components/elements/Select';
import Switch from '@/components/elements/Switch';
import { installBedrock } from '@/api/server/bedrock/versions';
import { Button } from '@/components/elements/button/index';
import Label from '@/components/elements/Label';
import Tooltip from '@/components/elements/tooltip/Tooltip';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { faExclamationTriangle, faSkull } from '@fortawesome/free-solid-svg-icons';
interface SoftwareType {
    type: string;
    name: string;
    icon: string;
    color: string;
    description: string;
    experimental: boolean;
    deprecated?: boolean;
    builds?: number;
    versions?: {
        minecraft: number;
        project: number;
    };
    rawBuilds: any[];
}
interface Props {
    software: SoftwareType;
    filter: string;
    onInstalled?: () => void;
}
export default ({ software, filter, onInstalled }: Props) => {
    const uuid = ServerContext.useStoreState((s) => s.server.data!.uuid);
    const { addFlash, clearFlashes } = useFlash();
    const [open, setOpen] = useState(false);
    const [selectedBuild, setSelectedBuild] = useState('');
    const [deleteFiles, setDeleteFiles] = useState(false);
    const [acceptEula, setAcceptEula] = useState(true);
    const [installing, setInstalling] = useState(false);
    const [downloadProgress, setDownloadProgress] = useState(0);
    const [iconError, setIconError] = useState(false);
    const flatBuilds = React.useMemo(() => {
        const list: any[] = [];
        software.rawBuilds.forEach((item: any) => {
            const buildIsPreview = !!(item.scraped_preview && item.preview_server_version && item.preview_server_version !== 'N/A');
            if (filter === 'stable' && buildIsPreview) return;
            if (filter === 'preview' && !buildIsPreview) return;
            let fullVer = buildIsPreview ? item.preview_server_version : item.server_version;
            if (!fullVer || fullVer === 'N/A') {
                fullVer = item.version_number;
            }
            if (!fullVer) return;
            list.push({
                id: item.version_number,
                name: fullVer,
                buildNumber: item.update_title || 'Standard Release',
                version_number: item.version_number,
                is_preview: buildIsPreview,
            });
        });
        list.sort((a, b) => {
            const aMatch = a.name.match(/(\d+)(?:\.(\d+))?(?:\.(\d+))?(?:\.(\d+))?/);
            const bMatch = b.name.match(/(\d+)(?:\.(\d+))?(?:\.(\d+))?(?:\.(\d+))?/);
            if (!aMatch || !bMatch) return 0;
            for (let i = 1; i <= 4; i++) {
                const aVal = aMatch[i] ? parseInt(aMatch[i], 10) : 0;
                const bVal = bMatch[i] ? parseInt(bMatch[i], 10) : 0;
                if (aVal !== bVal) return bVal - aVal;
            }
            return 0;
        });
        return list;
    }, [software, filter]);
    useEffect(() => {
        if (flatBuilds.length > 0) {
            setSelectedBuild(flatBuilds[0].id.toString());
        }
    }, [flatBuilds]);
    if (flatBuilds.length === 0) {
        return null;
    }
    const openDialog = () => {
        setOpen(true);
    };
    const onConfirmed = () => {
        const build = flatBuilds.find(b => b.id.toString() === selectedBuild);
        if (!build) {
            clearFlashes('versions');
            addFlash({ type: 'error', key: 'versions', message: 'Invalid build selected.' });
            return;
        }
        setInstalling(true);
        setDownloadProgress(0);
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
        installBedrock(uuid, {
            version_number: build.version_number,
            is_preview: build.is_preview
        }, deleteFiles, acceptEula)
            .then(() => {
                window.clearInterval(interval);
                setDownloadProgress(100);
                setTimeout(() => {
                    setOpen(false);
                    onInstalled?.();
                    clearFlashes('versions');
                    addFlash({
                        type: 'success',
                        key: 'versions',
                        message: `"${software.name} ${build.name}${build.buildNumber && build.buildNumber !== 'Standard Release' ? ` (${build.buildNumber})` : ''}" has been successfully installed.`,
                    });
                    setInstalling(false);
                    setDownloadProgress(0);
                }, 1000);
            })
            .catch((err) => {
                window.clearInterval(interval);
                clearFlashes('versions');
                const msg = err.response?.data?.errors?.[0]?.detail || 'Failed to install Bedrock server.';
                addFlash({ type: 'error', key: 'versions', message: msg });
                setInstalling(false);
                setDownloadProgress(0);
            });
    };
    const handleClose = () => {
        if (!installing) {
            setOpen(false);
        }
    };
    return (
        <>
            <Dialog
                open={open}
                onClose={handleClose}
                title={`${software.name}`}
            >
                <div css={tw`flex flex-col gap-4 py-2`}>
                    <div>
                        <Label>Build (Version)</Label>
                        {flatBuilds.length === 0 ? (
                            <p css={tw`text-sm text-neutral-400 mt-1`}>No builds available.</p>
                        ) : (
                            <Select
                                id={'build-version'}
                                value={selectedBuild}
                                onChange={(e) => setSelectedBuild(e.target.value)}
                                disabled={installing}
                            >
                                {flatBuilds.map((b) => (
                                    <option key={b.id} value={b.id}>
                                        {b.name} {b.buildNumber && b.buildNumber !== 'Standard Release' ? `(${b.buildNumber})` : ''}
                                    </option>
                                ))}
                            </Select>
                        )}
                    </div>
                    <div css={tw`mt-2 bg-neutral-700 p-4 rounded flex flex-col gap-4`}>
                        <Switch
                            name={'accept-eula'}
                            label={'Accept EULA'}
                            description={'Automatically accept the Minecraft EULA.'}
                            defaultChecked={true}
                            onChange={(e) => setAcceptEula(e.target.checked)}
                        />
                        <Switch
                            name={'delete-files'}
                            label={'Delete all files'}
                            description={'Wipes the entire server directory before installation.'}
                            defaultChecked={false}
                            onChange={(e) => setDeleteFiles(e.target.checked)}
                        />
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
                        disabled={installing || flatBuilds.length === 0}
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
                {software.icon && !iconError ? (
                    <img
                        src={software.icon}
                        alt={''}
                        css={tw`w-10 h-10 rounded flex-shrink-0 object-cover`}
                        onError={(e) => {
                            const target = e.target as HTMLImageElement;
                            if (target.src !== 'https://raw.githubusercontent.com/PrismarineJS/minecraft-assets/master/data/1.15.2/blocks/grass_block_side.png') {
                                target.src = 'https://raw.githubusercontent.com/PrismarineJS/minecraft-assets/master/data/1.15.2/blocks/grass_block_side.png';
                            } else {
                                setIconError(true);
                            }
                        }}
                    />
                ) : (
                    <div css={tw`w-10 h-10 rounded flex-shrink-0 bg-neutral-700 flex items-center justify-center border border-neutral-600`}>
                        <span css={tw`text-green-500 text-xs font-bold`}>{software.name.replace('Bedrock ', '')}</span>
                    </div>
                )}
                <div css={tw`flex-1 min-w-0`}>
                    <p css={tw`text-sm text-neutral-100 truncate flex items-center gap-1.5`}>
                        <span>{software.name}</span>
                        {software.experimental && (
                            <Tooltip content={'Experimental'}>
                                <span css={tw`text-yellow-500`}>
                                    <FontAwesomeIcon icon={faExclamationTriangle} />
                                </span>
                            </Tooltip>
                        )}
                        {software.deprecated && (
                            <Tooltip content={'Deprecated'}>
                                <span css={tw`text-red-500`}>
                                    <FontAwesomeIcon icon={faSkull} />
                                </span>
                            </Tooltip>
                        )}
                    </p>
                    <p css={tw`text-xs text-neutral-400 truncate mt-0.5`}>
                        {flatBuilds.length} Builds
                    </p>
                </div>
            </div>
        </>
    );
};
