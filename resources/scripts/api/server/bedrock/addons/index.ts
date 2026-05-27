import http from '@/api/http';
import { PaginatedResult, PaginationDataSet } from '@/api/http';
export interface Addon {
    id: string;
    name: string;
    description: string | null;
    icon_url: string | null;
    author: string | null;
    downloads: number;
}
export interface AddonVersion {
    id: string;
    name: string;
    download_url: string;
    filename: string | null;
}
export interface InstalledAddon {
    addon_id: string;
    version_id: string;
    addon_name: string;
    addon_icon: string;
    addon_author: string;
    installed_at: string;
    has_update?: boolean;
    packs: Array<{
        type: 'behavior' | 'resource' | 'world';
        folder: string;
        uuid: string;
        name: string;
        version: string;
    }>;
}
export interface BedrockPack {
    folder_name: string;
    uuid: string;
    name: string;
    version: string;
    description: string;
    has_icon?: boolean;
}
export interface BedrockPacksData {
    default_world: string;
    behavior_packs: BedrockPack[];
    resource_packs: BedrockPack[];
    worlds: string[];
    active_behavior_packs: Array<{ pack_id: string; version: number[] }>;
    active_resource_packs: Array<{ pack_id: string; version: number[] }>;
}
export const getAddons = async (
    uuid: string,
    query: string,
    page: number,
    perPage: number,
    categoryId?: number
): Promise<PaginatedResult<Addon>> => {
    const { data } = await http.get(`/api/client/servers/${uuid}/bedrock/addons`, {
        params: { query, page, per_page: perPage, category_id: categoryId || undefined },
    });
    const pagination: PaginationDataSet = {
        total: data.meta.total,
        count: data.data.length,
        perPage: data.meta.per_page,
        currentPage: data.meta.page,
        totalPages: Math.max(1, Math.ceil(data.meta.total / data.meta.per_page)),
    };
    return { items: data.data as Addon[], pagination };
};
export const getAddonVersions = async (
    uuid: string,
    addonId: string
): Promise<AddonVersion[]> => {
    const { data } = await http.get(`/api/client/servers/${uuid}/bedrock/addons/versions`, {
        params: { addon_id: addonId },
    });
    return (data.data ?? []) as AddonVersion[];
};
export const installAddon = async (
    uuid: string,
    addonId: string,
    versionId: string,
    addonName?: string,
    addonIcon?: string | null,
    addonAuthor?: string | null
): Promise<{ job_id: string }> => {
    const { data } = await http.post(`/api/client/servers/${uuid}/bedrock/addons/install`, {
        addon_id: addonId,
        version_id: versionId,
        addon_name: addonName || undefined,
        addon_icon: addonIcon || undefined,
        addon_author: addonAuthor || undefined,
    });
    return data;
};
export const getAddonInstallStatus = async (uuid: string, jobId: string): Promise<any> => {
    const { data } = await http.get(`/api/client/servers/${uuid}/bedrock/addons/install-status`, {
        params: { job_id: jobId },
    });
    return data;
};
export const deletePack = async (uuid: string, type: 'behavior' | 'resource' | 'world', folder: string): Promise<void> => {
    await http.post(`/api/client/servers/${uuid}/bedrock/addons/delete`, { type, folder });
};
export const getPacks = async (uuid: string): Promise<BedrockPacksData> => {
    const { data } = await http.get(`/api/client/servers/${uuid}/bedrock/addons/packs`);
    return data as BedrockPacksData;
};
export const savePacks = async (
    uuid: string,
    behaviorPacks: Array<{ pack_id: string; version: number[] }>,
    resourcePacks: Array<{ pack_id: string; version: number[] }>
): Promise<void> => {
    await http.post(`/api/client/servers/${uuid}/bedrock/addons/packs`, {
        behavior_packs: behaviorPacks,
        resource_packs: resourcePacks,
    });
};
export const setDefaultWorld = async (uuid: string, levelName: string): Promise<void> => {
    await http.post(`/api/client/servers/${uuid}/bedrock/addons/world`, {
        level_name: levelName,
    });
};
export const getPackIconUrl = (uuid: string, path: string) => `/api/client/servers/${uuid}/bedrock/addons/icon?path=${encodeURIComponent(path)}`;
