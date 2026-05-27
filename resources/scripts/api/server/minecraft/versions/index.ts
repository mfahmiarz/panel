import http from '@/api/http';
export interface CurrentJarData {
    jar_file: string;
    software: string;
    version: string;
    build: string;
}
export const getCurrentJar = async (uuid: string): Promise<CurrentJarData> => {
    const { data } = await http.get(`/api/client/servers/${uuid}/minecraft/versions/current`);
    return (data || {}) as CurrentJarData;
};
export const installJar = async (
    uuid: string,
    build: any,
    deleteFiles: boolean,
    acceptEula: boolean
): Promise<void> => {
    await http.post(`/api/client/servers/${uuid}/minecraft/versions/install`, {
        build,
        delete_files: deleteFiles,
        accept_eula: acceptEula,
    });
};
