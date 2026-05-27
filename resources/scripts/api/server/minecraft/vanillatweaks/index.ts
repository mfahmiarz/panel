import http from '@/api/http';
export type VanillaTweaksType = 'resourcepacks' | 'datapacks' | 'craftingtweaks';
export interface VanillaTweaksPack {
    id: string;
    name: string;
    description: string;
    icon_url: string;
    version: string;
    category: string;
}
export const getVersions = async (uuid: string): Promise<string[]> => {
    const { data } = await http.get(`/api/client/servers/${uuid}/minecraft/vanillatweaks/versions`);
    return data.data || [];
};
export const getPacks = async (
    uuid: string,
    type: VanillaTweaksType,
    version: string,
): Promise<VanillaTweaksPack[]> => {
    const { data } = await http.get(`/api/client/servers/${uuid}/minecraft/vanillatweaks`, {
        params: { type, version },
    });
    return data.data || [];
};
export const installPacks = async (
    uuid: string,
    type: VanillaTweaksType,
    version: string,
    packs: string[],
): Promise<void> => {
    await http.post(`/api/client/servers/${uuid}/minecraft/vanillatweaks/install`, {
        type,
        version,
        packs,
    });
};
