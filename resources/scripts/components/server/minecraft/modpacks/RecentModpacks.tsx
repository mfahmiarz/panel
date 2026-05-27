import React, { useCallback, useEffect, useState } from 'react';
import tw from 'twin.macro';
import { Modpack, ModpackProvider } from '@/api/server/minecraft/modpacks';
export interface RecentEntry {
    id: string;
    name: string;
    icon_url: string | null;
    provider: ModpackProvider;
    installedAt: number;
}
const MAX_RECENT = 5;
function storageKey(serverUuid: string): string {
    return `pterodactyl:modpacks:recent:${serverUuid}`;
}
export function useRecentModpacks(serverUuid: string) {
    const [recent, setRecent] = useState<RecentEntry[]>(() => {
        try {
            return JSON.parse(localStorage.getItem(storageKey(serverUuid)) ?? '[]') as RecentEntry[];
        } catch {
            return [];
        }
    });
    const addRecent = useCallback(
        (modpack: Modpack, provider: ModpackProvider) => {
            setRecent((prev) => {
                const next: RecentEntry[] = [
                    { id: modpack.id, name: modpack.name, icon_url: modpack.icon_url, provider, installedAt: Date.now() },
                    ...prev.filter((e) => !(e.id === modpack.id && e.provider === provider)),
                ].slice(0, MAX_RECENT);
                try {
                    localStorage.setItem(storageKey(serverUuid), JSON.stringify(next));
                } catch { }
                return next;
            });
        },
        [serverUuid],
    );
    return { recent, addRecent };
}
interface Props {
    recent: RecentEntry[];
}
export default ({ recent }: Props) => {
    if (!recent.length) return null;
    return (
        <div css={tw`w-full`}>
            <p css={tw`text-xs font-semibold uppercase tracking-wider text-neutral-400 mb-2`}>Recently Installed</p>
            <div css={tw`flex flex-col gap-1`}>
                {recent.map((entry) => (
                    <div key={`${entry.provider}:${entry.id}`} css={tw`flex items-center gap-2`}>
                        {entry.icon_url ? (
                            <img
                                src={entry.icon_url}
                                alt={''}
                                css={tw`w-6 h-6 rounded flex-shrink-0 object-cover bg-neutral-600`}
                                onError={(e) => { (e.target as HTMLImageElement).style.display = 'none'; }}
                            />
                        ) : (
                            <div css={tw`w-6 h-6 rounded flex-shrink-0 bg-neutral-600`} />
                        )}
                        <p css={tw`text-xs text-neutral-300 truncate`} title={entry.name}>{entry.name}</p>
                    </div>
                ))}
            </div>
        </div>
    );
};
