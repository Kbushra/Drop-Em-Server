export function safe_parse(data: string): Record<string, any>
{
    try
    {
        const res: object = JSON.parse(data);
        if (!Array.isArray(res)) { return res; }
    }
    catch (e) {}

    return {};
}

export function verify(data: Record<string, any>, prop_names: string[], prop_types: string[])
{
    if (prop_names.length != prop_types.length) { return false; }

    for (let i: number = 0; i < prop_names.length; i++)
    {
        if (!(prop_names[i] in data) || typeof data[prop_names[i]] != prop_types[i]) { return false; }
    }
    
    return true;
}