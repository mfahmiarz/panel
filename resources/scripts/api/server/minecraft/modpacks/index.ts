import { PaginatedResult, PaginationDataSet } from '@/api/http';
import http from '@/api/http';
export type ModpackProvider = 'atlauncher' | 'curseforge' | 'feedthebeast' | 'modrinth' | 'technic' | 'voidswrath';
export interface Modpack {
    id: string;
    name: string;
    description: string | null;
    icon_url: string | null;
}
export interface ModpackVersion {
    id: string;
    name: string;
}
export const getModpacks = async (
    uuid: string,
    provider: ModpackProvider,
    query: string,
    page: number,
    perPage: number,
    loader: string,
): Promise<PaginatedResult<Modpack>> => {
    const { data } = await http.get(`/api/client/servers/${uuid}/minecraft/modpacks`, {
        params: { provider, query, page, per_page: perPage, loader: loader || undefined },
    });
    const pagination: PaginationDataSet = {
        total: data.meta.total,
        count: data.data.length,
        perPage: data.meta.per_page,
        currentPage: data.meta.page,
        totalPages: Math.max(1, Math.ceil(data.meta.total / data.meta.per_page)),
    };
    return { items: data.data as Modpack[], pagination };
};
export const getModpackVersions = async (
    uuid: string,
    provider: ModpackProvider,
    modpackId: string,
): Promise<ModpackVersion[]> => {
    const { data } = await http.get(`/api/client/servers/${uuid}/minecraft/modpacks/versions`, {
        params: { provider, modpack_id: modpackId },
    });
    return (data.data ?? []) as ModpackVersion[];
};
export const installModpack = async (
    uuid: string,
    provider: ModpackProvider,
    modpackId: string,
    modpackVersionId: string,
    deleteFiles: boolean,
): Promise<void> => {
    await http.post(`/api/client/servers/${uuid}/minecraft/modpacks/install`, {
        provider,
        modpack_id: modpackId,
        modpack_version_id: modpackVersionId,
        delete_files: deleteFiles,
    });
};
