import http from '@/api/http';
import { PaginatedResult, PaginationDataSet } from '@/api/http';
export type WorldProvider = 'curseforge';
export interface World {
    id: string;
    name: string;
    description: string | null;
    icon_url: string | null;
    author: string | null;
    downloads: number;
}
export interface WorldVersion {
    id: string;
    name: string;
    download_url: string;
    filename: string | null;
}
export interface InstalledWorld {
    world_id: string;
    provider: string;
    version_id: string;
    world_name: string;
    world_icon: string;
    world_author: string;
    file_name: string;
    installed_at: string;
    has_update?: boolean;
    is_active?: boolean;
}
export const getWorlds = async (
    uuid: string,
    provider: WorldProvider,
    query: string,
    page: number,
    perPage: number,
    mcVersion: string,
): Promise<PaginatedResult<World>> => {
    const { data } = await http.get(`/api/client/servers/${uuid}/minecraft/worlds`, {
        params: { provider, query, page, per_page: perPage, mc_version: mcVersion || undefined },
    });
    const pagination: PaginationDataSet = {
        total: data.meta.total,
        count: data.data.length,
        perPage: data.meta.per_page,
        currentPage: data.meta.page,
        totalPages: Math.max(1, Math.ceil(data.meta.total / data.meta.per_page)),
    };
    return { items: data.data as World[], pagination };
};
export const getWorldVersions = async (
    uuid: string,
    provider: WorldProvider,
    worldId: string,
    mcVersion: string,
): Promise<WorldVersion[]> => {
    const { data } = await http.get(`/api/client/servers/${uuid}/minecraft/worlds/versions`, {
        params: { provider, world_id: worldId, mc_version: mcVersion || undefined },
    });
    return (data.data ?? []) as WorldVersion[];
};
export const installWorld = async (
    uuid: string,
    provider: WorldProvider,
    worldId: string,
    versionId: string,
    downloadUrl: string,
    filename: string | null,
    worldName?: string,
    worldIcon?: string | null,
    worldAuthor?: string | null,
): Promise<void> => {
    await http.post(`/api/client/servers/${uuid}/minecraft/worlds/install`, {
        provider,
        world_id: worldId,
        version_id: versionId,
        download_url: downloadUrl || undefined,
        filename: filename || undefined,
        world_name: worldName || undefined,
        world_icon: worldIcon || undefined,
        world_author: worldAuthor || undefined,
    });
};
export const getInstalledWorlds = async (uuid: string): Promise<InstalledWorld[]> => {
    const { data } = await http.get(`/api/client/servers/${uuid}/minecraft/worlds/installed`);
    return (data.data ?? []) as InstalledWorld[];
};
export const uninstallWorld = async (uuid: string, worldId: string, provider: string): Promise<void> => {
    await http.delete(`/api/client/servers/${uuid}/minecraft/worlds/installed/${worldId}`, {
        params: { provider },
    });
};
export const setActiveWorld = async (uuid: string, worldId: string, provider: string): Promise<void> => {
    await http.post(`/api/client/servers/${uuid}/minecraft/worlds/installed/active`, {
        world_id: worldId,
        provider,
    });
};
