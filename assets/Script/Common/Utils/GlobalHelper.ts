export default class GlobalHelper {
    private static _globalMap: { [k: string]: any } = {};
    public static Register(name: string, inst: any) {
        GlobalHelper._globalMap[name] = inst;
    }
    public static Get<T>(name: string): T | undefined {
        return GlobalHelper._globalMap[name] ? GlobalHelper._globalMap[name] as T : undefined;
    }
}

//@ts-ignore
window["GlobalHelper"] = GlobalHelper;