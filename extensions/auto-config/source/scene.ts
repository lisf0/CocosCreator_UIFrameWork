import fs from "fs";
import path from 'path';
import Const from './Const';

const ProjectPath = Editor.Project.path;
let map: { [key: string]: any } = {}

/**
 * @en Registration method for the main process of Extension
 * @zh 为扩展的主进程的注册方法
 */
export const methods: { [key: string]: (...any: any) => any } = {
    /**
     * @en A method that can be triggered by message
     * @zh 通过 message 触发的方法
     */
    showLog() {
        console.log('Hello World');
    },

    /** 遍历resources/forms */
    async generate() {
        console.log(`正在读取配置文件: ${ProjectPath}/${Const.ConfigUrl} 请稍等.`);
        let config = fs.readFileSync(`${ProjectPath}/${Const.ConfigUrl}`, { encoding: 'utf-8' });
        if (!config) {
            console.log(`读取配置文件失败:${ProjectPath}/${Const.ConfigUrl}`);
            return;
        }
        config = JSON.parse(config);
        if (Array.isArray(config)) {
            for (let index = 0; index < config.length; index++) {
                await methods.generateByConfig(config[index]);
            }
        } else {
            await methods.generateByConfig(config);
        }
    },

    async generateByConfig(config: any) {
        let ProjectDir = Editor.Project.path;
        let FormsPath = `${ProjectDir}/${config.RootDir}/${config.FormsDir}`.replace(/\\/g, "/");
        let ConfigPath = `${ProjectDir}/${config.RootDir}/${config.ScriptsDir}/${config.ScriptsName}`.replace(/\\/g, "/");
        if (config.ScriptsDir.startsWith("assets/")) {
            ConfigPath = `${ProjectDir}/${config.ScriptsDir}/${config.ScriptsName}`.replace(/\\/g, "/");
        }

        map = {};
        await methods.walkDirSync(FormsPath, async (prefabUrl: string, stat: any) => {
            let type = await methods.getPrefabType(prefabUrl);
            if (!type) return null;
            let baseName = path.basename(prefabUrl).split(".")[0];
            map[baseName] = {
                bundleName: config.bundle,
                prefabUrl: methods.getResourcesUrl(prefabUrl, config.RootDir),
                type: type
            }
            return null;
        });
        let contentStr = ``;
        for (const key in map) {
            contentStr += `static ${key} = {
        bundleName:"${map[key].bundleName}",
        prefabUrl: "${map[key].prefabUrl}",
        type: "${map[key].type}"
    }
    `
        }
        let className = config.ScriptsName.substring(0, config.ScriptsName.indexOf('.'));
        let strScript = `
export default class ${className} {
    ${contentStr}
}
`;

        let dbConfigPath = ConfigPath.replace(Editor.Project.path.replace(/\\/g, "/"), "db:/");
        await methods.saveFile(dbConfigPath, strScript);

        console.log(`生成${config.ScriptsName}文件成功`);
    },

    saveFile(ScriptPath: string, strScript: string) {
        return Editor.Message.request(
            'asset-db',
            'create-asset',
            ScriptPath,
            strScript,
            { overwrite: true }
        );
    },

    getResourcesUrl(fileUrl: string, rootUrl: string) {
        let url = `${Editor.Project.path}/${rootUrl}/`.replace(/\\/g, "/");
        fileUrl = fileUrl.replace(/\\/g, "/");
        console.log(fileUrl, url);
        return fileUrl.replace(url, "").split('.')[0];
    },

    getPrefabType(fileUrl: string): Promise<string> {
        return new Promise(async (resolve, reject) => {
            let prefab = fs.readFileSync(fileUrl, { encoding: 'utf-8' });
            let prefabJson = JSON.parse(prefab);
            let idx = prefabJson.length;
            while (--idx >= 0) {
                let obj = prefabJson[idx];
                let uuidZip = obj.__type__;
                if (uuidZip.indexOf("cc.") == -1) {
                    let uuid = Editor.Utils.UUID.decompressUUID(uuidZip);
                    let info = await Editor.Message.request('asset-db', 'query-asset-info', uuid);
                    if (info) {
                        let fsComponentPath = info.file;
                        // let dbFileUrls = getResourcesUrl(fsComponentPath).split("/");
                        // let fileName = dbFileUrls[dbFileUrls.length - 1];
                        let fileName = path.basename(fsComponentPath).split(".")[0];
                        if (fileName.indexOf("UI") >= 0 && fileName.indexOf("_Auto") == -1) {//注意 只检测文件名包含UI的文件&排除自动生成的Auto脚本
                            // console.warn(`fileName:${fileName}`);
                            let datastr = fs.readFileSync(fsComponentPath);
                            if (datastr.indexOf("extends UIScreen") >= 0) {
                                resolve("UIScreen");
                            } else if (datastr.indexOf("extends UIWindow") >= 0) {
                                resolve("UIWindow");
                            } else if (datastr.indexOf("extends UIFixed") >= 0) {
                                resolve("UIFixed");
                            } else if (datastr.indexOf("extends UITips") >= 0) {
                                resolve("UITips");
                            } else if (datastr.indexOf("extends UIToast") >= 0) {
                                resolve("UIToast");
                            } else {
                                console.log(`${fileUrl}, 没有继承UIBase`);
                                // return "";
                            }
                        }
                    }
                }
            }
            resolve("");
        });
    },

    // 遍历文件夹
    async walkDirSync(dir: string, callback: (fileUrl: string, stat: any) => Promise<null>) {
        let items = fs.readdirSync(dir);
        for (let i = 0; i < items.length; i++) {
            let name = items[i];
            let filePath = path.join(dir, name);
            let stat = fs.statSync(filePath);
            if (stat.isFile()) {
                let extName = path.extname(filePath);
                if (methods.checkIsPrefab(extName)) {
                    await callback(filePath, stat);
                } else {
                    if (extName != '.meta') console.log(`提示: 跳过${filePath}, 因为它不是prefab~`);
                }
            } else if (stat.isDirectory()) {
                await methods.walkDirSync(filePath, callback);
            }
        }
        return null;
    },

    checkIsPrefab(extName: string) {
        return extName == '.prefab';
    }


};

/**
 * @en Method Triggered on Extension Startup
 * @zh 扩展启动时触发的方法
 */
export function load() { }

/**
 * @en Method triggered when uninstalling the extension
 * @zh 卸载扩展时触发的方法
 */
export function unload() { }

