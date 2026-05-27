import http from '@/api/http';
import { PaginatedResult, PaginationDataSet } from '@/api/http';
export type PluginProvider = 'modrinth' | 'curseforge' | 'hangar' | 'spigotmc' | 'polymart';
export interface Plugin {
    id: string;
    name: string;
    description: string | null;
    icon_url: string | null;
    author: string | null;
    downloads: number;
}
export interface PluginVersion {
    id: string;
    name: string;
    download_url: string;
    filename: string | null;
}
export const getPlugins = async (
    uuid: string,
    provider: PluginProvider,
    query: string,
    page: number,
    perPage: number,
    mcVersion: string,
    loader: string,
): Promise<PaginatedResult<Plugin>> => {
    const { data } = await http.get(`/api/client/servers/${uuid}/minecraft/plugins`, {
        params: { provider, query, page, per_page: perPage, mc_version: mcVersion || undefined, loader: loader || undefined },
    });
    const pagination: PaginationDataSet = {
        total: data.meta.total,
        count: data.data.length,
        perPage: data.meta.per_page,
        currentPage: data.meta.page,
        totalPages: Math.max(1, Math.ceil(data.meta.total / data.meta.per_page)),
    };
    return { items: data.data as Plugin[], pagination };
};
export const getPluginVersions = async (
    uuid: string,
    provider: PluginProvider,
    pluginId: string,
    mcVersion: string,
    loader: string,
): Promise<PluginVersion[]> => {
    const { data } = await http.get(`/api/client/servers/${uuid}/minecraft/plugins/versions`, {
        params: { provider, plugin_id: pluginId, mc_version: mcVersion || undefined, loader: loader || undefined },
    });
    return (data.data ?? []) as PluginVersion[];
};
export interface InstalledPlugin {
    plugin_id: string;
    provider: string;
    version_id: string;
    plugin_name: string;
    plugin_icon: string;
    plugin_author: string;
    file_name: string;
    installed_at: string;
    has_update?: boolean;
}
export const installPlugin = async (
    uuid: string,
    provider: PluginProvider,
    pluginId: string,
    versionId: string,
    downloadUrl: string,
    filename: string | null,
    polymartToken?: string,
    pluginName?: string,
    pluginIcon?: string | null,
    pluginAuthor?: string | null,
): Promise<void> => {
    await http.post(`/api/client/servers/${uuid}/minecraft/plugins/install`, {
        provider,
        plugin_id: pluginId,
        version_id: versionId,
        download_url: downloadUrl || undefined,
        filename: filename || undefined,
        polymart_token: polymartToken || undefined,
        plugin_name: pluginName || undefined,
        plugin_icon: pluginIcon || undefined,
        plugin_author: pluginAuthor || undefined,
    });
};
export const getInstalledPlugins = async (uuid: string): Promise<InstalledPlugin[]> => {
    const { data } = await http.get(`/api/client/servers/${uuid}/minecraft/plugins/installed`);
    return (data.data ?? []) as InstalledPlugin[];
};
export const uninstallPlugin = async (uuid: string, pluginId: string, provider: string): Promise<void> => {
    await http.delete(`/api/client/servers/${uuid}/minecraft/plugins/installed/${pluginId}`, {
        params: { provider },
    });
};
