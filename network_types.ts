export const NETWORK_TYPES =
{
    ADD_HOST: 0,
    GET_HOSTS: 1,
    CONNECT: 2,
    SET_INPUTS_GET_FRAME: 3,
    SET_FRAME_GET_INPUTS: 4
} as const;

export type NETWORK_TYPES = (typeof NETWORK_TYPES)[keyof typeof NETWORK_TYPES];