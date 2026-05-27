import React, { useState, useEffect } from 'react';
import tw from 'twin.macro';
import { ServerContext } from '@/state/server';
import useFlash from '@/plugins/useFlash';
import { Dialog } from '@/components/elements/dialog';
import Select from '@/components/elements/Select';
import Switch from '@/components/elements/Switch';
import { installJar } from '@/api/server/minecraft/versions';
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
    const [allBuildData, setAllBuildData] = useState<any>(null);
    const [loadingVersions, setLoadingVersions] = useState(false);
    const [versions, setVersions] = useState<string[]>([]);
    const [selectedVersion, setSelectedVersion] = useState('');
    const [loadingBuilds, setLoadingBuilds] = useState(false);
    const [builds, setBuilds] = useState<any[]>([]);
    const [selectedBuild, setSelectedBuild] = useState('');
    const [deleteFiles, setDeleteFiles] = useState(false);
    const [acceptEula, setAcceptEula] = useState(true);
    const [installing, setInstalling] = useState(false);
    const [downloadProgress, setDownloadProgress] = useState(0);
    const filteredBuildData = React.useMemo(() => {
        if (!allBuildData) return null;
        const filtered: any = {};
        Object.keys(allBuildData).forEach((ver) => {
            const val = allBuildData[ver];
            if (filter === 'stable' && val.type !== 'RELEASE') return;
            if (filter === 'snapshot' && val.type !== 'SNAPSHOT') return;
            filtered[ver] = val;
        });
        return filtered;
    }, [allBuildData, filter]);
    const totalVersions = React.useMemo(() => {
        if (filteredBuildData) {
            return Object.keys(filteredBuildData).length;
        }
        if (filter === 'stable' && software.experimental) return 0;
        return software.versions?.minecraft || 0;
    }, [filteredBuildData, filter, software]);
    const totalBuilds = React.useMemo(() => {
        if (filteredBuildData) {
            let sum = 0;
            Object.values(filteredBuildData).forEach((v: any) => {
                sum += v.builds || 0;
            });
            return sum;
        }
        if (filter === 'stable' && software.experimental) return 0;
        return software.builds || 0;
    }, [filteredBuildData, filter, software]);
    useEffect(() => {
        fetch(`https://versions.mcjars.app/api/v2/builds/${software.type}`)
            .then(res => res.json())
            .then(data => {
                if (data.success && data.builds) {
                    setAllBuildData(data.builds);
                }
            })
            .catch(err => console.error(err));
    }, [software.type]);
    useEffect(() => {
        if (filteredBuildData) {
            const vList = Object.keys(filteredBuildData).reverse();
            setVersions(vList);
            if (vList.length > 0) {
                if (!vList.includes(selectedVersion)) {
                    setSelectedVersion(vList[0]);
                }
            } else {
                setSelectedVersion('');
                setBuilds([]);
                setSelectedBuild('');
            }
        }
    }, [filteredBuildData]);
    const openDialog = () => {
        setOpen(true);
        if (versions.length > 0) return;
        if (filteredBuildData) {
            const vList = Object.keys(filteredBuildData).reverse();
            setVersions(vList);
            if (vList.length > 0) setSelectedVersion(vList[0]);
        } else {
            setLoadingVersions(true);
            fetch(`https://versions.mcjars.app/api/v2/builds/${software.type}`)
                .then(res => res.json())
                .then(data => {
                    if (data.success && data.builds) {
                        setAllBuildData(data.builds);
                    } else {
                        addFlash({ type: 'error', key: 'versions', message: 'Failed to load versions.' });
                    }
                })
                .catch(() => addFlash({ type: 'error', key: 'versions', message: 'Failed to load versions.' }))
                .finally(() => setLoadingVersions(false));
        }
    };
    useEffect(() => {
        if (!selectedVersion) return;
        setLoadingBuilds(true);
        fetch(`https://versions.mcjars.app/api/v2/builds/${software.type}/${selectedVersion}`)
            .then(res => res.json())
            .then(data => {
                if (data.success && data.builds) {
                    const bList = data.builds;
                    setBuilds(bList);
                    if (bList.length > 0) setSelectedBuild(bList[0].id.toString());
                } else {
                    addFlash({ type: 'error', key: 'versions', message: 'Failed to load builds.' });
                }
            })
            .catch(() => addFlash({ type: 'error', key: 'versions', message: 'Failed to load builds.' }))
            .finally(() => setLoadingBuilds(false));
    }, [selectedVersion]);
    const onConfirmed = () => {
        const build = builds.find(b => b.id.toString() === selectedBuild);
        if (!build || (!build.jarUrl && (!build.installation || build.installation.length === 0))) {
            clearFlashes('versions');
            addFlash({ type: 'error', key: 'versions', message: 'Invalid build selected or installation steps missing.' });
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
        installJar(uuid, build, deleteFiles, acceptEula)
            .then(() => {
                window.clearInterval(interval);
                setDownloadProgress(100);
                setTimeout(() => {
                    setOpen(false);
                    onInstalled?.();
                    clearFlashes('versions');
                    const buildNameDetail = build
                        ? (build.name !== selectedVersion
                            ? ` — ${build.name}${build.buildNumber ? ` (Build ${build.buildNumber})` : ''}`
                            : (build.buildNumber ? ` (Build ${build.buildNumber})` : ''))
                        : '';
                    addFlash({
                        type: 'success',
                        key: 'versions',
                        message: `"${software.name} ${selectedVersion}${buildNameDetail}" has been successfully installed.`,
                    });
                    setInstalling(false);
                    setDownloadProgress(0);
                }, 1000);
            })
            .catch((err) => {
                window.clearInterval(interval);
                clearFlashes('versions');
                const msg = err.response?.data?.errors?.[0]?.detail || 'Failed to install jar.';
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
                        <Label>Version</Label>
                        {loadingVersions ? (
                            <p css={tw`text-sm text-neutral-400 mt-1`}>Loading versions…</p>
                        ) : versions.length === 0 ? (
                            <p css={tw`text-sm text-neutral-400 mt-1`}>No versions available.</p>
                        ) : (
                            <Select
                                id={'minecraft-version'}
                                value={selectedVersion}
                                onChange={(e) => setSelectedVersion(e.target.value)}
                                disabled={installing}
                            >
                                {versions.map((v) => (
                                    <option key={v} value={v}>{v}</option>
                                ))}
                            </Select>
                        )}
                    </div>
                    <div>
                        <Label>Build</Label>
                        {loadingBuilds ? (
                            <p css={tw`text-sm text-neutral-400 mt-1`}>Loading builds…</p>
                        ) : builds.length === 0 ? (
                            <p css={tw`text-sm text-neutral-400 mt-1`}>No builds available.</p>
                        ) : (
                            <Select
                                id={'build-version'}
                                value={selectedBuild}
                                onChange={(e) => setSelectedBuild(e.target.value)}
                                disabled={installing}
                            >
                                {builds.map((b) => (
                                    <option key={b.id} value={b.id}>
                                        {b.name} {b.buildNumber ? `(Build ${b.buildNumber})` : ''}
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
                        disabled={installing || versions.length === 0 || loadingBuilds || loadingVersions}
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
                {software.icon ? (
                    <img
                        src={software.icon}
                        alt={''}
                        css={tw`w-10 h-10 rounded flex-shrink-0 object-cover`}
                        onError={(e) => { (e.target as HTMLImageElement).style.display = 'none'; }}
                    />
                ) : (
                    <div css={tw`w-10 h-10 rounded flex-shrink-0 bg-neutral-600`} />
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
                        {totalVersions} Versions - {totalBuilds} Builds
                    </p>
                </div>
            </div>
        </>
    );
};
