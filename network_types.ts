export const NETWORK_TYPES =
{
    HEARTBEAT: 0,
    ADD_HOST: 1,
    GET_HOSTS: 2,
    JOIN: 3,
    LEAVE: 4,
    KICK: 5,
    SET_INPUTS_GET_FRAME: 6,
    SET_FRAME_GET_INPUTS: 7
} as const;

export type NETWORK_TYPES = (typeof NETWORK_TYPES)[keyof typeof NETWORK_TYPES];