import { IncomingMessage } from "http";
import { WebSocket } from "ws";

export interface InputInfo
{
    input_pressed: boolean[],
    input_held: boolean[],
    input_released: boolean[],
    delta: number
}

export interface HostInfo
{
    ip: string,
    port: number,

    name: string,
    creation_time: number,
    join_code_index: number,

    client_indices: number[],
    frame_data: Record<string, any>
}

export interface DiscoveryHostInfo
{
    name: string,
    creation_time: number,
    join_code: string
}

export interface ClientInfo
{
    ip: string,
    port: number,

    host_index: number,
    input_data: InputInfo[],
    last_input_time: number
}

export class Packet
{
    public data: Record<string, any>;
    private ws: WebSocket;
    private req: IncomingMessage;
    constructor(data: Record<string, any>, ws: WebSocket, req: IncomingMessage)
    {
        this.data = data;
        this.ws = ws;
        this.req = req;
    }

    public get ip() { return this.req.socket.remoteAddress; }
    public get port() { return this.req.socket.remotePort; }
    public get address() { return `${this.ip}:${this.req.socket.remotePort}`; }

    public send(data: Record<string, any>) { this.ws.send(JSON.stringify(data)); }
}