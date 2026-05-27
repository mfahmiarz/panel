import http from '@/api/http';
export interface CurrentBedrockData {
    software: string;
    version: string;
    build: string;
}
export const getCurrentBedrock = async (uuid: string): Promise<CurrentBedrockData | null> => {
    const { data } = await http.get(`/api/client/servers/${uuid}/bedrock/versions/current`);
    if (data.current) {
        return {
            software: data.current.software || data.current.type || 'Unknown',
            version: data.current.version || 'Unknown',
            build: data.current.build || 'Unknown',
        };
    }
    return {
        software: 'Unknown',
        version: 'Unknown',
        build: 'Unknown'
    };
};
export const installBedrock = async (
    uuid: string,
    build: any,
    deleteFiles: boolean,
    acceptEula: boolean
): Promise<void> => {
    await http.post(
        `/api/client/servers/${uuid}/bedrock/versions/install`,
        {
            build,
            delete_files: deleteFiles,
            accept_eula: acceptEula,
        },
        {
            timeout: 600000,
            timeoutErrorMessage: 'It looks like the installation and decompression are taking a long time. Please monitor the file manager.',
        }
    );
};
export const MINECRAFT_BLOCKS = [
    'https://raw.githubusercontent.com/PrismarineJS/minecraft-assets/master/data/1.15.2/blocks/stone.png',
    'https://raw.githubusercontent.com/PrismarineJS/minecraft-assets/master/data/1.15.2/blocks/dirt.png',
    'https://raw.githubusercontent.com/PrismarineJS/minecraft-assets/master/data/1.15.2/blocks/oak_planks.png',
    'https://raw.githubusercontent.com/PrismarineJS/minecraft-assets/master/data/1.15.2/blocks/cobblestone.png',
    'https://raw.githubusercontent.com/PrismarineJS/minecraft-assets/master/data/1.15.2/blocks/bricks.png',
    'https://raw.githubusercontent.com/PrismarineJS/minecraft-assets/master/data/1.15.2/blocks/sand.png',
    'https://raw.githubusercontent.com/PrismarineJS/minecraft-assets/master/data/1.15.2/blocks/gravel.png',
    'https://raw.githubusercontent.com/PrismarineJS/minecraft-assets/master/data/1.15.2/blocks/coal_ore.png',
    'https://raw.githubusercontent.com/PrismarineJS/minecraft-assets/master/data/1.15.2/blocks/iron_ore.png',
    'https://raw.githubusercontent.com/PrismarineJS/minecraft-assets/master/data/1.15.2/blocks/gold_ore.png',
    'https://raw.githubusercontent.com/PrismarineJS/minecraft-assets/master/data/1.15.2/blocks/diamond_ore.png',
    'https://raw.githubusercontent.com/PrismarineJS/minecraft-assets/master/data/1.15.2/blocks/emerald_ore.png',
    'https://raw.githubusercontent.com/PrismarineJS/minecraft-assets/master/data/1.15.2/blocks/redstone_ore.png',
    'https://raw.githubusercontent.com/PrismarineJS/minecraft-assets/master/data/1.15.2/blocks/obsidian.png',
    'https://raw.githubusercontent.com/PrismarineJS/minecraft-assets/master/data/1.15.2/blocks/sponge.png',
    'https://raw.githubusercontent.com/PrismarineJS/minecraft-assets/master/data/1.15.2/blocks/glass.png',
    'https://raw.githubusercontent.com/PrismarineJS/minecraft-assets/master/data/1.15.2/blocks/pumpkin_side.png',
    'https://raw.githubusercontent.com/PrismarineJS/minecraft-assets/master/data/1.15.2/blocks/melon_side.png',
    'https://raw.githubusercontent.com/PrismarineJS/minecraft-assets/master/data/1.15.2/blocks/tnt_side.png',
    'https://raw.githubusercontent.com/PrismarineJS/minecraft-assets/master/data/1.15.2/blocks/clay.png',
    'https://raw.githubusercontent.com/PrismarineJS/minecraft-assets/master/data/1.15.2/blocks/crafting_table_top.png',
    'https://raw.githubusercontent.com/PrismarineJS/minecraft-assets/master/data/1.15.2/blocks/furnace_front.png',
    'https://raw.githubusercontent.com/PrismarineJS/minecraft-assets/master/data/1.15.2/blocks/bookshelf.png',
    'https://raw.githubusercontent.com/PrismarineJS/minecraft-assets/master/data/1.15.2/blocks/hay_block_side.png',
    'https://raw.githubusercontent.com/PrismarineJS/minecraft-assets/master/data/1.15.2/blocks/glowstone.png',
    'https://raw.githubusercontent.com/PrismarineJS/minecraft-assets/master/data/1.15.2/blocks/lapis_ore.png',
    'https://raw.githubusercontent.com/PrismarineJS/minecraft-assets/master/data/1.15.2/blocks/netherrack.png',
    'https://raw.githubusercontent.com/PrismarineJS/minecraft-assets/master/data/1.15.2/blocks/soul_sand.png',
    'https://raw.githubusercontent.com/PrismarineJS/minecraft-assets/master/data/1.15.2/blocks/ice.png'
];
