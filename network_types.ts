export const NETWORK_TYPES =
{
    ADD_HOST: 0,
    GET_HOSTS: 1,
    JOIN: 2,
    LEAVE: 3,
    KICK: 4,
    SET_INPUTS_GET_FRAME: 5,
    SET_FRAME_GET_INPUTS: 6,
    PING: 7
} as const;

export type NETWORK_TYPES = (typeof NETWORK_TYPES)[keyof typeof NETWORK_TYPES];