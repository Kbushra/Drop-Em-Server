export function number_to_alphanumeric(num: number): string
{
    if (num < 10) { num += 48; } //0-9
    else if (num < 10 + 26) { num += 65 - 10; } //A-Z
    else if (num < 10 + 26 + 26) { num += 97 - (10 + 26); } //a-z
    return String.fromCharCode(num);
}

export function number_to_base62(num: number, len: number): string
{
    if (num >= 62**len) { return ""; }

    let result: string = "";
    for (let i: number = 0; i < len; i++)
    {
        const mask: number = 62**(len - i - 1);
        const quotient: number = Math.floor(num / mask);
        num -= quotient * mask;
        result += number_to_alphanumeric(quotient);
    }

    return result;
}

export function generate_random_string(blacklist: string[], len: number): string
{
    if (blacklist.length === 62**len) { return ""; }

    let result: string = "";

    for (let i: number = 0; i < 50; i++) //50 attempts max
    {
        result = "";
        for (let i: number = 0; i < len; i++)
        {
            const num = Math.floor(Math.random() * 62);
            result += number_to_alphanumeric(num);
        }

        if (!blacklist.includes(result)) { return result; }
    }

    for (let i: number = 0; i < 62**len; i++)
    {
        result = number_to_base62(i, len);
        if (!blacklist.includes(result)) { return result; }
    }

    return "";
}