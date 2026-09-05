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

    const original_num = Math.floor(Math.random() * (62**len));
    let num = original_num;

    result = number_to_base62(num, len);
    if (!blacklist.includes(result)) { return result; }

    while (--num >= 0)
    {
        result = number_to_base62(num, len);
        if (!blacklist.includes(result)) { return result; }
    }

    num = original_num;
    while (++num < 62**len)
    {
        result = number_to_base62(num, len);
        if (!blacklist.includes(result)) { return result; }
    }

    return "";
}