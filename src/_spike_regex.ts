// _spike_regex.ts — 正则链接可行性探针
function main(): void {
    const s = "app-123-toolkit";
    const m1 = s.match(/\d+/);
    const m2 = s.replace(/[-_]/g, " ");
    const m3 = "x/y".match(/^([^\/]+)\/([^\/]+)$/);
    console.log("match:", m1 ? m1[0] : "null");
    console.log("replace:", m2);
    console.log("complex:", m3 ? m3[1] + "|" + m3[2] : "null");
    console.log("REGEX_SPIKE_DONE");
}
main();