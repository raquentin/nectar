export function maybePrintJSON(flag: unknown, payload: unknown) {
    if (flag) {
        console.log(JSON.stringify(payload, null, 2));
    }
}
