import http from '@/api/http';
import { rawDataToServerEggVariable } from '@/api/transformers';
import { ServerEggVariable } from '@/api/server/types';
export interface StartupVariablesResponse {
    variables: ServerEggVariable[];
    invocation: string;
}
export const getStartupVariables = async (uuid: string): Promise<StartupVariablesResponse> => {
    const { data } = await http.get(`/api/client/servers/${uuid}/startup`);
    const variables = (data.data || []).map(rawDataToServerEggVariable);
    return {
        variables,
        invocation: data.meta.startup_command,
    };
};
export const updateStartupVariable = async (
    uuid: string,
    key: string,
    value: string
): Promise<{ variable: ServerEggVariable | null; invocation: string }> => {
    const { data } = await http.put(`/api/client/servers/${uuid}/startup/variable`, { key, value });
    const rawData = data.data || data;
    if (!rawData || !rawData.attributes) {
        return {
            variable: null,
            invocation: data.meta?.startup_command || '',
        };
    }
    return {
        variable: rawDataToServerEggVariable(rawData),
        invocation: data.meta?.startup_command || '',
    };
};
export interface PropertiesResponse {
    success: boolean;
    content: Record<string, string>;
    raw: string;
    error?: string;
}
export interface World {
    name: string;
    is_default: boolean;
}
export interface WorldsResponse {
    success: boolean;
    worlds: World[];
    default_world: string | null;
}
export interface Experiment {
    key: string;
    name: string;
    description: string;
    enabled: boolean;
}
export interface ExperimentsResponse {
    success: boolean;
    world?: string;
    experiments: Record<string, Experiment>;
    error?: string;
}
export interface AvailableExperimentsResponse {
    success: boolean;
    experiments: Record<
        string,
        {
            name: string;
            description: string;
            key: string;
            required: boolean;
        }
    >;
}
export interface WorldSetting {
    key: string;
    value: any;
    nbt_type: number;
    name: string;
    type: string;
    category: string;
    options?: Record<number, string>;
}
export interface WorldSettingsResponse {
    success: boolean;
    world?: string;
    settings: Record<string, WorldSetting>;
    error?: string;
}
export const getProperties = (uuid: string): Promise<PropertiesResponse> => {
    return http.get(`/api/client/servers/${uuid}/bedrock/config/properties`).then((response) => response.data);
};
export const saveProperties = (
    uuid: string,
    contents: Record<string, string> | null,
    rawContent: string | null
): Promise<{ success: boolean; error?: string }> => {
    return http
        .post(`/api/client/servers/${uuid}/bedrock/config/properties`, {
            contents,
            raw_content: rawContent,
        })
        .then((response) => response.data);
};
export const getWorlds = (uuid: string): Promise<WorldsResponse> => {
    return http.get(`/api/client/servers/${uuid}/bedrock/config/worlds`).then((response) => response.data);
};
export const getExperiments = (uuid: string, world?: string): Promise<ExperimentsResponse> => {
    const params = world ? { world } : {};
    return http.get(`/api/client/servers/${uuid}/bedrock/config/experiments`, { params }).then((response) => response.data);
};
export const saveExperiments = (
    uuid: string,
    world: string,
    experiments: Record<string, boolean>
): Promise<{ success: boolean; message?: string; error?: string }> => {
    return http
        .post(`/api/client/servers/${uuid}/bedrock/config/experiments`, {
            world,
            experiments,
        })
        .then((response) => response.data);
};
export const getAvailableExperiments = (uuid: string): Promise<AvailableExperimentsResponse> => {
    return http.get(`/api/client/servers/${uuid}/bedrock/config/experiments/available`).then((response) => response.data);
};
export const getWorldSettings = (uuid: string, world?: string): Promise<WorldSettingsResponse> => {
    const params = world ? { world } : {};
    return http.get(`/api/client/servers/${uuid}/bedrock/config/world-settings`, { params }).then((response) => response.data);
};
export const saveWorldSettings = (
    uuid: string,
    world: string,
    settings: Record<string, any>
): Promise<{ success: boolean; message?: string; error?: string }> => {
    return http
        .post(`/api/client/servers/${uuid}/bedrock/config/world-settings`, {
            world,
            settings,
        })
        .then((response) => response.data);
};
export const getRawNbt = (
    uuid: string,
    world?: string
): Promise<{ success: boolean; world?: string; data?: any; error?: string }> => {
    const params = world ? { world } : {};
    return http.get(`/api/client/servers/${uuid}/bedrock/config/raw-nbt`, { params }).then((response) => response.data);
};
