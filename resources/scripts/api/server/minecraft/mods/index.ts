import http from '@/api/http';
import { PaginatedResult, PaginationDataSet } from '@/api/http';
export type ModProvider = 'modrinth' | 'curseforge';
export interface Mod {
    id: string;
    name: string;
    description: string | null;
    icon_url: string | null;
    author: string | null;
    downloads: number;
}
export interface ModVersion {
    id: string;
    name: string;
    download_url: string;
    filename: string | null;
}
export const getMods = async (
    uuid: string,
    provider: ModProvider,
    query: string,
    page: number,
    perPage: number,
    mcVersion: string,
    loader: string,
): Promise<PaginatedResult<Mod>> => {
    const { data } = await http.get(`/api/client/servers/${uuid}/minecraft/mods`, {
        params: { provider, query, page, per_page: perPage, mc_version: mcVersion || undefined, loader: loader || undefined },
    });
    const pagination: PaginationDataSet = {
        total: data.meta.total,
        count: data.data.length,
        perPage: data.meta.per_page,
        currentPage: data.meta.page,
        totalPages: Math.max(1, Math.ceil(data.meta.total / data.meta.per_page)),
    };
    return { items: data.data as Mod[], pagination };
};
export const getModVersions = async (
    uuid: string,
    provider: ModProvider,
    modId: string,
    mcVersion: string,
    loader: string,
): Promise<ModVersion[]> => {
    const { data } = await http.get(`/api/client/servers/${uuid}/minecraft/mods/versions`, {
        params: { provider, mod_id: modId, mc_version: mcVersion || undefined, loader: loader || undefined },
    });
    return (data.data ?? []) as ModVersion[];
};
export interface InstalledMod {
    mod_id: string;
    provider: string;
    version_id: string;
    mod_name: string;
    mod_icon: string;
    mod_author: string;
    file_name: string;
    installed_at: string;
    has_update?: boolean;
}
export const installMod = async (
    uuid: string,
    provider: ModProvider,
    modId: string,
    versionId: string,
    downloadUrl: string,
    filename: string | null,
    modName?: string,
    modIcon?: string | null,
    modAuthor?: string | null,
): Promise<void> => {
    await http.post(`/api/client/servers/${uuid}/minecraft/mods/install`, {
        provider,
        mod_id: modId,
        version_id: versionId,
        download_url: downloadUrl || undefined,
        filename: filename || undefined,
        mod_name: modName || undefined,
        mod_icon: modIcon || undefined,
        mod_author: modAuthor || undefined,
    });
};
export const getInstalledMods = async (uuid: string): Promise<InstalledMod[]> => {
    const { data } = await http.get(`/api/client/servers/${uuid}/minecraft/mods/installed`);
    return (data.data ?? []) as InstalledMod[];
};
export const uninstallMod = async (uuid: string, modId: string, provider: string): Promise<void> => {
    await http.delete(`/api/client/servers/${uuid}/minecraft/mods/installed/${modId}`, {
        params: { provider },
    });
};
